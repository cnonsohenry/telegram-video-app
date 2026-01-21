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
const ALLOWED_USERS = [1881815190, 993163169]; // <-- Telegram user IDs allowed to send videos

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
await pool.query(`
  CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    chat_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    thumb_file_id TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chat_id, message_id)
  )
`);

/* =====================
   Create Video Token Table
===================== */
await pool.query(`
  CREATE TABLE IF NOT EXISTS video_play_tokens (
  token TEXT PRIMARY KEY,
  chat_id BIGINT NOT NULL,
  message_id BIGINT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used BOOLEAN DEFAULT FALSE
  );
`);

/* =====================
   Webhook
===================== */
app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;
    const message =
      update.message ||
      update.channel_post ||
      update.edited_message;

    if (!message) return res.sendStatus(200);

      const userId = message.from?.id;
  if (!ALLOWED_USERS.includes(userId)) {
    console.log(`Blocked message from user ${userId}`);
    return res.sendStatus(403); // Forbidden
  }

    const media =
      message.video ||
      (message.document && message.document.mime_type?.startsWith("video/")) ||
      message.video_note ||
      message.animation;

    if (!media) return res.sendStatus(200);

    const chatId = (
      message.forward_from_chat?.id ??
      message.chat.id
    ).toString();

    const messageId = (
      message.forward_from_message_id ??
      message.message_id
    ).toString();

    const thumb =
      media.thumb ||
      media.thumbs?.[0] ||
      media.thumbnail ||
      null;

    await pool.query(
      `
      INSERT INTO videos (chat_id, message_id, file_id, thumb_file_id)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (chat_id, message_id)
      DO UPDATE SET thumb_file_id = EXCLUDED.thumb_file_id
      `,
      [chatId, messageId, media.file_id, thumb?.file_id || null]
    );

    res.sendStatus(200);
    console.log(`Video saved to database. from user ${userId}`);
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.sendStatus(200);
  }
});

/* =====================
   REDIRECT VIDEO
===================== */
app.get("/api/video", async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(403).json({ error: "Ad required" });
    }

    // 1. Validate token
    const tokenRes = await pool.query(
      `
      SELECT chat_id, message_id
      FROM video_play_tokens
      WHERE token=$1
        AND used=false
        AND expires_at > NOW()
      LIMIT 1
      `,
      [token]
    );

    if (!tokenRes.rows.length) {
      return res.status(403).json({ error: "Invalid or expired token" });
    }

    const { chat_id, message_id } = tokenRes.rows[0];

    // 2. Mark token as used
    await pool.query(
      "UPDATE video_play_tokens SET used=true WHERE token=$1",
      [token]
    );

    // 3. Get Telegram file_id
    const dbRes = await pool.query(
      "SELECT file_id FROM videos WHERE chat_id=$1 AND message_id=$2 LIMIT 1",
      [chat_id, message_id]
    );

    if (!dbRes.rows.length) {
      return res.status(404).json({ error: "Video not found" });
    }

    const { file_id } = dbRes.rows[0];

    // 4. Telegram getFile
    const fileRes = await axios.get(
      `${TELEGRAM_API}/getFile`,
      { params: { file_id } }
    );

    if (!fileRes.data.ok) {
      return res.status(500).json({ error: "Telegram error" });
    }

    const filePath = fileRes.data.result.file_path;
    const fileUrl = `${TELEGRAM_FILE_API}/${filePath}`;

    // 5. Redirect (NO STREAMING)
    return res.redirect(302, fileUrl);
  } catch (err) {
    console.error("VIDEO ACCESS ERROR:", err.message);
    res.status(500).json({ error: "Access denied" });
  }
});


/* =====================
   List videos (CACHED)
===================== */
app.get("/api/videos", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 12);
    const offset = (page - 1) * limit;

    const videosRes = await pool.query(
      `
      SELECT chat_id, message_id, created_at
      FROM videos
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    const totalRes = await pool.query(`SELECT COUNT(*) FROM videos`);
    const total = Number(totalRes.rows[0].count);

    const baseUrl = req.get("host");

    res.set({
      "Cache-Control": "public, max-age=60"
    });

    const videos = videosRes.rows.map(v => ({
      chat_id: v.chat_id,
      message_id: v.message_id,
      created_at: v.created_at,
      thumbnail_url: `https://${baseUrl}/api/thumbnail?chat_id=${v.chat_id}&message_id=${v.message_id}`
    }));

    res.json({ page, limit, total, videos });
  } catch (err) {
    console.error("List error:", err.message);
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
   TOKEN
===================== */
app.post("/api/ad/confirm", async (req, res) => {
  try {
    const { chat_id, message_id } = req.body;

    if (!chat_id || !message_id) {
      return res.status(400).json({ error: "chat_id and message_id required" });
    }

    const token = crypto.randomBytes(32).toString("hex");

    await pool.query(
      `
      INSERT INTO video_play_tokens (token, chat_id, message_id, expires_at)
      VALUES ($1, $2, $3, NOW() + INTERVAL '2 minutes')
      `,
      [token, chat_id, message_id]
    );

    res.json({ token });
  } catch (err) {
    console.error("TOKEN ERROR:", err.message);
    res.status(500).json({ error: "Failed to issue play token" });
  }
});

/* =====================
   Start server
===================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on PORT ${PORT}`);
});
