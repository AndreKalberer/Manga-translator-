import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { renderTranslatedVariations } from '@/lib/render';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB
const MAX_WIDTH = 1500; // Keeps PNG under the 4 MB API limit after conversion

function sseEvent(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

export async function POST(request: NextRequest) {
  // Gate: require API key before doing anything
  if (!process.env.OPENAI_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'OPENAI_API_KEY is not configured on the server.' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
  const writer = writable.getWriter();

  // Run the pipeline asynchronously so we can return the stream immediately
  (async () => {
    try {
      const formData = await request.formData();
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
        await writer.write(
          sseEvent({ step: 'error', message: 'Image exceeds the 20 MB size limit.' })
        );
        return;
      }

      await writer.write(sseEvent({ step: 'rendering' }));

      // Convert to PNG and resize so it fits under the API's 4 MB input limit
      const arrayBuffer = await file.arrayBuffer();
      const pngBuffer = await sharp(Buffer.from(arrayBuffer))
        .resize({ width: MAX_WIDTH, withoutEnlargement: true })
        .png()
        .toBuffer();

      const originalBase64 = pngBuffer.toString('base64');
      const originalDataUrl = `data:image/png;base64,${originalBase64}`;

      const variationBase64s = await renderTranslatedVariations(pngBuffer);

      const variations = variationBase64s.map((b64, index) => ({
        index,
        dataUrl: `data:image/png;base64,${b64}`,
      }));

      await writer.write(
        sseEvent({
          step: 'done',
          imageId: crypto.randomUUID(),
          originalFileName: file.name,
          originalDataUrl,
          variations,
        })
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
      await writer.write(sseEvent({ step: 'error', message }));
    } finally {
      await writer.close();
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
