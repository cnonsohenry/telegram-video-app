import React, { useState, useEffect } from "react";
import { 
  X, CheckCircle, CheckCircle2, ShieldCheck, Copy, QrCode, 
  Loader2, Sparkles, ArrowLeft, Lock, Star, MessageCircle, AlertCircle
} from "lucide-react";
import { APP_CONFIG } from "../config";

export default function CreatorSubscribeModal({ creator, onClose, onSubscribeSuccess }) {
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [cryptoDetails, setCryptoDetails] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [hasSentPayment, setHasSentPayment] = useState(false);
  const [pollingStatus, setPollingStatus] = useState("pending");
  const [error, setError] = useState("");

  const priceNgn = Number(creator?.subscription_price || 0);
  // Convert NGN to USD (minimum $3 USD to satisfy NOWPayments network limits)
  const priceUsd = Math.max(3, Math.round(priceNgn / 800) || 19);

  // Prevent background scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Polling for blockchain confirmation
  useEffect(() => {
    let pollInterval;
    if (cryptoDetails?.order_id && pollingStatus !== "success") {
      const checkStatus = async () => {
        try {
          const res = await fetch(`${APP_CONFIG.apiUrl}/api/crypto/status/${cryptoDetails.order_id}`);
          const data = await res.json();
          if (data.success && data.status === "APPROVED") {
            setPollingStatus("success");
            clearInterval(pollInterval);
            if (onSubscribeSuccess) {
              onSubscribeSuccess();
            }
          }
        } catch (err) {
          console.error("Subscription crypto poll error:", err);
        }
      };

      // Poll every 8 seconds
      pollInterval = setInterval(checkStatus, 8000);
      if (hasSentPayment) {
        checkStatus();
      }
    }
    return () => clearInterval(pollInterval);
  }, [cryptoDetails, hasSentPayment, pollingStatus, onSubscribeSuccess]);

  const handleSelectCoin = async (coinId) => {
    setSelectedCoin(coinId);
    setGenerating(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Please log in to subscribe to this creator.");
      }

      const res = await fetch(`${APP_CONFIG.apiUrl}/api/crypto/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount_usd: priceUsd,
          crypto_currency: coinId,
          payment_type: "creator_sub",
          creator_username: creator.username
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to initialize crypto payment");
      }

      setCryptoDetails(data);
    } catch (err) {
      setError(err.message || "Failed to create payment session");
      setSelectedCoin(null);
    } finally {
      setGenerating(false);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  return (
    <div style={fullscreenContainerStyle}>
      {/* Instagram-style Top Navigation Bar */}
      <div style={topNavStyle}>
        <button 
          onClick={() => {
            if (cryptoDetails && pollingStatus !== "success") {
              setCryptoDetails(null);
              setSelectedCoin(null);
              setError("");
            } else {
              onClose();
            }
          }} 
          style={navBackBtnStyle}
          aria-label="Back"
        >
          <ArrowLeft size={24} color="#fff" />
        </button>

        <div style={{ textAlign: "center", flex: 1 }}>
          <span style={topNavTitleStyle}>
            VIP Pass: @{creator?.username || "creator"}
          </span>
        </div>

        <div style={{ width: "36px" }} />
      </div>

      <div style={scrollAreaStyle}>
        <div style={innerContentStyle}>
          
          {/* STATE 1: SUCCESS */}
          {pollingStatus === "success" ? (
            <div style={successContainerStyle}>
              <div style={successIconStyle}>
                <Sparkles size={40} color="#00d084" />
              </div>
              <h3 style={successTitleStyle}>VIP Access Activated!</h3>
              <p style={successSubStyle}>
                You now have 30 days of VIP access to <b>@{creator?.username}</b>'s exclusive drops, full videos, and direct messages.
              </p>
              <div style={successCreatorCardStyle}>
                <img 
                  src={creator?.avatar_url || "/assets/default-avatar.png"} 
                  alt={creator?.display_name} 
                  style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover" }}
                  onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                />
                <div>
                  <div style={{ fontWeight: "800", color: "#fff", fontSize: "14px" }}>
                    {creator?.display_name || creator?.username}
                  </div>
                  <div style={{ fontSize: "12px", color: "#00d084", fontWeight: "700" }}>
                    Active VIP Subscriber ✓
                  </div>
                </div>
              </div>
              <button onClick={onClose} style={doneBtnStyle}>
                Start Watching VIP Content
              </button>
            </div>
          ) : cryptoDetails ? (
            /* STATE 2: CRYPTO INVOICE WITH QR & ADDRESS */
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {error && <div style={errorBannerStyle}>{error}</div>}

              <div style={invoiceHeaderCard}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <img 
                    src={creator?.avatar_url || "/assets/default-avatar.png"} 
                    alt={creator?.display_name}
                    style={creatorSmallAvatarStyle}
                    onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                  />
                  <div>
                    <div style={{ fontSize: "12px", color: "#8e8e93" }}>Subscribing to</div>
                    <div style={{ fontSize: "14px", fontWeight: "800", color: "#fff" }}>
                      @{creator?.username}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "11px", color: "#8e8e93" }}>30 DAYS PASS</span>
                  <div style={{ fontSize: "15px", fontWeight: "900", color: "#00aff0" }}>
                    ₦{priceNgn.toLocaleString()} (${priceUsd})
                  </div>
                </div>
              </div>

              {/* Amount to Send Box */}
              <div style={transferDetailsBox}>
                <div style={transferRowStyle}>
                  <div>
                    <span style={transferLabelStyle}>EXACT AMOUNT TO SEND</span>
                    <div style={transferAmountStyle}>
                      {cryptoDetails.pay_amount}{" "}
                      <span style={{ color: "#f7931a", fontSize: "14px" }}>
                        {cryptoDetails.pay_currency?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(String(cryptoDetails.pay_amount), "amount")}
                    style={copyBtnStyle}
                    title="Copy amount"
                  >
                    {copiedField === "amount" ? <CheckCircle2 size={16} color="#00d084" /> : <Copy size={16} color="#fff" />}
                  </button>
                </div>

                {/* Wallet Address */}
                <div style={{ ...transferRowStyle, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "12px", marginTop: "12px" }}>
                  <div style={{ overflow: "hidden", paddingRight: "10px" }}>
                    <span style={transferLabelStyle}>DEPOSIT WALLET ADDRESS</span>
                    <div style={walletAddressStyle}>
                      {cryptoDetails.pay_address}
                    </div>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(cryptoDetails.pay_address, "address")}
                    style={{ ...copyBtnStyle, flexShrink: 0 }}
                    title="Copy wallet address"
                  >
                    {copiedField === "address" ? <CheckCircle2 size={16} color="#00d084" /> : <Copy size={16} color="#fff" />}
                  </button>
                </div>
              </div>

              {/* QR Code */}
              <div style={qrContainerStyle}>
                <img 
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(cryptoDetails.pay_address)}&bgcolor=ffffff`} 
                  alt="Deposit QR Code"
                  style={qrImageStyle}
                />
                <span style={qrCaptionStyle}>Scan with your crypto wallet to pay</span>
              </div>

              {/* Status & Confirmation Trigger */}
              {!hasSentPayment ? (
                <button 
                  onClick={() => setHasSentPayment(true)} 
                  style={iHavePaidBtnStyle}
                >
                  I Have Sent Payment
                </button>
              ) : (
                <div style={statusWaitingBox}>
                  <Loader2 size={18} color="#f7931a" className="animate-spin" />
                  <span style={{ fontSize: "13px", color: "#f7931a", fontWeight: "700" }}>
                    Awaiting blockchain confirmation...
                  </span>
                </div>
              )}

              <p style={securityNoticeStyle}>
                🔒 Payments are processed securely via NOWPayments. Once confirmed on the blockchain, your VIP pass activates automatically.
              </p>
            </div>
          ) : (
            /* STATE 3: CREATOR OVERVIEW & COIN SELECTION */
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {error && <div style={errorBannerStyle}>{error}</div>}

              {/* Creator Card */}
              <div style={creatorBannerCardStyle}>
                <img 
                  src={creator?.avatar_url || "/assets/default-avatar.png"} 
                  alt={creator?.display_name} 
                  style={creatorProfileAvatarStyle}
                  onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={creatorNameStyle}>{creator?.display_name || creator?.username}</span>
                    <CheckCircle size={15} color="#00aff0" fill="#00aff0" />
                  </div>
                  <span style={creatorMetaStyle}>@{creator?.username} • {creator?.creator_category || "Creator"}</span>
                  <div style={priceTagStyle}>
                    ₦{priceNgn.toLocaleString()}/mo <span style={{ color: "#8e8e93", fontSize: "12px", fontWeight: "500" }}>(~${priceUsd} USD)</span>
                  </div>
                </div>
              </div>

              {/* Perks List */}
              <div style={perksContainerStyle}>
                <div style={perkItemStyle}>
                  <Lock size={16} color="#00aff0" />
                  <span>Full access to private photos, drops, and uncensored full videos</span>
                </div>
                <div style={perkItemStyle}>
                  <MessageCircle size={16} color="#00aff0" />
                  <span>Priority DM chat access with @{creator?.username}</span>
                </div>
                <div style={perkItemStyle}>
                  <Star size={16} color="#00aff0" />
                  <span>VIP badge on all comments and live updates for 30 days</span>
                </div>
              </div>

              {/* Cryptocurrency Grid */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={selectCoinLabelStyle}>Choose Cryptocurrency to Pay</span>

                {generating ? (
                  <div style={loaderBoxStyle}>
                    <Loader2 size={32} color="#f7931a" className="animate-spin" />
                    <span style={{ fontSize: "13px", color: "#fff", fontWeight: "700", marginTop: "10px" }}>
                      Generating Secure Deposit Wallet...
                    </span>
                    <span style={{ fontSize: "11px", color: "#8e8e93", marginTop: "4px" }}>
                      Fetching real-time exchange rates
                    </span>
                  </div>
                ) : (
                  <div style={cryptoGridStyle}>
                    {APP_CONFIG.cryptoOptions.map((coin) => (
                      <button
                        key={coin.id}
                        type="button"
                        onClick={() => handleSelectCoin(coin.id)}
                        style={{
                          ...cryptoBtnStyle,
                          background: coin.bg,
                          color: coin.text,
                          gridColumn: coin.span === 2 ? "span 2" : "auto"
                        }}
                      >
                        {coin.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Guarantee Footer */}
              <div style={guaranteeRowStyle}>
                <ShieldCheck size={16} color="#00d084" />
                <span>Instant blockchain activation • 256-bit secure checkout</span>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// 🖌 Styles
const fullscreenContainerStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 100002,
  backgroundColor: "#000000",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  animation: "fadeIn 0.2s ease-out"
};

const topNavStyle = {
  height: "50px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 16px",
  borderBottom: "1px solid #1a1a1a",
  backgroundColor: "#000000",
  position: "sticky",
  top: 0,
  zIndex: 50,
  flexShrink: 0
};

const navBackBtnStyle = {
  background: "none",
  border: "none",
  color: "#fff",
  cursor: "pointer",
  padding: "6px",
  display: "flex",
  alignItems: "center"
};

const topNavTitleStyle = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#fff",
  letterSpacing: "0.2px"
};

const scrollAreaStyle = {
  flex: 1,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "20px 16px 40px",
  boxSizing: "border-box"
};

const innerContentStyle = {
  width: "100%",
  maxWidth: "460px",
  display: "flex",
  flexDirection: "column"
};

const creatorBannerCardStyle = {
  display: "flex",
  alignItems: "center",
  gap: "14px",
  padding: "14px 16px",
  background: "#1c1c1f",
  borderRadius: "16px",
  border: "1px solid rgba(255, 255, 255, 0.08)"
};

const creatorProfileAvatarStyle = {
  width: "56px",
  height: "56px",
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid #00aff0"
};

const creatorNameStyle = { fontWeight: "800", fontSize: "15px", color: "#fff" };
const creatorMetaStyle = { fontSize: "12px", color: "#8e8e93", display: "block", marginTop: "2px" };
const priceTagStyle = { fontSize: "15px", fontWeight: "900", color: "#00d084", marginTop: "4px" };

const perksContainerStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "8px",
  background: "rgba(0, 175, 240, 0.06)",
  border: "1px solid rgba(0, 175, 240, 0.15)",
  borderRadius: "14px",
  padding: "12px 14px"
};

const perkItemStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  fontSize: "12px",
  color: "#d1d1d6",
  lineHeight: "1.4"
};

const selectCoinLabelStyle = {
  fontSize: "13px",
  fontWeight: "800",
  color: "#fff",
  marginBottom: "4px"
};

const cryptoGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px"
};

const cryptoBtnStyle = {
  padding: "13px 12px",
  borderRadius: "12px",
  fontWeight: "800",
  fontSize: "13px",
  cursor: "pointer",
  border: "none",
  transition: "transform 0.15s ease, opacity 0.2s ease",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center"
};

const loaderBoxStyle = {
  padding: "36px 16px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "#1a1a1c",
  borderRadius: "16px",
  border: "1px solid #28282b"
};

const guaranteeRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  fontSize: "11px",
  color: "#8e8e93",
  paddingTop: "6px"
};

const invoiceHeaderCard = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  background: "#1c1c1f",
  borderRadius: "12px",
  border: "1px solid rgba(255, 255, 255, 0.08)"
};

const creatorSmallAvatarStyle = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  objectFit: "cover",
  border: "1.5px solid #00aff0"
};

