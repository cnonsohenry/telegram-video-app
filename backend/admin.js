/* =====================
   Backend: Admin Command Center
   File: backend/admin.js
===================== */
import express from "express";
import { authenticateToken } from "./auth.js"; 
import pool from "./db.js";

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
      "SELECT message_id FROM videos WHERE message_id = $1 OR id::text = $1",
      [identifier]
    );

    if (videoQuery.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Video not found" });
    }

    const targetMessageId = videoQuery.rows[0].message_id;

    // Delete interactions tied to this video to prevent foreign key constraint errors
    await client.query("DELETE FROM likes WHERE message_id = $1", [targetMessageId]);
    await client.query("DELETE FROM saves WHERE message_id = $1", [targetMessageId]);
    await client.query("DELETE FROM comments WHERE message_id = $1", [targetMessageId]);

    // Now delete the actual video
    await client.query("DELETE FROM videos WHERE message_id = $1", [targetMessageId]);

    await client.query('COMMIT');
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

// 🟢 GLOBAL DATABASE SEARCH
router.get("/search", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.json({ users: [], videos: [], transactions: [] });

    const searchParam = `%${q}%`;

    // Query all three core tables simultaneously
    const [usersRes, videosRes, txRes] = await Promise.all([
      pool.query(`SELECT * FROM app_users WHERE username ILIKE $1 OR email ILIKE $1 LIMIT 20`, [searchParam]),
      
      pool.query(`SELECT * FROM videos WHERE caption ILIKE $1 OR category ILIKE $1 LIMIT 20`, [searchParam]),
      
      // 🟢 THE FIX: Query actual DB columns (status/sender_name) but return the aliases (amount/payment_method) the frontend expects
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
      transactions: txRes.rows
    });
  } catch (err) {
    console.error("Global search failed:", err);
    res.status(500).json({ error: "Search failed" });
  }
});

export default router;