import { Modality } from '@google/genai';
import { getGeminiClient } from './gemini';
import { withRetry } from './utils';
import type { Mode } from '@/types';

const PROMPTS: Record<Mode, string> = {
  translate:
    'Generate an edited version of this manga panel image. Replace all Japanese, Korean, or Chinese text in speech bubbles, thought bubbles, and sound effects with natural English translations. Keep the art, bubble shapes, character designs, and panel layout pixel-identical — only the text inside the bubbles changes. Use lettering consistent with manga and comic book conventions. Output the edited image.',
  color:
    'Generate a fully colorized version of this black-and-white manga panel image. Add vibrant, natural anime-style colors to skin tones, hair, clothing, eyes, and backgrounds. Preserve all line art, speech bubbles, panel composition, and existing text exactly — do not change, translate, or remove any text. Output the colorized image.',
  both:
    'Generate an edited version of this manga panel image with two changes: (1) colorize it with vibrant, natural anime-style colors on all art elements (skin tones, hair, clothing, eyes, backgrounds), and (2) replace all non-English text in speech bubbles, thought bubbles, and sound effects with natural English translations inside the original bubbles. Preserve panel composition, bubble shapes, and character designs. Output the edited image.',
};

const MODEL = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3.1-flash-image-preview';

type CallResult = { image: string } | { noImageError: string };

async function callGemini(base64: string, prompt: string): Promise<CallResult> {
  const ai = getGeminiClient();

  console.log(`[render] calling generateContent — model=${MODEL}`);
  const response = await withRetry(() =>
    ai.models.generateContent({
      model: MODEL,
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'image/png', data: base64 } },
            { text: prompt },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.TEXT, Modality.IMAGE],
      },
    })
  );

  const debugShape = {
    promptFeedback: response.promptFeedback,
    candidateCount: response.candidates?.length ?? 0,
    candidates: response.candidates?.map((c) => ({
      finishReason: c.finishReason,
      partCount: c.content?.parts?.length ?? 0,
      parts: c.content?.parts?.map((p) => ({
        hasText: !!p.text,
        textSnippet: p.text?.slice(0, 80),
        hasInlineData: !!p.inlineData,
        mimeType: p.inlineData?.mimeType ?? null,
        dataLength: p.inlineData?.data?.length ?? 0,
      })),
    })),
  };
  console.log('[render] Gemini response shape:', JSON.stringify(debugShape));

  const feedback = response.promptFeedback;
  if (feedback?.blockReason) {
    throw new Error(`Image blocked by safety filter: ${feedback.blockReason}`);
  }

  const candidate = response.candidates?.[0];
  if (!candidate || candidate.finishReason === 'SAFETY') {
    throw new Error('Image was blocked by Gemini safety filters.');
  }

  const parts = candidate.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) return { image: part.inlineData.data };
  }
  return {
    noImageError:
      `Gemini returned no image. finishReason=${candidate.finishReason ?? 'none'} parts=${parts.length} ` +
      `partTypes=${parts.map((p) => (p.inlineData ? `inlineData(${p.inlineData.mimeType})` : 'text')).join(',')}`,
  };
}

async function generateVariation(base64: string, prompt: string): Promise<string> {
  const first = await callGemini(base64, prompt);
  if ('image' in first) return first.image;

  // Gemini occasionally responds with a text description instead of an image.
  // Retry once with an explicit instruction before giving up.
  console.log('[render] no image on first attempt, retrying with stronger prompt');
  const stronger = `IMPORTANT: Respond with an image, not a text description. ${prompt}`;
  const second = await callGemini(base64, stronger);
  if ('image' in second) return second.image;

  throw new Error(second.noImageError);
}

export async function renderPanel(
  pngBuffer: Buffer,
  mode: Mode,
  signal?: AbortSignal
): Promise<string[]> {
  const base64 = pngBuffer.toString('base64');
  const prompt = PROMPTS[mode];

  // Sequential rather than parallel — avoids bursting the Gemini rate limit
  const results: string[] = [];
  for (let i = 0; i < 3; i++) {
    if (signal?.aborted) break;
    console.log(`[render] variation ${i + 1}/3`);
    results.push(await generateVariation(base64, prompt));
  }
  return results;
}
