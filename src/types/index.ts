export type Mode = 'translate' | 'color' | 'both';

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
  status: 'pending' | 'rendering' | 'done' | 'error';
  mode: Mode;
  errorMessage?: string;
}

export interface QuotaInfo {
  remaining: number;
  limit: number;
  resetAt: string; // ISO timestamp
}
