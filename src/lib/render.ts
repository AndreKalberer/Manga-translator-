import { toFile } from 'openai';
import { getOpenAIClient } from './openai';
import { withRetry } from './utils';

const TRANSLATE_PROMPT =
  'This is a manga, manhwa, or manhua panel. Translate all speech bubble text, thought bubble text, and sound effects to natural English. Preserve the original art style, bubble shapes, character designs, and panel layout exactly — only change the text content inside the bubbles. Keep the lettering style consistent with manga/comic book conventions.';

export async function renderTranslatedVariations(
  pngBuffer: Buffer,
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
        prompt: TRANSLATE_PROMPT,
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
