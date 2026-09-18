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

// 🟢 NEW: Imports for FFmpeg thumbnail extraction & JWT
import { exec } from "child_process";
import util from "util";
import jwt from "jsonwebtoken";
const execPromise = util.promisify(exec);

// Native imports needed for ES Modules to serve frontend files
import path from "path";
import { fileURLToPath } from "url";

// Import Prerender
import prerender from "prerender-node";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; 
import adminRoutes, { syncTelegramCreators, migrateLegacyVipToCreator } from "./admin.js";
import authRoutes, { authenticateToken, JWT_SECRET } from "./auth.js";
import creatorRoutes from "./creator.js";
import pool from "./db.js";
import multer from "multer";
import { uploadDirectToStream } from "./controllers/upload_premium.js";
import { verifyPayment } from "./controllers/payment.js";
import { createCryptoPayment, cryptoWebhook, checkCryptoTransaction } from "./controllers/crypto.js";
import { z } from "zod"; 
import cron from "node-cron";

// 🟢 FIX: Catch unhandled promises and exceptions to stop PM2 crash loops
process.on('uncaughtException', (err) => {
  console.error('🔥 Uncaught Exception:', err.message);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🔥 Unhandled Rejection at:', promise, 'reason:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API_SECRETS = [
  process.env.SIGNING_SECRET,
  process.env.JWT_SECRET,
  process.env.ADMIN_PASSWORD
].filter(Boolean);
const agent = new https.Agent({ family: 4 });

const app = express();
app.use(cors());
app.use(express.json());

const allowedOrigins = process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(",") : ["http://localhost:5173"];
app.use(cors({
  origin: allowedOrigins
}));

/* =======================================================
   🟢 SEO MIDDLEWARE: CANONICALIZATION & DE-INDEXING
======================================================= */
app.use((req, res, next) => {
  // 1. Prevent Google from indexing Legal/Admin query parameters
  if (req.query.legal || req.path.includes('/legal') || req.path.includes('/admin')) {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }

  // 2. Force Canonical URLs: 301 Redirect /?v=123 to /v/123
  // This consolidates all ranking power to a single clean URL structure
  if (req.query.v && req.path === '/') {
    return res.redirect(301, `/v/${req.query.v}`);
  }

  next();
});

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
          google_id VARCHAR(255) UNIQUE
        )
      `);

      await pool.query(`
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_creator BOOLEAN DEFAULT FALSE;
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_managed BOOLEAN DEFAULT FALSE;
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS telegram_user_id BIGINT UNIQUE;
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS source_channel TEXT;
        ALTER TABLE app_users ALTER COLUMN email DROP NOT NULL;
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS display_name TEXT;
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS creator_bio TEXT;
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS banner_url TEXT DEFAULT 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80';
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS creator_category TEXT DEFAULT 'Creator';
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS subscription_price NUMERIC DEFAULT 0;
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS website TEXT DEFAULT '';
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS creator_subscriptions (
          id SERIAL PRIMARY KEY,
          subscriber_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE,
          creator_id BIGINT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(subscriber_id, creator_id)
        );
        ALTER TABLE creator_subscriptions DROP CONSTRAINT IF EXISTS creator_subscriptions_creator_id_fkey;
        ALTER TABLE creator_subscriptions ALTER COLUMN creator_id TYPE BIGINT;
        ALTER TABLE creator_subscriptions ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP;
        ALTER TABLE creator_subscriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
        ALTER TABLE creator_subscriptions ADD COLUMN IF NOT EXISTS amount_paid NUMERIC DEFAULT 0;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS creator_tips (
          id SERIAL PRIMARY KEY,
          sender_id INTEGER REFERENCES app_users(id) ON DELETE SET NULL,
          creator_id BIGINT NOT NULL,
          amount NUMERIC NOT NULL,
          message TEXT,
          created_at TIMESTAMP DEFAULT NOW()
        );
        ALTER TABLE creator_tips DROP CONSTRAINT IF EXISTS creator_tips_creator_id_fkey;
        ALTER TABLE creator_tips ALTER COLUMN creator_id TYPE BIGINT;
      `);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS creator_follows (
          id SERIAL PRIMARY KEY,
          follower_id INTEGER REFERENCES app_users(id) ON DELETE CASCADE,
          creator_id BIGINT NOT NULL,
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(follower_id, creator_id)
        );
        ALTER TABLE creator_follows DROP CONSTRAINT IF EXISTS creator_follows_creator_id_fkey;
        ALTER TABLE creator_follows ALTER COLUMN creator_id TYPE BIGINT;
        CREATE INDEX IF NOT EXISTS idx_follows_creator ON creator_follows(creator_id);
        CREATE INDEX IF NOT EXISTS idx_follows_follower ON creator_follows(follower_id);
      `);

      await pool.query(`
        CREATE INDEX IF NOT EXISTS idx_subscriptions_creator ON creator_subscriptions(creator_id);
        CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON creator_subscriptions(subscriber_id);
        CREATE INDEX IF NOT EXISTS idx_tips_creator ON creator_tips(creator_id);
        CREATE INDEX IF NOT EXISTS idx_app_users_lower_username ON app_users(LOWER(username));
        CREATE INDEX IF NOT EXISTS idx_app_users_telegram_user_id ON app_users(telegram_user_id);
        CREATE INDEX IF NOT EXISTS idx_app_users_is_managed ON app_users(is_managed);

        UPDATE app_users 
        SET subscription_price = CASE 
          WHEN subscription_price >= 1000 THEN ROUND(subscription_price / 1000)
          WHEN subscription_price >= 100 THEN ROUND(subscription_price / 100)
          ELSE subscription_price 
        END 
        WHERE subscription_price >= 100;

        UPDATE creator_subscriptions 
        SET amount_paid = CASE 
          WHEN amount_paid >= 1000 THEN ROUND(amount_paid / 1000)
          WHEN amount_paid >= 100 THEN ROUND(amount_paid / 100)
          ELSE amount_paid 
        END 
        WHERE amount_paid >= 100;

        UPDATE creator_tips 
        SET amount = CASE 
          WHEN amount >= 1000 THEN ROUND(amount / 1000)
          WHEN amount >= 100 THEN ROUND(amount / 100)
          ELSE amount 
        END 
        WHERE amount >= 100;
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

      await pool.query(`ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_uploader_id_fkey;`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          app_user_id INTEGER REFERENCES app_users(id),
          sender_name TEXT NOT NULL,
          expected_amount NUMERIC NOT NULL,
          status TEXT DEFAULT 'PENDING',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS transaction_type TEXT DEFAULT 'premium';
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS creator_id BIGINT;
        ALTER TABLE transactions ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
        CREATE INDEX IF NOT EXISTS idx_transactions_creator_id ON transactions(creator_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
      `);

      // Interaction Tables & Counters
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

      await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS likes_count BIGINT DEFAULT 0`);
      await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS comments_count BIGINT DEFAULT 0`);
      await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS shares_count BIGINT DEFAULT 0`);
      await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS saves_count BIGINT DEFAULT 0`);
      await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS seo_description TEXT`);
      await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS media_group_id TEXT`);
      
      console.log("✅ Database initialized (Admins, App_Users, Videos, Transactions & Interactions)");

      // Auto-sync Telegram uploaders as managed creators in app_users
      try {
        await syncTelegramCreators(pool);
      } catch (sErr) {
        console.warn("⚠️ [STARTUP] Telegram creators sync notice:", sErr.message);
      }
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
app.use("/api/creator", creatorRoutes);
app.use("/api/creators", creatorRoutes);

app.post("/api/verify-payment", authenticateToken, (req, res) => verifyPayment(req, res, pool));
app.post("/api/crypto/create", authenticateToken, (req, res) => createCryptoPayment(req, res, pool));
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

    console.log(`✅ Webhook: Thumbnail saved to R2 -> ${key}`);
    return key;
  } catch (err) {
    const errorDetail = err.response?.data?.description || err.message;
    console.error(`❌ Webhook Thumbnail Sync Failed: ${errorDetail}`);
    return null;
  }
}

/* =====================
   Webhook (Legacy - Deprecated)
===================== */
app.post("/webhook", (req, res) => {
  // Webhook video ingestion deprecated in favor of API upload engine
  res.sendStatus(200);
});

/* =====================
   PREMIUM UPLOAD (STREAM & R2 THUMBNAIL SUPPORT)
===================== */
const upload = multer({ dest: "uploads/" }); 

