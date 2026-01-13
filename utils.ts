import { AspectRatio, ImageQuality, GenerateImageResponse } from './types';

// Resolution Logic (For UI display only)
export function getDimensions(aspectRatio: AspectRatio | string, quality: ImageQuality): { width: number; height: number } {
  const map: Record<string, Record<string, { w: number; h: number }>> = {
    "1:1": {
      "1K": { w: 1024, h: 1024 }, "2K": { w: 2048, h: 2048 }, "4K": { w: 4096, h: 4096 }
    },
    "3:4": {
      "1K": { w: 768, h: 1024 }, "2K": { w: 1536, h: 2048 }, "4K": { w: 3072, h: 4096 }
    },
    "4:3": {
      "1K": { w: 1024, h: 768 }, "2K": { w: 2048, h: 1536 }, "4K": { w: 4096, h: 3072 }
    },
    "9:16": {
      "1K": { w: 576, h: 1024 }, "2K": { w: 1152, h: 2048 }, "4K": { w: 2304, h: 4096 }
    },
    "16:9": {
      "1K": { w: 1024, h: 576 }, "2K": { w: 2048, h: 1152 }, "4K": { w: 4096, h: 2304 }
    }
  };

  const ratioData = map[aspectRatio] || map["1:1"]; 
  const dim = ratioData[quality] || ratioData["1K"];
  return { width: dim.w, height: dim.h };
}

export async function generateImageDirectly(
  apiKey: string,
  prompt: string,
  negativePrompt: string | undefined,
  aspectRatio: AspectRatio,
  quality: ImageQuality,
  referenceImageBase64?: string | null
): Promise<GenerateImageResponse> {
  
  // We now call our own Cloudflare Worker endpoint instead of Google directly.
  // This allows the Worker to handle R2 uploads securely.
  // The API Key is passed via header.
  
  const url = '/api/generate-image';
  
  const payload = {
    prompt,
    negativePrompt,
    aspectRatio,
    quality,
    referenceImageBase64
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey 
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = '生成图片失败。';
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && errorJson.error.message) {
            errorMessage = errorJson.error.message;
        }
      } catch (e) { /* ignore */ }
      
      throw new Error(errorMessage);
  }

  const data = await response.json();
  return data as GenerateImageResponse;
}