import React, { useState, useEffect } from "react";
import { 
  X, CheckCircle2, CreditCard, Bitcoin, Lock, Loader2, ArrowLeft, 
  Copy, QrCode, ShieldCheck, Wallet, UserX, AlertTriangle, ExternalLink 
} from "lucide-react";

// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../config";
import { showToast, promptLogin } from "../utils/toast";
import useModalHistory from "../hooks/useModalHistory";
import { getNetworkBadge, getWalletDeepLink, getQrData, formatCountdown } from "../utils/cryptoHelpers";

export default function PaywallModal({ onClose, user }) {
  const handleSafeClose = useModalHistory(true, onClose, "paywall");
  const [selectedMethod, setSelectedMethod] = useState(null); 
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [senderName, setSenderName] = useState("");
  
  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState(null); 
  const [timer, setTimer] = useState(600); 

  const [generatingCrypto, setGeneratingCrypto] = useState(false);
  const [cryptoPaymentDetails, setCryptoPaymentDetails] = useState(null);
  const [copiedField, setCopiedField] = useState(null); 
  const [pollingStatus, setPollingStatus] = useState("listening"); // "listening" | "confirming" | "success"
  const [countdown, setCountdown] = useState(1200); // 20 minutes rate lock

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!user || !user.id || !token) {
      promptLogin("subscribe");
      handleSafeClose();
    }
  }, [user, handleSafeClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  if (!user || !user.id || !localStorage.getItem("token")) {
    return null;
  }

  const handleMethodSelect = (method) => {
    const token = localStorage.getItem("token");
    if (!user || !user.id || !token) {
      promptLogin("subscribe");
      handleSafeClose();
      return;
    }
    setSelectedMethod(method);
  };

  useEffect(() => {
    let interval;
    if (verifying && timer > 0) {
      interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
    } else if (timer === 0 && verifying) {
      setVerifyStatus("timeout");
      setVerifying(false);
    }
    return () => clearInterval(interval);
  }, [verifying, timer]);

  // 20-minute countdown rate lock for crypto
  useEffect(() => {
    let timerId;
    if (cryptoPaymentDetails && countdown > 0 && pollingStatus !== "success" && verifyStatus !== "success") {
      timerId = setInterval(() => {
        setCountdown((prev) => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => clearInterval(timerId);
  }, [cryptoPaymentDetails, countdown, pollingStatus, verifyStatus]);

  // Continuous automatic blockchain polling (every 5 seconds)
  useEffect(() => {
    let cryptoInterval;
    
    if (cryptoPaymentDetails?.order_id && verifyStatus !== "success") {
      const checkStatus = async () => {
        try {
          const res = await fetch(`${APP_CONFIG.apiUrl}/api/crypto/status/${cryptoPaymentDetails.order_id}`);
          const data = await res.json();
          
          if (data.success) {
            const st = String(data.status || "").toUpperCase();
            if (st === "APPROVED" || st === "FINISHED" || st === "CONFIRMED") {
              setVerifyStatus("success");
              setPollingStatus("success");
              clearInterval(cryptoInterval);
              setTimeout(() => window.location.reload(), 2500);
            } else if (st === "WAITING" || st === "CONFIRMING" || st === "SENDING") {
              setPollingStatus("confirming");
            }
          }
        } catch (err) {
          console.error("Crypto polling error:", err);
        }
      };

      checkStatus();
      cryptoInterval = setInterval(checkStatus, 5000); 
    }
    return () => clearInterval(cryptoInterval);
  }, [cryptoPaymentDetails, verifyStatus]);

  const startVerification = async () => {
    if (!senderName.trim()) {
      showToast("Please enter the exact name you are sending from.", "error");
      return;
    }

    setVerifying(true);
    setVerifyStatus(null);
    let attempts = 0;
    const maxAttempts = 20; 

    const poll = async () => {
      if (attempts >= maxAttempts) return; 
      
      try {
        // 🟢 THE FIX: Dynamic API URL
        const res = await fetch(`${APP_CONFIG.apiUrl}/api/verify-payment`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({
            app_user_id: user?.id, 
            sender_name: senderName,
            amount: selectedPackage.price
          })
        });
        
        const data = await res.json();

        if (res.status === 400 || res.status === 500) {
           showToast(`Backend Error: ${data.error || data.message}`, "error");
           setVerifying(false);
           return; 
        }

        if (data.success) {
          setVerifyStatus("success");
          setVerifying(false);
          setTimeout(() => window.location.reload(), 3000);
        } else {
          attempts++;
          setTimeout(poll, 30000); 
        }
      } catch (err) {
        console.error("Polling error:", err);
        attempts++;
        setTimeout(poll, 30000);
      }
    };
    poll(); 
  };

  const generateCryptoAddress = async (coin) => {
    setGeneratingCrypto(true);
    setCountdown(1200);
    setPollingStatus("listening");
    try {
      // 🟢 Dynamic API URL
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/crypto/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          app_user_id: user?.id,
          amount_usd: selectedPackage.priceUsd, 
          crypto_currency: coin
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setCryptoPaymentDetails(data);
      } else {
        showToast(`Error: ${data.error || "Failed to initialize crypto address"}`, "error");
      }
    } catch (err) {
      showToast("Network error. Please try again.", "error");
    } finally {
      setGeneratingCrypto(false);
    }
  };

  const copyToClipboard = (text, field) => {
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2500);
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const resetState = () => {
    setSelectedMethod(null); 
    setSelectedPackage(null);
    setCryptoPaymentDetails(null);
    setPollingStatus("listening");
  };

  const networkInfo = cryptoPaymentDetails ? getNetworkBadge(cryptoPaymentDetails.pay_currency) : null;
  const walletDeepLink = cryptoPaymentDetails ? getWalletDeepLink(cryptoPaymentDetails.pay_currency, cryptoPaymentDetails.pay_address, cryptoPaymentDetails.pay_amount) : "#";
  const qrData = cryptoPaymentDetails ? getQrData(cryptoPaymentDetails.pay_currency, cryptoPaymentDetails.pay_address, cryptoPaymentDetails.pay_amount) : "";

  return (
    <div style={fullscreenContainerStyle}>
      {/* Instagram-style Top Navigation Bar */}
      <div style={topNavStyle}>
        <button 
          onClick={() => {
            if (cryptoPaymentDetails && verifyStatus !== "success") {
              setCryptoPaymentDetails(null);
            } else if (!verifying && verifyStatus !== "success" && selectedPackage) {
              setSelectedPackage(null);
            } else if (!verifying && verifyStatus !== "success" && selectedMethod) {
              resetState();
            } else if (!verifying) {
              handleSafeClose();
            }
          }} 
          style={navBackBtnStyle}
          aria-label="Back"
        >
          <ArrowLeft size={24} color="#fff" />
        </button>

        <span style={topNavTitleStyle}>
          {selectedPackage ? selectedPackage.label : "VIP Access Pass"}
        </span>

        <div style={{ width: "36px" }} />
      </div>

      <div style={scrollAreaStyle}>
        <div style={innerContentStyle}>
          {!selectedMethod && (
            <div style={centerFlexStyle}>
              <div style={headerStyle}>
                <div style={iconWrapperStyle}>
                  <Lock size={32} color="var(--primary-color)" />
                </div>
                <h2 style={titleStyle}>Unlock Premium</h2>
                <p style={subStyle}>Get full access to exclusive 4K shots and full-length homegrown content.</p>
              </div>

              <div style={benefitsListStyle}>
                <Benefit text="100% Ad-Free uninterrupted viewing." />
                <Benefit text="Exclusive 4K Ultra HD homegrown videos." />
                <Benefit text="Instant access to VIP Telegram Hub & leaks." />
                <Benefit text="Full-length uncensored drops & downloads." />
                <Benefit text="Priority creator direct chat access." />
              </div>

              <div style={actionColumnStyle}>
                <button onClick={() => handleMethodSelect('crypto')} style={payMethodCryptoBtnStyle}>
                  <Bitcoin size={20} color="#f59e0b" />
                  <span>Pay with Crypto</span>
                </button>

                <button onClick={() => handleMethodSelect('transfer')} style={payMethodTransferBtnStyle}>
                  <CreditCard size={20} color="#38bdf8" />
                  <span>Pay with Bank Transfer</span>
                </button>
              </div>
            </div>
          )}

          {selectedMethod && !selectedPackage && !verifying && !verifyStatus && (
            <div style={{ paddingTop: "20px" }}>
              <h2 style={{...titleStyle, fontSize: "20px", textAlign: "center", marginBottom: "20px"}}>Select a Package</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                {/* 🟢 THE FIX: Dynamic Packages from Config */}
                {APP_CONFIG.subscriptionPackages.map((pkg) => (
                  <button 
                    key={pkg.id} 
                    onClick={() => setSelectedPackage(pkg)}
                    style={packageCardStyle}
                  >
                    <span style={{ fontWeight: "700", color: "#fff" }}>{pkg.label}</span>
                    <span style={{ fontWeight: "900", color: "var(--primary-color)" }}>
                      {selectedMethod === 'crypto' ? pkg.textUsd : pkg.priceText}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {selectedMethod === 'transfer' && selectedPackage && !verifying && !verifyStatus && (
            <div style={transferDetailsBox}>
              <p style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#8e8e93" }}>Please transfer exactly <strong style={{color:"#fff"}}>{selectedPackage.priceText}</strong> to:</p>
              <div style={infoBoxStyle}>
                {/* 🟢 THE FIX: Dynamic Bank Details from Config */}
                <div><strong>Bank:</strong> {APP_CONFIG.bankDetails.bankName}</div>
                <div><strong>Account:</strong> <span style={{color: "var(--primary-color)", fontSize: "18px", letterSpacing: "1px"}}>{APP_CONFIG.bankDetails.accountNumber}</span></div>
                <div><strong>Name:</strong> {APP_CONFIG.bankDetails.accountName}</div>
              </div>

              <div style={{ marginTop: "20px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "#8e8e93", marginBottom: "5px" }}>SENDER NAME (Your Bank Account Name)</label>
                <input 
                  type="text" 
                  placeholder="e.g. John Doe" 
                  value={senderName}
                  onChange={(e) => setSenderName(e.target.value)}
                  style={inputStyle}
                />
              </div>

              <button onClick={startVerification} style={{...payButtonStyle, background: "var(--primary-color)", marginTop: "15px"}}>
                I Have Paid
              </button>
            </div>
          )}

          {/* STATE 3B: CRYPTO FLOW WITH GRID */}
          {selectedMethod === 'crypto' && selectedPackage && !cryptoPaymentDetails && !generatingCrypto && (
            <div style={transferDetailsBox}>
               <h3 style={{color: "#fff", textAlign: "center", marginBottom: "15px", marginTop: "0", fontSize: "18px"}}>Select Cryptocurrency</h3>
               
               <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                 {/* 🟢 Sleek dark buttons blending with modal aesthetics */}
                 {APP_CONFIG.cryptoOptions.map((coin) => (
                   <button 
                     key={coin.id}
                     onClick={() => generateCryptoAddress(coin.id)} 
                     style={{
                       ...cryptoGridButtonStyle, 
                       gridColumn: coin.span === 2 ? "span 2" : "auto"
                     }}
                   >
                     <span>{coin.label}</span>
                     <span style={cryptoCoinBadgeStyle}>{coin.badge || "CRYPTO"}</span>
                   </button>
                 ))}
               </div>
            </div>
          )}

          {generatingCrypto && (
             <div style={{ textAlign: "center", padding: "40px 10px", margin: "auto" }}>
                <Loader2 size={40} color="#f7931a" style={{ animation: "spin 1s linear infinite", margin: "0 auto 15px auto" }} />
                <h3 style={{color: "#fff"}}>Generating Secure Wallet...</h3>
                <p style={{color: "#8e8e93", fontSize: "14px"}}>Calculating real-time exchange rate.</p>
             </div>
          )}

          {/* HIGH-CONVERTING CRYPTO CHECKOUT CARD */}
          {cryptoPaymentDetails && verifyStatus !== "success" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Plan & Rate Lock Header */}
              <div style={invoiceHeaderCard}>
                <div>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    Selected Plan
                  </div>
                  <div style={{ fontSize: "16px", fontWeight: "900", color: "#fff" }}>
                    {selectedPackage?.label || "VIP Access Pass"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "11px", fontWeight: "700", color: "#a1a1aa" }}>
                    Rate Lock
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: "800", color: "#f59e0b", fontFamily: "monospace" }}>
                    ⏳ {formatCountdown(countdown)}
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
                      {cryptoPaymentDetails.pay_amount}{" "}
                      <span style={{ color: "#f7931a", fontSize: "14px", fontWeight: "800" }}>
                        {cryptoPaymentDetails.pay_currency?.toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(String(cryptoPaymentDetails.pay_amount), "amount")}
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
                      {cryptoPaymentDetails.pay_address}
                    </div>
                  </div>
                  <button 
                    onClick={() => copyToClipboard(cryptoPaymentDetails.pay_address, "address")}
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
                  <ExternalLink size={16} color="#fff" />
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
                    <Loader2 size={18} color="#f59e0b" style={{ animation: "spin 1.5s linear infinite" }} />
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
          )}

          {verifying && (
            <div style={{ textAlign: "center", padding: "40px 10px", margin: "auto" }}>
              <Loader2 size={48} color="var(--primary-color)" style={{ animation: "spin 1s linear infinite", margin: "0 auto 20px auto" }} />
              <h2 style={titleStyle}>Verifying Payment...</h2>
              <p style={subStyle}>Our AI is scanning the bank network. This usually takes 1 to 3 minutes.</p>
              <div style={{ fontSize: "24px", fontWeight: "900", color: "#fff", marginTop: "20px", fontFamily: "monospace" }}>
                {formatTime(timer)}
              </div>
              <p style={{ fontSize: "12px", color: "#ff3b30", marginTop: "15px" }}>Please do not close this window.</p>
            </div>
          )}

          {verifyStatus === "success" && (
            <div style={{ textAlign: "center", padding: "30px 10px", margin: "auto" }}>
              <CheckCircle2 size={64} color="#10b981" style={{ margin: "0 auto 20px auto" }} />
              <h2 style={titleStyle}>Payment Successful!</h2>
              <p style={subStyle}>Welcome to Premium. Refreshing your dashboard...</p>
            </div>
          )}

          {verifyStatus === "timeout" && (
            <div style={{ textAlign: "center", padding: "20px 10px", margin: "auto" }}>
              <h2 style={titleStyle}>Network Delay</h2>
              <p style={subStyle}>The bank network is a bit slow right now. If you have been debited, your transaction is safely logged.</p>
              <p style={{ fontSize: "13px", color: "#fff", marginTop: "15px", marginBottom: "20px", background: "rgba(255,255,255,0.05)", padding: "10px", borderRadius: "8px" }}>
                Send your receipt to our Admin on Telegram to instantly unlock your account.
              </p>
              {/* 🟢 THE FIX: Dynamic Support Link */}
              <button onClick={() => window.open(APP_CONFIG.supportTelegramLink, "_blank")} style={{...payButtonStyle, background: "#0088cc"}}>
                Contact Admin
              </button>
              <button onClick={onClose} style={{...payButtonStyle, background: "transparent", border: "1px solid #333", marginTop: "10px"}}>
                Close
              </button>
            </div>
          )}

          <div style={footerStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#8e8e93", fontSize: "12px" }}>
              <ShieldCheck size={14} color="#10b981" />
              <span style={{ fontWeight: "600" }}>256-bit Secure</span>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <CreditCard size={18} color="#666" />
              <Bitcoin size={18} color="#666" />
              <Wallet size={18} color="#666" />
            </div>
          </div>

          <style>{`
            @keyframes spin { 100% { transform: rotate(360deg); } }
            @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: transparent; }
            ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
          `}</style>
        </div>
      </div>
    </div>
  );
}

const Benefit = ({ text }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
    <CheckCircle2 size={18} color="var(--primary-color)" />
    <span style={{ fontSize: "14px", color: "#ddd", fontWeight: "500" }}>{text}</span>
  </div>
);

// 🖌 UI STYLES
const fullscreenContainerStyle = {
  position: "fixed",
  inset: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "#09090b",
  zIndex: 1000040,
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
  padding: "24px 16px 40px",
  boxSizing: "border-box"
};

const innerContentStyle = {
  width: "100%",
  maxWidth: "460px",
  display: "flex",
  flexDirection: "column",
  flex: 1
};

const centerFlexStyle = { display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" };
const footerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "20px", marginTop: "30px", borderTop: "1px solid rgba(255,255,255,0.08)", flexShrink: 0 };

const headerStyle = { textAlign: "center", marginBottom: "25px" };
const iconWrapperStyle = { width: "64px", height: "64px", borderRadius: "50%", background: "rgba(255, 59, 48, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 15px auto" };
const titleStyle = { fontSize: "24px", fontWeight: "900", color: "#fff", margin: "0 0 10px 0" };
const subStyle = { fontSize: "14px", color: "#8e8e93", lineHeight: "1.5", margin: 0 };
const benefitsListStyle = { marginBottom: "25px", padding: "0 10px" };
const actionColumnStyle = { display: "flex", flexDirection: "column", gap: "12px", marginTop: "auto" };
const payButtonStyle = { display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", width: "100%", padding: "16px", borderRadius: "14px", color: "#fff", border: "none", fontSize: "16px", fontWeight: "800", cursor: "pointer", transition: "transform 0.2s" };

const packageCardStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)", cursor: "pointer", transition: "all 0.2s" };
const transferDetailsBox = { background: "#18181b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "16px", padding: "16px", boxSizing: "border-box", animation: "fadeInUp 0.3s ease-out" };
const infoBoxStyle = { background: "rgba(0,0,0,0.3)", padding: "15px", borderRadius: "10px", fontSize: "14px", color: "#ccc", display: "flex", flexDirection: "column", gap: "8px", fontFamily: "monospace" };
const inputStyle = { width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: "16px", outline: "none", boxSizing: "border-box" };

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

const cryptoGridButtonStyle = {
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

const payMethodCryptoBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  width: "100%",
  padding: "15px",
  borderRadius: "14px",
  background: "#202024",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  color: "#f4f4f5",
  fontSize: "15px",
  fontWeight: "800",
  cursor: "pointer",
  transition: "all 0.15s ease",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)"
};

const payMethodTransferBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  width: "100%",
  padding: "15px",
  borderRadius: "14px",
  background: "#202024",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  color: "#f4f4f5",
  fontSize: "15px",
  fontWeight: "800",
  cursor: "pointer",
  transition: "all 0.15s ease",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)"
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

const networkAlertStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: "8px",
  padding: "10px 14px",
  borderRadius: "12px",
  border: "1px solid"
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