app.post("/api/admin/upload-premium", upload.single("video"), async (req, res) => {
  try {
    const { 
      caption, 
      category, 
      uploader_id, 
      media_group_id, 
      upload_target,
      creator_username,
      creator_display_name,
      creator_name 
    } = req.body; 
    const videoFile = req.file;

    // Verify authorization:
    // 1. JWT Bearer token with admin role
    let isAuthorized = false;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded) {
          if (decoded.role === 'admin') {
            isAuthorized = true;
          } else if (decoded.id) {
            const adminCheck = await pool.query("SELECT role FROM app_users WHERE id = $1", [decoded.id]);
            if (adminCheck.rows.length > 0 && adminCheck.rows[0].role === 'admin') {
              isAuthorized = true;
            }
          }
        }
      } catch (e) {}
    }

    // 2. OR API Key / Secret in headers or body
    const apiKey = req.headers['x-api-key'] || req.headers['x-api-secret'] || req.body.api_key;
    if (!isAuthorized && apiKey && API_SECRETS.includes(apiKey)) {
      isAuthorized = true;
    }

    if (!isAuthorized) {
      if (videoFile && fs.existsSync(videoFile.path)) {
        fs.unlinkSync(videoFile.path);
      }
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!videoFile) return res.status(400).json({ error: "No video file provided" });

    // Handle uploader ID (channel ID, user ID, or fallback)
    const numericUploaderId = uploader_id ? Number(uploader_id) : null;
    const finalUploaderId = numericUploaderId || (req.body.admin_id ? Number(req.body.admin_id) : null) || 1881815190;

    const safeCategory = category ? category.toLowerCase().trim() : "premium";
    const cleanIdStr = String(finalUploaderId).replace('-', '');
    const isChannel = finalUploaderId < 0;
    const defaultUsername = (safeCategory === "premium" && !isChannel) ? "naijahomemade" : `tg_${cleanIdStr}`;
    const defaultDisplayName = (safeCategory === "premium" && !isChannel) ? "Naija Homemade Series" : (isChannel ? `Channel ${cleanIdStr}` : `Creator ${finalUploaderId}`);
    const targetUsername = creator_username 
      ? String(creator_username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
      : defaultUsername;
    const targetDisplayName = creator_display_name || creator_name || defaultDisplayName;

    // Ensure uploader exists in users table to satisfy foreign key constraint or legacy queries
    await pool.query(
      `INSERT INTO users (user_id, username, full_name)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id) DO UPDATE 
       SET username = COALESCE(EXCLUDED.username, users.username),
           full_name = COALESCE(EXCLUDED.full_name, users.full_name)`,
      [finalUploaderId, targetUsername, targetDisplayName]
    );

    // Auto-upsert into app_users as managed creator
    try {
      const existingTg = await pool.query(
        "SELECT id, username FROM app_users WHERE telegram_user_id = $1 OR (username IS NOT NULL AND LOWER(username) = LOWER($2))",
        [finalUploaderId, targetUsername]
      );
      if (existingTg.rows.length === 0) {
        const uCheck = await pool.query("SELECT id FROM app_users WHERE LOWER(username) = LOWER($1)", [targetUsername]);
        const safeUname = uCheck.rows.length > 0 ? `${targetUsername}_${cleanIdStr.slice(-4)}` : targetUsername;
        await pool.query(
          `INSERT INTO app_users (
             username, display_name, email, is_creator, is_managed, 
             telegram_user_id, creator_category, subscription_price, is_verified, 
             banner_url, creator_bio, avatar_url
           ) VALUES ($1, $2, $3, TRUE, TRUE, $4, $5, 15, TRUE, 
             'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80',
             'Official creator channel. Catch all exclusive drops and daily previews here.',
             $6
           )
           ON CONFLICT (telegram_user_id) DO UPDATE 
           SET is_creator = TRUE, is_managed = TRUE`,
          [safeUname, targetDisplayName, `tg_${cleanIdStr}@internal.naijahomemade.com`, finalUploaderId, safeCategory, `/api/avatar?user_id=${finalUploaderId}`]
        );
      } else {
        await pool.query(
          "UPDATE app_users SET is_creator = TRUE, is_managed = TRUE, telegram_user_id = COALESCE(telegram_user_id, $1) WHERE id = $2",
          [finalUploaderId, existingTg.rows[0].id]
        );
      }
    } catch (mErr) {
      console.warn("[UPLOAD-PREMIUM] Managed creator upsert notice:", mErr.message);
    }

    let savedCloudflareId = "none";
    const internalId = `${safeCategory}_${Date.now()}`;

    // 🟢 Trimming / Clipping Feature (Beginning, Center, Ending)
    const trimMode = (req.body.trim_mode || req.query.trim_mode || "full").toLowerCase().trim();
    const reqTrimDuration = parseFloat(req.body.trim_duration || req.query.trim_duration || 0);
    const reqTrimStart = parseFloat(req.body.trim_start || req.query.trim_start);

    if (trimMode && trimMode !== "full" && videoFile && fs.existsSync(videoFile.path)) {
      try {
        const { stdout } = await execPromise(
          `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoFile.path}"`
        );
        const totalDuration = parseFloat(stdout.trim()) || 0;
        console.log(`[TRIM] Total video duration: ${totalDuration}s, mode: ${trimMode}, requested duration: ${reqTrimDuration}s`);

        if (totalDuration > 0) {
          const clipDuration = (reqTrimDuration > 0 && reqTrimDuration < totalDuration)
            ? reqTrimDuration
            : Math.min(totalDuration, 30);

          let startSec = 0;
          if (!isNaN(reqTrimStart) && reqTrimStart >= 0) {
            startSec = Math.min(Math.max(0, reqTrimStart), Math.max(0, totalDuration - clipDuration));
          } else if (trimMode === "beginning") {
            startSec = 0;
          } else if (trimMode === "center" || trimMode === "middle") {
            startSec = Math.max(0, (totalDuration - clipDuration) / 2);
          } else if (trimMode === "ending" || trimMode === "end") {
            startSec = Math.max(0, totalDuration - clipDuration);
          }

          const trimmedPath = `${videoFile.path}_trimmed.mp4`;
          console.log(`[TRIM] Slicing video: start=${startSec.toFixed(2)}s, duration=${clipDuration.toFixed(2)}s`);

          await execPromise(
            `ffmpeg -ss ${startSec} -i "${videoFile.path}" -t ${clipDuration} -map 0:v -map 0:a? -c:v libx264 -preset ultrafast -crf 22 -c:a aac -b:a 128k -movflags +faststart "${trimmedPath}" -y`
          );

          if (fs.existsSync(trimmedPath)) {
            fs.unlinkSync(videoFile.path);
            fs.renameSync(trimmedPath, videoFile.path);
            console.log(`✅ [TRIM] Video successfully trimmed to ${clipDuration.toFixed(2)}s!`);
          }
        }
      } catch (trimErr) {
        console.error("⚠️ [TRIM] Video trimming failed, keeping original:", trimErr.message);
      }
    }

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
      console.log(`🖼️ R2 Thumbnail successfully generated: thumbs/internal_${internalId}.jpg`);
    } catch (ffmpegErr) {
      console.error("⚠️ FFmpeg thumbnail extraction failed:", ffmpegErr.message);
    }

    const useR2 = !upload_target || upload_target === "r2";
    if (useR2) {
      const fileStream = fs.createReadStream(videoFile.path);
      const extension = (trimMode && trimMode !== "full") 
        ? "mp4" 
        : (videoFile.originalname?.split('.').pop() || "mp4");
      const r2Key = `${safeCategory}/${internalId}.${extension}`; 
      
      await r2.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: r2Key,
        Body: fileStream,
        ContentType: videoFile.mimetype || "video/mp4",
      }));
      
      savedCloudflareId = `r2:${r2Key}`;
    } else {
      const cfResult = await uploadDirectToStream(videoFile.path, {
        caption: caption || "Premium Content",
        category: safeCategory
      });
      savedCloudflareId = cfResult.uid;
    }

    await pool.query(
      `INSERT INTO videos (chat_id, message_id, file_id, uploader_id, category, caption, cloudflare_id, status, media_group_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ready', $8)`,
      [
        "internal", 
        internalId, 
        "none", 
        finalUploaderId, 
        safeCategory, 
        caption, 
        savedCloudflareId,
        media_group_id || null 
      ]
    );

    fs.unlinkSync(videoFile.path);

    res.json({ 
      success: true, 
      videoId: savedCloudflareId,
      message_id: internalId 
    });
  } catch (err) {
    console.error("Admin Upload Error:", err.message);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
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

    const shouldCountView = req.query.noview !== "1";
    let dbRes;
    if (shouldCountView) {
      dbRes = await pool.query(
        `UPDATE videos SET views = views + 1 
         WHERE chat_id=$1 AND message_id=$2 
         RETURNING file_id, cloudflare_id, category, uploader_id`,
        [chat_id, message_id]
      );
    } else {
      dbRes = await pool.query(
        `SELECT file_id, cloudflare_id, category, uploader_id FROM videos 
         WHERE chat_id=$1 AND message_id=$2`,
        [chat_id, message_id]
      );
    }

    if (!dbRes.rows.length) {
      return res.status(404).json({ error: "Video not found in database" });
    }

    const video = dbRes.rows[0];

    // 🟢 ACCESS CONTROL: Protect Premium Videos from unauthorized access & direct scraping
    if (video.category === "premium") {
      let isAuthorized = false;
      const authHeader = req.headers["authorization"];
      const token = authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;

      if (token) {
        try {
          const decoded = jwt.verify(token, JWT_SECRET);
          const userId = decoded.id;
          const userRole = decoded.role;

          if (userRole === "admin") {
            isAuthorized = true;
          } else {
            const uploaderId = video.uploader_id ? String(video.uploader_id) : null;
            if (uploaderId && (String(userId) === uploaderId || String(decoded.telegram_user_id) === uploaderId)) {
              isAuthorized = true;
            } else {
              const subCheck = await pool.query(
                `SELECT 1 FROM creator_subscriptions cs
                 WHERE cs.subscriber_id = $1 
                   AND (
                     cs.creator_id = $2 
                     OR cs.creator_id IN (SELECT id FROM app_users WHERE telegram_user_id = $2)
                     OR cs.creator_id IN (SELECT id FROM app_users WHERE id = $2)
                   )
                   AND cs.status = 'active'
                   AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
                 LIMIT 1`,
                [userId, video.uploader_id]
              );
              if (subCheck.rows.length > 0) {
                isAuthorized = true;
              } else {
                const userRes = await pool.query("SELECT is_premium FROM app_users WHERE id = $1", [userId]);
                if (userRes.rows[0]?.is_premium && (!video.uploader_id || String(video.uploader_id) === "1881815190" || String(video.uploader_id) === "458")) {
                  isAuthorized = true;
                }
              }
            }
          }
        } catch (jwtErr) {
          console.warn("[AUTH] Token validation failed on premium video access:", jwtErr.message);
        }
      }

      if (!isAuthorized) {
        return res.status(403).json({ error: "Access denied. Active subscription required to watch this video." });
      }
    }

    if (video.cloudflare_id && video.cloudflare_id !== "none") {
      if (video.cloudflare_id.startsWith("r2:")) {
        const r2Key = video.cloudflare_id.replace("r2:", "");
        
        const publicDomain = process.env.R2_PUBLIC_DOMAIN || 'https://bucket.naijahomemade.com';
        const staticUrl = `${publicDomain}/${r2Key}`;
        
        return res.json({ video_url: staticUrl });
      } else {
        const cleanId = video.cloudflare_id.split('?')[0];
        const video_url = `https://videodelivery.net/${cleanId}/manifest/video.m3u8`;
        return res.json({ video_url });
      }
    }

    if (!video.file_id || video.file_id === "none") {
       return res.status(400).json({ error: "No video source (Telegram or Cloudflare) found" });
    }

    const tgRes = await axios.get(`${TELEGRAM_API}/getFile`, { 
      params: { file_id: video.file_id } 
    });

    if (!tgRes.data?.result?.file_path) {
      return res.status(404).json({ error: "Telegram could not find this file" });
    }

    const filePath = tgRes.data.result.file_path;
    const { exp, sig } = signWorkerUrl(filePath);

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
   HELPER: SEO template cache + escaping
===================== */
const INDEX_PATH = path.join(__dirname, '../frontend/dist', 'index.html');
let templateCache = { html: null, mtimeMs: 0 };

function getTemplate() {
  const stat = fs.statSync(INDEX_PATH);
  if (!templateCache.html || stat.mtimeMs !== templateCache.mtimeMs) {
    templateCache = { html: fs.readFileSync(INDEX_PATH, 'utf8'), mtimeMs: stat.mtimeMs };
  }
  return templateCache.html;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeXml(unsafe = '') {
  return String(unsafe)
    .replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD]/gu, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function safeJsonForScriptTag(obj) {
  return JSON.stringify(obj).replace(/</g, '\\u003c');
}

function stripDefaultSeoTags(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<link[^>]+rel=["']canonical["'][^>]*>/gi, '')
    .replace(/<meta[^>]+name=["'](description|robots|twitter:[^"']+)["'][^>]*>/gi, '')
    .replace(/<meta[^>]+property=["'](og:[^"']+)["'][^>]*>/gi, '')
    .replace(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi, '');
}

function buildSeoTags({ pageTitle, description, thumbUrl, canonicalUrl, appName, schema, videoUrl, isVideo = true, robots = 'index, follow, max-image-preview:large, max-video-preview:-1' }) {
  const title = escapeHtml(pageTitle);
  const desc = escapeHtml(description);
  const escapedThumb = escapeHtml(thumbUrl);
  const escapedCanonical = escapeHtml(canonicalUrl);
  const escapedAppName = escapeHtml(appName);
  const escapedRobots = escapeHtml(robots);

  let extraVideoTags = '';
  if (isVideo && videoUrl) {
    const escapedVideo = escapeHtml(videoUrl);
    extraVideoTags = `
    <meta property="og:video" content="${escapedVideo}">
    <meta property="og:video:secure_url" content="${escapedVideo}">
    <meta property="og:video:type" content="text/html">
    <meta property="og:video:width" content="1080">
    <meta property="og:video:height" content="1920">
    <meta name="twitter:card" content="player">
    <meta name="twitter:player" content="${escapedVideo}">
    <meta name="twitter:player:width" content="1080">
    <meta name="twitter:player:height" content="1920">`;
  } else {
    extraVideoTags = `
    <meta name="twitter:card" content="summary_large_image">`;
  }

  return `
    <title>${title}</title>
    <meta name="description" content="${desc}">
    <meta name="robots" content="${escapedRobots}">
    <link rel="canonical" href="${escapedCanonical}" />
    <meta property="og:locale" content="en_US">
    <meta property="og:type" content="${isVideo ? 'video.other' : 'website'}">
    <meta property="og:site_name" content="${escapedAppName}">
    <meta property="og:title" content="${title}">
    <meta property="og:description" content="${desc}">
    <meta property="og:image" content="${escapedThumb}">
    <meta property="og:url" content="${escapedCanonical}">
    ${extraVideoTags}
    <meta name="twitter:title" content="${title}">
    <meta name="twitter:description" content="${desc}">
    <meta name="twitter:image" content="${escapedThumb}">
    <script type="application/ld+json">${safeJsonForScriptTag(schema)}</script>
  </head>`;
}

/* =====================
   Share Link & SEO Injector
===================== */
app.get('/v/:message_id', async (req, res) => {
  try {
    const { message_id } = req.params;
    const frontendUrl = process.env.FRONTEND_URL || 'https://videos.naijahomemade.com';
    const appName = process.env.APP_NAME || 'NaijaHomemade';

    const result = await pool.query(`
      SELECT v.*, u.username as uploader_name
      FROM videos v
      LEFT JOIN users u ON v.uploader_id = u.user_id
      WHERE v.message_id = $1 LIMIT 1
    `, [message_id]);

    if (!result.rows.length) return res.redirect(302, '/');

    const video = result.rows[0];
    const isPremium = video.category === 'premium';
    const robots = isPremium
      ? 'noindex, follow'
      : 'index, follow, max-image-preview:large, max-video-preview:-1';

    const sig = signThumbnail(video.chat_id, video.message_id);

    const thumbUrl = (video.cloudflare_id && video.cloudflare_id !== 'none' && !video.cloudflare_id.startsWith('r2:'))
      ? `https://videodelivery.net/${video.cloudflare_id.split('?')[0]}/thumbnails/thumbnail.jpg?time=1s&height=1280`
      : `${process.env.API_BASE_URL}/api/thumbnail?chat_id=${encodeURIComponent(video.chat_id)}&message_id=${encodeURIComponent(video.message_id)}&sig=${sig}`;

    const safeCategory = video.category
      ? video.category.charAt(0).toUpperCase() + video.category.slice(1)
      : 'Video';

    const pageTitle = video.caption
      ? `${video.caption} | Trending Naija ${safeCategory}`
      : `Nigerian Homemade ${safeCategory} — Watch Now`;

    let seoDescription = video.seo_description || null;
    if (!seoDescription) {
      try {
        const expandRes = await axios.post(
          `${process.env.PYTHON_SERVICE_URL}/api/expand-caption`,
          { caption: video.caption || '', category: video.category },
          { timeout: 5000 }
        );
        if (expandRes.data.status === 'success') {
          seoDescription = expandRes.data.description;
          await pool.query(`UPDATE videos SET seo_description = $1 WHERE message_id = $2`, [seoDescription, message_id]);
        }
      } catch (e) {
        console.error('expand-caption failed:', e.message);
      }
    }

    const finalDescription = seoDescription
      || `Watch exclusive Nigerian homemade ${safeCategory} videos on ${appName}.`;

    const canonicalUrl = `${frontendUrl}/v/${message_id}`;
    const embedUrl = `${frontendUrl}/embed/${message_id}`;

    const schema = {
      '@context': 'https://schema.org',
      '@type': 'VideoObject',
      name: pageTitle,
      description: finalDescription,
      thumbnailUrl: [thumbUrl],
      uploadDate: new Date(video.created_at || Date.now()).toISOString(),
      embedUrl: embedUrl,
      isFamilyFriendly: "false",
      interactionStatistic: [
        {
          '@type': 'InteractionCounter',
          interactionType: { '@type': 'https://schema.org/WatchAction' },
          userInteractionCount: Number(video.views || 0)
        },
        {
          '@type': 'InteractionCounter',
          interactionType: { '@type': 'https://schema.org/LikeAction' },
          userInteractionCount: Number(video.likes_count || 0)
        }
      ],
      author: { '@type': 'Person', name: video.uploader_name || 'Member' }
    };

    const seoTags = buildSeoTags({
      pageTitle,
      description: finalDescription,
      thumbUrl,
      canonicalUrl,
      appName,
      schema,
      videoUrl: embedUrl,
      isVideo: true,
      robots
    });

    let html = getTemplate();

    if (!/<\/head>/i.test(html)) {
      throw new Error('SEO injector: no </head> tag in build template');
    }

    html = stripDefaultSeoTags(html).replace('</head>', seoTags);

    res.send(html);
  } catch (err) {
    console.error('Share Link Error:', err.message);
    res.redirect('/');
  }
});

/* =====================
   Standalone Embed Video Player
   Used by Twitter Player Cards & Google Video Sitemap (<video:player_loc>)
===================== */
app.get('/embed/:message_id', async (req, res) => {
  try {
    const { message_id } = req.params;
    const frontendUrl = process.env.FRONTEND_URL || 'https://videos.naijahomemade.com';
    const publicDomain = process.env.R2_PUBLIC_DOMAIN || 'https://bucket.naijahomemade.com';
    const apiBaseUrl = process.env.API_BASE_URL || 'https://videos.naijahomemade.com';

    const result = await pool.query(
      `SELECT chat_id, message_id, file_id, cloudflare_id, category, caption, views, uploader_id 
       FROM videos 
       WHERE message_id = $1 LIMIT 1`,
      [message_id]
    );

    if (!result.rows.length) {
      return res.status(404).send('<!DOCTYPE html><html><body style="background:#000;color:#fff;font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;">Video not found</body></html>');
    }

    const video = result.rows[0];

    // Premium videos cannot be embedded without active subscription
    if (video.category === 'premium') {
      return res.redirect(302, `/v/${encodeURIComponent(message_id)}`);
    }

    let videoUrl = '';
    let isHls = false;

    if (video.cloudflare_id && video.cloudflare_id !== 'none') {
      if (video.cloudflare_id.startsWith('r2:')) {
        const r2Key = video.cloudflare_id.replace('r2:', '');
        videoUrl = `${publicDomain}/${r2Key}`;
      } else {
        const cleanId = video.cloudflare_id.split('?')[0];
        videoUrl = `https://videodelivery.net/${cleanId}/manifest/video.m3u8`;
        isHls = true;
      }
    } else {
      videoUrl = `${apiBaseUrl}/api/video?chat_id=${encodeURIComponent(video.chat_id)}&message_id=${encodeURIComponent(video.message_id)}&noview=1`;
    }

    const sig = signThumbnail(video.chat_id, video.message_id);
    const thumbUrl = (video.cloudflare_id && video.cloudflare_id !== 'none' && !video.cloudflare_id.startsWith('r2:'))
      ? `https://videodelivery.net/${video.cloudflare_id.split('?')[0]}/thumbnails/thumbnail.jpg?time=1s&height=720`
      : `${apiBaseUrl}/api/thumbnail?chat_id=${encodeURIComponent(video.chat_id)}&message_id=${encodeURIComponent(video.message_id)}&sig=${sig}`;

    const title = escapeHtml(video.caption || 'NaijaHomemade Video');
    const watchUrl = `${frontendUrl}/v/${encodeURIComponent(message_id)}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${title}</title>
  <style>
    html, body {
      margin: 0; padding: 0; width: 100%; height: 100%;
      background-color: #000; overflow: hidden;
      display: flex; align-items: center; justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .player-container {
      position: relative; width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      background: #000;
    }
    video {
      width: 100%; height: 100%; max-height: 100vh;
      object-fit: contain; background: #000;
    }
    .watermark {
      position: absolute; top: 12px; right: 12px; z-index: 10;
      background: rgba(0, 0, 0, 0.65); padding: 5px 10px; border-radius: 6px;
      color: #fff; font-size: 11px; font-weight: 700; text-decoration: none;
      backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
      letter-spacing: -0.3px; transition: opacity 0.2s;
    }
    .watermark:hover { opacity: 0.85; }
    .watermark span { color: #ff3b30; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
</head>
<body>
  <div class="player-container">
    <a href="${watchUrl}" target="_blank" rel="noopener" class="watermark">
      Naija<span>homemade</span>
    </a>
    <video id="player" controls playsinline poster="${escapeHtml(thumbUrl)}" preload="metadata"></video>
  </div>
  <script>
    const video = document.getElementById('player');
    const src = ${JSON.stringify(videoUrl)};
    const isHls = ${isHls};
    if (isHls && window.Hls && window.Hls.isSupported()) {
      const hls = new Hls({ startLevel: 0 });
      hls.loadSource(src);
      hls.attachMedia(video);
    } else {
      video.src = src;
    }
  </script>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Embed Player Error:', err.message);
    res.status(500).send('Video player error');
  }
});

/* =====================
   HELPER: Base Mapper (Used by Videos, Suggestions & Groups)
===================== */
const mapVideoToResponse = (v, apiBaseUrl) => {
  let thumbnailUrl = "";
  
  if (v.cloudflare_id && v.cloudflare_id !== "none" && !v.cloudflare_id.startsWith("r2:")) {
      const cleanId = v.cloudflare_id.split('?')[0];
      thumbnailUrl = `https://videodelivery.net/${cleanId}/thumbnails/thumbnail.jpg?time=1s&height=600`;
  } else {
      const sig = signThumbnail(v.chat_id, v.message_id);
      thumbnailUrl = `${apiBaseUrl}/api/thumbnail?chat_id=${v.chat_id}&message_id=${v.message_id}&sig=${sig}`;
  }

  const isPremium = v.category === "premium";
  const isWebUpload = v.chat_id === "internal" || (v.cloudflare_id && v.cloudflare_id.startsWith("r2:"));
  let uploaderName = v.uploader_name;
  let uploaderHandle = v.uploader_handle;

  // Only fallback to @naijahomemade for legacy Telegram VIP videos or videos explicitly belonging to 1881815190
  const isLegacyOrNaijaHomemade = String(v.uploader_id) === "1881815190" || (!isWebUpload && (!v.uploader_id || String(v.uploader_id) === "0"));

  if (isPremium && isLegacyOrNaijaHomemade) {
    if (!uploaderHandle || uploaderHandle === "creator" || uploaderHandle === "Member") {
      uploaderHandle = "naijahomemade";
    }
    if (!uploaderName || uploaderName === "Member" || uploaderName === "creator") {
      uploaderName = "Naija Homemade Series";
    }
  } else {
    uploaderName = uploaderName || "Member";
    uploaderHandle = uploaderHandle || uploaderName || "creator";
  }

  return {
    chat_id: v.chat_id,
    message_id: v.message_id,
    views: v.views,
    caption: v.caption,
    category: v.category,
    uploader_id: v.uploader_id,
    uploader_name: uploaderName,
    uploader_handle: uploaderHandle,
    created_at: v.created_at,
    thumbnail_url: thumbnailUrl,
    media_group_id: v.media_group_id || null,
    is_group: Number(v.group_count || 1) > 1, 
    group_count: Number(v.group_count || 1),
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
    
    // 🟢 NEW: Extract sort and seed parameters
    const sort = (req.query.sort || "").toLowerCase().trim();
    const isRandom = sort === "random" || req.query.random === "true";
    const seed = req.query.seed ? String(req.query.seed).trim() : "";
    
    // 🟢 NEW: Extract timeframe from query (defaults to all_time)
    const timeframe = req.query.timeframe || "all_time";
    
    const apiBaseUrl = process.env.API_BASE_URL;

    let query;
    let queryValues;
    let timeFilter = ""; // 🟢 Placeholder for our time constraint

    if (category === "trends") {
      // 🟢 NEW: Set the time filter based on the requested timeframe
      if (timeframe === "weekly") {
        timeFilter = "WHERE v.created_at >= NOW() - INTERVAL '7 days'";
      } else if (timeframe === "monthly") {
        timeFilter = "WHERE v.created_at >= NOW() - INTERVAL '30 days'";
      }

      query = `
        WITH GroupedVideos AS (
          SELECT v.*, 
            COALESCE(au.display_name, au.username, u.username, 'Member') as uploader_name,
            COALESCE(au.username, u.username, 'creator') as uploader_handle,
            ROW_NUMBER() OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END ORDER BY v.views DESC) as rn,
            COUNT(*) OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END) as group_count
          FROM videos v 
          LEFT JOIN users u ON v.uploader_id = u.user_id
          LEFT JOIN app_users au ON (v.uploader_id = au.id OR v.uploader_id = au.telegram_user_id)
          ${timeFilter}
        )
        SELECT * FROM GroupedVideos WHERE rn = 1 ORDER BY views DESC LIMIT $1 OFFSET $2
      `;
      queryValues = [limit, offset];
    } else if (isRandom) {
      // 🟢 Random sorting across all time (supports deterministic seed for gap-free pagination)
      const hasCategory = category && category !== "all";
      const catFilter = hasCategory ? "WHERE category = $1" : "";
      
      let orderClause;
      if (hasCategory) {
        if (seed) {
          orderClause = "ORDER BY MD5(id::text || $2) LIMIT $3 OFFSET $4";
          queryValues = [category, seed, limit, offset];
        } else {
          orderClause = "ORDER BY RANDOM() LIMIT $2 OFFSET $3";
          queryValues = [category, limit, offset];
        }
      } else {
        if (seed) {
          orderClause = "ORDER BY MD5(id::text || $1) LIMIT $2 OFFSET $3";
          queryValues = [seed, limit, offset];
        } else {
          orderClause = "ORDER BY RANDOM() LIMIT $1 OFFSET $2";
          queryValues = [limit, offset];
        }
      }

      query = `
        WITH GroupedVideos AS (
          SELECT v.*, 
            COALESCE(au.display_name, au.username, u.username, 'Member') as uploader_name,
            COALESCE(au.username, u.username, 'creator') as uploader_handle,
            ROW_NUMBER() OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END ORDER BY v.created_at ASC) as rn,
            COUNT(*) OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END) as group_count
          FROM videos v 
          LEFT JOIN users u ON v.uploader_id = u.user_id
          LEFT JOIN app_users au ON (v.uploader_id = au.id OR v.uploader_id = au.telegram_user_id)
          ${catFilter}
        )
        SELECT * FROM GroupedVideos WHERE rn = 1 ${orderClause}
      `;
    } else {
      const hasCategory = category && category !== "all";
      const catFilter = hasCategory ? "WHERE category = $1" : "";

      if (hasCategory) {
        queryValues = [category, limit, offset];
      } else {
        queryValues = [limit, offset];
      }

      const limitOffsetPlaceholders = hasCategory ? "LIMIT $2 OFFSET $3" : "LIMIT $1 OFFSET $2";

      query = `
        WITH GroupedVideos AS (
          SELECT v.*, 
            COALESCE(au.display_name, au.username, u.username, 'Member') as uploader_name,
            COALESCE(au.username, u.username, 'creator') as uploader_handle,
            ROW_NUMBER() OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END ORDER BY v.created_at ASC) as rn,
            COUNT(*) OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END) as group_count
          FROM videos v 
          LEFT JOIN users u ON v.uploader_id = u.user_id
          LEFT JOIN app_users au ON (v.uploader_id = au.id OR v.uploader_id = au.telegram_user_id)
          ${catFilter}
        )
        SELECT * FROM GroupedVideos WHERE rn = 1 ORDER BY created_at DESC ${limitOffsetPlaceholders}
      `;
    }

    const videosRes = await pool.query(query, queryValues);

    let suggestions = [];
    if (page === 1) {
      const suggestQuery = `
        SELECT v.*, 
          COALESCE(au.display_name, au.username, u.username, 'Member') as uploader_name,
          COALESCE(au.username, u.username, 'creator') as uploader_handle 
        FROM videos v 
        LEFT JOIN users u ON v.uploader_id = u.user_id 
        LEFT JOIN app_users au ON (v.uploader_id = au.id OR v.uploader_id = au.telegram_user_id)
        ORDER BY RANDOM() LIMIT 10
      `;
      const suggestRes = await pool.query(suggestQuery);
      suggestions = suggestRes.rows;
    }

    let countQuery;
    let countValues;
    if (category === "trends") {
      countQuery = `SELECT COUNT(DISTINCT CASE WHEN media_group_id IS NOT NULL AND media_group_id != 'none' THEN media_group_id ELSE message_id END) FROM videos v ${timeFilter}`;
      countValues = [];
    } else if (category && category !== "all") {
      countQuery = `SELECT COUNT(DISTINCT CASE WHEN media_group_id IS NOT NULL AND media_group_id != 'none' THEN media_group_id ELSE message_id END) FROM videos WHERE category = $1`;
      countValues = [category];
    } else {
      countQuery = `SELECT COUNT(DISTINCT CASE WHEN media_group_id IS NOT NULL AND media_group_id != 'none' THEN media_group_id ELSE message_id END) FROM videos`;
      countValues = [];
    }
    
    const totalRes = await pool.query(countQuery, countValues);
    const total = Number(totalRes.rows[0].count);

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
   Fetch Album Contents via Lazy Load
===================== */
app.get("/api/group", async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    
    const { media_group_id } = req.query;
    if (!media_group_id || media_group_id === 'none') return res.status(400).json({error: "Invalid group"});
    
    const query = `
      SELECT v.*, 
        COALESCE(au.display_name, au.username, u.username, 'Member') as uploader_name,
        COALESCE(au.username, u.username, 'creator') as uploader_handle 
      FROM videos v 
      LEFT JOIN users u ON v.uploader_id = u.user_id 
      LEFT JOIN app_users au ON (v.uploader_id = au.id OR v.uploader_id = au.telegram_user_id)
      WHERE v.media_group_id = $1 
      ORDER BY v.created_at ASC
    `;
    const { rows } = await pool.query(query, [media_group_id]);
    const apiBaseUrl = process.env.API_BASE_URL;
    
    res.json(rows.map(v => ({ 
      ...mapVideoToResponse(v, apiBaseUrl), 
      is_group: false,
      group_count: 1
    })));
  } catch (err) {
    console.error("Group fetch error:", err);
    res.status(500).json({ error: "Server error" });
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
  
  if (!parsed.success) {
    const errorMessage = parsed.error?.issues?.[0]?.message || "Invalid search parameters";
    return res.status(400).json({ error: errorMessage });
  }

  const { q, page, limit } = parsed.data;

  try {
    const apiBaseUrl = process.env.API_BASE_URL; 
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
      
      if (v.cloudflare_id && v.cloudflare_id !== "none" && !v.cloudflare_id.startsWith("r2:")) {
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
        thumbnail_url: thumbUrl,
        likes_count: Number(v.likes_count || 0),
        comments_count: Number(v.comments_count || 0),
        shares_count: Number(v.shares_count || 0),
        saves_count: Number(v.saves_count || 0)
      };
    });

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
   Video Details Helper
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

/* =======================================================
   INTERACTION SUITE (LIKES, COMMENTS, SAVES)
======================================================= */
app.get("/api/interactions/state/:message_id", authenticateToken, async (req, res) => {
  try {
    const { message_id } = req.params;
    const user_id = req.user.id;
    
    const likeRes = await pool.query("SELECT 1 FROM likes WHERE user_id=$1 AND message_id=$2", [user_id, message_id]);
    const saveRes = await pool.query("SELECT 1 FROM saves WHERE user_id=$1 AND message_id=$2", [user_id, message_id]);
    
    let isFollowing = false;
    let isSubscribed = false;
    const videoRes = await pool.query("SELECT uploader_id FROM videos WHERE message_id = $1 LIMIT 1", [message_id]);
    if (videoRes.rows.length > 0 && videoRes.rows[0].uploader_id) {
      const uploaderId = videoRes.rows[0].uploader_id;
      const [followRes, subRes] = await Promise.all([
        pool.query(
          `SELECT 1 FROM creator_follows cf
           WHERE cf.follower_id = $1 
             AND (
               cf.creator_id = $2 
               OR cf.creator_id IN (SELECT id FROM app_users WHERE telegram_user_id = $2)
               OR cf.creator_id IN (SELECT id FROM app_users WHERE id = $2)
             )
           LIMIT 1`,
          [user_id, uploaderId]
        ),
        pool.query(
          `SELECT 1 FROM creator_subscriptions cs
           WHERE cs.subscriber_id = $1 
             AND (
               cs.creator_id = $2 
               OR cs.creator_id IN (SELECT id FROM app_users WHERE telegram_user_id = $2)
               OR cs.creator_id IN (SELECT id FROM app_users WHERE id = $2)
             )
             AND cs.status = 'active'
             AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
           LIMIT 1`,
          [user_id, uploaderId]
        )
      ]);
      isFollowing = followRes.rows.length > 0;
      isSubscribed = subRes.rows.length > 0;
    }

    res.json({
      isLiked: likeRes.rows.length > 0,
      isSaved: saveRes.rows.length > 0,
      isFollowing: isFollowing,
      isSubscribed: isSubscribed
    });
  } catch (err) {
    res.status(500).json({ error: "State fetch failed" });
  }
});

app.get("/api/interactions/liked", authenticateToken, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const user_id = req.user.id;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 12);
    const offset = (page - 1) * limit;
    const apiBaseUrl = process.env.API_BASE_URL;

    const countRes = await pool.query("SELECT COUNT(*) FROM likes WHERE user_id = $1", [user_id]);
    const total = Number(countRes.rows[0]?.count || 0);

    const query = `
      SELECT v.*, u.username as uploader_name
      FROM likes l
      JOIN videos v ON l.message_id = v.message_id
      LEFT JOIN users u ON v.uploader_id = u.user_id
      WHERE l.user_id = $1
      ORDER BY l.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const { rows } = await pool.query(query, [user_id, limit, offset]);
    res.json({
      page,
      limit,
      total,
      videos: rows.map(v => mapVideoToResponse(v, apiBaseUrl))
    });
  } catch (err) {
    console.error("Liked videos error:", err);
    res.status(500).json({ error: "Failed to fetch liked videos" });
  }
});

app.get("/api/interactions/saved", authenticateToken, async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const user_id = req.user.id;
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 12);
    const offset = (page - 1) * limit;
    const apiBaseUrl = process.env.API_BASE_URL;

    const countRes = await pool.query("SELECT COUNT(*) FROM saves WHERE user_id = $1", [user_id]);
    const total = Number(countRes.rows[0]?.count || 0);

    const query = `
      SELECT v.*, 
        COALESCE(au.display_name, au.username, u.username, 'Member') as uploader_name,
        COALESCE(au.username, u.username, 'creator') as uploader_handle
      FROM saves s
      JOIN videos v ON s.message_id = v.message_id
      LEFT JOIN users u ON v.uploader_id = u.user_id
      LEFT JOIN app_users au ON (v.uploader_id = au.id OR v.uploader_id = au.telegram_user_id)
      WHERE s.user_id = $1
      ORDER BY s.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const { rows } = await pool.query(query, [user_id, limit, offset]);
    res.json({
      page,
      limit,
      total,
      videos: rows.map(v => mapVideoToResponse(v, apiBaseUrl))
    });
  } catch (err) {
    console.error("Saved videos error:", err);
    res.status(500).json({ error: "Failed to fetch saved videos" });
  }
});

app.post("/api/interactions/like", authenticateToken, async (req, res) => {
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

app.post("/api/interactions/save", authenticateToken, async (req, res) => {
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

app.post("/api/interactions/share", async (req, res) => {
  try {
    const { message_id } = req.body;
    await pool.query("UPDATE videos SET shares_count = shares_count + 1 WHERE message_id=$1", [message_id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Share logging failed" });
  }
});

app.post("/api/comments", authenticateToken, async (req, res) => {
  try {
    const { message_id, content } = req.body;
    const user_id = req.user.id;

    if (!content || !content.trim()) return res.status(400).json({ error: "Comment cannot be empty" });

    const result = await pool.query(
      "INSERT INTO comments (user_id, message_id, content) VALUES ($1, $2, $3) RETURNING *",
      [user_id, message_id, content.trim()]
    );
    await pool.query("UPDATE videos SET comments_count = comments_count + 1 WHERE message_id=$1", [message_id]);
    
    const user = await pool.query("SELECT username, avatar_url FROM app_users WHERE id=$1", [user_id]);
    
    res.json({ success: true, comment: { ...result.rows[0], ...user.rows[0] } });
  } catch (err) {
    res.status(500).json({ error: "Failed to post comment" });
  }
});

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

/* =======================================================
   🟢 BULLETPROOF THUMBNAIL ROUTE 
======================================================= */
const FALLBACK_THUMB_SVG = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="100%" height="100%">
    <rect width="400" height="400" fill="#121214"/>
    <circle cx="200" cy="200" r="36" fill="rgba(255,255,255,0.06)"/>
    <polygon points="192,184 218,200 192,216" fill="rgba(255,255,255,0.3)"/>
  </svg>`
);

app.get("/api/thumbnail", async (req, res) => {
  const { chat_id, message_id } = req.query;
  // If invalid request, return clean dark SVG fallback
  if (!chat_id || !message_id) {
    res.set({ "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400", "Access-Control-Allow-Origin": "*" });
    return res.send(FALLBACK_THUMB_SVG);
  }
  
  const fileName = `thumbs/${chat_id}_${message_id}.jpg`;

  try {
    // 1. Try serving from R2 using transformToByteArray (prevents .pipe() crash)
    try {
      const r2Object = await r2.send(new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName
      }));
      
      const byteArray = await r2Object.Body.transformToByteArray();
      res.set({
        "Content-Type": "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable", 
        "Access-Control-Allow-Origin": "*"
      });
      return res.send(Buffer.from(byteArray));
    } catch (r2Err) {
      // Not in R2 yet, fall through to Telegram DB fetch
    }

    // 2. Fetch from Telegram DB
    const dbRes = await pool.query("SELECT thumb_file_id, cloudflare_id FROM videos WHERE chat_id=$1 AND message_id=$2", [chat_id, message_id]);
    
    // If video is hosted on Cloudflare, redirect to high-res Cloudflare thumbnail
    if (dbRes.rows[0]?.cloudflare_id && dbRes.rows[0].cloudflare_id !== "none" && !dbRes.rows[0].cloudflare_id.startsWith("r2:")) {
      const cleanId = dbRes.rows[0].cloudflare_id.split('?')[0];
      return res.redirect(`https://videodelivery.net/${cleanId}/thumbnails/thumbnail.jpg?time=1s&height=600`);
    }

    if (!dbRes.rows.length || !dbRes.rows[0].thumb_file_id) {
      res.set({ "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400", "Access-Control-Allow-Origin": "*" });
      return res.send(FALLBACK_THUMB_SVG);
    }

    const fileRes = await axios.get(`${TELEGRAM_API}/getFile`, { params: { file_id: dbRes.rows[0].thumb_file_id } });
    const imageRes = await axios.get(`${TELEGRAM_FILE_API}/${fileRes.data.result.file_path}`, { responseType: "arraybuffer" });
    const buffer = Buffer.from(imageRes.data);

    // 3. Upload to R2 in the background for future requests
    r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: "image/jpeg"
    })).catch(e => console.error("R2 Background Upload Failed:", e.message));

    res.set({
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=604800, immutable",
      "Access-Control-Allow-Origin": "*"
    });
    return res.send(buffer);

  } catch (err) {
    // Failsafe: return clean SVG placeholder so image never breaks or displays broken alt text
    res.set({ "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400", "Access-Control-Allow-Origin": "*" });
    return res.send(FALLBACK_THUMB_SVG);
  }
});

// Alias for /api/thumb to /api/thumbnail
app.get("/api/thumb", (req, res) => {
  const { chat_id, message_id } = req.query;
  if (!chat_id || !message_id) {
    res.set({ "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400", "Access-Control-Allow-Origin": "*" });
    return res.send(FALLBACK_THUMB_SVG);
  }
  return res.redirect(301, `/api/thumbnail?chat_id=${encodeURIComponent(chat_id)}&message_id=${encodeURIComponent(message_id)}`);
});

/* =======================================================
   🟢 BULLETPROOF AVATAR ROUTE 
======================================================= */
app.get("/api/avatar", async (req, res) => {
  try {
    const { user_id } = req.query;
    
    // Prevent bad requests from breaking the image
    if (!user_id || user_id === 'undefined' || user_id === 'null') {
      return res.redirect('/assets/default-avatar.png');
    }

    // Check if user exists in app_users and has a custom avatar_url
    try {
      const userRes = await pool.query(
        "SELECT avatar_url FROM app_users WHERE id = $1::BIGINT OR telegram_user_id = $1::BIGINT LIMIT 1",
        [user_id]
      );
      if (userRes.rows.length > 0 && userRes.rows[0].avatar_url && !userRes.rows[0].avatar_url.includes('/api/avatar')) {
        return res.redirect(userRes.rows[0].avatar_url);
      }
    } catch (dbErr) {
      // Ignore DB error and proceed to Telegram photo lookup
    }

    const numericId = Number(user_id);
    let fileId = null;

    if (numericId < 0) {
      // Telegram Channel or Supergroup photo lookup via getChat
      const chatRes = await axios.get(`${TELEGRAM_API}/getChat`, {
        params: { chat_id: user_id }
      });
      fileId = chatRes.data?.result?.photo?.big_file_id || chatRes.data?.result?.photo?.small_file_id;
    } else {
      // Telegram User profile photos lookup
      const photosRes = await axios.get(`${TELEGRAM_API}/getUserProfilePhotos`, {
        params: { user_id, limit: 1 }
      });
      const photos = photosRes.data?.result?.photos;
      if (photos && photos.length > 0) {
        fileId = photos[0][photos[0].length - 1]?.file_id || photos[0][0]?.file_id;
      }
    }

    if (!fileId) {
      return res.redirect('/assets/default-avatar.png');
    }

    const fileRes = await axios.get(`${TELEGRAM_API}/getFile`, { params: { file_id: fileId } });
    const imageRes = await axios.get(`${TELEGRAM_FILE_API}/${fileRes.data.result.file_path}`, { responseType: "arraybuffer" });
    
    res.set({
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=86400", 
      "Access-Control-Allow-Origin": "*"
    });
    return res.send(Buffer.from(imageRes.data));
  } catch (err) {
    // Ultimate Failsafe: Never show a broken image icon
    return res.redirect('/assets/default-avatar.png');
  }
});

/* =====================
   ROBOTS.TXT
===================== */
app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`User-agent: *
Allow: /
Allow: /v/
Allow: /explore
Disallow: /api/
Disallow: /status
Disallow: /admin
Disallow: /login
Disallow: /*?token=*
Disallow: /*?legal=*

Sitemap: https://videos.naijahomemade.com/sitemap.xml
`);
});

