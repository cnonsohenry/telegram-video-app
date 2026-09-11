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

        // Auto-subscribe user to official @naijahomemade VIP creator
        try {
          const mainCreator = await client.query(
            "SELECT id FROM app_users WHERE telegram_user_id = 1881815190 OR LOWER(username) = 'naijahomemade' LIMIT 1"
          );
          if (mainCreator.rows.length > 0) {
            await client.query(
              `INSERT INTO creator_subscriptions (subscriber_id, creator_id, amount_paid, status, expires_at)
               VALUES ($1, $2, $3, 'active', NOW() + INTERVAL '30 days')
               ON CONFLICT (subscriber_id, creator_id) DO UPDATE
               SET status = 'active', amount_paid = $3, expires_at = NOW() + INTERVAL '30 days'`,
              [app_user_id, mainCreator.rows[0].id, numericAmount]
            );
          }
        } catch (subErr) {
          console.warn("[VERIFY-PAYMENT] Creator subscription notice:", subErr.message);
        }

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