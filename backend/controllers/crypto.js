import axios from "axios";
import crypto from "crypto";

// ==========================================
// 1. GENERATE CRYPTO WALLET ADDRESS
// ==========================================
const VALID_CRYPTO_AMOUNTS_USD = [19, 25, 95, 250];

// ==========================================
// 1. GENERATE CRYPTO WALLET ADDRESS
// ==========================================
export const createCryptoPayment = async (req, res, pool) => {
  try {
    const app_user_id = req.user?.id;
    const { amount_usd, crypto_currency } = req.body; 

    if (!app_user_id) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    if (!amount_usd || !crypto_currency) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const numericAmount = Number(amount_usd);
    if (!VALID_CRYPTO_AMOUNTS_USD.includes(numericAmount)) {
      return res.status(400).json({ success: false, error: "Invalid subscription package amount" });
    }

    if (!process.env.NOWPAYMENTS_API_KEY) {
      console.error("Missing NOWPAYMENTS_API_KEY in .env file");
      return res.status(500).json({ success: false, error: "Server configuration error" });
    }

    // 1. Log the transaction in your database
    const txRes = await pool.query(
      `INSERT INTO transactions (app_user_id, sender_name, expected_amount, status) 
       VALUES ($1, $2, $3, 'PENDING') RETURNING id`,
      [app_user_id, 'CRYPTO', numericAmount]
    );
    const orderId = txRes.rows[0].id;

    // 2. Ask NOWPayments to generate a unique wallet address using USD
    const callbackUrl = `${process.env.API_BASE_URL || 'https://videos.naijahomemade.com'}/api/crypto/webhook`;
    const npRes = await axios.post(
      "https://api.nowpayments.io/v1/payment",
      {
        price_amount: numericAmount,
        price_currency: "usd",
        pay_currency: crypto_currency, 
        order_id: orderId.toString(),
        order_description: `Premium Upgrade for User ${app_user_id}`,
        ipn_callback_url: callbackUrl 
      },
      {
        headers: {
          "x-api-key": process.env.NOWPAYMENTS_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    // 3. Send the Wallet Address and Exact Crypto Amount back to React
    return res.json({
      success: true,
      payment_id: npRes.data.payment_id,
      pay_address: npRes.data.pay_address,
      pay_amount: npRes.data.pay_amount, 
      pay_currency: npRes.data.pay_currency,
      order_id: orderId
    });

  } catch (error) {
    const npError = error.response?.data;
    console.error("NOWPayments Create Error:", npError || error.message);
    
    if (npError && npError.code === 'AMOUNT_MINIMAL_ERROR') {
      return res.status(400).json({ 
        success: false, 
        error: "Package amount is too low for this coin's network fees. Please select USDT." 
      });
    }

    res.status(500).json({ success: false, error: "Failed to generate crypto address" });
  }
};

// ==========================================
// 2. THE SILENT WEBHOOK (IPN)
// ==========================================
export const cryptoWebhook = async (req, res, pool) => {
  try {
    const sig = req.headers['x-nowpayments-sig'];
    if (!sig) return res.status(400).send("No signature provided");

    if (!process.env.NOWPAYMENTS_IPN_SECRET) {
      console.error("Missing NOWPAYMENTS_IPN_SECRET in .env file");
      return res.status(500).send("Server configuration error");
    }

    const sortedBody = Object.keys(req.body).sort().reduce((acc, key) => {
      acc[key] = req.body[key];
      return acc;
    }, {});

    const hmac = crypto.createHmac('sha512', process.env.NOWPAYMENTS_IPN_SECRET);
    hmac.update(JSON.stringify(sortedBody));
    const calculatedSig = hmac.digest('hex');

    const sigBuffer = Buffer.from(sig, 'utf8');
    const calcBuffer = Buffer.from(calculatedSig, 'utf8');

    if (sigBuffer.length !== calcBuffer.length || !crypto.timingSafeEqual(sigBuffer, calcBuffer)) {
      console.error("❌ Fake Crypto Webhook Blocked!");
      return res.status(403).send("Invalid signature");
    }

    const { payment_status, order_id } = req.body;
    console.log(`🔔 Crypto Webhook Received! Order: ${order_id}, Status: ${payment_status}`);

    if (payment_status === 'finished' || payment_status === 'confirmed') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`UPDATE transactions SET status = 'APPROVED' WHERE id = $1`, [order_id]);
        
        const tx = await client.query(`SELECT app_user_id FROM transactions WHERE id = $1`, [order_id]);
        if (tx.rows.length > 0) {
          await client.query(`UPDATE app_users SET is_premium = TRUE WHERE id = $1`, [tx.rows[0].app_user_id]);
          console.log(`✅ User ${tx.rows[0].app_user_id} upgraded to Premium via Crypto!`);
        }
        await client.query('COMMIT');
      } catch (dbErr) {
        await client.query('ROLLBACK');
        throw dbErr;
      } finally {
        client.release();
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("NOWPayments Webhook Error:", error.message);
    res.status(500).send("Server Error");
  }
};

// ==========================================
// 3. CHECK TRANSACTION STATUS (For React Polling)
// ==========================================
export const checkCryptoTransaction = async (req, res, pool) => {
  try {
    const { order_id } = req.params;
    const tx = await pool.query("SELECT status FROM transactions WHERE id = $1", [order_id]);
    
    if (tx.rows.length === 0) return res.status(404).json({ error: "Transaction not found" });
    
    res.json({ success: true, status: tx.rows[0].status });
  } catch (error) {
    console.error("Status Check Error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};