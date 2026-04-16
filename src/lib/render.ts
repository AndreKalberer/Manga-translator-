import { Modality } from '@google/genai';
import { getGeminiClient } from './gemini';
import { withRetry } from './utils';
import type { Mode } from '@/types';

const PROMPTS: Record<Mode, string> = {
  translate:
    'This is a manga, manhwa, or manhua panel. Translate all speech bubble text, thought bubble text, and sound effects to natural English. Preserve the original art style, bubble shapes, character designs, and panel layout exactly — only change the text content inside the bubbles. Keep the lettering style consistent with manga/comic book conventions.',
  color:
    'Colorize this manga, manhwa, or manhua panel with vibrant, natural anime-style colors. Add rich, appropriate color to skin tones, hair, clothing, eyes, and backgrounds. Preserve all line art, speech bubbles, panel composition, and character designs exactly. Do not change, translate, or remove any text.',
  both:
    'Colorize this manga, manhwa, or manhua panel with vibrant, natural anime-style colors AND translate all speech bubble text, thought bubbles, and sound effects to natural English. Add rich color to all art elements (skin tones, hair, clothing, backgrounds) while replacing the original text with fluent English translations. Preserve panel composition and character designs.',
};

const MODEL = process.env.GEMINI_IMAGE_MODEL ?? 'gemini-3.1-flash-image-preview';

async function generateVariation(
  base64: string,
  prompt: string,
): Promise<string> {
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

  // Log the full response shape for debugging
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
    if (part.inlineData?.data) return part.inlineData.data;
  }
  throw new Error(
    `Gemini returned no image. finishReason=${candidate.finishReason ?? 'none'} parts=${parts.length} ` +
    `partTypes=${parts.map((p) => (p.inlineData ? `inlineData(${p.inlineData.mimeType})` : 'text')).join(',')}`
  );
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
