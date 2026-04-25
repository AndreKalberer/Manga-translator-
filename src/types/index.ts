export type Mode = 'translate' | 'color' | 'both';

export type Language =
  | 'en' | 'es' | 'pt' | 'fr' | 'de' | 'it'
  | 'id' | 'vi' | 'th' | 'ru';

export const LANGUAGE_NAMES: Record<Language, string> = {
  en: 'English',
  es: 'Spanish',
  pt: 'Portuguese',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  id: 'Indonesian',
  vi: 'Vietnamese',
  th: 'Thai',
  ru: 'Russian',
};

export const LANGUAGE_NATIVE: Record<Language, string> = {
  en: 'English',
  es: 'Español',
  pt: 'Português',
  fr: 'Français',
  de: 'Deutsch',
  it: 'Italiano',
  id: 'Bahasa Indonesia',
  vi: 'Tiếng Việt',
  th: 'ไทย',
  ru: 'Русский',
};

export type TranslationStyle = 'official' | 'literal' | 'casual';

export type SfxMode = 'translate' | 'keep' | 'bilingual';

export interface TranslationOptions {
  targetLang: Language;
  style: TranslationStyle;
  sfx: SfxMode;
  glossary?: string;
}

export type BubbleKind = 'speech' | 'thought' | 'sfx' | 'narration' | 'sign';

export interface BubbleTranslation {
  kind: BubbleKind;
  speakerDescription: string;
  voiceNotes: string;
  originalText: string;
  translatedText: string;
}

export interface PanelAnalysis {
  bubbles: BubbleTranslation[];
  sceneNotes: string;
}

export interface ImageVariation {
  index: number;
  dataUrl: string;
}

export interface ProcessedImage {
  imageId: string;
  originalFileName: string;
  originalDataUrl: string;
  variations: ImageVariation[];
  selectedIndex: number;
  status: 'pending' | 'analyzing' | 'rendering' | 'done' | 'error';
  mode: Mode;
  analysis?: PanelAnalysis;
  errorMessage?: string;
}

export interface QuotaInfo {
  remaining: number;
  limit: number;
  resetAt: string;
}