/* =======================================================
   DYNAMIC SITEMAP.XML (GOOGLE VIDEO SITEMAP SPECIFICATION)
======================================================= */
let sitemapCache = { xml: null, expires: 0 };

app.get('/sitemap.xml', async (req, res) => {
  try {
    if (sitemapCache.xml && Date.now() < sitemapCache.expires) {
      res.header('Content-Type', 'application/xml');
      res.header('Cache-Control', 'public, max-age=3600');
      return res.send(sitemapCache.xml);
    }

    const result = await pool.query(`
      SELECT message_id, chat_id, cloudflare_id, caption, category, views, created_at, seo_description
      FROM videos 
      WHERE (status = 'ready' OR status IS NULL)
        AND (category IS NULL OR category != 'premium')
      ORDER BY created_at DESC 
      LIMIT 5000
    `);

    const baseUrl = process.env.FRONTEND_URL || 'https://videos.naijahomemade.com';
    const apiBaseUrl = process.env.API_BASE_URL || 'https://videos.naijahomemade.com';
    const publicDomain = process.env.R2_PUBLIC_DOMAIN || 'https://bucket.naijahomemade.com';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n`;

    // Static & Category landing pages (Free public sections only)
    const staticPages = [
      { loc: `${baseUrl}/`, changefreq: 'hourly', priority: '1.0' },
      { loc: `${baseUrl}/explore`, changefreq: 'daily', priority: '0.9' },
      { loc: `${baseUrl}/?cat=hotties`, changefreq: 'daily', priority: '0.9' },
      { loc: `${baseUrl}/?cat=knacks`, changefreq: 'daily', priority: '0.9' },
      { loc: `${baseUrl}/?cat=baddies`, changefreq: 'daily', priority: '0.9' },
      { loc: `${baseUrl}/?cat=trends`, changefreq: 'daily', priority: '0.9' }
    ];

    staticPages.forEach(p => {
      xml += `  <url>\n`;
      xml += `    <loc>${p.loc}</loc>\n`;
      xml += `    <changefreq>${p.changefreq}</changefreq>\n`;
      xml += `    <priority>${p.priority}</priority>\n`;
      xml += `  </url>\n`;
    });

    result.rows.forEach(video => {
      const sig = signThumbnail(video.chat_id, video.message_id);
      const thumbUrl = (video.cloudflare_id && video.cloudflare_id !== 'none' && !video.cloudflare_id.startsWith('r2:'))
        ? `https://videodelivery.net/${video.cloudflare_id.split('?')[0]}/thumbnails/thumbnail.jpg?time=1s&height=720`
        : `${apiBaseUrl}/api/thumbnail?chat_id=${encodeURIComponent(video.chat_id)}&message_id=${encodeURIComponent(video.message_id)}&sig=${sig}`;

      const safeCategory = video.category
        ? video.category.charAt(0).toUpperCase() + video.category.slice(1)
        : 'Video';

      const title = (video.caption
        ? `${video.caption} | Trending Naija ${safeCategory}`
        : `Nigerian Homemade ${safeCategory} Video`).slice(0, 100);

      const desc = (video.seo_description || video.caption
        ? `${video.caption} - Watch exclusive Nigerian homemade ${safeCategory} videos.`
        : `Watch exclusive Nigerian homemade ${safeCategory} videos on NaijaHomemade.`).slice(0, 2048);

      const pubDate = new Date(video.created_at || Date.now()).toISOString();
      const viewCount = Math.max(0, parseInt(video.views, 10) || 0);

      let contentLocXml = '';
      if (video.cloudflare_id && video.cloudflare_id !== 'none') {
        let contentUrl = '';
        if (video.cloudflare_id.startsWith('r2:')) {
          const r2Key = video.cloudflare_id.replace('r2:', '');
          contentUrl = `${publicDomain}/${r2Key}`;
        } else {
          const cleanId = video.cloudflare_id.split('?')[0];
          contentUrl = `https://videodelivery.net/${cleanId}/manifest/video.m3u8`;
        }
        if (contentUrl) {
          contentLocXml = `      <video:content_loc>${escapeXml(contentUrl)}</video:content_loc>\n`;
        }
      }

      xml += `  <url>\n`;
      xml += `    <loc>${baseUrl}/v/${video.message_id}</loc>\n`;
      xml += `    <lastmod>${pubDate}</lastmod>\n`;
      xml += `    <changefreq>never</changefreq>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `    <video:video>\n`;
      xml += `      <video:thumbnail_loc>${escapeXml(thumbUrl)}</video:thumbnail_loc>\n`;
      xml += `      <video:title>${escapeXml(title)}</video:title>\n`;
      xml += `      <video:description>${escapeXml(desc)}</video:description>\n`;
      if (contentLocXml) {
        xml += contentLocXml;
      }
      xml += `      <video:player_loc allow_embed="yes" autoplay="ap=1">${baseUrl}/embed/${video.message_id}</video:player_loc>\n`;
      xml += `      <video:view_count>${viewCount}</video:view_count>\n`;
      xml += `      <video:publication_date>${pubDate}</video:publication_date>\n`;
      xml += `      <video:family_friendly>no</video:family_friendly>\n`;
      xml += `      <video:category>${escapeXml(safeCategory)}</video:category>\n`;
      xml += `    </video:video>\n`;
      xml += `  </url>\n`;
    });

    xml += `</urlset>`;

    sitemapCache = {
      xml,
      expires: Date.now() + 3600 * 1000 // 1 hour TTL
    };

    res.header('Content-Type', 'application/xml');
    res.header('Cache-Control', 'public, max-age=3600');
    res.send(xml);
  } catch (err) {
    console.error('Sitemap error:', err);
    res.status(500).end();
  }
});

/* =======================================================
   ⚡ FAST SERVER-SIDE BOT SEO INJECTOR (ROOT & CATEGORIES)
   Intercepts search crawlers and social link scrapers in <15ms
   without 15-second headless Chromium rendering lag.
======================================================= */
const BOT_UA_REGEX = /googlebot|bingbot|yandex|baiduspider|twitterbot|facebookexternalhit|rogerbot|linkedinbot|embedly|quora link preview|showyoubot|outbrain|pinterest\/0\.|pinterestbot|slackbot|vkshare|w3c_validator|whatsapp|telegrambot|applebot|exobot|discordbot/i;

app.use((req, res, next) => {
  const ua = req.headers['user-agent'] || '';
  const isBot = BOT_UA_REGEX.test(ua) || req.query._escaped_fragment_ !== undefined;

  if (!isBot) return next();

  // Only intercept root / or /explore
  if (req.path !== '/' && req.path !== '/explore') {
    return next();
  }

  try {
    const frontendUrl = process.env.FRONTEND_URL || 'https://videos.naijahomemade.com';
    const appName = process.env.APP_NAME || 'NaijaHomemade';
    let pageTitle = 'Naija Homemade Videos - NaijaPorn & Trending Nigerian Creators | Naijahomemade';
    let description = 'Watch Best Naija Homemade porn videos for free on Naijahomemade.com. Discover high quality Most Relevant Naija XXX movies, leaks, and verified creator clips.';
    let canonicalUrl = `${frontendUrl}/`;
    let robots = 'index, follow, max-image-preview:large, max-video-preview:-1';

    if (req.path === '/explore') {
      pageTitle = 'Explore Trending Nigerian Homemade Videos & Creators | NaijaHomemade';
      description = 'Discover and stream trending Nigerian creators, verified models, and exclusive homemade videos on NaijaHomemade.';
      canonicalUrl = `${frontendUrl}/explore`;
    } else {
      const cat = req.query.cat ? String(req.query.cat).toLowerCase() : '';
      if (cat === 'hotties') {
        pageTitle = 'Trending Naija Hotties Videos | NaijaHomemade';
        description = 'Watch trending Nigerian hotties videos, spicy amateur clips, and exclusive creators on NaijaHomemade.';
        canonicalUrl = `${frontendUrl}/?cat=hotties`;
      } else if (cat === 'knacks') {
        pageTitle = 'Naija Knacks Videos - Explicit Nigerian Homemade Clips | NaijaHomemade';
        description = 'Stream the best Naija knacks, adult Nigerian homemade videos, and explicit creator uploads on NaijaHomemade.';
        canonicalUrl = `${frontendUrl}/?cat=knacks`;
      } else if (cat === 'baddies') {
        pageTitle = 'Exclusive Naija Baddies Videos | NaijaHomemade';
        description = 'Watch verified Naija baddies, trending hot models, and exclusive adult content on NaijaHomemade.';
        canonicalUrl = `${frontendUrl}/?cat=baddies`;
      } else if (cat === 'trends') {
        pageTitle = 'Latest Naija Trends & Viral Videos | NaijaHomemade';
        description = 'Catch up on the latest viral Nigerian trends, homemade leaks, and trending adult creator clips on NaijaHomemade.';
        canonicalUrl = `${frontendUrl}/?cat=trends`;
      } else if (cat === 'premium') {
        pageTitle = 'VIP Premium Nigerian Creators & Videos | NaijaHomemade';
        description = 'Access VIP premium content from top verified Nigerian homemade creators and exclusive series on NaijaHomemade.';
        canonicalUrl = `${frontendUrl}/?cat=premium`;
        robots = 'noindex, follow';
      }
    }

    const schema = {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': `${frontendUrl}/#website`,
          url: frontendUrl,
          name: appName,
          description: 'Watch Best Naija Homemade porn videos for free on Naijahomemade.com.',
          potentialAction: {
            '@type': 'SearchAction',
            target: `${frontendUrl}/?search={search_term_string}`,
            'query-input': 'required name=search_term_string'
          }
        },
        {
          '@type': 'Organization',
          '@id': `${frontendUrl}/#organization`,
          name: appName,
          url: frontendUrl,
          logo: `${frontendUrl}/naija.svg`
        }
      ]
    };

    const seoTags = buildSeoTags({
      pageTitle,
      description,
      thumbUrl: `${frontendUrl}/naija.svg`,
      canonicalUrl,
      appName,
      schema,
      isVideo: false,
      robots
    });

    let html = getTemplate();
    if (/<\/head>/i.test(html)) {
      html = stripDefaultSeoTags(html).replace('</head>', seoTags);
      return res.send(html);
    }
  } catch (err) {
    console.error('Fast Bot SEO error:', err.message);
  }

  next();
});

