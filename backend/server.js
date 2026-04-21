import "dotenv/config";
import express from "express";
import statusMonitor from "express-status-monitor";
import basicAuth from "express-basic-auth";
import axios from "axios";
import cors from "cors";
import fs from "fs";
import pkg from "pg";
import https from "https";
import crypto from "crypto";

// 🟢 JWT for securing interaction routes
import jwt from "jsonwebtoken";

import { exec } from "child_process";
import util from "util";
const execPromise = util.promisify(exec);

import path from "path";
import { fileURLToPath } from "url";

import prerender from "prerender-node";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; 
import adminRoutes from "./admin.js";
import authRoutes from "./auth.js";
import multer from "multer";
import { uploadDirectToStream } from "./controllers/upload_premium.js";
import { verifyPayment } from "./controllers/payment.js";
import { createCryptoPayment, cryptoWebhook, checkCryptoTransaction } from "./controllers/crypto.js";
import { z } from "zod"; 

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_USERS = [1881815190, 993163169, 5806906139, 5441995861];
const agent = new https.Agent({ family: 4 });

const app = express();
app.use(cors());
app.use(express.json());

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : ["http://localhost:5173"];
app.use(cors({
  origin: allowedOrigins
}));

/* =====================
   SERVER MONITORING (SECURED)
===================== */
app.use("/status", basicAuth({
  users: { 'admin': process.env.ADMIN_PASSWORD },
  challenge: true,
  unauthorizedResponse: 'Access Denied: Admins Only'
}));

app.use(statusMonitor({
  title: `${process.env.APP_NAME || 'Platform'} Server Status`,
  path: '/status',
  spans: [{ interval: 1, retention: 60 }, { interval: 5, retention: 60 }, { interval: 15, retention: 60 }]
}));

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing");

