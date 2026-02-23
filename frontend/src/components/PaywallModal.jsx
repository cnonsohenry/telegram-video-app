import React, { useState } from "react";
import { X, CheckCircle2, CreditCard, Bitcoin, Lock } from "lucide-react";

export default function PaywallModal({ onClose, user }) {
  const [loading, setLoading] = useState(false);

  // 🟢 1. Local Fiat Payment (Paystack)
  const handleFiatPayment = async () => {
    setLoading(true);
    try {
      // We will create this backend route next. It generates a Paystack link.
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/pay/fiat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${localStorage.getItem("token")}`
        }
      });
      const data = await res.json();
      
      if (data.authorization_url) {
        window.location.href = data.authorization_url; // Redirect to Paystack
      } else {
        alert("Payment initialization failed.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error.");
    } finally {
      setLoading(false);
    }
  };

  // 🟢 2. Crypto Payment (Direct Wallet or NowPayments)
  const handleCryptoPayment = () => {
    // You can redirect to a Crypto gateway or show a wallet address
    alert("Crypto payments coming in the next step!");
  };

  return (
    <div style={overlayStyle}>
      <div style={modalStyle}>
        <button onClick={onClose} style={closeButtonStyle}>
          <X size={24} color="#fff" />
        </button>

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
          <Benefit text="Cancel anytime." />
        </div>

        <div style={pricingBoxStyle}>
          <span style={priceStyle}>₦5,000</span>
          <span style={durationStyle}>/ month</span>
        </div>

        <div style={actionColumnStyle}>
          <button 
            onClick={handleFiatPayment} 
            disabled={loading}
            style={{...payButtonStyle, background: "var(--primary-color)"}}
          >
            <CreditCard size={20} />
            {loading ? "Processing..." : "Pay with Card / Transfer"}
          </button>

          <button 
            onClick={handleCryptoPayment} 
            style={{...payButtonStyle, background: "#1a1a1a", border: "1px solid #333"}}
          >
            <Bitcoin size={20} color="#f7931a" />
            Pay with Crypto
          </button>
        </div>
        
        <p style={footerTextStyle}>Secure payments. Instant access.</p>
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
const modalStyle = { background: "#0B0F1A", border: "1px solid var(--border-color)", borderRadius: "24px", padding: "30px 20px", width: "100%", maxWidth: "400px", position: "relative", boxShadow: "0 25px 50px -12px rgba(0,0,0,0.5)", animation: "fadeInUp 0.3s ease-out" };
const closeButtonStyle = { position: "absolute", top: "15px", right: "15px", background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };
const headerStyle = { textAlign: "center", marginBottom: "30px", marginTop: "10px" };
const iconWrapperStyle = { width: "64px", height: "64px", borderRadius: "50%", background: "rgba(255, 59, 48, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 15px auto" };
const titleStyle = { fontSize: "24px", fontWeight: "900", color: "#fff", margin: "0 0 10px 0" };
const subStyle = { fontSize: "14px", color: "#8e8e93", lineHeight: "1.5", margin: 0 };
const benefitsListStyle = { marginBottom: "30px", padding: "0 10px" };
const pricingBoxStyle = { textAlign: "center", marginBottom: "30px", padding: "20px", background: "rgba(255,255,255,0.03)", borderRadius: "16px", border: "1px solid rgba(255,255,255,0.05)" };
const priceStyle = { fontSize: "36px", fontWeight: "900", color: "#fff" };
const durationStyle = { fontSize: "16px", color: "#8e8e93", fontWeight: "500" };
const actionColumnStyle = { display: "flex", flexDirection: "column", gap: "12px" };
const payButtonStyle = { display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", width: "100%", padding: "16px", borderRadius: "14px", color: "#fff", border: "none", fontSize: "16px", fontWeight: "800", cursor: "pointer", transition: "transform 0.2s" };
const footerTextStyle = { textAlign: "center", fontSize: "12px", color: "#666", marginTop: "20px", fontWeight: "500" };