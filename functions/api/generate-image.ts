/**
 * Cloudflare Worker for Gemini 3 Pro Image Generation (Generation Only)
 * Returns raw image binary to prevent OOM issues with large JSON.
 */

interface Env {
  GEMINI_API_KEY: string;
}

function getDimensions(aspectRatio: string, quality: string): { width: number; height: number } {
  // Simple mapping for headers (frontend knows the logic too)
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
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-goog-api-key',
    'Access-Control-Expose-Headers': 'X-Image-Width, X-Image-Height', // Expose headers for frontend to read dims
  };

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = request.headers.get("x-goog-api-key") || env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Missing API Key");

    const body: any = await request.json();
    const { prompt, negativePrompt, aspectRatio, quality, referenceImageBase64 } = body;
    const { width, height } = getDimensions(aspectRatio, quality);

    // Call Google
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=${apiKey}`;
    const finalPrompt = negativePrompt ? `${prompt} --no ${negativePrompt}` : prompt;
    
    const parts: any[] = [{ text: finalPrompt }];
    if (referenceImageBase64) {
        const match = referenceImageBase64.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
        if (match) parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }

    const payload = {
      contents: [{ parts }],
      generationConfig: {
        imageConfig: { aspectRatio, imageSize: quality }
      },
      safetySettings: [
        { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
        { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" }
      ]
    };

    const googleRes = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!googleRes.ok) {
        const err = await googleRes.text();
        return new Response(JSON.stringify({ error: { message: `Gemini API Error: ${googleRes.status}`, details: err } }), { status: googleRes.status, headers: corsHeaders });
    }

    const data: any = await googleRes.json();
    const part = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
    
    if (!part?.inlineData?.data) {
         return new Response(JSON.stringify({ error: { message: 'No image data returned.' } }), { status: 500, headers: corsHeaders });
    }

    // Convert to Binary immediately
    const imageBuffer = base64ToArrayBuffer(part.inlineData.data);

    // Return RAW BINARY. Content-Type is standard PNG.
    // We send dimensions in headers so frontend doesn't need to parse metadata from the binary.
    return new Response(imageBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/png',
        'X-Image-Width': width.toString(),
        'X-Image-Height': height.toString()
      }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: { message: err.message } }), { status: 500, headers: corsHeaders });
  }
};