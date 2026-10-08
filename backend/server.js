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
import { S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"; 
import adminRoutes, { syncTelegramCreators, migrateLegacyVipToCreator } from "./admin.js";
import authRoutes, { authenticateToken, JWT_SECRET } from "./auth.js";
import creatorRoutes from "./creator.js";
import pool from "./db.js";
import { fetchTelegramChat } from "./telegramCreatorSync.js";
import multer from "multer";
import { uploadDirectToStream } from "./controllers/upload_premium.js";
import { verifyPayment } from "./controllers/payment.js";
import { createCryptoPayment, cryptoWebhook, checkCryptoTransaction } from "./controllers/crypto.js";
import { z } from "zod"; 
import cron from "node-cron";
import { getPrivacyHtml, getTermsHtml, getAboutHtml } from "./legalTemplates.js";

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

      await pool.query(`
        ALTER TABLE videos DROP CONSTRAINT IF EXISTS videos_uploader_id_fkey;
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS is_community BOOLEAN DEFAULT FALSE;
        ALTER TABLE videos ADD COLUMN IF NOT EXISTS flags_count INT DEFAULT 0;
        CREATE INDEX IF NOT EXISTS idx_videos_is_community ON videos(is_community);

        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE;
        ALTER TABLE app_users ADD COLUMN IF NOT EXISTS ban_reason TEXT;

        CREATE TABLE IF NOT EXISTS video_reports (
          id SERIAL PRIMARY KEY,
          message_id TEXT NOT NULL,
          reporter_id BIGINT,
          reporter_ip TEXT,
          reason VARCHAR(100) NOT NULL,
          details TEXT,
          status VARCHAR(20) DEFAULT 'pending',
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(message_id, reporter_id)
        );
        CREATE INDEX IF NOT EXISTS idx_video_reports_message_id ON video_reports(message_id);
        CREATE INDEX IF NOT EXISTS idx_video_reports_status ON video_reports(status);
      `);

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

      await pool.query(`CREATE INDEX IF NOT EXISTS idx_comments_message_id_created_at ON comments (message_id, created_at DESC)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_comments_user_id ON comments (user_id)`);

      await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS likes_count BIGINT DEFAULT 0`);
      await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS comments_count BIGINT DEFAULT 0`);
      await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS shares_count BIGINT DEFAULT 0`);
      await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS saves_count BIGINT DEFAULT 0`);
      await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS seo_description TEXT`);
      await pool.query(`ALTER TABLE videos ADD COLUMN IF NOT EXISTS media_group_id TEXT`);

      await pool.query(`
        CREATE TABLE IF NOT EXISTS creator_stories (
          id SERIAL PRIMARY KEY,
          creator_id INT REFERENCES app_users(id) ON DELETE CASCADE,
          username VARCHAR(50) NOT NULL,
          video_url TEXT NOT NULL,
          thumbnail_url TEXT,
          duration NUMERIC DEFAULT 10.0,
          sound_title TEXT DEFAULT 'Trending TikTok Sound',
          created_at TIMESTAMP DEFAULT NOW(),
          expires_at TIMESTAMP DEFAULT (NOW() + INTERVAL '24 hours'),
          is_active BOOLEAN DEFAULT TRUE
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_stories_active ON creator_stories(username, expires_at)`);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_stories_is_active ON creator_stories(is_active)`);
      
      console.log("✅ Database initialized (Admins, App_Users, Videos, Transactions, Stories & Interactions)");

      // Auto-sync Telegram uploaders as managed creators in app_users in background
      syncTelegramCreators(pool).catch((sErr) => {
        console.warn("⚠️ [STARTUP] Telegram creators sync notice:", sErr.message);
      });
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
      creator_name,
      subscription_price 
    } = req.body; 
    const videoFile = req.file;

    // Verify authorization:
    // 1. JWT Bearer token with admin role
    let isAuthorized = false;
    const authHeader = req.headers['authorization'];
    const token = (authHeader && authHeader.split(' ')[1]) || req.query.token;
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

    // 2. OR API Key / Secret in headers or body or query
    const apiKey = req.headers['x-api-key'] || req.headers['x-api-secret'] || req.body.api_key || req.query.api_key;
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
    const rawUploaderId = uploader_id || req.query.uploader_id || req.body.admin_id;
    const numericUploaderId = rawUploaderId ? Number(rawUploaderId) : null;
    const finalUploaderId = numericUploaderId || 1881815190;

    const rawCategory = category || req.query.category;
    const safeCategory = rawCategory ? rawCategory.toLowerCase().trim() : "premium";
    const cleanIdStr = String(finalUploaderId).replace('-', '');
    const isChannel = finalUploaderId < 0;
    const defaultUsername = (safeCategory === "premium" && !isChannel) ? "naijahomemade" : `tg_${cleanIdStr}`;
    const defaultDisplayName = (safeCategory === "premium" && !isChannel) ? "Naija Homemade Series" : (isChannel ? `Channel ${cleanIdStr}` : `Creator ${finalUploaderId}`);
    const rawCreatorUsername = creator_username || req.query.creator_username;
    const targetUsername = rawCreatorUsername 
      ? String(rawCreatorUsername).trim().toLowerCase().replace(/[^a-z0-9_]/g, '')
      : defaultUsername;
    const targetDisplayName = creator_display_name || req.query.creator_display_name || creator_name || defaultDisplayName;

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
      // Determine randomized subscription price between $15 and $35
      const parsedSubPrice = Number(subscription_price || req.query.subscription_price);
      const subPrice = (!isNaN(parsedSubPrice) && parsedSubPrice >= 15 && parsedSubPrice <= 35)
        ? parsedSubPrice
        : Math.floor(Math.random() * (35 - 15 + 1)) + 15;

      if (existingTg.rows.length === 0) {
        const uCheck = await pool.query("SELECT id FROM app_users WHERE LOWER(username) = LOWER($1)", [targetUsername]);
        const safeUname = uCheck.rows.length > 0 ? `${targetUsername}_${cleanIdStr.slice(-4)}` : targetUsername;
        await pool.query(
          `INSERT INTO app_users (
             username, display_name, email, is_creator, is_managed, 
             telegram_user_id, creator_category, subscription_price, is_verified, 
             banner_url, creator_bio, avatar_url
           ) VALUES ($1, $2, $3, TRUE, TRUE, $4, $5, $6, TRUE, 
             'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80',
             'Official creator channel. Catch all exclusive drops and daily previews here.',
             $7
           )
           ON CONFLICT (telegram_user_id) DO UPDATE 
           SET is_creator = TRUE, is_managed = TRUE,
               subscription_price = COALESCE(app_users.subscription_price, EXCLUDED.subscription_price)`,
          [safeUname, targetDisplayName, `tg_${cleanIdStr}@internal.naijahomemade.com`, finalUploaderId, safeCategory, subPrice, `/api/avatar?user_id=${finalUploaderId}`]
        );
      } else {
        await pool.query(
          `UPDATE app_users 
           SET is_creator = TRUE, is_managed = TRUE, 
               telegram_user_id = COALESCE(telegram_user_id, $1),
               subscription_price = CASE 
                 WHEN subscription_price IS NULL OR subscription_price = 0 OR subscription_price = 15 
                 THEN $2 
                 ELSE subscription_price 
               END
           WHERE id = $3`,
          [finalUploaderId, subPrice, existingTg.rows[0].id]
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
   CREATOR 24-HOUR STATUS STORIES ENDPOINTS
===================== */
app.post("/api/stories/push", upload.single("video"), async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['x-api-secret'] || req.body.api_key || req.query.api_key;
    if (!apiKey || !API_SECRETS.includes(apiKey)) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(401).json({ error: "Unauthorized" });
    }

    const videoFile = req.file;
    if (!videoFile) return res.status(400).json({ error: "No video file provided" });

    const rawUsername = req.body.username || req.query.username;
    if (!rawUsername) {
      if (fs.existsSync(videoFile.path)) fs.unlinkSync(videoFile.path);
      return res.status(400).json({ error: "Missing creator username" });
    }

    const username = String(rawUsername).trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const soundTitle = req.body.sound_title || req.query.sound_title || "Trending TikTok Sound";
    const duration = parseFloat(req.body.duration || req.query.duration || 10.0) || 10.0;
    const internalId = `story_${Date.now()}`;

    // 1. Generate thumbnail using FFmpeg
    let thumbKey = null;
    try {
      const thumbPath = `${videoFile.path}.jpg`;
      await execPromise(`ffmpeg -i "${videoFile.path}" -ss 00:00:01.000 -vframes 1 -vf scale=400:-1 -q:v 5 "${thumbPath}" -y`);
      if (fs.existsSync(thumbPath)) {
        const thumbBuffer = fs.readFileSync(thumbPath);
        thumbKey = `thumbs/story_${internalId}.jpg`;
        await r2.send(new PutObjectCommand({
          Bucket: process.env.R2_BUCKET_NAME,
          Key: thumbKey,
          Body: thumbBuffer,
          ContentType: "image/jpeg",
        }));
        fs.unlinkSync(thumbPath);
      }
    } catch (tErr) {
      console.warn("⚠️ [STORY] FFmpeg thumbnail extraction warning:", tErr.message);
    }

    // 2. Upload Story Video to R2
    const fileStream = fs.createReadStream(videoFile.path);
    const r2Key = `stories/${username}/${internalId}.mp4`;
    await r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: r2Key,
      Body: fileStream,
      ContentType: "video/mp4",
    }));

    if (fs.existsSync(videoFile.path)) {
      fs.unlinkSync(videoFile.path);
    }

    // 3. Resolve Creator from app_users
    const userRes = await pool.query(
      "SELECT id, username, display_name FROM app_users WHERE LOWER(username) = LOWER($1)",
      [username]
    );
    const creatorId = userRes.rows.length > 0 ? userRes.rows[0].id : null;

    // 4. Archive previous active stories for this creator
    await pool.query(
      "UPDATE creator_stories SET is_active = FALSE WHERE LOWER(username) = LOWER($1)",
      [username]
    );

    // 5. Insert new 24-hour Status Story
    const publicDomain = process.env.R2_PUBLIC_DOMAIN || 'https://bucket.naijahomemade.com';
    const finalVideoUrl = `${publicDomain}/${r2Key}`;
    const finalThumbUrl = thumbKey ? `${publicDomain}/${thumbKey}` : null;

    const insertRes = await pool.query(
      `INSERT INTO creator_stories (
         creator_id, username, video_url, thumbnail_url, duration, sound_title, expires_at, is_active
       ) VALUES ($1, $2, $3, $4, $5, $6, NOW() + INTERVAL '24 hours', TRUE)
       RETURNING *`,
      [
        creatorId,
        username,
        finalVideoUrl,
        finalThumbUrl,
        duration,
        soundTitle
      ]
    );

    console.log(`✅ [STORY] Successfully published 24h status story for @${username} (Expires in 24 hours)`);
    return res.json({
      success: true,
      message: `24-hour status story published for @${username}`,
      story: insertRes.rows[0]
    });
  } catch (err) {
    console.error("❌ [STORY PUSH ERROR]", err);
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return res.status(500).json({ error: "Failed to publish story" });
  }
});

