import express from "express";
import axios from "axios";
import cors from "cors";
import Database from "better-sqlite3";

// =====================
// Database setup
// =====================
const db = new Database("videos.db");

db.prepare(`
  CREATE TABLE IF NOT EXISTS videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    chat_id TEXT NOT NULL,
    message_id TEXT NOT NULL,
    file_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(chat_id, message_id)
  )
`).run();

// =====================
// App setup
// =====================
const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is not set");
}

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TELEGRAM_FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

// =====================
// Webhook endpoint
// =====================
app.post("/webhook", (req, res) => {
  const update = req.body;
  const message = update.message || update.channel_post || update.edited_message;

  if (!message) return res.sendStatus(200);

  const media =
    message.video ||
    (message.document && message.document.mime_type?.startsWith("video/")) ||
    message.video_note ||
    message.animation;

  if (!media) return res.sendStatus(200);

  const insert = db.prepare(`
    INSERT OR IGNORE INTO videos (chat_id, message_id, file_id)
    VALUES (?, ?, ?)
  `);

  if (message.forward_from_chat && message.forward_from_message_id) {
    insert.run(
      message.forward_from_chat.id.toString(),
      message.forward_from_message_id.toString(),
      media.file_id
    );
  } else {
    insert.run(
      message.chat.id.toString(),
      message.message_id.toString(),
      media.file_id
    );
  }

  console.log("Saved media:", media.file_id);
  res.sendStatus(200);
});


// =====================
// Get single video URL
// =====================
app.get("/video", async (req, res) => {
  try {
    const { chat_id, message_id } = req.query;

    if (!chat_id || !message_id) {
      return res.status(400).json({ error: "chat_id and message_id are required" });
    }

    const row = db.prepare(`
      SELECT file_id FROM videos
      WHERE chat_id = ? AND message_id = ?
    `).get(chat_id, message_id);

    if (!row) {
      return res.status(404).json({ error: "Video not found" });
    }

    const fileRes = await axios.get(
      `${TELEGRAM_API}/getFile?file_id=${row.file_id}`
    );

    const filePath = fileRes.data.result.file_path;
    const playableUrl = `${TELEGRAM_FILE_API}/${filePath}`;

    res.json({ url: playableUrl });
  } catch (err) {
    console.error(err?.response?.data || err);
    res.status(500).json({ error: "Unable to get video" });
  }
});

// =====================
// List videos (pagination)
// =====================
app.get("/videos", (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const offset = (page - 1) * limit;

    const rows = db.prepare(`
      SELECT chat_id, message_id, file_id, created_at
      FROM videos
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    const total = db.prepare(`
      SELECT COUNT(*) as count FROM videos
    `).get().count;

    res.json({
      page,
      limit,
      total,
      videos: rows
    });
  } catch (error) {
    console.error("Error fetching /videos:", error);
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
