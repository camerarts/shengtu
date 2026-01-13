import { AspectRatio, ImageQuality } from './types';

export function getDimensions(aspectRatio: AspectRatio | string, quality: ImageQuality): { width: number; height: number } {
  // Used for UI display logic
  const map: Record<string, Record<string, { w: number; h: number }>> = {
    "1:1": { "1K": { w: 1024, h: 1024 }, "2K": { w: 2048, h: 2048 }, "4K": { w: 4096, h: 4096 } },
    "3:4": { "1K": { w: 768, h: 1024 }, "2K": { w: 1536, h: 2048 }, "4K": { w: 3072, h: 4096 } },
    "4:3": { "1K": { w: 1024, h: 768 }, "2K": { w: 2048, h: 1536 }, "4K": { w: 4096, h: 3072 } },
    "9:16": { "1K": { w: 576, h: 1024 }, "2K": { w: 1152, h: 2048 }, "4K": { w: 2304, h: 4096 } },
    "16:9": { "1K": { w: 1024, h: 576 }, "2K": { w: 2048, h: 1152 }, "4K": { w: 4096, h: 2304 } }
  };
  const d = map[aspectRatio]?.[quality] || map["1:1"]["1K"];
  return { width: d.w, height: d.h };
}

// 1. Generate: Returns Blob and dimensions
export async function generateImageBlob(
  apiKey: string,
  prompt: string,
  negativePrompt: string | undefined,
  aspectRatio: AspectRatio,
  quality: ImageQuality,
  referenceImageBase64?: string | null
): Promise<{ blob: Blob; width: number; height: number }> {
  
  const response = await fetch('/api/generate-image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({ prompt, negativePrompt, aspectRatio, quality, referenceImageBase64 })
  });

  if (!response.ok) {
    let msg = 'Generation failed';
    try {
      const json = await response.json();
      msg = json.error?.message || msg;
    } catch(e) {}
    throw new Error(msg);
  }

  // Read raw blob
  const blob = await response.blob();
  
  // Read dims from header
  const w = parseInt(response.headers.get('X-Image-Width') || '0');
  const h = parseInt(response.headers.get('X-Image-Height') || '0');

  return { blob, width: w || 1024, height: h || 1024 };
}

// 2. Upload: Sends Blob, returns URL
export async function uploadImageBlob(blob: Blob): Promise<string> {
  const response = await fetch('/api/upload-image', {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: blob
  });

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  const data = await response.json();
  return data.url;
}

// 3. Helper: Create tiny thumbnail for History (avoids LS quota limit)
export async function createThumbnail(blob: Blob, maxWidth = 100): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      const scale = maxWidth / img.width;
      const canvas = document.createElement('canvas');
      canvas.width = maxWidth;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.7)); // Low quality jpeg for icon
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}