export enum AspectRatio {
  SQUARE = "1:1",
  PORTRAIT_2_3 = "2:3",
  LANDSCAPE_3_2 = "3:2",
  PORTRAIT_3_4 = "3:4",
  LANDSCAPE_4_3 = "4:3",
  PORTRAIT_4_5 = "4:5",
  LANDSCAPE_5_4 = "5:4",
  PORTRAIT_9_16 = "9:16",
  LANDSCAPE_16_9 = "16:9",
  CINEMATIC_21_9 = "21:9"
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
  contentType: string;
  base64: string;
  width: number;
  height: number;
}

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
  }
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  prompt: string;
  negativePrompt?: string;
  aspectRatio: AspectRatio;
  quality: ImageQuality;
  thumbnailBase64: string; // Storing the full base64 as thumbnail for this demo
  referenceImageBase64?: string; // Optional reference image used for generation
  width: number;
  height: number;
}