const TELEGRAM_API = `https://api.telegram.org/bot${BOT_TOKEN}`;
const TELEGRAM_FILE_API = `https://api.telegram.org/file/bot${BOT_TOKEN}`;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

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
        CREATE TABLE IF NOT EXISTS app_users (
          id SERIAL PRIMARY KEY,
          username VARCHAR(50) UNIQUE,
          email VARCHAR(255) UNIQUE NOT NULL,
          password_hash TEXT,
          avatar_url TEXT DEFAULT '/assets/default-avatar.png',
          role VARCHAR(20) DEFAULT 'user',
          created_at TIMESTAMP DEFAULT NOW(),
          settings JSONB DEFAULT '{}'::jsonb,
          google_id VARCHAR(255) UNIQUE,
          is_premium BOOLEAN DEFAULT FALSE
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
          cloudflare_id TEXT,
          status TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(chat_id, message_id)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          app_user_id INTEGER REFERENCES app_users(id),
          sender_name TEXT NOT NULL,
          expected_amount NUMERIC NOT NULL,
          status TEXT DEFAULT 'PENDING',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 🟢 NEW: Interaction Tables
      await pool.query(`
        CREATE TABLE IF NOT EXISTS likes (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE,
          message_id TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_id, message_id)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS saves (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE,
          message_id TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_id, message_id)
        )
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS comments (
          id SERIAL PRIMARY KEY,
          user_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE,
          message_id TEXT NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // 🟢 NEW: Fast access counters for the Video feed
      await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS likes_count BIGINT DEFAULT 0`);
      await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS comments_count BIGINT DEFAULT 0`);
      await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS shares_count BIGINT DEFAULT 0`);
      await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS saves_count BIGINT DEFAULT 0`);
      
      console.log("✅ Database initialized (Users, Videos, Transactions, & Interactions)");
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
   AUTH & ROUTES
===================== */
app.use("/api/auth", authRoutes);
app.use("/api/admin", adminRoutes);

app.post("/api/verify-payment", (req, res) => verifyPayment(req, res, pool));
app.post("/api/crypto/create", (req, res) => createCryptoPayment(req, res, pool));
app.post("/api/crypto/webhook", (req, res) => cryptoWebhook(req, res, pool));
app.get("/api/crypto/status/:order_id", (req, res) => checkCryptoTransaction(req, res, pool));

/* =====================
   HELPER: Upload Thumbnail to R2
===================== */
async function uploadThumbnailToR2(thumbFileId, chatId, messageId) {
  if (!thumbFileId) return null;
  try {
    const fileRes = await axios.get(`${TELEGRAM_API}/getFile`, { params: { file_id: thumbFileId } });
    const filePath = fileRes.data.result.file_path;
    const imageRes = await axios.get(`${TELEGRAM_FILE_API}/${filePath}`, { responseType: "arraybuffer" });
    const buffer = Buffer.from(imageRes.data);

    const key = `thumbs/${chatId}_${messageId}.jpg`;
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: "image/jpeg",
    }));

    return key;
  } catch (err) {
    return null;
  }
}

/* =====================
   Webhook
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
    else if (rawCaption.toLowerCase().includes("#premium")) category = "premium"; 
    else if (rawCaption.toLowerCase().includes("#hotties")) category = "hotties";

    let cleanCaption = rawCaption.replace(/#\w+/g, "").trim();

    const chatId = (message.forward_from_chat?.id ?? message.chat.id).toString();
    const messageId = (message.forward_from_message_id ?? message.message_id).toString();
    const mediaGroupId = message.media_group_id || null;

    if (mediaGroupId && !rawCaption) {
      const siblingRes = await pool.query(
        `SELECT category, caption FROM videos WHERE media_group_id = $1 LIMIT 1`,
        [mediaGroupId]
      );
      if (siblingRes.rows.length > 0) {
        category = siblingRes.rows[0].category;
        cleanCaption = siblingRes.rows[0].caption;
      }
    }
    
    const thumb = media.thumb || media.thumbs?.[0] || media.thumbnail || null;
    const thumbFileId = thumb?.file_id || null;

    if (thumbFileId) uploadThumbnailToR2(thumbFileId, chatId, messageId);

    await pool.query(
      `INSERT INTO videos (chat_id, message_id, file_id, thumb_file_id, uploader_id, category, caption, media_group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (chat_id, message_id) 
       DO UPDATE SET 
          thumb_file_id = EXCLUDED.thumb_file_id,
          category = EXCLUDED.category,
          caption = EXCLUDED.caption,
          uploader_id = EXCLUDED.uploader_id,
          media_group_id = EXCLUDED.media_group_id`,
      [chatId, messageId, media.file_id, thumbFileId, userId, category, cleanCaption, mediaGroupId]
    );

    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(200);
  }
});

/* =====================
   PREMIUM UPLOAD
===================== */
const upload = multer({ dest: "uploads/" }); 

app.post("/api/admin/upload-premium", upload.single("video"), async (req, res) => {
  try {
    const { caption, category, uploader_id, media_group_id, upload_target } = req.body; 
    const videoFile = req.file;

    if (!ALLOWED_USERS.includes(Number(uploader_id))) return res.status(403).json({ error: "Unauthorized" });
    if (!videoFile) return res.status(400).json({ error: "No video file provided" });

    let savedCloudflareId = "none";
    const safeCategory = category ? category.toLowerCase().trim() : "premium";
    const internalId = `${safeCategory}_${Date.now()}`;

    try {
      const thumbPath = `${videoFile.path}.jpg`;
      await execPromise(`ffmpeg -i ${videoFile.path} -ss 00:00:01.000 -vframes 1 -vf scale=400:-1 -q:v 5 ${thumbPath} -y`);
      const thumbBuffer = fs.readFileSync(thumbPath);
      await r2.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: `thumbs/internal_${internalId}.jpg`,
        Body: thumbBuffer,
        ContentType: "image/jpeg",
      }));
      fs.unlinkSync(thumbPath); 
    } catch (ffmpegErr) {}

    if (upload_target === "r2") {
      const fileStream = fs.createReadStream(videoFile.path);
      const extension = videoFile.originalname.split('.').pop() || "mp4";
      const r2Key = `${safeCategory}/${internalId}.${extension}`; 
      
      await r2.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: r2Key,
        Body: fileStream,
        ContentType: videoFile.mimetype || "video/mp4",
      }));
      savedCloudflareId = `r2:${r2Key}`;
    } else {
      const cfResult = await uploadDirectToStream(videoFile.path, { caption: caption || "Premium Content", category: safeCategory });
      savedCloudflareId = cfResult.uid;
    }

    await pool.query(
      `INSERT INTO videos (chat_id, message_id, file_id, uploader_id, category, caption, cloudflare_id, status, media_group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ready', $8)`,
      [ "internal", internalId, "none", uploader_id, safeCategory, caption, savedCloudflareId, media_group_id || null ]
    );

    fs.unlinkSync(videoFile.path);
    res.json({ success: true, videoId: savedCloudflareId, message_id: internalId });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* =====================
   api/video (Universal Handler)
===================== */
app.get("/api/video", async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const { chat_id, message_id } = req.query;
    if (!chat_id || !message_id) return res.status(400).json({ error: "Missing parameters" });

    const dbRes = await pool.query(
      `UPDATE videos SET views = views + 1 WHERE chat_id=$1 AND message_id=$2 RETURNING file_id, cloudflare_id`,
      [chat_id, message_id]
    );

    if (!dbRes.rows.length) return res.status(404).json({ error: "Video not found in database" });

    const video = dbRes.rows[0];

    if (video.cloudflare_id && video.cloudflare_id !== "none") {
      if (video.cloudflare_id.startsWith("r2:")) {
        const r2Key = video.cloudflare_id.replace("r2:", "");
        const publicDomain = process.env.R2_PUBLIC_DOMAIN || 'https://bucket.naijahomemade.com';
        return res.json({ video_url: `${publicDomain}/${r2Key}` });
      } else {
        const cleanId = video.cloudflare_id.split('?')[0];
        return res.json({ video_url: `https://videodelivery.net/${cleanId}/manifest/video.m3u8` });
      }
    }

    if (!video.file_id || video.file_id === "none") return res.status(400).json({ error: "No video source found" });

    const tgRes = await axios.get(`${TELEGRAM_API}/getFile`, { params: { file_id: video.file_id } });
    if (!tgRes.data?.result?.file_path) return res.status(404).json({ error: "Telegram could not find this file" });

    const filePath = tgRes.data.result.file_path;
    const { exp, sig } = signWorkerUrl(filePath);
    return res.json({ video_url: `${process.env.WORKER_BASE_URL}/?file_path=${encodeURIComponent(filePath)}&exp=${exp}&sig=${sig}` });
  } catch (err) {
    res.status(500).json({ error: "Playback failed", detail: err.message });
  }
});

