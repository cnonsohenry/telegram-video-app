/* =====================
   Backend: Authentication Logic
   File: backend/auth.js
===================== */
import 'dotenv/config'; 
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pkg from "pg";
import { OAuth2Client } from "google-auth-library"; // 🟢 Added Google Library

const { Pool } = pkg;
const router = express.Router();

// 🟢 1. SETUP
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key_change_me";

console.log(`[AUTH] System Start. Google Client ID: ${process.env.GOOGLE_CLIENT_ID ? "✅ Loaded" : "⚠️ MISSING"}`);

// 🟢 2. GOOGLE LOGIN (Verified & Secure)
router.post("/google", async (req, res) => {
  const { token } = req.body;

  try {
    // 1. Verify the Google Token
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    // 2. Upsert User: Create if doesn't exist, Update if they do
    // This handles both Registration and Login in one shot
    const userQuery = await pool.query(
      `INSERT INTO app_users (email, username, avatar_url, google_id) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (email) DO UPDATE 
       SET avatar_url = EXCLUDED.avatar_url, google_id = EXCLUDED.google_id
       RETURNING id, email, username, avatar_url`,
      [email, name || email.split('@')[0], picture, googleId]
    );

    const user = userQuery.rows[0];

    // 3. Issue your App's Session Token
    const appToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "30d" });

    res.json({ token: appToken, user });

  } catch (err) {
    console.error("[GOOGLE AUTH ERROR]", err);
    res.status(401).json({ error: "Invalid Google token" });
  }
});

// 🟢 3. REGISTER (Email/Password)
router.post("/register", async (req, res) => {
  const { email, password, username } = req.body;
  try {
    const userCheck = await pool.query("SELECT * FROM app_users WHERE email = $1", [email]);
    if (userCheck.rows.length > 0) return res.status(400).json({ error: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      "INSERT INTO app_users (email, password_hash, username, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id, email, username, avatar_url",
      [email, hash, username || email.split('@')[0], "https://naijahomemade.com/assets/default-avatar.png"]
    );

    const token = jwt.sign({ id: newUser.rows[0].id }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: newUser.rows[0] });
  } catch (err) {
    console.error("[REGISTER ERROR]", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🟢 4. LOGIN (Email/Password)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await pool.query("SELECT * FROM app_users WHERE email = $1", [email]);
    if (user.rows.length === 0) return res.status(400).json({ error: "User not found" });

    if (!user.rows[0].password_hash) {
      return res.status(400).json({ error: "This account uses Google Login. Please sign in with Google." });
    }

    const validPass = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!validPass) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ id: user.rows[0].id }, JWT_SECRET, { expiresIn: "30d" });
    const { password_hash, ...userData } = user.rows[0];
    res.json({ token, user: userData });
  } catch (err) {
    console.error("[LOGIN ERROR]", err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🟢 5. GET PROFILE
router.get("/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "No token provided" });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await pool.query(
      "SELECT id, email, username, avatar_url, settings FROM app_users WHERE id = $1", 
      [decoded.id]
    );

    if (user.rows.length === 0) return res.status(401).json({ error: "User not found" });
    res.json(user.rows[0]);
  } catch (err) {
    res.status(401).json({ error: "Invalid or expired token" });
  }
});

export default router;