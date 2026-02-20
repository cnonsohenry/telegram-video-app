// backend/controllers/userController.js
import pool from "../db.js"; // Your DB connection

export const updateUserSettings = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { settings } = req.body; 

    if (!settings) return res.status(400).json({ error: "Missing settings" });

    // Merges the new settings into the existing JSONB column
    const query = `
      UPDATE app_users 
      SET settings = COALESCE(settings, '{}'::jsonb) || $1 
      WHERE id = $2 
      RETURNING settings;
    `;

    const result = await pool.query(query, [JSON.stringify(settings), userId]);

    res.json({ success: true, settings: result.rows[0].settings });
  } catch (err) {
    console.error("Theme Sync Error:", err);
    res.status(500).json({ error: "Failed to update database" });
  }
};