const transferDetailsBox = {
  background: "#18181b",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "16px",
  padding: "16px"
};

const transferRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center"
};

const transferLabelStyle = {
  fontSize: "10px",
  fontWeight: "800",
  color: "#8e8e93",
  letterSpacing: "0.5px"
};

const transferAmountStyle = {
  fontSize: "20px",
  fontWeight: "900",
  color: "#fff",
  marginTop: "2px"
};

const walletAddressStyle = {
  fontSize: "12px",
  color: "#fff",
  fontFamily: "monospace",
  wordBreak: "break-all",
  marginTop: "4px",
  lineHeight: "1.4"
};

const copyBtnStyle = {
  background: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  borderRadius: "10px",
  padding: "8px 12px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s ease"
};

const qrContainerStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "8px",
  padding: "10px 0"
};

const qrImageStyle = {
  width: "140px",
  height: "140px",
  borderRadius: "12px",
  padding: "6px",
  backgroundColor: "#fff"
};

const qrCaptionStyle = {
  fontSize: "12px",
  color: "#8e8e93"
};

const iHavePaidBtnStyle = {
  background: "linear-gradient(135deg, #00aff0, #0088cc)",
  color: "#fff",
  border: "none",
  borderRadius: "14px",
  padding: "14px",
  fontWeight: "800",
  fontSize: "14px",
  cursor: "pointer",
  boxShadow: "0 6px 18px rgba(0, 175, 240, 0.35)"
};

