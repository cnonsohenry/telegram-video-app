/* =======================================================
   Backend: Creator Routes & Creator Monetization
   File: backend/creator.js
======================================================= */
import express from "express";
import fs from "fs";
import path from "path";
import multer from "multer";
import jwt from "jsonwebtoken";
import pool from "./db.js";
import { authenticateToken, JWT_SECRET } from "./auth.js";
import { 
  uploadVideoToR2, 
  uploadImageToR2,
  generatePresignedUploadUrls, 
  deleteMediaFromR2, 
  verifyR2ObjectExists, 
  ALLOWED_VIDEO_EXTENSIONS, 
  ALLOWED_IMAGE_EXTENSIONS,
  ALLOWED_VIDEO_MIMES, 
  R2_PUBLIC_DOMAIN 
} from "./r2.js";
import { syncTelegramCreatorProfile } from "./telegramCreatorSync.js";

const router = express.Router();

function isAiRefusal(text) {
  if (!text || typeof text !== "string") return false;
  const lower = text.trim().toLowerCase();
  if (!lower) return false;

  const refusalPhrases = [
    "cannot fulfill this request",
    "can't fulfill this request",
    "unable to fulfill this request",
    "unable to fulfill your request",
    "cannot fulfill your request",
    "can't fulfill your request",
    "cannot generate content",
    "can't generate content",
    "unable to generate content",
    "cannot assist with this request",
    "can't assist with this request",
    "unable to assist with this request",
    "cannot create content that",
    "can't create content that",
    "unable to create content that",
    "cannot write content that",
    "can't write content that",
    "i must decline this request",
    "i must decline",
    "i have to decline",
    "safety guidelines",
    "safety policy",
    "safety policies",
    "content policy",
    "content policies",
    "content guidelines",
    "usage policy",
    "usage guidelines",
    "community guidelines",
    "community standards",
    "ethical guidelines",
    "terms of service",
    "sexually explicit",
    "adult content",
    "nsfw content",
    "as an ai",
    "as a language model",
    "as an artificial intelligence",
    "i am an ai",
    "i'm an ai",
    "my programming",
    "violates my policy",
    "violates our policy",
    "violates the policy",
    "against my policy",
    "against our policy",
    "against the policy",
    "against my guidelines",
    "against our guidelines",
    "against the guidelines",
    "i am programmed to follow",
    "i'm programmed to follow",
    "i am not permitted to",
    "i'm not permitted to",
    "i am not allowed to",
    "i'm not allowed to",
    "cannot comply with",
    "can't comply with",
    "cannot help with that",
    "can't help with that",
    "unable to assist with that",
    "cannot fulfill requests",
    "can't fulfill requests",
    "unable to fulfill requests",
    "cannot write captions for adult",
    "cannot generate captions for adult"
  ];

  if (refusalPhrases.some(phrase => lower.includes(phrase))) {
    return true;
  }

  const refusalActionRegex = /(?:i\s+(?:can(?:not|'t)|am\s+unable\s+to|must\s+decline)|unable\s+to)\s+(?:fulfill|generate|create|write|assist|provide|comply|produce|process|help\s+with)/i;
  if (refusalActionRegex.test(lower)) return true;

  const apologyRefusalRegex = /(?:sorr(?:y|ies)|apolog(?:y|ize|ies))\b.*?\b(?:can(?:not|'t)|unable\s+to|not\s+allowed|not\s+permitted|cannot\s+assist)/i;
  if (apologyRefusalRegex.test(lower)) return true;

  const policyRegex = /(?:polic(?:y|ies)|guidelines?)\s+(?:prevents?|prohibits?|restricts?|forbids?|does\s+not\s+allow)/i;
  if (policyRegex.test(lower)) return true;

  return false;
}

/**
 * Enforces upload abuse protection:
 * 1. Checks if creator is banned.
 * 2. Enforces a 60-second cooldown between consecutive uploads.
 * 3. Enforces daily 24-hour quota (5 for unverified creators, 20 for verified creators, unlimited for admin).
 */
async function checkCreatorUploadQuota(userId, creator) {
  if (creator.is_banned) {
    const err = new Error(creator.ban_reason || "Your account has been suspended from publishing content.");
    err.statusCode = 403;
    throw err;
  }

  // Admins are exempt from rate limits and daily quotas
  if (creator.role === "admin") return;

  // 1. Cooldown check: 60 seconds
  const lastVidRes = await pool.query(
    `SELECT created_at FROM videos WHERE uploader_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [userId]
  );
  if (lastVidRes.rows.length > 0) {
    const lastTime = new Date(lastVidRes.rows[0].created_at).getTime();
    const elapsedSec = (Date.now() - lastTime) / 1000;
    if (elapsedSec < 60) {
      const waitSec = Math.ceil(60 - elapsedSec);
      const err = new Error(`Please wait ${waitSec} second${waitSec === 1 ? '' : 's'} before publishing another video.`);
      err.statusCode = 429;
      throw err;
    }
  }

  // 2. 24-hour daily quota
  const dailyRes = await pool.query(
    `SELECT COUNT(*) as cnt FROM videos 
     WHERE uploader_id = $1 
       AND created_at > NOW() - INTERVAL '24 hours'`,
    [userId]
  );
  const dailyCount = parseInt(dailyRes.rows[0]?.cnt || "0", 10);
  const dailyLimit = creator.is_verified ? 20 : 5;

  if (dailyCount >= dailyLimit) {
    const err = new Error(
      `Daily upload limit reached (${dailyCount}/${dailyLimit} videos in 24 hours). ` +
      (creator.is_verified 
        ? "Please wait until tomorrow to post more videos." 
        : "Complete Creator Verification in settings to increase your daily limit to 20 videos.")
    );
    err.statusCode = 429;
    throw err;
  }
}

// Automatically strip leading @ from :username param across all creator routes
router.param("username", (req, res, next, val) => {
  req.params.username = val ? String(val).replace(/^@/, "").trim() : val;
  next();
});

const upload = multer({ 
  dest: "uploads/",
  limits: {
    fileSize: 500 * 1024 * 1024 // 500MB
  }
});

// Optional authentication middleware (doesn't reject if not logged in, but sets req.user if token is valid)
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = { id: decoded.id };
    } catch (e) {}
  }
  next();
};

const formatThumbnailUrl = (v, apiBaseUrl) => {
  if (v.cloudflare_id && v.cloudflare_id !== "none" && !v.cloudflare_id.startsWith("r2:")) {
    const cleanId = v.cloudflare_id.split("?")[0];
    return `https://videodelivery.net/${cleanId}/thumbnails/thumbnail.jpg?time=1s&height=600`;
  }
  return `${apiBaseUrl}/api/thumbnail?chat_id=${v.chat_id}&message_id=${v.message_id}`;
};

/* =======================================================
   0A. UPLOAD IMAGE TO R2 (Avatars, Banners, KYC Documents)
   POST /api/creator/upload-image
======================================================= */
router.post("/upload-image", authenticateToken, upload.single("image"), async (req, res) => {
  const imageFile = req.file;
  const rawFolder = String(req.body.folder || "avatars").toLowerCase().trim();
  const allowedFolders = ["avatars", "banners", "kyc"];
  const folder = allowedFolders.includes(rawFolder) ? rawFolder : "avatars";

  if (!imageFile) {
    return res.status(400).json({ error: "Please select an image file to upload." });
  }

  // 🛑 KYC UPLOAD GUARD: Require verified email before accepting identity document uploads
  if (folder === "kyc") {
    const userRes = await pool.query("SELECT email_verified FROM app_users WHERE id = $1", [req.user.id]);
    if (!userRes.rows[0]?.email_verified) {
      if (fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
      return res.status(403).json({ error: "Please verify your email address before uploading Identity KYC documents." });
    }
  }

  try {
    const ext = path.extname(imageFile.originalname || "").toLowerCase().replace(".", "");
    if (!ALLOWED_IMAGE_EXTENSIONS.includes(ext)) {
      if (fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
      return res.status(400).json({
        error: `Unsupported image format: .${ext || "unknown"}. Allowed: JPG, PNG, WEBP.`
      });
    }

    if (imageFile.size > 15 * 1024 * 1024) {
      if (fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);
      return res.status(400).json({ error: "Image file size must be under 15MB." });
    }

    const r2Res = await uploadImageToR2(imageFile.path, folder, imageFile.originalname);
    if (fs.existsSync(imageFile.path)) fs.unlinkSync(imageFile.path);

    return res.json({
      success: true,
      url: r2Res.url,
      r2Key: r2Res.r2Key
    });
  } catch (err) {
    console.error("[IMAGE UPLOAD ERROR]", err);
    if (imageFile && fs.existsSync(imageFile.path)) {
      try { fs.unlinkSync(imageFile.path); } catch (e) {}
    }
    return res.status(500).json({ error: err.message || "Failed to upload image" });
  }
});

/* =======================================================
   0B. GET KYC & EMAIL VERIFICATION STATUS
   GET /api/creator/kyc/status
======================================================= */
router.get("/kyc/status", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRes = await pool.query(
      `SELECT id, email, username, COALESCE(email_verified, FALSE) as email_verified,
              COALESCE(kyc_status, 'unverified') as kyc_status, kyc_rejection_reason, kyc_verified_at,
              is_creator, is_verified
       FROM app_users WHERE id = $1`,
      [userId]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: "User not found" });

    const kycReqRes = await pool.query(
      `SELECT id, full_name, date_of_birth, country, document_type, document_number,
              id_front_url, id_back_url, selfie_url, status, rejection_reason, submitted_at, reviewed_at
       FROM creator_kyc_requests
       WHERE user_id = $1
       ORDER BY submitted_at DESC LIMIT 1`,
      [userId]
    );

    const u = userRes.rows[0];
    return res.json({
      email: u.email,
      email_verified: Boolean(u.email_verified),
      kyc_status: u.kyc_status || "unverified",
      kyc_rejection_reason: u.kyc_rejection_reason || null,
      kyc_verified_at: u.kyc_verified_at || null,
      is_creator: Boolean(u.is_creator),
      is_verified: Boolean(u.is_verified),
      request: kycReqRes.rows[0] || null
    });
  } catch (err) {
    console.error("[KYC STATUS ERROR]", err);
    return res.status(500).json({ error: "Failed to fetch KYC status" });
  }
});

/* =======================================================
   0C. SUBMIT IDENTITY KYC FOR CREATOR MONETIZATION
   POST /api/creator/kyc/submit
======================================================= */
router.post("/kyc/submit", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const {
    full_name,
    date_of_birth,
    country,
    document_type,
    document_number,
    id_front_url,
    id_back_url,
    selfie_url
  } = req.body;

  try {
    const userRes = await pool.query(
      `SELECT id, username, email, COALESCE(email_verified, FALSE) as email_verified,
              COALESCE(kyc_status, 'unverified') as kyc_status
       FROM app_users WHERE id = $1`,
      [userId]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: "User not found" });
    const user = userRes.rows[0];

    if (!user.email_verified) {
      return res.status(403).json({
        error: "Please verify your email address first before submitting Identity KYC.",
        requires_email_verification: true
      });
    }

    if (user.kyc_status === "verified") {
      return res.status(400).json({ error: "Identity KYC is already verified for this account." });
    }

    // Prevent duplicate submissions within 5 minutes
    const recentSub = await pool.query(
      `SELECT id FROM creator_kyc_requests 
       WHERE user_id = $1 AND submitted_at > NOW() - INTERVAL '5 minutes'`,
      [userId]
    );
    if (recentSub.rows.length > 0) {
      return res.status(429).json({ error: "A KYC verification was recently submitted. Please wait before submitting again." });
    }

    const cleanName = String(full_name || "").trim();
    if (cleanName.length < 3 || cleanName.length > 150) {
      return res.status(400).json({ error: "Please enter your full legal name as shown on your ID." });
    }

    if (!date_of_birth) {
      return res.status(400).json({ error: "Date of birth is required (must be 18+)." });
    }
    const dobDate = new Date(date_of_birth);
    if (isNaN(dobDate.getTime())) {
      return res.status(400).json({ error: "Invalid date of birth." });
    }
    const ageDiffMs = Date.now() - dobDate.getTime();
    const ageYears = ageDiffMs / (1000 * 60 * 60 * 24 * 365.25);
    if (ageYears < 18) {
      return res.status(400).json({ error: "You must be at least 18 years old to verify as a Creator." });
    }

    const allowedDocs = ["national_id", "passport", "drivers_license", "voters_card"];
    const cleanDocType = String(document_type || "national_id").toLowerCase().trim();
    if (!allowedDocs.includes(cleanDocType)) {
      return res.status(400).json({ error: "Invalid ID document type selected." });
    }

    const cleanDocNumber = String(document_number || "").trim().slice(0, 100);
    if (cleanDocNumber.length < 4) {
      return res.status(400).json({ error: "Please enter a valid government ID document number." });
    }

    // 🛡️ SECURITY: Require authentic KYC files uploaded to our verified storage
    const isValidKycMediaUrl = (u) => {
      if (typeof u !== "string" || !u.trim()) return false;
      const cleanUrl = u.trim();
      try {
        if (cleanUrl.startsWith("/kyc/")) return true;
        const parsed = new URL(cleanUrl);
        const allowedHosts = [
          "videos.naijahomemade.com",
          "bucket.naijahomemade.com",
          "naijahomemade.com"
        ];
        if (R2_PUBLIC_DOMAIN) {
          try {
            allowedHosts.push(new URL(R2_PUBLIC_DOMAIN).hostname);
          } catch (e) {}
        }
        const isAllowedHost = allowedHosts.includes(parsed.hostname) || parsed.hostname.endsWith(".r2.cloudflarestorage.com");
        return isAllowedHost && parsed.pathname.includes("/kyc/");
      } catch (e) {
        return false;
      }
    };

    if (!isValidKycMediaUrl(id_front_url)) {
      return res.status(400).json({ error: "Please upload a valid front photo of your government ID." });
    }
    if (!isValidKycMediaUrl(selfie_url)) {
      return res.status(400).json({ error: "Please upload a valid verification selfie photo." });
    }

    const cleanCountry = String(country || "Nigeria").trim().slice(0, 100);
    const cleanBackUrl = id_back_url ? (isValidKycMediaUrl(id_back_url) ? id_back_url.trim().slice(0, 500) : null) : null;
    if (id_back_url && !cleanBackUrl) {
      return res.status(400).json({ error: "Invalid document back photo URL provided." });
    }

    const kycInsert = await pool.query(
      `INSERT INTO creator_kyc_requests (
         user_id, full_name, date_of_birth, country, document_type, document_number,
         id_front_url, id_back_url, selfie_url, status, submitted_at, reviewed_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'verified', NOW(), NOW())
       RETURNING *`,
      [
        userId,
        cleanName,
        date_of_birth,
        cleanCountry,
        cleanDocType,
        cleanDocNumber,
        id_front_url.slice(0, 500),
        cleanBackUrl,
        selfie_url.slice(0, 500)
      ]
    );

    const updatedUserRes = await pool.query(
      `UPDATE app_users
       SET kyc_status = 'verified',
           kyc_verified_at = NOW(),
           kyc_rejection_reason = NULL,
           is_verified = TRUE
       WHERE id = $1
       RETURNING id, email, username, avatar_url, role, settings, is_premium,
                 is_creator, display_name, creator_bio, banner_url, creator_category,
                 subscription_price, social_links, is_verified, location, website,
                 email_verified, kyc_status, kyc_verified_at`,
      [userId]
    );

    console.log(`[CREATOR KYC] User @${user.username} (ID ${userId}) completed Identity KYC verification!`);
    return res.json({
      success: true,
      message: "Identity KYC verified! You can now activate Creator monetization and set your subscription price.",
      kyc: kycInsert.rows[0],
      user: updatedUserRes.rows[0]
    });
  } catch (err) {
    console.error("[KYC SUBMIT ERROR]", err);
    return res.status(500).json({ error: "Failed to submit Identity KYC verification" });
  }
});

/* =======================================================
   0D. REMOVE A FOLLOWER (Profile Owner Action)
   DELETE /api/creator/followers/:followerId
======================================================= */
router.delete("/followers/:followerId", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const followerId = Number(req.params.followerId);
  if (!followerId || isNaN(followerId)) {
    return res.status(400).json({ error: "Invalid follower ID" });
  }

  try {
    await pool.query(
      `DELETE FROM creator_follows WHERE creator_id = $1 AND follower_id = $2`,
      [userId, followerId]
    );

    const totalRes = await pool.query(
      `SELECT COUNT(*) FROM creator_follows WHERE creator_id = $1`,
      [userId]
    );

    return res.json({
      success: true,
      removed_follower_id: followerId,
      followers_count: Number(totalRes.rows[0]?.count || 0)
    });
  } catch (err) {
    console.error("[REMOVE FOLLOWER ERROR]", err);
    return res.status(500).json({ error: "Failed to remove follower" });
  }
});

/* =======================================================
   1. UPGRADE USER TO CREATOR (Requires Email + Identity KYC)
   POST /api/creator/upgrade
======================================================= */
router.post("/upgrade", authenticateToken, async (req, res) => {
  const {
    display_name,
    creator_bio,
    creator_category,
    subscription_price,
    banner_url,
    social_links,
    location,
    website
  } = req.body;

  try {
    const userId = req.user.id;

    // Check user exists
    const userCheck = await pool.query("SELECT * FROM app_users WHERE id = $1", [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const existing = userCheck.rows[0];
    const isExempt = existing.role === "admin" || existing.is_managed === true;

    if (!isExempt && !existing.email_verified) {
      return res.status(403).json({
        error: "You must verify your email address before upgrading to a Creator account.",
        requires_email_verification: true
      });
    }

    if (!isExempt && existing.kyc_status !== "verified" && !existing.is_verified) {
      return res.status(403).json({
        error: "Identity KYC verification is required to upgrade to Creator and monetize your profile.",
        requires_kyc: true
      });
    }

    const finalDisplayName = (display_name ? String(display_name).trim().slice(0, 100) : null) || existing.display_name || existing.username;
    const finalCategory = (creator_category ? String(creator_category).trim().slice(0, 50) : null) || existing.creator_category || "Model & Creator";
    const finalBio = creator_bio !== undefined ? String(creator_bio).trim().slice(0, 500) : (existing.creator_bio || "");
    const finalPrice = subscription_price !== undefined ? Math.max(0, Math.min(10000000, Number(subscription_price) || 0)) : (Number(existing.subscription_price) || 0);
    const finalBanner = banner_url && typeof banner_url === "string" && (banner_url.startsWith("http://") || banner_url.startsWith("https://") || banner_url.startsWith("/"))
      ? banner_url.slice(0, 500)
      : (existing.banner_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80");
    const finalSocials = social_links && typeof social_links === "object" ? social_links : (existing.social_links || {});
    const finalLocation = location !== undefined ? String(location).trim().slice(0, 100) : (existing.location || "");
    let cleanWebsite = website !== undefined ? String(website).trim().slice(0, 200) : (existing.website || "");
    if (cleanWebsite.toLowerCase().startsWith("javascript:")) cleanWebsite = "";

    const updateQuery = `
      UPDATE app_users 
      SET is_creator = TRUE,
          role = CASE WHEN role = 'admin' THEN 'admin' ELSE 'creator' END,
          is_verified = TRUE,
          display_name = $1,
          creator_category = $2,
          creator_bio = $3,
          subscription_price = $4,
          banner_url = $5,
          social_links = $6,
          location = $7,
          website = $8
      WHERE id = $9
      RETURNING id, email, username, avatar_url, role, settings, is_premium,
                is_creator, display_name, creator_bio, banner_url, creator_category, 
                subscription_price, social_links, is_verified, location, website,
                email_verified, kyc_status, kyc_verified_at;
    `;

    const result = await pool.query(updateQuery, [
      finalDisplayName,
      finalCategory,
      finalBio,
      finalPrice,
      finalBanner,
      JSON.stringify(finalSocials),
      finalLocation,
      cleanWebsite,
      userId
    ]);

    console.log(`[CREATOR] User @${existing.username} (ID ${userId}) upgraded to verified Creator!`);
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("[CREATOR UPGRADE ERROR]", err);
    res.status(500).json({ error: "Failed to upgrade to creator account" });
  }
});

/* =======================================================
   2. UPDATE USER / CREATOR PROFILE
   PATCH & PUT /api/creator/profile
======================================================= */
const handleUpdateProfile = async (req, res) => {
  const {
    display_name,
    creator_bio,
    creator_category,
    subscription_price,
    avatar_url,
    banner_url,
    social_links,
    location,
    website
  } = req.body;

  try {
    const userId = req.user.id;

    const userCheck = await pool.query("SELECT * FROM app_users WHERE id = $1", [userId]);
    if (userCheck.rows.length === 0) return res.status(404).json({ error: "User not found" });
    const existing = userCheck.rows[0];

    const cleanDisplayName = display_name !== undefined ? String(display_name).trim().slice(0, 100) : null;
    const cleanBio = creator_bio !== undefined ? String(creator_bio).trim().slice(0, 500) : null;
    const cleanCategory = creator_category !== undefined ? String(creator_category).trim().slice(0, 50) : null;
    const cleanPrice = subscription_price !== undefined ? Math.max(0, Math.min(10000000, Number(subscription_price) || 0)) : null;

    // 🛑 Enforce Email + KYC verification if attempting to set a non-zero subscription price
    if (cleanPrice !== null && cleanPrice > 0) {
      const isExempt = existing.role === "admin" || existing.is_managed === true;
      if (!isExempt && (!existing.email_verified || (existing.kyc_status !== "verified" && !existing.is_verified))) {
        return res.status(403).json({
          error: "You must verify your email and complete Identity KYC before setting a subscription price to monetize.",
          requires_kyc: true
        });
      }
    }

    const cleanAvatar = avatar_url && typeof avatar_url === "string" && (avatar_url.startsWith("http://") || avatar_url.startsWith("https://") || avatar_url.startsWith("/")) ? avatar_url.slice(0, 500) : null;
    const cleanBanner = banner_url && typeof banner_url === "string" && (banner_url.startsWith("http://") || banner_url.startsWith("https://") || banner_url.startsWith("/")) ? banner_url.slice(0, 500) : null;
    const cleanSocials = social_links && typeof social_links === "object" ? JSON.stringify(social_links) : null;
    const cleanLocation = location !== undefined ? String(location).trim().slice(0, 100) : null;
    let cleanWebsite = website !== undefined ? String(website).trim().slice(0, 200) : null;
    if (cleanWebsite && cleanWebsite.toLowerCase().startsWith("javascript:")) cleanWebsite = "";

    const updateQuery = `
      UPDATE app_users
      SET display_name = COALESCE($1, display_name),
          creator_bio = COALESCE($2, creator_bio),
          creator_category = COALESCE($3, creator_category),
          subscription_price = COALESCE($4, subscription_price),
          avatar_url = COALESCE($5, avatar_url),
          banner_url = COALESCE($6, banner_url),
          social_links = COALESCE($7, social_links),
          location = COALESCE($8, location),
          website = COALESCE($9, website)
      WHERE id = $10
      RETURNING id, email, username, avatar_url, role, settings, is_premium,
                is_creator, display_name, creator_bio, banner_url, creator_category, 
                subscription_price, social_links, is_verified, location, website,
                email_verified, kyc_status, kyc_verified_at;
    `;

    const result = await pool.query(updateQuery, [
      cleanDisplayName,
      cleanBio,
      cleanCategory,
      cleanPrice,
      cleanAvatar,
      cleanBanner,
      cleanSocials,
      cleanLocation,
      cleanWebsite,
      userId
    ]);

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("[CREATOR PROFILE UPDATE ERROR]", err);
    res.status(500).json({ error: "Failed to update profile" });
  }
};

router.patch("/profile", authenticateToken, handleUpdateProfile);
router.put("/profile", authenticateToken, handleUpdateProfile);

/* =======================================================
   2B. CREATOR STUDIO INSIGHTS & ANALYTICS
   GET /api/creator/studio/insights
======================================================= */
router.get("/studio/insights", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const userRes = await pool.query(
      `SELECT id, username, email, display_name, avatar_url, banner_url,
              creator_bio, creator_category, subscription_price, is_verified, is_creator, created_at
       FROM app_users WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const creator = userRes.rows[0];

    // 1. Active subscribers count & list
    const subscribersRes = await pool.query(
      `SELECT cs.id, cs.subscriber_id, cs.amount_paid, cs.status, cs.expires_at, cs.created_at,
              u.username as subscriber_username, u.display_name as subscriber_display_name, u.avatar_url as subscriber_avatar
       FROM creator_subscriptions cs
       JOIN app_users u ON cs.subscriber_id = u.id
       WHERE cs.creator_id = $1 AND cs.status = 'active' AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
       ORDER BY cs.created_at DESC
       LIMIT 50`,
      [userId]
    );

    const subCountRes = await pool.query(
      `SELECT COUNT(*) FROM creator_subscriptions 
       WHERE creator_id = $1 AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId]
    );
    const activeSubscribers = Number(subCountRes.rows[0]?.count || 0);

    // 2. Subscription Revenue USD
    const subRevRes = await pool.query(
      `SELECT COALESCE(SUM(expected_amount), 0) as total_usd, COUNT(*) as tx_count
       FROM transactions
       WHERE creator_id = $1 AND transaction_type = 'creator_sub' AND status = 'APPROVED'`,
      [userId]
    );
    const subscriptionRevenueUsd = Number(subRevRes.rows[0]?.total_usd || 0);

    // 3. Tips received (list + sum)
    const tipsRes = await pool.query(
      `SELECT ct.id, ct.amount, ct.message, ct.created_at,
              u.username as sender_username, u.display_name as sender_display_name, u.avatar_url as sender_avatar
       FROM creator_tips ct
       LEFT JOIN app_users u ON ct.sender_id = u.id
       WHERE ct.creator_id = $1
       ORDER BY ct.created_at DESC
       LIMIT 50`,
      [userId]
    );

    const tipsTotalRes = await pool.query(
      `SELECT COALESCE(SUM(amount), 0) as total_ngn, COUNT(*) as count 
       FROM creator_tips WHERE creator_id = $1`,
      [userId]
    );
    const tipsTotalNgn = Number(tipsTotalRes.rows[0]?.total_ngn || 0);
    const tipsCount = Number(tipsTotalRes.rows[0]?.count || 0);

    // 4. Video Stats
    const videosRes = await pool.query(
      `SELECT v.id, v.chat_id, v.message_id, v.caption, v.category, v.views, v.likes_count, v.comments_count, v.created_at, v.cloudflare_id
       FROM videos v
       LEFT JOIN users u ON v.uploader_id = u.user_id
       WHERE (CAST(v.uploader_id AS TEXT) = CAST($1 AS TEXT) 
          OR LOWER(COALESCE(u.username, '')) = LOWER($2))
          AND (v.status = 'ready' OR v.status IS NULL)
          AND (v.status != 'flagged' AND v.status != 'deleted')
          AND (v.flags_count < 5 OR v.flags_count IS NULL)
       ORDER BY v.views DESC
       LIMIT 30`,
      [userId, creator.username]
    );

    const videoSummaryRes = await pool.query(
      `SELECT COUNT(*) as posts_count, COALESCE(SUM(v.views), 0) as total_views, COALESCE(SUM(v.likes_count), 0) as total_likes
       FROM videos v
       LEFT JOIN users u ON v.uploader_id = u.user_id
       WHERE (CAST(v.uploader_id AS TEXT) = CAST($1 AS TEXT) 
          OR LOWER(COALESCE(u.username, '')) = LOWER($2))
          AND (v.status = 'ready' OR v.status IS NULL)
          AND (v.status != 'flagged' AND v.status != 'deleted')
          AND (v.flags_count < 5 OR v.flags_count IS NULL)`,
      [userId, creator.username]
    );

    const postsCount = Number(videoSummaryRes.rows[0]?.posts_count || 0);
    const totalViews = Number(videoSummaryRes.rows[0]?.total_views || 0);
    const totalLikes = Number(videoSummaryRes.rows[0]?.total_likes || 0);

    const apiBaseUrl = process.env.API_BASE_URL || "https://naijahomemade.com";
    const mappedTopVideos = videosRes.rows.map(v => ({
      ...v,
      thumbnail_url: formatThumbnailUrl(v, apiBaseUrl)
    }));

    res.json({
      creator,
      stats: {
        active_subscribers: activeSubscribers,
        subscription_revenue_usd: subscriptionRevenueUsd,
        tips_total_ngn: tipsTotalNgn,
        tips_count: tipsCount,
        posts_count: postsCount,
        total_views: totalViews,
        total_likes: totalLikes,
        estimated_mrr_ngn: activeSubscribers * Number(creator.subscription_price || 0)
      },
      subscribers: subscribersRes.rows,
      tips: tipsRes.rows,
      top_videos: mappedTopVideos
    });
  } catch (err) {
    console.error("[CREATOR STUDIO INSIGHTS ERROR]", err);
    res.status(500).json({ error: "Failed to fetch studio insights" });
  }
});

/* =======================================================
   2C. USER & CREATOR CONTENT UPLOAD (Public & VIP / Premium)
   POST /api/creator/upload
======================================================= */
router.post("/upload", authenticateToken, upload.single("video"), async (req, res) => {
  const userId = req.user.id;
  const videoFile = req.file;
  const { caption, category, is_premium } = req.body;

  if (!videoFile) {
    return res.status(400).json({ error: "Please select a video file to upload." });
  }

  try {
    // 1. Fetch user
    const userRes = await pool.query(
      `SELECT id, username, display_name, is_creator, role, is_verified, subscription_price,
              COALESCE(email_verified, FALSE) as email_verified, COALESCE(kyc_status, 'unverified') as kyc_status,
              COALESCE(is_banned, FALSE) as is_banned, ban_reason
       FROM app_users WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      if (fs.existsSync(videoFile.path)) fs.unlinkSync(videoFile.path);
      return res.status(404).json({ error: "User account not found." });
    }

    const creator = userRes.rows[0];

    // Enforce account status, cooldown & 24h upload quota
    await checkCreatorUploadQuota(userId, creator);

    // Validate video file extension
    const ext = path.extname(videoFile.originalname || "").toLowerCase().replace(".", "");
    if (!ALLOWED_VIDEO_EXTENSIONS.includes(ext)) {
      if (fs.existsSync(videoFile.path)) fs.unlinkSync(videoFile.path);
      return res.status(400).json({ 
        error: `Unsupported video format: .${ext || "unknown"}. Allowed formats: ${ALLOWED_VIDEO_EXTENSIONS.join(", ").toUpperCase()}` 
      });
    }

    // 2. Ensure uploader exists in users table to satisfy any joins or legacy references
    try {
      await pool.query(
        `INSERT INTO users (user_id, username, full_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE 
         SET username = EXCLUDED.username, full_name = EXCLUDED.full_name`,
        [creator.id, creator.username, creator.display_name || creator.username]
      );
    } catch (uErr) {
      console.warn("[CREATOR UPLOAD] Could not sync to users table:", uErr.message);
    }

    // 3. Determine category (VIP / Premium vs Public Category)
    const isVip = is_premium === true || is_premium === "true" || String(category).toLowerCase() === "premium";

    // 🛑 GUARD: Require verified Creator status + subscription price for VIP Exclusive content
    if (isVip) {
      const isVerifiedCreator = creator.role === "admin" || (creator.is_creator && (creator.kyc_status === "verified" || creator.is_verified));
      if (!isVerifiedCreator) {
        if (fs.existsSync(videoFile.path)) fs.unlinkSync(videoFile.path);
        return res.status(403).json({
          error: "Only verified Creators (Email + Identity KYC verified) can publish VIP Exclusive monetized videos."
        });
      }
      if (Number(creator.subscription_price || 0) <= 0) {
        if (fs.existsSync(videoFile.path)) fs.unlinkSync(videoFile.path);
        return res.status(400).json({
          error: "Please set your monthly VIP subscription price in Creator Studio before publishing VIP Exclusive content."
        });
      }
    }

    const allowedPublicCategories = ["community", "hotties", "amateur", "amateurs", "knacks", "baddies", "college", "trends", "shots", "general"];
    let safeCategory = "community";
    if (isVip) {
      safeCategory = "premium";
    } else if (category && allowedPublicCategories.includes(String(category).toLowerCase().trim())) {
      safeCategory = String(category).toLowerCase().trim();
    }

    let sanitizedCaption = caption ? String(caption).trim().slice(0, 1000) : "";
    if (isAiRefusal(sanitizedCaption)) {
      console.warn(`[CREATOR UPLOAD] ⚠️ Filtered AI refusal caption: '${sanitizedCaption}'. Replacing with fallback.`);
      sanitizedCaption = "Exclusive creator drop 🔥 Catch the full view now 👀";
    }
    const internalId = `${safeCategory}_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    // 4. Upload file and generate thumbnail directly to Cloudflare R2 Bucket
    console.log(`[CREATOR UPLOAD] Uploading media to Cloudflare R2 for @${creator.username} (Category: ${safeCategory})...`);
    const r2Result = await uploadVideoToR2(
      videoFile.path,
      safeCategory,
      internalId,
      videoFile.originalname
    );

    const savedCloudflareId = r2Result.cloudflareId; // 'r2:category/internalId.ext'

    // 5. Insert video record into database (flagged as is_community = TRUE for web creators)
    const insertRes = await pool.query(
      `INSERT INTO videos (
         chat_id, message_id, file_id, uploader_id, category, caption, cloudflare_id, status, is_community, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ready', TRUE, NOW())
       RETURNING id, chat_id, message_id, uploader_id, category, caption, cloudflare_id, is_community, created_at, views, likes_count, comments_count`,
      [
        "internal",
        internalId,
        "none",
        creator.id,
        safeCategory,
        sanitizedCaption,
        savedCloudflareId
      ]
    );

    // 6. Clean up temporary uploaded file
    if (fs.existsSync(videoFile.path)) {
      fs.unlinkSync(videoFile.path);
    }

    const newVideo = insertRes.rows[0];
    const apiBaseUrl = process.env.API_BASE_URL || "https://naijahomemade.com";
    const thumbnailUrl = formatThumbnailUrl(newVideo, apiBaseUrl);
    const videoUrl = r2Result.staticUrl;

    return res.status(201).json({
      success: true,
      message: isVip ? "VIP Exclusive video published to R2!" : "Public video published to R2!",
      video: {
        id: newVideo.id,
        chat_id: newVideo.chat_id,
        message_id: newVideo.message_id,
        uploader_id: newVideo.uploader_id,
        uploader_name: creator.display_name || creator.username,
        category: newVideo.category,
        is_community: true,
        caption: newVideo.caption,
        views: 0,
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        saves_count: 0,
        thumbnail_url: thumbnailUrl,
        video_url: videoUrl,
        is_group: false,
        created_at: newVideo.created_at
      }
    });
  } catch (err) {
    console.error("[CREATOR UPLOAD ERROR]", err);
    if (req.file && fs.existsSync(req.file.path)) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    return res.status(err.statusCode || 500).json({ error: err.message || "Failed to upload video to Cloudflare R2" });
  }
});

/* =======================================================
   5B. DIRECT TO R2: GET PRESIGNED UPLOAD URLS
   POST /api/creator/presigned-url
======================================================= */
router.post("/presigned-url", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { filename, filetype, category, is_premium } = req.body;

  try {
    // 1. Fetch user
    const userRes = await pool.query(
      `SELECT id, username, display_name, is_creator, role, is_verified, subscription_price,
              COALESCE(email_verified, FALSE) as email_verified, COALESCE(kyc_status, 'unverified') as kyc_status,
              COALESCE(is_banned, FALSE) as is_banned, ban_reason
       FROM app_users WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User account not found." });
    }

    const creator = userRes.rows[0];

    // Enforce account status, cooldown & 24h upload quota
    await checkCreatorUploadQuota(userId, creator);

    // Validate video file extension & MIME
    const ext = path.extname(filename || "").toLowerCase().replace(".", "");
    if (!ext || !ALLOWED_VIDEO_EXTENSIONS.includes(ext)) {
      return res.status(400).json({ 
        error: `Invalid file format: .${ext || "unknown"}. Allowed video formats: ${ALLOWED_VIDEO_EXTENSIONS.join(", ").toUpperCase()}` 
      });
    }
    if (filetype && !ALLOWED_VIDEO_MIMES.includes(filetype.toLowerCase()) && !filetype.toLowerCase().startsWith("video/")) {
      return res.status(400).json({ error: "Invalid video MIME type." });
    }

    const isVip = is_premium === true || is_premium === "true" || String(category).toLowerCase() === "premium";

    // Require verified Creator status + subscription price for VIP Exclusive content
    if (isVip) {
      const isVerifiedCreator = creator.role === "admin" || (creator.is_creator && (creator.kyc_status === "verified" || creator.is_verified));
      if (!isVerifiedCreator) {
        return res.status(403).json({
          error: "Only verified Creators (Email + Identity KYC verified) can publish VIP Exclusive monetized videos."
        });
      }
      if (Number(creator.subscription_price || 0) <= 0) {
        return res.status(400).json({
          error: "Please set your monthly VIP subscription price in Creator Studio before publishing VIP Exclusive content."
        });
      }
    }

    const safeCategory = isVip ? "premium" : "community";
    const presignedData = await generatePresignedUploadUrls(safeCategory, filename || "video.mp4", isVip);

    return res.json({
      success: true,
      ...presignedData
    });
  } catch (err) {
    console.error("[PRESIGNED URL ERROR]", err);
    return res.status(err.statusCode || 500).json({ error: err.message || "Failed to generate presigned upload URL" });
  }
});

/* =======================================================
   5C. DIRECT TO R2: COMPLETE & REGISTER VIDEO
   POST /api/creator/complete-upload
======================================================= */
router.post("/complete-upload", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { internalId, category, is_premium, caption, r2Key, thumbKey } = req.body;

  if (!internalId || !r2Key) {
    return res.status(400).json({ error: "Missing required upload parameters (internalId, r2Key)." });
  }

  try {
    const userRes = await pool.query(
      `SELECT id, username, display_name, is_creator, role, is_verified, subscription_price,
              COALESCE(is_banned, FALSE) as is_banned, ban_reason
       FROM app_users WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: "User account not found." });
    }

    const creator = userRes.rows[0];

    if (creator.is_banned) {
      return res.status(403).json({ error: creator.ban_reason || "Your account has been suspended from publishing content." });
    }

    // 1. Verify that r2Key extension is allowed
    const r2Ext = path.extname(r2Key).toLowerCase().replace(".", "");
    if (!ALLOWED_VIDEO_EXTENSIONS.includes(r2Ext)) {
      return res.status(400).json({ error: "Invalid video file extension in cloud key." });
    }

    // 2. Verify that uploaded video object actually exists in Cloudflare R2 and has valid size
    const r2Check = await verifyR2ObjectExists(r2Key);
    if (!r2Check.exists) {
      return res.status(400).json({ 
        error: "Uploaded video file could not be verified in cloud storage. Please try uploading again." 
      });
    }
    if (r2Check.contentLength < 1024) {
      return res.status(400).json({ error: "Uploaded video file is empty or corrupted (under 1KB)." });
    }
    if (r2Check.contentLength > 500 * 1024 * 1024) {
      return res.status(400).json({ error: "Uploaded video file exceeds the maximum allowed 500MB limit." });
    }

    // Ensure creator exists in users table
    try {
      await pool.query(
        `INSERT INTO users (user_id, username, full_name)
         VALUES ($1, $2, $3)
         ON CONFLICT (user_id) DO UPDATE 
         SET username = EXCLUDED.username, full_name = EXCLUDED.full_name`,
        [creator.id, creator.username, creator.display_name || creator.username]
      );
    } catch (uErr) {
      console.warn("[CREATOR COMPLETE] Could not sync to users table:", uErr.message);
    }

    const isVip = is_premium === true || is_premium === "true" || String(category).toLowerCase() === "premium";
    const safeCategory = isVip ? "premium" : "community";
    let sanitizedCaption = caption ? String(caption).trim().slice(0, 1000) : "";
    if (isAiRefusal(sanitizedCaption)) {
      console.warn(`[CREATOR UPLOAD] ⚠️ Filtered AI refusal caption: '${sanitizedCaption}'. Replacing with fallback.`);
      sanitizedCaption = "Exclusive creator drop 🔥 Catch the full view now 👀";
    }
    const savedCloudflareId = `r2:${r2Key}`;

    // Insert video record into database (flagged as is_community = TRUE for web creators)
    const insertRes = await pool.query(
      `INSERT INTO videos (
         chat_id, message_id, file_id, uploader_id, category, caption, cloudflare_id, status, is_community, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ready', TRUE, NOW())
       RETURNING id, chat_id, message_id, uploader_id, category, caption, cloudflare_id, is_community, created_at, views, likes_count, comments_count`,
      [
        "internal",
        internalId,
        "none",
        creator.id,
        safeCategory,
        sanitizedCaption,
        savedCloudflareId
      ]
    );

    const newVideo = insertRes.rows[0];
    const apiBaseUrl = process.env.API_BASE_URL || "https://naijahomemade.com";
    const thumbnailUrl = formatThumbnailUrl(newVideo, apiBaseUrl);
    const videoUrl = `${R2_PUBLIC_DOMAIN}/${r2Key}`;

    return res.status(201).json({
      success: true,
      message: isVip ? "VIP Exclusive video published to R2!" : "Public video published to R2!",
      video: {
        id: newVideo.id,
        chat_id: newVideo.chat_id,
        message_id: newVideo.message_id,
        uploader_id: newVideo.uploader_id,
        uploader_name: creator.display_name || creator.username,
        category: newVideo.category,
        is_community: true,
        caption: newVideo.caption,
        views: 0,
        likes_count: 0,
        comments_count: 0,
        shares_count: 0,
        saves_count: 0,
        thumbnail_url: thumbnailUrl,
        video_url: videoUrl,
        is_group: false,
        created_at: newVideo.created_at
      }
    });
  } catch (err) {
    console.error("[CREATOR COMPLETE ERROR]", err);
    return res.status(500).json({ error: err.message || "Failed to complete video registration" });
  }
});

