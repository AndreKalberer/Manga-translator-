import { toFile } from 'openai';
import { getOpenAIClient } from './openai';
import { withRetry } from './utils';
import type { Mode, PanelAnalysis } from '@/types';

const BASE_PROMPTS: Record<Mode, string> = {
  translate:
    "This is a manga/manhwa/manhua panel. Translate every text element — speech bubbles, thought bubbles, sound effects, and side/margin text — into English that reads like an official localized release (Viz Media, Yen Press, Seven Seas). Write fluent, idiomatic English the way a native speaker would actually say it, not a literal word-for-word rendering. Match each character's voice from their expression, posture, and bubble style: arrogant stays haughty, sarcastic stays biting, cold stays clipped, energetic stays loud. Preserve the full emotional weight of the original — anger sharp, disdain cutting, humor landing, urgency tense. Use punchy, rhythmically tight lines; favor short sharp sentences over long formal ones. Replace insults, slang, and emphasis with English equivalents of the same intensity, not direct translations. Translate every SFX too. Do not skip or soften anything. Preserve the original art style, bubble shapes, character designs, and panel layout exactly — change only the text inside each bubble, using lettering consistent with published manga.",
  color:
    'Colorize this manga, manhwa, or manhua panel with vibrant, natural anime-style colors. Add rich, appropriate color to skin tones, hair, clothing, eyes, and backgrounds. Preserve all line art, speech bubbles, panel composition, and character designs exactly. Do not change, translate, or remove any text.',
  both:
    "Colorize this manga/manhwa/manhua panel with vibrant, natural anime-style colors AND translate every text element into English that reads like an official localized release (Viz Media, Yen Press, Seven Seas). Colorize: add rich, appropriate color to skin tones, hair, clothing, eyes, and backgrounds while preserving all line art, bubble shapes, and panel composition. Translate: write fluent, idiomatic English — not literal — matching each character's voice from their expression and bubble style (arrogant stays haughty, sarcastic stays biting, cold stays clipped, energetic stays loud). Preserve emotional weight (anger, disdain, humor, urgency); use English equivalents for insults, slang, and emphasis at the same intensity. Favor punchy, rhythmically tight lines over long formal sentences. Translate every speech bubble, thought bubble, SFX, and side text — do not skip or soften anything. Lettering consistent with published manga.",
};

const MODEL = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-1.5';

function buildPromptWithAnalysis(mode: Mode, analysis: PanelAnalysis): string {
  const base = BASE_PROMPTS[mode];
  const lines = analysis.bubbles.map((b, i) => {
    const speaker = b.speakerDescription ? ` (${b.speakerDescription}; ${b.voiceNotes})` : b.voiceNotes ? ` (${b.voiceNotes})` : '';
    return `${i + 1}. [${b.kind}]${speaker} — Original: "${b.originalText}" → English: "${b.translatedText}"`;
  });
  const scene = analysis.sceneNotes ? `Scene: ${analysis.sceneNotes}\n\n` : '';
  return `${base}

${scene}Use these exact English translations, matched to each corresponding bubble/text element in the panel. Render the English text verbatim in place of the original — do not rephrase, paraphrase, or abbreviate:

${lines.join('\n')}

Preserve every bubble, SFX, and side-text slot in its original position with its original shape. Place the English text inside the matching slot using lettering that matches published manga conventions.`;
}

export async function renderPanel(
  pngBuffer: Buffer,
  mode: Mode,
  analysis?: PanelAnalysis,
  signal?: AbortSignal
): Promise<string[]> {
  const client = getOpenAIClient();
  const imageFile = await toFile(pngBuffer, 'panel.png', { type: 'image/png' });

  const prompt =
    analysis && mode !== 'color'
      ? buildPromptWithAnalysis(mode, analysis)
      : BASE_PROMPTS[mode];

  const response = await withRetry(() =>
    client.images.edit(
      {
        model: MODEL,
        image: imageFile,
        prompt,
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
