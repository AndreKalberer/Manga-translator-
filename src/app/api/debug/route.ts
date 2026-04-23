import { NextRequest } from 'next/server';
import { GoogleGenAI, Modality } from '@google/genai';
import { logSecurityEvent } from '@/lib/log';

// Tiny 1x1 white PNG — used to test image-in / image-out without a real upload
const DUMMY_PNG_B64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQ' +
  'AABjkB6QAAAABJRU5ErkJggg==';

export async function GET(request: NextRequest) {
  // Require a secret token — if DEBUG_TOKEN is not set the endpoint is disabled
  const debugToken = process.env.DEBUG_TOKEN;
  if (!debugToken) {
    return Response.json({ error: 'Debug endpoint is disabled.' }, { status: 403 });
  }
  const authHeader = request.headers.get('authorization') ?? '';
  if (authHeader !== `Bearer ${debugToken}`) {
    const ip =
      request.headers.get('x-vercel-forwarded-for') ??
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
      'unknown';
    logSecurityEvent(ip, { event: 'debug.unauthorized' });
    return Response.json({ error: 'Forbidden.' }, { status: 403 });
  }

  const results: Record<string, unknown> = {};

  // 1. Check env vars
  const apiKey = process.env.GEMINI_API_KEY;
  const modelEnv = process.env.GEMINI_IMAGE_MODEL;
  results.env = {
    GEMINI_API_KEY: apiKey ? 'set' : 'MISSING',
    GEMINI_IMAGE_MODEL: modelEnv ?? '(not set — using fallback)',
    effectiveModel: modelEnv ?? 'gemini-3.1-flash-image-preview',
  };

  if (!apiKey) {
    return Response.json({ ...results, error: 'GEMINI_API_KEY is not set in Vercel env vars' }, { status: 500 });
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = modelEnv ?? 'gemini-3.1-flash-image-preview';

  // 2. Text-only ping — verifies the key and model name are valid
  try {
    const textResponse = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: 'Reply with just the word OK.' }] }],
    });
    results.textPing = {
      ok: true,
      finishReason: textResponse.candidates?.[0]?.finishReason,
      text: textResponse.candidates?.[0]?.content?.parts?.[0]?.text?.slice(0, 100),
    };
  } catch (err) {
    results.textPing = {
      ok: false,
      error: (err as Error).message,
      status: (err as { status?: number }).status,
    };
  }

  // 3. Image generation test — asks for image output with no input image
  try {
    const imgResponse = await ai.models.generateContent({
      model,
      contents: [{ role: 'user', parts: [{ text: 'Generate a small image of a red circle on a white background.' }] }],
      config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
    });
    const candidate = imgResponse.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    results.imageGenTest = {
      ok: true,
      finishReason: candidate?.finishReason,
      partCount: parts.length,
      partTypes: parts.map((p) => (p.inlineData ? `image(${p.inlineData.mimeType})` : 'text')),
      gotImage: parts.some((p) => !!p.inlineData?.data),
      textSnippet: parts.find((p) => p.text)?.text?.slice(0, 200),
      promptFeedback: imgResponse.promptFeedback,
    };
  } catch (err) {
    results.imageGenTest = {
      ok: false,
      error: (err as Error).message,
      status: (err as { status?: number }).status,
    };
  }

  // 4. Image-to-image test — sends a dummy image and asks for an edited image back
  try {
    const editResponse = await ai.models.generateContent({
      model,
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/png', data: DUMMY_PNG_B64 } },
          { text: 'Return this image with a red border added around it.' },
        ],
      }],
      config: { responseModalities: [Modality.TEXT, Modality.IMAGE] },
    });
    const candidate = editResponse.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    results.imageEditTest = {
      ok: true,
      finishReason: candidate?.finishReason,
      partCount: parts.length,
      partTypes: parts.map((p) => (p.inlineData ? `image(${p.inlineData.mimeType})` : 'text')),
      gotImage: parts.some((p) => !!p.inlineData?.data),
      textSnippet: parts.find((p) => p.text)?.text?.slice(0, 200),
      promptFeedback: editResponse.promptFeedback,
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
