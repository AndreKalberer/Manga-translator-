import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { renderPanel } from '@/lib/render';
import { checkAndConsume, DAILY_LIMIT } from '@/lib/quota';
import { logSecurityEvent } from '@/lib/log';
import type { Mode } from '@/types';

// Requires Vercel Pro plan; on Hobby the function is capped at 10s regardless.
export const maxDuration = 60;

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
    if (status === 401) return `[401] API key invalid or missing — check GEMINI_API_KEY in Vercel dashboard.`;
    if (status === 403) return `[403] API access denied — this model requires a paid Gemini API plan. Check billing at aistudio.google.com.`;
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
  // x-vercel-forwarded-for is set by Vercel's edge and cannot be forged by clients
  return (
    request.headers.get('x-vercel-forwarded-for') ??
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Service is not configured.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const ip = getClientIp(request);

  // Body size guard before reading. If the client omits Content-Length this check is
  // skipped and the full body is buffered by formData(); the definitive size check on
  // file.size below still rejects oversized payloads — Vercel also enforces a 4.5 MB
  // platform cap on all serverless function request bodies.
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
  const quota = checkAndConsume(ip, cost);
  if (!quota.allowed) {
    if (quota.reason === 'burst') {
      logSecurityEvent(ip, { event: 'quota.burst_blocked' });
    } else {
      logSecurityEvent(ip, { event: 'quota.daily_blocked', used: DAILY_LIMIT - quota.remaining, limit: DAILY_LIMIT });
    }
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
        logSecurityEvent(ip, { event: 'translate.invalid_type', mime: file.type });
        await writer.write(sseEvent({ step: 'error', message: 'Uploaded file is not an image.' }));
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        logSecurityEvent(ip, { event: 'translate.size_exceeded', bytes: file.size });
        await writer.write(sseEvent({ step: 'error', message: 'Image exceeds the 4 MB size limit.' }));
        return;
      }

      console.log(`[translate] start — size=${file.size} type=${file.type} mode=${mode}`);
      await writer.write(sseEvent({ step: 'rendering', mode }));

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

      console.log('[translate] calling renderPanel...');
      const RENDER_TIMEOUT_MS = 55 * 1000; // stay under the 60s maxDuration ceiling
      const variationBase64s = await Promise.race([
        renderPanel(pngBuffer, mode, abortController.signal),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Render timed out after 55 seconds.')), RENDER_TIMEOUT_MS)
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

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
