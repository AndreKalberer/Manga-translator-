import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { renderPanel } from '@/lib/render';
import { checkAndConsume, DAILY_LIMIT, QUOTA_COOKIE_NAME } from '@/lib/quota';
import { getClientIp } from '@/lib/ip';
import { logSecurityEvent } from '@/lib/log';
import {
  LANGUAGE_NAMES,
  type Mode,
  type Language,
  type PanelAnalysis,
  type BubbleKind,
} from '@/types';

// Re-render runs only the image model (no translator), so the timeout budget
// is the same as the render half of /api/translate — we don't need a 300s
// ceiling. Stay on Pro-eligible duration for safety.
export const maxDuration = 240;

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_WIDTH = 1500;
const MAX_BUBBLES = 50;
const MAX_FIELD_LEN = 500;
const VALID_MODES: Mode[] = ['translate', 'color', 'both'];
const VALID_LANGS = Object.keys(LANGUAGE_NAMES) as Language[];
const VALID_KINDS: BubbleKind[] = ['speech', 'thought', 'sfx', 'narration', 'sign'];

function isValidImageMagic(buf: Buffer): boolean {
  if (buf.length < 12) return false;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return true;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return true;
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return true;
  return false;
}

function sseEvent(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const e = err as { status?: number; message: string };
    const status = e.status;
    if (status === 401) return `[401] API key invalid or missing — check OPENAI_API_KEY in Vercel dashboard.`;
    if (status === 403) return `[403] API access denied — verify OpenAI org has billing enabled.`;
    if (status === 429) return `[429] Rate limited — the image model is busy. Please wait and try again.`;
    if (status) return `[${status}] ${e.message}`;
    return `Error: ${e.message}`;
  }
  return `Re-render failed: ${String(err)}`;
}

