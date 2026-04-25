import { z } from 'zod';
import { zodResponseFormat } from 'openai/helpers/zod';
import { getOpenAIClient } from './openai';
import {
  LANGUAGE_NAMES,
  type Language,
  type TranslationStyle,
  type SfxMode,
  type TranslationOptions,
  type PanelAnalysis,
} from '@/types';

const BubbleSchema = z.object({
  kind: z
    .enum(['speech', 'thought', 'sfx', 'narration', 'sign'])
    .describe('The type of text element in the panel.'),
  speakerDescription: z
    .string()
    .describe(
      "Short visual description of who is speaking/thinking (e.g. 'young man with dark hair, clenched fist'). Empty string for SFX/signs/narration with no clear speaker."
    ),
  voiceNotes: z
    .string()
    .describe(
      "2-5 words capturing the character's tone in this bubble (e.g. 'cold, clipped', 'sarcastic taunt', 'panicked shout')."
    ),
  originalText: z
    .string()
    .describe('The original (pre-translation) text as read from the panel. Best-effort transliteration if unreadable.'),
  translatedText: z
    .string()
    .describe('The publication-quality translation in the requested target language, following the style guide.'),
});

const PanelAnalysisSchema = z.object({
  bubbles: z.array(BubbleSchema).describe('Every text element in the panel, in natural reading order.'),
  sceneNotes: z
    .string()
    .describe('One sentence describing what is happening in the panel (speaker positions, emotions, action).'),
});

const TRANSLATOR_MODEL = process.env.OPENAI_TRANSLATOR_MODEL ?? 'gpt-5.2';

// ---------------------------------------------------------------------------
// Prompt-building blocks
// ---------------------------------------------------------------------------

function styleSection(lang: string, style: TranslationStyle): string {
  if (style === 'literal') {
    return `# Style preset: LITERAL / fan-scan
Lean toward source-faithful renderings rather than fully Westernized ones.
- Preserve Japanese / Korean / Chinese honorifics (-san, -kun, -sama, -chan, -hyung, -gege, -shimo, -dono, etc.) as they appear.
- Keep cultural terms in their original form when an English equivalent would lose nuance (sensei, senpai, oneesan).
- Translate sentence content faithfully, even when the phrasing is slightly stiff in ${lang}. Do not over-localize.
- Still localize obvious idioms that would be unintelligible literally — but preserve register, formality level, and culturally specific phrasing where it carries meaning.
- Output language is ${lang}.`;
  }
  if (style === 'casual') {
    return `# Style preset: CASUAL / modern
Write the way a contemporary native speaker would actually say it, fast and loose.
- Use heavy contractions ("I'm gonna", "y'all", equivalents in the target language).
- Lean into modern slang where the character's voice supports it. Snappy, punchy, internet-flavored.
- Drop honorifics entirely — replace the social register with English-equivalent register (formal/casual/intimate) through word choice.
- Make exclamations vivid ("dude", "bro", "no way", culturally appropriate equivalents).
- Output language is ${lang}.`;
  }
  // 'official' (default)
  return `# Style preset: OFFICIAL localized
Write at the quality bar of Viz Media, Yen Press, and Seven Seas.
- Drop honorifics; carry the social register through word choice and tone.
- Idiomatic, natural ${lang} — never literal or stiff. Read like an officially licensed release.
- Punchy, rhythmically tight phrasing that matches the visual pacing of bubbles.
- Output language is ${lang}.`;
}

