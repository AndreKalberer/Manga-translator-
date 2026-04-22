export type Mode = 'translate' | 'color' | 'both';

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
