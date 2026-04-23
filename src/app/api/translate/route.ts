import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { renderPanel } from '@/lib/render';
import { translatePanel } from '@/lib/translator';
import { checkAndConsume, DAILY_LIMIT, QUOTA_COOKIE_NAME } from '@/lib/quota';
import type { Mode, PanelAnalysis } from '@/types';

// Requires Vercel Pro plan (Pro caps at 300s; Hobby caps at 60s).
export const maxDuration = 300;

const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_WIDTH = 1500;
const VALID_MODES: Mode[] = ['translate', 'color', 'both'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sseEvent(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    const e = err as { status?: number; statusText?: string; message: string };
    const status = e.status;
    if (status === 401) return `[401] API key invalid or missing — check OPENAI_API_KEY in Vercel dashboard.`;
    if (status === 403) return `[403] API access denied — this model requires a verified OpenAI org with billing enabled. Check https://platform.openai.com/settings/organization/billing.`;
    if (status === 429) return `[429] Rate limited — the translation service is busy. Please wait and try again.`;
    if (status === 400) return `[400] Bad request — ${e.message}`;
    if (status === 413) return `[413] Payload too large — ${e.message}`;
    if (status) return `[${status}] ${e.message}`;
    // No HTTP status — surface the raw message so we can see what's actually failing
    return `Error: ${e.message}`;
  }
  return `Processing failed: ${String(err)}`;
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Service is not configured.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const ip = getClientIp(request);

  // Body size guard before reading
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE + 8192) {
    return new Response(
      JSON.stringify({ error: 'Request body too large.' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Parse form data first so we can read the mode before consuming quota
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid request body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Validate mode
  const rawMode = formData.get('mode');
  const mode: Mode = VALID_MODES.includes(rawMode as Mode)
    ? (rawMode as Mode)
    : 'translate';

  const cost: 1 | 2 = mode === 'both' ? 2 : 1;

  // Consume quota
  const quotaCookie = request.cookies.get(QUOTA_COOKIE_NAME)?.value;
  const quota = checkAndConsume(ip, quotaCookie, cost);
  if (!quota.allowed) {
    const message =
      quota.reason === 'daily'
        ? quota.remaining < cost
          ? `Not enough uses remaining. "${mode}" costs ${cost} uses but you only have ${quota.remaining} left today.`
          : `You've used all ${DAILY_LIMIT} free uses for today. Come back tomorrow!`
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
      const file = formData.get('image');

      if (!(file instanceof File)) {
        await writer.write(sseEvent({ step: 'error', message: 'No image file provided.' }));
        return;
      }

      if (!file.type.startsWith('image/')) {
        await writer.write(sseEvent({ step: 'error', message: 'Uploaded file is not an image.' }));
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        await writer.write(sseEvent({ step: 'error', message: 'Image exceeds the 4 MB size limit.' }));
        return;
      }

      console.log(`[translate] start — file=${file.name} size=${file.size} type=${file.type} mode=${mode}`);

      // Convert to PNG (sharp also validates the image — rejects non-images)
      const SHARP_TIMEOUT_MS = 15_000;
      const arrayBuffer = await file.arrayBuffer();
      console.log('[translate] running sharp...');
      const pngBuffer = await Promise.race([
        sharp(Buffer.from(arrayBuffer))
          .resize({ width: MAX_WIDTH, withoutEnlargement: true })
          .png()
          .toBuffer(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Image processing timed out.')), SHARP_TIMEOUT_MS)
        ),
      ]);
      console.log(`[translate] sharp done — output ${pngBuffer.length} bytes`);

      if (abortController.signal.aborted) return;

      const originalBase64 = pngBuffer.toString('base64');
      const originalDataUrl = `data:image/png;base64,${originalBase64}`;

      // Stage 1 — LLM translation (skipped for color-only mode)
      let analysis: PanelAnalysis | undefined;
      if (mode !== 'color') {
        await writer.write(sseEvent({ step: 'analyzing', mode }));
        console.log('[translate] calling translatePanel...');
        const ANALYZE_TIMEOUT_MS = 60 * 1000;
        analysis = await Promise.race([
          translatePanel(pngBuffer, abortController.signal),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Translation analysis timed out after 60 seconds.')), ANALYZE_TIMEOUT_MS)
          ),
        ]);
        console.log(`[translate] translatePanel done — ${analysis.bubbles.length} bubbles`);
        if (abortController.signal.aborted) return;
      }

      // Stage 2 — image render (colorize + letter the translations in)
      await writer.write(sseEvent({ step: 'rendering', mode }));
      console.log('[translate] calling renderPanel...');
      const RENDER_TIMEOUT_MS = 230 * 1000; // leave headroom under the 300s maxDuration ceiling after the analyze step
      const variationBase64s = await Promise.race([
        renderPanel(pngBuffer, mode, analysis, abortController.signal),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Render timed out after 230 seconds.')), RENDER_TIMEOUT_MS)
        ),
      ]);
      console.log(`[translate] renderPanel done — ${variationBase64s.length} variations`);

      if (abortController.signal.aborted) return;

      const variations = variationBase64s.map((b64, index) => ({
        index,
        dataUrl: `data:image/png;base64,${b64}`,
      }));

      const safeFileName = file.name.replace(/[^a-zA-Z0-9._\- ]/g, '_').slice(0, 200);

      await writer.write(
        sseEvent({
          step: 'done',
          imageId: crypto.randomUUID(),
          originalFileName: safeFileName,
          originalDataUrl,
          variations,
          mode,
          analysis,
          remaining: quota.remaining,
          resetAt: quota.resetAt,
        })
      );
    } catch (err) {
      console.error('[/api/translate] processing error:', err);
      if (abortController.signal.aborted) return;
      try {
        await writer.write(sseEvent({ step: 'error', message: safeErrorMessage(err) }));
      } catch { /* stream already closed — client disconnected */ }
    } finally {
      try { await writer.close(); } catch { /* already closed */ }
    }
  })().catch(() => { /* prevent unhandled rejection if the IIFE itself throws */ });

  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  };
  if (quota.setCookie) headers['Set-Cookie'] = quota.setCookie;

  return new Response(readable, { headers });
}
