import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { renderPanel } from '@/lib/render';
import { checkAndConsume, DAILY_LIMIT } from '@/lib/quota';
import type { Mode } from '@/types';

const MAX_FILE_SIZE = 20 * 1024 * 1024;
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
    const status = (err as { status?: number }).status;
    if (status === 429) return 'The translation service is busy. Please try again in a moment.';
    if (status === 400) return 'The image could not be processed. Please try a different file.';
    if (status === 413) return 'Image is too large for the translation service.';
    if (status && status >= 500) return 'The translation service is temporarily unavailable.';
  }
  return 'Processing failed. Please try again.';
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
  if (!process.env.GEMINI_API_KEY) {
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
  const quota = checkAndConsume(ip, cost);
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
        await writer.write(sseEvent({ step: 'error', message: 'Image exceeds the 20 MB size limit.' }));
        return;
      }

      await writer.write(sseEvent({ step: 'rendering', mode }));

      // Convert to PNG (sharp also validates the image — rejects non-images)
      const arrayBuffer = await file.arrayBuffer();
      const pngBuffer = await sharp(Buffer.from(arrayBuffer))
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .png()
        .toBuffer();

      if (abortController.signal.aborted) return;

      const originalBase64 = pngBuffer.toString('base64');
      const originalDataUrl = `data:image/png;base64,${originalBase64}`;

      const RENDER_TIMEOUT_MS = 3 * 60 * 1000; // 3 minutes
      const variationBase64s = await Promise.race([
        renderPanel(pngBuffer, mode, abortController.signal),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Render timed out after 3 minutes.')), RENDER_TIMEOUT_MS)
        ),
      ]);

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
      if (abortController.signal.aborted) return;
      await writer.write(sseEvent({ step: 'error', message: safeErrorMessage(err) }));
    } finally {
      try { await writer.close(); } catch { /* already closed */ }
    }
  })();

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
