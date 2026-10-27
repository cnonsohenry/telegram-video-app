/* =====================
   Backend: Admin Command Center
   File: backend/admin.js
===================== */
import express from "express";
import { authenticateToken } from "./auth.js"; 
import pool from "./db.js";
import { deleteMediaFromR2 } from "./r2.js";
import { syncTelegramCreatorProfile } from "./telegramCreatorSync.js";

const router = express.Router();

// 🟢 1. THE BOUNCER: Admin-Only Middleware
export const isAdmin = async (req, res, next) => {
  try {
    const userQuery = await pool.query("SELECT role FROM app_users WHERE id = $1", [req.user.id]);
    if (userQuery.rows.length === 0 || userQuery.rows[0].role !== 'admin') {
      return res.status(403).json({ error: "Access Denied. Admins only." });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: "Server error verifying admin status." });
  }
};

// 🟢 2. DASHBOARD STATS (Comprehensive Platform Intelligence)
router.get("/stats", authenticateToken, isAdmin, async (req, res) => {
  try {
    const [
      usersRes,
      premiumRes,
      creatorsCountRes,
      videosRes,
      engagementRes,
      storiesRes,
      reportsRes,
      txUSDApprovedRes,
      txNGNApprovedRes,
      txUSDPendingRes,
      txNGNPendingRes,
      subsRes,
      catsRes,
      storageRes,
      timeSeriesRes,
      topCreatorsRes
    ] = await Promise.all([
      // 1. Users
      pool.query("SELECT COUNT(*) FROM app_users"),
      pool.query("SELECT COUNT(*) FROM app_users WHERE is_premium = true"),
      pool.query(`
        SELECT 
          COUNT(*) FILTER (WHERE is_creator = true OR is_managed = true) as total_creators,
          COUNT(*) FILTER (WHERE is_managed = true) as managed_creators,
          COUNT(*) FILTER (WHERE (is_creator = true OR is_managed = true) AND (is_managed IS FALSE OR is_managed IS NULL)) as web_creators
        FROM app_users
      `),
      // 2. Videos & Views
      pool.query("SELECT COUNT(*) as total_videos, COALESCE(SUM(views), 0)::bigint as total_views FROM videos"),
      // 3. Engagement
      pool.query(`
        SELECT 
          (SELECT COUNT(*) FROM likes) as likes,
          (SELECT COUNT(*) FROM comments) as comments,
          (SELECT COUNT(*) FROM saves) as saves,
          (SELECT COUNT(*) FROM creator_follows) as follows
      `),
      // 4. 24h Stories
      pool.query(`
        SELECT 
          COUNT(*) as total_stories,
          COUNT(*) FILTER (WHERE expires_at > NOW() AND is_active = true) as active_stories,
          COUNT(DISTINCT creator_id) FILTER (WHERE expires_at > NOW() AND is_active = true) as active_creators
        FROM creator_stories
      `),
      // 5. Reports
      pool.query("SELECT COUNT(*) FROM video_reports WHERE status = 'pending'"),
      // 6. USD Transactions Approved (< 1000)
      pool.query("SELECT COUNT(*), COALESCE(SUM(expected_amount), 0)::float as sum FROM transactions WHERE status = 'APPROVED' AND expected_amount < 1000"),
      // 7. NGN Transactions Approved (>= 1000)
      pool.query("SELECT COUNT(*), COALESCE(SUM(expected_amount), 0)::float as sum FROM transactions WHERE status = 'APPROVED' AND expected_amount >= 1000"),
      // 8. USD Crypto Transactions Pending (< 1000)
      pool.query("SELECT COUNT(*), COALESCE(SUM(expected_amount), 0)::float as sum FROM transactions WHERE (status = 'PENDING' OR status = 'WAITING') AND expected_amount < 1000"),
      // 9. NGN Bank Transactions Pending (>= 1000)
      pool.query("SELECT COUNT(*), COALESCE(SUM(expected_amount), 0)::float as sum FROM transactions WHERE (status = 'PENDING' OR status = 'WAITING') AND expected_amount >= 1000"),
      // 10. Subscriptions
      pool.query("SELECT COUNT(*) FROM creator_subscriptions WHERE status = 'active' AND (expires_at IS NULL OR expires_at > NOW())"),
      // 11. Categories
      pool.query("SELECT category, COUNT(*) as count, COALESCE(SUM(views), 0)::bigint as views FROM videos GROUP BY category ORDER BY count DESC"),
      // 12. Storage distribution
      pool.query(`
        SELECT 
          CASE 
            WHEN cloudflare_id LIKE 'r2:%' THEN 'r2' 
            WHEN cloudflare_id IS NOT NULL AND cloudflare_id != 'none' THEN 'stream' 
            ELSE 'telegram' 
          END as storage_type, 
          COUNT(*) 
        FROM videos 
        GROUP BY 1
      `),
      // 13. 30-day gapless time-series
      pool.query(`
        WITH days AS (
          SELECT generate_series(
            DATE_TRUNC('day', NOW() - INTERVAL '29 days'),
            DATE_TRUNC('day', NOW()),
            '1 day'::interval
          )::date AS day
        ),
        u AS (
          SELECT DATE(created_at) as day, COUNT(*) as signups 
          FROM app_users 
          WHERE created_at >= NOW() - INTERVAL '30 days' 
          GROUP BY 1
        ),
        v AS (
          SELECT DATE(created_at) as day, COUNT(*) as uploads 
          FROM videos 
          WHERE created_at >= NOW() - INTERVAL '30 days' 
          GROUP BY 1
        ),
        t AS (
          SELECT DATE(created_at) as day, 
                 COUNT(*) FILTER (WHERE status = 'APPROVED') as approved_tx,
                 COALESCE(SUM(expected_amount) FILTER (WHERE status = 'APPROVED' AND expected_amount < 1000), 0) as usd_rev,
                 COALESCE(SUM(expected_amount) FILTER (WHERE status = 'APPROVED' AND expected_amount >= 1000), 0) as ngn_rev
          FROM transactions 
          WHERE created_at >= NOW() - INTERVAL '30 days' 
          GROUP BY 1
        ),
        s AS (
          SELECT DATE(created_at) as day, COUNT(*) as stories_count
          FROM creator_stories 
          WHERE created_at >= NOW() - INTERVAL '30 days' 
          GROUP BY 1
        )
        SELECT 
          TO_CHAR(d.day, 'YYYY-MM-DD') as date,
          TO_CHAR(d.day, 'Mon DD') as label,
          COALESCE(u.signups, 0)::int as signups,
          COALESCE(v.uploads, 0)::int as uploads,
          COALESCE(t.approved_tx, 0)::int as approved_tx,
          COALESCE(t.usd_rev, 0)::float as usd_rev,
          COALESCE(t.ngn_rev, 0)::float as ngn_rev,
          COALESCE(s.stories_count, 0)::int as stories
        FROM days d
        LEFT JOIN u ON d.day = u.day
        LEFT JOIN v ON d.day = v.day
        LEFT JOIN t ON d.day = t.day
        LEFT JOIN s ON d.day = s.day
        ORDER BY d.day ASC
      `),
      // 14. Top creators
      pool.query(`
        SELECT 
          u.id, 
          u.username, 
          COALESCE(u.display_name, u.username) as display_name,
          u.avatar_url,
          COALESCE(u.creator_category, 'Creator') as creator_category,
          COALESCE(u.is_verified, false) as is_verified,
          COALESCE(u.is_managed, false) as is_managed,
          COALESCE(SUM(v.views), 0)::bigint as total_views,
          COUNT(v.id)::int as total_posts,
          (SELECT COUNT(*) FROM creator_subscriptions cs WHERE (cs.creator_id = u.id OR (u.telegram_user_id IS NOT NULL AND cs.creator_id = u.telegram_user_id)) AND cs.status = 'active')::int as active_subs,
          (SELECT COUNT(*) FROM creator_follows cf WHERE cf.creator_id = u.id)::int as followers_count
        FROM app_users u
        LEFT JOIN videos v ON (v.uploader_id = u.id OR (u.telegram_user_id IS NOT NULL AND v.uploader_id = u.telegram_user_id))
        WHERE u.is_creator = true OR u.is_managed = true
        GROUP BY u.id
        ORDER BY total_views DESC
        LIMIT 8
      `)
    ]);

    const totalUsers = parseInt(usersRes.rows[0].count);
    const premiumUsers = parseInt(premiumRes.rows[0].count);
    const creatorsInfo = creatorsCountRes.rows[0];
    const videosInfo = videosRes.rows[0];
    const engagementInfo = engagementRes.rows[0];
    const storiesInfo = storiesRes.rows[0];
    const pendingReportsCount = parseInt(reportsRes.rows[0].count);

    const approvedUsd = parseFloat(txUSDApprovedRes.rows[0].sum || 0);
    const approvedUsdCount = parseInt(txUSDApprovedRes.rows[0].count);
    const approvedNgn = parseFloat(txNGNApprovedRes.rows[0].sum || 0);
    const approvedNgnCount = parseInt(txNGNApprovedRes.rows[0].count);

    const pendingUsd = parseFloat(txUSDPendingRes.rows[0].sum || 0);
    const pendingUsdCount = parseInt(txUSDPendingRes.rows[0].count);
    const pendingNgn = parseFloat(txNGNPendingRes.rows[0].sum || 0);
    const pendingNgnCount = parseInt(txNGNPendingRes.rows[0].count);

    const activeSubsCount = parseInt(subsRes.rows[0].count);

    const storageMap = { r2: 0, stream: 0, telegram: 0 };
    for (const r of storageRes.rows) {
      storageMap[r.storage_type] = parseInt(r.count);
    }

    res.json({
      // Backwards-compatible top-level keys
      total_users: totalUsers,
      premium_users: premiumUsers,
      total_revenue_usd: approvedUsd.toFixed(2),
      pending_crypto_orders: pendingUsdCount,

      overview: {
        total_users: totalUsers,
        premium_users: premiumUsers,
        total_creators: parseInt(creatorsInfo.total_creators || 0),
        managed_creators: parseInt(creatorsInfo.managed_creators || 0),
        web_creators: parseInt(creatorsInfo.web_creators || 0),
        total_videos: parseInt(videosInfo.total_videos || 0),
        total_views: parseInt(videosInfo.total_views || 0),
        total_likes: parseInt(engagementInfo.likes || 0),
        total_comments: parseInt(engagementInfo.comments || 0),
        total_saves: parseInt(engagementInfo.saves || 0),
        total_follows: parseInt(engagementInfo.follows || 0),
        total_stories: parseInt(storiesInfo.total_stories || 0),
        active_stories: parseInt(storiesInfo.active_stories || 0),
        active_story_creators: parseInt(storiesInfo.active_creators || 0),
        pending_reports: pendingReportsCount
      },
      financials: {
        approved_usd: approvedUsd,
        approved_usd_count: approvedUsdCount,
        approved_ngn: approvedNgn,
        approved_ngn_count: approvedNgnCount,
        pending_crypto_usd: pendingUsd,
        pending_crypto_count: pendingUsdCount,
        pending_bank_ngn: pendingNgn,
        pending_bank_count: pendingNgnCount,
        active_subscriptions: activeSubsCount
      },
      categories: catsRes.rows.map(c => ({
        category: c.category || "uncategorized",
        count: parseInt(c.count || 0),
        views: parseInt(c.views || 0)
      })),
      storage: storageMap,
      time_series: timeSeriesRes.rows,
      top_creators: topCreatorsRes.rows
    });
  } catch (err) {
    console.error("[ADMIN STATS ERROR]", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// 🟢 3. GET ALL USERS (With Pagination, Search & Tier Filter)
router.get("/users", authenticateToken, isAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const search = req.query.search ? req.query.search.trim() : null;
    const tier = req.query.tier; // 'premium' | 'free'
    const role = req.query.role; // 'admin' | 'user'

    let whereClauses = [];
    let params = [];
    let idx = 1;

    if (search) {
      whereClauses.push(`(username ILIKE $${idx} OR email ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    if (tier === 'premium') {
      whereClauses.push(`is_premium = true`);
    } else if (tier === 'free') {
      whereClauses.push(`(is_premium IS FALSE OR is_premium IS NULL)`);
    }

    if (role) {
      whereClauses.push(`role = $${idx}`);
      params.push(role);
      idx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await pool.query(`SELECT COUNT(*) FROM app_users ${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count);

    const users = await pool.query(`
      SELECT id, username, email, role, is_premium, is_banned, ban_reason, created_at 
      FROM app_users 
      ${whereSql}
      ORDER BY created_at DESC 
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.json({
      users: users.rows,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error("[ADMIN USERS ERROR]", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// 🟢 4. GET TRANSACTIONS (With Pagination & Currency Split)
router.get("/transactions", authenticateToken, isAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const status = req.query.status && req.query.status !== 'all' ? req.query.status : null;
    const currency = req.query.currency; // 'USD' | 'NGN'

    let whereClauses = [];
    let params = [];
    let idx = 1;

    if (status) {
      if (status === 'APPROVED') {
        whereClauses.push(`t.status = 'APPROVED'`);
      } else if (status === 'PENDING') {
        whereClauses.push(`(t.status = 'PENDING' OR t.status = 'WAITING')`);
      } else {
        whereClauses.push(`t.status = $${idx}`);
        params.push(status);
        idx++;
      }
    }

    if (currency === 'USD') {
      whereClauses.push(`t.expected_amount < 1000`);
    } else if (currency === 'NGN') {
      whereClauses.push(`t.expected_amount >= 1000`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await pool.query(`SELECT COUNT(*) FROM transactions t ${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count);

    const tx = await pool.query(`
      SELECT 
        t.*, 
        t.expected_amount AS amount, 
        COALESCE(t.status, 'PENDING') AS payment_method, 
        u.username, 
        u.email 
      FROM transactions t
      LEFT JOIN app_users u ON t.app_user_id = u.id
      ${whereSql}
      ORDER BY t.created_at DESC 
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.json({
      transactions: tx.rows,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error("[ADMIN TX ERROR]", err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// 🟢 5. GET ALL VIDEOS (With Pagination, Search & Category Filter)
router.get("/all-videos", authenticateToken, isAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;
    const category = req.query.category && req.query.category !== 'all' ? req.query.category : null;
    const search = req.query.search ? req.query.search.trim() : null;

    let whereClauses = [];
    let params = [];
    let idx = 1;

    if (category) {
      whereClauses.push(`category = $${idx}`);
      params.push(category);
      idx++;
    }

    if (search) {
      whereClauses.push(`caption ILIKE $${idx}`);
      params.push(`%${search}%`);
      idx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await pool.query(`SELECT COUNT(*), COALESCE(SUM(views), 0)::bigint as total_views FROM videos ${whereSql}`, params);
    const total = parseInt(countRes.rows[0].count);
    const filteredViews = parseInt(countRes.rows[0].total_views || 0);

    const videos = await pool.query(`
      SELECT id, chat_id, message_id, caption, category, views, cloudflare_id, created_at 
      FROM videos 
      ${whereSql}
      ORDER BY created_at DESC 
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);
    
    // Auto-generate thumbnails for the grid
    const formatted = videos.rows.map(v => {
      let thumbUrl = "";
      if (v.cloudflare_id && v.cloudflare_id !== "none" && !v.cloudflare_id.startsWith("r2:")) {
        thumbUrl = `https://videodelivery.net/${v.cloudflare_id.split('?')[0]}/thumbnails/thumbnail.jpg?time=1s&height=600`;
      } else {
        const baseUrl = process.env.API_BASE_URL || 'https://naijahomemade.com';
        thumbUrl = `${baseUrl}/api/thumbnail?chat_id=${v.chat_id}&message_id=${v.message_id}`;
      }
      return {
        ...v,
        thumbnail_url: thumbUrl
      };
    });
    
    res.json({
      videos: formatted,
      total,
      total_views: filteredViews,
      page,
      limit,
      total_pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error("[ADMIN ALL-VIDEOS ERROR]", err);
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

// 🟢 6. UPDATE VIDEO (Edit Caption/Category)
router.put("/video/:identifier", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { identifier } = req.params;
    const { caption, category } = req.body;

    const result = await pool.query(
      `UPDATE videos 
       SET caption = $1, category = $2 
       WHERE message_id = $3 OR id::text = $3 
       RETURNING *`,
      [caption, category, identifier]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Video not found" });
    }

    res.json({ success: true, video: result.rows[0] });
  } catch (err) {
    console.error("Update failed", err);
    res.status(500).json({ error: "Update failed" });
  }
});

// 🟢 7. DELETE VIDEO (With Transaction)
router.delete("/video/:identifier", authenticateToken, isAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { identifier } = req.params;
    await client.query('BEGIN');

    // Find the exact message_id first to cleanly wipe dependencies
    const videoQuery = await client.query(
      "SELECT message_id, cloudflare_id FROM videos WHERE message_id = $1 OR id::text = $1",
      [identifier]
    );

    if (videoQuery.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Video not found" });
    }

    const targetMessageId = videoQuery.rows[0].message_id;
    const targetCloudflareId = videoQuery.rows[0].cloudflare_id;

    // Delete interactions tied to this video to prevent foreign key constraint errors
    await client.query("DELETE FROM likes WHERE message_id = $1", [targetMessageId]);
    await client.query("DELETE FROM saves WHERE message_id = $1", [targetMessageId]);
    await client.query("DELETE FROM comments WHERE message_id = $1", [targetMessageId]);

    // Now delete the actual video
    await client.query("DELETE FROM videos WHERE message_id = $1", [targetMessageId]);

    await client.query('COMMIT');

    // Clean up R2 objects if hosted on R2
    if (targetCloudflareId && targetCloudflareId.startsWith("r2:")) {
      deleteMediaFromR2(targetCloudflareId, targetMessageId).catch(e => 
        console.warn("R2 async delete warning:", e.message)
      );
    }

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Delete failed", err);
    res.status(500).json({ error: "Delete failed" });
  } finally {
    client.release();
  }
});

// 🟢 8. UPDATE USER (Role / Premium Status)
router.put("/user/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const userId = req.params.id;
    const { role, is_premium } = req.body;

    const updates = [];
    const values = [];
    let idx = 1;

    if (role !== undefined) {
      if (!['user', 'admin'].includes(role)) {
        return res.status(400).json({ error: "Invalid role specified" });
      }
      updates.push(`role = $${idx++}`);
      values.push(role);
    }

    if (is_premium !== undefined) {
      updates.push(`is_premium = $${idx++}`);
      values.push(Boolean(is_premium));
    }

    if (req.body.is_banned !== undefined) {
      updates.push(`is_banned = $${idx++}`);
      values.push(Boolean(req.body.is_banned));
    }

    if (req.body.ban_reason !== undefined) {
      updates.push(`ban_reason = $${idx++}`);
      values.push(String(req.body.ban_reason));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    values.push(userId);
    const query = `UPDATE app_users SET ${updates.join(", ")} WHERE id = $${idx} RETURNING id, username, email, role, is_premium, is_banned, ban_reason`;
    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Keep creator_subscriptions in sync with @naijaxxx
    if (is_premium !== undefined) {
      try {
        const mainCreator = await pool.query(
          "SELECT id FROM app_users WHERE id = 458 OR LOWER(username) IN ('naijaxxx', 'naijahomemade') LIMIT 1"
        );
        if (mainCreator.rows.length > 0) {
          if (is_premium === true) {
            await pool.query(
              `INSERT INTO creator_subscriptions (subscriber_id, creator_id, amount_paid, status, expires_at)
               VALUES ($1, $2, 15, 'active', NOW() + INTERVAL '10 years')
               ON CONFLICT (subscriber_id, creator_id) DO UPDATE 
               SET status = 'active', expires_at = GREATEST(creator_subscriptions.expires_at, NOW() + INTERVAL '10 years')`,
              [userId, mainCreator.rows[0].id]
            );
          } else {
            await pool.query(
              "UPDATE creator_subscriptions SET status = 'cancelled' WHERE subscriber_id = $1 AND creator_id = $2",
              [userId, mainCreator.rows[0].id]
            );
          }
        }
      } catch (subSyncErr) {
        console.warn("[ADMIN UPDATE USER] Notice syncing VIP subscription:", subSyncErr.message);
      }
    }

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error("[UPDATE USER ERROR]", err);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// 🟢 9. DELETE USER (With Cascade Cleanup & Transaction)
router.delete("/user/:id", authenticateToken, isAdmin, async (req, res) => {
  const userId = req.params.id;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch the user first to get their Telegram user_id if linked
    const userQuery = await client.query("SELECT * FROM app_users WHERE id = $1", [userId]);
    if (userQuery.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "User not found" });
    }
    const user = userQuery.rows[0];

    // 2. Clean up user interactions to prevent foreign key violations
    await client.query("DELETE FROM likes WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM saves WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM comments WHERE user_id = $1", [userId]);
    await client.query("DELETE FROM transactions WHERE app_user_id = $1", [userId]);

    // 3. Unlink or reassign videos uploaded by this user (Sets uploader_id to NULL so videos aren't deleted)
    if (user.username) {
      await client.query(`
        UPDATE videos 
        SET uploader_id = NULL 
        WHERE uploader_id IN (SELECT user_id FROM users WHERE username = $1)
      `, [user.username]);
    }

    // 4. Finally, delete the user from app_users
    await client.query("DELETE FROM app_users WHERE id = $1", [userId]);

    await client.query('COMMIT');
    res.json({ success: true, message: "User and associated records cleaned up successfully." });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("[DELETE USER ERROR]", err);
    res.status(500).json({ error: "Failed to delete user due to database constraints." });
  } finally {
    client.release();
  }
});

// 🟢 HELPER: Sync Telegram Uploaders into app_users as Managed Creators
export async function syncTelegramCreators(poolInstance) {
  const db = poolInstance || pool;
  let count = 0;
  try {
    // 1. Fetch all distinct uploaders from videos & users table
    const uploadersRes = await db.query(`
      SELECT DISTINCT 
        v.uploader_id, 
        u.username, 
        u.full_name,
        (
          SELECT category 
          FROM videos v2 
          WHERE v2.uploader_id = v.uploader_id AND v2.category IS NOT NULL 
          GROUP BY category 
          ORDER BY COUNT(*) DESC 
          LIMIT 1
        ) as top_category
      FROM videos v
      LEFT JOIN users u ON v.uploader_id = u.user_id
      WHERE v.uploader_id IS NOT NULL
    `);

    // Also include any users in users table that might not have videos yet
    const rawUsersRes = await db.query(`
      SELECT user_id as uploader_id, username, full_name, 'Creator' as top_category 
      FROM users
    `);

    const combinedMap = new Map();
    for (const r of uploadersRes.rows) {
      if (r.uploader_id) combinedMap.set(String(r.uploader_id), r);
    }
    for (const r of rawUsersRes.rows) {
      if (r.uploader_id && !combinedMap.has(String(r.uploader_id))) {
        combinedMap.set(String(r.uploader_id), r);
      }
    }

    for (const [uploaderIdStr, info] of combinedMap.entries()) {
      const uploaderIdNum = Number(uploaderIdStr);
      if (!uploaderIdNum || isNaN(uploaderIdNum)) continue;

      // Strictly skip web accounts (web user IDs are positive integers < 10,000,000)
      if (uploaderIdNum > 0 && uploaderIdNum < 10000000) continue;

      // Check if already in app_users
      const existing = await db.query(
        `SELECT id, username, telegram_user_id, is_managed, email 
         FROM app_users 
         WHERE telegram_user_id = $1 
            OR (username IS NOT NULL AND LOWER(username) = LOWER($2))`,
        [uploaderIdNum, info.username || '']
      );

      // Do NOT overwrite web user accounts with personal emails
      if (existing.rows.length > 0) {
        const userRow = existing.rows[0];
        if (userRow.email && (userRow.email.includes('@gmail.com') || userRow.email.includes('@yahoo.com') || userRow.email.includes('@hotmail.com'))) {
          continue;
        }
      }

      const defaultCategory = info.top_category && info.top_category !== 'none' 
        ? (info.top_category.charAt(0).toUpperCase() + info.top_category.slice(1)) 
        : 'Creator';
      const displayName = info.full_name || info.username || `Creator ${uploaderIdNum}`;

      if (existing.rows.length > 0) {
        // Update existing record to ensure it is marked as a managed creator
        await db.query(
          `UPDATE app_users 
           SET is_creator = TRUE, 
               is_managed = TRUE, 
               telegram_user_id = COALESCE(telegram_user_id, $1),
               display_name = COALESCE(display_name, $2),
               creator_category = COALESCE(creator_category, $3)
           WHERE id = $4`,
          [uploaderIdNum, displayName, defaultCategory, existing.rows[0].id]
        );
        count++;
      } else {
        // Pick safe username
        let baseUsername = info.username 
          ? info.username.toLowerCase().replace(/[^a-z0-9_]/g, '')
          : `tg_${uploaderIdNum}`;
        if (!baseUsername) baseUsername = `tg_${uploaderIdNum}`;

        // Check if baseUsername is already taken
        const checkUname = await db.query(
          "SELECT id FROM app_users WHERE LOWER(username) = LOWER($1)",
          [baseUsername]
        );
        if (checkUname.rows.length > 0) {
          baseUsername = `${baseUsername}_${uploaderIdStr.slice(-4)}`;
        }

        const syntheticEmail = `tg_${uploaderIdNum}@internal.naijahomemade.com`;

        await db.query(
          `INSERT INTO app_users (
             username, display_name, email, is_creator, is_managed, 
             telegram_user_id, creator_category, subscription_price, is_verified, 
             banner_url, creator_bio, avatar_url
           ) VALUES ($1, $2, $3, TRUE, TRUE, $4, $5, 15, TRUE, 
             'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80',
             'Official Telegram channel. Catch all exclusive drops and daily previews here.',
             $6
           )
           ON CONFLICT (telegram_user_id) DO UPDATE 
           SET is_creator = TRUE, is_managed = TRUE`,
          [
            baseUsername, 
            displayName, 
            syntheticEmail, 
            uploaderIdNum, 
            defaultCategory,
            `/api/avatar?user_id=${uploaderIdNum}`
          ]
        );
        count++;
      }
    }

    try {
      await migrateLegacyVipToCreator(db);
    } catch (mErr) {
      console.warn("[SYNC TELEGRAM CREATORS] VIP migration notice:", mErr.message);
    }

    // Automatically fetch profile pic and bio from Telegram for managed creators
    try {
      const managedRes = await db.query(
        "SELECT * FROM app_users WHERE is_creator = TRUE AND (is_managed = TRUE OR telegram_user_id IS NOT NULL)"
      );
      for (const mc of managedRes.rows) {
        try {
          await syncTelegramCreatorProfile(mc, db);
        } catch (sErr) {
          console.warn(`[SYNC TELEGRAM CREATORS] Warning syncing ${mc.username}:`, sErr.message);
        }
      }
    } catch (syncErr) {
      console.warn("[SYNC TELEGRAM CREATORS] Profile pic/bio sync notice:", syncErr.message);
    }

    console.log(`[SYNC TELEGRAM CREATORS] Successfully synced/verified ${count} Telegram creator(s).`);
    return { success: true, count };
  } catch (err) {
    console.error("[SYNC TELEGRAM CREATORS ERROR]", err);
    return { success: false, error: err.message };
  }
}

// 🟢 9C. MIGRATE LEGACY VIP USERS & PREMIUM VIDEOS TO @NAIJAHOMEMADE
export async function migrateLegacyVipToCreator(poolInstance) {
  const db = poolInstance || pool;
  try {
    console.log("[MIGRATE VIP] Starting migration of legacy VIP users and premium videos to @naijahomemade...");

    // 1. Ensure target creator @naijahomemade exists and is properly flagged as a managed creator
    const targetCreatorRes = await db.query(
      `SELECT id, username, subscription_price 
       FROM app_users 
       WHERE id = 458
          OR LOWER(username) IN ('naijaxxx', 'naijahomemade')
       ORDER BY id ASC
       LIMIT 1`
    );

    let creatorAppUserId;
    if (targetCreatorRes.rows.length === 0) {
      const insRes = await db.query(
        `INSERT INTO app_users (
           username, display_name, email, is_creator, is_managed, 
           source_channel, creator_category, subscription_price, is_verified, 
           banner_url, creator_bio, avatar_url
         ) VALUES (
           'naijaxxx', 'Naija xxx', 'tg_naijaxxx@internal.naijahomemade.com',
           TRUE, TRUE, '-1004344719694', 'Official VIP', 15, TRUE,
           'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80',
           'Official Naija xxx VIP channel. All exclusive premium drops and uncut releases.',
           'https://naijahomemade.com/assets/default-avatar.png'
         )
         RETURNING id`
      );
      creatorAppUserId = insRes.rows[0].id;
    } else {
      creatorAppUserId = targetCreatorRes.rows[0].id;
      await db.query(
        `UPDATE app_users 
         SET is_creator = TRUE, 
             is_managed = TRUE, 
             source_channel = '-1004344719694',
             username = 'naijaxxx',
             display_name = COALESCE(display_name, 'Naija xxx'),
             creator_category = COALESCE(creator_category, 'Official VIP'),
             subscription_price = CASE WHEN subscription_price IS NULL OR subscription_price = 0 THEN 15 ELSE subscription_price END,
             is_verified = TRUE
         WHERE id = $1`,
        [creatorAppUserId]
      );
    }

    // 1b. Ensure creator exists in users table so legacy JOINs succeed
    await db.query(
      `INSERT INTO users (user_id, username, full_name)
       VALUES ($1, 'naijaxxx', 'Naija xxx')
       ON CONFLICT (user_id) DO UPDATE 
       SET username = 'naijaxxx', full_name = 'Naija xxx'`,
      [creatorAppUserId]
    );

    // 2. Move legacy Telegram VIP videos to @naijaxxx (app_users.id = creatorAppUserId)
    // CRITICAL: NEVER overwrite web creator uploads (chat_id = 'internal' or cloudflare_id starting with 'r2:')
    // and NEVER overwrite videos that already have a valid uploader assigned!
    const vidsUpdateRes = await db.query(
      `UPDATE videos 
       SET uploader_id = $1 
       WHERE LOWER(category) = 'premium' 
         AND (chat_id IS NULL OR chat_id != 'internal')
         AND (cloudflare_id IS NULL OR NOT cloudflare_id LIKE 'r2:%')
         AND (uploader_id IS NULL OR uploader_id = 0 OR uploader_id = $1 OR uploader_id = -1004344719694)`,
      [creatorAppUserId]
    );
    const videosMoved = vidsUpdateRes.rowCount || 0;
    console.log(`[MIGRATE VIP] Reassigned ${videosMoved} unassigned legacy premium videos to @naijaxxx (ID: ${creatorAppUserId}).`);

    // 3. Move all existing VIP/Premium users into creator_subscriptions for @naijahomemade
    const subsRes = await db.query(
      `INSERT INTO creator_subscriptions (subscriber_id, creator_id, amount_paid, status, expires_at)
       SELECT DISTINCT u.id, $1::BIGINT, 15, 'active', NOW() + INTERVAL '10 years'
       FROM app_users u
       LEFT JOIN transactions t ON u.id = t.app_user_id AND t.status = 'APPROVED'
       WHERE (u.is_premium = TRUE OR t.id IS NOT NULL)
         AND u.id != $1::INTEGER
       ON CONFLICT (subscriber_id, creator_id) DO UPDATE 
       SET status = 'active', 
           expires_at = GREATEST(creator_subscriptions.expires_at, NOW() + INTERVAL '10 years')
       RETURNING subscriber_id`,
      [Number(creatorAppUserId)]
    );

    const usersMoved = subsRes.rowCount || 0;
    console.log(`[MIGRATE VIP] Subscribed ${usersMoved} legacy VIP/premium users to @naijahomemade.`);

    // 4. Double check subscriber count
    const countCheck = await db.query(
      "SELECT COUNT(*) FROM creator_subscriptions WHERE creator_id = $1 AND status = 'active'",
      [creatorAppUserId]
    );
    const totalSubs = Number(countCheck.rows[0]?.count || 0);

    return { 
      success: true, 
      creator_id: creatorAppUserId, 
      creator_username: "naijahomemade",
      videos_migrated: videosMoved, 
      users_migrated: usersMoved,
      total_active_subscribers: totalSubs 
    };
  } catch (err) {
    console.error("[MIGRATE VIP ERROR]", err);
    return { success: false, error: err.message };
  }
}

// 🟢 10. GET ALL CREATORS (Admin Creator Management)
router.get("/creators", authenticateToken, isAdmin, async (req, res) => {
  try {
    const creatorsRes = await pool.query(`
      SELECT 
        u.id, 
        u.username, 
        u.email, 
        COALESCE(u.display_name, u.username) as display_name, 
        CASE 
          WHEN u.avatar_url IS NOT NULL AND u.avatar_url != '' AND u.avatar_url NOT LIKE '%default-avatar%' THEN u.avatar_url 
          ELSE '/api/avatar?user_id=' || COALESCE(u.telegram_user_id, u.id) 
        END as avatar_url, 
        u.banner_url, 
        u.creator_bio, 
        COALESCE(u.creator_category, 'Creator') as creator_category, 
        COALESCE(u.subscription_price, 0) as subscription_price, 
        COALESCE(u.is_verified, false) as is_verified, 
        COALESCE(u.is_creator, false) as is_creator, 
        COALESCE(u.is_managed, false) as is_managed,
        u.telegram_user_id,
        u.source_channel,
        u.created_at,
        (
          SELECT COUNT(*) 
          FROM creator_subscriptions cs 
          WHERE (cs.creator_id = u.id OR (u.telegram_user_id IS NOT NULL AND cs.creator_id = u.telegram_user_id))
            AND cs.status = 'active' 
            AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
        ) as subscribers_count,
        (
          SELECT COALESCE(SUM(expected_amount), 0)
          FROM transactions t
          WHERE (t.creator_id = u.id OR (u.telegram_user_id IS NOT NULL AND t.creator_id = u.telegram_user_id))
            AND t.transaction_type = 'creator_sub' 
            AND t.status = 'APPROVED'
        ) as subscription_revenue_usd,
        (
          SELECT COUNT(*) 
          FROM creator_tips ct 
          WHERE (ct.creator_id = u.id OR (u.telegram_user_id IS NOT NULL AND ct.creator_id = u.telegram_user_id))
        ) as tips_count,
        (
          SELECT COALESCE(SUM(amount), 0) 
          FROM creator_tips ct 
          WHERE (ct.creator_id = u.id OR (u.telegram_user_id IS NOT NULL AND ct.creator_id = u.telegram_user_id))
        ) as tips_total,
        (
          SELECT COUNT(*) 
          FROM videos v 
          LEFT JOIN users tg ON v.uploader_id = tg.user_id
          WHERE v.uploader_id = u.id 
             OR (u.telegram_user_id IS NOT NULL AND v.uploader_id = u.telegram_user_id)
             OR LOWER(COALESCE(tg.username, '')) = LOWER(u.username)
        ) as posts_count,
        (
          SELECT COALESCE(SUM(views), 0) 
          FROM videos v 
          LEFT JOIN users tg ON v.uploader_id = tg.user_id
          WHERE v.uploader_id = u.id 
             OR (u.telegram_user_id IS NOT NULL AND v.uploader_id = u.telegram_user_id)
             OR LOWER(COALESCE(tg.username, '')) = LOWER(u.username)
        ) as total_views
      FROM app_users u
      WHERE u.is_creator = true OR u.subscription_price > 0 OR u.is_managed = true
      ORDER BY u.created_at DESC
    `);

    // Overview aggregate metrics
    const statsRes = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM app_users WHERE is_creator = true OR is_managed = true) as total_creators,
        (SELECT COUNT(*) FROM app_users WHERE is_managed = true) as managed_creators,
        (SELECT COUNT(*) FROM app_users WHERE (is_creator = true OR is_managed = true) AND is_verified = true) as verified_creators,
        (SELECT COUNT(*) FROM creator_subscriptions WHERE status = 'active' AND (expires_at IS NULL OR expires_at > NOW())) as total_active_subscriptions,
        (SELECT COALESCE(SUM(expected_amount), 0) FROM transactions WHERE transaction_type = 'creator_sub' AND status = 'APPROVED') as total_sub_revenue_usd,
        (SELECT COALESCE(SUM(amount), 0) FROM creator_tips) as total_tips_ngn
    `);

    res.json({
      creators: creatorsRes.rows.map(c => ({
        ...c,
        subscribers_count: Number(c.subscribers_count || 0),
        subscription_revenue_usd: Number(c.subscription_revenue_usd || 0),
        tips_count: Number(c.tips_count || 0),
        tips_total: Number(c.tips_total || 0),
        posts_count: Number(c.posts_count || 0),
        total_views: Number(c.total_views || 0)
      })),
      stats: {
        total_creators: Number(statsRes.rows[0]?.total_creators || 0),
        managed_creators: Number(statsRes.rows[0]?.managed_creators || 0),
        verified_creators: Number(statsRes.rows[0]?.verified_creators || 0),
        total_active_subscriptions: Number(statsRes.rows[0]?.total_active_subscriptions || 0),
        total_sub_revenue_usd: Number(statsRes.rows[0]?.total_sub_revenue_usd || 0),
        total_tips_ngn: Number(statsRes.rows[0]?.total_tips_ngn || 0)
      }
    });
  } catch (err) {
    console.error("[ADMIN GET CREATORS ERROR]", err);
    res.status(500).json({ error: "Failed to fetch creators" });
  }
});

// 🟢 10B. SYNC TELEGRAM CREATORS ON DEMAND
router.post("/creators/sync-telegram", authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await syncTelegramCreators(pool);
    res.json(result);
  } catch (err) {
    console.error("[ADMIN SYNC TELEGRAM CREATORS ROUTE ERROR]", err);
    res.status(500).json({ error: "Failed to sync Telegram creators" });
  }
});

// 🟢 10C. MIGRATE LEGACY VIP & PREMIUM VIDEOS ON DEMAND
router.post("/creators/migrate-legacy-vip", authenticateToken, isAdmin, async (req, res) => {
  try {
    const result = await migrateLegacyVipToCreator(pool);
    res.json(result);
  } catch (err) {
    console.error("[ADMIN MIGRATE LEGACY VIP ROUTE ERROR]", err);
    res.status(500).json({ error: "Failed to migrate legacy VIP users and premium videos" });
  }
});

// 🟢 11. UPDATE CREATOR (Verification Badge, Category, Price, Creator Status, Avatar, Banner)
router.put("/creator/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const creatorId = req.params.id;
    const { 
      is_verified, 
      is_creator, 
      is_managed,
      subscription_price, 
      creator_category, 
      display_name, 
      creator_bio,
      avatar_url,
      banner_url,
      username
    } = req.body;

    const updates = [];
    const values = [];
    let idx = 1;

    if (is_verified !== undefined) {
      updates.push(`is_verified = $${idx++}`);
      values.push(Boolean(is_verified));
    }

    if (is_creator !== undefined) {
      updates.push(`is_creator = $${idx++}`);
      values.push(Boolean(is_creator));
    }

    if (is_managed !== undefined) {
      updates.push(`is_managed = $${idx++}`);
      values.push(Boolean(is_managed));
    }

    if (subscription_price !== undefined) {
      const price = Number(subscription_price);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ error: "Invalid subscription price" });
      }
      updates.push(`subscription_price = $${idx++}`);
      values.push(price);
    }

    if (creator_category !== undefined) {
      updates.push(`creator_category = $${idx++}`);
      values.push(String(creator_category).trim().slice(0, 50));
    }

    if (display_name !== undefined) {
      updates.push(`display_name = $${idx++}`);
      values.push(String(display_name).trim().slice(0, 100));
    }

    if (creator_bio !== undefined) {
      updates.push(`creator_bio = $${idx++}`);
      values.push(String(creator_bio).trim().slice(0, 500));
    }

    if (avatar_url !== undefined && typeof avatar_url === 'string') {
      updates.push(`avatar_url = $${idx++}`);
      values.push(avatar_url.trim().slice(0, 500));
    }

    if (banner_url !== undefined && typeof banner_url === 'string') {
      updates.push(`banner_url = $${idx++}`);
      values.push(banner_url.trim().slice(0, 500));
    }

    if (username !== undefined) {
      const cleanUsername = String(username).trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 50);
      if (cleanUsername) {
        const uCheck = await pool.query("SELECT id FROM app_users WHERE LOWER(username) = LOWER($1) AND id != $2", [cleanUsername, creatorId]);
        if (uCheck.rows.length > 0) {
          return res.status(400).json({ error: "Username is already taken by another account" });
        }
        updates.push(`username = $${idx++}`);
        values.push(cleanUsername);
      }
    }

    if (req.body.source_channel !== undefined) {
      updates.push(`source_channel = $${idx++}`);
      values.push(req.body.source_channel ? String(req.body.source_channel).trim() : null);
    }

    if (req.body.telegram_user_id !== undefined) {
      updates.push(`telegram_user_id = $${idx++}`);
      values.push(req.body.telegram_user_id ? Number(req.body.telegram_user_id) : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields provided to update" });
    }

    values.push(creatorId);
    const query = `
      UPDATE app_users 
      SET ${updates.join(", ")} 
      WHERE id = $${idx} 
      RETURNING id, username, email, display_name, avatar_url, banner_url, 
                creator_bio, creator_category, subscription_price, is_verified, is_creator, is_managed, telegram_user_id, source_channel
    `;

    const result = await pool.query(query, values);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Creator not found" });
    }

    let creator = result.rows[0];
    if (req.body.fetch_telegram === true) {
      try {
        creator = await syncTelegramCreatorProfile(creator, pool);
      } catch (fErr) {
        console.warn("[ADMIN UPDATE CREATOR] Fetch telegram notice:", fErr.message);
      }
    }

    res.json({ success: true, creator });
  } catch (err) {
    console.error("[ADMIN UPDATE CREATOR ERROR]", err);
    res.status(500).json({ error: "Failed to update creator" });
  }
});

// 🟢 11B. SYNC SINGLE TELEGRAM CREATOR (Fetch Profile Pic & Bio from Channel)
router.post("/creator/:id/sync-telegram", authenticateToken, isAdmin, async (req, res) => {
  try {
    const creatorId = req.params.id;
    const { source_channel } = req.body;
    const existing = await pool.query("SELECT * FROM app_users WHERE id = $1", [creatorId]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: "Creator not found" });
    }
    const creator = existing.rows[0];
    if (source_channel !== undefined) {
      creator.source_channel = source_channel ? String(source_channel).trim() : null;
    }

    if (!creator.source_channel && !creator.telegram_user_id) {
      return res.status(400).json({ 
        error: "Please enter a Telegram channel handle or link (e.g. @channel_name or https://t.me/channel_name) first." 
      });
    }

    const updated = await syncTelegramCreatorProfile(creator, pool, { throwOnError: true });
    res.json({ success: true, creator: updated, notice: updated.notice || null });
  } catch (err) {
    console.error("[ADMIN SYNC SINGLE CREATOR ERROR]", err);
    res.status(400).json({ error: err.message || "Failed to sync creator from Telegram" });
  }
});

// 🟢 GLOBAL DATABASE SEARCH
router.get("/search", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ users: [], videos: [], transactions: [], creators: [] });

    const cleanQ = q.replace(/^@/, '').trim();
    const searchParam = `%${cleanQ}%`;

    // Query all core tables simultaneously including creators
    const [usersRes, videosRes, txRes, creatorsRes] = await Promise.all([
      pool.query(`SELECT * FROM app_users WHERE username ILIKE $1 OR email ILIKE $1 LIMIT 20`, [searchParam]),
      
      pool.query(`SELECT * FROM videos WHERE caption ILIKE $1 OR category ILIKE $1 LIMIT 20`, [searchParam]),
      
      pool.query(`
        SELECT 
          t.*, 
          t.expected_amount AS amount, 
          COALESCE(t.status, 'PENDING') AS payment_method, 
          u.username, 
          u.email 
        FROM transactions t 
        LEFT JOIN app_users u ON t.app_user_id = u.id 
        WHERE u.username ILIKE $1 OR u.email ILIKE $1 OR t.status ILIKE $1 OR t.sender_name ILIKE $1
        LIMIT 20
      `, [searchParam]),

      pool.query(`
        SELECT id, username, email, display_name, avatar_url, creator_category, subscription_price, is_verified, is_creator, COALESCE(is_managed, false) as is_managed
        FROM app_users
        WHERE (is_creator = true OR subscription_price > 0 OR is_managed = true)
          AND (username ILIKE $1 OR display_name ILIKE $1 OR creator_category ILIKE $1 OR creator_bio ILIKE $1)
        LIMIT 20
      `, [searchParam])
    ]);

    // Format videos to include thumbnails so the search results show images
    const formattedVideos = videosRes.rows.map(v => {
      let thumbUrl = "";
      if (v.cloudflare_id && v.cloudflare_id !== "none" && !v.cloudflare_id.startsWith("r2:")) {
        thumbUrl = `https://videodelivery.net/${v.cloudflare_id.split('?')[0]}/thumbnails/thumbnail.jpg?time=1s&height=600`;
      } else {
        const baseUrl = process.env.API_BASE_URL || 'https://naijahomemade.com';
        thumbUrl = `${baseUrl}/api/thumbnail?chat_id=${v.chat_id}&message_id=${v.message_id}`;
      }
      return { ...v, thumbnail_url: thumbUrl };
    });

    res.json({
      users: usersRes.rows,
      videos: formattedVideos,
      transactions: txRes.rows,
      creators: creatorsRes.rows
    });
  } catch (err) {
    console.error("Global search failed:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

// 🟢 12. GET REPORTS
router.get("/reports", authenticateToken, isAdmin, async (req, res) => {
  try {
    const reports = await pool.query(`
      SELECT r.*, 
             v.caption, v.category, v.views, v.cloudflare_id, v.chat_id, v.status as video_status,
             u.username as uploader_username, u.display_name as uploader_display_name,
             rep.username as reporter_username, rep.email as reporter_email
      FROM video_reports r
      LEFT JOIN videos v ON r.message_id = v.message_id
      LEFT JOIN app_users u ON (v.uploader_id = u.id OR v.uploader_id = u.telegram_user_id)
      LEFT JOIN app_users rep ON r.reporter_id = rep.id
      ORDER BY r.created_at DESC
      LIMIT 100
    `);

    res.json({ success: true, reports: reports.rows });
  } catch (err) {
    console.error("[GET REPORTS ERROR]", err);
    res.status(500).json({ error: "Failed to fetch reports" });
  }
});

// 🟢 13. DISMISS REPORT
router.post("/reports/:id/dismiss", authenticateToken, isAdmin, async (req, res) => {
  try {
    const reportId = req.params.id;
    await pool.query("UPDATE video_reports SET status = 'dismissed' WHERE id = $1", [reportId]);
    res.json({ success: true, message: "Report dismissed." });
  } catch (err) {
    res.status(500).json({ error: "Failed to dismiss report" });
  }
});

// 🟢 14. ACTION REPORT: DELETE VIDEO
router.post("/reports/:id/delete-video", authenticateToken, isAdmin, async (req, res) => {
  try {
    const reportId = req.params.id;
    const rRes = await pool.query("SELECT message_id FROM video_reports WHERE id = $1", [reportId]);
    if (rRes.rows.length === 0) return res.status(404).json({ error: "Report not found" });

    const message_id = rRes.rows[0].message_id;

    // Delete interactions and video
    await pool.query("DELETE FROM likes WHERE message_id = $1", [message_id]);
    await pool.query("DELETE FROM saves WHERE message_id = $1", [message_id]);
    await pool.query("DELETE FROM comments WHERE message_id = $1", [message_id]);
    await pool.query("DELETE FROM videos WHERE message_id = $1", [message_id]);
    await pool.query("UPDATE video_reports SET status = 'actioned_deleted' WHERE message_id = $1", [message_id]);

    res.json({ success: true, message: "Video deleted and reports resolved." });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete reported video" });
  }
});

// 🟢 15. ACTION REPORT: BAN CREATOR & DELETE VIDEO
router.post("/reports/:id/ban-creator", authenticateToken, isAdmin, async (req, res) => {
  try {
    const reportId = req.params.id;
    const rRes = await pool.query(`
      SELECT r.message_id, v.uploader_id 
      FROM video_reports r
      LEFT JOIN videos v ON r.message_id = v.message_id
      WHERE r.id = $1
    `, [reportId]);

    if (rRes.rows.length === 0) return res.status(404).json({ error: "Report not found" });

    const { message_id, uploader_id } = rRes.rows[0];

    if (uploader_id) {
      await pool.query(
        "UPDATE app_users SET is_banned = TRUE, ban_reason = 'Suspended for abusive content' WHERE id = $1 OR telegram_user_id = $1",
        [uploader_id]
      );
    }

    if (message_id) {
      await pool.query("DELETE FROM likes WHERE message_id = $1", [message_id]);
      await pool.query("DELETE FROM saves WHERE message_id = $1", [message_id]);
      await pool.query("DELETE FROM comments WHERE message_id = $1", [message_id]);
      await pool.query("DELETE FROM videos WHERE message_id = $1", [message_id]);
      await pool.query("UPDATE video_reports SET status = 'actioned_banned' WHERE message_id = $1", [message_id]);
    }

    res.json({ success: true, message: "Creator banned and reported video deleted." });
  } catch (err) {
    res.status(500).json({ error: "Failed to ban creator" });
  }
});

// 🟢 16. STORY VIEWS & STATUS INTELLIGENCE (Executive Story Analytics)
router.get("/story-analytics", authenticateToken, isAdmin, async (req, res) => {
  try {
    const [summaryRes, creatorsRes, recentViewsRes] = await Promise.all([
      // 1. High-level aggregates
      pool.query(`
        SELECT 
          COUNT(*) as total_views,
          COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '24 hours') as views_24h,
          COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '7 days') as views_7d,
          COUNT(*) FILTER (WHERE viewed_at >= NOW() - INTERVAL '30 days') as views_30d,
          COUNT(DISTINCT user_id) as unique_viewers_total,
          COUNT(DISTINCT user_id) FILTER (WHERE viewed_at >= NOW() - INTERVAL '24 hours') as unique_viewers_24h
        FROM creator_story_views
      `),
      // 2. Creator story breakdown (Day, Week, Month, All-time)
      pool.query(`
        SELECT 
          cs.creator_id,
          cs.username as creator_username,
          COALESCE(u.display_name, cs.username) as display_name,
          u.avatar_url,
          COALESCE(u.creator_category, 'Creator') as creator_category,
          COALESCE(u.is_verified, false) as is_verified,
          COALESCE(u.is_managed, false) as is_managed,
          COUNT(DISTINCT cs.id)::int as total_stories_posted,
          COUNT(DISTINCT cs.id) FILTER (WHERE cs.expires_at > NOW() AND cs.is_active = true)::int as active_stories,
          COUNT(csv.id)::int as total_views,
          COUNT(csv.id) FILTER (WHERE csv.viewed_at >= NOW() - INTERVAL '24 hours')::int as views_24h,
          COUNT(csv.id) FILTER (WHERE csv.viewed_at >= NOW() - INTERVAL '7 days')::int as views_7d,
          COUNT(csv.id) FILTER (WHERE csv.viewed_at >= NOW() - INTERVAL '30 days')::int as views_30d,
          COUNT(DISTINCT csv.user_id)::int as unique_viewers,
          MAX(cs.created_at) as last_story_at
        FROM creator_stories cs
        LEFT JOIN app_users u ON cs.creator_id = u.id OR (u.telegram_user_id IS NOT NULL AND cs.creator_id = u.telegram_user_id) OR LOWER(u.username) = LOWER(cs.username)
        LEFT JOIN creator_story_views csv ON csv.story_id = cs.id
        GROUP BY cs.creator_id, cs.username, u.display_name, u.avatar_url, u.creator_category, u.is_verified, u.is_managed
        ORDER BY total_views DESC
      `),
      // 3. Recent 30 live view events stream
      pool.query(`
        SELECT 
          csv.id as view_id,
          csv.story_id,
          csv.viewed_at,
          u.id as user_id,
          u.username as viewer_username,
          u.display_name as viewer_display_name,
          u.email as viewer_email,
          u.avatar_url as viewer_avatar_url,
          u.is_premium as viewer_is_premium,
          cs.creator_id,
          COALESCE(cs.username, cu.username) as creator_username,
          COALESCE(cu.display_name, cs.username) as creator_display_name,
          cs.sound_title,
          cs.video_url,
          cs.thumbnail_url,
          cs.duration,
          CASE WHEN cs.expires_at > NOW() AND cs.is_active = true THEN true ELSE false END as is_currently_active
        FROM creator_story_views csv
        LEFT JOIN app_users u ON csv.user_id = u.id
        JOIN creator_stories cs ON csv.story_id = cs.id
        LEFT JOIN app_users cu ON cs.creator_id = cu.id OR (cu.telegram_user_id IS NOT NULL AND cs.creator_id = cu.telegram_user_id)
        ORDER BY csv.viewed_at DESC
        LIMIT 30
      `)
    ]);

    const storiesCountRes = await pool.query(`
      SELECT 
        COUNT(*)::int as total_stories,
        COUNT(*) FILTER (WHERE expires_at > NOW() AND is_active = true)::int as active_stories,
        COUNT(DISTINCT creator_id) FILTER (WHERE expires_at > NOW() AND is_active = true)::int as active_creators
      FROM creator_stories
    `);

    const summary = summaryRes.rows[0];
    const storiesCount = storiesCountRes.rows[0];

    res.json({
      summary: {
        total_views: parseInt(summary.total_views || 0),
        views_24h: parseInt(summary.views_24h || 0),
        views_7d: parseInt(summary.views_7d || 0),
        views_30d: parseInt(summary.views_30d || 0),
        unique_viewers_total: parseInt(summary.unique_viewers_total || 0),
        unique_viewers_24h: parseInt(summary.unique_viewers_24h || 0),
        total_stories_count: parseInt(storiesCount.total_stories || 0),
        active_stories_count: parseInt(storiesCount.active_stories || 0),
        active_creators_count: parseInt(storiesCount.active_creators || 0),
        avg_views_per_story: storiesCount.total_stories > 0 
          ? (parseInt(summary.total_views || 0) / parseInt(storiesCount.total_stories)).toFixed(1)
          : 0
      },
      creators: creatorsRes.rows,
      recent_views: recentViewsRes.rows
    });
  } catch (err) {
    console.error("[ADMIN STORY ANALYTICS ERROR]", err);
    res.status(500).json({ error: "Failed to fetch story analytics" });
  }
});

// 🟢 17. GET DETAILED STORIES (With Status, Remaining Time, View Counts & Pagination)
router.get("/stories", authenticateToken, isAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 25));
    const offset = (page - 1) * limit;
    const status = req.query.status; // 'active' | 'expired' | 'all'
    const creator = req.query.creator ? req.query.creator.trim() : null;
    const search = req.query.search ? req.query.search.trim() : null;

    let whereClauses = [];
    let params = [];
    let idx = 1;

    if (status === 'active') {
      whereClauses.push(`cs.expires_at > NOW() AND cs.is_active = true`);
    } else if (status === 'expired') {
      whereClauses.push(`(cs.expires_at <= NOW() OR cs.is_active = false)`);
    }

    if (creator) {
      whereClauses.push(`(LOWER(cs.username) = LOWER($${idx}) OR LOWER(u.username) = LOWER($${idx}))`);
      params.push(creator);
      idx++;
    }

    if (search) {
      whereClauses.push(`(cs.username ILIKE $${idx} OR cs.sound_title ILIKE $${idx} OR u.display_name ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countRes = await pool.query(`
      SELECT COUNT(*) 
      FROM creator_stories cs
      LEFT JOIN app_users u ON cs.creator_id = u.id OR (u.telegram_user_id IS NOT NULL AND cs.creator_id = u.telegram_user_id) OR LOWER(u.username) = LOWER(cs.username)
      ${whereSql}
    `, params);
    const total = parseInt(countRes.rows[0].count);

    const storiesRes = await pool.query(`
      SELECT 
        cs.id,
        cs.creator_id,
        COALESCE(cs.username, u.username) as username,
        COALESCE(u.display_name, cs.username) as display_name,
        u.avatar_url,
        COALESCE(u.is_verified, false) as is_verified,
        cs.video_url,
        cs.thumbnail_url,
        cs.duration,
        cs.sound_title,
        cs.created_at,
        cs.expires_at,
        cs.is_active,
        CASE WHEN cs.expires_at > NOW() AND cs.is_active = true THEN true ELSE false END as is_currently_active,
        GREATEST(0, EXTRACT(EPOCH FROM (cs.expires_at - NOW())))::int as seconds_remaining,
        (SELECT COUNT(*)::int FROM creator_story_views csv WHERE csv.story_id = cs.id) as view_count,
        (SELECT COUNT(*)::int FROM creator_story_views csv WHERE csv.story_id = cs.id AND csv.viewed_at >= NOW() - INTERVAL '24 hours') as views_24h,
        (SELECT COUNT(DISTINCT user_id)::int FROM creator_story_views csv WHERE csv.story_id = cs.id) as unique_viewers
      FROM creator_stories cs
      LEFT JOIN app_users u ON cs.creator_id = u.id OR (u.telegram_user_id IS NOT NULL AND cs.creator_id = u.telegram_user_id) OR LOWER(u.username) = LOWER(cs.username)
      ${whereSql}
      ORDER BY cs.created_at DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `, [...params, limit, offset]);

    res.json({
      stories: storiesRes.rows,
      total,
      page,
      limit,
      total_pages: Math.ceil(total / limit)
    });
  } catch (err) {
    console.error("[ADMIN STORIES LIST ERROR]", err);
    res.status(500).json({ error: "Failed to fetch stories" });
  }
});

// 🟢 18. GET STORY VIEWERS (List of Users Who Watched a Specific Story)
router.get("/stories/:id/viewers", authenticateToken, isAdmin, async (req, res) => {
  try {
    const storyId = req.params.id;

    // Fetch story info
    const storyQuery = await pool.query(`
      SELECT 
        cs.id,
        cs.creator_id,
        COALESCE(cs.username, u.username) as username,
        COALESCE(u.display_name, cs.username) as display_name,
        u.avatar_url,
        u.is_verified,
        cs.video_url,
        cs.thumbnail_url,
        cs.duration,
        cs.sound_title,
        cs.created_at,
        cs.expires_at,
        CASE WHEN cs.expires_at > NOW() AND cs.is_active = true THEN true ELSE false END as is_currently_active,
        (SELECT COUNT(*)::int FROM creator_story_views csv WHERE csv.story_id = cs.id) as total_views,
        (SELECT COUNT(DISTINCT user_id)::int FROM creator_story_views csv WHERE csv.story_id = cs.id) as unique_viewers
      FROM creator_stories cs
      LEFT JOIN app_users u ON cs.creator_id = u.id OR (u.telegram_user_id IS NOT NULL AND cs.creator_id = u.telegram_user_id) OR LOWER(u.username) = LOWER(cs.username)
      WHERE cs.id = $1
    `, [storyId]);

    if (storyQuery.rows.length === 0) {
      return res.status(404).json({ error: "Story not found" });
    }

    const viewersQuery = await pool.query(`
      SELECT 
        csv.id as view_id,
        csv.story_id,
        csv.viewed_at,
        u.id as user_id,
        u.username,
        u.display_name,
        u.email,
        u.avatar_url,
        u.role,
        u.is_premium
      FROM creator_story_views csv
      LEFT JOIN app_users u ON csv.user_id = u.id
      WHERE csv.story_id = $1
      ORDER BY csv.viewed_at DESC
    `, [storyId]);

    res.json({
      story: storyQuery.rows[0],
      viewers: viewersQuery.rows
    });
  } catch (err) {
    console.error("[ADMIN STORY VIEWERS ERROR]", err);
    res.status(500).json({ error: "Failed to fetch story viewers" });
  }
});

// 🟢 19. GET CREATOR STORY VIEWERS (All Users Who Watched Any Story by a Creator)
router.get("/creators/:username/story-viewers", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { username } = req.params;

    const viewersQuery = await pool.query(`
      SELECT 
        csv.id as view_id,
        csv.story_id,
        csv.viewed_at,
        cs.sound_title,
        cs.created_at as story_created_at,
        cs.duration,
        u.id as user_id,
        u.username,
        u.display_name,
        u.email,
        u.avatar_url,
        u.role,
        u.is_premium
      FROM creator_story_views csv
      JOIN creator_stories cs ON csv.story_id = cs.id
      LEFT JOIN app_users u ON csv.user_id = u.id
      WHERE LOWER(cs.username) = LOWER($1)
      ORDER BY csv.viewed_at DESC
      LIMIT 100
    `, [username]);

    res.json({
      creator: username,
      viewers: viewersQuery.rows
    });
  } catch (err) {
    console.error("[ADMIN CREATOR STORY VIEWERS ERROR]", err);
    res.status(500).json({ error: "Failed to fetch creator story viewers" });
  }
});

export default router;