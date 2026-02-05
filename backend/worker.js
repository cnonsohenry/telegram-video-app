export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      
/* =====================
   Worker: Thumbnail Handler (The Final Boss Fix)
===================== */
if (url.pathname.startsWith("/api/thumbnail")) {
  const chatId = url.searchParams.get("chat_id");
  const messageId = url.searchParams.get("message_id");
  const sig = url.searchParams.get("sig");
  const w = parseInt(url.searchParams.get("w")) || 400;

  // 1. Signature Verification
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(env.SIGNING_SECRET), 
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"]
  );
  const data = encoder.encode(`${chatId}:${messageId}`);
  const signatureBytes = Uint8Array.from(sig.match(/.{2}/g).map(b => parseInt(b, 16)));
  const isValid = await crypto.subtle.verify("HMAC", key, signatureBytes, data);
  
  if (!isValid) return new Response("Unauthorized", { status: 403 });

  // 2. Fetch directly from the Custom Domain with 'cf' options
  // This tells Cloudflare to grab the image and resize it before giving it to the worker
  const imageOriginUrl = `https://bucket.naijahomemade.com/thumbs/${chatId}_${messageId}.jpg`;

  const response = await fetch(imageOriginUrl, {
  cf: {
    image: {
      width: w,
      height: Math.round(w * 1.5), // 🟢 Providing height fixes the 'cover' warning
      fit: 'cover',
      format: 'webp', // 🟢 Explicitly asking for webp ensures it transforms
      quality: 80
    }
  }
});
  // 3. Handle Errors from the Custom Domain
  if (!response.ok) {
    return new Response(`Origin Error: ${response.status}`, { status: response.status });
  }

  // 4. Return the optimized image
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(response.body, {
    status: 200,
    headers: headers
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