app.get("/api/stories/active", async (req, res) => {
  try {
    const activeRes = await pool.query(
      `SELECT DISTINCT ON (s.username)
              s.id, s.creator_id, s.username, s.video_url, s.thumbnail_url, 
              s.duration, s.sound_title, s.created_at, s.expires_at,
              COALESCE(u.display_name, s.username) as display_name,
              COALESCE(u.avatar_url, '/assets/default-avatar.png') as avatar_url,
              COALESCE(u.is_verified, TRUE) as is_verified
       FROM creator_stories s
       LEFT JOIN app_users u ON (s.creator_id = u.id OR LOWER(s.username) = LOWER(u.username))
       WHERE s.is_active = TRUE AND s.expires_at > NOW()
       ORDER BY s.username, s.created_at DESC`
    );
    return res.json({
      count: activeRes.rows.length,
      stories: activeRes.rows
    });
  } catch (err) {
    console.error("❌ [ACTIVE STORIES ERROR]", err);
    return res.status(500).json({ error: "Failed to fetch active stories" });
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
      // 1. Resolve video's creator details (if uploader_id is present)
      let videoCreator = null;
      if (video.uploader_id) {
        const creatorRes = await pool.query(
          `SELECT id, username, telegram_user_id, role, is_creator, subscription_price 
           FROM app_users 
           WHERE id = $1 OR (telegram_user_id IS NOT NULL AND telegram_user_id = $1)
           LIMIT 1`,
          [video.uploader_id]
        );
        if (creatorRes.rows.length > 0) {
          videoCreator = creatorRes.rows[0];
        }
      }

      const isOfficialSeries = !video.uploader_id ||
        String(video.uploader_id) === "1881815190" ||
        String(video.uploader_id) === "458" ||
        (videoCreator?.username && videoCreator.username.toLowerCase().includes("naijahomemade"));

      const creatorFee = Number(videoCreator?.subscription_price || 0);

      // If this video belongs to a creator who charges $0 (no fee set), allow free playback for everyone
      let isAuthorized = !isOfficialSeries && creatorFee <= 0;

      if (!isAuthorized) {
        const authHeader = req.headers["authorization"];
        const token = (authHeader && authHeader.startsWith("Bearer ") ? authHeader.split(" ")[1] : null) || req.query.token;

        if (token) {
          try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const userId = decoded.id;

            // Fetch requesting user's profile from app_users
            const userRes = await pool.query(
              "SELECT id, username, role, is_premium, is_creator, telegram_user_id FROM app_users WHERE id = $1",
              [userId]
            );

            if (userRes.rows.length > 0) {
              const currentUser = userRes.rows[0];

              // 1. Admins have universal platform playback access
              if (currentUser.role === "admin" || decoded.role === "admin") {
                isAuthorized = true;
              }

              // 2. Ownership check: Allow creators to watch their own videos
              if (!isAuthorized) {
                const uploaderIdStr = video.uploader_id ? String(video.uploader_id) : null;
                const currentUserIdStr = String(currentUser.id);
                const currentTgIdStr = currentUser.telegram_user_id ? String(currentUser.telegram_user_id) : null;

                if (uploaderIdStr && (uploaderIdStr === currentUserIdStr || (currentTgIdStr && uploaderIdStr === currentTgIdStr))) {
                  isAuthorized = true;
                } else if (videoCreator) {
                  if (videoCreator.id === currentUser.id) {
                    isAuthorized = true;
                  } else if (videoCreator.telegram_user_id && currentTgIdStr && String(videoCreator.telegram_user_id) === currentTgIdStr) {
                    isAuthorized = true;
                  } else if (videoCreator.username && currentUser.username && videoCreator.username.toLowerCase() === currentUser.username.toLowerCase()) {
                    isAuthorized = true;
                  }
                }
              }

              // 3. Platform VIP Check (Official NaijaHomemade VIP series)
              if (!isAuthorized && currentUser.is_premium && isOfficialSeries) {
                isAuthorized = true;
              }

              // 4. Active Creator Subscription Check
              if (!isAuthorized) {
                const uploaderTarget = video.uploader_id || "1881815190";
                const targetUsername = videoCreator?.username || (!video.uploader_id ? "naijahomemade" : null);

                const subCheck = await pool.query(
                  `SELECT 1 FROM creator_subscriptions cs
                   WHERE (cs.subscriber_id = $1 OR ($2::BIGINT IS NOT NULL AND cs.subscriber_id = $2::BIGINT))
                     AND (
                       cs.creator_id = $3::BIGINT
                       OR cs.creator_id IN (SELECT id FROM app_users WHERE telegram_user_id = $3::BIGINT OR id = $3::BIGINT)
                       OR cs.creator_id IN (SELECT telegram_user_id FROM app_users WHERE id = $3::BIGINT OR telegram_user_id = $3::BIGINT)
                       ${targetUsername ? "OR cs.creator_id IN (SELECT id FROM app_users WHERE LOWER(username) = LOWER($4)) OR cs.creator_id IN (SELECT telegram_user_id FROM app_users WHERE LOWER(username) = LOWER($4) AND telegram_user_id IS NOT NULL)" : ""}
                     )
                     AND cs.status = 'active'
                     AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
                   LIMIT 1`,
                  targetUsername 
                    ? [currentUser.id, currentUser.telegram_user_id || null, uploaderTarget, targetUsername]
                    : [currentUser.id, currentUser.telegram_user_id || null, uploaderTarget]
                );

                if (subCheck.rows.length > 0) {
                  isAuthorized = true;
                }
              }
            }
          } catch (jwtErr) {
            console.warn("[AUTH] Token validation failed on premium video access:", jwtErr.message);
          }
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
      params: { file_id: video.file_id },
      timeout: 5000
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
    const frontendUrl = process.env.FRONTEND_URL || 'https://naijahomemade.com';
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
    const frontendUrl = process.env.FRONTEND_URL || 'https://naijahomemade.com';
    const publicDomain = process.env.R2_PUBLIC_DOMAIN || 'https://bucket.naijahomemade.com';
    const apiBaseUrl = process.env.API_BASE_URL || 'https://naijahomemade.com';

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
   HELPER: Community Content Filter
   Matches all contents posted by web creators (flagged is_community)
===================== */
const IS_COMMUNITY_SQL = `(v.is_community = TRUE AND (v.status = 'ready' OR v.status IS NULL) AND (v.flags_count < 5 OR v.flags_count IS NULL) AND (au.is_banned IS NOT TRUE OR au.is_banned IS NULL))`;

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
    id: v.id,
    chat_id: v.chat_id,
    message_id: v.message_id,
    views: v.views,
    caption: v.caption,
    category: v.category,
    is_premium: isPremium,
    is_community: Boolean(v.is_community),
    is_verified: v.is_verified !== undefined ? Boolean(v.is_verified) : true,
    subscription_price: Number(v.subscription_price || 0),
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
    saves_count: Number(v.saves_count || 0),
    x_score: v.x_score !== undefined ? Number(v.x_score) : undefined
  };
};

/* =====================
   HELPER: Author Diversity Interleaving (X-style recommendation)
   Prevents author clustering in timelines (max consecutive items from same creator)
===================== */
const interleaveByAuthor = (items, maxConsecutive = 2) => {
  if (!items || items.length <= 2) return items;
  const result = [];
  const pool = [...items];
  
  while (pool.length > 0) {
    let nextIdx = 0;
    const candidate = pool[0];
    const candAuthor = candidate.uploader_id || candidate.uploader_handle || candidate.uploader_name;
    
    let consecutiveCount = 0;
    for (let i = result.length - 1; i >= 0; i--) {
      const prevAuthor = result[i].uploader_id || result[i].uploader_handle || result[i].uploader_name;
      if (prevAuthor && candAuthor && String(prevAuthor) === String(candAuthor)) {
        consecutiveCount++;
      } else {
        break;
      }
    }
    
    if (consecutiveCount >= maxConsecutive) {
      const diffIdx = pool.findIndex(item => {
        const itemAuthor = item.uploader_id || item.uploader_handle || item.uploader_name;
        return !itemAuthor || !candAuthor || String(itemAuthor) !== String(candAuthor);
      });
      if (diffIdx !== -1) {
        nextIdx = diffIdx;
      }
    }
    
    result.push(pool.splice(nextIdx, 1)[0]);
  }
  return result;
};

/* =====================
   COUNT CACHE (In-Memory 60s TTL to prevent duplicate table scans)
===================== */
const countCache = new Map();
const COUNT_CACHE_TTL = 60 * 1000;

/* =====================
   List videos
===================== */
app.get("/api/videos", async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 12)));
    const offset = (page - 1) * limit;

    // 🟢 Extract sort and seed parameters
    const sort = (req.query.sort || "").toLowerCase().trim();
    const isAlgo = sort === "algo" || sort === "x" || sort === "for_you" || sort === "algorithm" || sort === "explore";
    const isRandom = sort === "random" || req.query.random === "true";
    const seed = req.query.seed ? String(req.query.seed).trim() : Math.floor(Math.random() * 1000000).toString();
    
    // 🟢 Extract timeframe from query (defaults to all_time)
    const timeframe = req.query.timeframe || "all_time";
    
    const rawCategory = req.query.category ? String(req.query.category).toLowerCase().trim() : "";
    const category = rawCategory || (isAlgo ? "all" : "hotties");
    
    const isCommunity = req.query.community === "true" || category === "community";
    const communityCondition = isCommunity 
      ? "(v.is_community = TRUE AND (v.status = 'ready' OR v.status IS NULL) AND (v.flags_count < 5 OR v.flags_count IS NULL) AND NOT EXISTS (SELECT 1 FROM app_users au WHERE (v.uploader_id::text = au.id::text OR v.uploader_id::text = au.telegram_user_id::text) AND au.is_banned = TRUE))" 
      : (category === "amateurs" || category === "amateur")
        ? "((v.is_community IS NOT TRUE) OR (v.is_community = TRUE AND (v.status = 'ready' OR v.status IS NULL) AND (v.flags_count < 5 OR v.flags_count IS NULL) AND NOT EXISTS (SELECT 1 FROM app_users au WHERE (v.uploader_id::text = au.id::text OR v.uploader_id::text = au.telegram_user_id::text) AND au.is_banned = TRUE)))"
        : "(v.is_community IS NOT TRUE)";
    
    const apiBaseUrl = process.env.API_BASE_URL;

    let query;
    let queryValues;
    let timeFilter = `WHERE ${communityCondition}`;

    const hasCategory = category && category !== "all" && category !== "community";
    const catFilter = hasCategory 
      ? `WHERE (category = $1 OR ($1 = 'amateurs' AND category = 'amateur')) AND ${communityCondition}` 
      : `WHERE ${communityCondition}`;

    if (isAlgo) {
      // 🟢 Twitter/X Multi-Signal Dynamic Heavy Ranker (Ultra High Performance)
      // Uses float8 hardware math, slim candidate projection, and late-join materialization
      // to deliver instant (<250ms) refresh times across 14,000+ videos.
      let seedParam;
      let limitOffsetPlaceholders;
      let pagedOrder;
      let finalOrder;
      let algoFilter;

      if (hasCategory) {
        queryValues = [category, seed, limit, offset];
        seedParam = "$2";
        limitOffsetPlaceholders = "LIMIT $3 OFFSET $4";
        pagedOrder = "ORDER BY final_score DESC, created_at DESC, id DESC";
        finalOrder = "ORDER BY p.final_score DESC, v.created_at DESC, v.id DESC";
        algoFilter = `WHERE (category = $1 OR ($1 = 'amateurs' AND category = 'amateur')) AND ${communityCondition}`;
      } else {
        queryValues = [seed, limit, offset];
        seedParam = "$1";
        limitOffsetPlaceholders = "LIMIT $2 OFFSET $3";
        pagedOrder = "ORDER BY cat_rank ASC, cat_order ASC, final_score DESC";
        finalOrder = "ORDER BY p.cat_rank ASC, p.cat_order ASC, p.final_score DESC";
        algoFilter = `WHERE ${communityCondition} AND (v.created_at >= NOW() - INTERVAL '45 days' OR v.views >= 50 OR v.likes_count > 0 OR v.shares_count > 0 OR v.category IN ('amateurs', 'amateur'))`;
      }

      query = `
        WITH CandidatePool AS (
          SELECT 
            v.id,
            v.category,
            v.views::float8,
            COALESCE(v.likes_count, 0)::float8 as likes_count,
            COALESCE(v.shares_count, 0)::float8 as shares_count,
            COALESCE(v.comments_count, 0)::float8 as comments_count,
            COALESCE(v.saves_count, 0)::float8 as saves_count,
            v.created_at,
            v.media_group_id,
            ROW_NUMBER() OVER(
              PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END 
              ORDER BY v.created_at ASC
            ) as rn
          FROM videos v 
          ${algoFilter}
        ),
        ScoredCandidates AS (
          SELECT 
            c.id,
            c.category,
            c.created_at,
            (
              (CASE 
                 WHEN c.created_at >= NOW() - INTERVAL '24 hours' THEN 35.0::float8
                 WHEN c.created_at >= NOW() - INTERVAL '3 days' THEN 22.0::float8
                 WHEN c.created_at >= NOW() - INTERVAL '7 days' THEN 12.0::float8
                 ELSE 0.0::float8 
               END)
              + ln(GREATEST(c.likes_count * 3.0 + c.shares_count * 4.0 + 1.0, 1.0)::float8) * 4.0
              + ln(GREATEST(COALESCE(c.views, 0.0), 1.0)::float8 + 1.0) * 1.5
            ) as fresh_score,
            (
              ln(GREATEST(
                1.0 +
                c.likes_count * 3.0 +
                c.shares_count * 4.0 +
                c.comments_count * 3.0 +
                c.saves_count * 4.0 +
                (CASE WHEN c.media_group_id IS NOT NULL AND c.media_group_id != 'none' THEN 3.0 ELSE 0.0 END)
              , 1.0)::float8) * 8.0
              * (0.35 + 0.65 * exp(-1.0 * (EXTRACT(EPOCH FROM (NOW() - COALESCE(c.created_at, NOW())))::float8 / 86400.0) / 14.0))
            ) as eng_score,
            (
              ln(GREATEST(COALESCE(c.views, 0.0), 1.0)::float8 + 1.0) * 4.5 +
              ln(GREATEST(c.likes_count + 1.0, 1.0)::float8) * 3.0
            ) as viral_score,
            (-1.0 * ln(-1.0 * ln(((abs(hashtext(c.id::text || ${seedParam} || 'g_f')) % 998000 + 1000)::float8 / 1000000.0)))) as g_fresh,
            (-1.0 * ln(-1.0 * ln(((abs(hashtext(c.id::text || ${seedParam} || 'g_e')) % 998000 + 1000)::float8 / 1000000.0)))) as g_eng,
            (-1.0 * ln(-1.0 * ln(((abs(hashtext(c.id::text || ${seedParam} || 'g_v')) % 998000 + 1000)::float8 / 1000000.0)))) as g_viral
          FROM CandidatePool c
          WHERE c.rn = 1
        ),
        SessionWeighted AS (
          SELECT *,
            (0.7 + 1.4 * ((abs(hashtext(${seedParam} || 'w_f')) % 1000) / 1000.0)) as w_fresh,
            (0.7 + 1.4 * ((abs(hashtext(${seedParam} || 'w_e')) % 1000) / 1000.0)) as w_eng,
            (0.5 + 1.0 * ((abs(hashtext(${seedParam} || 'w_v')) % 1000) / 1000.0)) as w_viral
          FROM ScoredCandidates
        ),
        RankedIds AS (
          SELECT id,
            ROW_NUMBER() OVER(
              PARTITION BY category 
              ORDER BY (
                (fresh_score * w_fresh + 3.0 * g_fresh) +
                (eng_score * w_eng + 3.0 * g_eng) +
                (viral_score * w_viral + 2.0 * g_viral)
              ) DESC, created_at DESC, id DESC
            ) as cat_rank,
            (abs(hashtext(category || ${seedParam} || 'cat')) % 100) as cat_order,
            (
              (fresh_score * w_fresh + 3.0 * g_fresh) +
              (eng_score * w_eng + 3.0 * g_eng) +
              (viral_score * w_viral + 2.0 * g_viral)
            ) as final_score
          FROM SessionWeighted
        ),
        PagedIds AS (
          SELECT id, cat_rank, cat_order, final_score 
          FROM RankedIds 
          ${pagedOrder}
          ${limitOffsetPlaceholders}
        )
        SELECT v.*, 
          p.cat_rank, p.cat_order, p.final_score,
          COALESCE(au.display_name, au.username, u.username, 'Member') as uploader_name,
          COALESCE(au.username, u.username, 'creator') as uploader_handle,
          COALESCE(au.is_verified, true) as is_verified,
          COALESCE(au.subscription_price, 0) as subscription_price
        FROM PagedIds p
        JOIN videos v ON v.id = p.id
        LEFT JOIN users u ON v.uploader_id = u.user_id
        LEFT JOIN app_users au ON (v.uploader_id::text = au.id::text OR v.uploader_id::text = au.telegram_user_id::text)
        ${finalOrder}
      `;
    } else if (category === "trends") {
      // 🟢 Set the time filter based on the requested timeframe
      if (timeframe === "weekly") {
        timeFilter = `WHERE v.created_at >= NOW() - INTERVAL '7 days' AND ${communityCondition}`;
      } else if (timeframe === "monthly") {
        timeFilter = `WHERE v.created_at >= NOW() - INTERVAL '30 days' AND ${communityCondition}`;
      }

      query = `
        WITH GroupedVideos AS (
          SELECT v.*, 
            ROW_NUMBER() OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END ORDER BY v.views DESC) as rn,
            COUNT(*) OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END) as group_count
          FROM videos v 
          ${timeFilter}
        ),
        PagedVideos AS (
          SELECT * FROM GroupedVideos WHERE rn = 1 ORDER BY views DESC LIMIT $1 OFFSET $2
        )
        SELECT v.*, 
          COALESCE(au.display_name, au.username, u.username, 'Member') as uploader_name,
          COALESCE(au.username, u.username, 'creator') as uploader_handle,
          COALESCE(au.is_verified, true) as is_verified,
          COALESCE(au.subscription_price, 0) as subscription_price
        FROM PagedVideos v 
        LEFT JOIN users u ON v.uploader_id = u.user_id
        LEFT JOIN app_users au ON (v.uploader_id::text = au.id::text OR v.uploader_id::text = au.telegram_user_id::text)
        ORDER BY v.views DESC
      `;
      queryValues = [limit, offset];
    } else if (isRandom) {
      // 🟢 Random sorting across all time (supports deterministic seed for gap-free pagination)
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
            ROW_NUMBER() OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END ORDER BY v.created_at ASC) as rn,
            COUNT(*) OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END) as group_count
          FROM videos v 
          ${catFilter}
        ),
        PagedVideos AS (
          SELECT * FROM GroupedVideos WHERE rn = 1 ${orderClause}
        )
        SELECT v.*, 
          COALESCE(au.display_name, au.username, u.username, 'Member') as uploader_name,
          COALESCE(au.username, u.username, 'creator') as uploader_handle,
          COALESCE(au.is_verified, true) as is_verified,
          COALESCE(au.subscription_price, 0) as subscription_price
        FROM PagedVideos v 
        LEFT JOIN users u ON v.uploader_id = u.user_id
        LEFT JOIN app_users au ON (v.uploader_id::text = au.id::text OR v.uploader_id::text = au.telegram_user_id::text)
      `;
    } else {
      if (hasCategory) {
        queryValues = [category, limit, offset];
      } else {
        queryValues = [limit, offset];
      }

      const limitOffsetPlaceholders = hasCategory ? "LIMIT $2 OFFSET $3" : "LIMIT $1 OFFSET $2";

      query = `
        WITH GroupedVideos AS (
          SELECT v.*, 
            ROW_NUMBER() OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END ORDER BY v.created_at ASC) as rn,
            COUNT(*) OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END) as group_count
          FROM videos v 
          ${catFilter}
        ),
        PagedVideos AS (
          SELECT * FROM GroupedVideos WHERE rn = 1 ORDER BY created_at DESC ${limitOffsetPlaceholders}
        )
        SELECT v.*, 
          COALESCE(au.display_name, au.username, u.username, 'Member') as uploader_name,
          COALESCE(au.username, u.username, 'creator') as uploader_handle,
          COALESCE(au.is_verified, true) as is_verified,
          COALESCE(au.subscription_price, 0) as subscription_price
        FROM PagedVideos v 
        LEFT JOIN users u ON v.uploader_id = u.user_id
        LEFT JOIN app_users au ON (v.uploader_id::text = au.id::text OR v.uploader_id::text = au.telegram_user_id::text)
        ORDER BY v.created_at DESC
      `;
    }

    let countPromise;
    if (isAlgo) {
      countPromise = Promise.resolve(1000);
    } else {
      let countQuery;
      let countValues;
      let cacheKey;
      if (category === "trends") {
        countQuery = `SELECT COUNT(DISTINCT CASE WHEN media_group_id IS NOT NULL AND media_group_id != 'none' THEN media_group_id ELSE message_id END) FROM videos v ${timeFilter}`;
        countValues = [];
        cacheKey = `count:trends:${timeframe}:${isCommunity}`;
      } else if (category && category !== "all" && category !== "community") {
        countQuery = `SELECT COUNT(DISTINCT CASE WHEN media_group_id IS NOT NULL AND media_group_id != 'none' THEN media_group_id ELSE message_id END) FROM videos v WHERE (category = $1 OR ($1 = 'amateurs' AND category = 'amateur')) AND ${communityCondition}`;
        countValues = [category];
        cacheKey = `count:${category}:${isCommunity}`;
      } else {
        countQuery = `SELECT COUNT(DISTINCT CASE WHEN media_group_id IS NOT NULL AND media_group_id != 'none' THEN media_group_id ELSE message_id END) FROM videos v WHERE ${communityCondition}`;
        countValues = [];
        cacheKey = `count:all:${isCommunity}`;
      }

      const now = Date.now();
      const cachedCount = countCache.get(cacheKey);
      if (cachedCount && (now - cachedCount.timestamp < COUNT_CACHE_TTL)) {
        countPromise = Promise.resolve(cachedCount.total);
      } else {
        countPromise = pool.query(countQuery, countValues).then(res => {
          const total = Number(res.rows[0]?.count || 0);
          countCache.set(cacheKey, { total, timestamp: Date.now() });
          return total;
        }).catch(err => {
          console.error("Count query error:", err);
          return 0;
        });
      }
    }

    let suggestPromise;
    if (page === 1 && !isAlgo) {
      const suggestQuery = `
        WITH RandomVideos AS (
          SELECT * FROM videos v
          WHERE ${communityCondition}
          ORDER BY RANDOM() LIMIT 10
        )
        SELECT v.*, 
          COALESCE(au.display_name, au.username, u.username, 'Member') as uploader_name,
          COALESCE(au.username, u.username, 'creator') as uploader_handle,
          COALESCE(au.subscription_price, 0) as subscription_price
        FROM RandomVideos v 
        LEFT JOIN users u ON v.uploader_id = u.user_id 
        LEFT JOIN app_users au ON (v.uploader_id::text = au.id::text OR v.uploader_id::text = au.telegram_user_id::text)
      `;
      suggestPromise = pool.query(suggestQuery).then(res => res.rows).catch(err => {
        console.error("Suggest query error:", err);
        return [];
      });
    } else {
      suggestPromise = Promise.resolve([]);
    }

    const [videosRes, total, suggestions] = await Promise.all([
      pool.query(query, queryValues),
      countPromise,
      suggestPromise
    ]);

    const rawVideos = isAlgo ? interleaveByAuthor(videosRes.rows, 2) : videosRes.rows;

    res.json({
      page,
      limit,
      total,
      hasMore: (offset + videosRes.rows.length) < total,
      videos: rawVideos.map(v => mapVideoToResponse(v, apiBaseUrl)),
      suggestions: suggestions.map(v => mapVideoToResponse(v, apiBaseUrl))
    });
  } catch (err) {
    console.error("DB Error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

/* =====================
   COMMUNITY VIDEOS ENDPOINT
   Exclusively returns contents posted by web creators (and no one else)
===================== */
app.get("/api/community/videos", async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.max(1, Math.min(50, Number(req.query.limit || 12)));
    const offset = (page - 1) * limit;
    const q = req.query.q ? String(req.query.q).trim() : "";
    const apiBaseUrl = process.env.API_BASE_URL;

    let searchClause = "";
    let searchClauseCount = "";
    let queryValues = [limit, offset];
    let countValues = [];
    if (q) {
      searchClause = "AND (v.caption ILIKE $3 OR au.username ILIKE $3 OR au.display_name ILIKE $3)";
      searchClauseCount = "AND (v.caption ILIKE $1 OR au.username ILIKE $1 OR au.display_name ILIKE $1)";
      queryValues = [limit, offset, `%${q}%`];
      countValues = [`%${q}%`];
    }

    const query = `
      WITH GroupedVideos AS (
        SELECT v.*, 
          ROW_NUMBER() OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END ORDER BY v.created_at ASC) as rn,
          COUNT(*) OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END) as group_count
        FROM videos v 
        LEFT JOIN app_users au ON (v.uploader_id = au.id OR v.uploader_id = au.telegram_user_id)
        WHERE ${IS_COMMUNITY_SQL}
        ${searchClause}
      ),
      PagedVideos AS (
        SELECT * FROM GroupedVideos WHERE rn = 1 ORDER BY created_at DESC LIMIT $1 OFFSET $2
      )
      SELECT v.*, 
        COALESCE(au.display_name, au.username, u.username, 'Creator') as uploader_name,
        COALESCE(au.username, u.username, 'creator') as uploader_handle,
        COALESCE(au.subscription_price, 0) as subscription_price
      FROM PagedVideos v 
      LEFT JOIN users u ON v.uploader_id = u.user_id
      LEFT JOIN app_users au ON (v.uploader_id = au.id OR v.uploader_id = au.telegram_user_id)
      ORDER BY v.created_at DESC
    `;

    const countQuery = `
      SELECT COUNT(DISTINCT CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END) 
      FROM videos v 
      LEFT JOIN app_users au ON (v.uploader_id = au.id OR v.uploader_id = au.telegram_user_id)
      WHERE ${IS_COMMUNITY_SQL}
      ${searchClauseCount}
    `;

    const [videosRes, countRes] = await Promise.all([
      pool.query(query, queryValues),
      pool.query(countQuery, countValues)
    ]);

    const videos = videosRes.rows.map(v => mapVideoToResponse(v, apiBaseUrl));
    const total = Number(countRes.rows[0]?.count || 0);
    const hasMore = offset + videosRes.rows.length < total;

    return res.json({
      success: true,
      page,
      limit,
      total,
      hasMore,
      videos
    });
  } catch (err) {
    console.error("[COMMUNITY VIDEOS ERROR]", err);
    return res.status(500).json({ error: "Failed to fetch community videos" });
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
        COALESCE(au.username, u.username, 'creator') as uploader_handle,
        COALESCE(au.subscription_price, 0) as subscription_price
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
  type: z.enum(["all", "videos", "creators"]).optional().default("all"),
});

app.get("/api/search", async (req, res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  
  const parsed = searchSchema.safeParse(req.query);
  
  if (!parsed.success) {
    const errorMessage = parsed.error?.issues?.[0]?.message || "Invalid search parameters";
    return res.status(400).json({ error: errorMessage });
  }

  const { q, page, limit, type } = parsed.data;

  try {
    const apiBaseUrl = process.env.API_BASE_URL; 
    const offset = (page - 1) * limit;

    // Optional user token identification for is_following check
    let currentUserId = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
        currentUserId = decoded.id || null;
      } catch (e) {}
    }

    const cleanQ = q.replace(/^@/, "").trim();
    const searchParam = `%${cleanQ}%`;

    let formattedCreators = [];
    let formattedVideos = [];
    let hasMore = false;

    // 1. Search Creators if type is 'all' (page 1) or 'creators'
    const shouldSearchCreators = (type === "creators" || (type === "all" && page === 1)) && cleanQ.length > 0;
    
    if (shouldSearchCreators) {
      const creatorLimit = type === "creators" ? limit : 8;
      const creatorOffset = type === "creators" ? offset : 0;

      const creatorQuery = `
        SELECT u.id, u.username, u.display_name, 
               CASE 
                 WHEN u.avatar_url IS NOT NULL AND u.avatar_url != '' AND u.avatar_url NOT LIKE '%default-avatar%' THEN u.avatar_url 
                 ELSE '/api/avatar?user_id=' || COALESCE(u.telegram_user_id, u.id) 
               END as avatar_url, 
               u.banner_url, u.creator_category, 
               u.creator_bio, u.is_verified, u.subscription_price, u.telegram_user_id,
               COALESCE(followers.cnt, 0)::INT as followers_count,
               COALESCE(v_count.cnt, 0)::INT as video_count,
               CASE 
                 WHEN $1::INTEGER IS NOT NULL AND my_follow.id IS NOT NULL THEN TRUE 
                 ELSE FALSE 
               END as is_following
        FROM app_users u
        LEFT JOIN (
          SELECT creator_id, COUNT(*) as cnt 
          FROM creator_follows 
          GROUP BY creator_id
        ) followers ON (followers.creator_id = u.id OR (u.telegram_user_id IS NOT NULL AND followers.creator_id = u.telegram_user_id))
        LEFT JOIN (
          SELECT uploader_id, COUNT(*) as cnt
          FROM videos
          GROUP BY uploader_id
        ) v_count ON (v_count.uploader_id = u.id OR (u.telegram_user_id IS NOT NULL AND v_count.uploader_id = u.telegram_user_id))
        LEFT JOIN creator_follows my_follow ON (
          my_follow.follower_id = $1::INTEGER AND 
          (my_follow.creator_id = u.id OR (u.telegram_user_id IS NOT NULL AND my_follow.creator_id = u.telegram_user_id))
        )
        WHERE (
          u.is_creator = TRUE 
          OR u.is_managed = TRUE
          OR u.subscription_price > 0
          OR u.role = 'creator'
          OR u.email LIKE 'tg_%@internal.naijahomemade.com' 
          OR (u.telegram_user_id IS NOT NULL AND (u.telegram_user_id > 10000000 OR u.telegram_user_id < 0))
        )
        AND (u.username ILIKE $2 OR u.display_name ILIKE $2 OR u.creator_category ILIKE $2 OR u.creator_bio ILIKE $2)
        ORDER BY 
          CASE WHEN LOWER(u.username) = LOWER($3) THEN 1
               WHEN LOWER(u.username) LIKE LOWER($3) || '%' THEN 2
               WHEN LOWER(COALESCE(u.display_name, '')) = LOWER($3) THEN 3
               ELSE 4
          END,
          followers_count DESC, video_count DESC, u.id DESC
        LIMIT $4 OFFSET $5
      `;

      const creatorRes = await pool.query(creatorQuery, [
        currentUserId, 
        searchParam, 
        cleanQ, 
        creatorLimit, 
        creatorOffset
      ]);

      formattedCreators = creatorRes.rows.map(c => ({
        id: c.id,
        username: c.username,
        display_name: c.display_name || c.username,
        avatar_url: c.avatar_url && c.avatar_url.startsWith("/api/avatar") && apiBaseUrl 
          ? `${apiBaseUrl}${c.avatar_url}` 
          : (c.avatar_url || "/assets/default-avatar.png"),
        banner_url: c.banner_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80",
        creator_category: c.creator_category || "Model & Creator",
        creator_bio: c.creator_bio || "",
        is_verified: Boolean(c.is_verified),
        subscription_price: Number(c.subscription_price || 0),
        telegram_user_id: c.telegram_user_id,
        followers_count: Number(c.followers_count || 0),
        video_count: Number(c.video_count || 0),
        is_following: Boolean(c.is_following)
      }));
    }

    // 2. Search Videos if type is 'all' or 'videos'
    if (type === "all" || type === "videos") {
      const isCommunity = req.query.community === "true" || req.query.category === "community";
      const communityCondition = isCommunity ? "v.is_community = TRUE AND (v.status = 'ready' OR v.status IS NULL) AND (v.flags_count < 5 OR v.flags_count IS NULL) AND (au.is_banned IS NOT TRUE OR au.is_banned IS NULL)" : "(v.is_community IS NOT TRUE)";

      const searchQuery = `
        SELECT v.*, 
          COALESCE(au.display_name, au.username, u.username, 'Member') as uploader_name,
          COALESCE(au.username, u.username, 'creator') as uploader_handle,
          COALESCE(au.subscription_price, 0) as subscription_price
        FROM videos v 
        LEFT JOIN users u ON v.uploader_id = u.user_id 
        LEFT JOIN app_users au ON (v.uploader_id = au.id OR v.uploader_id = au.telegram_user_id)
        WHERE ${communityCondition}
          AND (v.caption ILIKE $1 OR u.username ILIKE $1 OR au.username ILIKE $1 OR au.display_name ILIKE $1)
        ORDER BY v.created_at DESC 
        LIMIT $2 OFFSET $3
      `;
      
      const { rows } = await pool.query(searchQuery, [searchParam, limit, offset]);
      formattedVideos = rows.map(v => mapVideoToResponse(v, apiBaseUrl));
    }

    if (type === "creators") {
      hasMore = formattedCreators.length === limit;
    } else {
      hasMore = formattedVideos.length === limit;
    }

    res.json({ 
      creators: formattedCreators,
      videos: formattedVideos,
      hasMore,
      type
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
      SELECT v.chat_id, v.message_id, v.caption, v.views, v.uploader_id, v.category,
             COALESCE(au.display_name, au.username, u.username, 'Member') as uploader_name,
             COALESCE(au.username, u.username, 'creator') as uploader_handle,
             COALESCE(au.subscription_price, 0) as subscription_price
      FROM videos v 
      LEFT JOIN users u ON v.uploader_id = u.user_id 
      LEFT JOIN app_users au ON (v.uploader_id = au.id OR v.uploader_id = au.telegram_user_id)
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
               cf.creator_id = $2::BIGINT 
               OR cf.creator_id IN (SELECT id FROM app_users WHERE telegram_user_id = $2::BIGINT OR id = $2::BIGINT)
               OR cf.creator_id IN (SELECT telegram_user_id FROM app_users WHERE id = $2::BIGINT OR telegram_user_id = $2::BIGINT)
             )
           LIMIT 1`,
          [user_id, uploaderId]
        ),
        pool.query(
          `SELECT 1 FROM creator_subscriptions cs
           WHERE cs.subscriber_id = $1 
             AND (
               cs.creator_id = $2::BIGINT 
               OR cs.creator_id IN (SELECT id FROM app_users WHERE telegram_user_id = $2::BIGINT OR id = $2::BIGINT)
               OR cs.creator_id IN (SELECT telegram_user_id FROM app_users WHERE id = $2::BIGINT OR telegram_user_id = $2::BIGINT)
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
      SELECT v.*, 
        COALESCE(au.display_name, au.username, u.username, 'Member') as uploader_name,
        COALESCE(au.username, u.username, 'creator') as uploader_handle
      FROM likes l
      JOIN videos v ON l.message_id = v.message_id
      LEFT JOIN users u ON v.uploader_id = u.user_id
      LEFT JOIN app_users au ON (v.uploader_id = au.id OR v.uploader_id = au.telegram_user_id)
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
        COALESCE(au.username, u.username, 'creator') as uploader_handle,
        COALESCE(au.subscription_price, 0) as subscription_price
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
      LEFT JOIN app_users u ON c.user_id = u.id
      WHERE c.message_id = $1
      ORDER BY c.created_at DESC
      LIMIT 100
    `, [message_id]);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch comments" });
  }
});

