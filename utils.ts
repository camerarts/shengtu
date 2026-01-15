import { AspectRatio, ImageQuality, ModelProvider } from './types';

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

export function formatBytes(bytes: number, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

// 1. Generate: Returns Blob and dimensions
export async function generateImageBlob(
  apiKeys: { gemini: string; modelscope: string },
  provider: ModelProvider,
  prompt: string,
  negativePrompt: string | undefined,
  aspectRatio: AspectRatio,
  quality: ImageQuality,
  referenceImageBase64?: string | null
): Promise<{ blob: Blob; width: number; height: number }> {
  
  if (provider === ModelProvider.MODELSCOPE) {
    // ModelScope Path
    const { width, height } = getDimensions(aspectRatio, quality);
    const finalPrompt = negativePrompt ? `${prompt} --no ${negativePrompt}` : prompt; // Basic negative prompt handling via text

    const response = await fetch('/api/generate-modelscope', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-modelscope-key': apiKeys.modelscope },
        body: JSON.stringify({ prompt: finalPrompt, width, height }) // Pass dims for worker to echo back
    });

    if (!response.ok) {
        let msg = 'ModelScope Generation failed';
        try { const json = await response.json(); msg = json.error?.message || msg; } catch(e) {}
        throw new Error(msg);
    }

    const blob = await response.blob();
    const w = parseInt(response.headers.get('X-Image-Width') || width.toString());
    const h = parseInt(response.headers.get('X-Image-Height') || height.toString());
    return { blob, width: w, height: h };

  } else {
    // Gemini Path (Default)
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKeys.gemini },
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

    const blob = await response.blob();
    const w = parseInt(response.headers.get('X-Image-Width') || '0');
    const h = parseInt(response.headers.get('X-Image-Height') || '0');

    return { blob, width: w || 1024, height: h || 1024 };
  }
}

// 2. Upload: Sends Blob, returns URL
export async function uploadImageBlob(blob: Blob): Promise<string> {
  const response = await fetch('/api/upload-image', {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: blob
  });

  if (!response.ok) {
    let errorMessage = `Upload failed (${response.status})`;
    try {
        // Try to parse JSON error from Worker
        const errorData = await response.json();
        if (errorData.error && errorData.error.message) {
            errorMessage = errorData.error.message;
        }
    } catch (e) {
        // Fallback to text if JSON parse fails
        const text = await response.text();
        if (text) errorMessage = text;
    }
    throw new Error(errorMessage);
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

// 4. Split 9-Grid: Splits a blob into 9 object URLs
export async function splitImageToGrid(blob: Blob): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    
    img.onload = () => {
      const pieces: string[] = [];
      const cols = 3;
      const rows = 3;
      const pieceWidth = img.width / cols;
      const pieceHeight = img.height / rows;
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) { reject("Canvas error"); return; }
      
      canvas.width = pieceWidth;
      canvas.height = pieceHeight;

      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          // Clear previous
          ctx.clearRect(0, 0, pieceWidth, pieceHeight);
          // Draw sub-region
          ctx.drawImage(
            img,
            x * pieceWidth, y * pieceHeight, pieceWidth, pieceHeight, // Source
            0, 0, pieceWidth, pieceHeight // Dest
          );
          
          pieces.push(canvas.toDataURL('image/png'));
        }
      }
      
      URL.revokeObjectURL(url);
      resolve(pieces);
    };
    
    img.onerror = reject;
    img.src = url;
  });
}

// 5. Download helper
export function downloadBatch(images: string[], prefix = 'gemini-grid') {
  images.forEach((url, index) => {
    // Add slight delay to prevent browser blocking multiple popups
    setTimeout(() => {
      const link = document.createElement('a');
      link.href = url;
      link.download = `${prefix}-${index + 1}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, index * 200);
  });
}