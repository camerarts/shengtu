/**
 * Cloudflare Worker for Gemini 3 Pro Image Generation + R2 Upload
 */

interface R2Bucket {
  put(key: string, value: any, options?: any): Promise<any>;
}

interface Env {
  GEMINI_API_KEY: string;
  IMAGES_BUCKET: R2Bucket; // Binding name in Wrangler/Dashboard
  PUBLIC_BUCKET_URL: string; // The public domain for your R2 bucket (e.g., https://images.yourdomain.com)
}

// Resolution Logic based on Gemini 3 Pro specs
function getDimensions(aspectRatio: string, quality: string): { width: number; height: number } {
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

  const ratioData = map[aspectRatio];
  if (!ratioData) throw new Error("Invalid Aspect Ratio");
  const dim = ratioData[quality];
  if (!dim) throw new Error("Invalid Quality");
  return { width: dim.w, height: dim.h };
}

// Helper to convert Base64 to ArrayBuffer
function base64ToArrayBuffer(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export const onRequestPost = async (context: any) => {
  const { request, env } = context;

  // 1. CORS Headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-goog-api-key',
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Priority: Header Key (User provided) > Env Key (Server provided)
    const apiKey = request.headers.get("x-goog-api-key") || env.GEMINI_API_KEY;
    
    if (!apiKey) {
      throw new Error("缺少 API Key。请在设置中输入 Key 或配置服务器环境变量。");
    }

    // 2. Parse Body
    const body: any = await request.json();
    const { prompt, negativePrompt, aspectRatio, quality, referenceImageBase64 } = body;

    // 3. Input Validation
    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: { code: 'INVALID_INPUT', message: '提示词必填。' } }), { status: 400, headers: corsHeaders });
    }

    // 4. Calculate Dimensions (For response only)
    const { width, height } = getDimensions(aspectRatio, quality);

    // 5. Construct Gemini API Request
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`;
    
    const finalPrompt = negativePrompt ? `${prompt} --no ${negativePrompt}` : prompt;

    const parts: any[] = [{ text: finalPrompt }];
    if (referenceImageBase64) {
        const match = referenceImageBase64.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
        if (match) {
            parts.push({
                inlineData: { mimeType: match[1], data: match[2] }
            });
        }
    }

    const payload = {
      contents: [{ parts: parts }],
      generationConfig: {
        imageConfig: {
            aspectRatio: aspectRatio,
            imageSize: quality
        }
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
      ]
    };

    // 6. Call Google API
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        return new Response(JSON.stringify({ 
            error: { code: 'API_ERROR', message: `Gemini API Error: ${response.status}`, details: errorText } 
        }), { status: response.status, headers: corsHeaders });
    }

    // 7. Process Response
    const data: any = await response.json();
    const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    
    if (!part || !part.inlineData || !part.inlineData.data) {
         return new Response(JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'API 返回了意外的格式（无图像数据）。' } }), { status: 500, headers: corsHeaders });
    }

    const base64Image = part.inlineData.data;

    // 8. Upload to R2 (If Configured)
    let imageUrl = null;
    if (env.IMAGES_BUCKET && env.PUBLIC_BUCKET_URL) {
        try {
            const buffer = base64ToArrayBuffer(base64Image);
            const filename = `gemini-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;
            
            await env.IMAGES_BUCKET.put(filename, buffer, {
                httpMetadata: {
                    contentType: 'image/png',
                    cacheControl: 'public, max-age=31536000'
                }
            });

            // Remove trailing slash if present
            const baseUrl = env.PUBLIC_BUCKET_URL.replace(/\/$/, "");
            imageUrl = `${baseUrl}/${filename}`;
        } catch (r2Error: any) {
            console.error("R2 Upload Failed:", r2Error);
            // We don't fail the request if upload fails, we will fall back to returning base64 below
        }
    }

    // 9. Return Success
    // PERFORMANCE FIX: If we have an R2 URL, DO NOT send the base64 string back.
    // A 4K base64 string is ~20MB+. Sending it in JSON crashes the browser (OOM).
    const responsePayload: any = {
        contentType: "image/png",
        url: imageUrl,
        width,
        height
    };

    if (!imageUrl) {
        // Only return base64 if R2 upload failed or is not configured
        responsePayload.base64 = base64Image;
    }

    return new Response(JSON.stringify(responsePayload), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ 
        error: { code: 'INTERNAL_ERROR', message: err.message || '发生了意外的服务端错误。' } 
    }), { status: 500, headers: corsHeaders });
  }
};