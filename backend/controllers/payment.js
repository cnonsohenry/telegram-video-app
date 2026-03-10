import axios from "axios";

export const verifyPayment = async (req, res, pool) => {
  try {
    // 🟢 We expect 'app_user_id' from the React frontend
    const { app_user_id, sender_name, amount } = req.body;

    if (!app_user_id || !sender_name || !amount) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    // 1. Log the attempt in the database if it doesn't exist yet
    let txRes = await pool.query(
      `SELECT id FROM transactions WHERE app_user_id = $1 AND status = 'PENDING' LIMIT 1`,
      [app_user_id]
    );

    if (txRes.rowCount === 0) {
      await pool.query(
        `INSERT INTO transactions (app_user_id, sender_name, expected_amount) VALUES ($1, $2, $3)`,
        [app_user_id, sender_name, amount]
      );
    }

    // 2. Ping the Python AI Engine running on port 8000
    const pythonRes = await axios.post('http://127.0.0.1:8000/api/verify-transfer', {
      sender_name: sender_name,
      expected_amount: amount.toString()
    });

    const engineData = pythonRes.data;

    // 3. Process the AI's decision
    if (engineData.status === 'success') {
      
      // ✅ AI matched the payment! Upgrade the website user and close the transaction.
      await pool.query(
        `UPDATE transactions SET status = 'APPROVED' WHERE app_user_id = $1 AND status = 'PENDING'`,
        [app_user_id]
      );
      
      await pool.query(
        `UPDATE app_users SET is_premium = TRUE WHERE id = $1`,
        [app_user_id]
      );

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
        message: engineData.message
      });
      
    }

  } catch (error) {
    console.error("Payment Bridge Error:", error.message);
    res.status(500).json({ success: false, message: "Internal server error connecting to billing engine." });
  }
};