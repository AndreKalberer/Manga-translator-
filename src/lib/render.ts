import { toFile } from 'openai';
import { getOpenAIClient } from './openai';
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

export async function renderPanel(
  pngBuffer: Buffer,
  mode: Mode,
  signal?: AbortSignal
): Promise<string[]> {
  const client = getOpenAIClient();
  const model = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2';

  const imageFile = await toFile(pngBuffer, 'panel.png', { type: 'image/png' });

  const response = await withRetry(() =>
    client.images.edit(
      {
        model,
        image: imageFile,
        prompt: PROMPTS[mode],
        n: 3,
      },
      { signal }
    )
  );

  const items = response.data ?? [];
  return items.map((item) => {
    if (!item.b64_json) throw new Error('Image generation returned no data');
    return item.b64_json;
  });
}
