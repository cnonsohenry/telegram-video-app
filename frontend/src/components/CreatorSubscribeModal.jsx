import React, { useState, useEffect } from "react";
import { 
  X, CheckCircle2, ShieldCheck, Copy, QrCode, 
  Loader2, Sparkles, ArrowLeft, Lock, Star, MessageCircle, AlertTriangle, ExternalLink
} from "lucide-react";
import TwitterVerifiedBadge from "./TwitterVerifiedBadge";
import { APP_CONFIG } from "../config";
import { promptLogin } from "../utils/toast";
import useModalHistory from "../hooks/useModalHistory";
import { getNetworkBadge, getWalletDeepLink, getQrData, formatCountdown } from "../utils/cryptoHelpers";

export default function CreatorSubscribeModal({ creator, onClose, onSubscribeSuccess }) {
  const handleSafeClose = useModalHistory(true, onClose, "creatorSubscribe");
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [cryptoDetails, setCryptoDetails] = useState(null);
  const [copiedField, setCopiedField] = useState(null);
  const [pollingStatus, setPollingStatus] = useState("listening"); // "listening" | "confirming" | "success"
  const [countdown, setCountdown] = useState(1200); // 20 minutes
  const [error, setError] = useState("");

  const rawPrice = Number(creator?.subscription_price || 0);
  const priceUsd = rawPrice > 0 ? Math.max(2, rawPrice) : 10;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      promptLogin("subscribe");
      onClose();
    }
  }, [onClose]);

  // Prevent background scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // 20-minute countdown timer once invoice is generated
  useEffect(() => {
    let timer;
    if (cryptoDetails && countdown > 0 && pollingStatus !== "success") {
      timer = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cryptoDetails, countdown, pollingStatus]);

  // Continuous automatic blockchain polling (checks every 5 seconds)
  useEffect(() => {
    let pollInterval;
    if (cryptoDetails?.order_id && pollingStatus !== "success") {
      const checkStatus = async () => {
        try {
          const res = await fetch(`${APP_CONFIG.apiUrl}/api/crypto/status/${cryptoDetails.order_id}`);
          const data = await res.json();

          if (data.success) {
            const st = String(data.status || "").toUpperCase();
            if (st === "APPROVED" || st === "FINISHED" || st === "CONFIRMED") {
              setPollingStatus("success");
              clearInterval(pollInterval);
              if (onSubscribeSuccess) {
                onSubscribeSuccess();
              }
            } else if (st === "WAITING" || st === "CONFIRMING" || st === "SENDING") {
              setPollingStatus("confirming");
            }
          }
        } catch (err) {
          console.error("Subscription crypto poll error:", err);
        }
      };

      // Run immediately, then every 5 seconds
      checkStatus();
      pollInterval = setInterval(checkStatus, 5000);
    }
    return () => clearInterval(pollInterval);
  }, [cryptoDetails, pollingStatus, onSubscribeSuccess]);

  if (!localStorage.getItem("token")) {
    return null;
  }

  const handleSelectCoin = async (coinId) => {
    setSelectedCoin(coinId);
    setGenerating(true);
    setError("");
    setCountdown(1200);
    setPollingStatus("listening");

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
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const networkInfo = cryptoDetails ? getNetworkBadge(cryptoDetails.pay_currency) : null;
  const walletDeepLink = cryptoDetails ? getWalletDeepLink(cryptoDetails.pay_currency, cryptoDetails.pay_address, cryptoDetails.pay_amount) : "#";
  const qrData = cryptoDetails ? getQrData(cryptoDetails.pay_currency, cryptoDetails.pay_address, cryptoDetails.pay_amount) : "";

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
              handleSafeClose();
            }
          }} 
          style={navBackBtnStyle}
          aria-label="Back"
        >
          <ArrowLeft size={24} color="#d4d4d8" />
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
          
          {/* STATE 1: SUCCESS CELEBRATION */}
          {pollingStatus === "success" ? (
            <div style={successContainerStyle}>
              <div style={successIconStyle}>
                <Sparkles size={40} color="#f43f5e" />
              </div>
              <h3 style={successTitleStyle}>VIP Access Activated!</h3>
              <p style={successSubStyle}>
                You now have 30 days of VIP access to <b>@{creator?.username}</b>'s exclusive drops, full videos, and direct messages.
              </p>
              <div style={successCreatorCardStyle}>
                <img 
                  src={creator?.avatar_url || "/assets/default-avatar.png"} 
                  alt={creator?.display_name} 
                  loading="eager"
                  decoding="async"
                  style={{ width: "48px", height: "48px", borderRadius: "50%", objectFit: "cover", backgroundColor: "#27272a" }}
                  onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                />
                <div>
                  <div style={{ fontWeight: "800", color: "#d4d4d8", fontSize: "14px" }}>
                    {creator?.display_name || creator?.username}
                  </div>
                  <div style={{ fontSize: "12px", color: "#f43f5e", fontWeight: "700" }}>
                    Active VIP Subscriber ✓
                  </div>
                </div>
              </div>
              <button onClick={handleSafeClose} style={doneBtnStyle}>
                Start Watching VIP Content
              </button>
            </div>
          ) : cryptoDetails ? (
            /* STATE 2: HIGH-CONVERTING CRYPTO CHECKOUT INVOICE */
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {error && <div style={errorBannerStyle}>{error}</div>}

              {/* Creator Summary Pill */}
              <div style={invoiceHeaderCard}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <img 
                    src={creator?.avatar_url || "/assets/default-avatar.png"} 
                    alt={creator?.display_name}
                    loading="eager"
                    decoding="async"
                    style={creatorSmallAvatarStyle}
                    onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                  />
                  <div>
                    <div style={{ fontSize: "11px", color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      Subscribing to
                    </div>
                    <div style={{ fontSize: "14px", fontWeight: "800", color: "#d4d4d8" }}>
                      @{creator?.username}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "10px", color: "#8e8e93", fontWeight: "700" }}>30-DAY PASS</span>
                  <div style={{ fontSize: "16px", fontWeight: "900", color: "#f43f5e" }}>
                    ${priceUsd} USD
                  </div>
                </div>
              </div>

              {/* Network Safety Badge */}
              {networkInfo && (
                <div style={{ ...networkAlertStyle, backgroundColor: networkInfo.bg, borderColor: `${networkInfo.color}33` }}>
                  <AlertTriangle size={15} color={networkInfo.color} style={{ flexShrink: 0, marginTop: "1px" }} />
                  <span style={{ color: "#f4f4f5", fontSize: "12px", lineHeight: "1.4" }}>
                    {networkInfo.warning}
                  </span>
                </div>
              )}

              {/* Transfer Details Card */}
              <div style={transferDetailsBox}>
                {/* Exact Amount */}
                <div style={transferRowStyle}>
                  <div>
                    <span style={transferLabelStyle}>EXACT AMOUNT TO SEND</span>
                    <div style={transferAmountStyle}>
                      {cryptoDetails.pay_amount}{" "}
                      <span style={{ color: "#f7931a", fontSize: "14px", fontWeight: "800" }}>
                        {cryptoDetails.pay_currency?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(String(cryptoDetails.pay_amount), "amount")}
                    style={copiedField === "amount" ? copyBtnSuccessStyle : copyBtnStyle}
                    title="Copy amount"
                  >
                    {copiedField === "amount" ? (
                      <>
                        <CheckCircle2 size={14} color="#10b981" />
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#10b981" }}>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} color="#f4f4f5" />
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#f4f4f5" }}>Copy</span>
                      </>
                    )}
                  </button>
                </div>

                {/* Deposit Address */}
                <div style={{ ...transferRowStyle, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "14px", marginTop: "14px" }}>
                  <div style={{ overflow: "hidden", paddingRight: "10px", flex: 1 }}>
                    <span style={transferLabelStyle}>DEPOSIT WALLET ADDRESS</span>
                    <div style={walletAddressStyle}>
                      {cryptoDetails.pay_address}
                    </div>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(cryptoDetails.pay_address, "address")}
                    style={copiedField === "address" ? copyBtnSuccessStyle : copyBtnStyle}
                    title="Copy wallet address"
                  >
                    {copiedField === "address" ? (
                      <>
                        <CheckCircle2 size={14} color="#10b981" />
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#10b981" }}>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={14} color="#f4f4f5" />
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#f4f4f5" }}>Copy</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* 1-Tap "Open in Wallet" Button */}
              {walletDeepLink !== "#" && (
                <a 
                  href={walletDeepLink} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={openWalletBtnStyle}
                >
                  <ExternalLink size={16} color="#a1a1aa" />
                  <span>Open in Crypto Wallet App</span>
                </a>
              )}

              {/* High-Resolution 220px QR Code */}
              <div style={qrCardStyle}>
                <div style={qrFrameStyle}>
                  <img 
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=${encodeURIComponent(qrData)}&bgcolor=ffffff`} 
                    alt="Deposit QR Code"
                    style={qrImageStyle}
                  />
                </div>
                <span style={qrCaptionStyle}>
                  Point any phone camera or wallet scanner at this code to pay
                </span>
              </div>

              {/* Live Blockchain Radar Status (No Manual Button Needed) */}
              <div style={radarContainerStyle}>
                <div style={pollingStatus === "confirming" ? radarSpinnerStyle : radarDotGlowStyle}>
                  {pollingStatus === "confirming" ? (
                    <Loader2 size={18} color="#f59e0b" className="animate-spin" />
                  ) : (
                    <div style={radarDotStyle} />
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={radarTitleStyle}>
                    {pollingStatus === "confirming"
                      ? "Payment Detected! Confirming on blockchain..."
                      : "Live: Listening for blockchain deposit..."}
                  </div>
                  <div style={radarSubtitleStyle}>
                    Rate locked for <b>{formatCountdown(countdown)}</b> • Activates automatically upon 1 confirmation
                  </div>
                </div>
              </div>

              <div style={securityRowStyle}>
                <ShieldCheck size={14} color="#10b981" />
                <span>Automated instant activation • Verified 256-bit checkout</span>
              </div>
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
                  loading="eager"
                  decoding="async"
                  style={creatorProfileAvatarStyle}
                  onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={creatorNameStyle}>{creator?.display_name || creator?.username}</span>
                    <TwitterVerifiedBadge size={15} style={{ flexShrink: 0 }} />
                  </div>
                  <span style={creatorMetaStyle}>@{creator?.username}</span>
                  <div style={priceTagStyle}>
                    ${priceUsd}/mo
                  </div>
                </div>
              </div>

              {/* Perks List */}
              <div style={perksContainerStyle}>
                <div style={perkItemStyle}>
                  <ShieldCheck size={16} color="#00aff0" />
                  <span>100% Ad-Free VIP experience across all creator content</span>
                </div>
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
                  <span>VIP badge on comments and instant Telegram leak updates</span>
                </div>
              </div>

              {/* Cryptocurrency Grid */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <span style={selectCoinLabelStyle}>Choose Cryptocurrency to Pay</span>

                {generating ? (
                  <div style={loaderBoxStyle}>
                    <Loader2 size={32} color="#f7931a" className="animate-spin" />
                    <span style={{ fontSize: "13px", color: "#d4d4d8", fontWeight: "700", marginTop: "10px" }}>
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
                          gridColumn: coin.span === 2 ? "span 2" : "auto"
                        }}
                      >
                        <span>{coin.label}</span>
                        <span style={cryptoCoinBadgeStyle}>{coin.badge || "CRYPTO"}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Guarantee Footer */}
              <div style={guaranteeRowStyle}>
                <ShieldCheck size={16} color="#10b981" />
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
  zIndex: 1000035,
  backgroundColor: "#09090b",
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
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  backgroundColor: "#09090b",
  position: "sticky",
  top: 0,
  zIndex: 50,
  flexShrink: 0
};

const navBackBtnStyle = {
  background: "none",
  border: "none",
  color: "#d4d4d8",
  cursor: "pointer",
  padding: "6px",
  display: "flex",
  alignItems: "center"
};

const topNavTitleStyle = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#d4d4d8",
  letterSpacing: "0.2px"
};

const scrollAreaStyle = {
  flex: 1,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "16px 16px 40px",
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
  background: "#18181b",
  borderRadius: "16px",
  border: "1px solid rgba(255, 255, 255, 0.08)"
};

const creatorProfileAvatarStyle = {
  width: "56px",
  height: "56px",
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid #00aff0",
  backgroundColor: "#27272a"
};

const creatorNameStyle = { fontWeight: "800", fontSize: "15px", color: "#d4d4d8" };
const creatorMetaStyle = { fontSize: "12px", color: "#8e8e93", display: "block", marginTop: "2px" };
const priceTagStyle = { fontSize: "15px", fontWeight: "900", color: "#f43f5e", marginTop: "4px" };

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
  color: "#d4d4d8",
  marginBottom: "4px"
};

const cryptoGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px"
};

const cryptoBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  padding: "12px 14px",
  borderRadius: "12px",
  background: "#202024",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  color: "#f4f4f5",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
  transition: "all 0.15s ease",
  boxSizing: "border-box"
};

const cryptoCoinBadgeStyle = {
  fontSize: "10px",
  fontWeight: "800",
  letterSpacing: "0.5px",
  padding: "3px 6px",
  borderRadius: "6px",
  background: "rgba(255, 255, 255, 0.06)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  color: "#a1a1aa"
};

const loaderBoxStyle = {
  padding: "36px 16px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  background: "#18181b",
  borderRadius: "16px",
  border: "1px solid rgba(255, 255, 255, 0.08)"
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
  padding: "12px 16px",
  background: "#18181b",
  borderRadius: "14px",
  border: "1px solid rgba(255, 255, 255, 0.08)"
};

const creatorSmallAvatarStyle = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  objectFit: "cover",
  border: "1.5px solid #00aff0",
  backgroundColor: "#27272a"
};

const networkAlertStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: "8px",
  padding: "10px 14px",
  borderRadius: "12px",
  border: "1px solid"
};

const transferDetailsBox = {
  background: "#18181b",
  border: "1px solid rgba(255, 255, 255, 0.08)",
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
  color: "#a1a1aa",
  letterSpacing: "0.5px"
};

const transferAmountStyle = {
  fontSize: "20px",
  fontWeight: "900",
  color: "#d4d4d8",
  marginTop: "2px"
};

const walletAddressStyle = {
  fontSize: "12px",
  color: "#d4d4d8",
  fontFamily: "monospace",
  wordBreak: "break-all",
  marginTop: "4px",
  lineHeight: "1.4"
};

const copyBtnStyle = {
  background: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "10px",
  padding: "8px 14px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  flexShrink: 0,
  transition: "all 0.15s ease"
};

const copyBtnSuccessStyle = {
  background: "rgba(16, 185, 129, 0.15)",
  border: "1px solid rgba(16, 185, 129, 0.35)",
  borderRadius: "10px",
  padding: "8px 14px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  flexShrink: 0
};

const openWalletBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  background: "#27272a",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  color: "#f4f4f5",
  borderRadius: "12px",
  padding: "12px 16px",
  fontSize: "13px",
  fontWeight: "700",
  textDecoration: "none",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
  transition: "all 0.15s ease"
};

const qrCardStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "10px",
  padding: "16px",
  background: "#18181b",
  borderRadius: "16px",
  border: "1px solid rgba(255, 255, 255, 0.08)"
};

const qrFrameStyle = {
  padding: "10px",
  background: "#ffffff",
  borderRadius: "16px",
  boxShadow: "0 8px 24px rgba(0, 0, 0, 0.35)",
  display: "inline-block"
};

const qrImageStyle = {
  width: "220px",
  height: "220px",
  display: "block"
};

const qrCaptionStyle = {
  fontSize: "11px",
  color: "#a1a1aa",
  textAlign: "center"
};

const radarContainerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "14px 16px",
  background: "rgba(16, 185, 129, 0.06)",
  border: "1px solid rgba(16, 185, 129, 0.2)",
  borderRadius: "14px"
};

const radarDotGlowStyle = {
  width: "24px",
  height: "24px",
  borderRadius: "50%",
  background: "rgba(16, 185, 129, 0.2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0
};

const radarDotStyle = {
  width: "10px",
  height: "10px",
  borderRadius: "50%",
  backgroundColor: "#10b981",
  boxShadow: "0 0 10px #10b981"
};

const radarSpinnerStyle = {
  width: "24px",
  height: "24px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0
};

const radarTitleStyle = {
  fontSize: "13px",
  fontWeight: "800",
  color: "#f4f4f5"
};

const radarSubtitleStyle = {
  fontSize: "11px",
  color: "#a1a1aa",
  marginTop: "2px"
};

const securityRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  fontSize: "11px",
  color: "#71717a"
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
  background: "rgba(225, 29, 72, 0.15)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "16px"
};

const successTitleStyle = { margin: "0 0 8px 0", fontSize: "20px", fontWeight: "900", color: "#d4d4d8" };
const successSubStyle = { margin: "0 0 20px 0", fontSize: "13px", color: "#8e8e93", lineHeight: "1.5", maxWidth: "360px" };

const successCreatorCardStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  background: "#1a1a1d",
  border: "1px solid rgba(225, 29, 72, 0.3)",
  borderRadius: "14px",
  padding: "12px 18px",
  marginBottom: "24px"
};

const doneBtnStyle = {
  width: "100%",
  background: "#e11d48",
  color: "#d4d4d8",
  border: "none",
  borderRadius: "14px",
  padding: "14px",
  fontWeight: "800",
  fontSize: "14px",
  cursor: "pointer",
  boxShadow: "0 6px 18px rgba(225, 29, 72, 0.3)"
};

const errorBannerStyle = {
  padding: "10px 14px",
  backgroundColor: "rgba(255, 59, 48, 0.15)",
  border: "1px solid rgba(255, 59, 48, 0.3)",
  borderRadius: "12px",
  color: "#ff3b30",
  fontSize: "12px"
};