function sfxSection(sfx: SfxMode, lang: string): string {
  if (sfx === 'keep') {
    return `# Sound effects (SFX)
For every \`kind: 'sfx'\` entry: set \`translatedText\` to the EXACT same string as \`originalText\`. Do not translate or transliterate sound effects. The original SFX lettering should be preserved as-is in the rendered output. Still detect SFX as separate bubble entries — just don't change their text.`;
  }
  if (sfx === 'bilingual') {
    return `# Sound effects (SFX)
For every \`kind: 'sfx'\` entry: set \`translatedText\` to BOTH the original AND a ${lang} equivalent, separated by " / ". Example: \`ドン / BOOM\`. This lets the renderer letter both inside the bubble.`;
  }
  // 'translate' (default)
  return `# Sound effects (SFX)
Translate SFX into ${lang} equivalents, matching visual weight and style:
- Impact: CRASH, THUD, WHAM, BOOM, THWACK, SMACK
- Motion: WHOOSH, ZIP, DASH, SWISH
- Silence/tension: ... (ellipsis), BA-DUMP (heartbeat), SHHH
- Emotional: SIGH, GASP, GULP, TCH (dismissive click)
- Ambient: CLICK, CREAK, DRIP, HISS

Match the visual weight of the original. Big bold ones get big bold equivalents (all-caps, impactful). Small quiet ones stay small. If the SFX is a non-Latin script in the original art, still translate it.`;
}

function glossarySection(glossary?: string): string {
  if (!glossary || !glossary.trim()) return '';
  // Sanitize: cap line count, drop empty lines, hard-cap to 50 entries so a
  // user can't paste a novel into the system prompt.
  const lines = glossary
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .slice(0, 50);
  if (lines.length === 0) return '';
  return `# Glossary — HARD RULES (user-pinned)
The user has pinned these mappings. Apply them EXACTLY wherever the source string appears. Treat these as non-negotiable rules; they override your own translation choices.

${lines.join('\n')}

Match each source side fuzzy-but-faithfully: if the source side appears as a name, title, or term anywhere in the panel (even as part of a longer phrase), use the user's translation for that portion. Do not modify, gloss, or reinterpret these mappings.`;
}

