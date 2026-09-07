import React, { useState } from "react";
import { X, Heart, CheckCircle, DollarSign, Send, Loader2, Sparkles } from "lucide-react";
import { APP_CONFIG } from "../config";

const TIP_PRESETS = [
  { amount: 2000, label: "₦2,000 ($3)" },
  { amount: 5000, label: "₦5,000 ($7)" },
  { amount: 10000, label: "₦10,000 ($15)" },
  { amount: 25000, label: "₦25,000 ($35)" },
  { amount: 50000, label: "₦50,000 ($70)" }
];

export default function CreatorTipModal({ creator, onClose, onTipSuccess }) {
  const [selectedAmount, setSelectedAmount] = useState(5000);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const effectiveAmount = customAmount ? Number(customAmount) : selectedAmount;

  const handleSendTip = async (e) => {
    e.preventDefault();
    if (!effectiveAmount || effectiveAmount <= 0) {
      setError("Please select or enter a valid tip amount.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Please log in to send a tip.");

      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${creator.username}/tip`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          amount: effectiveAmount,
          message: message.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send tip");

      setSuccess(true);
      if (onTipSuccess) {
        onTipSuccess(effectiveAmount);
      }
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
        
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={heartIconStyle}>
              <Heart size={20} fill="#fff" color="#fff" />
            </div>
            <div>
              <h2 style={titleStyle}>Tip Creator</h2>
              <p style={subtitleStyle}>Support @{creator?.username || "creator"} directly</p>
            </div>
          </div>
          <button onClick={onClose} style={closeBtnStyle}>
            <X size={20} color="#888" />
          </button>
        </div>

        {success ? (
          <div style={successContainerStyle}>
            <div style={successIconStyle}>
              <Sparkles size={36} color="#00aff0" />
            </div>
            <h3 style={successTitleStyle}>Tip Sent Successfully!</h3>
            <p style={successSubStyle}>
              You sent <b>₦{effectiveAmount.toLocaleString()}</b> to {creator?.display_name || creator?.username}. Thank you for supporting creators!
            </p>
          </div>
        ) : (
          <form onSubmit={handleSendTip} style={formStyle}>
            {/* Creator Info Card */}
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

            {/* Quick Tip Chips */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Choose Tip Amount</label>
              <div style={presetGridStyle}>
                {TIP_PRESETS.map((p) => {
                  const isSelected = selectedAmount === p.amount && !customAmount;
                  return (
                    <button
                      type="button"
                      key={p.amount}
                      onClick={() => { setSelectedAmount(p.amount); setCustomAmount(""); }}
                      style={{
                        ...presetBtnStyle,
                        borderColor: isSelected ? "var(--primary-color)" : "#333",
                        background: isSelected ? "rgba(255, 59, 48, 0.15)" : "#1c1c1e",
                        color: isSelected ? "#fff" : "#ccc"
                      }}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Amount */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Or Enter Custom Amount (₦)</label>
              <div style={{ position: "relative" }}>
                <span style={currencySymbolStyle}>₦</span>
                <input
                  type="number"
                  min={500}
                  step={500}
                  placeholder="e.g. 15000"
                  value={customAmount}
                  onChange={(e) => { setCustomAmount(e.target.value); setSelectedAmount(0); }}
                  style={{ ...inputStyle, paddingLeft: "36px" }}
                />
              </div>
            </div>

            {/* Note/Message */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Message to Creator (Optional)</label>
              <textarea
                rows={2}
                maxLength={200}
                placeholder="Add a sweet message or compliment with your tip..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                style={textareaStyle}
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading || !effectiveAmount}
              style={submitBtnStyle}
            >
              {isLoading ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Processing Tip...</span>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                  <Send size={18} />
                  <span>Send ₦{effectiveAmount ? effectiveAmount.toLocaleString() : "0"} Tip</span>
                </div>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

// 🖌 Styles
const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 100000,
  backgroundColor: "rgba(0, 0, 0, 0.85)",
  backdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px"
};

const modalBoxStyle = {
  backgroundColor: "#121214",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "24px",
  width: "100%",
  maxWidth: "460px",
  maxHeight: "90vh",
  overflowY: "auto",
  boxShadow: "0 20px 50px rgba(0, 0, 0, 0.9)",
  display: "flex",
  flexDirection: "column",
  animation: "fadeInUp 0.3s ease-out"
};

const headerStyle = {
  padding: "18px 24px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between"
};

const heartIconStyle = {
  width: "38px",
  height: "38px",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #f91880, var(--primary-color))",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 4px 12px rgba(249, 24, 128, 0.4)"
};

const titleStyle = { margin: 0, fontSize: "17px", fontWeight: "800", color: "#fff" };
const subtitleStyle = { margin: "2px 0 0 0", fontSize: "12px", color: "#8e8e93" };
const closeBtnStyle = { background: "none", border: "none", cursor: "pointer", padding: "4px" };
const formStyle = { padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" };

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

const submitBtnStyle = {
  background: "linear-gradient(135deg, #f91880, var(--primary-color))",
  color: "#fff",
  border: "none",
  borderRadius: "14px",
  padding: "14px",
  fontWeight: "800",
  fontSize: "15px",
  cursor: "pointer",
  boxShadow: "0 6px 20px rgba(249, 24, 128, 0.35)",
  marginTop: "6px"
};

const errorBannerStyle = {
  padding: "10px 14px",
  backgroundColor: "rgba(255, 59, 48, 0.15)",
  border: "1px solid rgba(255, 59, 48, 0.3)",
  borderRadius: "10px",
  color: "#ff3b30",
  fontSize: "12px"
};

const successContainerStyle = {
  padding: "40px 24px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center"
};

const successIconStyle = {
  width: "64px",
  height: "64px",
  borderRadius: "50%",
  background: "rgba(0, 175, 240, 0.15)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "16px"
};

const successTitleStyle = { margin: "0 0 8px 0", fontSize: "18px", fontWeight: "800", color: "#fff" };
const successSubStyle = { margin: 0, fontSize: "13px", color: "#8e8e93", lineHeight: "1.5" };
