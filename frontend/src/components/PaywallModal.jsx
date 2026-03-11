import React, { useState, useEffect } from "react";
import { X, CheckCircle2, CreditCard, Bitcoin, Lock, Loader2, ArrowLeft, Copy, QrCode, ShieldCheck, Wallet } from "lucide-react";

const PACKAGES = [
  { id: '1_month', label: '1 Month', price: 15000, priceText: '₦15,000' },
  { id: '2_months', label: '2 Months', price: 25000, priceText: '₦25,000' },
  { id: '1_year', label: '1 Year', price: 125000, priceText: '₦125,000' }
];

const BANK_DETAILS = {
  bankName: "Moniepoint",
  accountNumber: "8138617303",
  accountName: "Okonkwo Chukwunonso"
};

export default function PaywallModal({ onClose, user }) {
  const [selectedMethod, setSelectedMethod] = useState(null); 
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [senderName, setSenderName] = useState("");
  
  // Fiat Polling States
  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState(null); 
  const [timer, setTimer] = useState(600); 

  // Crypto States
  const [generatingCrypto, setGeneratingCrypto] = useState(false);
  const [cryptoPaymentDetails, setCryptoPaymentDetails] = useState(null);
  const [copiedField, setCopiedField] = useState(null); 

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

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

  // ==========================================
  // BANK TRANSFER POLLING ENGINE
  // ==========================================
  const startVerification = async () => {
    if (!senderName.trim()) {
      alert("Please enter the exact name you are sending from.");
      return;
    }

    setVerifying(true);
    setVerifyStatus(null);
    let attempts = 0;
    const maxAttempts = 20; 

    const poll = async () => {
      if (attempts >= maxAttempts) return; 
      
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/verify-payment`, {
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
           alert(`Backend Error: ${data.error || data.message}`);
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

  // ==========================================
  // CRYPTO GENERATION ENGINE
  // ==========================================
  const generateCryptoAddress = async (coin) => {
    setGeneratingCrypto(true);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/crypto/create`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          app_user_id: user?.id,
          amount_ngn: selectedPackage.price,
          crypto_currency: coin
        })
      });
      
      const data = await res.json();
      
      if (data.success) {
        setCryptoPaymentDetails(data);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      alert("Network error. Please try again.");
    } finally {
      setGeneratingCrypto(false);
    }
  };

  const copyToClipboard = (text, field) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
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
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        
        {/* === TOP ACTION BAR === */}
        <div style={topBarStyle}>
          {!verifying && verifyStatus !== "success" && selectedMethod && (
            <button onClick={resetState} style={iconButtonStyle}>
              <ArrowLeft size={20} color="#fff" />
            </button>
          )}
          <div style={{ flex: 1 }}></div>
          {!verifying && verifyStatus !== "success" && (
            <button onClick={onClose} style={iconButtonStyle}>
              <X size={20} color="#fff" />
            </button>
          )}
        </div>

        {/* === SCROLLABLE CONTENT AREA === */}
        <div style={contentContainerStyle}>
          
          {/* STATE 1: INITIAL SELECTION */}
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
                <Benefit text="No ads, ever." />
                <Benefit text="Access to the VIP Telegram Hub." />
                <Benefit text="Full-length uncensored videos." />
              </div>

              <div style={actionColumnStyle}>
                <button onClick={() => setSelectedMethod('transfer')} style={{...payButtonStyle, background: "var(--primary-color)"}}>
                  <CreditCard size={20} />
                  Pay with Bank Transfer
                </button>

                <button onClick={() => setSelectedMethod('crypto')} style={{...payButtonStyle, background: "#1a1a1a", border: "1px solid #333"}}>
                  <Bitcoin size={20} color="#f7931a" />
                  Pay with Crypto
                </button>
              </div>
            </div>
          )}

          {/* STATE 2: PACKAGE SELECTION */}
          {selectedMethod && !selectedPackage && !verifying && !verifyStatus && (
            <div style={{ paddingTop: "20px" }}>
              <h2 style={{...titleStyle, fontSize: "20px", textAlign: "center", marginBottom: "20px"}}>Select a Package</h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                {PACKAGES.map((pkg) => (
                  <button 
                    key={pkg.id} 
                    onClick={() => setSelectedPackage(pkg)}
                    style={packageCardStyle}
                  >
                    <span style={{ fontWeight: "700", color: "#fff" }}>{pkg.label}</span>
                    <span style={{ fontWeight: "900", color: "var(--primary-color)" }}>{pkg.priceText}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STATE 3A: BANK TRANSFER FLOW */}
          {selectedMethod === 'transfer' && selectedPackage && !verifying && !verifyStatus && (
            <div style={transferDetailsBox}>
              <p style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#8e8e93" }}>Please transfer exactly <strong style={{color:"#fff"}}>{selectedPackage.priceText}</strong> to:</p>
              <div style={infoBoxStyle}>
                <div><strong>Bank:</strong> {BANK_DETAILS.bankName}</div>
                <div><strong>Account:</strong> <span style={{color: "var(--primary-color)", fontSize: "18px", letterSpacing: "1px"}}>{BANK_DETAILS.accountNumber}</span></div>
                <div><strong>Name:</strong> {BANK_DETAILS.accountName}</div>
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

          {/* STATE 3B: CRYPTO FLOW */}
          {selectedMethod === 'crypto' && selectedPackage && !cryptoPaymentDetails && !generatingCrypto && (
            <div style={transferDetailsBox}>
               <h3 style={{color: "#fff", textAlign: "center", marginBottom: "15px", marginTop: "0"}}>Select Cryptocurrency</h3>
               <button onClick={() => generateCryptoAddress('usdttrc20')} style={{...payButtonStyle, background: "#26A17B", marginBottom: "10px"}}>
                  USDT (TRC-20 Network)
               </button>
               <button onClick={() => generateCryptoAddress('btc')} style={{...payButtonStyle, background: "#F7931A"}}>
                  Bitcoin (BTC)
               </button>
            </div>
          )}

          {generatingCrypto && (
             <div style={{ textAlign: "center", padding: "40px 10px", margin: "auto" }}>
                <Loader2 size={40} color="#f7931a" style={{ animation: "spin 1s linear infinite", margin: "0 auto 15px auto" }} />
                <h3 style={{color: "#fff"}}>Generating Secure Wallet...</h3>
                <p style={{color: "#8e8e93", fontSize: "14px"}}>Calculating real-time exchange rate.</p>
             </div>
          )}

          {cryptoPaymentDetails && (
            <div style={{...transferDetailsBox, padding: "15px"}}>
              <div style={{ textAlign: "center", marginBottom: "10px" }}>
                <QrCode size={24} color="#8e8e93" style={{marginBottom: "5px"}}/>
                <p style={{ margin: "0", fontSize: "13px", color: "#8e8e93" }}>Send exactly the amount below.</p>
              </div>

              <div style={{...infoBoxStyle, padding: "12px"}}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)", paddingBottom: "10px", marginBottom: "10px" }}>
                  <div>
                    <div style={{fontSize: "11px", color: "#8e8e93"}}>AMOUNT TO SEND</div>
                    <div style={{fontSize: "18px", fontWeight: "bold", color: "#fff"}}>
                      {cryptoPaymentDetails.pay_amount} <span style={{fontSize: "13px", color: "#f7931a"}}>{cryptoPaymentDetails.pay_currency.toUpperCase()}</span>
                    </div>
                  </div>
                  <button onClick={() => copyToClipboard(cryptoPaymentDetails.pay_amount, 'amount')} style={copyBtnStyle}>
                    {copiedField === 'amount' ? <CheckCircle2 size={16} color="#34C759"/> : <Copy size={16} color="#fff"/>}
                  </button>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ overflow: "hidden", paddingRight: "10px" }}>
                    <div style={{fontSize: "11px", color: "#8e8e93"}}>WALLET ADDRESS</div>
                    <div style={{fontSize: "12px", color: "#fff", wordBreak: "break-all", fontFamily: "monospace", marginTop: "3px"}}>
                      {cryptoPaymentDetails.pay_address}
                    </div>
                  </div>
                  <button onClick={() => copyToClipboard(cryptoPaymentDetails.pay_address, 'address')} style={{...copyBtnStyle, flexShrink: 0}}>
                    {copiedField === 'address' ? <CheckCircle2 size={16} color="#34C759"/> : <Copy size={16} color="#fff"/>}
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "center", margin: "15px 0" }}>
                 <img 
                   src={`https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${cryptoPaymentDetails.pay_address}&bgcolor=ffffff`} 
                   alt="Crypto QR Code" 
                   style={{ borderRadius: "10px", padding: "5px", background: "#fff", width: "130px", height: "130px" }}
                 />
              </div>

              <div style={{ background: "rgba(247, 147, 26, 0.1)", border: "1px solid rgba(247, 147, 26, 0.2)", padding: "10px", borderRadius: "10px", fontSize: "12px", color: "#f7931a", textAlign: "center", lineHeight: "1.4" }}>
                 Crypto takes 5-15 mins to confirm. You can close this window after sending.
              </div>
            </div>
          )}

          {/* STATE 4: POLLING / SUCCESS / TIMEOUT */}
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
              <CheckCircle2 size={64} color="#34C759" style={{ margin: "0 auto 20px auto" }} />
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
              <button onClick={() => window.open("https://t.me/NaijaHomemade", "_blank")} style={{...payButtonStyle, background: "#0088cc"}}>
                Contact Admin
              </button>
              <button onClick={onClose} style={{...payButtonStyle, background: "transparent", border: "1px solid #333", marginTop: "10px"}}>
                Close
              </button>
            </div>
          )}
        </div>

        {/* === ANCHORED FOOTER === */}
        <div style={footerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#8e8e93", fontSize: "12px" }}>
            <ShieldCheck size={14} color="#34C759" />
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
          /* Custom scrollbar for webkit browsers to keep it clean */
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        `}</style>
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
const overlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: "20px" };

// 🟢 FIX: The Modal is now a strict Flexbox with a locked maximum height of 650px.
const modalStyle = { background: "#0B0F1A", border: "1px solid var(--border-color)", borderRadius: "24px", width: "100%", maxWidth: "400px", height: "90vh", maxHeight: "650px", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", animation: "fadeInUp 0.3s ease-out", padding: "20px" };

const topBarStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexShrink: 0 };
const iconButtonStyle = { background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 };

// 🟢 FIX: The content area stretches to fill the space and scrolls internally if content overflows
const contentContainerStyle = { flex: 1, overflowY: "auto", overflowX: "hidden", paddingRight: "5px", display: "flex", flexDirection: "column" };
const centerFlexStyle = { display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" };

// 🟢 FIX: The anchored footer sits permanently at the bottom
const footerStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "15px", marginTop: "15px", borderTop: "1px solid rgba(255,255,255,0.05)", flexShrink: 0 };

const headerStyle = { textAlign: "center", marginBottom: "25px" };
const iconWrapperStyle = { width: "64px", height: "64px", borderRadius: "50%", background: "rgba(255, 59, 48, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 15px auto" };
const titleStyle = { fontSize: "24px", fontWeight: "900", color: "#fff", margin: "0 0 10px 0" };
const subStyle = { fontSize: "14px", color: "#8e8e93", lineHeight: "1.5", margin: 0 };
const benefitsListStyle = { marginBottom: "25px", padding: "0 10px" };
const actionColumnStyle = { display: "flex", flexDirection: "column", gap: "12px", marginTop: "auto" };
const payButtonStyle = { display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", width: "100%", padding: "16px", borderRadius: "14px", color: "#fff", border: "none", fontSize: "16px", fontWeight: "800", cursor: "pointer", transition: "transform 0.2s" };

const packageCardStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderRadius: "12px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.02)", cursor: "pointer", transition: "all 0.2s" };
const transferDetailsBox = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", padding: "20px", animation: "fadeInUp 0.3s ease-out", flex: 1 };
const infoBoxStyle = { background: "rgba(0,0,0,0.3)", padding: "15px", borderRadius: "10px", fontSize: "14px", color: "#ccc", display: "flex", flexDirection: "column", gap: "8px", fontFamily: "monospace" };
const inputStyle = { width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: "16px", outline: "none", boxSizing: "border-box" };
const copyBtnStyle = { background: "rgba(255,255,255,0.1)", border: "none", padding: "8px", borderRadius: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };