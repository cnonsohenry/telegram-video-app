import axios from "axios";
import crypto from "crypto";

// ==========================================
// 1. GENERATE CRYPTO WALLET ADDRESS
// ==========================================
const VALID_CRYPTO_AMOUNTS_USD = [19, 25, 95, 250];

export const createCryptoPayment = async (req, res, pool) => {
  try {
    const app_user_id = req.user?.id;
    const { 
      amount_usd, 
      crypto_currency, 
      payment_type = 'premium', 
      creator_username, 
      message 
    } = req.body; 

    if (!app_user_id) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    if (!amount_usd || !crypto_currency) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    const numericAmount = Number(amount_usd);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ success: false, error: "Invalid payment amount" });
    }

    let creatorId = null;
    let targetCreator = null;
    let orderDescription = `Premium Upgrade for User ${app_user_id}`;

    if (payment_type === 'creator_sub' || payment_type === 'creator_tip') {
      if (!creator_username) {
        return res.status(400).json({ success: false, error: "Creator username required" });
      }

      // Minimal amount check (NOWPayments network minimal requirement is typically ~$2-$3)
      if (numericAmount < 2 || numericAmount > 1000) {
        return res.status(400).json({ 
          success: false, 
          error: "Crypto payment amount must be between $2 and $1,000 USD." 
        });
      }

      // Look up creator
      const appUserRes = await pool.query(
        "SELECT id, username, display_name FROM app_users WHERE LOWER(username) = LOWER($1)",
        [creator_username]
      );
      targetCreator = appUserRes.rows[0];

      if (!targetCreator) {
        const tgRes = await pool.query(
          "SELECT user_id as id, username, full_name as display_name FROM users WHERE LOWER(username) = LOWER($1)",
          [creator_username]
        );
        targetCreator = tgRes.rows[0];
      }

      if (!targetCreator) {
        return res.status(404).json({ success: false, error: "Creator not found" });
      }

      creatorId = targetCreator.id;
      if (String(app_user_id) === String(creatorId)) {
        return res.status(400).json({ success: false, error: "You cannot pay yourself" });
      }

      if (payment_type === 'creator_sub') {
        orderDescription = `VIP Subscription to @${targetCreator.username} for User ${app_user_id}`;
      } else {
        orderDescription = `Tip to @${targetCreator.username} from User ${app_user_id}`;
      }
    } else {
      // Platform VIP subscription
      if (!VALID_CRYPTO_AMOUNTS_USD.includes(numericAmount)) {
        return res.status(400).json({ success: false, error: "Invalid subscription package amount" });
      }
    }

    if (!process.env.NOWPAYMENTS_API_KEY) {
      console.error("Missing NOWPAYMENTS_API_KEY in .env file");
      return res.status(500).json({ success: false, error: "Server configuration error" });
    }

    // 1. Log the transaction in your database with metadata and creator link
    const metadata = {
      payment_type,
      creator_username: targetCreator?.username || null,
      creator_display_name: targetCreator?.display_name || null,
      message: message ? String(message).trim().slice(0, 300) : "",
      duration_days: 30
    };

    const txRes = await pool.query(
      `INSERT INTO transactions (app_user_id, sender_name, expected_amount, status, transaction_type, creator_id, metadata) 
       VALUES ($1, $2, $3, 'PENDING', $4, $5, $6) RETURNING id`,
      [app_user_id, 'CRYPTO', numericAmount, payment_type, creatorId, JSON.stringify(metadata)]
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
        order_description: orderDescription,
        ipn_callback_url: callbackUrl 
      },
      {
        headers: {
          "x-api-key": process.env.NOWPAYMENTS_API_KEY,
          "Content-Type": "application/json"
        }
      }
    );

    metadata.payment_id = npRes.data.payment_id;
    await pool.query(
      `UPDATE transactions SET metadata = $1 WHERE id = $2`,
      [JSON.stringify(metadata), orderId]
    );

    // 3. Send the Wallet Address and Exact Crypto Amount back to React
    return res.json({
      success: true,
      payment_id: npRes.data.payment_id,
      pay_address: npRes.data.pay_address,
      pay_amount: npRes.data.pay_amount, 
      pay_currency: npRes.data.pay_currency,
      order_id: orderId,
      payment_type,
      creator: targetCreator ? { username: targetCreator.username, display_name: targetCreator.display_name } : null
    });

  } catch (error) {
    const npError = error.response?.data;
    console.error("NOWPayments Create Error:", npError || error.message);
    
    if (npError && npError.code === 'AMOUNT_MINIMAL_ERROR') {
      return res.status(400).json({ 
        success: false, 
        error: "Amount is too low for this coin's network fees. Please select USDT or another coin." 
      });
    }

    res.status(500).json({ success: false, error: "Failed to generate crypto address" });
  }
};

