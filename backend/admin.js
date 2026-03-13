/* =====================
   Backend: Admin Command Center
   File: backend/admin.js
===================== */
import express from "express";
import pkg from "pg";
import { authenticateToken } from "./auth.js"; 

const { Pool } = pkg;
const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// 🟢 1. THE BOUNCER: Admin-Only Middleware
const isAdmin = async (req, res, next) => {
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
    const formatted = videos.rows.map(v => ({
      ...v,
      thumbnail_url: v.cloudflare_id && v.cloudflare_id !== "none" 
        ? `https://videodelivery.net/${v.cloudflare_id.split('?')[0]}/thumbnails/thumbnail.jpg?time=1s&height=600`
        : `https://videos.naijahomemade.com/api/thumbnail?chat_id=${v.chat_id}&message_id=${v.message_id}`
    }));
    
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch videos" });
  }
});

// 🟢 6. UPDATE VIDEO (Edit Caption/Category)
router.put("/video/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { caption, category } = req.body;
    await pool.query(
      "UPDATE videos SET caption = $1, category = $2 WHERE id = $3",
      [caption, category, req.params.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Update failed" });
  }
});

// 🟢 7. DELETE VIDEO
router.delete("/video/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM videos WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

// 🟢 8. DELETE USER
router.delete("/user/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM app_users WHERE id = $1", [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Delete failed" });
  }
});

export default router;