// Validate + sanitize a user-supplied PanelAnalysis. Hard caps prevent abuse
// (huge prompts, control chars, injection-flavored content). Anything that
// fails returns null so the caller can reject the whole request.
function parseAnalysis(raw: unknown): PanelAnalysis | null {
  if (typeof raw !== 'string') return null;
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { return null; }
  if (!parsed || typeof parsed !== 'object') return null;
  const obj = parsed as Record<string, unknown>;
  if (!Array.isArray(obj.bubbles)) return null;
  if (obj.bubbles.length > MAX_BUBBLES) return null;
  const sceneNotes = typeof obj.sceneNotes === 'string' ? obj.sceneNotes.slice(0, MAX_FIELD_LEN) : '';

  const bubbles: PanelAnalysis['bubbles'] = [];
  for (const b of obj.bubbles) {
    if (!b || typeof b !== 'object') return null;
    const bb = b as Record<string, unknown>;
    if (!VALID_KINDS.includes(bb.kind as BubbleKind)) return null;
    const translatedText = typeof bb.translatedText === 'string' ? bb.translatedText.slice(0, MAX_FIELD_LEN) : '';
    if (!translatedText.trim()) return null; // empty translation isn't renderable
    bubbles.push({
      kind: bb.kind as BubbleKind,
      speakerDescription:
        typeof bb.speakerDescription === 'string' ? bb.speakerDescription.slice(0, MAX_FIELD_LEN) : '',
      voiceNotes: typeof bb.voiceNotes === 'string' ? bb.voiceNotes.slice(0, MAX_FIELD_LEN) : '',
      originalText: typeof bb.originalText === 'string' ? bb.originalText.slice(0, MAX_FIELD_LEN) : '',
      translatedText,
    });
  }
  return { bubbles, sceneNotes };
}

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Service is not configured.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const origin = request.headers.get('origin');
  if (origin) {
    const allowed = [process.env.NEXT_PUBLIC_SITE_URL, 'http://localhost:3000']
      .filter((v): v is string => typeof v === 'string' && v.length > 0);
    if (!allowed.includes(origin)) {
      logSecurityEvent(getClientIp(request), { event: 'translate.invalid_origin', origin });
      return new Response(
        JSON.stringify({ error: 'Forbidden origin.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  const ip = getClientIp(request);
  if (!ip) {
    logSecurityEvent(null, { event: 'translate.missing_ip' });
    return new Response(
      JSON.stringify({ error: 'Could not identify client.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE + 16384) {
    return new Response(
      JSON.stringify({ error: 'Request body too large.' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const rawMode = formData.get('mode');
  if (!VALID_MODES.includes(rawMode as Mode)) {
    return new Response(
      JSON.stringify({ error: `Invalid mode.` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  const mode = rawMode as Mode;

  // Re-rendering color-only doesn't make sense — there's no analysis to edit.
  if (mode === 'color') {
    return new Response(
      JSON.stringify({ error: 'Re-render is only available for translate / both modes.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const rawLang = formData.get('targetLang');
  const targetLang: Language = VALID_LANGS.includes(rawLang as Language)
    ? (rawLang as Language)
    : 'en';

  const analysis = parseAnalysis(formData.get('analysis'));
  if (!analysis) {
    return new Response(
      JSON.stringify({ error: 'Invalid or missing analysis payload.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (analysis.bubbles.length === 0) {
    return new Response(
      JSON.stringify({ error: 'Cannot re-render with zero bubbles.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const file = formData.get('image');
  if (!(file instanceof File)) {
    return new Response(
      JSON.stringify({ error: 'No image file provided.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (!file.type.startsWith('image/')) {
    logSecurityEvent(ip, { event: 'translate.invalid_type', mime: file.type });
    return new Response(
      JSON.stringify({ error: 'Uploaded file is not an image.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (file.size > MAX_FILE_SIZE) {
    logSecurityEvent(ip, { event: 'translate.size_exceeded', bytes: file.size });
    return new Response(
      JSON.stringify({ error: 'Image exceeds the 4 MB size limit.' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const arrayBuffer = await file.arrayBuffer();
  const inputBuffer = Buffer.from(arrayBuffer);
  if (!isValidImageMagic(inputBuffer)) {
    logSecurityEvent(ip, { event: 'translate.invalid_image_magic' });
    return new Response(
      JSON.stringify({ error: 'Invalid image file.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Re-render is always 1 use regardless of mode — the translator is skipped,
  // so we don't need to charge double for "both" the way the initial route does.
  const cost: 1 = 1;
  const quotaCookie = request.cookies.get(QUOTA_COOKIE_NAME)?.value;
  const quota = checkAndConsume(ip, quotaCookie, cost);
  if (!quota.allowed) {
    if (quota.reason === 'burst') {
      logSecurityEvent(ip, { event: 'quota.burst_blocked' });
    } else {
      logSecurityEvent(ip, {
        event: 'quota.daily_blocked',
        used: DAILY_LIMIT - quota.remaining,
        limit: DAILY_LIMIT,
        cost,
      });
    }
    const message =
      quota.reason === 'daily'
        ? `You've used all ${DAILY_LIMIT} free uses for today. Come back tomorrow!`
        : 'Too many requests. Please wait a moment and try again.';
    return new Response(
      JSON.stringify({ error: message, remaining: quota.remaining, resetAt: quota.resetAt }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  const abortController = new AbortController();
  request.signal.addEventListener('abort', () => abortController.abort());

  (async () => {
    try {
      console.log(`[rerender] start — size=${file.size} type=${file.type} mode=${mode} lang=${targetLang} bubbles=${analysis.bubbles.length}`);

      const SHARP_TIMEOUT_MS = 15_000;
      const pngBuffer = await Promise.race([
        sharp(inputBuffer)
          .resize({ width: MAX_WIDTH, withoutEnlargement: true })
          .png()
          .toBuffer(),
        new Promise<never>((_, reject) =>
          setTimeout(() => {
            abortController.abort();
            reject(new Error('Image processing timed out.'));
          }, SHARP_TIMEOUT_MS)
        ),
      ]);

      if (abortController.signal.aborted) return;

      const originalBase64 = pngBuffer.toString('base64');
      const originalDataUrl = `data:image/png;base64,${originalBase64}`;

      await writer.write(sseEvent({ step: 'rendering', mode }));
      console.log('[rerender] calling renderPanel...');

      const RENDER_TIMEOUT_MS = 230 * 1000;
      const variationBase64s = await Promise.race([
        renderPanel(pngBuffer, mode, targetLang, analysis, abortController.signal),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Render timed out after 230 seconds.')), RENDER_TIMEOUT_MS)
        ),
      ]);
      console.log(`[rerender] renderPanel done — ${variationBase64s.length} variations`);

      if (abortController.signal.aborted) return;

      const variations = variationBase64s.map((b64, i) => ({
        index: i,
        dataUrl: `data:image/png;base64,${b64}`,
      }));

      await writer.write(
        sseEvent({
          step: 'done',
          originalDataUrl,
          variations,
          analysis,
          remaining: quota.remaining,
          resetAt: quota.resetAt,
        })
      );
    } catch (err) {
      console.error('[rerender] error:', err);
      try {
        await writer.write(sseEvent({ step: 'error', message: safeErrorMessage(err) }));
      } catch { /* writer closed */ }
    } finally {
      try { await writer.close(); } catch { /* already closed */ }
    }
  })().catch(() => { /* prevent unhandled rejection */ });

  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  };
  if (quota.setCookie) headers['Set-Cookie'] = quota.setCookie;

  return new Response(readable, { headers });
}
