/* =====================
   Backend: Admin Command Center
   File: backend/admin.js
===================== */
import express from "express";
import { authenticateToken } from "./auth.js"; 
import pool from "./db.js";
import { deleteMediaFromR2 } from "./r2.js";

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

// 🟢 2. DASHBOARD STATS (The Overview)
router.get("/stats", authenticateToken, isAdmin, async (req, res) => {
  try {
    const totalUsers = await pool.query("SELECT COUNT(*) FROM app_users");
    const premiumUsers = await pool.query("SELECT COUNT(*) FROM app_users WHERE is_premium = true");
    
    // 🟢 FIX 1: Use 'expected_amount' which matches your server.js schema
    const totalRevenue = await pool.query("SELECT SUM(expected_amount) FROM transactions WHERE status = 'APPROVED'");
    
    // 🟢 FIX 2: Includes 'PENDING' since that is the default status in your schema
    const pendingCrypto = await pool.query("SELECT COUNT(*) FROM transactions WHERE status = 'WAITING' OR status = 'PENDING'");

    res.json({
      total_users: parseInt(totalUsers.rows[0].count),
      premium_users: parseInt(premiumUsers.rows[0].count),
      // Send it back as total_revenue_usd so the React dashboard accepts it perfectly
      total_revenue_usd: parseFloat(totalRevenue.rows[0].sum || 0).toFixed(2),
      pending_crypto_orders: parseInt(pendingCrypto.rows[0].count)
    });
  } catch (err) {
    console.error("[ADMIN STATS ERROR]", err);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// 🟢 3. GET ALL USERS
router.get("/users", authenticateToken, isAdmin, async (req, res) => {
  try {
    const users = await pool.query(`
      SELECT id, username, email, role, is_premium, created_at 
      FROM app_users 
      ORDER BY created_at DESC 
      LIMIT 100
    `);
    res.json(users.rows);
  } catch (err) {
    console.error("[ADMIN USERS ERROR]", err);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// 🟢 4. GET RECENT TRANSACTIONS
router.get("/transactions", authenticateToken, isAdmin, async (req, res) => {
  try {
    // 🟢 FIX 3: Use 'app_user_id' for the JOIN (matches server.js)
    // 🟢 FIX 4: Alias expected_amount -> amount, and provide a fallback for payment_method so React doesn't crash!
    const tx = await pool.query(`
      SELECT 
        t.*, 
        t.expected_amount AS amount, 
        COALESCE(t.status, 'PENDING') AS payment_method, 
        u.username, 
        u.email 
      FROM transactions t
      LEFT JOIN app_users u ON t.app_user_id = u.id
      ORDER BY t.created_at DESC 
      LIMIT 50
    `);
    res.json(tx.rows);
  } catch (err) {
    console.error("[ADMIN TX ERROR]", err);
    res.status(500).json({ error: "Failed to fetch transactions" });
  }
});

// 🟢 5. GET ALL VIDEOS (For Content Library)
router.get("/all-videos", authenticateToken, isAdmin, async (req, res) => {
  try {
    const videos = await pool.query(`
      SELECT id, chat_id, message_id, caption, category, views, cloudflare_id 
      FROM videos 
      ORDER BY created_at DESC 
      LIMIT 200
    `);
    
    // Auto-generate thumbnails for the grid
    const formatted = videos.rows.map(v => {
      let thumbUrl = "";
      
      // 🟢 THE FIX: Only route Cloudflare Stream files to videodelivery.net
      if (v.cloudflare_id && v.cloudflare_id !== "none" && !v.cloudflare_id.startsWith("r2:")) {
        thumbUrl = `https://videodelivery.net/${v.cloudflare_id.split('?')[0]}/thumbnails/thumbnail.jpg?time=1s&height=600`;
      } else {
        // R2 files and Telegram files will use your upgraded local Thumbnail API!
        const baseUrl = process.env.API_BASE_URL || 'https://videos.naijahomemade.com';
        thumbUrl = `${baseUrl}/api/thumbnail?chat_id=${v.chat_id}&message_id=${v.message_id}`;
      }

      return {
        ...v,
        thumbnail_url: thumbUrl
      };
    });
    
    res.json(formatted);
  } catch (err) {
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

    if (updates.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    values.push(userId);
    const query = `UPDATE app_users SET ${updates.join(", ")} WHERE id = $${idx} RETURNING id, username, email, role, is_premium`;
    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    // Keep creator_subscriptions in sync with @naijahomemade
    if (is_premium !== undefined) {
      try {
        const mainCreator = await pool.query(
          "SELECT id FROM app_users WHERE telegram_user_id = 1881815190 OR LOWER(username) = 'naijahomemade' LIMIT 1"
        );
        if (mainCreator.rows.length > 0) {
          if (is_premium === true) {
            await pool.query(
              `INSERT INTO creator_subscriptions (subscriber_id, creator_id, amount_paid, status, expires_at)
               VALUES ($1, $2, 15000, 'active', NOW() + INTERVAL '10 years')
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

      // Check if already in app_users
      const existing = await db.query(
        `SELECT id, username, telegram_user_id, is_managed 
         FROM app_users 
         WHERE telegram_user_id = $1 
            OR (username IS NOT NULL AND LOWER(username) = LOWER($2))`,
        [uploaderIdNum, info.username || '']
      );

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
           ) VALUES ($1, $2, $3, TRUE, TRUE, $4, $5, 15000, TRUE, 
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
      `SELECT id, username, telegram_user_id, subscription_price 
       FROM app_users 
       WHERE telegram_user_id = 1881815190 
          OR LOWER(username) = 'naijahomemade'
       ORDER BY id ASC
       LIMIT 1`
    );

    let creatorAppUserId;
    if (targetCreatorRes.rows.length === 0) {
      const insRes = await db.query(
        `INSERT INTO app_users (
           username, display_name, email, is_creator, is_managed, 
           telegram_user_id, creator_category, subscription_price, is_verified, 
           banner_url, creator_bio, avatar_url
         ) VALUES (
           'naijahomemade', 'Naija Homemade Series', 'tg_1881815190@internal.naijahomemade.com',
           TRUE, TRUE, 1881815190, 'Official VIP', 15000, TRUE,
           'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80',
           'Official Naija Homemade VIP channel. All exclusive premium drops and uncut releases.',
           'https://videos.naijahomemade.com/assets/default-avatar.png'
         )
         ON CONFLICT (telegram_user_id) DO UPDATE 
         SET is_creator = TRUE, is_managed = TRUE
         RETURNING id`
      );
      creatorAppUserId = insRes.rows[0].id;
    } else {
      creatorAppUserId = targetCreatorRes.rows[0].id;
      await db.query(
        `UPDATE app_users 
         SET is_creator = TRUE, 
             is_managed = TRUE, 
             telegram_user_id = 1881815190,
             display_name = COALESCE(display_name, 'Naija Homemade Series'),
             creator_category = COALESCE(creator_category, 'Official VIP'),
             subscription_price = CASE WHEN subscription_price IS NULL OR subscription_price = 0 THEN 15000 ELSE subscription_price END,
             is_verified = TRUE
         WHERE id = $1`,
        [creatorAppUserId]
      );
    }

    // 2. Move all premium videos to @naijahomemade (Telegram ID 1881815190)
    const vidsUpdateRes = await db.query(
      `UPDATE videos 
       SET uploader_id = '1881815190' 
       WHERE category = 'premium' AND (uploader_id IS NULL OR uploader_id != '1881815190')`
    );
    const videosMoved = vidsUpdateRes.rowCount || 0;
    console.log(`[MIGRATE VIP] Reassigned ${videosMoved} premium videos to @naijahomemade (1881815190).`);

    // 3. Move all existing VIP/Premium users into creator_subscriptions for @naijahomemade
    const subsRes = await db.query(
      `INSERT INTO creator_subscriptions (subscriber_id, creator_id, amount_paid, status, expires_at)
       SELECT DISTINCT u.id, $1::BIGINT, 15000, 'active', NOW() + INTERVAL '10 years'
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
        u.avatar_url, 
        u.banner_url, 
        u.creator_bio, 
        COALESCE(u.creator_category, 'Creator') as creator_category, 
        COALESCE(u.subscription_price, 0) as subscription_price, 
        COALESCE(u.is_verified, false) as is_verified, 
        COALESCE(u.is_creator, false) as is_creator, 
        COALESCE(u.is_managed, false) as is_managed,
        u.telegram_user_id,
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

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields provided to update" });
    }

    values.push(creatorId);
    const query = `
      UPDATE app_users 
      SET ${updates.join(", ")} 
      WHERE id = $${idx} 
      RETURNING id, username, email, display_name, avatar_url, banner_url, 
                creator_bio, creator_category, subscription_price, is_verified, is_creator, is_managed, telegram_user_id
    `;

    const result = await pool.query(query, values);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Creator not found" });
    }

    res.json({ success: true, creator: result.rows[0] });
  } catch (err) {
    console.error("[ADMIN UPDATE CREATOR ERROR]", err);
    res.status(500).json({ error: "Failed to update creator" });
  }
});

// 🟢 GLOBAL DATABASE SEARCH
router.get("/search", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ users: [], videos: [], transactions: [], creators: [] });

    const searchParam = `%${q}%`;

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
          AND (username ILIKE $1 OR display_name ILIKE $1 OR creator_category ILIKE $1)
        LIMIT 20
      `, [searchParam])
    ]);

    // Format videos to include thumbnails so the search results show images
    const formattedVideos = videosRes.rows.map(v => {
      let thumbUrl = "";
      if (v.cloudflare_id && v.cloudflare_id !== "none" && !v.cloudflare_id.startsWith("r2:")) {
        thumbUrl = `https://videodelivery.net/${v.cloudflare_id.split('?')[0]}/thumbnails/thumbnail.jpg?time=1s&height=600`;
      } else {
        const baseUrl = process.env.API_BASE_URL || 'https://videos.naijahomemade.com';
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

export default router;