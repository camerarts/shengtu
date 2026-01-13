/**
 * Cloudflare Worker for R2 Uploads
 * Receives binary image -> Returns public URL
 */

interface R2Bucket {
  put(key: string, value: any, options?: any): Promise<any>;
}

interface Env {
  IMAGES_BUCKET: R2Bucket;
  PUBLIC_BUCKET_URL: string;
}

export const onRequestPost = async (context: any) => {
  const { request, env } = context;
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    if (!env.IMAGES_BUCKET || !env.PUBLIC_BUCKET_URL) {
      throw new Error("Server R2 configuration missing.");
    }

    // Read binary body directly
    const arrayBuffer = await request.arrayBuffer();
    if (!arrayBuffer || arrayBuffer.byteLength === 0) {
      throw new Error("Empty upload body.");
    }

    // Generate unique filename
    const filename = `gemini-${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;

    // Upload to R2
    await env.IMAGES_BUCKET.put(filename, arrayBuffer, {
      httpMetadata: {
        contentType: 'image/png',
        cacheControl: 'public, max-age=31536000'
      }
    });

    // Construct URL
    const baseUrl = env.PUBLIC_BUCKET_URL.replace(/\/$/, "");
    const imageUrl = `${baseUrl}/${filename}`;

    return new Response(JSON.stringify({ url: imageUrl }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: { message: err.message } }), { status: 500, headers: corsHeaders });
  }
};