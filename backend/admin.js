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
        u.created_at,
        (
          SELECT COUNT(*) 
          FROM creator_subscriptions cs 
          WHERE cs.creator_id = u.id 
            AND cs.status = 'active' 
            AND (cs.expires_at IS NULL OR cs.expires_at > NOW())
        ) as subscribers_count,
        (
          SELECT COALESCE(SUM(expected_amount), 0)
          FROM transactions t
          WHERE t.creator_id = u.id 
            AND t.transaction_type = 'creator_sub' 
            AND t.status = 'APPROVED'
        ) as subscription_revenue_usd,
        (
          SELECT COUNT(*) 
          FROM creator_tips ct 
          WHERE ct.creator_id = u.id
        ) as tips_count,
        (
          SELECT COALESCE(SUM(amount), 0) 
          FROM creator_tips ct 
          WHERE ct.creator_id = u.id
        ) as tips_total,
        (
          SELECT COUNT(*) 
          FROM videos v 
          LEFT JOIN users tg ON v.uploader_id = tg.user_id
          WHERE v.uploader_id = u.id 
             OR LOWER(COALESCE(tg.username, '')) = LOWER(u.username)
        ) as posts_count,
        (
          SELECT COALESCE(SUM(views), 0) 
          FROM videos v 
          LEFT JOIN users tg ON v.uploader_id = tg.user_id
          WHERE v.uploader_id = u.id 
             OR LOWER(COALESCE(tg.username, '')) = LOWER(u.username)
        ) as total_views
      FROM app_users u
      WHERE u.is_creator = true OR u.subscription_price > 0
      ORDER BY u.created_at DESC
    `);

    // Overview aggregate metrics
    const statsRes = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM app_users WHERE is_creator = true) as total_creators,
        (SELECT COUNT(*) FROM app_users WHERE is_creator = true AND is_verified = true) as verified_creators,
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

// 🟢 11. UPDATE CREATOR (Verification Badge, Category, Price, Creator Status)
router.put("/creator/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const creatorId = req.params.id;
    const { 
      is_verified, 
      is_creator, 
      subscription_price, 
      creator_category, 
      display_name, 
      creator_bio 
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

    if (updates.length === 0) {
      return res.status(400).json({ error: "No fields provided to update" });
    }

    values.push(creatorId);
    const query = `
      UPDATE app_users 
      SET ${updates.join(", ")} 
      WHERE id = $${idx} 
      RETURNING id, username, email, display_name, avatar_url, banner_url, 
                creator_bio, creator_category, subscription_price, is_verified, is_creator
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
        SELECT id, username, email, display_name, avatar_url, creator_category, subscription_price, is_verified, is_creator
        FROM app_users
        WHERE (is_creator = true OR subscription_price > 0)
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