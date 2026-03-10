import React, { useState, useEffect } from "react";
import { X, CheckCircle2, CreditCard, Bitcoin, Lock, Loader2, ArrowLeft } from "lucide-react";

const PACKAGES = [
  { id: '1_month', label: '1 Month', price: 15000, priceText: '₦15,000' },
  { id: '2_months', label: '2 Months', price: 25000, priceText: '₦25,000' },
  { id: '1_year', label: '1 Year', price: 125000, priceText: '₦125,000' }
];

// 🟢 Add your actual bank details here
const BANK_DETAILS = {
  bankName: "MonniePoint",
  accountNumber: "8138617303",
  accountName: "Okonkwo Chukwunonso"
};

export default function PaywallModal({ onClose, user }) {
  const [selectedMethod, setSelectedMethod] = useState(null); // 'transfer' or 'crypto'
  const [selectedPackage, setSelectedPackage] = useState(null);
  const [senderName, setSenderName] = useState("");
  
  // Polling States
  const [verifying, setVerifying] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState(null); // 'success' or 'timeout'
  const [timer, setTimer] = useState(600); // 10 minutes in seconds

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Countdown Timer for the Polling Screen
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

  // 🟢 The Polling Engine (Fires every 15 seconds)
  const startVerification = async () => {
    if (!senderName.trim()) {
      alert("Please enter the exact name you are sending from.");
      return;
    }

    setVerifying(true);
    setVerifyStatus(null);
    let attempts = 0;
    const maxAttempts = 40; // 40 attempts * 15s = 10 minutes

    const poll = async () => {
      if (attempts >= maxAttempts) return; // Handled by the countdown timer
      
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

        if (data.success) {
          setVerifyStatus("success");
          setVerifying(false);
          // Auto-refresh after 3 seconds to unlock premium content!
          setTimeout(() => window.location.reload(), 3000);
        } else if (data.status === 'pending') {
          attempts++;
          setTimeout(poll, 30000); // Wait 15 seconds and ask Python again
        } else {
          // Fallback for unexpected errors
          attempts++;
          setTimeout(poll, 30000);
        }
      } catch (err) {
        console.error("Polling error:", err);
        attempts++;
        setTimeout(poll, 30000);
      }
    };

    poll(); // Start the loop!
  };

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        {/* Back / Close Buttons */}
        {!verifying && verifyStatus !== "success" && (
          selectedMethod ? (
            <button onClick={() => { setSelectedMethod(null); setSelectedPackage(null); }} style={backButtonStyle}>
              <ArrowLeft size={20} color="#fff" />
            </button>
          ) : (
            <button onClick={onClose} style={closeButtonStyle}>
              <X size={24} color="#fff" />
            </button>
          )
        )}

        {/* ---------------------------
            STATE 1: INITIAL SELECTION 
            --------------------------- */}
        {!selectedMethod && (
          <>
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

              <button onClick={() => alert("Crypto payments coming soon!")} style={{...payButtonStyle, background: "#1a1a1a", border: "1px solid #333"}}>
                <Bitcoin size={20} color="#f7931a" />
                Pay with Crypto
              </button>
            </div>
          </>
        )}

        {/* ---------------------------
            STATE 2: PACKAGE & TRANSFER 
            --------------------------- */}
        {selectedMethod === 'transfer' && !verifying && !verifyStatus && (
          <>
            <h2 style={{...titleStyle, fontSize: "20px", textAlign: "center", marginBottom: "20px"}}>Select a Package</h2>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
              {PACKAGES.map((pkg) => (
                <button 
                  key={pkg.id} 
                  onClick={() => setSelectedPackage(pkg)}
                  style={{
                    ...packageCardStyle, 
                    borderColor: selectedPackage?.id === pkg.id ? "var(--primary-color)" : "rgba(255,255,255,0.1)",
                    background: selectedPackage?.id === pkg.id ? "rgba(255, 59, 48, 0.05)" : "transparent"
                  }}
                >
                  <span style={{ fontWeight: "700", color: "#fff" }}>{pkg.label}</span>
                  <span style={{ fontWeight: "900", color: "var(--primary-color)" }}>{pkg.priceText}</span>
                </button>
              ))}
            </div>

            {selectedPackage && (
              <div style={transferDetailsBox}>
                <p style={{ margin: "0 0 10px 0", fontSize: "14px", color: "#8e8e93" }}>Please transfer exactly <strong style={{color:"#fff"}}>{selectedPackage.priceText}</strong> to:</p>
                <div style={bankInfoStyle}>
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
          </>
        )}

        {/* ---------------------------
            STATE 3: POLLING SPINNER 
            --------------------------- */}
        {verifying && (
          <div style={{ textAlign: "center", padding: "40px 10px" }}>
            <Loader2 size={48} color="var(--primary-color)" style={{ animation: "spin 1s linear infinite", margin: "0 auto 20px auto" }} />
            <h2 style={titleStyle}>Verifying Payment...</h2>
            <p style={subStyle}>Our AI is scanning the bank network. This usually takes 1 to 3 minutes.</p>
            <div style={{ fontSize: "24px", fontWeight: "900", color: "#fff", marginTop: "20px", fontFamily: "monospace" }}>
              {formatTime(timer)}
            </div>
            <p style={{ fontSize: "12px", color: "#ff3b30", marginTop: "15px" }}>Please do not close this window.</p>
          </div>
        )}

        {/* ---------------------------
            STATE 4: SUCCESS / TIMEOUT 
            --------------------------- */}
        {verifyStatus === "success" && (
          <div style={{ textAlign: "center", padding: "30px 10px" }}>
            <CheckCircle2 size={64} color="#34C759" style={{ margin: "0 auto 20px auto" }} />
            <h2 style={titleStyle}>Payment Successful!</h2>
            <p style={subStyle}>Welcome to Premium. Refreshing your dashboard...</p>
          </div>
        )}

        {verifyStatus === "timeout" && (
          <div style={{ textAlign: "center", padding: "20px 10px" }}>
            <h2 style={titleStyle}>Network Delay</h2>
            <p style={subStyle}>The bank network is a bit slow right now, but don't worry! If you have been debited, your transaction is safely logged.</p>
            <p style={{ fontSize: "14px", color: "#fff", marginTop: "15px", marginBottom: "20px", background: "rgba(255,255,255,0.05)", padding: "10px", borderRadius: "8px" }}>
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

        <style>{`
          @keyframes spin { 100% { transform: rotate(360deg); } }
          @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
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

// 🖌 STYLES
const overlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 99999, padding: "20px" };
const modalStyle = { background: "#0B0F1A", border: "1px solid var(--border-color)", borderRadius: "24px", padding: "30px 20px", width: "100%", maxWidth: "400px", maxHeight: "90vh", overflowY: "auto", position: "relative", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", animation: "fadeInUp 0.3s ease-out" };
const closeButtonStyle = { position: "absolute", top: "15px", right: "15px", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const backButtonStyle = { ...closeButtonStyle, left: "15px", right: "auto" };
const headerStyle = { textAlign: "center", marginBottom: "30px", marginTop: "10px" };
const iconWrapperStyle = { width: "64px", height: "64px", borderRadius: "50%", background: "rgba(255, 59, 48, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 15px auto" };
const titleStyle = { fontSize: "24px", fontWeight: "900", color: "#fff", margin: "0 0 10px 0" };
const subStyle = { fontSize: "14px", color: "#8e8e93", lineHeight: "1.5", margin: 0 };
const benefitsListStyle = { marginBottom: "30px", padding: "0 10px" };
const actionColumnStyle = { display: "flex", flexDirection: "column", gap: "12px" };
const payButtonStyle = { display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", width: "100%", padding: "16px", borderRadius: "14px", color: "#fff", border: "none", fontSize: "16px", fontWeight: "800", cursor: "pointer", transition: "transform 0.2s" };

const packageCardStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderRadius: "12px", border: "2px solid", cursor: "pointer", transition: "all 0.2s" };
const transferDetailsBox = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", padding: "20px", marginTop: "10px", animation: "fadeInUp 0.3s ease-out" };
const bankInfoStyle = { background: "rgba(0,0,0,0.3)", padding: "15px", borderRadius: "10px", fontSize: "14px", color: "#ccc", display: "flex", flexDirection: "column", gap: "8px", fontFamily: "monospace" };
const inputStyle = { width: "100%", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255,255,255,0.1)", background: "rgba(0,0,0,0.5)", color: "#fff", fontSize: "16px", outline: "none", boxSizing: "border-box" };