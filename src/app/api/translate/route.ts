import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { renderTranslatedVariations } from '@/lib/render';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_WIDTH = 1500; // Keeps PNG under the API's 4 MB input limit
const MAX_FILES_PER_REQUEST = 10;

// ---------------------------------------------------------------------------
// Simple in-memory rate limiter
// Keyed by IP. Allows MAX_REQUESTS per WINDOW_MS.
// Resets per rolling window — good enough for a serverless/edge environment.
// ---------------------------------------------------------------------------
const MAX_REQUESTS = 10;
const WINDOW_MS = 60 * 1000; // 1 minute

interface RateLimitEntry {
  count: number;
  windowStart: number;
}
const rateLimitMap = new Map<string, RateLimitEntry>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitMap.set(ip, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= MAX_REQUESTS) return true;
  entry.count += 1;
  return false;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sseEvent(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

/** Return a safe, generic message from an OpenAI (or other) error.
 *  Never forward raw err.message to the client — it can contain quota info,
 *  model names, internal URLs, or API key fragments. */
function safeErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    // OpenAI SDK errors have a .status property
    const status = (err as { status?: number }).status;
    if (status === 429) return 'The translation service is busy. Please try again in a moment.';
    if (status === 400) return 'The image could not be processed. Please try a different file.';
    if (status === 413) return 'Image is too large for the translation service.';
    if (status && status >= 500) return 'The translation service is temporarily unavailable.';
  }
  return 'Translation failed. Please try again.';
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------
export async function POST(request: NextRequest) {
  // -- API key guard --
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'Translation service is not configured.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // -- Rate limiting --
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    'unknown';

  if (isRateLimited(ip)) {
    return new Response(
      JSON.stringify({ error: 'Too many requests. Please wait a minute and try again.' }),
      { status: 429, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // -- Body size guard: reject oversized Content-Length before reading --
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE + 8192) {
    return new Response(
      JSON.stringify({ error: 'Request body too large.' }),
      { status: 413, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  // -- Abort signal: stop the OpenAI call if the client disconnects --
  const abortController = new AbortController();
  request.signal.addEventListener('abort', () => abortController.abort());

  (async () => {
    try {
      const formData = await request.formData();
      const file = formData.get('image');

      if (!(file instanceof File)) {
        await writer.write(sseEvent({ step: 'error', message: 'No image file provided.' }));
        return;
      }

      // Validate MIME type via the browser-reported field (basic guard)
      if (!file.type.startsWith('image/')) {
        await writer.write(sseEvent({ step: 'error', message: 'Uploaded file is not an image.' }));
        return;
      }

      if (file.size > MAX_FILE_SIZE) {
        await writer.write(
          sseEvent({ step: 'error', message: 'Image exceeds the 20 MB size limit.' })
        );
        return;
      }

      await writer.write(sseEvent({ step: 'rendering' }));

      // Convert to PNG and resize so it fits under the API's 4 MB input limit.
      // sharp also re-encodes the image, providing a second layer of MIME validation
      // (it will throw on non-image data regardless of the declared MIME type).
      const arrayBuffer = await file.arrayBuffer();
      const pngBuffer = await sharp(Buffer.from(arrayBuffer))
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .png()
        .toBuffer();

      if (abortController.signal.aborted) return;

      const originalBase64 = pngBuffer.toString('base64');
      const originalDataUrl = `data:image/png;base64,${originalBase64}`;

      const variationBase64s = await renderTranslatedVariations(
        pngBuffer,
        abortController.signal
      );

      if (abortController.signal.aborted) return;

      const variations = variationBase64s.map((b64, index) => ({
        index,
        dataUrl: `data:image/png;base64,${b64}`,
      }));

      // Sanitise the filename before reflecting it back to the client
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._\- ]/g, '_').slice(0, 200);

      await writer.write(
        sseEvent({
          step: 'done',
          imageId: crypto.randomUUID(),
          originalFileName: safeFileName,
          originalDataUrl,
          variations,
        })
      );
    } catch (err) {
      if (abortController.signal.aborted) return; // client left — don't write
      await writer.write(sseEvent({ step: 'error', message: safeErrorMessage(err) }));
    } finally {
      try {
        await writer.close();
      } catch {
        // writer may already be closed if client disconnected
      }
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