// 🟢 REPORT A VIDEO FOR ABUSE / COPYRIGHT / ILLEGAL CONTENT
app.post("/api/videos/:message_id/report", async (req, res) => {
  try {
    const { message_id } = req.params;
    const { reason, details } = req.body;

    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: "Please select a reason for reporting." });
    }

    // Extract user id if logged in
    let reporterId = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = jwt.verify(authHeader.split(" ")[1], JWT_SECRET);
        reporterId = decoded.id;
      } catch (e) {}
    }

    const reporterIp = req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "";
    const cleanReason = String(reason).trim().slice(0, 100);
    const cleanDetails = details ? String(details).trim().slice(0, 500) : "";

    // Verify video exists
    const vidCheck = await pool.query("SELECT id, message_id FROM videos WHERE message_id = $1 LIMIT 1", [message_id]);
    if (vidCheck.rows.length === 0) {
      return res.status(404).json({ error: "Video not found." });
    }

    // Insert report (prevent duplicate reporting by same user)
    const reportRes = await pool.query(
      `INSERT INTO video_reports (message_id, reporter_id, reporter_ip, reason, details, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       ON CONFLICT (message_id, reporter_id) DO NOTHING
       RETURNING id`,
      [message_id, reporterId, String(reporterIp).slice(0, 50), cleanReason, cleanDetails]
    );

    // If already reported by this user, return graceful message
    if (reportRes.rowCount === 0 && reporterId) {
      return res.json({ success: true, message: "You have already submitted a report for this video." });
    }

    // Increment flags_count on videos table
    const updateRes = await pool.query(
      `UPDATE videos 
       SET flags_count = COALESCE(flags_count, 0) + 1,
           status = CASE WHEN COALESCE(flags_count, 0) + 1 >= 5 THEN 'flagged' ELSE status END
       WHERE message_id = $1 
       RETURNING flags_count, status`,
      [message_id]
    );

    if (updateRes.rows.length > 0 && updateRes.rows[0].flags_count >= 5) {
      console.warn(`⚠️ [AUTO-MODERATION] Video ${message_id} reached ${updateRes.rows[0].flags_count} flags and was automatically hidden.`);
    }

    return res.json({ 
      success: true, 
      message: "Thank you. Your report has been submitted for moderation review." 
    });
  } catch (err) {
    console.error("[REPORT VIDEO ERROR]", err);
    return res.status(500).json({ error: "Failed to submit report. Please try again." });
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

// 🟢 In-memory caches to eliminate redundant network & DB roundtrips under high concurrency
const existingR2Thumbs = new Set();
const avatarUrlCache = new Map(); // identifier -> { targetUrl, expiresAt }

app.get("/api/thumbnail", async (req, res) => {
  const { chat_id, message_id } = req.query;
  // If invalid request, return clean dark SVG fallback
  if (!chat_id || !message_id) {
    res.set({ "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400", "Access-Control-Allow-Origin": "*" });
    return res.send(FALLBACK_THUMB_SVG);
  }
  
  const fileName = `thumbs/${chat_id}_${message_id}.jpg`;
  const r2PublicDomain = process.env.R2_PUBLIC_DOMAIN || 'https://bucket.naijahomemade.com';

  // 🟢 1. Fast-Path: If already verified in R2, redirect to Cloudflare R2 CDN instantly (< 1ms)
  if (existingR2Thumbs.has(fileName)) {
    res.set({
      "Cache-Control": "public, max-age=604800, s-maxage=2592000, immutable",
      "Access-Control-Allow-Origin": "*"
    });
    return res.redirect(301, `${r2PublicDomain}/${fileName}`);
  }

  try {
    // 2. Check if already in R2 via fast HeadObjectCommand
    try {
      await r2.send(new HeadObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: fileName
      }));
      existingR2Thumbs.add(fileName);
      res.set({
        "Cache-Control": "public, max-age=604800, s-maxage=2592000, immutable",
        "Access-Control-Allow-Origin": "*"
      });
      return res.redirect(301, `${r2PublicDomain}/${fileName}`);
    } catch (r2Err) {
      // Not in R2 yet, fall through to Telegram DB fetch
    }

    // 3. Fetch from Telegram DB
    const dbRes = await pool.query(
      "SELECT thumb_file_id, cloudflare_id FROM videos WHERE chat_id=$1 AND message_id=$2 LIMIT 1", 
      [chat_id, message_id]
    );
    
    // If video is hosted on Cloudflare Stream, redirect to high-res Cloudflare thumbnail
    if (dbRes.rows[0]?.cloudflare_id && dbRes.rows[0].cloudflare_id !== "none" && !dbRes.rows[0].cloudflare_id.startsWith("r2:")) {
      const cleanId = dbRes.rows[0].cloudflare_id.split('?')[0];
      res.set({
        "Cache-Control": "public, max-age=604800, s-maxage=2592000, immutable",
        "Access-Control-Allow-Origin": "*"
      });
      return res.redirect(301, `https://videodelivery.net/${cleanId}/thumbnails/thumbnail.jpg?time=1s&height=600`);
    }

    if (!dbRes.rows.length || !dbRes.rows[0].thumb_file_id) {
      res.set({ "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400", "Access-Control-Allow-Origin": "*" });
      return res.send(FALLBACK_THUMB_SVG);
    }

    // 4. Strict 5-second timeout on Telegram getFile and download to eliminate 504 timeouts
    const fileRes = await axios.get(`${TELEGRAM_API}/getFile`, { 
      params: { file_id: dbRes.rows[0].thumb_file_id },
      timeout: 5000 
    });
    const imageRes = await axios.get(`${TELEGRAM_FILE_API}/${fileRes.data.result.file_path}`, { 
      responseType: "arraybuffer",
      timeout: 6000 
    });
    const buffer = Buffer.from(imageRes.data);

    // 5. Upload to R2 in the background for all subsequent requests
    r2.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: buffer,
      ContentType: "image/jpeg"
    }))
    .then(() => existingR2Thumbs.add(fileName))
    .catch(e => console.error("R2 Background Upload Failed:", e.message));

    res.set({
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=604800, s-maxage=2592000, immutable",
      "Access-Control-Allow-Origin": "*"
    });
    return res.send(buffer);

  } catch (err) {
    // Failsafe: return clean SVG placeholder with short cache so it retries without hanging
    res.set({ "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=300", "Access-Control-Allow-Origin": "*" });
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
   🟢 BULLETPROOF AVATAR ROUTE (Cached & Timeout-Protected)
======================================================= */
app.get("/api/avatar", async (req, res) => {
  try {
    const rawId = req.query.user_id || req.query.username || req.query.channel;
    
    // Prevent bad requests from breaking the image
    if (!rawId || rawId === 'undefined' || rawId === 'null') {
      return res.redirect('/assets/default-avatar.png');
    }

    const cleanStr = String(rawId).trim();

    // 🟢 1. Fast-Path: In-memory cache hit (1 hour TTL)
    const cached = avatarUrlCache.get(cleanStr);
    if (cached && cached.expiresAt > Date.now()) {
      return res.redirect(cached.targetUrl);
    }

    const numericId = /^-?\d+$/.test(cleanStr) ? Number(cleanStr) : null;

    // Check if user exists in app_users and has a custom avatar_url
    let userRow = null;
    try {
      const userRes = await pool.query(
        `SELECT id, username, telegram_user_id, source_channel, avatar_url, creator_bio, display_name 
         FROM app_users 
         WHERE ${numericId !== null ? "(id = $1::BIGINT OR telegram_user_id = $1::BIGINT) OR" : ""} 
               (username IS NOT NULL AND LOWER(username) = LOWER($2)) 
         LIMIT 1`,
        numericId !== null ? [numericId, cleanStr] : [cleanStr]
      );
      if (userRes.rows.length > 0) {
        userRow = userRes.rows[0];
        if (userRow.avatar_url && 
            !userRow.avatar_url.includes('/api/avatar') && 
            !userRow.avatar_url.includes('default-avatar')) {
          avatarUrlCache.set(cleanStr, { targetUrl: userRow.avatar_url, expiresAt: Date.now() + 3600000 });
          return res.redirect(userRow.avatar_url);
        }
      }
    } catch (dbErr) {
      // Ignore DB error and proceed to Telegram photo lookup
    }

    // Determine candidate identifiers to query on Telegram
    const candidates = [];
    if (userRow?.source_channel) candidates.push(userRow.source_channel);
    if (userRow?.telegram_user_id) candidates.push(String(userRow.telegram_user_id));
    if (numericId !== null) candidates.push(String(numericId));
    if (userRow?.username && !userRow.username.startsWith("tg_")) candidates.push(`@${userRow.username}`);
    if (cleanStr.startsWith("@") || cleanStr.startsWith("http")) candidates.push(cleanStr);
    else if (numericId === null) candidates.push(`@${cleanStr}`);

    let fileId = null;
    let foundChatData = null;

    for (const target of candidates) {
      const chatRes = await fetchTelegramChat(target);
      if (chatRes.ok && chatRes.data) {
        foundChatData = chatRes.data;
        if (chatRes.data.photo) {
          fileId = chatRes.data.photo.big_file_id || chatRes.data.photo.small_file_id;
          break;
        }
      }
    }

    // If channel photo not found, and we have a positive user ID, try getUserProfilePhotos
    const targetUserId = userRow?.telegram_user_id || (numericId && numericId > 0 ? numericId : null);
    if (!fileId && targetUserId && Number(targetUserId) > 0) {
      try {
        const photosRes = await axios.get(`${TELEGRAM_API}/getUserProfilePhotos`, {
          params: { user_id: targetUserId, limit: 1 },
          timeout: 4000
        });
        const photos = photosRes.data?.result?.photos;
        if (photos && photos.length > 0) {
          fileId = photos[0][photos[0].length - 1]?.file_id || photos[0][0]?.file_id;
        }
      } catch (e) {}
    }

    // If bio was returned from getChat and userRow has generic/empty bio, update in background
    if (userRow && foundChatData) {
      const newBio = foundChatData.description || foundChatData.bio;
      if (newBio && (!userRow.creator_bio || userRow.creator_bio.startsWith("Official creator channel") || userRow.creator_bio.startsWith("Official Telegram channel"))) {
        pool.query("UPDATE app_users SET creator_bio = $1 WHERE id = $2", [newBio.trim().slice(0, 500), userRow.id]).catch(() => {});
      }
    }

    if (!fileId) {
      avatarUrlCache.set(cleanStr, { targetUrl: '/assets/default-avatar.png', expiresAt: Date.now() + 300000 });
      return res.redirect('/assets/default-avatar.png');
    }

    const fileRes = await axios.get(`${TELEGRAM_API}/getFile`, { params: { file_id: fileId }, timeout: 5000 });
    const imageRes = await axios.get(`${TELEGRAM_FILE_API}/${fileRes.data.result.file_path}`, { responseType: "arraybuffer", timeout: 6000 });
    
    res.set({
      "Content-Type": "image/jpeg",
      "Cache-Control": "public, max-age=604800, s-maxage=2592000, immutable", 
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

Sitemap: https://naijahomemade.com/sitemap.xml
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

    const baseUrl = process.env.FRONTEND_URL || 'https://naijahomemade.com';
    const apiBaseUrl = process.env.API_BASE_URL || 'https://naijahomemade.com';
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

  // Intercept root, /explore, and public legal policy paths
  const legalPaths = ['/privacy', '/privacy-policy', '/terms', '/terms-of-service', '/tos', '/dmca', '/2257', '/about', '/contact', '/cookies'];
  if (req.path !== '/' && req.path !== '/explore' && !legalPaths.includes(req.path)) {
    return next();
  }

  try {
    const frontendUrl = process.env.FRONTEND_URL || 'https://naijahomemade.com';
    const appName = process.env.APP_NAME || 'NaijaHomemade';
    let pageTitle = 'Naija Homemade Videos - NaijaPorn & Trending Nigerian Creators | Naijahomemade';
    let description = 'Watch Best Naija Homemade porn videos for free on Naijahomemade.com. Discover high quality Most Relevant Naija XXX movies, leaks, and verified creator clips.';
    let canonicalUrl = `${frontendUrl}/`;
    let robots = 'index, follow, max-image-preview:large, max-video-preview:-1';

    if (req.path === '/privacy' || req.path === '/privacy-policy') {
      pageTitle = 'Privacy Policy - NaijaHomemade';
      description = 'Official Privacy Notice and data protection policies for NaijaHomemade.';
      canonicalUrl = `${frontendUrl}/privacy`;
    } else if (req.path === '/terms' || req.path === '/terms-of-service' || req.path === '/tos') {
      pageTitle = 'Terms of Service - NaijaHomemade';
      description = 'Official Terms of Service and user agreement for NaijaHomemade.';
      canonicalUrl = `${frontendUrl}/terms`;
    } else if (req.path === '/about') {
      pageTitle = 'About Us - NaijaHomemade';
      description = 'Learn about NaijaHomemade, the premier African video creator platform and streaming community.';
      canonicalUrl = `${frontendUrl}/about`;
    } else if (req.path === '/explore') {
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
      if (req.path === '/privacy' || req.path === '/privacy-policy') {
        html = html.replace('<div id="root"></div>', `<div id="root">${getPrivacyHtml()}</div>`);
      } else if (req.path === '/terms' || req.path === '/terms-of-service' || req.path === '/tos') {
        html = html.replace('<div id="root"></div>', `<div id="root">${getTermsHtml()}</div>`);
      } else if (req.path === '/about') {
        html = html.replace('<div id="root"></div>', `<div id="root">${getAboutHtml()}</div>`);
      }
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

// 🟢 SSR for Google OAuth verification, Trust & Safety reviewers, and legal crawlers
app.get(['/privacy', '/privacy-policy', '/terms', '/terms-of-service', '/tos', '/about'], (req, res) => {
  try {
    let html = getTemplate();
    if (req.path === '/privacy' || req.path === '/privacy-policy') {
      html = html.replace('<div id="root"></div>', `<div id="root">${getPrivacyHtml()}</div>`);
    } else if (req.path === '/terms' || req.path === '/terms-of-service' || req.path === '/tos') {
      html = html.replace('<div id="root"></div>', `<div id="root">${getTermsHtml()}</div>`);
    } else if (req.path === '/about') {
      html = html.replace('<div id="root"></div>', `<div id="root">${getAboutHtml()}</div>`);
    }
    res.setHeader('Content-Type', 'text/html; charset=UTF-8');
    return res.send(html);
  } catch (err) {
    res.sendFile(path.join(__dirname, '../frontend/dist', 'index.html'));
  }
});

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