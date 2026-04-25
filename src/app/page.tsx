'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { track } from '@vercel/analytics';
import Navbar from '@/components/Navbar';
import UploadZone from '@/components/UploadZone';
import ImageResultCard from '@/components/ImageResultCard';
import ProgressBar from '@/components/ProgressBar';
import AdUnit from '@/components/AdUnit';
import HeroIllustration from '@/components/HeroIllustration';
import SessionCharacters from '@/components/SessionCharacters';
import {
  loadCharacters,
  saveCharacters,
  mergeFromAnalysis,
  type Character,
} from '@/lib/characters';
import {
  ProcessedImage,
  PanelAnalysis,
  QuotaInfo,
  Mode,
  Language,
  TranslationStyle,
  SfxMode,
  TranslationOptions,
  LANGUAGE_NAMES,
} from '@/types';

const MODE_STORAGE_KEY = 'mtl.mode';
const OPTIONS_STORAGE_KEY = 'mtl.options';
const COMPARE_STORAGE_KEY = 'mtl.compare';
const VALID_MODES = new Set<Mode>(['translate', 'color', 'both']);
const VALID_LANGS = new Set<Language>(Object.keys(LANGUAGE_NAMES) as Language[]);
const VALID_STYLES = new Set<TranslationStyle>(['official', 'literal', 'casual']);
const VALID_SFX = new Set<SfxMode>(['translate', 'keep', 'bilingual']);

type CompareMode = 'stacked' | 'sideBySide';
const VALID_COMPARE = new Set<CompareMode>(['stacked', 'sideBySide']);

const DEFAULT_OPTIONS: TranslationOptions = {
  targetLang: 'en',
  style: 'official',
  sfx: 'translate',
  glossary: '',
};

// FAQ entries are duplicated into layout.tsx's FAQPage JSON-LD so Google
// can render rich-result FAQ cards. Keep this list and that one in sync.
const FAQ = [
  {
    q: 'What counts as one "use"?',
    a: 'Each panel you upload counts as one use. "Translate + Colorize" mode costs two uses because it runs both a translation pass and a colorization pass.',
  },
  {
    q: 'Does it work on webtoons and manhwa?',
    a: 'Yes. The model handles Japanese manga, Korean manhwa, and Chinese manhua automatically — no language setting needed.',
  },
  {
    q: 'Why do I only get 10 free uses per day?',
    a: 'Each panel costs real money to process via the AI models. A daily limit keeps the service free for everyone. The count resets at UTC midnight.',
  },
  {
    q: 'Are my images stored anywhere?',
    a: 'No. Panels are processed in memory and sent to OpenAI for translation and rendering. We do not save, log, or share your images.',
  },
  {
    q: 'Can I upload a screenshot with browser or reader UI around the panel?',
    a: 'Yes. The model crops to the panel and ignores browser chrome, status bars, and reader-app UI automatically.',
  },
  {
    q: 'Can I translate multiple panels at once?',
    a: 'Yes — drop up to 10 panels in at a time. They process one after another with a progress bar for each.',
  },
];

type AppStatus = 'idle' | 'processing' | 'done';

const MODE_LABELS: Record<Mode, string> = {
  translate: 'Translation',
  color: 'Colorization',
  both: 'Translation + Color',
};

const STEPS = [
  {
    title: 'Upload',
    body: 'Upload your manga page image.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    title: 'Translate',
    body: 'Our tool translates the text instantly.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
        <path d="M4 5h12" />
        <path d="M10 3v2" />
        <path d="M6 19 12 5l4 9" />
        <path d="M8 14h8" />
        <path d="M16 21l5-10 3 6" />
        <path d="M17 17h5" />
      </svg>
    ),
  },
  {
    title: 'Read',
    body: 'Download and enjoy in your language.',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="w-7 h-7">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <circle cx="8.5" cy="8.5" r="1.5" />
        <polyline points="21 15 16 10 5 21" />
      </svg>
    ),
  },
];

