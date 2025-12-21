import "dotenv/config";
import express from "express";
import axios from "axios";
import cors from "cors";
import pkg from "pg";
import https from "https";

const { Pool } = pkg;

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
   DB migrations (safe)
===================== */
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
      ON CONFLICT (chat_id, message_id) DO NOTHING
      `,
      [chatId, messageId, media.file_id, thumb?.file_id || null]
    );

    console.log("Saved video:", media.file_id);
    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook error:", err.message);
    res.sendStatus(200);
  }
});

/* =====================
   Stream video
===================== */
app.get("/video", async (req, res) => {
  try {
    const { chat_id, message_id } = req.query;
    if (!chat_id || !message_id) {
      return res.status(400).json({ error: "chat_id and message_id required" });
    }

    const dbRes = await pool.query(
      "SELECT file_id FROM videos WHERE chat_id=$1 AND message_id=$2",
      [chat_id, message_id]
    );

    if (!dbRes.rows.length) {
      return res.status(404).json({ error: "Video not found" });
    }

    const file_id = dbRes.rows[0].file_id;

    const fileRes = await axios.get(
      `${TELEGRAM_API}/getFile`,
      { params: { file_id } }
    );

    const filePath = fileRes.data.result.file_path;
    const fileUrl = `${TELEGRAM_FILE_API}/${filePath}`;

    const range = req.headers.range;

    const tgStream = await axios.get(fileUrl, {
      responseType: "stream",
      headers: range ? { Range: range } : {},
      httpsAgent: agent
    });

    res.status(tgStream.status);
    res.set({
      "Content-Type": tgStream.headers["content-type"] || "video/mp4",
      "Accept-Ranges": "bytes",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Range",
      "Access-Control-Expose-Headers":
        "Content-Range, Accept-Ranges, Content-Length"
    });

    if (tgStream.headers["content-length"]) {
      res.set("Content-Length", tgStream.headers["content-length"]);
    }
    if (tgStream.headers["content-range"]) {
      res.set("Content-Range", tgStream.headers["content-range"]);
    }

    tgStream.data.pipe(res);
  } catch (err) {
    console.error("STREAM ERROR:", err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to stream video" });
    }
  }
});

/* =====================
   List videos
===================== */
app.get("/videos", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
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

    const baseUrl = `${req.get("host")}`;

    const videos = videosRes.rows.map(v => ({
      chat_id: v.chat_id,
      message_id: v.message_id,
      created_at: v.created_at,
      video_url: `https://${baseUrl}/video?chat_id=${v.chat_id}&message_id=${v.message_id}`,
      thumbnail_url: `https://${baseUrl}/thumbnail?chat_id=${v.chat_id}&message_id=${v.message_id}`
    }));

    res.json({ page, limit, total, videos });
  } catch (err) {
    console.error("List error:", err.message);
    res.status(500).json({ error: "Failed to load videos" });
  }
});

/* =====================
   Thumbnail (Telegram CDN)
===================== */
app.get("/thumbnail", async (req, res) => {
  try {
    // 🔎 STEP 1: log raw query params
    console.log("THUMBNAIL REQ QUERY:", req.query);

    const { chat_id, message_id } = req.query;
    if (!chat_id || !message_id) {
      console.log("❌ Missing params");
      return res.status(400).end();
    }

    // 🔎 STEP 2: query DB
    const dbRes = await pool.query(
      "SELECT thumb_file_id FROM videos WHERE chat_id=$1 AND message_id=$2",
      [chat_id, message_id]
    );

    console.log("DB RESULT:", dbRes.rows);

    // 🔎 STEP 3: check thumbnail existence
    if (!dbRes.rows.length || !dbRes.rows[0].thumb_file_id) {
      console.log("❌ No thumb_file_id for this video");
      return res.status(404).end();
    }

    // 🔎 STEP 4: ask Telegram for thumbnail file
    const fileRes = await axios.get(
      `${TELEGRAM_API}/getFile`,
      { params: { file_id: dbRes.rows[0].thumb_file_id } }
    );

    console.log("Telegram file_path:", fileRes.data.result.file_path);

    const filePath = fileRes.data.result.file_path;
    const fileUrl = `${TELEGRAM_FILE_API}/${filePath}`;

    // ✅ STEP 5: FETCH IMAGE + STREAM IT (NO REDIRECT)
    const imageRes = await axios.get(fileUrl, {
      responseType: "arraybuffer"
    });

    const buffer = Buffer.from(imageRes.data);

    // 🔐 REQUIRED HEADERS (THIS FIXES ORB)
    res.set({
      "Content-Type": "image/jpeg",
      "Content-Length": buffer.length,
      "Access-Control-Allow-Origin": "*",
      "Cross-Origin-Resource-Policy": "cross-origin",
      "Cache-Control": "public, max-age=86400"
    });

    res.send(buffer);

  } catch (err) {
    console.error("🔥 Thumbnail error:", err);
    res.status(500).end();
  }
});



/* =====================
   Start server
===================== */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on PORT ${PORT}`);
});
