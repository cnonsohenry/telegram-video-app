/* =====================
   Backend: Authentication Logic
   File: backend/auth.js
===================== */
import 'dotenv/config'; 
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pkg from "pg";
import { OAuth2Client } from "google-auth-library";

const { Pool } = pkg;
const router = express.Router();

// 🟢 1. SETUP
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key_change_me";

console.log(`[AUTH] System Start. Google Client ID: ${process.env.GOOGLE_CLIENT_ID ? "✅ Loaded" : "⚠️ MISSING"}`);

// 🟢 2. SECURITY MIDDLEWARE (Anti-Identity-Swap)
// This ensures that NO part of the authentication flow is EVER cached by a browser, CDN, or proxy.
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

/**
 * 🛡️ MIDDLEWARE: Protects routes by verifying the JWT
 */
export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id }; 
    next();
  } catch (err) {
    res.status(401).json({ error: "Session expired" });
  }
};

// 🟢 3. GOOGLE LOGIN (FedCM Ready)
router.post("/google", async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: "No Google token provided" });

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    const userQuery = await pool.query(
      `INSERT INTO app_users (email, username, avatar_url, google_id) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (email) DO UPDATE 
       SET avatar_url = EXCLUDED.avatar_url, 
           google_id = COALESCE(app_users.google_id, EXCLUDED.google_id)
       RETURNING id, email, username, avatar_url, role, settings`,
      [email, name || email.split('@')[0], picture, googleId]
    );

    const user = userQuery.rows[0];
    const appToken = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "30d" });

    res.json({ token: appToken, user });
  } catch (err) {
    console.error("[GOOGLE AUTH ERROR]", err.message);
    res.status(401).json({ error: "Google Authentication Failed" });
  }
});

// 🟢 4. REGISTER (Email/Password)
router.post("/register", async (req, res) => {
  const { email, password, username } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: "Password too short" });

  try {
    const userCheck = await pool.query("SELECT * FROM app_users WHERE email = $1", [email]);
    if (userCheck.rows.length > 0) return res.status(400).json({ error: "Email already exists" });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    const newUser = await pool.query(
      "INSERT INTO app_users (email, password_hash, username, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id, email, username, avatar_url, role, settings",
      [email, hash, username || email.split('@')[0], "https://videos.naijahomemade.com/assets/default-avatar.png"]
    );

    const token = jwt.sign({ id: newUser.rows[0].id }, JWT_SECRET, { expiresIn: "30d" });
    res.json({ token, user: newUser.rows[0] });
  } catch (err) {
    console.error("[REGISTER ERROR]", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// 🟢 5. LOGIN (Email/Password)
router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const userResult = await pool.query("SELECT * FROM app_users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) return res.status(400).json({ error: "User not found" });

    const user = userResult.rows[0];
    if (!user.password_hash) {
      return res.status(400).json({ error: "Account uses Google Login. Use Google Sign In." });
    }

    const validPass = await bcrypt.compare(password, user.password_hash);
    if (!validPass) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: "30d" });
    const { password_hash, ...userData } = user;
    res.json({ token, user: userData });
  } catch (err) {
    console.error("[LOGIN ERROR]", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// 🟢 6. GET PROFILE (Atomic Session Check)
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      "SELECT id, email, username, avatar_url, role, settings FROM app_users WHERE id = $1", 
      [req.user.id]
    );

    if (userResult.rows.length === 0) return res.status(404).json({ error: "User not found" });
    res.json(userResult.rows[0]);
  } catch (err) {
    res.status(401).json({ error: "Session expired" });
  }
});

// 🟢 7. UPDATE SETTINGS (Theme Sync)
router.patch("/settings", authenticateToken, async (req, res) => {
  const { settings } = req.body; 
  const userId = req.user.id;

  if (!settings) return res.status(400).json({ error: "No settings provided" });

  try {
    const query = `
      UPDATE app_users 
      SET settings = COALESCE(settings, '{}'::jsonb) || $1 
      WHERE id = $2 
      RETURNING settings;
    `;

    const result = await pool.query(query, [JSON.stringify(settings), userId]);
    res.json({ success: true, settings: result.rows[0].settings });
  } catch (err) {
    console.error("[SETTINGS ERROR]", err);
    res.status(500).json({ error: "Failed to sync settings" });
  }
});

export default router;