/* =======================================================
   2D. CREATOR DELETE VIDEO
   DELETE /api/creator/videos/:message_id
======================================================= */
router.delete("/videos/:message_id", authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { message_id } = req.params;

  try {
    const videoRes = await pool.query(
      `SELECT id, chat_id, message_id, uploader_id, cloudflare_id 
       FROM videos 
       WHERE message_id = $1`,
      [message_id]
    );

    if (videoRes.rows.length === 0) {
      return res.status(404).json({ error: "Video not found." });
    }

    const video = videoRes.rows[0];

    // Check user ownership or admin role
    const userRes = await pool.query(`SELECT role FROM app_users WHERE id = $1`, [userId]);
    const userRole = userRes.rows[0]?.role;

    if (Number(video.uploader_id) !== Number(userId) && userRole !== "admin") {
      return res.status(403).json({ error: "You are not authorized to delete this video." });
    }

    // Delete related rows
    await pool.query(`DELETE FROM likes WHERE message_id = $1`, [message_id]);
    await pool.query(`DELETE FROM comments WHERE message_id = $1`, [message_id]);
    await pool.query(`DELETE FROM bookmarks WHERE message_id = $1`, [message_id]);
    await pool.query(`DELETE FROM videos WHERE message_id = $1`, [message_id]);

    // Attempt deletion from Cloudflare R2 bucket or Cloudflare Stream
    if (video.cloudflare_id && video.cloudflare_id.startsWith("r2:")) {
      await deleteMediaFromR2(video.cloudflare_id, video.message_id);
    } else if (video.cloudflare_id && video.cloudflare_id !== "none") {
      const cleanId = video.cloudflare_id.split("?")[0];
      const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
      const CF_API_TOKEN = process.env.CLOUDFLARE_STREAM_TOKEN;
      if (CF_ACCOUNT_ID && CF_API_TOKEN) {
        try {
          await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/${cleanId}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${CF_API_TOKEN}` }
          });
          console.log(`[CREATOR DELETE] Deleted Cloudflare Stream video: ${cleanId}`);
        } catch (cfErr) {
          console.warn("[CREATOR DELETE] Cloudflare delete warning:", cfErr.message);
        }
      }
    }

    return res.json({ success: true, message: "Video deleted successfully." });
  } catch (err) {
    console.error("[CREATOR DELETE ERROR]", err);
    return res.status(500).json({ error: "Failed to delete video." });
  }
});

/* =======================================================
   3. GET PUBLIC USER / CREATOR PROFILE
   GET /api/creator/:username
======================================================= */
router.get("/:username", optionalAuth, async (req, res) => {
  const { username } = req.params;
  if (!username) return res.status(400).json({ error: "Username required" });

  try {
    // 1. Search in app_users
    let creatorQuery = await pool.query(
      `SELECT id, username, avatar_url, role, is_premium, settings,
              is_creator, is_managed, telegram_user_id, source_channel, display_name, creator_bio, banner_url, creator_category, 
              subscription_price, social_links, is_verified, location, website, created_at,
              COALESCE(email_verified, FALSE) as email_verified, COALESCE(kyc_status, 'unverified') as kyc_status
       FROM app_users 
       WHERE LOWER(username) = LOWER($1) 
          OR LOWER(COALESCE(display_name, '')) = LOWER($1)
          OR (source_channel = $1)
          OR (telegram_user_id IS NOT NULL AND CAST(telegram_user_id AS TEXT) = $1)`,
      [username]
    );

    let creator = null;

    if (creatorQuery.rows.length > 0) {
      creator = creatorQuery.rows[0];
    } else {
      // 2. Check if username or full_name matches an uploader from telegram users table
      const tgUserQuery = await pool.query(
        `SELECT user_id, username, full_name, created_at 
         FROM users 
         WHERE LOWER(COALESCE(username, '')) = LOWER($1) OR LOWER(COALESCE(full_name, '')) = LOWER($1)`,
        [username]
      );

      if (tgUserQuery.rows.length > 0) {
        const tgUser = tgUserQuery.rows[0];
        const tgUsername = tgUser.username ? tgUser.username.toLowerCase().replace(/[^a-z0-9_]/g, '') : `tg_${tgUser.user_id}`;
        const uCheck = await pool.query("SELECT id FROM app_users WHERE LOWER(username) = LOWER($1)", [tgUsername]);
        const safeUname = uCheck.rows.length > 0 ? `${tgUsername}_${tgUser.user_id.toString().slice(-4)}` : tgUsername;
        const displayName = tgUser.full_name || tgUser.username || username;

        try {
          const randPrice = Math.floor(Math.random() * (35 - 15 + 1)) + 15;
          const insertRes = await pool.query(
            `INSERT INTO app_users (
               username, display_name, email, is_creator, is_managed, 
               telegram_user_id, creator_category, subscription_price, is_verified, 
               banner_url, creator_bio, avatar_url
             ) VALUES ($1, $2, $3, TRUE, TRUE, $4, 'Creator', $5, TRUE, 
               'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80',
               'Official creator channel. Catch all exclusive drops and daily previews here.',
               $6
             )
             ON CONFLICT (telegram_user_id) DO UPDATE 
             SET is_creator = TRUE, is_managed = TRUE
             RETURNING id, username, avatar_url, role, is_premium, settings, is_creator, is_managed, telegram_user_id, display_name, creator_bio, banner_url, creator_category, subscription_price, social_links, is_verified, location, website, created_at`,
            [safeUname, displayName, `tg_${tgUser.user_id}@internal.naijahomemade.com`, tgUser.user_id, randPrice, `/api/avatar?user_id=${tgUser.user_id}`]
          );
          creator = insertRes.rows[0];
        } catch (uErr) {
          const randPrice = Math.floor(Math.random() * (35 - 15 + 1)) + 15;
          creator = {
            id: tgUser.user_id,
            username: safeUname,
            display_name: displayName,
            avatar_url: `/api/avatar?user_id=${tgUser.user_id}`,
            banner_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80",
            creator_bio: "Official creator channel. Catch all exclusive drops and daily previews here.",
            creator_category: "Featured Creator",
            subscription_price: randPrice,
            social_links: tgUser.username ? { telegram: `https://t.me/${tgUser.username}` } : {},
            is_creator: true,
            is_managed: true,
            is_verified: true,
            location: "Lagos, Nigeria",
            website: "",
            created_at: tgUser.created_at
          };
        }
      } else {
        // Synthesize profile from videos if author exists in videos table
        const videoCheck = await pool.query(
          `SELECT v.uploader_id, COALESCE(u.username, u.full_name, 'Member') as uploader_name 
           FROM videos v LEFT JOIN users u ON v.uploader_id = u.user_id
           WHERE LOWER(COALESCE(u.username, '')) = LOWER($1) 
              OR LOWER(COALESCE(u.full_name, '')) = LOWER($1)
           LIMIT 1`,
          [username]
        );

        if (videoCheck.rows.length > 0) {
          const row = videoCheck.rows[0];
          const rawId = row.uploader_id || Date.now();
          const cleanUname = username.toLowerCase().replace(/[^a-z0-9_]/g, '') || `creator_${rawId}`;
          const uCheck = await pool.query("SELECT id FROM app_users WHERE LOWER(username) = LOWER($1)", [cleanUname]);
          const safeUname = uCheck.rows.length > 0 ? `${cleanUname}_${String(rawId).slice(-4)}` : cleanUname;

          try {
            const randPrice = Math.floor(Math.random() * (35 - 15 + 1)) + 15;
            const insertRes = await pool.query(
              `INSERT INTO app_users (
                 username, display_name, email, is_creator, is_managed, 
                 telegram_user_id, creator_category, subscription_price, is_verified, 
                 banner_url, creator_bio, avatar_url
               ) VALUES ($1, $2, $3, TRUE, TRUE, $4, 'Creator', $5, TRUE, 
                 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80',
                 'Official creator channel. Follow for exclusive content and daily drops.',
                 $6
               )
               ON CONFLICT (telegram_user_id) DO UPDATE 
               SET is_creator = TRUE, is_managed = TRUE
               RETURNING id, username, avatar_url, role, is_premium, settings, is_creator, is_managed, telegram_user_id, display_name, creator_bio, banner_url, creator_category, subscription_price, social_links, is_verified, location, website, created_at`,
              [safeUname, row.uploader_name || username, `tg_${rawId}@internal.naijahomemade.com`, rawId, randPrice, row.uploader_id ? `/api/avatar?user_id=${row.uploader_id}` : "/assets/default-avatar.png"]
            );
            creator = insertRes.rows[0];
          } catch (vErr) {
            const randPrice = Math.floor(Math.random() * (35 - 15 + 1)) + 15;
            creator = {
              id: row.uploader_id || 0,
              username: username,
              display_name: row.uploader_name || username,
              avatar_url: row.uploader_id ? `/api/avatar?user_id=${row.uploader_id}` : "/assets/default-avatar.png",
              banner_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80",
              creator_bio: "Welcome to my official creator hub. Follow for exclusive content and daily drops.",
              creator_category: "Creator",
              subscription_price: randPrice,
              social_links: {},
              is_creator: true,
              is_managed: true,
              is_verified: true,
              location: "",
              website: "",
              created_at: new Date()
            };
          }
        } else {
          return res.status(404).json({ error: "User not found" });
        }
      }
    }

    // 🟢 AUTO-SYNC TELEGRAM CREATOR: Automatically grab profile pic and bio from Telegram channel/profile
    if (creator && (creator.is_managed || creator.telegram_user_id)) {
      const isPlaceholderBio = !creator.creator_bio || 
        creator.creator_bio.startsWith("Official creator channel") || 
        creator.creator_bio.startsWith("Official Telegram channel") || 
        creator.creator_bio.startsWith("Welcome to my official creator hub");
      const isPlaceholderAvatar = !creator.avatar_url || creator.avatar_url.includes("default-avatar");

      if (isPlaceholderBio || isPlaceholderAvatar) {
        try {
          creator = await syncTelegramCreatorProfile(creator, pool);
        } catch (syncErr) {
          console.warn("[CREATOR PROFILE] Telegram sync notice:", syncErr.message);
        }
      }
    }

    // Default values
    if (!creator.display_name) creator.display_name = creator.username;
    if (!creator.banner_url) creator.banner_url = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80";
    if (!creator.creator_category) creator.creator_category = creator.is_creator ? "Creator" : "Community Member";

    // 2. Fetch Creator Stats
    let subCount = 0;
    try {
      if (creator.id && Number(creator.id) !== 0) {
        const subRes = await pool.query(
          "SELECT COUNT(*) FROM creator_subscriptions WHERE (creator_id = $1 OR ($2::BIGINT IS NOT NULL AND creator_id = $2::BIGINT)) AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())",
          [creator.id, creator.telegram_user_id || null]
        );
        subCount = Number(subRes.rows[0]?.count || 0);
      }
    } catch (e) {}

    const isOfficialCreator = 
      String(creator.id) === "458" ||
      String(creator.username || "").toLowerCase() === "naijaxxx" ||
      String(username || "").toLowerCase() === "naijaxxx";

    const legacyCondition = isOfficialCreator 
      ? "OR (LOWER(v.category) = 'premium' AND (v.uploader_id = 458 OR v.uploader_id = -1004344719694 OR v.uploader_id IS NULL OR v.uploader_id = 0 OR (v.chat_id != 'internal' AND (v.cloudflare_id IS NULL OR NOT v.cloudflare_id LIKE 'r2:%'))))"
      : "";

    // Video & views stats
    const statsRes = await pool.query(
      `SELECT 
         COUNT(*) as posts_count,
         COALESCE(SUM(v.views), 0) as views_count,
         COALESCE(SUM(v.likes_count), 0) as likes_count
       FROM videos v
       LEFT JOIN users u ON v.uploader_id = u.user_id
       WHERE (
            LOWER(COALESCE(u.username, '')) = LOWER($1) 
         OR LOWER(COALESCE(u.full_name, '')) = LOWER($1)
         OR LOWER(COALESCE(u.username, '')) = LOWER($2)
         OR LOWER(COALESCE(u.full_name, '')) = LOWER($2)
         OR CAST(v.uploader_id AS TEXT) = CAST($3 AS TEXT)
         OR ($4::BIGINT IS NOT NULL AND v.uploader_id = $4::BIGINT)
         ${legacyCondition}
       )`,
      [creator.username, username, String(creator.id || '0'), creator.telegram_user_id || null]
    );

    const postsCount = Number(statsRes.rows[0]?.posts_count || 0);
    const viewsCount = Number(statsRes.rows[0]?.views_count || 0);
    const likesCount = Number(statsRes.rows[0]?.likes_count || 0);

    // 3. Determine followers and following counts
    let followCount = 0;
    let followingCount = 0;
    try {
      const [followRes, followingRes] = await Promise.all([
        pool.query(
          "SELECT COUNT(*) FROM creator_follows WHERE creator_id = $1 OR ($2::BIGINT IS NOT NULL AND creator_id = $2::BIGINT)",
          [creator.id, creator.telegram_user_id || null]
        ),
        creator.id && Number(creator.id) !== 0
          ? pool.query("SELECT COUNT(*) FROM creator_follows WHERE follower_id = $1", [creator.id])
          : Promise.resolve({ rows: [{ count: 0 }] })
      ]);
      followCount = Number(followRes.rows[0]?.count || 0);
      followingCount = Number(followingRes.rows[0]?.count || 0);
    } catch (e) {}

    const totalFollowers = followCount;

    // 4. Determine if requesting user is following & subscribed
    let isFollowing = false;
    let isSubscribed = false;
    let isOwner = false;
    let reqUserRole = null;

    if (req.user) {
      try {
        const reqUserRes = await pool.query("SELECT id, username, role, is_premium, telegram_user_id FROM app_users WHERE id = $1", [req.user.id]);
        if (reqUserRes.rows.length > 0) {
          req.user = reqUserRes.rows[0];
          reqUserRole = req.user.role;
        }
      } catch (e) {}

      const isReqUserOwner = Boolean(
        (creator.id && Number(req.user.id) === Number(creator.id)) ||
        (creator.telegram_user_id && req.user.telegram_user_id && String(req.user.telegram_user_id) === String(creator.telegram_user_id)) ||
        (creator.username && req.user.username && creator.username.toLowerCase() === req.user.username.toLowerCase())
      );

      if (isReqUserOwner) {
        isOwner = true;
        isSubscribed = true;
      } else if (req.user.role === "admin") {
        isSubscribed = true;
      } else if (req.user.is_premium && isNaijaHomemade) {
        isSubscribed = true;
      } else if (creator.id && Number(creator.id) !== 0) {
        try {
          const [checkFollow, checkSub] = await Promise.all([
            pool.query(
              "SELECT id FROM creator_follows WHERE follower_id = $1 AND (creator_id = $2 OR ($3::BIGINT IS NOT NULL AND creator_id = $3::BIGINT))",
              [req.user.id, creator.id, creator.telegram_user_id || null]
            ),
            pool.query(
              "SELECT id FROM creator_subscriptions WHERE subscriber_id = $1 AND (creator_id = $2 OR ($3::BIGINT IS NOT NULL AND creator_id = $3::BIGINT)) AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())",
              [req.user.id, creator.id, creator.telegram_user_id || null]
            )
          ]);
          isFollowing = checkFollow.rows.length > 0;
          isSubscribed = checkSub.rows.length > 0;
        } catch (e) {}
      }
    }

    const rawSettings = creator.settings && typeof creator.settings === "object" ? creator.settings : {};
    const isPrivateProfile = Boolean(rawSettings.private_profile);
    const hideFollowList = Boolean(rawSettings.hide_follow_list || rawSettings.private_profile);
    const canViewFollowList = Boolean(isOwner || reqUserRole === "admin" || !hideFollowList);

    // 5. Fetch First 12 Videos (tab-aware)
    const tab = (req.query.tab || req.query.category || "").toLowerCase().trim();
    let tabFilter = "";
    if (tab === "premium") {
      tabFilter = "AND LOWER(v.category) = 'premium'";
    } else if (tab === "reels") {
      tabFilter = "AND (v.media_group_id IS NULL OR v.media_group_id = 'none')";
    }

    const videosRes = await pool.query(
      `WITH GroupedVideos AS (
        SELECT v.*,
          COALESCE(u.username, u.full_name, $1) as uploader_name,
          ROW_NUMBER() OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END ORDER BY v.created_at ASC) as rn,
          COUNT(*) OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END) as group_count
        FROM videos v
        LEFT JOIN users u ON v.uploader_id = u.user_id
        WHERE (
             LOWER(COALESCE(u.username, '')) = LOWER($1) 
          OR LOWER(COALESCE(u.full_name, '')) = LOWER($1)
          OR LOWER(COALESCE(u.username, '')) = LOWER($2)
          OR LOWER(COALESCE(u.full_name, '')) = LOWER($2)
          OR CAST(v.uploader_id AS TEXT) = CAST($3 AS TEXT)
          OR ($4::BIGINT IS NOT NULL AND v.uploader_id = $4::BIGINT)
          ${legacyCondition}
        ) 
        AND (v.status = 'ready' OR v.status IS NULL)
        AND (v.status != 'flagged' AND v.status != 'deleted')
        AND (v.flags_count < 5 OR v.flags_count IS NULL)
        ${tabFilter}
      )
      SELECT * FROM GroupedVideos WHERE rn = 1 ORDER BY created_at DESC LIMIT 12`,
      [creator.username, username, String(creator.id || '0'), creator.telegram_user_id || null]
    );

    const apiBaseUrl = process.env.API_BASE_URL || "https://naijahomemade.com";
    const creatorSubPrice = Number(creator.subscription_price || 0);
    const mappedVideos = videosRes.rows.map(v => ({
      id: v.id,
      chat_id: v.chat_id,
      message_id: v.message_id,
      uploader_id: v.uploader_id,
      uploader_name: creator.display_name || v.uploader_name || creator.username,
      display_name: creator.display_name || v.uploader_name || creator.username,
      uploader_handle: creator.username || username,
      subscription_price: creatorSubPrice,
      is_premium: String(v.category || "").toLowerCase().trim() === "premium",
      category: v.category,
      caption: v.caption,
      views: Number(v.views || 0),
      likes_count: Number(v.likes_count || 0),
      comments_count: Number(v.comments_count || 0),
      shares_count: Number(v.shares_count || 0),
      saves_count: Number(v.saves_count || 0),
      thumbnail_url: formatThumbnailUrl(v, apiBaseUrl),
      video_url: null,
      is_group: Number(v.group_count || 1) > 1,
      group_count: Number(v.group_count || 1),
      created_at: v.created_at
    }));

    // Fetch Active 24-Hour Status Stories (Multi-story support)
    let activeStory = null;
    let activeStories = [];
    let hasViewedStory = false;
    try {
      const currentUserId = req.user?.id || null;
      const storyRes = await pool.query(
        `SELECT s.id, s.creator_id, s.username, s.thumbnail_url, s.duration, s.sound_title, s.created_at, s.expires_at
                ${currentUserId ? ", s.video_url, CASE WHEN v.id IS NOT NULL THEN TRUE ELSE FALSE END as has_viewed" : ", NULL as video_url, FALSE as has_viewed, TRUE as requires_auth"}
         FROM creator_stories s
         ${currentUserId ? "LEFT JOIN creator_story_views v ON (v.story_id = s.id AND v.user_id = $2)" : ""}
         WHERE LOWER(s.username) = LOWER($1) 
           AND s.is_active = TRUE 
           AND s.expires_at > NOW() 
         ORDER BY s.created_at ASC`,
        currentUserId ? [creator.username || username, currentUserId] : [creator.username || username]
      );
      if (storyRes.rows.length > 0) {
        activeStories = storyRes.rows.map(s => ({
          id: s.id,
          creator_id: s.creator_id,
          username: s.username,
          video_url: s.video_url,
          thumbnail_url: s.thumbnail_url,
          duration: Number(s.duration || 10.0),
          sound_title: s.sound_title || "Trending TikTok Sound",
          created_at: s.created_at,
          expires_at: s.expires_at,
          requires_auth: !currentUserId,
          has_viewed: Boolean(s.has_viewed)
        }));
        const hasViewedAll = currentUserId ? activeStories.every(s => s.has_viewed) : false;
        const firstUnviewed = activeStories.find(s => !s.has_viewed) || activeStories[0];
        activeStory = firstUnviewed;
        hasViewedStory = hasViewedAll;
      }
    } catch (sErr) {}

    // 6. Fetch Story Highlights (with smart fallback from archived stories)
    let highlights = [];
    try {
      const currentUserId = req.user?.id || null;
      const hlRes = await pool.query(
        `SELECT id, creator_id, username, title, cover_url, story_ids, is_active, created_at, updated_at
         FROM creator_story_highlights
         WHERE LOWER(username) = LOWER($1) AND is_active = TRUE
         ORDER BY updated_at DESC, id DESC`,
        [creator.username || username]
      );

      if (hlRes.rows.length > 0) {
        const allStoryIds = [...new Set(hlRes.rows.flatMap(h => h.story_ids || []))];
        let storiesMap = new Map();
        if (allStoryIds.length > 0) {
          const sRes = await pool.query(
            `SELECT id, creator_id, username, video_url, thumbnail_url, duration, sound_title, created_at, expires_at
             FROM creator_stories
             WHERE id = ANY($1::INT[])`,
            [allStoryIds]
          );
          sRes.rows.forEach(st => {
            storiesMap.set(st.id, {
              id: st.id,
              creator_id: st.creator_id,
              username: st.username,
              video_url: currentUserId ? st.video_url : null,
              thumbnail_url: st.thumbnail_url,
              duration: Number(st.duration || 10.0),
              sound_title: st.sound_title || "Trending TikTok Sound",
              created_at: st.created_at,
              expires_at: st.expires_at,
              requires_auth: !currentUserId
            });
          });
        }

        highlights = hlRes.rows.map(h => {
          const stList = (h.story_ids || []).map(sid => storiesMap.get(sid)).filter(Boolean);
          const cover = h.cover_url || (stList[0]?.thumbnail_url) || creator.avatar_url;
          return {
            id: h.id,
            creator_id: h.creator_id,
            username: h.username,
            title: h.title,
            cover_url: cover,
            story_ids: h.story_ids,
            stories: stList,
            story_count: stList.length,
            created_at: h.created_at,
            updated_at: h.updated_at
          };
        }).filter(h => h.story_count > 0);
      } else {
        // Fallback: Check if creator has archived stories
        const archRes = await pool.query(
          `SELECT id, creator_id, username, video_url, thumbnail_url, duration, sound_title, created_at, expires_at
           FROM creator_stories
           WHERE LOWER(username) = LOWER($1) AND (is_archived = TRUE OR expires_at <= NOW())
           ORDER BY created_at DESC LIMIT 30`,
          [creator.username || username]
        );

        if (archRes.rows.length > 0) {
          const archStories = archRes.rows.map(st => ({
            id: st.id,
            creator_id: st.creator_id,
            username: st.username,
            video_url: currentUserId ? st.video_url : null,
            thumbnail_url: st.thumbnail_url,
            duration: Number(st.duration || 10.0),
            sound_title: st.sound_title || "Trending TikTok Sound",
            created_at: st.created_at,
            expires_at: st.expires_at,
            requires_auth: !currentUserId
          }));

          highlights = [{
            id: `auto_${creator.username || username}_1`,
            creator_id: creator.id,
            username: creator.username || username,
            title: "Highlights",
            cover_url: archStories[0].thumbnail_url,
            story_ids: archStories.map(s => s.id),
            stories: archStories.slice(0, 10),
            story_count: Math.min(archStories.length, 10),
            created_at: archStories[0].created_at,
            is_auto: true
          }];
        }
      }
    } catch (hlErr) {
      console.warn("[HIGHLIGHTS QUERY ERROR]", hlErr);
    }

    res.json({
      creator: {
        ...creator,
        is_private_profile: isPrivateProfile,
        hide_follow_list: hideFollowList,
        can_view_follow_list: canViewFollowList,
        has_active_story: activeStories.length > 0,
        has_viewed_story: hasViewedStory,
        active_story: activeStory,
        active_stories: activeStories,
        story_count: activeStories.length,
        highlights: highlights,
        stats: {
          followers: totalFollowers,
          following: followingCount,
          subscribers: subCount,
          posts: postsCount,
          likes: likesCount,
          views: viewsCount
        },
        is_following: isFollowing,
        is_subscribed: isSubscribed,
        is_owner: isOwner
      },
      videos: mappedVideos
    });
  } catch (err) {
    console.error("[GET CREATOR ERROR]", err);
    res.status(500).json({ error: "Failed to fetch creator profile" });
  }
});

