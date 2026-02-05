/* =====================
   Backend: Authentication Logic
   File: backend/auth.js
===================== */
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import pkg from "pg";
const { Pool } = pkg;

const router = express.Router();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key_change_me";

// 🟢 1. REGISTER (Email/Password)
router.post("/register", async (req, res) => {
  const { email, password, username } = req.body;
  
  try {
    // Check if user exists
    const userCheck = await pool.query("SELECT * FROM app_users WHERE email = $1", [email]);
    if (userCheck.rows.length > 0) return res.status(400).json({ error: "Email already exists" });

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Insert User
    const newUser = await pool.query(
      "INSERT INTO app_users (email, password_hash, username, avatar_url) VALUES ($1, $2, $3, $4) RETURNING id, email, username",
      [email, hash, username || email.split('@')[0], "https://via.placeholder.com/150"]
    );

    // Generate Token
    const token = jwt.sign({ id: newUser.rows[0].id }, JWT_SECRET, { expiresIn: "30d" });

    res.json({ token, user: newUser.rows[0] });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 🟢 2. LOGIN (Email/Password)
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
    res.status(500).json({ error: "Server error" });
  }
});

// 🟢 3. GET PROFILE (Protected Route)
router.get("/me", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await pool.query("SELECT id, email, username, avatar_url, settings FROM app_users WHERE id = $1", [decoded.id]);
    res.json(user.rows[0]);
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;