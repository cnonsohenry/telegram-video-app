/* =======================================================
   Backend: Creator Routes & OnlyFans-Style Monetization
   File: backend/creator.js
======================================================= */
import express from "express";
import fs from "fs";
import multer from "multer";
import jwt from "jsonwebtoken";
import pool from "./db.js";
import { authenticateToken, JWT_SECRET } from "./auth.js";
import { uploadVideoToR2, deleteMediaFromR2, R2_PUBLIC_DOMAIN } from "./r2.js";

const router = express.Router();

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
   1. UPGRADE USER TO CREATOR
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
          is_verified = COALESCE(is_verified, FALSE),
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
                subscription_price, social_links, is_verified, location, website;
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

    console.log(`[CREATOR] User @${existing.username} (ID ${userId}) upgraded to Creator!`);
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("[CREATOR UPGRADE ERROR]", err);
    res.status(500).json({ error: "Failed to upgrade to creator account" });
  }
});

/* =======================================================
   2. UPDATE CREATOR PROFILE
   PATCH /api/creator/profile
======================================================= */
router.patch("/profile", authenticateToken, async (req, res) => {
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

    const cleanDisplayName = display_name !== undefined ? String(display_name).trim().slice(0, 100) : null;
    const cleanBio = creator_bio !== undefined ? String(creator_bio).trim().slice(0, 500) : null;
    const cleanCategory = creator_category !== undefined ? String(creator_category).trim().slice(0, 50) : null;
    const cleanPrice = subscription_price !== undefined ? Math.max(0, Math.min(10000000, Number(subscription_price) || 0)) : null;
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
                subscription_price, social_links, is_verified, location, website;
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
    res.status(500).json({ error: "Failed to update creator profile" });
  }
});

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
       WHERE CAST(v.uploader_id AS TEXT) = CAST($1 AS TEXT) 
          OR LOWER(COALESCE(u.username, '')) = LOWER($2)
       ORDER BY v.views DESC
       LIMIT 30`,
      [userId, creator.username]
    );

    const videoSummaryRes = await pool.query(
      `SELECT COUNT(*) as posts_count, COALESCE(SUM(v.views), 0) as total_views, COALESCE(SUM(v.likes_count), 0) as total_likes
       FROM videos v
       LEFT JOIN users u ON v.uploader_id = u.user_id
       WHERE CAST(v.uploader_id AS TEXT) = CAST($1 AS TEXT) 
          OR LOWER(COALESCE(u.username, '')) = LOWER($2)`,
      [userId, creator.username]
    );

    const postsCount = Number(videoSummaryRes.rows[0]?.posts_count || 0);
    const totalViews = Number(videoSummaryRes.rows[0]?.total_views || 0);
    const totalLikes = Number(videoSummaryRes.rows[0]?.total_likes || 0);

    const apiBaseUrl = process.env.API_BASE_URL || "https://videos.naijahomemade.com";
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
   2C. CREATOR CONTENT UPLOAD (Public & VIP / Premium)
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
    // 1. Fetch user & ensure creator access
    const userRes = await pool.query(
      `SELECT id, username, display_name, is_creator, role, is_verified 
       FROM app_users WHERE id = $1`,
      [userId]
    );

    if (userRes.rows.length === 0) {
      if (fs.existsSync(videoFile.path)) fs.unlinkSync(videoFile.path);
      return res.status(404).json({ error: "User account not found." });
    }

    const creator = userRes.rows[0];

    // If user is not yet marked as creator, automatically activate creator status
    if (!creator.is_creator) {
      await pool.query(
        `UPDATE app_users 
         SET is_creator = TRUE, 
             role = CASE WHEN role = 'admin' THEN 'admin' ELSE 'creator' END 
         WHERE id = $1`,
        [userId]
      );
    }

    // 2. Ensure creator exists in users table to satisfy any joins or legacy references
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
    const allowedPublicCategories = ["hotties", "amateur", "college", "trends", "shots", "general"];
    let safeCategory = "hotties";
    if (isVip) {
      safeCategory = "premium";
    } else if (category && allowedPublicCategories.includes(String(category).toLowerCase().trim())) {
      safeCategory = String(category).toLowerCase().trim();
    }

    const sanitizedCaption = caption ? String(caption).trim().slice(0, 1000) : "";
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

    // 5. Insert video record into database
    const insertRes = await pool.query(
      `INSERT INTO videos (
         chat_id, message_id, file_id, uploader_id, category, caption, cloudflare_id, status, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'ready', NOW())
       RETURNING id, chat_id, message_id, uploader_id, category, caption, cloudflare_id, created_at, views, likes_count, comments_count`,
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
    const apiBaseUrl = process.env.API_BASE_URL || "https://videos.naijahomemade.com";
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
    return res.status(500).json({ error: err.message || "Failed to upload video to Cloudflare R2" });
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
   3. GET PUBLIC CREATOR PROFILE
   GET /api/creator/:username
======================================================= */
router.get("/:username", optionalAuth, async (req, res) => {
  const { username } = req.params;
  if (!username) return res.status(400).json({ error: "Username required" });

  try {
    // 1. Search in app_users
    let creatorQuery = await pool.query(
      `SELECT id, username, avatar_url, role, is_premium,
              is_creator, display_name, creator_bio, banner_url, creator_category, 
              subscription_price, social_links, is_verified, location, website, created_at
       FROM app_users 
       WHERE LOWER(username) = LOWER($1) OR LOWER(COALESCE(display_name, '')) = LOWER($1)`,
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
        creator = {
          id: tgUser.user_id,
          username: tgUser.username || tgUser.full_name || username,
          display_name: tgUser.full_name || tgUser.username || username,
          avatar_url: `/api/avatar?user_id=${tgUser.user_id}`,
          banner_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80",
          creator_bio: "Official creator channel. Catch all exclusive drops and daily previews here.",
          creator_category: "Featured Creator",
          subscription_price: 15000,
          social_links: tgUser.username ? { telegram: `https://t.me/${tgUser.username}` } : {},
          is_creator: true,
          is_verified: true,
          location: "Lagos, Nigeria",
          website: "",
          created_at: tgUser.created_at
        };
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
          creator = {
            id: row.uploader_id || 0,
            username: username,
            display_name: row.uploader_name || username,
            avatar_url: row.uploader_id ? `/api/avatar?user_id=${row.uploader_id}` : "/assets/default-avatar.png",
            banner_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80",
            creator_bio: "Welcome to my official creator hub. Follow for exclusive content and daily drops.",
            creator_category: "Creator",
            subscription_price: 15000,
            social_links: {},
            is_creator: true,
            is_verified: true,
            location: "",
            website: "",
            created_at: new Date()
          };
        } else {
          return res.status(404).json({ error: "Creator not found" });
        }
      }
    }

    // Default values
    if (!creator.display_name) creator.display_name = creator.username;
    if (!creator.banner_url) creator.banner_url = "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80";
    if (!creator.creator_category) creator.creator_category = "Creator";

    // 2. Fetch Creator Stats
    let subCount = 0;
    try {
      if (creator.id && Number(creator.id) !== 0) {
        const subRes = await pool.query(
          "SELECT COUNT(*) FROM creator_subscriptions WHERE creator_id = $1 AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())",
          [creator.id]
        );
        subCount = Number(subRes.rows[0]?.count || 0);
      }
    } catch (e) {}

    // Video & views stats
    const statsRes = await pool.query(
      `SELECT 
         COUNT(*) as posts_count,
         COALESCE(SUM(v.views), 0) as views_count,
         COALESCE(SUM(v.likes_count), 0) as likes_count
       FROM videos v
       LEFT JOIN users u ON v.uploader_id = u.user_id
       WHERE LOWER(COALESCE(u.username, '')) = LOWER($1) 
          OR LOWER(COALESCE(u.full_name, '')) = LOWER($1)
          OR LOWER(COALESCE(u.username, '')) = LOWER($2)
          OR LOWER(COALESCE(u.full_name, '')) = LOWER($2)
          OR CAST(v.uploader_id AS TEXT) = CAST($3 AS TEXT)`,
      [creator.username, username, String(creator.id || '0')]
    );

    const postsCount = Number(statsRes.rows[0]?.posts_count || 0);
    const viewsCount = Number(statsRes.rows[0]?.views_count || 0);
    const likesCount = Number(statsRes.rows[0]?.likes_count || 0);

    // Calculate fans (if real subs are 0, estimate fans from engagement for realistic feel)
    const baseFans = Math.max(subCount, Math.floor(viewsCount * 0.05) + Math.floor(likesCount * 0.2));

    // 3. Determine if requesting user is subscribed
    let isSubscribed = false;
    let isOwner = false;

    if (req.user && creator.id && Number(creator.id) !== 0) {
      if (Number(req.user.id) === Number(creator.id)) {
        isOwner = true;
      } else {
        try {
          const checkSub = await pool.query(
            "SELECT id FROM creator_subscriptions WHERE subscriber_id = $1 AND creator_id = $2 AND status = 'active' AND (expires_at IS NULL OR expires_at > NOW())",
            [req.user.id, creator.id]
          );
          isSubscribed = checkSub.rows.length > 0;
        } catch (e) {}
      }
    }

    // 4. Fetch First 12 Videos
    const videosRes = await pool.query(
      `SELECT v.*, COALESCE(u.username, u.full_name, 'Member') as uploader_name
       FROM videos v
       LEFT JOIN users u ON v.uploader_id = u.user_id
       WHERE LOWER(COALESCE(u.username, '')) = LOWER($1) 
          OR LOWER(COALESCE(u.full_name, '')) = LOWER($1)
          OR LOWER(COALESCE(u.username, '')) = LOWER($2)
          OR LOWER(COALESCE(u.full_name, '')) = LOWER($2)
          OR CAST(v.uploader_id AS TEXT) = CAST($3 AS TEXT)
       ORDER BY v.created_at DESC
       LIMIT 12`,
      [creator.username, username, String(creator.id || '0')]
    );

    const apiBaseUrl = process.env.API_BASE_URL || "https://videos.naijahomemade.com";
    const mappedVideos = videosRes.rows.map(v => ({
      id: v.id,
      chat_id: v.chat_id,
      message_id: v.message_id,
      uploader_id: v.uploader_id,
      uploader_name: v.uploader_name || creator.username,
      category: v.category,
      caption: v.caption,
      views: Number(v.views || 0),
      likes_count: Number(v.likes_count || 0),
      comments_count: Number(v.comments_count || 0),
      shares_count: Number(v.shares_count || 0),
      saves_count: Number(v.saves_count || 0),
      thumbnail_url: formatThumbnailUrl(v, apiBaseUrl),
      video_url: null,
      is_group: Boolean(v.media_group_id && v.media_group_id !== 'none'),
      created_at: v.created_at
    }));

    res.json({
      creator: {
        ...creator,
        stats: {
          subscribers: subCount || baseFans,
          posts: postsCount,
          likes: likesCount,
          views: viewsCount
        },
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
   4. GET CREATOR VIDEOS (Paginated)
   GET /api/creator/:username/videos
======================================================= */
router.get("/:username/videos", async (req, res) => {
  const { username } = req.params;
  const page = Math.max(1, Number(req.query.page || 1));
  const limit = Math.max(1, Math.min(50, Number(req.query.limit || 12)));
  const offset = (page - 1) * limit;

  try {
    const appUserRes = await pool.query(
      "SELECT id, username FROM app_users WHERE LOWER(username) = LOWER($1) OR LOWER(COALESCE(display_name, '')) = LOWER($1)",
      [username]
    );
    let creatorId = appUserRes.rows[0]?.id;
    let creatorUsername = appUserRes.rows[0]?.username || username;

    if (!creatorId) {
      const tgRes = await pool.query(
        "SELECT user_id, username, full_name FROM users WHERE LOWER(COALESCE(username, '')) = LOWER($1) OR LOWER(COALESCE(full_name, '')) = LOWER($1)",
        [username]
      );
      creatorId = tgRes.rows[0]?.user_id;
      if (tgRes.rows[0]?.username) creatorUsername = tgRes.rows[0].username;
    }

    const videosRes = await pool.query(
      `SELECT v.*, COALESCE(u.username, u.full_name, $1) as uploader_name
       FROM videos v
       LEFT JOIN users u ON v.uploader_id = u.user_id
       WHERE LOWER(COALESCE(u.username, '')) = LOWER($1)
          OR LOWER(COALESCE(u.full_name, '')) = LOWER($1)
          OR LOWER(COALESCE(u.username, '')) = LOWER($2)
          OR LOWER(COALESCE(u.full_name, '')) = LOWER($2)
          OR CAST(v.uploader_id AS TEXT) = CAST($3 AS TEXT)
       ORDER BY v.created_at DESC
       LIMIT $4 OFFSET $5`,
      [username, creatorUsername, String(creatorId || '0'), limit, offset]
    );

    const countRes = await pool.query(
      `SELECT COUNT(*)
       FROM videos v
       LEFT JOIN users u ON v.uploader_id = u.user_id
       WHERE LOWER(COALESCE(u.username, '')) = LOWER($1)
          OR LOWER(COALESCE(u.full_name, '')) = LOWER($1)
          OR LOWER(COALESCE(u.username, '')) = LOWER($2)
          OR LOWER(COALESCE(u.full_name, '')) = LOWER($2)
          OR CAST(v.uploader_id AS TEXT) = CAST($3 AS TEXT)`,
      [username, creatorUsername, String(creatorId || '0')]
    );

    const totalVideos = Number(countRes.rows[0]?.count || 0);

    const apiBaseUrl = process.env.API_BASE_URL || "https://videos.naijahomemade.com";
    const mappedVideos = videosRes.rows.map(v => ({
      id: v.id,
      chat_id: v.chat_id,
      message_id: v.message_id,
      uploader_id: v.uploader_id,
      uploader_name: v.uploader_name || username,
      category: v.category,
      caption: v.caption,
      views: Number(v.views || 0),
      likes_count: Number(v.likes_count || 0),
      comments_count: Number(v.comments_count || 0),
      shares_count: Number(v.shares_count || 0),
      saves_count: Number(v.saves_count || 0),
      thumbnail_url: formatThumbnailUrl(v, apiBaseUrl),
      video_url: null,
      is_group: Boolean(v.media_group_id && v.media_group_id !== 'none'),
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
   5. SUBSCRIBE / FOLLOW CREATOR
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
  const { username } = req.params;
  const { amount, message } = req.body;
  const senderId = req.user.id;

  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount < 100 || numericAmount > 5000000) {
    return res.status(400).json({ error: "Invalid tip amount. Tips must be between ₦100 and ₦5,000,000." });
  }

  try {
    let creatorRes = await pool.query(
      "SELECT id, username, display_name FROM app_users WHERE LOWER(username) = LOWER($1) OR LOWER(COALESCE(display_name, '')) = LOWER($1)",
      [username]
    );

    let creator = creatorRes.rows[0];
    if (!creator) {
      const tgRes = await pool.query(
        "SELECT user_id as id, username, full_name as display_name FROM users WHERE LOWER(COALESCE(username, '')) = LOWER($1) OR LOWER(COALESCE(full_name, '')) = LOWER($1)",
        [username]
      );
      creator = tgRes.rows[0];
    }

    if (!creator) return res.status(404).json({ error: "Creator not found" });

    if (String(senderId) === String(creator.id)) {
      return res.status(400).json({ error: "You cannot tip yourself" });
    }

    await pool.query(
      "INSERT INTO creator_tips (sender_id, creator_id, amount, message) VALUES ($1, $2, $3, $4)",
      [senderId, creator.id, numericAmount, message ? String(message).trim().slice(0, 300) : ""]
    );

    res.json({
      success: true,
      message: `Thank you for tipping ${creator.display_name || creator.username}! 🔥`,
      tip: { amount: numericAmount, creator: creator.display_name || creator.username }
    });
  } catch (err) {
    console.error("[CREATOR TIP ERROR]", err);
    res.status(500).json({ error: "Failed to process tip" });
  }
});

/* =======================================================
   7. GET FEATURED CREATORS
   GET /api/creator/featured/list
======================================================= */
router.get("/featured/list", async (req, res) => {
  try {
    // Return verified creators or users with the highest activity
    const creatorsRes = await pool.query(
      `SELECT id, username, display_name, avatar_url, banner_url, creator_category, 
              creator_bio, is_verified, subscription_price
       FROM app_users 
       WHERE is_creator = TRUE 
       ORDER BY id DESC 
       LIMIT 10`
    );

    let creators = creatorsRes.rows;

    // If fewer than 4 registered creators, supplement with top uploaders
    if (creators.length < 4) {
      const uploaderRes = await pool.query(
        `SELECT u.user_id as id, u.username, u.full_name as display_name,
                COUNT(v.id) as video_count,
                COALESCE(SUM(v.views), 0) as total_views
         FROM users u
         JOIN videos v ON u.user_id = v.uploader_id
         GROUP BY u.user_id, u.username, u.full_name
         ORDER BY total_views DESC
         LIMIT 6`
      );

      const mappedUploaders = uploaderRes.rows.map(u => ({
        id: u.id,
        username: u.username,
        display_name: u.display_name || u.username,
        avatar_url: `/api/avatar?user_id=${u.id}`,
        banner_url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80",
        creator_category: "Top Creator",
        creator_bio: "Official creator on the platform. Daily exclusive videos & drops.",
        is_verified: true,
        subscription_price: 15000
      }));

      // Merge avoiding duplicates
      const existingUsernames = new Set(creators.map(c => c.username.toLowerCase()));
      for (const u of mappedUploaders) {
        if (!existingUsernames.has(u.username.toLowerCase())) {
          creators.push(u);
        }
      }
    }

    res.json({ creators });
  } catch (err) {
    console.error("[FEATURED CREATORS ERROR]", err);
    res.status(500).json({ error: "Failed to fetch featured creators" });
  }
});

export default router;