/* =====================
   HELPER: Base Mapper 
===================== */
function signThumbnail(chatId, messageId) {
  const payload = `${chatId}:${messageId}`;
  return crypto.createHmac("sha256", process.env.SIGNING_SECRET).update(payload).digest("hex");
}

const mapVideoToResponse = (v, apiBaseUrl) => {
  let thumbnailUrl = "";
  if (v.cloudflare_id && v.cloudflare_id !== "none" && !v.cloudflare_id.startsWith("r2:")) {
      const cleanId = v.cloudflare_id.split('?')[0];
      thumbnailUrl = `https://videodelivery.net/${cleanId}/thumbnails/thumbnail.jpg?time=1s&height=600`;
  } else {
      const sig = signThumbnail(v.chat_id, v.message_id);
      thumbnailUrl = `${apiBaseUrl}/api/thumbnail?chat_id=${v.chat_id}&message_id=${v.message_id}&sig=${sig}`;
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
    thumbnail_url: thumbnailUrl,
    media_group_id: v.media_group_id || null,
    is_group: Number(v.group_count || 1) > 1, 
    group_count: Number(v.group_count || 1),
    // 🟢 NEW: Maps the counter values
    likes_count: Number(v.likes_count || 0),
    comments_count: Number(v.comments_count || 0),
    shares_count: Number(v.shares_count || 0),
    saves_count: Number(v.saves_count || 0)
  };
};

