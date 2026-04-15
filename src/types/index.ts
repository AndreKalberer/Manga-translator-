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
  errorMessage?: string;
}

export interface QuotaInfo {
  remaining: number;
  limit: number;
  resetAt: string; // ISO timestamp
}
