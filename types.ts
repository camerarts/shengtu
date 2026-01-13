export enum AspectRatio {
  SQUARE = "1:1",
  PORTRAIT_3_4 = "3:4",
  LANDSCAPE_4_3 = "4:3",
  PORTRAIT_9_16 = "9:16",
  LANDSCAPE_16_9 = "16:9"
}

export enum ImageQuality {
  Q_1K = "1K",
  Q_2K = "2K",
  Q_4K = "4K"
}

export interface GenerateImageRequest {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: AspectRatio;
  quality: ImageQuality;
}

export interface GenerateImageResponse {
  width: number;
  height: number;
  // We handle the image data separately as a Blob now
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: AspectRatio;
  quality: ImageQuality;
  thumbnailBase64: string; // We ALWAYS store a small resized thumbnail for history list
  imageUrl?: string;       // The R2 URL (if uploaded)
  width: number;
  height: number;
}