// ==========================================
// HELPER: ORDER FULFILLMENT LOGIC
// ==========================================
export const fulfillCryptoOrder = async (pool, orderId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const txRes = await client.query(
      `SELECT id, app_user_id, expected_amount, transaction_type, creator_id, metadata, status 
       FROM transactions WHERE id = $1 FOR UPDATE`, 
      [orderId]
    );

    if (txRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return false;
    }

    const tx = txRes.rows[0];
    if (tx.status === 'APPROVED') {
      await client.query('COMMIT');
      return true;
    }

    await client.query(`UPDATE transactions SET status = 'APPROVED' WHERE id = $1`, [orderId]);
    const txType = tx.transaction_type || 'premium';

    if (txType === 'creator_sub' && tx.creator_id) {
      // Activate creator VIP subscription for 30 days
      await client.query(
        `INSERT INTO creator_subscriptions (subscriber_id, creator_id, amount_paid, status, expires_at)
         VALUES ($1, $2, $3, 'active', NOW() + INTERVAL '30 days')
         ON CONFLICT (subscriber_id, creator_id)
         DO UPDATE SET status = 'active', amount_paid = $3, expires_at = NOW() + INTERVAL '30 days'`,
        [tx.app_user_id, tx.creator_id, tx.expected_amount]
      );
      console.log(`✅ User ${tx.app_user_id} subscribed to Creator ID ${tx.creator_id} via Crypto ($${tx.expected_amount})!`);
    } else if (txType === 'creator_tip' && tx.creator_id) {
      // Record creator tip
      const tipMsg = tx.metadata?.message || "";
      await client.query(
        `INSERT INTO creator_tips (sender_id, creator_id, amount, message)
         VALUES ($1, $2, $3, $4)`,
        [tx.app_user_id, tx.creator_id, tx.expected_amount, tipMsg]
      );
      console.log(`✅ User ${tx.app_user_id} tipped Creator ID ${tx.creator_id} ($${tx.expected_amount}) via Crypto!`);
    } else {
      // Platform VIP Upgrade
      await client.query(`UPDATE app_users SET is_premium = TRUE WHERE id = $1`, [tx.app_user_id]);
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
            [tx.app_user_id, mainCreator.rows[0].id, tx.expected_amount || 0]
          );
        }
      } catch (subErr) {
        console.warn("[CRYPTO-VIP] Auto-subscribe notice:", subErr.message);
      }
      console.log(`✅ User ${tx.app_user_id} upgraded to Premium via Crypto!`);
    }

    await client.query('COMMIT');
    return true;
  } catch (dbErr) {
    await client.query('ROLLBACK');
    throw dbErr;
  } finally {
    client.release();
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
      await fulfillCryptoOrder(pool, order_id);
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
    const tx = await pool.query(
      `SELECT id, status, transaction_type, creator_id, expected_amount, metadata 
       FROM transactions WHERE id = $1`, 
      [order_id]
    );
    
    if (tx.rows.length === 0) return res.status(404).json({ error: "Transaction not found" });

    let currentStatus = tx.rows[0].status;

    // Fallback: If still PENDING and payment_id is recorded, check NOWPayments status directly
    const paymentId = tx.rows[0].metadata?.payment_id;
    if (currentStatus === 'PENDING' && paymentId && process.env.NOWPAYMENTS_API_KEY) {
      try {
        const npCheck = await axios.get(
          `https://api.nowpayments.io/v1/payment/${paymentId}`,
          {
            headers: { "x-api-key": process.env.NOWPAYMENTS_API_KEY },
            timeout: 6000
          }
        );
        const npStatus = npCheck.data?.payment_status;
        if (npStatus === 'finished' || npStatus === 'confirmed') {
          await fulfillCryptoOrder(pool, order_id);
          currentStatus = 'APPROVED';
        }
      } catch (checkErr) {
        // Silently continue if NOWPayments check fails
      }
    }
    
    res.json({ 
      success: true, 
      status: currentStatus,
      transaction_type: tx.rows[0].transaction_type,
      creator_id: tx.rows[0].creator_id,
      metadata: tx.rows[0].metadata
    });
  } catch (error) {
    console.error("Status Check Error:", error.message);
    res.status(500).json({ error: "Server error" });
  }
};