/* =====================
   List videos
===================== */
app.get("/api/videos", async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 12);
    const offset = (page - 1) * limit;
    const category = req.query.category || "hotties";
    const apiBaseUrl = process.env.API_BASE_URL;

    let query, queryValues;
    if (category === "trends") {
      query = `
        WITH GroupedVideos AS (
          SELECT v.*, u.username as uploader_name,
            ROW_NUMBER() OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END ORDER BY v.views DESC) as rn,
            COUNT(*) OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END) as group_count
          FROM videos v LEFT JOIN users u ON v.uploader_id = u.user_id
        )
        SELECT * FROM GroupedVideos WHERE rn = 1 ORDER BY views DESC LIMIT $1 OFFSET $2
      `;
      queryValues = [limit, offset];
    } else {
      query = `
        WITH GroupedVideos AS (
          SELECT v.*, u.username as uploader_name,
            ROW_NUMBER() OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END ORDER BY v.created_at ASC) as rn,
            COUNT(*) OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END) as group_count
          FROM videos v LEFT JOIN users u ON v.uploader_id = u.user_id
          WHERE category = $1
        )
        SELECT * FROM GroupedVideos WHERE rn = 1 ORDER BY created_at DESC LIMIT $2 OFFSET $3
      `;
      queryValues = [category, limit, offset];
    }

    const videosRes = await pool.query(query, queryValues);

    let suggestions = [];
    if (page === 1) {
      const suggestQuery = `
        SELECT v.*, u.username as uploader_name 
        FROM videos v LEFT JOIN users u ON v.uploader_id = u.user_id 
        ORDER BY RANDOM() LIMIT 10
      `;
      const suggestRes = await pool.query(suggestQuery);
      suggestions = suggestRes.rows;
    }

    const countQuery = category === "trends" 
      ? `SELECT COUNT(DISTINCT CASE WHEN media_group_id IS NOT NULL AND media_group_id != 'none' THEN media_group_id ELSE message_id END) FROM videos`
      : `SELECT COUNT(DISTINCT CASE WHEN media_group_id IS NOT NULL AND media_group_id != 'none' THEN media_group_id ELSE message_id END) FROM videos WHERE category = $1`;
    
    const countValues = category === "trends" ? [] : [category];
    const totalRes = await pool.query(countQuery, countValues);
    const total = Number(totalRes.rows[0].count);

    res.json({
      page, limit, total,
      videos: videosRes.rows.map(v => mapVideoToResponse(v, apiBaseUrl)),
      suggestions: suggestions.map(v => mapVideoToResponse(v, apiBaseUrl))
    });
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* =====================
   SEARCH ENDPOINT 
===================== */
const searchSchema = z.object({
  q: z.string().trim().max(100, "Search query is too long").optional().default(""), 
  page: z.coerce.number().int().positive().default(1), 
  limit: z.coerce.number().int().positive().max(50).default(12), 
});

app.get("/api/search", async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  const parsed = searchSchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error?.issues?.[0]?.message || "Invalid search" });
  const { q, page, limit } = parsed.data;

  try {
    const apiBaseUrl = process.env.API_BASE_URL; 
    const offset = (page - 1) * limit;

    const { rows } = await pool.query(`
      SELECT v.*, u.username as uploader_name 
      FROM videos v LEFT JOIN users u ON v.uploader_id = u.user_id 
      WHERE v.caption ILIKE $1 OR u.username ILIKE $1 
      ORDER BY v.created_at DESC LIMIT $2 OFFSET $3
    `, [`%${q}%`, limit, offset]);

    res.json({ 
      videos: rows.map(v => mapVideoToResponse(v, apiBaseUrl)),
      hasMore: rows.length === limit 
    });
  } catch (error) {
    res.status(500).json({ error: "Search failed" });
  }
});

/* =======================================================
   🟢 INTERACTION SUITE (LIKES, COMMENTS, SAVES, SHARES)
======================================================= */
const authenticateAppUser = (req, res, next) => {
  const authHeader = req.header("Authorization");
  if (!authHeader) return res.status(401).json({ error: "Access denied. Please log in." });
  
  const token = authHeader.split(" ")[1];
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(400).json({ error: "Invalid or expired token." });
  }
};

// 1. Check Personal State (Has the user liked or saved this?)
app.get("/api/interactions/state/:message_id", authenticateAppUser, async (req, res) => {
  try {
    const { message_id } = req.params;
    const user_id = req.user.id;
    
    const likeRes = await pool.query("SELECT 1 FROM likes WHERE user_id=$1 AND message_id=$2", [user_id, message_id]);
    const saveRes = await pool.query("SELECT 1 FROM saves WHERE user_id=$1 AND message_id=$2", [user_id, message_id]);
    
    res.json({
      isLiked: likeRes.rows.length > 0,
      isSaved: saveRes.rows.length > 0
    });
  } catch (err) {
    res.status(500).json({ error: "State fetch failed" });
  }
});

// 2. Toggle Like
app.post("/api/interactions/like", authenticateAppUser, async (req, res) => {
  try {
    const { message_id } = req.body;
    const user_id = req.user.id; 

    const existing = await pool.query("SELECT id FROM likes WHERE user_id=$1 AND message_id=$2", [user_id, message_id]);
    if (existing.rows.length > 0) {
      await pool.query("DELETE FROM likes WHERE id=$1", [existing.rows[0].id]);
      await pool.query("UPDATE videos SET likes_count = GREATEST(likes_count - 1, 0) WHERE message_id=$1", [message_id]);
      res.json({ liked: false });
    } else {
      await pool.query("INSERT INTO likes (user_id, message_id) VALUES ($1, $2)", [user_id, message_id]);
      await pool.query("UPDATE videos SET likes_count = likes_count + 1 WHERE message_id=$1", [message_id]);
      res.json({ liked: true });
    }
  } catch (err) {
    res.status(500).json({ error: "Like toggle failed" });
  }
});

