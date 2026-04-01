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
// Native imports needed for ES Modules to serve frontend files
import path from "path";
import { fileURLToPath } from "url";

// Import Prerender
import prerender from "prerender-node";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import adminRoutes from "./admin.js";
import authRoutes from "./auth.js";
import multer from "multer";
import { uploadDirectToStream } from "./controllers/upload_premium.js";
import { verifyPayment } from "./controllers/payment.js";
import { createCryptoPayment, cryptoWebhook, checkCryptoTransaction } from "./controllers/crypto.js";
import { z } from "zod"; 

const { Pool } = pkg;

// 🟢 NEW: ES Module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_USERS = [1881815190, 993163169, 5806906139, 5441995861];
const agent = new https.Agent({ family: 4 });

const app = express();
app.use(cors());
app.use(express.json());

// 🟢 THE FIX: Dynamic CORS derived from the .env file
const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : ["http://localhost:5173"];
app.use(cors({
  origin: allowedOrigins
}));

/* =====================
   SERVER MONITORING (SECURED)
===================== */
// 1. Lock down the /status route with a username and password
app.use("/status", basicAuth({
  users: { 'admin': process.env.ADMIN_PASSWORD }, // Change this password!
  challenge: true,
  unauthorizedResponse: 'Access Denied: Admins Only'
}));

