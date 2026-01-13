/**
 * Cloudflare Worker for Gemini 3 Pro Image Generation
 */

interface Env {
  GEMINI_API_KEY: string;
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
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    
    if (!env.GEMINI_API_KEY) {
      throw new Error("服务器配置错误：缺少 API Key。");
    }

    // 2. Parse Body
    const body: any = await request.json();
    const { prompt, negativePrompt, aspectRatio, quality } = body;

    // 3. Input Validation
    if (!prompt || typeof prompt !== 'string' || prompt.length > 2000) {
      return new Response(JSON.stringify({ error: { code: 'INVALID_INPUT', message: '提示词必填且不能超过 2000 字符。' } }), { status: 400, headers: corsHeaders });
    }

    const validRatios = ["1:1", "3:4", "4:3", "9:16", "16:9"];
    if (!validRatios.includes(aspectRatio)) {
      return new Response(JSON.stringify({ error: { code: 'INVALID_INPUT', message: '无效的宽高比。仅支持 1:1, 3:4, 4:3, 9:16, 16:9' } }), { status: 400, headers: corsHeaders });
    }

    if (!["1K", "2K", "4K"].includes(quality)) {
      return new Response(JSON.stringify({ error: { code: 'INVALID_INPUT', message: '无效的清晰度设置。' } }), { status: 400, headers: corsHeaders });
    }

    // 4. Calculate Dimensions (For response only)
    const { width, height } = getDimensions(aspectRatio, quality);

    // 5. Construct Gemini API Request
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${env.GEMINI_API_KEY}`;
    
    const finalPrompt = negativePrompt ? `${prompt} --no ${negativePrompt}` : prompt;

    // Correct Structure
    const payload = {
      contents: [{
        parts: [{ text: finalPrompt }]
      }],
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

    // 8. Return Success
    return new Response(JSON.stringify({
      contentType: "image/png",
      base64: base64Image,
      width,
      height
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ 
        error: { code: 'INTERNAL_ERROR', message: err.message || '发生了意外的服务端错误。' } 
    }), { status: 500, headers: corsHeaders });
  }
};