// 3. Toggle Save (Bookmark)
app.post("/api/interactions/save", authenticateAppUser, async (req, res) => {
  try {
    const { message_id } = req.body;
    const user_id = req.user.id; 

    const existing = await pool.query("SELECT id FROM saves WHERE user_id=$1 AND message_id=$2", [user_id, message_id]);
    if (existing.rows.length > 0) {
      await pool.query("DELETE FROM saves WHERE id=$1", [existing.rows[0].id]);
      await pool.query("UPDATE videos SET saves_count = GREATEST(saves_count - 1, 0) WHERE message_id=$1", [message_id]);
      res.json({ saved: false });
    } else {
      await pool.query("INSERT INTO saves (user_id, message_id) VALUES ($1, $2)", [user_id, message_id]);
      await pool.query("UPDATE videos SET saves_count = saves_count + 1 WHERE message_id=$1", [message_id]);
      res.json({ saved: true });
    }
  } catch (err) {
    res.status(500).json({ error: "Save toggle failed" });
  }
});

// 4. Record Share (Public route, just bumps the counter)
app.post("/api/interactions/share", async (req, res) => {
  try {
    const { message_id } = req.body;
    await pool.query("UPDATE videos SET shares_count = shares_count + 1 WHERE message_id=$1", [message_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Share logging failed" });
  }
});

// 5. Post a Comment
app.post("/api/comments", authenticateAppUser, async (req, res) => {
  try {
    const { message_id, content } = req.body;
    const user_id = req.user.id;

    if (!content || !content.trim()) return res.status(400).json({ error: "Comment cannot be empty" });

    const result = await pool.query(
      "INSERT INTO comments (user_id, message_id, content) VALUES ($1, $2, $3) RETURNING *",
      [user_id, message_id, content.trim()]
    );
    await pool.query("UPDATE videos SET comments_count = comments_count + 1 WHERE message_id=$1", [message_id]);
    
    // Fetch the user's avatar to immediately append the comment on the frontend
    const user = await pool.query("SELECT username, avatar_url FROM app_users WHERE id=$1", [user_id]);
    
    res.json({ success: true, comment: { ...result.rows[0], ...user.rows[0] } });
  } catch (err) {
    res.status(500).json({ error: "Failed to post comment" });
  }
});

// 6. Fetch all Comments for a video
app.get("/api/comments/:message_id", async (req, res) => {
  try {
    const { message_id } = req.params;
    const { rows } = await pool.query(`
      SELECT c.id, c.content, c.created_at, u.username, u.avatar_url 
      FROM comments c
      JOIN app_users u ON c.user_id = u.id
      WHERE c.message_id = $1
      ORDER BY c.created_at DESC
    `, [message_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

/* =====================
   DYNAMIC SITEMAP.XML
===================== */
app.get('/sitemap.xml', async (req, res) => {
  try {
    const result = await pool.query(`SELECT message_id, created_at FROM videos ORDER BY created_at DESC LIMIT 5000`);
    const baseUrl = process.env.FRONTEND_URL || 'https://videos.naijahomemade.com';
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
    xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>hourly</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

    result.rows.forEach(video => {
      xml += `  <url>\n    <loc>${baseUrl}/v/${video.message_id}</loc>\n    <lastmod>${new Date(video.created_at).toISOString()}</lastmod>\n    <changefreq>never</changefreq>\n    <priority>0.8</priority>\n  </url>\n`;
    });

    xml += `</urlset>`;
    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) { res.status(500).end(); }
});

/* =======================================================
   🤖 PRERENDER MIDDLEWARE (SEO & EXOCLICK FIX)
======================================================= */
prerender.set('prerenderToken', process.env.PRERENDER_TOKEN);
prerender.crawlerUserAgents.push('ExoBot', 'exobot', 'TelegramBot', 'Twitterbot');
app.use(prerender);

/* =======================================================
   SERVE THE COMPILED FRONTEND
======================================================= */
app.use(express.static(path.join(__dirname, '../frontend/dist')));
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html')));

const PORT = process.env.PORT || 3000;
await initDatabase();
app.listen(PORT, () => console.log(`🚀 Server running on PORT ${PORT}`));