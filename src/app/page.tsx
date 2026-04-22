'use client';

import { useState, useCallback, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import UploadZone from '@/components/UploadZone';
import ImageResultCard from '@/components/ImageResultCard';
import ProgressBar from '@/components/ProgressBar';
import AdUnit from '@/components/AdUnit';
import HeroIllustration from '@/components/HeroIllustration';
import { ProcessedImage, QuotaInfo, Mode } from '@/types';

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
  const [mode, setMode] = useState<Mode>('translate');

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

  const processFile = async (file: File, imageId: string, fileMode: Mode): Promise<void> => {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('mode', fileMode);

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
          updateImage(imageId, {
            status: 'done',
            originalDataUrl: event.originalDataUrl as string,
            variations: event.variations as ProcessedImage['variations'],
            selectedIndex: 0,
            analysis: event.analysis as ProcessedImage['analysis'],
          });
          if (event.remaining !== undefined) {
            setQuota((prev) =>
              prev
                ? { ...prev, remaining: event.remaining as number, resetAt: event.resetAt as string }
                : null
            );
          }
        } else if (step === 'error') {
          updateImage(imageId, {
            status: 'error',
            errorMessage: (event.message as string) ?? 'Unknown error',
          });
        }
      }
    }
  };

  const handleSubmit = async (files: File[]) => {
    const currentMode = mode;
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
      await processFile(files[i], entries[i].imageId, currentMode);
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
                    Drop a panel in, let the model handle the rest. Get three
                    lettered variations to pick from — no language barrier.
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
                  Choose a mode, drop in your panels, and get 3 options to pick from.
                </p>
              </div>

              <UploadZone
                onSubmit={handleSubmit}
                mode={mode}
                onModeChange={setMode}
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
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Results</h2>
              <span className="text-sm text-gray-400">
                {doneResults.length} panel{doneResults.length !== 1 ? 's' : ''} processed
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {doneResults.map((img) => (
                <ImageResultCard
                  key={img.imageId}
                  result={img}
                  modeLabel={MODE_LABELS[img.mode]}
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
      </main>
    </div>
  );
}
