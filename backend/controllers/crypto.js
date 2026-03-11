import axios from "axios";
import crypto from "crypto";

// ==========================================
// 1. GENERATE CRYPTO WALLET ADDRESS
// ==========================================
export const createCryptoPayment = async (req, res, pool) => {
  try {
    const { app_user_id, amount_ngn, crypto_currency } = req.body; 

    if (!app_user_id || !amount_ngn || !crypto_currency) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    if (!process.env.NOWPAYMENTS_API_KEY) {
      console.error("Missing NOWPAYMENTS_API_KEY in .env file");
      return res.status(500).json({ success: false, error: "Server configuration error" });
    }

    // 🟢 THE FIX: Convert Naira to USD so NOWPayments understands the value!
    // Adjust this rate to whatever you want your crypto buyers to pay.
    const exchangeRate = 1500; 
    const amount_usd = (amount_ngn / exchangeRate).toFixed(2); 

    // 1. Log the transaction in your database 
    const txRes = await pool.query(
      `INSERT INTO transactions (app_user_id, sender_name, expected_amount, status) 
       VALUES ($1, $2, $3, 'PENDING') RETURNING id`,
      [app_user_id, 'CRYPTO', amount_ngn]
    );
    const orderId = txRes.rows[0].id;

    // 2. Ask NOWPayments to generate a unique wallet address using USD
    const npRes = await axios.post(
      "https://api.nowpayments.io/v1/payment",
      {
        price_amount: amount_usd,      // Sends "10.00"
        price_currency: "usd",         // Tells them it is USD
        pay_currency: crypto_currency, 
        order_id: orderId.toString(),
        order_description: `Premium Upgrade for User ${app_user_id}`,
        ipn_callback_url: "https://videos.naijahomemade.com/api/crypto/webhook" 
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
    
    // Catch the minimum amount error and give a helpful message
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

    if (calculatedSig !== sig) {
      console.error("❌ Fake Crypto Webhook Blocked!");
      return res.status(403).send("Invalid signature");
    }

    const { payment_status, order_id } = req.body;
    console.log(`🔔 Crypto Webhook Received! Order: ${order_id}, Status: ${payment_status}`);

    if (payment_status === 'finished' || payment_status === 'confirmed') {
      await pool.query(`UPDATE transactions SET status = 'APPROVED' WHERE id = $1`, [order_id]);
      
      const tx = await pool.query(`SELECT app_user_id FROM transactions WHERE id = $1`, [order_id]);
      if (tx.rows.length > 0) {
        await pool.query(`UPDATE app_users SET is_premium = TRUE WHERE id = $1`, [tx.rows[0].app_user_id]);
        console.log(`✅ User ${tx.rows[0].app_user_id} upgraded to Premium via Crypto!`);
      }
    }

    res.status(200).send("OK");
  } catch (error) {
    console.error("NOWPayments Webhook Error:", error.message);
    res.status(500).send("Server Error");
  }
};