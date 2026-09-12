import React, { useState, useEffect } from "react";
import { 
  X, Heart, CheckCircle, CheckCircle2, Copy, QrCode, 
  Loader2, Sparkles, ArrowLeft, ShieldCheck, DollarSign
} from "lucide-react";
import { APP_CONFIG } from "../config";

const TIP_PRESETS = [
  { amountNgn: 3000, amountUsd: 3, label: "₦3,000 ($3)" },
  { amountNgn: 5000, amountUsd: 6, label: "₦5,000 ($6)" },
  { amountNgn: 10000, amountUsd: 12, label: "₦10,000 ($12)" },
  { amountNgn: 25000, amountUsd: 30, label: "₦25,000 ($30)" },
  { amountNgn: 50000, amountUsd: 60, label: "₦50,000 ($60)" }
];

export default function CreatorTipModal({ creator, onClose, onTipSuccess }) {
  const [selectedPreset, setSelectedPreset] = useState(TIP_PRESETS[1]); // Default ₦5,000 ($6)
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  
  const [generating, setGenerating] = useState(false);
  const [cryptoDetails, setCryptoDetails] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [hasSentPayment, setHasSentPayment] = useState(false);
  const [pollingStatus, setPollingStatus] = useState("pending");
  const [error, setError] = useState("");

  const effectiveAmountNgn = customAmount 
    ? Number(customAmount) 
    : (selectedPreset?.amountNgn || 5000);

  const effectiveAmountUsd = customAmount 
    ? Math.max(3, Math.round(Number(customAmount) / 850)) 
    : (selectedPreset?.amountUsd || 6);

  // Prevent background scroll while modal is active
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Polling for confirmation
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
            if (onTipSuccess) {
              onTipSuccess(effectiveAmountNgn);
            }
          }
        } catch (err) {
          console.error("Tip crypto poll error:", err);
        }
      };

      pollInterval = setInterval(checkStatus, 8000);
      if (hasSentPayment) {
        checkStatus();
      }
    }
    return () => clearInterval(pollInterval);
  }, [cryptoDetails, hasSentPayment, pollingStatus, effectiveAmountNgn, onTipSuccess]);

  const handleSelectCoin = async (coinId) => {
    if (!effectiveAmountUsd || effectiveAmountUsd < 2) {
      setError("Minimum tip amount via crypto is $2 USD (~₦2,000).");
      return;
    }

    setGenerating(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Please log in to send a tip.");
      }

      const res = await fetch(`${APP_CONFIG.apiUrl}/api/crypto/create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount_usd: effectiveAmountUsd,
          crypto_currency: coinId,
          payment_type: "creator_tip",
          creator_username: creator.username,
          message: message.trim()
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to initialize crypto tip");
      }

      setCryptoDetails(data);
    } catch (err) {
      setError(err.message || "Failed to create crypto tip address");
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
              setError("");
              setHasSentPayment(false);
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
            Tip @{creator?.username || "creator"}
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
              <h3 style={successTitleStyle}>Tip Sent Successfully!</h3>
              <p style={successSubStyle}>
                You sent a tip of <b>₦{effectiveAmountNgn.toLocaleString()} (${effectiveAmountUsd} USD)</b> to <b>{creator?.display_name || creator?.username}</b>. Thank you for supporting creators!
              </p>
              <div style={successCreatorCardStyle}>
                <img 
                  src={creator?.avatar_url || "/assets/default-avatar.png"} 
                  alt={creator?.display_name} 
                  style={{ width: "44px", height: "44px", borderRadius: "50%", objectFit: "cover" }}
                  onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                />
                <div>
                  <div style={{ fontWeight: "800", color: "#fff", fontSize: "14px" }}>
                    {creator?.display_name || creator?.username}
                  </div>
                  <div style={{ fontSize: "12px", color: "#00d084", fontWeight: "700" }}>
                    Tip Confirmed on Blockchain ✓
                  </div>
                </div>
              </div>
              <button onClick={onClose} style={doneBtnStyle}>
                Done
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
                    <div style={{ fontSize: "12px", color: "#8e8e93" }}>Tipping</div>
                    <div style={{ fontSize: "14px", fontWeight: "800", color: "#fff" }}>
                      @{creator?.username}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "11px", color: "#8e8e93" }}>TIP AMOUNT</span>
                  <div style={{ fontSize: "15px", fontWeight: "900", color: "#f91880" }}>
                    ₦{effectiveAmountNgn.toLocaleString()} (${effectiveAmountUsd})
                  </div>
                </div>
              </div>

              {/* Amount Box */}
              <div style={transferDetailsBox}>
                <div style={transferRowStyle}>
                  <div>
                    <span style={transferLabelStyle}>EXACT CRYPTO TO SEND</span>
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
                <span style={qrCaptionStyle}>Scan with your crypto wallet to send tip</span>
              </div>

              {/* Status button */}
              {!hasSentPayment ? (
                <button 
                  onClick={() => setHasSentPayment(true)} 
                  style={iHavePaidBtnStyle}
                >
                  I Have Sent Tip
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
                🔒 100% of your tip goes directly to @{creator?.username} upon blockchain confirmation.
              </p>
            </div>
          ) : (
            /* STATE 3: TIP SELECTION & COIN SELECTION */
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Creator Card */}
              <div style={creatorCardStyle}>
                <img 
                  src={creator?.avatar_url || "/assets/default-avatar.png"} 
                  alt={creator?.display_name} 
                  style={creatorAvatarStyle}
                  onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={creatorNameStyle}>{creator?.display_name || creator?.username}</span>
                    <CheckCircle size={14} color="#00aff0" fill="#00aff0" />
                  </div>
                  <span style={creatorCategoryStyle}>{creator?.creator_category || "Creator"}</span>
                </div>
              </div>

              {error && <div style={errorBannerStyle}>{error}</div>}

              {/* Preset Chips */}
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Select Tip Amount</label>
                <div style={presetGridStyle}>
                  {TIP_PRESETS.map((p) => {
                    const isSelected = selectedPreset?.amountNgn === p.amountNgn && !customAmount;
                    return (
                      <button
                        type="button"
                        key={p.amountNgn}
                        onClick={() => { setSelectedPreset(p); setCustomAmount(""); }}
                        style={{
                          ...presetBtnStyle,
                          borderColor: isSelected ? "#f91880" : "#333",
                          background: isSelected ? "rgba(249, 24, 128, 0.15)" : "#1c1c1e",
                          color: isSelected ? "#fff" : "#ccc"
                        }}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Custom Amount Input */}
              <div style={fieldGroupStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <label style={labelStyle}>Or Custom Amount (₦)</label>
                  {customAmount && (
                    <span style={{ fontSize: "11px", color: "#00d084", fontWeight: "700" }}>
                      ≈ ${effectiveAmountUsd} USD
                    </span>
                  )}
                </div>
                <div style={{ position: "relative" }}>
                  <span style={currencySymbolStyle}>₦</span>
                  <input
                    type="number"
                    min={2000}
                    step={500}
                    placeholder="e.g. 15000"
                    value={customAmount}
                    onChange={(e) => { setCustomAmount(e.target.value); setSelectedPreset(null); }}
                    style={{ ...inputStyle, paddingLeft: "36px" }}
                  />
                </div>
              </div>

              {/* Note / Message */}
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Note to Creator (Optional)</label>
                <textarea
                  rows={2}
                  maxLength={200}
                  placeholder="Add a compliment or private note with your tip..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  style={textareaStyle}
                />
              </div>

              {/* Crypto Coin Grid */}
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>
                  Select Crypto to Send ₦{effectiveAmountNgn.toLocaleString()} (~${effectiveAmountUsd} USD)
                </label>

                {generating ? (
                  <div style={loaderBoxStyle}>
                    <Loader2 size={30} color="#f7931a" className="animate-spin" />
                    <span style={{ fontSize: "13px", color: "#fff", fontWeight: "700", marginTop: "10px" }}>
                      Generating Secure Tip Wallet...
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

              {/* Footer */}
              <div style={guaranteeRowStyle}>
                <ShieldCheck size={15} color="#00d084" />
                <span>Powered by NOWPayments • Zero chargebacks • Instant payout</span>
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
  zIndex: 100001,
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

const heartIconStyle = {
  width: "36px",
  height: "36px",
  borderRadius: "10px",
  background: "linear-gradient(135deg, #f91880, var(--primary-color))",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const titleStyle = { margin: 0, fontSize: "16px", fontWeight: "800", color: "#fff" };
const subtitleStyle = { margin: "2px 0 0 0", fontSize: "12px", color: "#8e8e93" };
const iconBtnStyle = { background: "none", border: "none", cursor: "pointer", padding: "6px", display: "flex", alignItems: "center", justifyContent: "center" };
const contentBodyStyle = { padding: "20px" };

const creatorCardStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 16px",
  background: "#1c1c1e",
  borderRadius: "14px",
  border: "1px solid #2a2a2c"
};

const creatorAvatarStyle = {
  width: "44px",
  height: "44px",
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid #fff"
};

const creatorNameStyle = { fontWeight: "700", fontSize: "14px", color: "#fff" };
const creatorCategoryStyle = { fontSize: "11px", color: "#8e8e93" };
const fieldGroupStyle = { display: "flex", flexDirection: "column", gap: "6px" };
const labelStyle = { fontSize: "13px", fontWeight: "700", color: "#e5e5ea" };

const presetGridStyle = { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" };
const presetBtnStyle = { border: "1px solid", borderRadius: "10px", padding: "10px", fontSize: "12px", fontWeight: "700", cursor: "pointer", transition: "all 0.2s" };

const currencySymbolStyle = { position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#888", fontWeight: "700" };
const inputStyle = { width: "100%", background: "#1c1c1e", border: "1px solid #333", borderRadius: "12px", padding: "12px 14px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" };
const textareaStyle = { width: "100%", background: "#1c1c1e", border: "1px solid #333", borderRadius: "12px", padding: "10px 14px", color: "#fff", fontSize: "13px", outline: "none", boxSizing: "border-box", resize: "none" };

const cryptoGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8px"
};

const cryptoBtnStyle = {
  padding: "12px 10px",
  borderRadius: "12px",
  fontWeight: "800",
  fontSize: "12px",
  cursor: "pointer",
  border: "none",
  transition: "transform 0.15s ease, opacity 0.2s ease",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  textAlign: "center"
};

const loaderBoxStyle = {
  padding: "24px 16px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "#1a1a1c",
  borderRadius: "14px",
  border: "1px solid #28282b"
};

const guaranteeRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  fontSize: "11px",
  color: "#8e8e93",
  paddingTop: "4px"
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
  border: "1.5px solid #f91880"
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
  background: "linear-gradient(135deg, #f91880, var(--primary-color))",
  color: "#fff",
  border: "none",
  borderRadius: "14px",
  padding: "14px",
  fontWeight: "800",
  fontSize: "14px",
  cursor: "pointer",
  boxShadow: "0 6px 18px rgba(249, 24, 128, 0.35)"
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
