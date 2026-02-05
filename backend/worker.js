export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      
      /* =====================
         1. ENHANCED THUMBNAIL HANDLER
      ===================== */
      if (url.pathname.startsWith("/api/thumbnail")) {
        const chatId = url.searchParams.get("chat_id");
        const messageId = url.searchParams.get("message_id");
        const requestedWidth = url.searchParams.get("w") || 400; // Default to 400px
        
        const cacheKey = `thumbs/${chatId}_${messageId}.jpg`;
        
        // Fetch original from R2
        const thumb = await env.VIDEOS_BUCKET.get(cacheKey);
        if (!thumb) return new Response("Not found", { status: 404 });

        const headers = new Headers(corsHeaders());
        headers.set("Cache-Control", "public, max-age=31536000, immutable");

        /* Cloudflare Image Resizing (The "Turbo" Step)
           This automatically converts to WebP/AVIF if the browser supports it.
        */
        return new Response(thumb.body, { 
          headers,
          cf: {
            image: {
              format: 'auto',       // Automatically serves WebP
              width: requestedWidth, 
              fit: 'cover',         // Crops to fill the width/height
              quality: 80           // High compression with low quality loss
            }
          }
        });
      }

      /* =====================
         2. EXISTING VIDEO LOGIC
      ===================== */
      if (request.method !== "GET" && request.method !== "OPTIONS") return corsResponse("Method not allowed", 405);
      if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

      const filePath = url.searchParams.get("file_path");
      const exp = url.searchParams.get("exp");
      const sig = url.searchParams.get("sig");

      if (!filePath || !exp || !sig) return corsResponse("Missing parameters", 400);

      const valid = await verifySignature(filePath, exp, sig, env.SIGNING_SECRET);
      if (!valid) return corsResponse("Unauthorized or Expired Link", 403);

      const cacheKey = filePath.replace(/\//g, "_");

      let object = await env.VIDEOS_BUCKET.get(cacheKey, { range: request.headers });

      if (!object) {
        const telegramUrl = `https://api.telegram.org/file/bot${env.BOT_TOKEN}/${filePath}`;
        const tgResponse = await fetch(telegramUrl);
        if (!tgResponse.ok) return corsResponse("Telegram fetch failed", tgResponse.status);

        await env.VIDEOS_BUCKET.put(cacheKey, tgResponse.body, {
          httpMetadata: { contentType: "video/mp4" },
        });
        object = await env.VIDEOS_BUCKET.get(cacheKey, { range: request.headers });
      }

      if (!object) return corsResponse("Not found", 404);

      const headers = new Headers(corsHeaders());
      object.writeHttpMetadata(headers);
      headers.set("Accept-Ranges", "bytes");
      headers.set("Cache-Control", "private, max-age=86400");

      let status = 200;
      if (object.range) {
        status = 206;
        headers.set("Content-Range", `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`);
      }

      return new Response(object.body, { status, headers });
    } catch (err) {
      return corsResponse("Internal Error", 500);
    }
  },
};

/* ===============================
   HELPERS
================================ */

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Expose-Headers": "Content-Range, Content-Length, Accept-Ranges",
  };
}

function corsResponse(body, status) {
  return new Response(body, {
    status,
    headers: corsHeaders(),
  });
}

async function verifySignature(filePath, exp, sig, secret) {
  if (!exp || Date.now() / 1000 > Number(exp)) return false;
  if (!/^[a-f0-9]{64}$/i.test(sig)) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
  );

  const data = encoder.encode(`${filePath}:${exp}`);
  const signatureBytes = Uint8Array.from(sig.match(/.{2}/g).map(b => parseInt(b, 16)));

  return crypto.subtle.verify("HMAC", key, signatureBytes, data);
}