/* =====================
   Backend: Authentication Logic
   File: backend/auth.js
===================== */
import 'dotenv/config'; 
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { z } from "zod"; // 🟢 IMPORT ZOD
import { rateLimit } from "express-rate-limit";
import { sendReactEmail, sendHtmlEmail } from "./utils/mailer.js";
import WelcomeEmail from "./emails/WelcomeEmail.jsx";
import React from "react";
import pool from "./db.js";

const router = express.Router();

// 🟢 1. SETUP
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "12027172293-lrgugueucjjnvlg8ac09eqg820hner64.apps.googleusercontent.com";
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);
export const JWT_SECRET = process.env.JWT_SECRET || "super_secret_key_change_me";

console.log(`[AUTH] System Start. Google Client ID: ${GOOGLE_CLIENT_ID ? "✅ Loaded" : "⚠️ MISSING"}`);

// 🛡️ SECURITY: Rate Limiters for Authentication & OTP Verification
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 failed/successful logins per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Please wait 15 minutes before trying again." }
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // max 5 account registrations per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many accounts registered from this IP. Please wait an hour." }
});

export const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // max 5 OTP requests per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many verification code requests. Please wait before requesting another." }
});

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // max 10 verify attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many verification attempts. Please wait 15 minutes." }
});

// 🟢 2. SECURITY MIDDLEWARE (Anti-Identity-Swap)
router.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ error: "Unauthorized" });

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = { id: decoded.id, role: decoded.role }; 
    next();
  } catch (err) {
    res.status(401).json({ error: "Session expired" });
  }
};

/* =====================
   VALIDATION SCHEMAS
===================== */
const googleSchema = z.object({
  token: z.string().min(1, { message: "Google token is required" }),
});

const registerSchema = z.object({
  email: z.string()
    .email({ message: "Invalid email format" })
    .max(255, { message: "Email is too long" }),
  password: z.string()
    .min(6, { message: "Password must be at least 6 characters" })
    .max(100, { message: "Password is too long" }),
  username: z.string()
    .min(3, { message: "Username must be at least 3 characters" })
    .max(30, { message: "Username must be under 30 characters" })
    .regex(/^[a-zA-Z0-9_-]+$/, { message: "Username can only contain letters, numbers, underscores, and hyphens." })
    .optional(),
  is_creator: z.boolean().optional(),
  display_name: z.string().max(100).optional(),
  creator_category: z.string().max(50).optional(),
  creator_bio: z.string().max(500).optional(),
  subscription_price: z.number().min(0).optional(),
});

const loginSchema = z.object({
  email: z.string()
    .email({ message: "Invalid email format" }),
  password: z.string()
    .min(1, { message: "Password is required" }), 
});

const settingsSchema = z.object({
  settings: z.object({
    theme: z.enum(["red", "orange", "dark", "light"]).optional(),
    private_profile: z.boolean().optional(),
    hide_follow_list: z.boolean().optional(),
    show_likes: z.boolean().optional(),
    allow_tips: z.boolean().optional(),
    autoplay_videos: z.boolean().optional(),
    data_saver: z.boolean().optional(),
    mute_start: z.boolean().optional(),
    notif_subs: z.boolean().optional(),
    notif_likes: z.boolean().optional(),
    notif_drops: z.boolean().optional(),
  })
});

// Helper to fetch active creator subscriptions
export const getUserSubscriptions = async (userId) => {
  if (!userId) return [];
  try {
    const subsResult = await pool.query(
      `SELECT cs.creator_id, cs.status, cs.expires_at,
              u.username as creator_username, u.display_name as creator_display_name,
              u.telegram_user_id
       FROM creator_subscriptions cs
       LEFT JOIN app_users u ON cs.creator_id = u.id OR (u.telegram_user_id IS NOT NULL AND cs.creator_id = u.telegram_user_id)
       WHERE cs.subscriber_id = $1 
         AND cs.status = 'active' 
         AND (cs.expires_at IS NULL OR cs.expires_at > NOW())`,
      [userId]
    );
    return subsResult.rows;
  } catch (err) {
    console.error("[GET USER SUBSCRIPTIONS ERROR]", err.message);
    return [];
  }
};

