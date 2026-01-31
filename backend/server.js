import "dotenv/config";
import express from "express";
import axios from "axios";
import cors from "cors";
import pkg from "pg";
import https from "https";
import crypto from "crypto";

const { Pool } = pkg;

const ALLOWED_USERS = [1881815190, 993163169, 5806906139];
const agent = new https.Agent({ family: 4 });

const app = express();
app.use(cors());
app.use(express.json());

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing");

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TELEGRAM_FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* =====================
   Create/Update Table
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
          category TEXT DEFAULT 'hotties',
          caption TEXT,
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
}

function signWorkerUrl(filePath) {
  const now = new Date();
  const exp = Math.floor(now.setUTCHours(23, 59, 59, 999) / 1000);
  const payload = `${filePath}:${exp}`;
  const sig = crypto.createHmac("sha256", process.env.SIGNING_SECRET).update(payload).digest("hex");
  return { exp, sig };
}

/* =====================
   Webhook (The Traffic Controller)
===================== */
app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;
    const message = update.message || update.channel_post || update.edited_message;
    if (!message) return res.sendStatus(200);

    const userId = message.from?.id;
    if (!userId || !ALLOWED_USERS.includes(userId)) return res.sendStatus(200); 

    const media = message.video || 
                  (message.document && message.document.mime_type?.startsWith("video/")) || 
                  message.video_note || 
                  message.animation;

    if (!media) return res.sendStatus(200);

    const rawCaption = message.caption || "";
    let category = "hotties"; 
    
    if (rawCaption.toLowerCase().includes("#knacks")) category = "knacks";
    else if (rawCaption.toLowerCase().includes("#baddies")) category = "baddies";
    else if (rawCaption.toLowerCase().includes("#trends")) category = "trends";
    else if (rawCaption.toLowerCase().includes("#hotties")) category = "hotties";

    const cleanCaption = rawCaption.replace(/#\w+/g, "").trim();

    const chatId = (message.forward_from_chat?.id ?? message.chat.id).toString();
    const messageId = (message.forward_from_message_id ?? message.message_id).toString();
    const thumb = media.thumb || media.thumbs?.[0] || media.thumbnail || null;

    await pool.query(
      `INSERT INTO videos (chat_id, message_id, file_id, thumb_file_id, uploader_id, category, caption)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (chat_id, message_id) 
       DO UPDATE SET 
          thumb_file_id = EXCLUDED.thumb_file_id,
          category = EXCLUDED.category,
          caption = EXCLUDED.caption,
          uploader_id = EXCLUDED.uploader_id`,
      [chatId, messageId, media.file_id, thumb?.file_id || null, userId, category, cleanCaption]
    );

    res.sendStatus(200);
  } catch (err) {
    console.error("Webhook Error:", err.message);
    res.sendStatus(200);
  }
});

/* =====================
   api/video (Increment Views)
===================== */
app.get("/api/video", async (req, res) => {
  try {
    const { chat_id, message_id } = req.query;
    if (!chat_id || !message_id) return res.status(400).json({ error: "Missing parameters" });

    const dbRes = await pool.query(
      `UPDATE videos SET views = views + 1 WHERE chat_id=$1 AND message_id=$2 RETURNING file_id`,
      [chat_id, message_id]
    );

    if (!dbRes.rows.length) return res.status(404).json({ error: "Video not found" });

    const tgRes = await axios.get(`${TELEGRAM_API}/getFile`, { params: { file_id: dbRes.rows[0].file_id } });
    const filePath = tgRes.data.result.file_path;
    const { exp, sig } = signWorkerUrl(filePath);

    const workerUrl = `https://media.naijahomemade.com/?file_path=${encodeURIComponent(filePath)}&exp=${exp}&sig=${sig}`;
    res.json({ video_url: workerUrl });
  } catch (err) {
    res.status(500).json({ error: "Access denied" });
  }
});

