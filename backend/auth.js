/* =====================
   Backend: Authentication Logic
   File: backend/auth.js
===================== */
import 'dotenv/config'; // 🟢 CRITICAL: Loads .env variables immediately
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pkg from "pg";
const { Pool } = pkg;

const router = express.Router();

// 🟢 1. DATABASE & SECRET SETUP
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key_change_me";

// Debug Log: Runs when server starts to confirm the key is loaded
console.log(`[AUTH] System Start. Secret Status: ${process.env.JWT_SECRET ? "✅ Loaded from .env" : "⚠️ USING FALLBACK (CHECK .ENV)"}`);

// 🟢 2. REGISTER (Email/Password)
router.post("/register", async (req, res) => {
  const { email, password, username } = req.body;
  
  try {
    // Check if user exists
    const userCheck = await pool.query("SELECT * FROM app_users WHERE email = $1", [email]);
    if (userCheck.rows.length > 0) return res.status(400).json({ error: "Email already exists" });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Insert User with Working Avatar
    const newUser = await pool.query(
      "INSERT INTO app_users (email, password_hash, username, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id, email, username, avatar_url",
      [email, hash, username || email.split('@')[0], "https://naijahomemade.com/assets/default-avatar.png"]
    );

    // Generate Token
    const token = jwt.sign({ id: newUser.rows[0].id }, JWT_SECRET, { expiresIn: "30d" });

    res.json({ token, user: newUser.rows[0] });

  } catch (err) {
    console.error("[REGISTER ERROR]", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🟢 3. LOGIN (Email/Password)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await pool.query("SELECT * FROM app_users WHERE email = $1", [email]);
    if (user.rows.length === 0) return res.status(400).json({ error: "User not found" });

    const validPass = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!validPass) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ id: user.rows[0].id }, JWT_SECRET, { expiresIn: "30d" });

    // Don't send the password hash back!
    const { password_hash, ...userData } = user.rows[0];
    res.json({ token, user: userData });

  } catch (err) {
    console.error("[LOGIN ERROR]", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🟢 4. GET PROFILE (Protected Route - Improved Debugging)
router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;

  // Check 1: Is the header present and formatted correctly?
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    console.warn("[AUTH FAIL] No Bearer token provided");
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];

  try {
    // Check 2: Verify the token signature
    const decoded = jwt.verify(token, JWT_SECRET);
    
    const user = await pool.query(
      "SELECT id, email, username, avatar_url, settings FROM app_users WHERE id = $1", 
      [decoded.id]
    );

    if (user.rows.length === 0) {
      console.warn(`[AUTH FAIL] User ID ${decoded.id} not found in DB`);
      return res.status(401).json({ error: "User not found" });
    }

    res.json(user.rows[0]);

  } catch (err) {
    // Check 3: Log why the token was rejected
    console.error(`[AUTH FAIL] Invalid Token: ${err.message}`);
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

export default router;