import "dotenv/config";
import express from "express";
import axios from "axios";
import cors from "cors";
import fs from "fs";
import pkg from "pg";
import https from "https";
import crypto from "crypto";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import authRoutes from "./auth.js";
import multer from "multer";
import { uploadDirectToStream } from "./controllers/upload_premium.js"; 


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
    "http://localhost:5173" 
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
  endpoint: process.env.R2_ENDPOINT, 
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
   PREMIUM UPLOAD
===================== */
const upload = multer({ dest: "uploads/" }); 

app.post("/api/admin/upload-premium", upload.single("video"), async (req, res) => {
  try {
    const { caption, category, uploader_id } = req.body;
    const videoFile = req.file;

    if (!ALLOWED_USERS.includes(Number(uploader_id))) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    if (!videoFile) return res.status(400).json({ error: "No video file provided" });

    const cfResult = await uploadDirectToStream(videoFile.path, {
      caption: caption || "Premium Content",
      category: category || "premium"
    });

    const internalId = `premium_${Date.now()}`;
    
    await pool.query(
      `INSERT INTO videos (chat_id, message_id, file_id, uploader_id, category, caption, cloudflare_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ready')`,
      [
        "internal", 
        internalId, 
        "none", 
        uploader_id, 
        category || "premium", 
        caption, 
        cfResult.uid 
      ]
    );

    fs.unlinkSync(videoFile.path);

    res.json({ success: true, videoId: cfResult.uid });
  } catch (err) {
    console.error("Admin Upload Error:", err.message);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* =====================
   api/video (Universal Handler)
===================== */
app.get("/api/video", async (req, res) => {
  try {
    const { chat_id, message_id } = req.query;
    if (!chat_id || !message_id) return res.status(400).json({ error: "Missing parameters" });

    const dbRes = await pool.query(
      `UPDATE videos SET views = views + 1 
       WHERE chat_id=$1 AND message_id=$2 
       RETURNING file_id, cloudflare_id`,
      [chat_id, message_id]
    );

    if (!dbRes.rows.length) {
      return res.status(404).json({ error: "Video not found in database" });
    }

    const video = dbRes.rows[0];

    if (video.cloudflare_id && video.cloudflare_id !== "none") {
      const cleanId = video.cloudflare_id.split('?')[0];
      const video_url = `https://videodelivery.net/${cleanId}/manifest/video.m3u8`;
      console.log(`[PLAYBACK] Serving Cloudflare: ${cleanId}`);
      return res.json({ video_url });
    }

    if (!video.file_id || video.file_id === "none") {
       return res.status(400).json({ error: "No video source (Telegram or Cloudflare) found" });
    }

    console.log(`[PLAYBACK] Fetching from Telegram: ${video.file_id.substring(0, 10)}...`);

    const tgRes = await axios.get(`${TELEGRAM_API}/getFile`, { 
      params: { file_id: video.file_id } 
    });

    if (!tgRes.data?.result?.file_path) {
      return res.status(404).json({ error: "Telegram could not find this file" });
    }

    const filePath = tgRes.data.result.file_path;
    const { exp, sig } = signWorkerUrl(filePath);

    // 🟢 This correctly stays on media.naijahomemade.com for the Worker
    const workerUrl = `https://media.naijahomemade.com/?file_path=${encodeURIComponent(filePath)}&exp=${exp}&sig=${sig}`;
    
    return res.json({ video_url: workerUrl });

  } catch (err) {
    console.error("❌ Video API Error Detail:", err.response?.data || err.message);
    res.status(500).json({ error: "Playback failed", detail: err.message });
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
   List videos (With Signed Thumbnails & Cloudflare Support)
===================== */
app.get("/api/videos", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 12);
    const offset = (page - 1) * limit;
    const category = req.query.category || "hotties";
    
    // 🟢 FIX: Point to the Node.js API server for thumbnails, not the Worker
    const apiBaseUrl = "https://videos.naijahomemade.com";

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

    const mapVideo = (v) => {
      if (v.cloudflare_id) {
         const cleanId = v.cloudflare_id.split('?')[0];

         return {
            chat_id: v.chat_id,
            message_id: v.message_id,
            views: v.views,
            caption: v.caption,
            category: v.category,
            uploader_id: v.uploader_id,
            uploader_name: v.uploader_name || "Member",
            created_at: v.created_at,
            thumbnail_url: `https://videodelivery.net/${cleanId}/thumbnails/thumbnail.jpg?time=1s&height=600`
         };
      }

      const sig = signThumbnail(v.chat_id, v.message_id);
      return {
        chat_id: v.chat_id,
        message_id: v.message_id,
        views: v.views,
        caption: v.caption,
        category: v.category,
        uploader_id: v.uploader_id,
        uploader_name: v.uploader_name || "Member",
        created_at: v.created_at,
        // 🟢 FIX: Using apiBaseUrl to hit Express backend correctly
        thumbnail_url: `${apiBaseUrl}/api/thumbnail?chat_id=${v.chat_id}&message_id=${v.message_id}&sig=${sig}`
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
   SEARCH ENDPOINT
===================== */
app.get("/api/search", async (req, res) => {
  const { q } = req.query;
  
  if (!q || q.trim() === "") {
    return res.json({ videos: [] });
  }

  try {
    // 🟢 FIX 1: Define the API Base URL for thumbnails
    const apiBaseUrl = "https://videos.naijahomemade.com"; 

    // 🟢 FIX 2: Added LEFT JOIN to correctly search the user's username
    const searchQuery = `
      SELECT v.*, u.username as uploader_name 
      FROM videos v 
      LEFT JOIN users u ON v.uploader_id = u.user_id 
      WHERE v.caption ILIKE $1 OR u.username ILIKE $1 
      ORDER BY v.created_at DESC 
      LIMIT 20
    `;
    
    // The % symbols mean "find this word anywhere in the sentence"
    const { rows } = await pool.query(searchQuery, [`%${q}%`]);

    const formattedVideos = rows.map(v => {
      let thumbUrl = "";
      if (v.cloudflare_id && v.cloudflare_id !== "none") {
         const cleanId = v.cloudflare_id.split('?')[0];
         thumbUrl = `https://videodelivery.net/${cleanId}/thumbnails/thumbnail.jpg?time=1s&height=600`;
      } else {
         const sig = signThumbnail(v.chat_id, v.message_id); 
         thumbUrl = `${apiBaseUrl}/api/thumbnail?chat_id=${v.chat_id}&message_id=${v.message_id}&sig=${sig}`;
      }

      return {
        chat_id: v.chat_id,
        message_id: v.message_id,
        views: v.views,
        caption: v.caption,
        category: v.category,
        uploader_id: v.uploader_id,
        uploader_name: v.uploader_name || "Member",
        created_at: v.created_at,
        thumbnail_url: thumbUrl
      };
    });

    res.json({ videos: formattedVideos });
  } catch (error) {
    console.error("Search API Error:", error.message);
    res.status(500).json({ error: "Search failed" });
  }
});

/* =====================
   Video Details Helper (For Shared Links)
===================== */
app.get("/api/video/details", async (req, res) => {
  try {
    const { message_id } = req.query;
    if (!message_id) return res.status(400).json({ error: "Missing message_id" });

    const result = await pool.query(`
      SELECT v.chat_id, v.message_id, v.caption, v.views, v.uploader_id, u.username as uploader_name 
      FROM videos v 
      LEFT JOIN users u ON v.uploader_id = u.user_id 
      WHERE v.message_id = $1 LIMIT 1
    `, [message_id]);

    if (!result.rows.length) return res.status(404).json({ error: "Video not found" });

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error" });
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
      console.log(`Thumbnail ${fileName} not in R2, fetching from Telegram...`);
    }

    const dbRes = await pool.query("SELECT thumb_file_id FROM videos WHERE chat_id=$1 AND message_id=$2", [chat_id, message_id]);
    if (!dbRes.rows.length || !dbRes.rows[0].thumb_file_id) return res.status(204).end();

    const fileRes = await axios.get(`${TELEGRAM_API}/getFile`, { params: { file_id: dbRes.rows[0].thumb_file_id } });
    const imageRes = await axios.get(`${TELEGRAM_FILE_API}/${fileRes.data.result.file_path}`, { responseType: "arraybuffer" });
    const buffer = Buffer.from(imageRes.data);

    r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: "image/jpeg"
    })).catch(e => console.error("R2 Upload Failed:", e.message));

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
   Share Link (UPDATED FOR OPEN GRAPH)
===================== */
app.get('/v/:message_id', async (req, res) => {
  try {
    const { message_id } = req.params;
    
    const result = await pool.query(`
      SELECT v.*, u.username as uploader_name 
      FROM videos v 
      LEFT JOIN users u ON v.uploader_id = u.user_id 
      WHERE v.message_id = $1 LIMIT 1
    `, [message_id]);

    if (!result.rows.length) return res.redirect('https://naijahomemade.com');

    const video = result.rows[0];
    const sig = signThumbnail(video.chat_id, video.message_id);
    
    // 🟢 FIX: Point the SEO thumbnail to videos.naijahomemade.com
    const thumbUrl = video.cloudflare_id 
      ? `https://videodelivery.net/${video.cloudflare_id.split('?')[0]}/thumbnails/thumbnail.jpg?time=1s&height=600`
      : `https://videos.naijahomemade.com/api/thumbnail?chat_id=${video.chat_id}&message_id=${video.message_id}&sig=${sig}`;

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${video.caption || "Watch exclusive shots"}</title>
          <meta charset="utf-8">
          
          <meta property="og:type" content="video.other">
          <meta property="og:site_name" content="Naija Homemade">
          <meta property="og:title" content="${video.caption || "New Shot from @" + (video.uploader_name || "Member")}">
          <meta property="og:description" content="Watch high-quality homegrown shots on our platform.">
          <meta property="og:image" content="${thumbUrl}">
          <meta property="og:url" content="https://videos.naijahomemade.com/v/${message_id}">
          
          <meta name="twitter:card" content="summary_large_image">
          <meta name="twitter:title" content="${video.caption || "Watch Shot"}">
          <meta name="twitter:image" content="${thumbUrl}">

          <script>
            window.location.href = "https://naijahomemade.com/?v=${message_id}";
          </script>
        </head>
        <body style="background:#000; color:#fff; display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
          <p>Redirecting to Naija Homemade...</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Share Link Error:", err.message);
    res.redirect('https://naijahomemade.com');
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