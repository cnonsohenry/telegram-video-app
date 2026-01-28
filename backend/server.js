import "dotenv/config";
import express from "express";
import axios from "axios";
import cors from "cors";
import pkg from "pg";
import https from "https";
import crypto from "crypto";

const { Pool } = pkg;

/* =====================
  Allowed Telegram Users
===================== */
const ALLOWED_USERS = [1881815190, 993163169, 5806906139]; // <-- Telegram user IDs allowed to send videos

/* =====================
   HTTPS agent (IPv4 fix)
===================== */
const agent = new https.Agent({ family: 4 });

/* =====================
   App setup
===================== */
const app = express();
app.use(cors());
app.use(express.json());

/* =====================
   Env & Telegram config
===================== */
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing");

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TELEGRAM_FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

/* =====================
   Database setup
===================== */
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* =====================
   Create Table
===================== */
async function initDatabase() {
  let retries = 5;

  while (retries) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS videos (
          id SERIAL PRIMARY KEY,
          chat_id TEXT NOT NULL,
          message_id TEXT NOT NULL,
          file_id TEXT NOT NULL,
          thumb_file_id TEXT,
          uploader_id BIGINT,
          views BIGINT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(chat_id, message_id)
        )
      `);

      console.log("✅ Database initialized");
      break;
    } catch (err) {
      retries--;
      console.error("❌ DB init failed, retrying...", err.message);
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  if (!retries) {
    throw new Error("Database initialization failed");
  }
}


function signWorkerUrl(filePath) {
  const exp = Math.floor(Date.now() / 1000) + 60 * 10; // 10 minutes

  const payload = `${filePath}:${exp}`;

  const sig = crypto
    .createHmac("sha256", process.env.SIGNING_SECRET)
    .update(payload)
    .digest("hex");

  return {
    exp,
    sig,
  };
}



/* =====================
   Webhook
===================== */
app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;
    // Handle standard messages or channel posts
    const message = update.message || update.channel_post || update.edited_message;

    if (!message) return res.sendStatus(200);

    // 1. Identify who sent it
    const userId = message.from?.id;
    
    // 2. Security Check (Silent Filtering)
    if (!ALLOWED_USERS.includes(userId)) {
      // We log it for your eyes only, then tell Telegram "OK" 
      // so it doesn't clog the queue with a 403 error.
      console.log(`Ignoring unauthorized message from: ${userId}`);
      return res.sendStatus(200); 
    }

    // 3. Extract Media
    const media = message.video || 
                  (message.document && message.document.mime_type?.startsWith("video/")) || 
                  message.video_note || 
                  message.animation;

    if (!media) return res.sendStatus(200);

    const chatId = (message.forward_from_chat?.id ?? message.chat.id).toString();
    const messageId = (message.forward_from_message_id ?? message.message_id).toString();
    const thumb = media.thumb || media.thumbs?.[0] || media.thumbnail || null;

    // 4. Save to Database
    await pool.query(
      `INSERT INTO videos (chat_id, message_id, file_id, thumb_file_id, uploader_id)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (chat_id, message_id) DO UPDATE SET thumb_file_id = EXCLUDED.thumb_file_id`,
      [chatId, messageId, media.file_id, thumb?.file_id || null, userId]
    );

    console.log(`✅ Success: Video from ${userId} saved.`);
    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook Error:", err.message);
    // Always send 200 to keep the webhook active
    res.sendStatus(200);
  }
});


/* =====================
   api/video (NOW WITH VIEW COUNTING)
===================== */
app.get("/api/video", async (req, res) => {
  try {
    const { chat_id, message_id } = req.query;

    if (!chat_id || !message_id) {
      return res.status(400).json({ error: "Missing parameters" });
    }

    // 1. Increment view count AND get file_id in one query
    const dbRes = await pool.query(
      `
      UPDATE videos 
      SET views = views + 1 
      WHERE chat_id=$1 AND message_id=$2 
      RETURNING file_id
      `,
      [chat_id, message_id]
    );

    if (!dbRes.rows.length) {
      return res.status(404).json({ error: "Video not found" });
    }

    const { file_id } = dbRes.rows[0];

    // 2. Telegram getFile
    const tgRes = await axios.get(`${TELEGRAM_API}/getFile`, {
      params: { file_id },
    });

    const filePath = tgRes.data.result.file_path;

    // 3. Sign URL
    const { exp, sig } = signWorkerUrl(filePath);

    const workerUrl =
      "https://media.naijahomemade.com" +
      `/?file_path=${encodeURIComponent(filePath)}` +
      `&exp=${exp}` +
      `&sig=${sig}`;

    res.json({ video_url: workerUrl });
  } catch (err) {
    console.error("VIDEO ACCESS ERROR:", err);
    res.status(500).json({ error: "Access denied" });
  }
});



/* =====================
   List videos (Filtered & Sorted for Tabs)
===================== */
app.get("/api/videos", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 12);
    const offset = (page - 1) * limit;
    
    // Ensure uploader_id is either a valid string or null
    const uploader_id = req.query.uploader_id && req.query.uploader_id !== "undefined" 
      ? req.query.uploader_id 
      : null;
    
    const sort = req.query.sort;

    let queryValues = [limit, offset];
    let whereClause = "";
    let orderBy = "ORDER BY created_at DESC";

    if (uploader_id && uploader_id !== "undefined") {
      // 🟢 Force cast to BIGINT using ::BIGINT
      whereClause = "WHERE uploader_id = $3::BIGINT";
      queryValues.push(uploader_id);
    }

    if (sort === "trending") {
      orderBy = "ORDER BY views DESC";
    }

    const videosRes = await pool.query(
      `SELECT chat_id, message_id, created_at, views, uploader_id
       FROM videos ${whereClause} ${orderBy} LIMIT $1 OFFSET $2`,
      queryValues
    );
    

    // 🟢 FIXED: Accurate total count for pagination
    const totalRes = await pool.query(
      `SELECT COUNT(*) FROM videos ${whereClause}`,
      uploader_id ? [uploader_id] : []
    );
    const total = Number(totalRes.rows[0].count);

    const baseUrl = req.get("host");

    res.set({ "Cache-Control": "public, max-age=5" });

    const videos = videosRes.rows.map(v => ({
      chat_id: v.chat_id,
      message_id: v.message_id,
      views: v.views,
      created_at: v.created_at,
      uploader_id: v.uploader_id,
      thumbnail_url: `https://${baseUrl}/api/thumbnail?chat_id=${v.chat_id}&message_id=${v.message_id}`
    }));

    res.json({ page, limit, total, videos });
  } catch (err) {
    console.error("FULL DATABASE ERROR:", err);
    res.status(500).json({ error: "Failed to load videos" });
  }
});

