/**
 * Cloudflare Worker for ModelScope Z-Image-Turbo Generation
 */

interface Env {
  // Not used if client sends key, but good to have for defaults if needed
}

function base64ToArrayBuffer(base64: string) {
  // Handle basic base64 or data URI
  const base64Clean = base64.replace(/^data:image\/\w+;base64,/, "");
  const binaryString = atob(base64Clean);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export const onRequestPost = async (context: any) => {
  const { request } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-modelscope-key',
    'Access-Control-Expose-Headers': 'X-Image-Width, X-Image-Height',
  };

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = request.headers.get("x-modelscope-key");
    if (!apiKey) throw new Error("Missing ModelScope API Key");

    const body: any = await request.json();
    const { prompt, width, height } = body; // We receive prompt and target dimensions

    const baseUrl = 'https://api-inference.modelscope.cn/';
    const commonHeaders = {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
    };

    // 1. Submit Task
    // Z-Image-Turbo supports dimensions. We inject them into 'parameters'.
    const payload = {
        model: "Tongyi-MAI/Z-Image-Turbo",
        input: {
            prompt: prompt
        },
        parameters: {
            width: width,
            height: height
        }
    };

    const submitRes = await fetch(`${baseUrl}v1/images/generations`, {
        method: 'POST',
        headers: {
            ...commonHeaders,
            "X-ModelScope-Async-Mode": "true"
        },
        body: JSON.stringify(payload)
    });

    if (!submitRes.ok) {
        // Fallback: Try top-level format if nested format fails, or return error
        const txt = await submitRes.text();
        throw new Error(`ModelScope Submit Failed: ${submitRes.status} - ${txt}`);
    }

    const submitData: any = await submitRes.json();
    const taskId = submitData.task_id;

    if (!taskId) throw new Error("No task_id received from ModelScope");

    // 2. Poll for Result
    let imageUrl = "";
    const startTime = Date.now();
    const TIMEOUT = 45000; // 45s timeout

    while (true) {
        if (Date.now() - startTime > TIMEOUT) throw new Error("Generation timed out");

        const checkRes = await fetch(`${baseUrl}v1/tasks/${taskId}`, {
            method: 'GET',
            headers: {
                ...commonHeaders,
                "X-ModelScope-Task-Type": "image_generation"
            }
        });

        if (!checkRes.ok) throw new Error("Polling failed");

        const checkData: any = await checkRes.json();
        const status = checkData.task_status;

        if (status === "SUCCEED") {
            imageUrl = checkData.output_images?.[0];
            break;
        } else if (status === "FAILED") {
            throw new Error(`Generation failed: ${JSON.stringify(checkData)}`);
        }

        // Wait 1s before next poll
        await new Promise(r => setTimeout(r, 1000));
    }

    if (!imageUrl) throw new Error("No image URL in success response");

    // 3. Fetch the actual image to return as Blob (consistency with Gemini flow)
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) throw new Error("Failed to download generated image from ModelScope");
    
    const imgBuffer = await imgRes.arrayBuffer();

    // Return Binary
    return new Response(imgBuffer, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/jpeg', 
        'X-Image-Width': width?.toString() || "1024", 
        'X-Image-Height': height?.toString() || "1024"
      }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: { message: err.message } }), { status: 500, headers: corsHeaders });
  }
};