// Helper to fetch creator follows
export const getUserFollows = async (userId) => {
  if (!userId) return [];
  try {
    const followsResult = await pool.query(
      `SELECT cf.creator_id,
              u.username as creator_username, u.display_name as creator_display_name,
              u.avatar_url as creator_avatar, u.is_verified as creator_verified,
              u.telegram_user_id
       FROM creator_follows cf
       LEFT JOIN app_users u ON cf.creator_id = u.id OR (u.telegram_user_id IS NOT NULL AND cf.creator_id = u.telegram_user_id)
       WHERE cf.follower_id = $1`,
      [userId]
    );
    return followsResult.rows;
  } catch (err) {
    console.error("[GET USER FOLLOWS ERROR]", err.message);
    return [];
  }
};

// Helper to fetch followers count
export const getUserFollowersCount = async (userId, telegramUserId = null) => {
  if (!userId) return 0;
  try {
    const res = await pool.query(
      `SELECT COUNT(*) FROM creator_follows WHERE creator_id = $1 OR ($2::BIGINT IS NOT NULL AND creator_id = $2::BIGINT)`,
      [userId, telegramUserId || null]
    );
    return Number(res.rows[0]?.count || 0);
  } catch (err) {
    return 0;
  }
};

// 🟢 3. GOOGLE LOGIN
router.post("/google", async (req, res) => {
  const parsed = googleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error?.issues?.[0]?.message || "Invalid input" });
  }

  const { token } = parsed.data;

  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });
    
    const payload = ticket.getPayload();
    const { email, name, picture, sub: googleId } = payload;

    let baseUsername = (name || email.split('@')[0])
      .replace(/[^a-zA-Z0-9_-]/g, "")
      .slice(0, 30);
    if (!baseUsername || baseUsername.length < 3) baseUsername = `user_${Date.now().toString().slice(-6)}`;

    let finalUsername = baseUsername;
    const existingUser = await pool.query("SELECT id, username FROM app_users WHERE email = $1", [email]);
    if (existingUser.rows.length > 0) {
      finalUsername = existingUser.rows[0].username;
    } else {
      const usernameCheck = await pool.query("SELECT id FROM app_users WHERE LOWER(username) = LOWER($1)", [finalUsername]);
      if (usernameCheck.rows.length > 0) {
        finalUsername = `${baseUsername.slice(0, 24)}_${Math.floor(1000 + Math.random() * 9000)}`;
      }
    }

    const userQuery = await pool.query(
      `INSERT INTO app_users (email, username, display_name, avatar_url, google_id, email_verified) 
       VALUES ($1, $2, $3, $4, $5, TRUE) 
       ON CONFLICT (email) DO UPDATE 
       SET avatar_url = COALESCE(EXCLUDED.avatar_url, app_users.avatar_url), 
           google_id = COALESCE(app_users.google_id, EXCLUDED.google_id),
           email_verified = TRUE
       RETURNING id, email, username, avatar_url, role, settings, is_premium,
                 is_creator, display_name, creator_bio, banner_url, creator_category, 
                 subscription_price, social_links, is_verified, location, website,
                 email_verified, kyc_status, kyc_rejection_reason, kyc_verified_at, telegram_user_id`,
      [email, finalUsername, name || finalUsername, picture, googleId]
    );

    const user = userQuery.rows[0];
    const [userSubs, userFolls, followersCnt] = await Promise.all([
      getUserSubscriptions(user.id),
      getUserFollows(user.id),
      getUserFollowersCount(user.id, user.telegram_user_id)
    ]);
    user.subscriptions = userSubs;
    user.follows = userFolls;
    user.followers_count = followersCnt;
    user.following_count = userFolls.length;
    const appToken = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "30d" });

    res.json({ token: appToken, user });
  } catch (err) {
    console.error("[GOOGLE AUTH ERROR]", err.message);
    res.status(401).json({ error: "Google Authentication Failed" });
  }
});