/* =======================================================
   🤖 PRERENDER MIDDLEWARE (SELF-HOSTED FALLBACK)
======================================================= */
// 1. Point it to your new local engine
prerender.set('prerenderServiceUrl', 'https://codedloud.com/');

// 2. Add the bots you want to trigger the renderer
prerender.crawlerUserAgents.push('ExoBot');
prerender.crawlerUserAgents.push('exobot');
prerender.crawlerUserAgents.push('TelegramBot');
prerender.crawlerUserAgents.push('Twitterbot');

// 3. Use the middleware
app.use(prerender);

/* =======================================================
   SERVE THE COMPILED FRONTEND
======================================================= */
app.use(express.static(path.join(__dirname, '../frontend/dist')));

app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
});

/* =======================================================
   🛡️ AUTOMATED CLOUDFLARE R2 DATABASE BACKUPS
======================================================= */
async function backupDatabaseToR2() {
  // Generate a clean, timezone-safe timestamp for the filename
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `db-backup-${timestamp}.dump`;
  const localBackupPath = path.join(__dirname, fileName);

  console.log(`📦 [DB BACKUP] Starting automated PostgreSQL backup...`);

  try {
    // 1. Execute pg_dump directly using your existing connection string
    // -F c specifies "Custom" compressed format (best for pg_restore)
    await execPromise(`pg_dump "${process.env.DATABASE_URL}" -F c -f "${localBackupPath}"`);
    console.log(`✅ [DB BACKUP] Local dump successful. Pushing to R2...`);

    // 2. Stream the backup file to Cloudflare R2
    const fileStream = fs.createReadStream(localBackupPath);
    const r2Key = `database_backups/${fileName}`;

    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: r2Key,
      Body: fileStream,
      // Application/octet-stream is standard for binary dump files
      ContentType: "application/octet-stream", 
    }));

    console.log(`✅ [DB BACKUP] Securely uploaded to R2: ${r2Key}`);

  } catch (error) {
    console.error(`❌ [DB BACKUP] Fatal backup error:`, error.message);
  } finally {
    // 3. Bulletproof Cleanup: Always wipe the local file to prevent SSD bloat
    if (fs.existsSync(localBackupPath)) {
      fs.unlinkSync(localBackupPath);
      console.log(`🧹 [DB BACKUP] Local temporary file removed.`);
    }
  }
}

// 🟢 Schedule the backup to run automatically at 3:00 AM every single day
cron.schedule("0 3 * * *", () => {
  backupDatabaseToR2();
});

const PORT = process.env.PORT || 3000;
await initDatabase();
app.listen(PORT, () => console.log(`🚀 Server running on PORT ${PORT}`));