/* =======================================================
   3.2. GET USER / CREATOR FOLLOWERS LIST
   GET /api/creator/:username/followers
======================================================= */
router.get("/:username/followers", optionalAuth, async (req, res) => {
  const { username } = req.params;
  const search = String(req.query.q || "").trim().toLowerCase();
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
  const offset = Math.max(0, parseInt(req.query.offset) || 0);

  try {
    const targetRes = await pool.query(
      `SELECT id, username, display_name, telegram_user_id, settings
       FROM app_users
       WHERE LOWER(username) = LOWER($1) OR LOWER(COALESCE(display_name, '')) = LOWER($1)`,
      [username]
    );

    let target = targetRes.rows[0];
    if (!target) {
      const tgRes = await pool.query(
        `SELECT user_id as id, username, full_name as display_name, user_id as telegram_user_id
         FROM users WHERE LOWER(COALESCE(username, '')) = LOWER($1) OR LOWER(COALESCE(full_name, '')) = LOWER($1)`,
        [username]
      );
      target = tgRes.rows[0];
    }

    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }

    const currentUserId = req.user?.id || null;
    let isOwnerOrAdmin = false;
    if (currentUserId) {
      if (Number(currentUserId) === Number(target.id)) {
        isOwnerOrAdmin = true;
      } else {
        const reqRes = await pool.query("SELECT role, username FROM app_users WHERE id = $1", [currentUserId]);
        if (reqRes.rows[0]?.role === "admin" || (reqRes.rows[0]?.username && reqRes.rows[0].username.toLowerCase() === String(target.username || "").toLowerCase())) {
          isOwnerOrAdmin = true;
        }
      }
    }

    const rawSettings = target.settings && typeof target.settings === "object" ? target.settings : {};
    const isPrivateList = Boolean(rawSettings.private_profile || rawSettings.hide_follow_list);

    if (isPrivateList && !isOwnerOrAdmin) {
      return res.json({
        is_private: true,
        users: [],
        total: 0,
        message: "This account's followers list is private."
      });
    }

    const params = [target.id, target.telegram_user_id || null, currentUserId];
    let searchFilter = "";
    if (search) {
      params.push(`%${search.replace(/^@/, "")}%`);
      searchFilter = `AND (LOWER(u.username) LIKE $${params.length} OR LOWER(COALESCE(u.display_name, '')) LIKE $${params.length})`;
    }

    params.push(limit, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const listQuery = `
      SELECT u.id, u.username, COALESCE(u.display_name, u.username) as display_name,
             COALESCE(u.avatar_url, '/assets/default-avatar.png') as avatar_url,
             COALESCE(u.is_verified, FALSE) as is_verified,
             COALESCE(u.is_creator, FALSE) as is_creator,
             u.creator_bio,
             cf.created_at as followed_at,
             CASE WHEN $3::INTEGER IS NOT NULL AND my_f.id IS NOT NULL THEN TRUE ELSE FALSE END as is_following
      FROM creator_follows cf
      JOIN app_users u ON cf.follower_id = u.id
      LEFT JOIN creator_follows my_f ON (my_f.follower_id = $3::INTEGER AND my_f.creator_id = u.id)
      WHERE (cf.creator_id = $1 OR ($2::BIGINT IS NOT NULL AND cf.creator_id = $2::BIGINT))
        ${searchFilter}
      ORDER BY cf.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const countQuery = `
      SELECT COUNT(*) as total
      FROM creator_follows cf
      JOIN app_users u ON cf.follower_id = u.id
      WHERE (cf.creator_id = $1 OR ($2::BIGINT IS NOT NULL AND cf.creator_id = $2::BIGINT))
        ${search ? `AND (LOWER(u.username) LIKE $4 OR LOWER(COALESCE(u.display_name, '')) LIKE $4)` : ""}
    `;

    const countParams = search
      ? [target.id, target.telegram_user_id || null, currentUserId, `%${search.replace(/^@/, "")}%`]
      : [target.id, target.telegram_user_id || null];

    const [listRes, countRes] = await Promise.all([
      pool.query(listQuery, params),
      pool.query(
        search
          ? `SELECT COUNT(*) as total FROM creator_follows cf JOIN app_users u ON cf.follower_id = u.id WHERE (cf.creator_id = $1 OR ($2::BIGINT IS NOT NULL AND cf.creator_id = $2::BIGINT)) AND (LOWER(u.username) LIKE $3 OR LOWER(COALESCE(u.display_name, '')) LIKE $3)`
          : `SELECT COUNT(*) as total FROM creator_follows cf JOIN app_users u ON cf.follower_id = u.id WHERE (cf.creator_id = $1 OR ($2::BIGINT IS NOT NULL AND cf.creator_id = $2::BIGINT))`,
        search ? [target.id, target.telegram_user_id || null, `%${search.replace(/^@/, "")}%`] : [target.id, target.telegram_user_id || null]
      )
    ]);

    return res.json({
      is_private: false,
      users: listRes.rows,
      total: Number(countRes.rows[0]?.total || 0)
    });
  } catch (err) {
    console.error("[GET FOLLOWERS ERROR]", err);
    return res.status(500).json({ error: "Failed to fetch followers list" });
  }
});

/* =======================================================
   3.3. GET USER / CREATOR FOLLOWING LIST
   GET /api/creator/:username/following
======================================================= */
router.get("/:username/following", optionalAuth, async (req, res) => {
  const { username } = req.params;
  const search = String(req.query.q || "").trim().toLowerCase();
  const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
  const offset = Math.max(0, parseInt(req.query.offset) || 0);

  try {
    const targetRes = await pool.query(
      `SELECT id, username, display_name, telegram_user_id, settings
       FROM app_users
       WHERE LOWER(username) = LOWER($1) OR LOWER(COALESCE(display_name, '')) = LOWER($1)`,
      [username]
    );

    if (targetRes.rows.length === 0) {
      return res.json({ is_private: false, users: [], total: 0 });
    }

    const target = targetRes.rows[0];
    const currentUserId = req.user?.id || null;
    let isOwnerOrAdmin = false;
    if (currentUserId) {
      if (Number(currentUserId) === Number(target.id)) {
        isOwnerOrAdmin = true;
      } else {
        const reqRes = await pool.query("SELECT role, username FROM app_users WHERE id = $1", [currentUserId]);
        if (reqRes.rows[0]?.role === "admin" || (reqRes.rows[0]?.username && reqRes.rows[0].username.toLowerCase() === String(target.username || "").toLowerCase())) {
          isOwnerOrAdmin = true;
        }
      }
    }

    const rawSettings = target.settings && typeof target.settings === "object" ? target.settings : {};
    const isPrivateList = Boolean(rawSettings.private_profile || rawSettings.hide_follow_list);

    if (isPrivateList && !isOwnerOrAdmin) {
      return res.json({
        is_private: true,
        users: [],
        total: 0,
        message: "This account's following list is private."
      });
    }

    const params = [target.id, currentUserId];
    let searchFilter = "";
    if (search) {
      params.push(`%${search.replace(/^@/, "")}%`);
      searchFilter = `AND (LOWER(COALESCE(u.username, tu.username, '')) LIKE $${params.length} OR LOWER(COALESCE(u.display_name, tu.full_name, '')) LIKE $${params.length})`;
    }

    params.push(limit, offset);
    const limitIdx = params.length - 1;
    const offsetIdx = params.length;

    const listQuery = `
      SELECT COALESCE(u.id, tu.user_id, cf.creator_id) as id,
             COALESCE(u.username, tu.username, 'user_' || cf.creator_id) as username,
             COALESCE(u.display_name, tu.full_name, u.username, tu.username, 'Creator') as display_name,
             CASE 
               WHEN u.avatar_url IS NOT NULL AND u.avatar_url != '' THEN u.avatar_url
               WHEN u.telegram_user_id IS NOT NULL THEN '/api/avatar?user_id=' || u.telegram_user_id
               WHEN tu.user_id IS NOT NULL THEN '/api/avatar?user_id=' || tu.user_id
               ELSE '/assets/default-avatar.png'
             END as avatar_url,
             COALESCE(u.is_verified, CASE WHEN tu.user_id IS NOT NULL THEN TRUE ELSE FALSE END) as is_verified,
             COALESCE(u.is_creator, CASE WHEN tu.user_id IS NOT NULL THEN TRUE ELSE FALSE END) as is_creator,
             u.creator_bio,
             cf.created_at as followed_at,
             CASE WHEN $2::INTEGER IS NOT NULL AND my_f.id IS NOT NULL THEN TRUE ELSE FALSE END as is_following
      FROM creator_follows cf
      LEFT JOIN app_users u ON (cf.creator_id = u.id OR (u.telegram_user_id IS NOT NULL AND cf.creator_id = u.telegram_user_id))
      LEFT JOIN users tu ON cf.creator_id = tu.user_id
      LEFT JOIN creator_follows my_f ON (my_f.follower_id = $2::INTEGER AND my_f.creator_id = cf.creator_id)
      WHERE cf.follower_id = $1
        AND COALESCE(u.username, tu.username) IS NOT NULL
        ${searchFilter}
      ORDER BY cf.created_at DESC
      LIMIT $${limitIdx} OFFSET $${offsetIdx}
    `;

    const [listRes, countRes] = await Promise.all([
      pool.query(listQuery, params),
      pool.query(
        search
          ? `SELECT COUNT(*) as total FROM creator_follows cf LEFT JOIN app_users u ON (cf.creator_id = u.id OR (u.telegram_user_id IS NOT NULL AND cf.creator_id = u.telegram_user_id)) LEFT JOIN users tu ON cf.creator_id = tu.user_id WHERE cf.follower_id = $1 AND COALESCE(u.username, tu.username) IS NOT NULL AND (LOWER(COALESCE(u.username, tu.username, '')) LIKE $2 OR LOWER(COALESCE(u.display_name, tu.full_name, '')) LIKE $2)`
          : `SELECT COUNT(*) as total FROM creator_follows cf LEFT JOIN app_users u ON (cf.creator_id = u.id OR (u.telegram_user_id IS NOT NULL AND cf.creator_id = u.telegram_user_id)) LEFT JOIN users tu ON cf.creator_id = tu.user_id WHERE cf.follower_id = $1 AND COALESCE(u.username, tu.username) IS NOT NULL`,
        search ? [target.id, `%${search.replace(/^@/, "")}%`] : [target.id]
      )
    ]);

    return res.json({
      is_private: false,
      users: listRes.rows,
      total: Number(countRes.rows[0]?.total || 0)
    });
  } catch (err) {
    console.error("[GET FOLLOWING ERROR]", err);
    return res.status(500).json({ error: "Failed to fetch following list" });
  }
});

/* =======================================================
   3.5. GET ACTIVE CREATOR STORY
   GET /api/creator/:username/story
   (Requires authentication: Only logged-in users can view story)
======================================================= */
router.get("/:username/story", optionalAuth, async (req, res) => {
  const { username } = req.params;
  if (!username) return res.status(400).json({ error: "Username required" });

  const currentUserId = req.user?.id || null;
  if (!currentUserId) {
    return res.status(401).json({ 
      error: "Authentication required to view story post", 
      requires_auth: true 
    });
  }

  try {
    const storyRes = await pool.query(
      `SELECT s.id, s.creator_id, s.username, s.video_url, s.thumbnail_url, s.duration, s.sound_title, s.created_at, s.expires_at,
              COALESCE(u.display_name, s.username) as display_name,
              COALESCE(u.avatar_url, '/assets/default-avatar.png') as avatar_url,
              CASE WHEN v.id IS NOT NULL THEN TRUE ELSE FALSE END as has_viewed
       FROM creator_stories s
       LEFT JOIN app_users u ON (s.creator_id = u.id OR LOWER(s.username) = LOWER(u.username))
       LEFT JOIN creator_story_views v ON (v.story_id = s.id AND v.user_id = $2)
       WHERE LOWER(s.username) = LOWER($1) 
         AND s.is_active = TRUE 
         AND s.expires_at > NOW() 
       ORDER BY s.created_at ASC`,
      [username, currentUserId]
    );

    if (storyRes.rows.length === 0) {
      return res.json({ has_active_story: false, stories: [] });
    }

    const stories = storyRes.rows.map(s => ({
      id: s.id,
      creator_id: s.creator_id,
      username: s.username,
      display_name: s.display_name,
      avatar_url: s.avatar_url,
      video_url: s.video_url,
      thumbnail_url: s.thumbnail_url,
      duration: Number(s.duration || 10.0),
      sound_title: s.sound_title || "Trending TikTok Sound",
      created_at: s.created_at,
      expires_at: s.expires_at,
      has_viewed: Boolean(s.has_viewed)
    }));

    const hasViewedAll = stories.every(s => s.has_viewed);
    const firstUnviewed = stories.find(s => !s.has_viewed) || stories[0];

    return res.json({
      has_active_story: true,
      count: stories.length,
      has_viewed_story: hasViewedAll,
      has_viewed_all: hasViewedAll,
      stories: stories,
      story: firstUnviewed
    });
  } catch (err) {
    console.error("[GET CREATOR STORY ERROR]", err);
    res.status(500).json({ error: "Failed to fetch creator story" });
  }
});

/* =======================================================
   3.6. RECORD CREATOR STORY VIEW
   POST /api/creator/:username/story/view
   (Requires authentication: Records user view in database)
======================================================= */
router.post("/:username/story/view", authenticateToken, async (req, res) => {
  const { username } = req.params;
  const userId = req.user.id;
  let { story_id } = req.body;

  try {
    if (!story_id) {
      const storyRes = await pool.query(
        `SELECT id FROM creator_stories 
         WHERE LOWER(username) = LOWER($1) 
           AND is_active = TRUE 
           AND expires_at > NOW() 
         ORDER BY created_at DESC LIMIT 1`,
        [username]
      );
      if (storyRes.rows.length === 0) {
        return res.status(404).json({ error: "No active story found to mark as viewed" });
      }
      story_id = storyRes.rows[0].id;
    }

    await pool.query(
      `INSERT INTO creator_story_views (user_id, story_id, viewed_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id, story_id) DO UPDATE SET viewed_at = NOW()`,
      [userId, story_id]
    );

    return res.json({
      success: true,
      viewed: true,
      story_id: Number(story_id),
      user_id: userId
    });
  } catch (err) {
    console.error("[RECORD STORY VIEW ERROR]", err);
    return res.status(500).json({ error: "Failed to record story view" });
  }
});

/* =======================================================
   3.7. GET CREATOR STORY HIGHLIGHTS
   GET /api/creator/:username/highlights
======================================================= */
router.get("/:username/highlights", optionalAuth, async (req, res) => {
  const { username } = req.params;
  if (!username) return res.status(400).json({ error: "Username required" });

  try {
    const currentUserId = req.user?.id || null;
    const hlRes = await pool.query(
      `SELECT id, creator_id, username, title, cover_url, story_ids, is_active, created_at, updated_at
       FROM creator_story_highlights
       WHERE LOWER(username) = LOWER($1) AND is_active = TRUE
       ORDER BY updated_at DESC, id DESC`,
      [username]
    );

    let highlights = [];
    if (hlRes.rows.length > 0) {
      const allStoryIds = [...new Set(hlRes.rows.flatMap(h => h.story_ids || []))];
      let storiesMap = new Map();
      if (allStoryIds.length > 0) {
        const sRes = await pool.query(
          `SELECT id, creator_id, username, video_url, thumbnail_url, duration, sound_title, created_at, expires_at
           FROM creator_stories
           WHERE id = ANY($1::INT[])`,
          [allStoryIds]
        );
        sRes.rows.forEach(st => {
          storiesMap.set(st.id, {
            id: st.id,
            creator_id: st.creator_id,
            username: st.username,
            video_url: currentUserId ? st.video_url : null,
            thumbnail_url: st.thumbnail_url,
            duration: Number(st.duration || 10.0),
            sound_title: st.sound_title || "Trending TikTok Sound",
            created_at: st.created_at,
            expires_at: st.expires_at,
            requires_auth: !currentUserId
          });
        });
      }

      highlights = hlRes.rows.map(h => {
        const stList = (h.story_ids || []).map(sid => storiesMap.get(sid)).filter(Boolean);
        const cover = h.cover_url || (stList[0]?.thumbnail_url) || "/assets/default-avatar.png";
        return {
          id: h.id,
          creator_id: h.creator_id,
          username: h.username,
          title: h.title,
          cover_url: cover,
          story_ids: h.story_ids,
          stories: stList,
          story_count: stList.length,
          created_at: h.created_at,
          updated_at: h.updated_at
        };
      }).filter(h => h.story_count > 0);
    } else {
      // Fallback: Check if creator has archived stories
      const archRes = await pool.query(
        `SELECT id, creator_id, username, video_url, thumbnail_url, duration, sound_title, created_at, expires_at
         FROM creator_stories
         WHERE LOWER(username) = LOWER($1) AND (is_archived = TRUE OR expires_at <= NOW())
         ORDER BY created_at DESC LIMIT 30`,
        [username]
      );

      if (archRes.rows.length > 0) {
        const archStories = archRes.rows.map(st => ({
          id: st.id,
          creator_id: st.creator_id,
          username: st.username,
          video_url: currentUserId ? st.video_url : null,
          thumbnail_url: st.thumbnail_url,
          duration: Number(st.duration || 10.0),
          sound_title: st.sound_title || "Trending TikTok Sound",
          created_at: st.created_at,
          expires_at: st.expires_at,
          requires_auth: !currentUserId
        }));

        highlights = [{
          id: `auto_${username}_1`,
          creator_id: null,
          username: username,
          title: "Highlights",
          cover_url: archStories[0].thumbnail_url,
          story_ids: archStories.map(s => s.id),
          stories: archStories.slice(0, 10),
          story_count: Math.min(archStories.length, 10),
          created_at: archStories[0].created_at,
          is_auto: true
        }];
      }
    }

    return res.json({ highlights });
  } catch (err) {
    console.error("[GET HIGHLIGHTS ERROR]", err);
    return res.status(500).json({ error: "Failed to fetch highlights" });
  }
});

const API_SECRETS = [
  process.env.SIGNING_SECRET,
  process.env.JWT_SECRET,
  process.env.ADMIN_PASSWORD
].filter(Boolean);

async function authenticateOwnerOrApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'] || req.headers['x-api-secret'] || req.body?.api_key || req.query?.api_key;
  if (apiKey && API_SECRETS.includes(apiKey)) {
    const targetUsername = req.params.username;
    if (targetUsername) {
      try {
        const uRes = await pool.query(
          `SELECT id, username, role FROM app_users WHERE LOWER(username) = LOWER($1)`,
          [targetUsername]
        );
        if (uRes.rows.length > 0) {
          req.user = { id: uRes.rows[0].id, role: uRes.rows[0].role, username: uRes.rows[0].username };
        }
      } catch (e) {
        // non-fatal
      }
    }
    req.isApiKey = true;
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role, username: decoded.username };
    return next();
  } catch (err) {
    return res.status(401).json({ error: "Session expired" });
  }
}

/* =======================================================
   3.8. GET CREATOR STORY ARCHIVE
   GET /api/creator/:username/stories/archive
   (Allows creator to browse all expired & archived stories)
======================================================= */
router.get("/:username/stories/archive", authenticateOwnerOrApiKey, async (req, res) => {
  const { username } = req.params;
  const includeActive = req.query.include_active === "true" || req.query.include_active === "1" || req.isApiKey;
  if (!username) return res.status(400).json({ error: "Username required" });

  try {
    let isOwner = false;
    if (req.isApiKey) {
      isOwner = true;
    } else {
      const userRes = await pool.query(
        `SELECT id, username, telegram_user_id, role FROM app_users WHERE id = $1`,
        [req.user.id]
      );
      if (userRes.rows.length === 0) return res.status(401).json({ error: "User not found" });

      const currentUser = userRes.rows[0];
      isOwner = 
        currentUser.role === "admin" ||
        currentUser.username.toLowerCase() === username.toLowerCase();
    }

    if (!isOwner) {
      return res.status(403).json({ error: "Only the profile owner can view their story archive" });
    }

    const whereClause = includeActive
      ? `WHERE LOWER(username) = LOWER($1)`
      : `WHERE LOWER(username) = LOWER($1) AND (is_archived = TRUE OR expires_at <= NOW())`;

    const archRes = await pool.query(
      `SELECT id, creator_id, username, video_url, thumbnail_url, duration, sound_title, created_at, expires_at, is_active, is_archived
       FROM creator_stories
       ${whereClause}
       ORDER BY created_at DESC`,
      [username]
    );

    const archive = archRes.rows.map(s => ({
      id: s.id,
      creator_id: s.creator_id,
      username: s.username,
      video_url: s.video_url,
      thumbnail_url: s.thumbnail_url,
      duration: Number(s.duration || 10.0),
      sound_title: s.sound_title || "Trending TikTok Sound",
      created_at: s.created_at,
      expires_at: s.expires_at,
      is_archived: Boolean(s.is_archived)
    }));

    return res.json({ archive });
  } catch (err) {
    console.error("[GET ARCHIVE ERROR]", err);
    return res.status(500).json({ error: "Failed to fetch story archive" });
  }
});

/* =======================================================
   3.9. CREATE STORY HIGHLIGHT
   POST /api/creator/:username/highlights
   (Allows creator to curate multiple stories into a highlight reel)
======================================================= */
router.post("/:username/highlights", authenticateOwnerOrApiKey, async (req, res) => {
  const { username } = req.params;
  const { title, cover_url, story_ids } = req.body;

  if (!story_ids || !Array.isArray(story_ids) || story_ids.length === 0) {
    return res.status(400).json({ error: "At least one story is required to create a highlight" });
  }

  try {
    let isOwner = false;
    let userId = null;

    if (req.isApiKey) {
      isOwner = true;
      const uRes = await pool.query(`SELECT id FROM app_users WHERE LOWER(username) = LOWER($1)`, [username]);
      if (uRes.rows.length > 0) userId = uRes.rows[0].id;
    } else {
      const userRes = await pool.query(
        `SELECT id, username, role FROM app_users WHERE id = $1`,
        [req.user.id]
      );
      if (userRes.rows.length === 0) return res.status(401).json({ error: "User not found" });

      const currentUser = userRes.rows[0];
      isOwner = 
        currentUser.role === "admin" ||
        currentUser.username.toLowerCase() === username.toLowerCase();
      userId = currentUser.id;
    }

    if (!isOwner) {
      return res.status(403).json({ error: "Only the profile owner can create highlights" });
    }

    const cleanTitle = (title ? String(title).trim().slice(0, 100) : "Highlights") || "Highlights";
    const intStoryIds = story_ids.map(Number).filter(n => !isNaN(n) && n > 0);

    const sRes = await pool.query(
      `SELECT id, thumbnail_url, video_url, duration, sound_title, created_at, expires_at 
       FROM creator_stories 
       WHERE id = ANY($1::INT[]) AND LOWER(username) = LOWER($2)
       ORDER BY created_at ASC`,
      [intStoryIds, username]
    );

    if (sRes.rows.length === 0) {
      return res.status(400).json({ error: "None of the selected stories were found for this creator" });
    }

    const firstCover = cover_url || sRes.rows[0].thumbnail_url || "/assets/default-avatar.png";

    const insertRes = await pool.query(
      `INSERT INTO creator_story_highlights (
         creator_id, username, title, cover_url, story_ids, is_active, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), NOW())
       RETURNING *`,
      [userId, username, cleanTitle, firstCover, intStoryIds]
    );

    const newHl = insertRes.rows[0];
    return res.status(201).json({
      success: true,
      highlight: {
        ...newHl,
        stories: sRes.rows.map(s => ({
          ...s,
          duration: Number(s.duration || 10.0)
        })),
        story_count: sRes.rows.length
      }
    });
  } catch (err) {
    console.error("[CREATE HIGHLIGHT ERROR]", err);
    return res.status(500).json({ error: "Failed to create highlight" });
  }
});

/* =======================================================
   3.10. UPDATE STORY HIGHLIGHT (Append stories, touch updated_at to push to front)
   PATCH /api/creator/:username/highlights/:id
======================================================= */
router.patch("/:username/highlights/:id", authenticateOwnerOrApiKey, async (req, res) => {
  const { username, id } = req.params;
  const { story_id, story_ids, title, cover_url } = req.body;

  try {
    let isOwner = false;
    let creatorId = null;

    if (req.isApiKey) {
      isOwner = true;
      const uRes = await pool.query(`SELECT id FROM app_users WHERE LOWER(username) = LOWER($1)`, [username]);
      if (uRes.rows.length > 0) creatorId = uRes.rows[0].id;
    } else {
      const userRes = await pool.query(`SELECT id, username, role FROM app_users WHERE id = $1`, [req.user.id]);
      if (userRes.rows.length === 0) return res.status(401).json({ error: "User not found" });
      const currentUser = userRes.rows[0];
      isOwner = currentUser.role === "admin" || currentUser.username.toLowerCase() === username.toLowerCase();
      creatorId = currentUser.id;
    }

    if (!isOwner) {
      return res.status(403).json({ error: "Only the profile owner can update highlights" });
    }

    const hlRes = await pool.query(
      `SELECT * FROM creator_story_highlights WHERE id = $1 AND LOWER(username) = LOWER($2)`,
      [id, username]
    );
    if (hlRes.rows.length === 0) {
      return res.status(404).json({ error: "Highlight not found" });
    }

    const currentHl = hlRes.rows[0];
    let updatedStoryIds = [...(currentHl.story_ids || [])];

    const toAdd = [];
    if (story_id && !isNaN(Number(story_id))) {
      toAdd.push(Number(story_id));
    }
    if (Array.isArray(story_ids)) {
      story_ids.forEach(sid => {
        const n = Number(sid);
        if (!isNaN(n) && n > 0) toAdd.push(n);
      });
    }

    if (toAdd.length > 0) {
      const validRes = await pool.query(
        `SELECT id, thumbnail_url, video_url, duration, sound_title, created_at, expires_at
         FROM creator_stories
         WHERE id = ANY($1::INT[]) AND LOWER(username) = LOWER($2)`,
        [toAdd, username]
      );
      const validIds = validRes.rows.map(r => r.id);

      toAdd.forEach(sid => {
        if (validIds.includes(sid) && !updatedStoryIds.includes(sid)) {
          updatedStoryIds.push(sid);
        }
      });
    }

    const newTitle = title !== undefined && String(title).trim() ? String(title).trim().slice(0, 100) : currentHl.title;
    const newCover = cover_url || currentHl.cover_url;

    // UPDATE with updated_at = NOW() -> Automatically pushes to front!
    const updateRes = await pool.query(
      `UPDATE creator_story_highlights
       SET story_ids = $1, title = $2, cover_url = $3, updated_at = NOW()
       WHERE id = $4 AND LOWER(username) = LOWER($5)
       RETURNING *`,
      [updatedStoryIds, newTitle, newCover, id, username]
    );

    const updated = updateRes.rows[0];

    let stories = [];
    if (updated.story_ids && updated.story_ids.length > 0) {
      const sRes = await pool.query(
        `SELECT id, thumbnail_url, video_url, duration, sound_title, created_at, expires_at
         FROM creator_stories
         WHERE id = ANY($1::INT[]) AND LOWER(username) = LOWER($2)
         ORDER BY created_at ASC`,
        [updated.story_ids, username]
      );
      stories = sRes.rows.map(s => ({ ...s, duration: Number(s.duration || 10.0) }));
    }

    return res.json({
      success: true,
      highlight: {
        ...updated,
        stories,
        story_count: stories.length
      }
    });
  } catch (err) {
    console.error("[UPDATE HIGHLIGHT ERROR]", err);
    return res.status(500).json({ error: "Failed to update highlight" });
  }
});

/* =======================================================
   3.11. DELETE STORY HIGHLIGHT
   DELETE /api/creator/:username/highlights/:id
======================================================= */
router.delete("/:username/highlights/:id", authenticateOwnerOrApiKey, async (req, res) => {
  const { username, id } = req.params;

  try {
    let isOwner = false;
    if (req.isApiKey) {
      isOwner = true;
    } else {
      const userRes = await pool.query(`SELECT id, username, role FROM app_users WHERE id = $1`, [req.user.id]);
      if (userRes.rows.length === 0) return res.status(401).json({ error: "User not found" });

      const currentUser = userRes.rows[0];
      isOwner = currentUser.role === "admin" || currentUser.username.toLowerCase() === username.toLowerCase();
    }

    if (!isOwner) {
      return res.status(403).json({ error: "Only the profile owner can delete highlights" });
    }

    await pool.query(
      `DELETE FROM creator_story_highlights WHERE id = $1 AND LOWER(username) = LOWER($2)`,
      [id, username]
    );

    return res.json({ success: true, deleted_id: Number(id) });
  } catch (err) {
    console.error("[DELETE HIGHLIGHT ERROR]", err);
    return res.status(500).json({ error: "Failed to delete highlight" });
  }
});

/* =======================================================
   4. GET CREATOR VIDEOS (Paginated)
   GET /api/creator/:username/videos
======================================================= */
router.get("/:username/videos", async (req, res) => {
  const { username } = req.params;
  const tab = (req.query.tab || req.query.category || "").toLowerCase().trim();
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.max(1, Math.min(50, Number(req.query.limit || 12)));
  const offset = (page - 1) * limit;

  try {
    const appUserRes = await pool.query(
      `SELECT id, username, display_name, telegram_user_id, subscription_price 
       FROM app_users 
       WHERE LOWER(username) = LOWER($1) 
          OR LOWER(COALESCE(display_name, '')) = LOWER($1)
          OR (telegram_user_id IS NOT NULL AND CAST(telegram_user_id AS TEXT) = $1)`,
      [username]
    );
    let creatorId = appUserRes.rows[0]?.id;
    let creatorTgId = appUserRes.rows[0]?.telegram_user_id || null;
    let creatorUsername = appUserRes.rows[0]?.username || username;
    let creatorDisplayName = appUserRes.rows[0]?.display_name || appUserRes.rows[0]?.username || username;
    let creatorSubPrice = Number(appUserRes.rows[0]?.subscription_price || 0);

    if (!creatorId) {
      const tgRes = await pool.query(
        "SELECT user_id, username, full_name FROM users WHERE LOWER(COALESCE(username, '')) = LOWER($1) OR LOWER(COALESCE(full_name, '')) = LOWER($1)",
        [username]
      );
      creatorId = tgRes.rows[0]?.user_id;
      creatorTgId = tgRes.rows[0]?.user_id;
      if (tgRes.rows[0]?.username) creatorUsername = tgRes.rows[0].username;
      creatorDisplayName = tgRes.rows[0]?.full_name || tgRes.rows[0]?.username || username;
      creatorSubPrice = 15;
    }

    const isOfficialCreator = 
      String(creatorId) === "458" ||
      String(creatorUsername || "").toLowerCase() === "naijaxxx" ||
      String(username || "").toLowerCase() === "naijaxxx";

    const legacyCondition = isOfficialCreator 
      ? "OR (LOWER(v.category) = 'premium' AND (v.uploader_id = 458 OR v.uploader_id = -1004344719694 OR v.uploader_id IS NULL OR v.uploader_id = 0 OR (v.chat_id != 'internal' AND (v.cloudflare_id IS NULL OR NOT v.cloudflare_id LIKE 'r2:%'))))"
      : "";

    let tabFilter = "";
    let tabFilterCount = "";
    if (tab === "premium") {
      tabFilter = "AND LOWER(v.category) = 'premium'";
      tabFilterCount = "AND LOWER(v.category) = 'premium'";
    } else if (tab === "reels") {
      tabFilter = "AND (v.media_group_id IS NULL OR v.media_group_id = 'none')";
      tabFilterCount = "AND (media_group_id IS NULL OR media_group_id = 'none')";
    }

    const videosRes = await pool.query(
      `WITH GroupedVideos AS (
        SELECT v.*,
          COALESCE(u.username, u.full_name, $1) as uploader_name,
          ROW_NUMBER() OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END ORDER BY v.created_at ASC) as rn,
          COUNT(*) OVER(PARTITION BY CASE WHEN v.media_group_id IS NOT NULL AND v.media_group_id != 'none' THEN v.media_group_id ELSE v.message_id END) as group_count
        FROM videos v
        LEFT JOIN users u ON v.uploader_id = u.user_id
        WHERE (
             LOWER(COALESCE(u.username, '')) = LOWER($1)
          OR LOWER(COALESCE(u.full_name, '')) = LOWER($1)
          OR LOWER(COALESCE(u.username, '')) = LOWER($2)
          OR LOWER(COALESCE(u.full_name, '')) = LOWER($2)
          OR CAST(v.uploader_id AS TEXT) = CAST($3 AS TEXT)
          OR ($6::BIGINT IS NOT NULL AND v.uploader_id = $6::BIGINT)
          ${legacyCondition}
        )
        AND (v.status = 'ready' OR v.status IS NULL)
        AND (v.status != 'flagged' AND v.status != 'deleted')
        AND (v.flags_count < 5 OR v.flags_count IS NULL)
        ${tabFilter}
      )
      SELECT * FROM GroupedVideos WHERE rn = 1 ORDER BY created_at DESC LIMIT $4 OFFSET $5`,
      [username, creatorUsername, String(creatorId || '0'), limit, offset, creatorTgId]
    );

    const countRes = await pool.query(
      `SELECT COUNT(DISTINCT CASE WHEN media_group_id IS NOT NULL AND media_group_id != 'none' THEN media_group_id ELSE message_id END)
       FROM videos v
       LEFT JOIN users u ON v.uploader_id = u.user_id
       WHERE (
            LOWER(COALESCE(u.username, '')) = LOWER($1)
         OR LOWER(COALESCE(u.full_name, '')) = LOWER($1)
         OR LOWER(COALESCE(u.username, '')) = LOWER($2)
         OR LOWER(COALESCE(u.full_name, '')) = LOWER($2)
         OR CAST(v.uploader_id AS TEXT) = CAST($3 AS TEXT)
         OR ($4::BIGINT IS NOT NULL AND v.uploader_id = $4::BIGINT)
         ${legacyCondition}
       )
       AND (v.status = 'ready' OR v.status IS NULL)
       AND (v.status != 'flagged' AND v.status != 'deleted')
       AND (v.flags_count < 5 OR v.flags_count IS NULL)
       ${tabFilterCount}`,
      [username, creatorUsername, String(creatorId || '0'), creatorTgId]
    );

    const totalVideos = Number(countRes.rows[0]?.count || 0);

    const apiBaseUrl = process.env.API_BASE_URL || "https://naijahomemade.com";
    const mappedVideos = videosRes.rows.map(v => ({
      id: v.id,
      chat_id: v.chat_id,
      message_id: v.message_id,
      uploader_id: v.uploader_id,
      uploader_name: creatorDisplayName || v.uploader_name || username,
      display_name: creatorDisplayName || v.uploader_name || username,
      uploader_handle: creatorUsername,
      subscription_price: creatorSubPrice,
      is_premium: String(v.category || "").toLowerCase().trim() === "premium",
      category: v.category,
      caption: v.caption,
      views: Number(v.views || 0),
      likes_count: Number(v.likes_count || 0),
      comments_count: Number(v.comments_count || 0),
      shares_count: Number(v.shares_count || 0),
      saves_count: Number(v.saves_count || 0),
      thumbnail_url: formatThumbnailUrl(v, apiBaseUrl),
      video_url: null,
      is_group: Number(v.group_count || 1) > 1,
      group_count: Number(v.group_count || 1),
      created_at: v.created_at
    }));

    res.json({
      page,
      limit,
      total: totalVideos,
      videos: mappedVideos,
      hasMore: offset + mappedVideos.length < totalVideos
    });
  } catch (err) {
    console.error("[CREATOR VIDEOS ERROR]", err);
    res.status(500).json({ error: "Failed to fetch creator videos" });
  }
});

/* =======================================================
   5. FOLLOW / UNFOLLOW CREATOR (FREE GENERAL FOLLOWING)
   POST /api/creator/:username/follow
======================================================= */
router.post("/:username/follow", authenticateToken, async (req, res) => {
  const { username } = req.params;
  const followerId = req.user.id;

  try {
    let creatorRes = await pool.query(
      "SELECT id, username FROM app_users WHERE LOWER(username) = LOWER($1) OR LOWER(COALESCE(display_name, '')) = LOWER($1)",
      [username]
    );

    let creatorId = creatorRes.rows[0]?.id;

    if (!creatorId) {
      const tgRes = await pool.query(
        "SELECT user_id FROM users WHERE LOWER(COALESCE(username, '')) = LOWER($1) OR LOWER(COALESCE(full_name, '')) = LOWER($1)",
        [username]
      );
      creatorId = tgRes.rows[0]?.user_id;
    }

    if (!creatorId) {
      return res.status(404).json({ error: "Creator not found" });
    }

    if (String(followerId) === String(creatorId)) {
      return res.status(400).json({ error: "You cannot follow yourself" });
    }

    const existing = await pool.query(
      "SELECT id FROM creator_follows WHERE follower_id = $1 AND creator_id = $2",
      [followerId, creatorId]
    );

    let isFollowing = false;
    if (existing.rows.length > 0) {
      await pool.query(
        "DELETE FROM creator_follows WHERE follower_id = $1 AND creator_id = $2",
        [followerId, creatorId]
      );
      isFollowing = false;
    } else {
      await pool.query(
        `INSERT INTO creator_follows (follower_id, creator_id) 
         VALUES ($1, $2)
         ON CONFLICT (follower_id, creator_id) DO NOTHING`,
        [followerId, creatorId]
      );
      isFollowing = true;
    }

    const totalRes = await pool.query(
      "SELECT COUNT(*) FROM creator_follows WHERE creator_id = $1",
      [creatorId]
    );

    res.json({
      success: true,
      following: isFollowing,
      followers_count: Number(totalRes.rows[0]?.count || 0)
    });
  } catch (err) {
    console.error("[CREATOR FOLLOW ERROR]", err);
    res.status(500).json({ error: "Failed to update follow status" });
  }
});

/* =======================================================
   6. SUBSCRIBE TO CREATOR (PAID VIP ACCESS)
   POST /api/creator/:username/subscribe
======================================================= */
router.post("/:username/subscribe", authenticateToken, async (req, res) => {
  const { username } = req.params;
  const subscriberId = req.user.id;

  try {
    // Find creator ID
    let creatorRes = await pool.query(
      "SELECT id, username, subscription_price FROM app_users WHERE LOWER(username) = LOWER($1) OR LOWER(COALESCE(display_name, '')) = LOWER($1)",
      [username]
    );

    let creatorId = creatorRes.rows[0]?.id;
    let subscriptionPrice = Number(creatorRes.rows[0]?.subscription_price || 0);

    if (!creatorId) {
      // Check telegram users
      const tgRes = await pool.query(
        "SELECT user_id FROM users WHERE LOWER(COALESCE(username, '')) = LOWER($1) OR LOWER(COALESCE(full_name, '')) = LOWER($1)",
        [username]
      );
      creatorId = tgRes.rows[0]?.user_id;
    }

    if (!creatorId) {
      return res.status(404).json({ error: "Creator not found" });
    }

    if (String(subscriberId) === String(creatorId)) {
      return res.status(400).json({ error: "You cannot subscribe to yourself" });
    }

    // Check existing active subscription
    const existing = await pool.query(
      "SELECT id, status, expires_at FROM creator_subscriptions WHERE subscriber_id = $1 AND creator_id = $2 AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())",
      [subscriberId, creatorId]
    );

    let isSubscribed = false;
    if (existing.rows.length > 0) {
      // Unsubscribe / Cancel
      await pool.query(
        "DELETE FROM creator_subscriptions WHERE subscriber_id = $1 AND creator_id = $2",
        [subscriberId, creatorId]
      );
      isSubscribed = false;
    } else {
      if (subscriptionPrice > 0) {
        return res.status(402).json({ 
          error: "Paid VIP subscription requires crypto checkout.",
          requires_payment: true,
          price: subscriptionPrice
        });
      }
      // Free subscribe
      await pool.query(
        `INSERT INTO creator_subscriptions (subscriber_id, creator_id, amount_paid, status, expires_at) 
         VALUES ($1, $2, 0, 'active', NULL)
         ON CONFLICT (subscriber_id, creator_id)
         DO UPDATE SET status = 'active', amount_paid = 0, expires_at = NULL`,
        [subscriberId, creatorId]
      );
      await pool.query(
        `INSERT INTO creator_follows (follower_id, creator_id)
         VALUES ($1, $2)
         ON CONFLICT (follower_id, creator_id) DO NOTHING`,
        [subscriberId, creatorId]
      );
      isSubscribed = true;
    }

    const totalRes = await pool.query(
      "SELECT COUNT(*) FROM creator_subscriptions WHERE creator_id = $1 AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())",
      [creatorId]
    );

    res.json({
      success: true,
      subscribed: isSubscribed,
      subscribers_count: Number(totalRes.rows[0]?.count || 0)
    });
  } catch (err) {
    console.error("[CREATOR SUBSCRIBE ERROR]", err);
    res.status(500).json({ error: "Failed to update subscription" });
  }
});

/* =======================================================
   6. TIP CREATOR
   POST /api/creator/:username/tip
======================================================= */
router.post("/:username/tip", authenticateToken, async (req, res) => {
  return res.status(400).json({
    error: "Direct unpaid tips are disabled. All creator tips must be initiated via secure crypto payment checkout (/api/crypto/create)."
  });
});

/* =======================================================
   7. GET FEATURED CREATORS (AUTHENTIC TELEGRAM CREATORS ONLY)
   GET /api/creator/featured/list
======================================================= */
// 🟢 In-memory cache for featured creators list (90s TTL)
let cachedFeaturedCreators = null;
let cachedFeaturedTime = 0;
const FEATURED_CACHE_TTL = 90 * 1000;

router.get("/featured/list", optionalAuth, async (req, res) => {
  try {
    const currentUserId = req.user?.id || null;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 24, 1), 150);
    const search = req.query.q || req.query.search || null;

    // Fast-path: In-memory cache for default discover list (no search query)
    if (!search && cachedFeaturedCreators && (Date.now() - cachedFeaturedTime < FEATURED_CACHE_TTL)) {
      let myFollows = new Set();
      let viewedStoryUsernames = new Set();
      if (currentUserId) {
        try {
          const [followRes, viewedRes] = await Promise.all([
            pool.query(
              "SELECT creator_id FROM creator_follows WHERE follower_id = $1",
              [currentUserId]
            ),
            pool.query(
              `SELECT DISTINCT LOWER(s.username) as username 
               FROM creator_stories s
               LEFT JOIN creator_story_views v ON (v.story_id = s.id AND v.user_id = $1)
               WHERE s.is_active = TRUE 
                 AND s.expires_at > NOW()
                 AND v.id IS NULL`,
              [currentUserId]
            )
          ]);
          myFollows = new Set(followRes.rows.map(r => String(r.creator_id)));
          const unviewedStoryUsernames = new Set(viewedRes.rows.map(r => r.username));
          const result = cachedFeaturedCreators.slice(0, limit).map(c => {
            const unameLower = String(c.username || '').toLowerCase();
            return {
              ...c,
              is_following: currentUserId ? Boolean(myFollows.has(String(c.id)) || (c.telegram_user_id && myFollows.has(String(c.telegram_user_id)))) : false,
              has_viewed_story: currentUserId ? Boolean(c.has_active_story && !unviewedStoryUsernames.has(unameLower)) : false
            };
          });

          return res.json({ creators: result });
        } catch (fErr) {}
      }
    }

    // Return exclusively genuine Telegram creators with randomized dynamic rotation
    // Strictly filter out any web user accounts
    let query = `SELECT u.id, u.username, u.display_name, 
              CASE 
                WHEN u.avatar_url IS NOT NULL AND u.avatar_url != '' AND u.avatar_url NOT LIKE '%default-avatar%' THEN u.avatar_url 
                ELSE '/api/avatar?user_id=' || COALESCE(u.telegram_user_id, u.id) 
              END as avatar_url, 
              u.banner_url, u.creator_category, 
              u.creator_bio, u.is_verified, u.subscription_price, u.telegram_user_id,
              COALESCE(followers.cnt, 0)::INT as followers_count,
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
       LEFT JOIN creator_follows my_follow ON (
         my_follow.follower_id = $1::INTEGER AND 
         (my_follow.creator_id = u.id OR (u.telegram_user_id IS NOT NULL AND my_follow.creator_id = u.telegram_user_id))
       )
       WHERE (
         u.email LIKE 'tg_%@internal.naijahomemade.com' 
         OR u.email = 'support@naijahomemade.com' 
         OR (u.is_managed = TRUE AND (u.telegram_user_id > 10000000 OR u.telegram_user_id < 0))
       )
       AND (u.email NOT LIKE '%@gmail.com' AND u.email NOT LIKE '%@yahoo.com' AND u.email NOT LIKE '%@hotmail.com')`;

    const params = [currentUserId];
    if (search && search.trim()) {
      const cleanSearch = search.replace(/^@/, '').trim().toLowerCase();
      params.push(`%${cleanSearch}%`);
      query += ` AND (LOWER(u.username) LIKE $${params.length} OR LOWER(COALESCE(u.display_name, '')) LIKE $${params.length} OR LOWER(COALESCE(u.creator_category, '')) LIKE $${params.length} OR LOWER(COALESCE(u.creator_bio, '')) LIKE $${params.length})`;
      query += ` ORDER BY followers_count DESC, u.id DESC`;
    } else {
      query += ` ORDER BY RANDOM()`;
    }

    params.push(limit);
    query += ` LIMIT $${params.length}`;

    const creatorsRes = await pool.query(query, params);

    let creators = creatorsRes.rows.map(c => ({
      ...c,
      followers_count: Number(c.followers_count || 0),
      is_following: Boolean(c.is_following)
    }));

    const apiBaseUrl = process.env.API_BASE_URL || "https://naijahomemade.com";
    const creatorIds = creators.map(c => c.id).filter(Boolean);

    let videosByCreator = {};
    if (creatorIds.length > 0) {
      try {
        const sampleVideosRes = await pool.query(
          `WITH creator_input AS (
             SELECT 
               u.id AS creator_id,
               u.telegram_user_id,
               LOWER(u.username) AS username
             FROM app_users u
             WHERE u.id = ANY($1::INT[])
           ),
           creator_matches AS (
             SELECT 
               ci.creator_id,
               ci.telegram_user_id,
               ci.username,
               u.user_id AS telegram_user_mapping
             FROM creator_input ci
             LEFT JOIN users u ON LOWER(u.username) = ci.username
           ),
           creator_videos AS (
             SELECT 
               cm.creator_id,
               v.id,
               v.chat_id,
               v.message_id,
               v.cloudflare_id,
               v.views,
               v.likes_count,
               v.category,
               v.caption,
               v.created_at,
               ROW_NUMBER() OVER (
                 PARTITION BY cm.creator_id 
                 ORDER BY RANDOM()
               ) as rank
             FROM creator_matches cm
             JOIN videos v ON v.status = 'ready' AND (
               v.uploader_id = cm.telegram_user_id
               OR v.uploader_id = cm.creator_id
               OR (cm.telegram_user_mapping IS NOT NULL AND v.uploader_id = cm.telegram_user_mapping)
             )
           )
           SELECT * FROM creator_videos WHERE rank <= 30`,
          [creatorIds]
        );

        for (const row of sampleVideosRes.rows) {
          if (!videosByCreator[row.creator_id]) {
            videosByCreator[row.creator_id] = [];
          }
          videosByCreator[row.creator_id].push(row);
        }
      } catch (vidErr) {
        console.error("[FEATURED CREATORS SAMPLE VIDEOS ERROR]", vidErr);
      }
    }

    // Check active 24-hour status stories for featured creators
    let activeStoryUsernames = new Set();
    let viewedStoryUsernames = new Set();
    try {
      const activeStoriesRes = await pool.query(
        "SELECT DISTINCT LOWER(username) as username FROM creator_stories WHERE is_active = TRUE AND expires_at > NOW()"
      );
      activeStoryUsernames = new Set(activeStoriesRes.rows.map(r => r.username));

      if (currentUserId) {
        const unviewedRes = await pool.query(
          `SELECT DISTINCT LOWER(s.username) as username 
           FROM creator_stories s
           LEFT JOIN creator_story_views v ON (v.story_id = s.id AND v.user_id = $1)
           WHERE s.is_active = TRUE 
             AND s.expires_at > NOW()
             AND v.id IS NULL`,
          [currentUserId]
        );
        viewedStoryUsernames = new Set(unviewedRes.rows.map(r => r.username));
      }
    } catch (sErr) {}

    creators = creators.map(c => {
      const poolVideos = videosByCreator[c.id] || [];
      // Pick up to 4 randomly from their most-performing videos
      const shuffled = [...poolVideos].sort(() => 0.5 - Math.random());
      const selected = shuffled.slice(0, 4);

      const sample_videos = selected.map(v => ({
        id: v.id,
        chat_id: v.chat_id,
        message_id: v.message_id,
        cloudflare_id: v.cloudflare_id,
        thumbnail_url: formatThumbnailUrl(v, apiBaseUrl),
        views: Number(v.views || 0),
        likes_count: Number(v.likes_count || 0),
        category: v.category,
        caption: v.caption || "",
        is_premium: String(v.category || "").toLowerCase().trim() === "premium",
        subscription_price: Number(c.subscription_price || 0),
        uploader_id: c.telegram_user_id || c.id,
        uploader_name: c.display_name || c.username,
        uploader_handle: c.username
      }));

      const unameLower = String(c.username || '').toLowerCase();
      const hasActiveStory = activeStoryUsernames.has(unameLower);
      const hasViewedStory = Boolean(currentUserId && hasActiveStory && !viewedStoryUsernames.has(unameLower));

      return {
        ...c,
        has_active_story: hasActiveStory,
        has_viewed_story: hasViewedStory,
        sample_videos
      };
    });

    if (!search || !search.trim()) {
      creators.sort((a, b) => {
        const aCount = (a.sample_videos && a.sample_videos.length > 0) ? 1 : 0;
        const bCount = (b.sample_videos && b.sample_videos.length > 0) ? 1 : 0;
        return bCount - aCount;
      });
      // Store in memory cache for subsequent requests (without user-specific following/viewed flags)
      cachedFeaturedCreators = creators.map(c => ({
        ...c,
        is_following: false,
        has_viewed_story: false
      }));
      cachedFeaturedTime = Date.now();
    }

    res.json({ creators });
  } catch (err) {
    console.error("[FEATURED CREATORS ERROR]", err);
    res.status(500).json({ error: "Failed to fetch featured creators" });
  }
});

export default router;