// 🟢 4. REGISTER (Email/Password)
router.post("/register", registerLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error?.issues?.[0]?.message || "Invalid input" });
  }

  const { email, password, username, display_name, creator_category, creator_bio } = parsed.data;

  try {
    const userCheck = await pool.query("SELECT id FROM app_users WHERE email = $1", [email]);
    if (userCheck.rows.length > 0) return res.status(400).json({ error: "Email already exists" });

    const desiredUsername = username || email.split('@')[0];
    const usernameCheck = await pool.query("SELECT id FROM app_users WHERE LOWER(username) = LOWER($1)", [desiredUsername]);
    if (usernameCheck.rows.length > 0) return res.status(400).json({ error: "Username already taken" });

    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);

    // Note: Users start as normal social accounts; upgrading to monetized Creator requires Email + KYC verification
    const displayName = display_name?.trim() || desiredUsername;
    const category = creator_category?.trim() || "Member";
    const bio = creator_bio?.trim() || "";

    const newUser = await pool.query(
      `INSERT INTO app_users (
        email, password_hash, username, avatar_url, role,
        is_creator, display_name, creator_category, creator_bio, subscription_price, is_verified,
        email_verified, kyc_status
      ) VALUES ($1, $2, $3, $4, 'user', FALSE, $5, $6, $7, 0, FALSE, FALSE, 'none') 
      RETURNING id, email, username, avatar_url, role, settings, is_premium,
                is_creator, display_name, creator_bio, banner_url, creator_category, 
                subscription_price, social_links, is_verified, location, website,
                email_verified, kyc_status, kyc_rejection_reason, kyc_verified_at`,
      [
        email, hash, desiredUsername, 
        "https://naijahomemade.com/assets/default-avatar.png",
        displayName, category, bio
      ]
    );

    sendReactEmail(
      email,
      "Welcome to the Community! 🚀",
      React.createElement(WelcomeEmail, { username: desiredUsername })
    ).catch(e => console.error("[WELCOME EMAIL ERROR]", e.message));

    const token = jwt.sign({ id: newUser.rows[0].id, role: newUser.rows[0].role }, JWT_SECRET, { expiresIn: "30d" });
    const userData = newUser.rows[0];
    userData.subscriptions = [];
    userData.follows = [];
    userData.followers_count = 0;
    userData.following_count = 0;
    res.json({ token, user: userData });
  } catch (err) {
    console.error("[REGISTER ERROR]", err);
    res.status(500).json({ error: "Registration failed" });
  }
});

// 🟢 5. LOGIN (Email/Password)
router.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error?.issues?.[0]?.message || "Invalid input" });
  }

  const { email, password } = parsed.data;

  try {
    const userResult = await pool.query("SELECT * FROM app_users WHERE email = $1", [email]);
    if (userResult.rows.length === 0) return res.status(400).json({ error: "User not found" });

    const user = userResult.rows[0];
    if (!user.password_hash) {
      return res.status(400).json({ error: "Account uses Google Login. Use Google Sign In." });
    }

    const validPass = await bcrypt.compare(password, user.password_hash);
    if (!validPass) return res.status(400).json({ error: "Invalid password" });

    const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "30d" });
    const { password_hash, ...userData } = user;
    const [userSubs, userFolls, followersCnt] = await Promise.all([
      getUserSubscriptions(user.id),
      getUserFollows(user.id),
      getUserFollowersCount(user.id, user.telegram_user_id)
    ]);
    userData.subscriptions = userSubs;
    userData.follows = userFolls;
    userData.followers_count = followersCnt;
    userData.following_count = userFolls.length;
    res.json({ token, user: userData });
  } catch (err) {
    console.error("[LOGIN ERROR]", err);
    res.status(500).json({ error: "Login failed" });
  }
});

