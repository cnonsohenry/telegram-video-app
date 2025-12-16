import "dotenv/config";
import express from "express";
import axios from "axios";
import cors from "cors";
import pkg from "pg";

const { Pool } = pkg;

// =====================
// Database setup
// =====================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});


// Create table on startup
await pool.query(`
  CREATE TABLE IF NOT EXISTS videos (
    id SERIAL PRIMARY KEY,
    chat_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chat_id, message_id)
  )
`);

// =====================
// App setup
// =====================
const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing");

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TELEGRAM_FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

// =====================
// Webhook
// =====================
app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;
    const message = update.message || update.channel_post || update.edited_message;
    if (!message) return res.sendStatus(200);

    const media =
      message.video ||
      (message.document && message.document.mime_type?.startsWith("video/")) ||
      message.video_note ||
      message.animation;

    if (!media) return res.sendStatus(200);

    const chatId = message.forward_from_chat
      ? message.forward_from_chat.id.toString()
      : message.chat.id.toString();

    const messageId = message.forward_from_message_id
      ? message.forward_from_message_id.toString()
      : message.message_id.toString();

    await pool.query(
      `
      INSERT INTO videos (chat_id, message_id, file_id)
      VALUES ($1, $2, $3)
      ON CONFLICT (chat_id, message_id) DO NOTHING
      `,
      [chatId, messageId, media.file_id]
    );

    console.log("Saved media:", media.file_id);
    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err);
    res.sendStatus(200); // never fail Telegram webhook
  }
});

// =====================
// Get single video
// =====================
app.get("/video", async (req, res) => {
  try {
    const { chat_id, message_id } = req.query;
    if (!chat_id || !message_id) {
      return res.status(400).json({ error: "chat_id and message_id required" });
    }

    const result = await pool.query(
      `
      SELECT file_id FROM videos
      WHERE chat_id = $1 AND message_id = $2
      `,
      [chat_id, message_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Video not found" });
    }

    const fileId = result.rows[0].file_id;

    const fileRes = await axios.get(
      `${TELEGRAM_API}/getFile?file_id=${fileId}`
    );

    const filePath = fileRes.data.result.file_path;
    const url = `${TELEGRAM_FILE_API}/${filePath}`;

    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Unable to fetch video" });
  }
});

// =====================
// List videos
// =====================
app.get("/videos", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const offset = (page - 1) * limit;

    const videos = await pool.query(
      `
      SELECT chat_id, message_id, file_id, created_at
      FROM videos
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
      `,
      [limit, offset]
    );

    const total = await pool.query(
      `SELECT COUNT(*) FROM videos`
    );

    res.json({
      page,
      limit,
      total: Number(total.rows[0].count),
      videos: videos.rows
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load videos" });
  }
});

// =====================
// Start server
// =====================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on PORT ${PORT}`);
});