/* =====================
   Thumbnail (STRONG CACHE)
===================== */
app.get("/api/thumbnail", async (req, res) => {
  try {
    const { chat_id, message_id } = req.query;
    if (!chat_id || !message_id) return res.status(400).end();

    const dbRes = await pool.query(
      "SELECT thumb_file_id FROM videos WHERE chat_id=$1 AND message_id=$2",
      [chat_id, message_id]
    );

    if (!dbRes.rows.length || !dbRes.rows[0].thumb_file_id) {
      return res.status(204).end();
    }

    const fileRes = await axios.get(
      `${TELEGRAM_API}/getFile`,
      { params: { file_id: dbRes.rows[0].thumb_file_id } }
    );

    const filePath = fileRes.data.result.file_path;
    const fileUrl = `${TELEGRAM_FILE_API}/${filePath}`;

    const imageRes = await axios.get(fileUrl, {
      responseType: "arraybuffer"
    });

    const buffer = Buffer.from(imageRes.data);

    res.set({
      "Content-Type": "image/jpeg",
      "Content-Length": buffer.length,
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",

      // 🔥 STRONG CACHE
      "Cache-Control": "public, max-age=604800, immutable",
      "ETag": `"thumb-${chat_id}-${message_id}"`
    });

    res.send(buffer);
  } catch (err) {
    console.error("Thumbnail error:", err.message);
    res.status(500).end();
  }
});

/* =====================
   Start server
===================== */
const PORT = process.env.PORT || 3000;
await initDatabase();

app.listen(PORT, () => {
  console.log(`🚀 Server running on PORT ${PORT}`);
});

