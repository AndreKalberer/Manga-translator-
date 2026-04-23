import { NextRequest } from 'next/server';
import OpenAI, { toFile } from 'openai';

// Tiny 1x1 white PNG — used to test image-in / image-out without a real upload
const DUMMY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQ' +
  'AABjkB6QAAAABJRU5ErkJggg==';

export async function GET(_request: NextRequest) {
  const results: Record<string, unknown> = {};

  const apiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const modelEnv = process.env.OPENAI_IMAGE_MODEL;
  const model = modelEnv ?? 'gpt-image-2-2026-04-21';
  results.env = {
    OPENAI_API_KEY: apiKey ? `set (${apiKey.slice(0, 8)}...)` : 'MISSING',
    ANTHROPIC_API_KEY: anthropicKey ? `set (${anthropicKey.slice(0, 11)}...)` : 'MISSING',
    OPENAI_IMAGE_MODEL: modelEnv ?? '(not set — using fallback)',
    effectiveModel: model,
  };

  if (!apiKey) {
    return Response.json({ ...results, error: 'OPENAI_API_KEY is not set in Vercel env vars' }, { status: 500 });
  }
  if (!anthropicKey) {
    return Response.json({ ...results, error: 'ANTHROPIC_API_KEY is not set in Vercel env vars' }, { status: 500 });
  }

  const client = new OpenAI({ apiKey });

  // Models list ping — verifies the key works and surfaces whether the image model is accessible
  try {
    const models = await client.models.list();
    const names = models.data.map((m) => m.id);
    results.modelsPing = {
      ok: true,
      count: names.length,
      imageModelVisible: names.includes(model),
      sampleIds: names.slice(0, 8),
    };
  } catch (err) {
    results.modelsPing = {
      ok: false,
      error: (err as Error).message,
      status: (err as { status?: number }).status,
    };
  }

  // Image edit test — sends a dummy PNG and asks for an edited image back
  try {
    const buffer = Buffer.from(DUMMY_PNG_B64, 'base64');
    const imageFile = await toFile(buffer, 'dummy.png', { type: 'image/png' });
    const response = await client.images.edit({
      model,
      image: imageFile,
      prompt: 'Return this image with a red border added around it.',
      n: 1,
    });
    const items = response.data ?? [];
    results.imageEditTest = {
      ok: true,
      count: items.length,
      gotImage: items.some((d) => !!d.b64_json),
      firstDataLength: items[0]?.b64_json?.length ?? 0,
    };
  } catch (err) {
    results.imageEditTest = {
      ok: false,
      error: (err as Error).message,
      status: (err as { status?: number }).status,
    };
  }

  return Response.json(results, { status: 200 });
}