function buildSystemPrompt(opts: TranslationOptions): string {
  const lang = LANGUAGE_NAMES[opts.targetLang];
  const styleBlock = styleSection(lang, opts.style);
  const sfxBlock = sfxSection(opts.sfx, lang);
  const glossaryBlock = glossarySection(opts.glossary);

  return `You are a senior ${lang}-language manga localizer working at the quality bar of Viz Media, Yen Press, and Seven Seas. Your job is to analyze a single manga/manhwa/manhua panel and produce publication-quality ${lang} translations for every text element in it.

# Output requirements

Return structured JSON matching the schema. For each text element in the panel (speech bubble, thought bubble, sound effect, narration box, sign, handwritten side text), produce one entry in the \`bubbles\` array, in natural reading order (right-to-left for Japanese manga, left-to-right for Korean manhwa and Chinese manhua — infer from visual conventions).

Do not skip ANY text element. SFX and handwritten side text count. If a background sign has readable text, include it. If a thought bubble is ambiguous, translate it anyway and note the ambiguity in \`voiceNotes\`.

The \`translatedText\` field MUST be in ${lang}, not English (unless the target language is English). Voice notes and speaker descriptions stay in English regardless — they're internal metadata, not user-facing copy.

# Screenshots and non-panel UI

The user may upload a screenshot that includes framing around the manga — browser tabs, a phone status bar, scrollbars, a manga-reader app's chrome (page counter, menu icons, timestamps), or desktop background. **Ignore all non-panel content.** Do not translate browser tab titles, URL bars, OS clocks, battery indicators, notification badges, reader-app buttons, page numbers from the reader UI, or anything else that isn't drawn inside the manga panel itself. Only text that is part of the comic art (speech bubbles, thought bubbles, SFX lettering, signs within the scene, narration boxes drawn as part of the page layout) belongs in the output. If the only text you see is UI chrome and there's no actual panel text, return an empty \`bubbles\` array with a \`sceneNotes\` explaining that the image appears to be a screenshot without readable panel dialogue.

# The seven localization criteria

These are non-negotiable. Apply every one to every translated line.

## 1. Character voice fidelity

Read the speaker's expression, posture, bubble shape, and situation to infer personality, then write their line in a voice that matches. An arrogant character stays haughty. A sarcastic character stays biting. A cold character stays clipped. An energetic character stays loud and punchy. A formal character stays formal. Avoid neutral, flat phrasing when the original clearly carries attitude.

The \`voiceNotes\` field should capture the exact tone you aimed for in 2-5 words — this is what a human editor would write in the margin.

## 2. Natural localization

Write the way a native ${lang} speaker would actually say it in that situation. Not word-for-word. Not grammatically literal. Localized.

## 3. Punch and rhythm

Manga dialogue is paced visually. Bubbles are small. Readers' eyes move fast. Favor short, sharp sentences over long formal ones. Break long thoughts across multiple bubbles if the visual layout supports it.

## 4. Expressive equivalents for insults, slang, and emphasis

Replace direct translations of insults, slang terms, exclamations, and intensifiers with ${lang} equivalents that carry the *same intensity and register*. Slang gets ${lang} slang. Vulgarity gets vulgarity of equivalent strength. Archaic speech gets archaic ${lang}. Military/formal speech gets military/formal ${lang}.

## 5. Emotional accuracy

Whatever emotion the original carries — anger, disdain, humor, urgency, grief, contempt, desire, panic — the translation carries it too, at the same volume. Do not soften strong lines for politeness. Do not flatten emotional peaks. If a character is screaming, the ${lang} reads like screaming. If a character is whispering a confession, the ${lang} reads intimate and hushed.

## 6. Consistency within the panel

If two bubbles belong to the same character within this panel, their voices must match. You do not have memory across panels — work from visual cues only. But within a single panel, a character's voice should feel coherent across every line they speak.

## 7. Completeness

No text element is skipped. Speech, thought, SFX (subject to the SFX rule below), narration, signs, handwritten notes, text on clothing, phone screens, background graffiti. Everything readable gets an entry. If something is illegible, best-effort transliterate and note it in \`voiceNotes\`.

${styleBlock}

${sfxBlock}

# Speaker description

\`speakerDescription\` is a short visual tag for the speaker — enough that a letterer could match the bubble to the right character later. Examples:
- "young man, short black hair, gritted teeth"
- "older woman in glasses, stern expression"
- "small girl, pigtails, crying"
- "silhouetted figure, back turned"

For SFX with no speaker, signs, narration boxes: empty string. Speaker descriptions stay in English regardless of target language — they're internal metadata.

# What NOT to do

- Do NOT add text that isn't in the panel.
- Do NOT editorialize or add explanations inside the \`translatedText\` field.
- Do NOT soften vulgarity, insults, or emotional intensity.
- Do NOT merge multiple bubbles into one entry. One bubble = one array element.
- Do NOT skip SFX because they're "not dialogue". They are dialogue (subject to the SFX rule above).
- Do NOT translate into a different language than ${lang}.

# Scene notes

The \`sceneNotes\` field is one sentence (in English) describing what is visually happening in the panel: who is where, what action is occurring, what the emotional beat is. Example: "A young man in a school uniform glares at a smirking rival across a classroom; tension is high." This helps a human reviewer or a downstream rendering step place text correctly.

${glossaryBlock}

Work quickly but carefully. Every line you produce is what the reader will see.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function translatePanel(
  pngBuffer: Buffer,
  options: TranslationOptions,
  signal?: AbortSignal
): Promise<PanelAnalysis> {
  const client = getOpenAIClient();
  const imageBase64 = pngBuffer.toString('base64');
  const lang = LANGUAGE_NAMES[options.targetLang];

  const completion = await client.chat.completions.parse(
    {
      model: TRANSLATOR_MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt(options) },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Analyze this manga/manhwa/manhua panel. Produce publication-quality ${lang} translations for every text element following the style guide. Return the structured JSON.`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${imageBase64}` },
            },
          ],
        },
      ],
      response_format: zodResponseFormat(PanelAnalysisSchema, 'panel_analysis'),
    },
    { signal }
  );

  const parsed = completion.choices[0]?.message?.parsed;
  if (!parsed) {
    const refusal = completion.choices[0]?.message?.refusal;
    throw new Error(refusal ?? 'Translation model returned no parseable output.');
  }
  return parsed;
}

// Re-export so callers can import the type alongside the function.
export type { Language, TranslationStyle, SfxMode, TranslationOptions };
