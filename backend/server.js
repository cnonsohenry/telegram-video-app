import "dotenv/config";
import express from "express";
import axios from "axios";
import cors from "cors";
import pkg from "pg";
import https from "https";
import crypto from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import authRoutes from "./auth.js";

const { Pool } = pkg;

const ALLOWED_USERS = [1881815190, 993163169, 5806906139];
const agent = new https.Agent({ family: 4 });

const app = express();
app.use(cors());
app.use(express.json());
app.use(cors({
  origin: [
    "https://naijahomemade.com",
    "https://www.naijahomemade.com",
    "http://localhost:5173" // Keep this for your local dev work
  ]
}));

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing");

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TELEGRAM_FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Configure R2 Client
const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT, // e.g., https://<account_id>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

/* =====================
   Create/Update Tables
===================== */
async function initDatabase() {
  let retries = 5;
  while (retries) {
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          user_id BIGINT PRIMARY KEY,
          username TEXT,
          full_name TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS videos (
          id SERIAL PRIMARY KEY,
          chat_id TEXT NOT NULL,
          message_id TEXT NOT NULL,
          file_id TEXT NOT NULL,
          thumb_file_id TEXT,
          uploader_id BIGINT REFERENCES users(user_id),
          category TEXT DEFAULT 'hotties',
          caption TEXT,
          views BIGINT DEFAULT 0,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(chat_id, message_id)
        )
      `);
      
      console.log("✅ Database initialized (Users & Videos)");
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
   AUTH
===================== */
app.use("/api/auth", authRoutes);

/* =====================
   HELPER: Upload Thumbnail to R2
===================== */
async function uploadThumbnailToR2(thumbFileId, chatId, messageId) {
  if (!thumbFileId) return null;
  
  try {
    // 1. Get file path from Telegram
    const fileRes = await axios.get(`${TELEGRAM_API}/getFile`, { params: { file_id: thumbFileId } });
    const filePath = fileRes.data.result.file_path;

    // 2. Download the image buffer
    const imageRes = await axios.get(`${TELEGRAM_FILE_API}/${filePath}`, { responseType: "arraybuffer" });
    const buffer = Buffer.from(imageRes.data);

    // 3. Upload to Cloudflare R2
    const key = `thumbs/${chatId}_${messageId}.jpg`;
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: "image/jpeg",
    }));

    console.log(`✅ Webhook: Thumbnail saved to R2 -> ${key}`);
    return key;
  } catch (err) {
    console.error("❌ Webhook Thumbnail Sync Failed:", err.message);
    return null;
  }
}

/* =====================
   Webhook (Updated with R2 Sync)
===================== */
app.post("/webhook", async (req, res) => {
  try {
    const update = req.body;
    const message = update.message || update.channel_post || update.edited_message;
    if (!message) return res.sendStatus(200);

    const userId = message.from?.id;
    if (!userId || !ALLOWED_USERS.includes(userId)) return res.sendStatus(200); 

    const username = message.from.username || null;
    const fullName = message.from.first_name || 'Member';

    await pool.query(
      `INSERT INTO users (user_id, username, full_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) 
       DO UPDATE SET username = EXCLUDED.username, full_name = EXCLUDED.full_name`,
      [userId, username, fullName]
    );

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
    else if (rawCaption.toLowerCase().includes("#shots")) category = "shots";
    else if (rawCaption.toLowerCase().includes("#hotties")) category = "hotties";

    const cleanCaption = rawCaption.replace(/#\w+/g, "").trim();

    const chatId = (message.forward_from_chat?.id ?? message.chat.id).toString();
    const messageId = (message.forward_from_message_id ?? message.message_id).toString();
    
    // Identify Thumbnail
    const thumb = media.thumb || media.thumbs?.[0] || media.thumbnail || null;
    const thumbFileId = thumb?.file_id || null;

    // 🟢 NEW: Trigger R2 Upload immediately
    if (thumbFileId) {
      // We don't 'await' this so the webhook returns 200 to Telegram immediately
      uploadThumbnailToR2(thumbFileId, chatId, messageId);
    }

    await pool.query(
      `INSERT INTO videos (chat_id, message_id, file_id, thumb_file_id, uploader_id, category, caption)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (chat_id, message_id) 
       DO UPDATE SET 
          thumb_file_id = EXCLUDED.thumb_file_id,
          category = EXCLUDED.category,
          caption = EXCLUDED.caption,
          uploader_id = EXCLUDED.uploader_id`,
      [chatId, messageId, media.file_id, thumbFileId, userId, category, cleanCaption]
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
   HELPER: Sign Thumbnail URL
===================== */
function signThumbnail(chatId, messageId) {
  const payload = `${chatId}:${messageId}`;
  return crypto
    .createHmac("sha256", process.env.SIGNING_SECRET)
    .update(payload)
    .digest("hex");
}

/* =====================
   List videos (With Signed Thumbnails)
===================== */
app.get("/api/videos", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 12);
    const offset = (page - 1) * limit;
    const category = req.query.category || "hotties";
    
    // 🟢 Worker domain for direct thumbnail delivery
    const mediaBaseUrl = "https://media.naijahomemade.com";

    // 1. Fetch Main Grid Videos
    let query;
    let queryValues;

    if (category === "trends") {
      query = `SELECT v.*, u.username as uploader_name FROM videos v LEFT JOIN users u ON v.uploader_id = u.user_id ORDER BY v.views DESC LIMIT $1 OFFSET $2`;
      queryValues = [limit, offset];
    } else {
      query = `SELECT v.*, u.username as uploader_name FROM videos v LEFT JOIN users u ON v.uploader_id = u.user_id WHERE v.category = $1 ORDER BY v.created_at DESC LIMIT $2 OFFSET $3`;
      queryValues = [category, limit, offset];
    }

    const videosRes = await pool.query(query, queryValues);

    // 2. Fetch Suggestions ONLY on Page 1
    let suggestions = [];
    if (page === 1) {
      const suggestQuery = `
        SELECT v.*, u.username as uploader_name 
        FROM videos v 
        LEFT JOIN users u ON v.uploader_id = u.user_id 
        ORDER BY RANDOM() LIMIT 10`;
      const suggestRes = await pool.query(suggestQuery);
      suggestions = suggestRes.rows;
    }

    const countQuery = category === "trends" ? `SELECT COUNT(*) FROM videos` : `SELECT COUNT(*) FROM videos WHERE category = $1`;
    const countValues = category === "trends" ? [] : [category];
    const totalRes = await pool.query(countQuery, countValues);
    const total = Number(totalRes.rows[0].count);

    // 🟢 Helper to map video object with SECURE thumbnails
    const mapVideo = (v) => {
      const sig = signThumbnail(v.chat_id, v.message_id);
      return {
        chat_id: v.chat_id,
        message_id: v.message_id,
        views: v.views,
        caption: v.caption,
        uploader_id: v.uploader_id,
        uploader_name: v.uploader_name || "Member",
        created_at: v.created_at,
        // 🟢 Includes the security signature for the Worker to verify
        thumbnail_url: `${mediaBaseUrl}/api/thumbnail?chat_id=${v.chat_id}&message_id=${v.message_id}&sig=${sig}`
      };
    };

    res.json({
      page,
      limit,
      total,
      videos: videosRes.rows.map(mapVideo),
      suggestions: suggestions.map(mapVideo)
    });
  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* =====================
   UPDATED: Thumbnail (R2 Caching Logic)
===================== */
app.get("/api/thumbnail", async (req, res) => {
  const { chat_id, message_id } = req.query;
  if (!chat_id || !message_id) return res.status(400).end();
  
  const fileName = `thumbs/${chat_id}_${message_id}.jpg`;

  try {
    // 1. Try to get from R2 first
    try {
      const r2Object = await r2.send(new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName
      }));
      
      res.set({
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable", // 1 year
        "Access-Control-Allow-Origin": "*"
      });
      return r2Object.Body.pipe(res);
    } catch (r2Err) {
      // If not in R2, proceed to fetch from Telegram
      console.log(`Thumbnail ${fileName} not in R2, fetching from Telegram...`);
    }

    // 2. Fetch thumb_file_id from DB
    const dbRes = await pool.query("SELECT thumb_file_id FROM videos WHERE chat_id=$1 AND message_id=$2", [chat_id, message_id]);
    if (!dbRes.rows.length || !dbRes.rows[0].thumb_file_id) return res.status(204).end();

    // 3. Download from Telegram
    const fileRes = await axios.get(`${TELEGRAM_API}/getFile`, { params: { file_id: dbRes.rows[0].thumb_file_id } });
    const imageRes = await axios.get(`${TELEGRAM_FILE_API}/${fileRes.data.result.file_path}`, { responseType: "arraybuffer" });
    const buffer = Buffer.from(imageRes.data);

    // 4. Upload to R2 in the background (Don't await to keep response fast)
    r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: "image/jpeg"
    })).catch(e => console.error("R2 Upload Failed:", e.message));

    // 5. Send to user
    res.set({
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=604800, immutable",
      "Access-Control-Allow-Origin": "*"
    });
    res.send(buffer);

  } catch (err) {
    console.error("Thumbnail Route Error:", err.message);
    res.status(500).end();
  }
});

/* =====================
   User Profile Photo
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

    const fileId = photos[0][0].file_id;
    const fileRes = await axios.get(`${TELEGRAM_API}/getFile`, { params: { file_id: fileId } });
    const imageRes = await axios.get(`${TELEGRAM_FILE_API}/${fileRes.data.result.file_path}`, { responseType: "arraybuffer" });
    
    res.set({
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400", 
      "Access-Control-Allow-Origin": "*"
    });
    res.send(Buffer.from(imageRes.data));
  } catch (err) {
    res.status(500).end();
  }
});

const PORT = process.env.PORT || 3000;
await initDatabase();
app.listen(PORT, () => console.log(`🚀 Server running on PORT ${PORT}`));