// 2. Initialize the status monitor
app.use(statusMonitor({
  // 🟢 THE FIX: Dynamic App Name for Status Monitor
  title: `${process.env.APP_NAME || 'Platform'} Server Status`,
  path: '/status',
  spans: [{
    interval: 1,            // Every second
    retention: 60           // Keep 60 data points in memory
  }, {
    interval: 5,            // Every 5 seconds
    retention: 60
  }, {
    interval: 15,           // Every 15 seconds
    retention: 60
  }]
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
      // 1. Telegram Uploaders/Admins
      await pool.query(`
        CREATE TABLE IF NOT EXISTS users (
          user_id BIGINT PRIMARY KEY,
          username TEXT,
          full_name TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // 2. The Website Consumers (Matching your exact schema)
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
          google_id VARCHAR(255) UNIQUE
        )
      `);

      // 🟢 Safely inject the premium flag into your existing app_users table
      await pool.query(`
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
      `);

      // 3. The Video Content
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

      // 4. The Payment Ledger
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
      
      console.log("✅ Database initialized (Admins, App_Users, Videos & Transactions)");
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
   ADMIN CONTROL
===================== */
app.use("/api/admin", adminRoutes);

/* =====================
   PAYMENT & CRYPTO BRIDGES
===================== */
// 1. Bank Transfer AI Engine
app.post("/api/verify-payment", (req, res) => verifyPayment(req, res, pool));

// 2. NOWPayments Crypto Engine
app.post("/api/crypto/create", (req, res) => createCryptoPayment(req, res, pool));
app.post("/api/crypto/webhook", (req, res) => cryptoWebhook(req, res, pool));

// 3. Crypto Payment status check
app.get("/api/crypto/status/:order_id", (req, res) => checkCryptoTransaction(req, res, pool));

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
   Webhook (Updated with Album Inheritance & R2 Sync)
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
    else if (rawCaption.toLowerCase().includes("#premium")) category = "premium"; // 🟢 ADDED THIS
    else if (rawCaption.toLowerCase().includes("#hotties")) category = "hotties";

    let cleanCaption = rawCaption.replace(/#\w+/g, "").trim();

    const chatId = (message.forward_from_chat?.id ?? message.chat.id).toString();
    const messageId = (message.forward_from_message_id ?? message.message_id).toString();
    const mediaGroupId = message.media_group_id || null;

    // 🟢 THE FIX: Album Sibling Inheritance
    // If this video has no caption but belongs to a group, copy the caption/category from the first video in the DB!
    if (mediaGroupId && !rawCaption) {
      const siblingRes = await pool.query(
        `SELECT category, caption FROM videos WHERE media_group_id = $1 LIMIT 1`,
        [mediaGroupId]
      );
      if (siblingRes.rows.length > 0) {
        category = siblingRes.rows[0].category;
        cleanCaption = siblingRes.rows[0].caption;
        console.log(`🔗 Inherited category '${category}' for grouped video ${messageId}`);
      }
    }
    
    const thumb = media.thumb || media.thumbs?.[0] || media.thumbnail || null;
    const thumbFileId = thumb?.file_id || null;

    if (thumbFileId) {
      uploadThumbnailToR2(thumbFileId, chatId, messageId);
    }

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
    // 🟢 THE FIX: Extract media_group_id from the frontend request
    const { caption, category, uploader_id, media_group_id } = req.body; 
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
    
    // 🟢 THE FIX: Add media_group_id ($8) to the database insert
    await pool.query(
      `INSERT INTO videos (chat_id, message_id, file_id, uploader_id, category, caption, cloudflare_id, status, media_group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ready', $8)`,
      [
        "internal", 
        internalId, 
        "none", 
        uploader_id, 
        category || "premium", 
        caption, 
        cfResult.uid,
        media_group_id || null // Save the group ID if it exists, otherwise leave null
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

    // 🟢 THE FIX: Dynamic Worker Base URL
    const workerUrl = `${process.env.WORKER_BASE_URL}/?file_path=${encodeURIComponent(filePath)}&exp=${exp}&sig=${sig}`;
    
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
   HELPER: Base Mapper (Used by Videos, Suggestions & Groups)
===================== */
const mapVideoToResponse = (v, apiBaseUrl) => {
  let thumbnailUrl = "";
  if (v.cloudflare_id && v.cloudflare_id !== "none") {
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
    is_group: Number(v.group_count || 1) > 1, // 🟢 Triggers the folder icon on frontend
    group_count: Number(v.group_count || 1)
  };
};


/* =====================
   List videos (Lazy Loading Albums & Pagination Fix)
===================== */
app.get("/api/videos", async (req, res) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 12);
    const offset = (page - 1) * limit;
    const category = req.query.category || "hotties";
    
    // 🟢 THE FIX: Dynamic API Base URL
    const apiBaseUrl = process.env.API_BASE_URL;

    // 🟢 1. MAIN QUERY: Uses SQL Window Functions to pick exactly 1 "Cover" per album
    let query;
    let queryValues;

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

    // 🟢 2. SUGGESTIONS: Reverted to your original, blazing-fast simple query!
    let suggestions = [];
    if (page === 1) {
      const suggestQuery = `
        SELECT v.*, u.username as uploader_name 
        FROM videos v 
        LEFT JOIN users u ON v.uploader_id = u.user_id 
        ORDER BY RANDOM() LIMIT 10
      `;
      const suggestRes = await pool.query(suggestQuery);
      suggestions = suggestRes.rows;
    }

    // 🟢 3. TOTAL COUNT: Upgraded to count distinct groups so the frontend math is perfect!
    let countQuery;
    if (category === "trends") {
      countQuery = `SELECT COUNT(DISTINCT CASE WHEN media_group_id IS NOT NULL AND media_group_id != 'none' THEN media_group_id ELSE message_id END) FROM videos`;
    } else {
      countQuery = `SELECT COUNT(DISTINCT CASE WHEN media_group_id IS NOT NULL AND media_group_id != 'none' THEN media_group_id ELSE message_id END) FROM videos WHERE category = $1`;
    }
    
    const countValues = category === "trends" ? [] : [category];
    const totalRes = await pool.query(countQuery, countValues);
    const total = Number(totalRes.rows[0].count);

    // No more manual JS bundling! Just map the raw SQL outputs cleanly.
    res.json({
      page,
      limit,
      total,
      videos: videosRes.rows.map(v => mapVideoToResponse(v, apiBaseUrl)),
      suggestions: suggestions.map(v => mapVideoToResponse(v, apiBaseUrl))
    });
  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* =====================
   NEW: Fetch Album Contents via Lazy Load
===================== */
app.get("/api/group", async (req, res) => {
  try {
    const { media_group_id } = req.query;
    if (!media_group_id || media_group_id === 'none') return res.status(400).json({error: "Invalid group"});
    
    const query = `
      SELECT v.*, u.username as uploader_name 
      FROM videos v 
      LEFT JOIN users u ON v.uploader_id = u.user_id 
      WHERE v.media_group_id = $1 
      ORDER BY v.created_at ASC
    `;
    const { rows } = await pool.query(query, [media_group_id]);
    
    // 🟢 THE FIX: Dynamic API Base URL
    const apiBaseUrl = process.env.API_BASE_URL;
    
    // Map them as normal, standalone videos so they play immediately inside the group view
    res.json(rows.map(v => ({ 
      ...mapVideoToResponse(v, apiBaseUrl), 
      is_group: false 
    })));
  } catch (err) {
    console.error("Group fetch error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/* =====================
   SEARCH ENDPOINT (PAGINATED & VALIDATED)
===================== */

// 🟢 1. Define strict validation rules for the query parameters
const searchSchema = z.object({
  q: z.string().trim().max(100, "Search query is too long").optional().default(""), // Caps at 100 chars
  page: z.coerce.number().int().positive().default(1), // Forces into a positive whole number
  limit: z.coerce.number().int().positive().max(50).default(12), // Caps limit at 50 to prevent DB DoS attacks
});

app.get("/api/search", async (req, res) => {
  // 🟢 2. Pass incoming query through Zod
  const parsed = searchSchema.safeParse(req.query);
  
  if (!parsed.success) {
    // 🟢 FIX: Safely extract the error message using optional chaining to prevent undefined crashes
    const errorMessage = parsed.error?.issues?.[0]?.message || "Invalid search parameters";
    return res.status(400).json({ error: errorMessage });
  }

  // 🟢 3. Extract the safely parsed and coerced variables
  const { q, page, limit } = parsed.data;


  try {
    // 🟢 THE FIX: Dynamic API Base URL
    const apiBaseUrl = process.env.API_BASE_URL; 
    
    // 🟢 4. Safely calculate offset without needing Number() casting
    const offset = (page - 1) * limit;

    const searchQuery = `
      SELECT v.*, u.username as uploader_name 
      FROM videos v 
      LEFT JOIN users u ON v.uploader_id = u.user_id 
      WHERE v.caption ILIKE $1 OR u.username ILIKE $1 
      ORDER BY v.created_at DESC 
      LIMIT $2 OFFSET $3
    `;
    
    const { rows } = await pool.query(searchQuery, [`%${q}%`, limit, offset]);

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

    // 🟢 5. Return hasMore safely using the validated limit number
    res.json({ 
      videos: formattedVideos,
      hasMore: formattedVideos.length === limit 
    });
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
   Share Link (UPDATED FOR OPEN GRAPH PORTRAIT FIX)
===================== */
app.get('/v/:message_id', async (req, res) => {
  try {
    const { message_id } = req.params;
    
    // 🟢 THE FIX: Fetch Frontend and App Name strings from config
    const frontendUrl = process.env.FRONTEND_URL;
    const appName = process.env.APP_NAME || "App";
    
    const result = await pool.query(`
      SELECT v.*, u.username as uploader_name 
      FROM videos v 
      LEFT JOIN users u ON v.uploader_id = u.user_id 
      WHERE v.message_id = $1 LIMIT 1
    `, [message_id]);

    if (!result.rows.length) return res.redirect(frontendUrl);

    const video = result.rows[0];
    const sig = signThumbnail(video.chat_id, video.message_id);
    
    // 🟢 FIX: We increase the height request to 1280 to ensure crisp portrait quality
    const thumbUrl = video.cloudflare_id 
      ? `https://videodelivery.net/${video.cloudflare_id.split('?')[0]}/thumbnails/thumbnail.jpg?time=1s&height=1280`
      : `${process.env.API_BASE_URL}/api/thumbnail?chat_id=${video.chat_id}&message_id=${video.message_id}&sig=${sig}`;

    res.send(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${video.caption || "Watch exclusive shots"}</title>
          <meta charset="utf-8">
          
          <meta property="og:type" content="video.other">
          <meta property="og:site_name" content="${appName}">
          <meta property="og:title" content="${video.caption || "New Shot from @" + (video.uploader_name || "Member")}">
          <meta property="og:description" content="Watch high-quality homegrown shots on our platform.">
          <meta property="og:image" content="${thumbUrl}">
          
          <meta property="og:image:width" content="720">
          <meta property="og:image:height" content="1280">
          
          <meta property="og:url" content="${process.env.API_BASE_URL}/v/${message_id}">
          
          <meta name="twitter:card" content="summary_large_image">
          <meta name="twitter:title" content="${video.caption || "Watch Shot"}">
          <meta name="twitter:image" content="${thumbUrl}">

          <script>
            window.location.href = "${frontendUrl}/?v=${message_id}";
          </script>
        </head>
        <body style="background:#000; color:#fff; display:flex; align-items:center; justify-content:center; height:100vh; font-family:sans-serif;">
          <p>Redirecting to ${appName}...</p>
        </body>
      </html>
    `);
  } catch (err) {
    console.error("Share Link Error:", err.message);
    res.redirect(process.env.FRONTEND_URL);
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

/* =======================================================
   🤖 PRERENDER MIDDLEWARE (SEO & EXOCLICK FIX)
======================================================= */
prerender.set('prerenderToken', process.env.PRERENDER_TOKEN);
prerender.crawlerUserAgents.push('ExoBot');
prerender.crawlerUserAgents.push('exobot');
prerender.crawlerUserAgents.push('TelegramBot');
prerender.crawlerUserAgents.push('Twitterbot');

// Mount Prerender ONLY after all API and /v/ routes have been checked
app.use(prerender);

/* =======================================================
   🟢 NEW: SERVE THE COMPILED FRONTEND (React/Vue/Vite)
======================================================= */
// 1. Serve all static files (JS, CSS, Images) from your external frontend folder
app.use(express.static(path.join(__dirname, '../frontend/dist')));

// 2. The SPA Catch-All Route: Any non-API request gets sent your index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

const PORT = process.env.PORT || 3000;
await initDatabase();
app.listen(PORT, () => console.log(`🚀 Server running on PORT ${PORT}`));