/* =====================
   List videos (Modified for Trends)
===================== */
app.get("/api/videos", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 12);
    const offset = (page - 1) * limit;
    
    const category = req.query.category || "hotties";
    const sort = req.query.sort;

    let query;
    let queryValues;

    // 🟢 SPECIAL LOGIC FOR TRENDS
    if (category === "trends") {
      // Fetch everything, ignore category, sort by views
      query = `
        SELECT chat_id, message_id, created_at, views, caption, category, uploader_id
        FROM videos 
        ORDER BY views DESC 
        LIMIT $1 OFFSET $2`;
      queryValues = [limit, offset];
    } else {
      // Standard category filtering
      query = `
        SELECT chat_id, message_id, created_at, views, caption, category, uploader_id
        FROM videos 
        WHERE category = $1
        ORDER BY created_at DESC 
        LIMIT $2 OFFSET $3`;
      queryValues = [category, limit, offset];
    }

    const videosRes = await pool.query(query, queryValues);

    // Count logic needs to match
    const countQuery = category === "trends" 
      ? `SELECT COUNT(*) FROM videos` 
      : `SELECT COUNT(*) FROM videos WHERE category = $1`;
    const countValues = category === "trends" ? [] : [category];
    
    const totalRes = await pool.query(countQuery, countValues);
    const total = Number(totalRes.rows[0].count);
    // Inside your /api/videos route in server.js
const host = req.get('host');
// If host contains 'localhost', use http. Otherwise, use https.
const protocol = host.includes('localhost') ? 'http' : 'https';
const baseUrl = `${protocol}://${host}`;

    res.json({
      page,
      limit,
      total,
      videos: videosRes.rows.map(v => ({
        chat_id: v.chat_id,
        message_id: v.message_id,
        views: v.views,
        caption: v.caption,
        uploader_id: v.uploader_id,
        thumbnail_url: `${baseUrl}/api/thumbnail?chat_id=${v.chat_id}&message_id=${v.message_id}`
      }))
    });
  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* =====================
   Thumbnail (Static Headers)
===================== */
app.get("/api/thumbnail", async (req, res) => {
  try {
    const { chat_id, message_id } = req.query;
    const dbRes = await pool.query("SELECT thumb_file_id FROM videos WHERE chat_id=$1 AND message_id=$2", [chat_id, message_id]);
    if (!dbRes.rows.length || !dbRes.rows[0].thumb_file_id) return res.status(204).end();

    const fileRes = await axios.get(`${TELEGRAM_API}/getFile`, { params: { file_id: dbRes.rows[0].thumb_file_id } });
    const imageRes = await axios.get(`${TELEGRAM_FILE_API}/${fileRes.data.result.file_path}`, { responseType: "arraybuffer" });
    const buffer = Buffer.from(imageRes.data);

    res.set({
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=604800, immutable",
      "Access-Control-Allow-Origin": "*"
    });
    res.send(buffer);
  } catch (err) {
    res.status(500).end();
  }
});

/* =====================
   User Profile Photo (Avatar Proxy)
===================== */
app.get("/api/avatar", async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).end();

    const photosRes = await axios.get(`${TELEGRAM_API}/getUserProfilePhotos`, {
      params: { user_id, limit: 1 }
    });

    const photos = photosRes.data.result.photos;
    if (!photos || photos.length === 0) return res.status(204).end();

    // Grab the smallest version (index 0) of the first photo set
    const fileId = photos[0][0].file_id;
    const fileRes = await axios.get(`${TELEGRAM_API}/getFile`, { params: { file_id: fileId } });
    const filePath = fileRes.data.result.file_path;

    const imageRes = await axios.get(`${TELEGRAM_FILE_API}/${filePath}`, { responseType: "arraybuffer" });
    const buffer = Buffer.from(imageRes.data);

    res.set({
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400", 
      "Access-Control-Allow-Origin": "*"
    });
    res.send(buffer);
  } catch (err) {
    res.status(500).end();
  }
});

const PORT = process.env.PORT || 3000;
await initDatabase();
app.listen(PORT, () => console.log(`🚀 Server running on PORT ${PORT}`));