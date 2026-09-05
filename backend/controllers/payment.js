import "dotenv/config";
import axios from "axios";

const VALID_AMOUNTS = [15000, 25000, 125000, 250000];

export const verifyPayment = async (req, res, pool) => {
  try {
    const app_user_id = req.user?.id;
    const { sender_name, amount } = req.body;

    if (!app_user_id) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    if (!sender_name || !sender_name.trim() || !amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const numericAmount = Number(amount);
    if (!VALID_AMOUNTS.includes(numericAmount)) {
      return res.status(400).json({ success: false, error: "Invalid payment package amount" });
    }

    const cleanSenderName = sender_name.trim().slice(0, 100);

    // 1. Log the attempt in the database if it doesn't exist yet
    let txRes = await pool.query(
      `SELECT id FROM transactions WHERE app_user_id = $1 AND status = 'PENDING' LIMIT 1`,
      [app_user_id]
    );

    if (txRes.rowCount === 0) {
      await pool.query(
        `INSERT INTO transactions (app_user_id, sender_name, expected_amount) VALUES ($1, $2, $3)`,
        [app_user_id, cleanSenderName, numericAmount]
      );
    }

    // 2. Ping the Python AI Engine running on port 8000
    const pythonRes = await axios.post(`${process.env.PYTHON_SERVICE_URL}/api/verify-transfer`, {
      sender_name: cleanSenderName,
      expected_amount: numericAmount.toString()
    }, { timeout: 10000 });

    const engineData = pythonRes.data;

    // 3. Process the AI's decision
    if (engineData.status === 'success') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE transactions SET status = 'APPROVED' WHERE app_user_id = $1 AND status = 'PENDING'`,
          [app_user_id]
        );
        await client.query(
          `UPDATE app_users SET is_premium = TRUE WHERE id = $1`,
          [app_user_id]
        );
        await client.query('COMMIT');
      } catch (dbErr) {
        await client.query('ROLLBACK');
        throw dbErr;
      } finally {
        client.release();
      }

      return res.json({
        success: true,
        message: "Payment verified successfully! Welcome to Premium.",
        extractedName: engineData.extracted_name
      });
    } else {
      // ⏳ Still waiting for the bank email to arrive...
      return res.json({
        success: false,
        status: 'pending',
        message: engineData.message || "Payment matching in progress..."
      });
    }
  } catch (error) {
    console.error("Payment Bridge Error:", error.message);
    res.status(500).json({ success: false, message: "Internal server error connecting to billing engine." });
  }
};