import { AspectRatio, ImageQuality } from './types';

// Resolution Logic (Migrated from Worker)
// Base dimensions for 1K (long edge ~1024), 2K (~2048), 4K (~4096)
// Short edge calculated by ratio, rounded to nearest 8
export function getDimensions(aspectRatio: AspectRatio, quality: ImageQuality): { width: number; height: number } {
  const map: Record<string, Record<string, { w: number; h: number }>> = {
    "1:1": {
      "1K": { w: 1024, h: 1024 }, "2K": { w: 2048, h: 2048 }, "4K": { w: 4096, h: 4096 }
    },
    "2:3": {
      "1K": { w: 680, h: 1024 }, "2K": { w: 1368, h: 2048 }, "4K": { w: 2728, h: 4096 }
    },
    "3:2": {
      "1K": { w: 1024, h: 680 }, "2K": { w: 2048, h: 1368 }, "4K": { w: 4096, h: 2728 }
    },
    "3:4": {
      "1K": { w: 768, h: 1024 }, "2K": { w: 1536, h: 2048 }, "4K": { w: 3072, h: 4096 }
    },
    "4:3": {
      "1K": { w: 1024, h: 768 }, "2K": { w: 2048, h: 1536 }, "4K": { w: 4096, h: 3072 }
    },
    "4:5": {
      "1K": { w: 816, h: 1024 }, "2K": { w: 1640, h: 2048 }, "4K": { w: 3280, h: 4096 }
    },
    "5:4": {
      "1K": { w: 1024, h: 816 }, "2K": { w: 2048, h: 1640 }, "4K": { w: 4096, h: 3280 }
    },
    "9:16": {
      "1K": { w: 576, h: 1024 }, "2K": { w: 1152, h: 2048 }, "4K": { w: 2304, h: 4096 }
    },
    "16:9": {
      "1K": { w: 1024, h: 576 }, "2K": { w: 2048, h: 1152 }, "4K": { w: 4096, h: 2304 }
    },
    "21:9": {
      "1K": { w: 1024, h: 440 }, "2K": { w: 2048, h: 880 }, "4K": { w: 4096, h: 1752 }
    }
  };

  const ratioData = map[aspectRatio];
  if (!ratioData) throw new Error("Invalid Aspect Ratio");
  const dim = ratioData[quality];
  if (!dim) throw new Error("Invalid Quality");
  return { width: dim.w, height: dim.h };
}

export async function generateImageDirectly(
  apiKey: string,
  prompt: string,
  negativePrompt: string | undefined,
  aspectRatio: AspectRatio,
  quality: ImageQuality,
  referenceImageBase64?: string | null
) {
  const { width, height } = getDimensions(aspectRatio, quality);
  
  // Model: gemini-3-pro-image-preview
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`;
  
  const finalPrompt = negativePrompt ? `${prompt} --no ${negativePrompt}` : prompt;

  // Construct parts: Text part is always present
  const parts: any[] = [{ text: finalPrompt }];

  // If reference image exists, add it to parts
  if (referenceImageBase64) {
    // Extract base64 data and mime type. 
    // Format usually: "data:image/jpeg;base64,....."
    const match = referenceImageBase64.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
    if (match) {
        parts.push({
            inlineData: {
                mimeType: match[1],
                data: match[2]
            }
        });
    }
  }

  const payload = {
    contents: [{
      parts: parts
    }],
    generationConfig: {
      responseMimeType: "image/png",
      mediaResolution: {
           width: width,
           height: height
      },
      safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
          { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
      ]
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = '生成图片失败。';
      
      if (response.status === 429) {
          errorMessage = 'API 请求过于频繁，请稍后再试。';
      } else if (response.status === 400 || response.status === 403) {
          errorMessage = 'API Key 无效，或提示词/参考图被拒绝。';
      } else if (response.status === 413) {
          errorMessage = '上传的参考图片太大。';
      }

      throw new Error(errorMessage + ` (${response.status}) Details: ${errorText}`);
  }

  const data: any = await response.json();
  const part = data.candidates?.[0]?.content?.parts?.[0];
  
  if (!part || !part.inlineData || !part.inlineData.data) {
       throw new Error('API 返回数据格式异常，未找到图片。');
  }

  return {
    contentType: "image/png",
    base64: part.inlineData.data,
    width,
    height
  };
}