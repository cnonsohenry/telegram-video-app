import React, { useState } from "react";
import { X, Camera, Image, Check, Loader2, Globe, MapPin } from "lucide-react";
import { APP_CONFIG } from "../config";

const BANNER_PRESETS = [
  { label: "Luxury Noir", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80" },
  { label: "Neon Glow", url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1200&q=80" },
  { label: "Sunset Gold", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80" },
  { label: "Cyber Velvet", url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80" }
];

export default function EditProfileModal({ user, onClose, onUpdateSuccess }) {
  const [displayName, setDisplayName] = useState(user?.display_name || user?.username || "");
  const [bio, setBio] = useState(user?.creator_bio || "");
  const [category, setCategory] = useState(user?.creator_category || "Model & Creator");
  const [subscriptionPrice, setSubscriptionPrice] = useState(user?.subscription_price ? String(user.subscription_price) : "0");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [bannerUrl, setBannerUrl] = useState(user?.banner_url || BANNER_PRESETS[0].url);
  const [customBanner, setCustomBanner] = useState("");
  const [location, setLocation] = useState(user?.location || "");
  const [website, setWebsite] = useState(user?.website || "");
  const [twitter, setTwitter] = useState(user?.social_links?.twitter || "");
  const [instagram, setInstagram] = useState(user?.social_links?.instagram || "");
  const [telegram, setTelegram] = useState(user?.social_links?.telegram || "");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authentication required");

      const finalBanner = customBanner.trim() ? customBanner.trim() : bannerUrl;

      const payload = {
        display_name: displayName.trim(),
        creator_bio: bio.trim(),
        creator_category: category.trim(),
        subscription_price: Number(subscriptionPrice) || 0,
        avatar_url: avatarUrl.trim() || undefined,
        banner_url: finalBanner,
        location: location.trim(),
        website: website.trim(),
        social_links: {
          twitter: twitter.trim(),
          instagram: instagram.trim(),
          telegram: telegram.trim()
        }
      };

      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update profile");

      if (onUpdateSuccess) {
        onUpdateSuccess(data.user);
      }
      onClose();
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
          <h2 style={titleStyle}>Edit Profile</h2>
          <button onClick={onClose} style={closeBtnStyle}>
            <X size={20} color="#888" />
          </button>
        </div>

        {error && (
          <div style={errorBannerStyle}>
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} style={formStyle}>
          
          {/* Profile Picture Avatar (Instagram Style at Top) */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: "20px" }}>
            <div style={{
              padding: "3px",
              borderRadius: "50%",
              background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
              display: "inline-block",
              marginBottom: "8px"
            }}>
              <img 
                src={avatarUrl || user?.avatar_url || "/assets/default-avatar.png"} 
                alt="Avatar preview" 
                style={{
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid #16181c",
                  display: "block"
                }}
                onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
              />
            </div>
            <input
              type="url"
              placeholder="Paste new photo URL (https://...)"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              style={{ ...inputStyle, width: "100%", maxWidth: "340px", fontSize: "12px", textAlign: "center" }}
            />
          </div>

          {/* Display Name */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Display Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Sophia Luxury"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Bio */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Bio</label>
            <textarea
              rows={3}
              maxLength={400}
              placeholder="Tell fans about yourself..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={textareaStyle}
            />
            <span style={characterCountStyle}>{bio.length}/400</span>
          </div>

          {/* Category */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Category / Niche</label>
            <input
              type="text"
              placeholder="e.g. Model & Glamour, VIP, Fitness"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Monthly Price (for creators) */}
          {user?.is_creator && (
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Monthly Subscription Price (₦)</label>
              <input
                type="number"
                min={0}
                step={500}
                placeholder="15000"
                value={subscriptionPrice}
                onChange={(e) => setSubscriptionPrice(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          {/* Location & Website */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Location</label>
              <input
                type="text"
                placeholder="e.g. Lagos, Nigeria"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Website Link</label>
              <input
                type="url"
                placeholder="https://..."
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Social Links */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Social Handles</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <input
                type="text"
                placeholder="Instagram username"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                style={inputStyle}
              />
              <input
                type="text"
                placeholder="Twitter / X username"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                style={inputStyle}
              />
              <input
                type="text"
                placeholder="Telegram username"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isLoading}
            style={submitBtnStyle}
          >
            {isLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                <Loader2 size={18} className="animate-spin" />
                <span>Saving Changes...</span>
              </div>
            ) : (
              <span>Save Profile</span>
            )}
          </button>
        </form>
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
  maxWidth: "500px",
  maxHeight: "90vh",
  overflowY: "auto",
  boxShadow: "0 20px 50px rgba(0, 0, 0, 0.9)",
  display: "flex",
  flexDirection: "column",
  animation: "fadeInUp 0.3s ease-out"
};

const headerStyle = {
  padding: "20px 24px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  position: "sticky",
  top: 0,
  backgroundColor: "#121214",
  zIndex: 10
};

const titleStyle = { margin: 0, fontSize: "18px", fontWeight: "800", color: "#fff" };
const closeBtnStyle = { background: "none", border: "none", cursor: "pointer", padding: "4px" };
const formStyle = { padding: "20px 24px", display: "flex", flexDirection: "column", gap: "16px" };
const fieldGroupStyle = { display: "flex", flexDirection: "column", gap: "6px" };
const labelStyle = { fontSize: "13px", fontWeight: "700", color: "#e5e5ea" };
const inputStyle = { width: "100%", background: "#1c1c1e", border: "1px solid #333", borderRadius: "12px", padding: "12px 14px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" };
const textareaStyle = { width: "100%", background: "#1c1c1e", border: "1px solid #333", borderRadius: "12px", padding: "12px 14px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box", resize: "none" };
const characterCountStyle = { fontSize: "11px", color: "#666", alignSelf: "flex-end", marginTop: "2px" };

const bannerPreviewStyle = {
  width: "100%",
  height: "85px",
  borderRadius: "12px",
  backgroundSize: "cover",
  backgroundPosition: "center",
  position: "relative",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.15)"
};

const bannerOverlayStyle = {
  position: "absolute",
  bottom: "6px",
  right: "8px",
  backgroundColor: "rgba(0,0,0,0.6)",
  backdropFilter: "blur(4px)",
  padding: "3px 8px",
  borderRadius: "6px",
  fontSize: "10px",
  color: "#fff"
};

const avatarPreviewStyle = {
  width: "48px",
  height: "48px",
  borderRadius: "50%",
  objectFit: "cover",
  border: "2px solid #fff",
  flexShrink: 0
};

const presetRowStyle = { display: "flex", gap: "8px", marginTop: "8px", overflowX: "auto", paddingBottom: "4px" };
const presetBtnStyle = { flex: "1 0 auto", background: "#1a1a1c", border: "1.5px solid #333", borderRadius: "8px", padding: "6px 12px", color: "#ccc", fontSize: "11px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" };

const submitBtnStyle = {
  background: "var(--primary-color)",
  color: "#fff",
  border: "none",
  borderRadius: "14px",
  padding: "14px",
  fontWeight: "800",
  fontSize: "15px",
  cursor: "pointer",
  marginTop: "8px",
  transition: "opacity 0.2s ease"
};

const errorBannerStyle = {
  margin: "16px 24px 0 24px",
  padding: "12px",
  backgroundColor: "rgba(255, 59, 48, 0.15)",
  border: "1px solid rgba(255, 59, 48, 0.3)",
  borderRadius: "10px",
  color: "#ff3b30",
  fontSize: "13px"
};