// 🟢 6. GET PROFILE
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const userResult = await pool.query(
      `SELECT id, email, username, avatar_url, role, settings, is_premium,
              is_creator, display_name, creator_bio, banner_url, creator_category, 
              subscription_price, social_links, is_verified, location, website,
              COALESCE(email_verified, FALSE) as email_verified,
              COALESCE(kyc_status, 'none') as kyc_status,
              kyc_rejection_reason, kyc_verified_at, telegram_user_id
       FROM app_users WHERE id = $1`,
      [req.user.id]
    );

    if (userResult.rows.length === 0) return res.status(404).json({ error: "User not found" });
    const user = userResult.rows[0];
    const [userSubs, userFolls, followersCnt] = await Promise.all([
      getUserSubscriptions(req.user.id),
      getUserFollows(req.user.id),
      getUserFollowersCount(req.user.id, user.telegram_user_id)
    ]);
    user.subscriptions = userSubs;
    user.follows = userFolls;
    user.followers_count = followersCnt;
    user.following_count = userFolls.length;
    res.json(user);
  } catch (err) {
    res.status(401).json({ error: "Session expired" });
  }
});

// 🟢 6B. SEND EMAIL VERIFICATION OTP CODE (Rate-Limited & Secure)
router.post("/send-email-verification", authenticateToken, otpSendLimiter, async (req, res) => {
  const userId = req.user.id;
  const customEmail = req.body?.email ? String(req.body.email).trim().toLowerCase() : null;

  try {
    const userRes = await pool.query("SELECT id, email, username, display_name, email_verified FROM app_users WHERE id = $1", [userId]);
    if (userRes.rows.length === 0) return res.status(404).json({ error: "User not found" });

    const user = userRes.rows[0];
    let targetEmail = customEmail || user.email;

    if (!targetEmail || targetEmail.endsWith("@internal.naijahomemade.com")) {
      return res.status(400).json({ error: "Please provide a valid email address to verify." });
    }

    // 🛑 SECURITY FIX: Verify target email is not already taken by another account,
    // but DO NOT update app_users.email yet! Email is only updated AFTER successful OTP verification.
    if (customEmail && customEmail !== user.email) {
      const checkDup = await pool.query("SELECT id FROM app_users WHERE LOWER(email) = LOWER($1) AND id != $2", [customEmail, userId]);
      if (checkDup.rows.length > 0) {
        return res.status(400).json({ error: "This email address is already linked to another account." });
      }
    } else if (user.email_verified) {
      return res.json({ success: true, already_verified: true, message: "Your email is already verified!" });
    }

    // Rate limit: check if a code was sent in the last 45 seconds
    const recentRes = await pool.query(
      `SELECT created_at FROM email_verification_codes 
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '45 seconds' 
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );
    if (recentRes.rows.length > 0) {
      return res.status(429).json({ error: "Please wait 45 seconds before requesting another verification code." });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000)); // 6-digit OTP

    await pool.query(
      `INSERT INTO email_verification_codes (user_id, email, code, expires_at, attempts)
       VALUES ($1, $2, $3, NOW() + INTERVAL '15 minutes', 0)`,
      [userId, targetEmail, code]
    );

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; background: #09090b; color: #f4f4f5; padding: 32px 24px; border-radius: 16px; border: 1px solid #27272a;">
        <h2 style="margin: 0 0 12px 0; color: #ffffff; font-size: 20px;">Verify Your Email Address</h2>
        <p style="color: #a1a1aa; font-size: 14px; line-height: 1.5; margin: 0 0 24px 0;">
          Hi <strong>${user.display_name || user.username}</strong>, use the 6-digit verification code below to verify your email and unlock Creator capabilities on NaijaHomemade:
        </p>
        <div style="background: #18181b; border: 1px solid #27272a; border-radius: 12px; padding: 18px; text-align: center; letter-spacing: 8px; font-size: 28px; font-weight: 800; color: #f43f5e; margin-bottom: 24px;">
          ${code}
        </div>
        <p style="color: #71717a; font-size: 12px; margin: 0;">
          This code expires in 15 minutes. If you did not request this verification, you can safely ignore this email.
        </p>
      </div>
    `;

    const mailRes = await sendHtmlEmail(targetEmail, `${code} is your NaijaHomemade verification code`, html);
    if (!mailRes.success) {
      console.warn("[EMAIL OTP] Mailer warning:", mailRes.error);
    }

    res.json({
      success: true,
      email: targetEmail,
      message: `A 6-digit verification code has been sent to ${targetEmail}.`
    });
  } catch (err) {
    console.error("[SEND EMAIL OTP ERROR]", err);
    res.status(500).json({ error: "Failed to send verification code" });
  }
});

// 🟢 6C. VERIFY EMAIL OTP CODE (Lockout & Brute-Force Protected)
router.post("/verify-email-code", authenticateToken, otpVerifyLimiter, async (req, res) => {
  const userId = req.user.id;
  const code = String(req.body?.code || "").trim();

  if (!code || code.length < 6) {
    return res.status(400).json({ error: "Please enter a valid 6-digit verification code." });
  }

  try {
    const codeRes = await pool.query(
      `SELECT id, email, code, COALESCE(attempts, 0) as attempts, expires_at 
       FROM email_verification_codes
       WHERE user_id = $1 AND used = FALSE AND expires_at > NOW()
       ORDER BY created_at DESC LIMIT 1`,
      [userId]
    );

    if (codeRes.rows.length === 0) {
      return res.status(400).json({ error: "No active verification code found or code has expired. Please request a new one." });
    }

    const record = codeRes.rows[0];

    // 🛑 LOCKOUT: Invalidate code after 5 failed attempts
    if (record.attempts >= 5) {
      await pool.query("UPDATE email_verification_codes SET used = TRUE WHERE id = $1", [record.id]);
      return res.status(429).json({ error: "Too many failed attempts. This code has been invalidated for security. Please request a new code." });
    }

    // Compare code
    if (record.code !== code) {
      await pool.query("UPDATE email_verification_codes SET attempts = COALESCE(attempts, 0) + 1 WHERE id = $1", [record.id]);
      const remainingAttempts = 5 - (record.attempts + 1);
      return res.status(400).json({ 
        error: `Invalid verification code. ${remainingAttempts > 0 ? `${remainingAttempts} attempt${remainingAttempts === 1 ? '' : 's'} remaining.` : 'Code has been invalidated.'}` 
      });
    }

    // Code matched! Mark code as used and update user's email & email_verified
    await pool.query("UPDATE email_verification_codes SET used = TRUE WHERE id = $1", [record.id]);

    const updatedUserRes = await pool.query(
      `UPDATE app_users 
       SET email_verified = TRUE, email = $1
       WHERE id = $2
       RETURNING id, email, username, avatar_url, role, settings, is_premium,
                 is_creator, display_name, creator_bio, banner_url, creator_category, 
                 subscription_price, social_links, is_verified, location, website,
                 email_verified, kyc_status, kyc_rejection_reason, kyc_verified_at`,
      [record.email, userId]
    );

    res.json({
      success: true,
      email_verified: true,
      user: updatedUserRes.rows[0],
      message: "Email verified successfully!"
    });
  } catch (err) {
    console.error("[VERIFY EMAIL OTP ERROR]", err);
    res.status(500).json({ error: "Failed to verify email code" });
  }
});

// 🟢 7. UPDATE SETTINGS (Theme & Privacy Sync)
router.patch("/settings", authenticateToken, async (req, res) => {
  const parsed = settingsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error?.issues?.[0]?.message || "Invalid settings payload" });
  }

  const { settings } = parsed.data; 
  const userId = req.user.id;

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

// 🟢 8. CHECK USERNAME AVAILABILITY
router.get("/check-username", async (req, res) => {
  const { username } = req.query;
  
  if (!username || username.length < 3) {
    return res.json({ available: false });
  }

  try {
    const result = await pool.query("SELECT id FROM app_users WHERE LOWER(username) = LOWER($1)", [username]);
    res.json({ available: result.rows.length === 0 });
  } catch (err) {
    console.error("[USERNAME CHECK ERROR]", err);
    res.status(500).json({ error: "Failed to check username" });
  }
});

export default router;