const statusWaitingBox = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  padding: "12px",
  borderRadius: "12px",
  background: "rgba(247, 147, 26, 0.1)",
  border: "1px solid rgba(247, 147, 26, 0.25)"
};

const securityNoticeStyle = {
  margin: "4px 0 0 0",
  fontSize: "11px",
  color: "#71717a",
  lineHeight: "1.4",
  textAlign: "center"
};

const successContainerStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  padding: "20px 10px"
};

const successIconStyle = {
  width: "72px",
  height: "72px",
  borderRadius: "50%",
  background: "rgba(0, 208, 132, 0.15)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "16px"
};

const successTitleStyle = { margin: "0 0 8px 0", fontSize: "20px", fontWeight: "900", color: "#fff" };
const successSubStyle = { margin: "0 0 20px 0", fontSize: "13px", color: "#8e8e93", lineHeight: "1.5", maxWidth: "360px" };

const successCreatorCardStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  background: "#1a1a1d",
  border: "1px solid rgba(0, 208, 132, 0.3)",
  borderRadius: "14px",
  padding: "12px 18px",
  marginBottom: "24px"
};

const doneBtnStyle = {
  width: "100%",
  background: "linear-gradient(135deg, #00d084, #009e60)",
  color: "#fff",
  border: "none",
  borderRadius: "14px",
  padding: "14px",
  fontWeight: "800",
  fontSize: "14px",
  cursor: "pointer",
  boxShadow: "0 6px 18px rgba(0, 208, 132, 0.3)"
};

const errorBannerStyle = {
  padding: "10px 14px",
  backgroundColor: "rgba(255, 59, 48, 0.15)",
  border: "1px solid rgba(255, 59, 48, 0.3)",
  borderRadius: "12px",
  color: "#ff3b30",
  fontSize: "12px"
};
