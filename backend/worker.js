export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);

      /* ===== METHOD GUARD ===== */
      if (request.method !== "GET" && request.method !== "OPTIONS") {
        return corsResponse("Method not allowed", 405);
      }

      /* ===== CORS PREFLIGHT ===== */
      if (request.method === "OPTIONS") {
        return new Response(null, { headers: corsHeaders() });
      }

      const filePath = url.searchParams.get("file_path");
      const exp = url.searchParams.get("exp");
      const sig = url.searchParams.get("sig");

      if (!filePath || !exp || !sig) {
        return corsResponse("Missing parameters", 400);
      }

      /* ===== VERIFY SIGNATURE ===== */
      const valid = await verifySignature(filePath, exp, sig, env.SIGNING_SECRET);
      if (!valid) {
        return corsResponse("Unauthorized or Expired Link", 403);
      }

      const cacheKey = filePath.replace(/\//g, "_");

      /* ===== TRY R2 ===== */
      let object = await env.VIDEOS_BUCKET.get(cacheKey, {
        range: request.headers,
      });

      /* ===== COLD FETCH FROM TELEGRAM ===== */
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

      /* ===== RESPONSE HEADERS ===== */
      const headers = new Headers(corsHeaders());
      object.writeHttpMetadata(headers);

      headers.set("Accept-Ranges", "bytes");
      headers.set("Vary", "Range");

      // 🟢 CHANGE: Allow the browser to cache this video for 24 hours.
      // 'private' means the browser caches it, but Cloudflare's public edge doesn't.
      headers.set("Cache-Control", "private, max-age=86400");

      let status = 200;
      if (object.range) {
        status = 206;
        headers.set(
          "Content-Range",
          `bytes ${object.range.offset}-${object.range.offset + object.range.length - 1}/${object.size}`
        );
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
    "Access-Control-Expose-Headers":
      "Content-Range, Content-Length, Accept-Ranges",
  };
}

function corsResponse(body, status) {
  return new Response(body, {
    status,
    headers: corsHeaders(),
  });
}

async function verifySignature(filePath, exp, sig, secret) {
  // Expiry check
  if (!exp || Date.now() / 1000 > Number(exp)) return false;

  // Hex validation
  if (!/^[a-f0-9]{64}$/i.test(sig)) return false;

  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  const data = encoder.encode(`${filePath}:${exp}`);

  const signatureBytes = Uint8Array.from(
    sig.match(/.{2}/g).map(b => parseInt(b, 16))
  );

  return crypto.subtle.verify("HMAC", key, signatureBytes, data);
}