export default function HomePage() {
  const [status, setStatus] = useState<AppStatus>('idle');
  const [queue, setQueue] = useState<ProcessedImage[]>([]);
  const [quota, setQuota] = useState<QuotaInfo | null>(null);
  const [mode, setModeState] = useState<Mode>('translate');
  const [options, setOptionsState] = useState<TranslationOptions>(DEFAULT_OPTIONS);
  const [compareMode, setCompareModeState] = useState<CompareMode>('stacked');
  const [characters, setCharacters] = useState<Character[]>([]);
  // Ref mirror so batch translations and re-renders see the latest character
  // memory updates from prior files in the same batch (closures captured at
  // handleSubmit time would otherwise see only the initial value).
  const charactersRef = useRef<Character[]>([]);
  useEffect(() => { charactersRef.current = characters; }, [characters]);

  // Remember last-picked options across sessions so returning users don't
  // re-pick every visit. Each value is validated against its enum so a
  // future schema change can't crash the app reading stale localStorage.
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem(MODE_STORAGE_KEY);
      if (savedMode && VALID_MODES.has(savedMode as Mode)) setModeState(savedMode as Mode);

      const savedOptions = localStorage.getItem(OPTIONS_STORAGE_KEY);
      if (savedOptions) {
        const parsed = JSON.parse(savedOptions) as Partial<TranslationOptions>;
        setOptionsState({
          targetLang: VALID_LANGS.has(parsed.targetLang as Language)
            ? (parsed.targetLang as Language)
            : DEFAULT_OPTIONS.targetLang,
          style: VALID_STYLES.has(parsed.style as TranslationStyle)
            ? (parsed.style as TranslationStyle)
            : DEFAULT_OPTIONS.style,
          sfx: VALID_SFX.has(parsed.sfx as SfxMode)
            ? (parsed.sfx as SfxMode)
            : DEFAULT_OPTIONS.sfx,
          glossary: typeof parsed.glossary === 'string' ? parsed.glossary : '',
        });
      }

      const savedCompare = localStorage.getItem(COMPARE_STORAGE_KEY);
      if (savedCompare && VALID_COMPARE.has(savedCompare as CompareMode)) {
        setCompareModeState(savedCompare as CompareMode);
      }
    } catch { /* storage blocked or stale JSON */ }

    // Characters live in sessionStorage (separate try block — sessionStorage
    // may be available even when localStorage is blocked).
    setCharacters(loadCharacters());
  }, []);

  // Whenever a translation or re-render produces a new analysis, merge its
  // speakers into the running session memory and persist.
  const ingestAnalysis = useCallback((analysis: PanelAnalysis) => {
    setCharacters((prev) => {
      const next = mergeFromAnalysis(prev, analysis);
      saveCharacters(next);
      return next;
    });
  }, []);

  const removeCharacter = useCallback((id: string) => {
    setCharacters((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveCharacters(next);
      return next;
    });
  }, []);

  const clearCharacters = useCallback(() => {
    setCharacters([]);
    saveCharacters([]);
    track('characters_cleared');
  }, []);

  const setCompareMode = useCallback((next: CompareMode) => {
    setCompareModeState(next);
    try { localStorage.setItem(COMPARE_STORAGE_KEY, next); } catch { /* ignore */ }
    track('compare_mode_changed', { mode: next });
  }, []);

  const setMode = useCallback((next: Mode) => {
    setModeState(next);
    try { localStorage.setItem(MODE_STORAGE_KEY, next); } catch { /* ignore */ }
    track('mode_selected', { mode: next });
  }, []);

  const setOptions = useCallback((patch: Partial<TranslationOptions>) => {
    setOptionsState((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(OPTIONS_STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      // Track only the structural changes (lang/style/sfx). Glossary text
      // is user-typed content and not safe to send to analytics.
      if (patch.targetLang) track('lang_selected', { lang: patch.targetLang });
      if (patch.style) track('style_selected', { style: patch.style });
      if (patch.sfx) track('sfx_selected', { sfx: patch.sfx });
      return next;
    });
  }, []);

  useEffect(() => {
    fetch('/api/quota')
      .then((r) => r.json())
      .then((data: QuotaInfo) => setQuota(data))
      .catch(() => null);
  }, []);

  const updateImage = useCallback((id: string, patch: Partial<ProcessedImage>) => {
    setQueue((prev) =>
      prev.map((img) => (img.imageId === id ? { ...img, ...patch } : img))
    );
  }, []);

  // Convert a data:image/png;base64,... URL back into a Blob so we can re-upload
  // the original image to /api/rerender as a regular form file. Avoids needing
  // server-side caching of originals.
  const dataUrlToBlob = (dataUrl: string): Blob => {
    const [header, base64] = dataUrl.split(',');
    const mime = header.match(/data:([^;]+)/)?.[1] ?? 'image/png';
    const bytes = atob(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  };

  const rerenderImage = useCallback(async (imageId: string, editedAnalysis: PanelAnalysis) => {
    const img = queue.find((q) => q.imageId === imageId);
    if (!img) return;
    if (!img.originalDataUrl) {
      updateImage(imageId, { rerenderError: 'Original image is no longer available.' });
      return;
    }

    updateImage(imageId, { rerendering: true, rerenderError: undefined });
    track('rerender_submit', {
      mode: img.mode,
      bubbles: editedAnalysis.bubbles.length,
      lang: options.targetLang,
    });

    const formData = new FormData();
    const blob = dataUrlToBlob(img.originalDataUrl);
    formData.append('image', blob, `${img.originalFileName.replace(/\.[^.]+$/, '')}.png`);
    formData.append('mode', img.mode);
    formData.append('targetLang', options.targetLang);
    formData.append('analysis', JSON.stringify(editedAnalysis));

    try {
      const response = await fetch('/api/rerender', { method: 'POST', body: formData });
      if (!response.ok || !response.body) {
        const text = await response.text().catch(() => '');
        let message = 'Re-render failed.';
        try {
          const parsed = JSON.parse(text);
          message = parsed.error ?? message;
          if (response.status === 429 && parsed.remaining !== undefined) {
            setQuota((prev) =>
              prev ? { ...prev, remaining: parsed.remaining, resetAt: parsed.resetAt } : null
            );
          }
        } catch { /* plain text */ }
        updateImage(imageId, { rerendering: false, rerenderError: message });
        track('rerender_error', { status: response.status, reason: message.slice(0, 80) });
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw) continue;
          let event: Record<string, unknown>;
          try { event = JSON.parse(raw); } catch { continue; }
          const step = event.step as string;

          if (step === 'done') {
            const reAnalysis = event.analysis as ProcessedImage['analysis'] | undefined;
            updateImage(imageId, {
              rerendering: false,
              rerenderError: undefined,
              variations: event.variations as ProcessedImage['variations'],
              selectedIndex: 0,
              analysis: reAnalysis,
            });
            if (reAnalysis) ingestAnalysis(reAnalysis);
            if (event.remaining !== undefined) {
              setQuota((prev) =>
                prev
                  ? { ...prev, remaining: event.remaining as number, resetAt: event.resetAt as string }
                  : null
              );
            }
            track('rerender_done', {
              mode: img.mode,
              bubbles: editedAnalysis.bubbles.length,
              lang: options.targetLang,
            });
          } else if (step === 'error') {
            const message = (event.message as string) ?? 'Unknown error';
            updateImage(imageId, { rerendering: false, rerenderError: message });
            track('rerender_error', { status: 500, reason: message.slice(0, 80) });
          }
        }
      }
    } catch (err) {
      updateImage(imageId, {
        rerendering: false,
        rerenderError: err instanceof Error ? err.message : 'Network error.',
      });
      track('rerender_error', { status: 0, reason: 'network' });
    }
  }, [queue, options.targetLang, updateImage]);

  const processFile = async (
    file: File,
    imageId: string,
    fileMode: Mode,
    fileOptions: TranslationOptions,
  ): Promise<void> => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('mode', fileMode);
    formData.append('targetLang', fileOptions.targetLang);
    formData.append('style', fileOptions.style);
    formData.append('sfx', fileOptions.sfx);
    // Send the latest session-character memory (read fresh per file so a
    // batch upload accumulates context as each panel finishes).
    const sessionChars = charactersRef.current;
    if (sessionChars.length > 0) {
      formData.append('characters', JSON.stringify(sessionChars));
    }
    if (fileOptions.glossary && fileOptions.glossary.trim()) {
      formData.append('glossary', fileOptions.glossary);
    }

    const response = await fetch('/api/translate', { method: 'POST', body: formData });

    if (!response.ok || !response.body) {
      const text = await response.text().catch(() => '');
      let message = 'Server error';
      try {
        const parsed = JSON.parse(text);
        message = parsed.error ?? message;
        if (response.status === 429 && parsed.remaining !== undefined) {
          setQuota((prev) =>
            prev ? { ...prev, remaining: parsed.remaining, resetAt: parsed.resetAt } : null
          );
        }
      } catch { /* plain text */ }
      updateImage(imageId, { status: 'error', errorMessage: message });
      track('translate_error', { status: response.status, reason: message.slice(0, 80) });
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (!raw) continue;

        let event: Record<string, unknown>;
        try { event = JSON.parse(raw); } catch { continue; }

        const step = event.step as string;

        if (step === 'analyzing') {
          updateImage(imageId, { status: 'analyzing' });
        } else if (step === 'rendering') {
          updateImage(imageId, { status: 'rendering' });
        } else if (step === 'done') {
          const analysis = event.analysis as ProcessedImage['analysis'] | undefined;
          updateImage(imageId, {
            status: 'done',
            originalDataUrl: event.originalDataUrl as string,
            variations: event.variations as ProcessedImage['variations'],
            selectedIndex: 0,
            analysis,
          });
          if (analysis) ingestAnalysis(analysis);
          if (event.remaining !== undefined) {
            setQuota((prev) =>
              prev
                ? { ...prev, remaining: event.remaining as number, resetAt: event.resetAt as string }
                : null
            );
          }
          track('translate_done', {
            mode: fileMode,
            lang: fileOptions.targetLang,
            style: fileOptions.style,
            sfx: fileOptions.sfx,
            bubbles: analysis?.bubbles?.length ?? 0,
          });
        } else if (step === 'error') {
          const message = (event.message as string) ?? 'Unknown error';
          updateImage(imageId, { status: 'error', errorMessage: message });
          track('translate_error', { status: 500, reason: message.slice(0, 80) });
        }
      }
    }
  };

  const handleSubmit = async (files: File[]) => {
    const currentMode = mode;
    const currentOptions = options;
    track('translate_submit', {
      mode: currentMode,
      count: files.length,
      lang: currentOptions.targetLang,
      style: currentOptions.style,
      sfx: currentOptions.sfx,
      glossary: currentOptions.glossary && currentOptions.glossary.trim().length > 0 ? 1 : 0,
    });
    const entries: ProcessedImage[] = files.map((file) => ({
      imageId: crypto.randomUUID(),
      originalFileName: file.name,
      originalDataUrl: '',
      variations: [],
      selectedIndex: 0,
      status: 'pending',
      mode: currentMode,
    }));

    setQueue((prev) => [...prev, ...entries]);
    setStatus('processing');

    for (let i = 0; i < files.length; i++) {
      await processFile(files[i], entries[i].imageId, currentMode, currentOptions);
    }

    setStatus('done');
  };

  const isProcessing = status === 'processing';
  const quotaExhausted = quota !== null && quota.remaining === 0;

  const headerSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_HEADER ?? 'header';
  const sidebarSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_SIDEBAR ?? 'sidebar';

  const doneResults = queue.filter((img) => img.status === 'done');
  const inProgressItems = queue.filter((img) => img.status !== 'done');

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar quota={quota} />

      <main className="flex-1">
        {/* ---------- Hero ---------- */}
        <section className="relative overflow-hidden">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 pt-10 sm:pt-16 pb-16">
            <div className="bg-white rounded-[2.5rem] shadow-[0_30px_80px_-40px_rgba(244,63,94,0.35)] border border-accent-100/70 overflow-hidden">
              <div className="grid md:grid-cols-2 gap-8 md:gap-12 items-center px-6 sm:px-10 md:px-14 py-12 md:py-16">
                {/* Left: copy */}
                <div className="space-y-7 text-center md:text-left">
                  <p className="inline-block text-[11px] sm:text-xs font-bold tracking-[0.18em] uppercase text-accent-500">
                    Manga Translation, Made Simple
                  </p>
                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 leading-[1.05]">
                    Translate &amp; Colorize
                    <br />
                    <span className="text-accent-500">in Your Language</span>
                  </h1>
                  <p className="text-gray-500 text-base sm:text-lg leading-relaxed max-w-md mx-auto md:mx-0">
                    Drop a panel in, let the model handle the rest.
                    Publication-quality lettering in your language.
                  </p>

                  <div className="flex flex-col items-center md:items-start gap-3 pt-1">
                    <a
                      href="#translate"
                      className="group inline-flex items-center gap-2.5 bg-accent-400 hover:bg-accent-500 text-white font-semibold text-sm sm:text-base px-7 py-3.5 rounded-xl shadow-[0_10px_25px_-8px_rgba(251,113,133,0.6)] hover:shadow-[0_14px_30px_-8px_rgba(244,63,94,0.7)] transition-all"
                    >
                      Start Translating
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="w-4 h-4 transition-transform group-hover:translate-x-0.5"
                      >
                        <line x1="5" y1="12" x2="19" y2="12" />
                        <polyline points="12 5 19 12 12 19" />
                      </svg>
                    </a>
                    <p className="text-xs text-gray-400 flex items-center gap-1.5">
                      <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-accent-400">
                        <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2zM18 14l1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3zM6 16l.7 2.1L8.8 19l-2.1.7L6 22l-.7-2.1L3.2 19l2.1-.7L6 16z" />
                      </svg>
                      Fast · Clean · Reliable
                    </p>
                  </div>
                </div>

                {/* Right: illustration */}
                <div className="order-first md:order-last">
                  <HeroIllustration />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- How It Works ---------- */}
        <section id="how-it-works" className="relative">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 pb-16">
            <div className="bg-white rounded-[2.5rem] shadow-[0_30px_80px_-50px_rgba(244,63,94,0.3)] border border-accent-100/70 px-6 sm:px-10 md:px-14 py-12 md:py-16">
              <div className="text-center space-y-3 mb-10 md:mb-14">
                <p className="text-[11px] sm:text-xs font-bold tracking-[0.18em] uppercase text-accent-500">
                  How It Works
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                  Translate in 3 Simple Steps
                </h2>
              </div>

              <div className="grid md:grid-cols-3 gap-10 md:gap-4 items-start">
                {STEPS.map((step, i) => (
                  <div key={step.title} className="relative flex flex-col items-center text-center">
                    <div className="w-16 h-16 rounded-full bg-accent-50 border border-accent-100 text-accent-500 flex items-center justify-center mb-4 shadow-sm">
                      {step.icon}
                    </div>
                    <p className="text-base font-semibold text-gray-900 mb-1">
                      {i + 1}. {step.title}
                    </p>
                    <p className="text-sm text-gray-500 max-w-[200px] leading-relaxed">
                      {step.body}
                    </p>

                    {/* Dashed connector on desktop */}
                    {i < STEPS.length - 1 && (
                      <div
                        aria-hidden
                        className="hidden md:block absolute top-8 left-[calc(50%+2rem)] right-[calc(-50%+2rem)] border-t-2 border-dashed border-accent-200"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Why MangaTL vs ChatGPT ---------- */}
        <section id="why" className="scroll-mt-20">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 pb-16">
            <div className="bg-white rounded-[2.5rem] shadow-[0_30px_80px_-50px_rgba(244,63,94,0.3)] border border-accent-100/70 px-6 sm:px-10 md:px-14 py-12 md:py-16">
              <div className="text-center space-y-3 mb-10 md:mb-14">
                <p className="text-[11px] sm:text-xs font-bold tracking-[0.18em] uppercase text-accent-500">
                  Why MangaTL
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                  Why not just use ChatGPT?
                </h2>
                <p className="text-gray-500 text-sm max-w-xl mx-auto pt-1">
                  ChatGPT can read text in a panel. It won&apos;t give you a
                  finished translated panel — and that&apos;s the part that matters.
                </p>
              </div>

              <div className="grid md:grid-cols-2 gap-4 max-w-3xl mx-auto">
                {/* ChatGPT column */}
                <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6">
                  <p className="text-xs font-bold tracking-wider uppercase text-gray-400 mb-4">
                    ChatGPT
                  </p>
                  <ul className="space-y-3 text-sm text-gray-500">
                    <li className="flex gap-2"><span aria-hidden>✗</span><span>Returns plain text — you Photoshop it back into bubbles yourself</span></li>
                    <li className="flex gap-2"><span aria-hidden>✗</span><span>Requires Plus at $20/month for image-in workflows</span></li>
                    <li className="flex gap-2"><span aria-hidden>✗</span><span>One panel at a time through chat</span></li>
                    <li className="flex gap-2"><span aria-hidden>✗</span><span>Generic translations unless you know how to prompt</span></li>
                    <li className="flex gap-2"><span aria-hidden>✗</span><span>Reproduces browser chrome and reader UI around the panel</span></li>
                    <li className="flex gap-2"><span aria-hidden>✗</span><span>No paste-from-clipboard shortcut</span></li>
                  </ul>
                </div>

                {/* MangaTL column */}
                <div className="rounded-2xl border-2 border-accent-200 bg-gradient-to-br from-accent-50 to-white p-6 shadow-[0_10px_30px_-15px_rgba(244,63,94,0.2)]">
                  <p className="text-xs font-bold tracking-wider uppercase text-accent-500 mb-4">
                    MangaTL
                  </p>
                  <ul className="space-y-3 text-sm text-gray-700">
                    <li className="flex gap-2"><span aria-hidden className="text-accent-500 font-bold">✓</span><span>Publication-ready panel with English lettered into the original bubbles</span></li>
                    <li className="flex gap-2"><span aria-hidden className="text-accent-500 font-bold">✓</span><span>Free — 10 translations per day, no account</span></li>
                    <li className="flex gap-2"><span aria-hidden className="text-accent-500 font-bold">✓</span><span>Batch up to 10 panels at once</span></li>
                    <li className="flex gap-2"><span aria-hidden className="text-accent-500 font-bold">✓</span><span>Tuned for manga voice — Viz / Yen Press style, not literal</span></li>
                    <li className="flex gap-2"><span aria-hidden className="text-accent-500 font-bold">✓</span><span>Auto-crops screenshots — ignores browser chrome and reader UI</span></li>
                    <li className="flex gap-2"><span aria-hidden className="text-accent-500 font-bold">✓</span><span>Paste from clipboard with ⌘V — no file-picker click-through</span></li>
                  </ul>
                </div>
              </div>

              <p className="text-center text-xs text-gray-400 mt-8">
                Transcript with speaker notes + original text comes free with every translation.
              </p>
            </div>
          </div>
        </section>

        {/* ---------- Header ad (only if no results yet) ---------- */}
        {doneResults.length === 0 && inProgressItems.length === 0 && (
          <div className="max-w-6xl mx-auto px-5 sm:px-8 pb-10">
            <AdUnit slot={headerSlot} format="horizontal" className="h-[90px] w-full rounded-xl overflow-hidden" />
          </div>
        )}

        {/* ---------- Translate (upload) ---------- */}
        <section id="translate" className="scroll-mt-20">
          <div className="max-w-6xl mx-auto px-5 sm:px-8 pb-16">
            <div className="max-w-xl mx-auto space-y-8">
              <div className="text-center space-y-2">
                <p className="text-[11px] sm:text-xs font-bold tracking-[0.18em] uppercase text-accent-500">
                  Translate
                </p>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                  Drop your panels in
                </h2>
                <p className="text-gray-500 text-sm">
                  Choose a mode, drop in your panels, and get clean English lettering.
                </p>
              </div>

              <SessionCharacters
                characters={characters}
                onRemove={removeCharacter}
                onClear={clearCharacters}
              />

              <UploadZone
                onSubmit={handleSubmit}
                mode={mode}
                onModeChange={setMode}
                options={options}
                onOptionsChange={setOptions}
                disabled={isProcessing}
                quotaExhausted={quotaExhausted}
                remaining={quota?.remaining}
              />

              {/* Processing queue */}
              {inProgressItems.length > 0 && (
                <div className="space-y-2">
                  {inProgressItems.map((img) => (
                    <ProgressBar
                      key={img.imageId}
                      fileName={img.originalFileName}
                      status={img.status}
                      errorMessage={img.errorMessage}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ---------- Results ---------- */}
        {doneResults.length > 0 && (
          <section className="max-w-6xl mx-auto px-5 sm:px-8 pb-20 space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-xl font-bold text-gray-900">Results</h2>
              <div className="flex items-center gap-3">
                {/* Stacked / Side-by-side toggle (hidden on mobile — side-by-side
                    images at <md widths would be too small to read). */}
                <div className="hidden md:inline-flex items-center bg-gray-100 rounded-lg p-0.5 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setCompareMode('stacked')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      compareMode === 'stacked'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Stacked
                  </button>
                  <button
                    type="button"
                    onClick={() => setCompareMode('sideBySide')}
                    className={`px-2.5 py-1 rounded-md transition-colors ${
                      compareMode === 'sideBySide'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    Side-by-side
                  </button>
                </div>
                <span className="text-sm text-gray-400">
                  {doneResults.length} panel{doneResults.length !== 1 ? 's' : ''} processed
                </span>
              </div>
            </div>
            <div
              className={`grid gap-5 ${
                // In side-by-side mode, give each card the full row so the
                // Original | Translation pair has room to breathe at md+ widths.
                compareMode === 'sideBySide'
                  ? 'grid-cols-1'
                  : 'grid-cols-1 md:grid-cols-2'
              }`}
            >
              {doneResults.map((img) => (
                <ImageResultCard
                  key={img.imageId}
                  result={img}
                  modeLabel={MODE_LABELS[img.mode]}
                  compareMode={compareMode}
                  onRerender={rerenderImage}
                />
              ))}
            </div>

            <AdUnit
              slot={sidebarSlot}
              format="rectangle"
              className="h-[250px] w-full max-w-sm mx-auto rounded-xl overflow-hidden"
            />
          </section>
        )}

        {/* ---------- FAQ ---------- */}
        <section id="faq" className="scroll-mt-20">
          <div className="max-w-3xl mx-auto px-5 sm:px-8 pb-20">
            <div className="text-center space-y-2 mb-8">
              <p className="text-[11px] sm:text-xs font-bold tracking-[0.18em] uppercase text-accent-500">
                FAQ
              </p>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                Questions, answered
              </h2>
            </div>
            <div className="space-y-3">
              {FAQ.map((item) => (
                <details
                  key={item.q}
                  className="group bg-white rounded-2xl border border-gray-100 px-5 py-4 open:shadow-sm transition-shadow"
                >
                  <summary className="cursor-pointer list-none flex items-center justify-between gap-4">
                    <span className="font-semibold text-gray-900 text-sm sm:text-base">
                      {item.q}
                    </span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className="flex-shrink-0 w-4 h-4 text-gray-400 transition-transform group-open:rotate-180"
                      aria-hidden
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </summary>
                  <p className="text-sm text-gray-600 leading-relaxed mt-3">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
