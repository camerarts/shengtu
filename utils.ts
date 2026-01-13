import { AspectRatio, ImageQuality } from './types';

// Resolution Logic (For UI display only)
// Based on Gemini 3 Pro documentation approximation
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

  const ratioData = map[aspectRatio] || map["1:1"]; // Fallback to square if legacy ratio found
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

  // CORRECT PAYLOAD STRUCTURE FOR GEMINI 3 PRO IMAGE
  // 1. safetySettings is at the root level.
  // 2. config uses `imageConfig` with `aspectRatio` and `imageSize`.
  // 3. `mediaResolution` is REMOVED.
  // 4. `responseMimeType` is REMOVED for image generation.
  
  const payload = {
    contents: [{
      parts: parts
    }],
    generationConfig: {
      imageConfig: {
        aspectRatio: aspectRatio, // strictly "1:1", "3:4", "4:3", "9:16", "16:9"
        imageSize: quality        // strictly "1K", "2K", "4K"
      }
    },
    safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = '生成图片失败。';
      
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error && errorJson.error.message) {
            errorMessage = `API 错误: ${errorJson.error.message}`;
        }
      } catch (e) { /* ignore json parse error */ }

      if (response.status === 429) {
          errorMessage = 'API 请求过于频繁，请稍后再试。';
      } else if (response.status === 403) {
          errorMessage = 'API Key 无效或没有权限访问该模型。';
      } else if (response.status === 400) {
          errorMessage += ' (请求参数错误)';
      } else if (response.status === 413) {
          errorMessage = '上传的参考图片太大。';
      }

      throw new Error(errorMessage);
  }

  const data: any = await response.json();
  
  // Image parts might be mixed with text parts, find the inlineData
  // Gemini 3 Pro returns image in `inlineData`
  const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
  
  if (!part || !part.inlineData || !part.inlineData.data) {
       console.error("Full Response:", data);
       throw new Error('生成成功，但返回数据中未找到图片数据。');
  }

  return {
    contentType: "image/png",
    base64: part.inlineData.data,
    width,
    height
  };
}