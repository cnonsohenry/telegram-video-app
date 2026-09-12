import React, { useState } from "react";
import { ArrowLeft, X, Sparkles, CheckCircle, ShieldCheck, DollarSign, Camera, Globe, Loader2 } from "lucide-react";
import { APP_CONFIG } from "../config";

const BANNER_PRESETS = [
  { label: "Luxury Noir", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80" },
  { label: "Neon Glow", url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1200&q=80" },
  { label: "Sunset Gold", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80" },
  { label: "Cyber Velvet", url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80" }
];

const CATEGORIES = [
  "Model & Glamour",
  "Fitness & Wellness",
  "Baddies & Lifestyle",
  "VIP Exclusive",
  "Cosplay & Fantasy",
  "Art & Music"
];

export default function CreatorSetupModal({ user, onClose, onSetupSuccess }) {
  const [displayName, setDisplayName] = useState(user?.display_name || user?.username || "");
  const [category, setCategory] = useState(user?.creator_category || "Model & Glamour");
  const [bio, setBio] = useState(user?.creator_bio || "Welcome to my official VIP hub. Subscribe for daily exclusive shots and uncensored content 🔥");
  const [subscriptionPrice, setSubscriptionPrice] = useState(user?.subscription_price ? String(user.subscription_price) : "15000");
  const [bannerUrl, setBannerUrl] = useState(user?.banner_url || BANNER_PRESETS[0].url);
  const [customBanner, setCustomBanner] = useState("");
  const [location, setLocation] = useState(user?.location || "Lagos, Nigeria");
  const [website, setWebsite] = useState(user?.website || "");
  const [twitter, setTwitter] = useState(user?.social_links?.twitter || "");
  const [instagram, setInstagram] = useState(user?.social_links?.instagram || "");
  const [telegram, setTelegram] = useState(user?.social_links?.telegram || "");

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Please enter your Creator Display Name.");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Please log in first");

      const finalBanner = customBanner.trim() ? customBanner.trim() : bannerUrl;

      const payload = {
        display_name: displayName.trim(),
        creator_category: category,
        creator_bio: bio.trim(),
        subscription_price: Number(subscriptionPrice) || 0,
        banner_url: finalBanner,
        location: location.trim(),
        website: website.trim(),
        social_links: {
          twitter: twitter.trim(),
          instagram: instagram.trim(),
          telegram: telegram.trim()
        }
      };

      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upgrade to creator");

      if (onSetupSuccess) {
        onSetupSuccess(data.user);
      }
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={fullscreenContainerStyle}>
      {/* Instagram Top Navigation Bar */}
      <div style={topNavStyle}>
        <button onClick={onClose} style={navBackBtnStyle} aria-label="Back">
          <ArrowLeft size={24} color="#fff" />
        </button>

        <span style={topNavTitleStyle}>
          Creator Setup
        </span>

        <div style={{ width: "36px" }} />
      </div>

      <div style={scrollAreaStyle}>
        <div style={innerContentStyle}>
          {error && (
            <div style={errorBannerStyle}>
              <span>{error}</span>
            </div>
          )}

        <form onSubmit={handleSubmit} style={formStyle}>
          {/* Banner Selector */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Profile Cover Banner</label>
            <div style={{ ...bannerPreviewStyle, backgroundImage: `url(${customBanner.trim() || bannerUrl})` }}>
              <div style={bannerOverlayStyle}>
                <span>Cover Preview</span>
              </div>
            </div>
            <div style={presetRowStyle}>
              {BANNER_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset.label}
                  onClick={() => { setBannerUrl(preset.url); setCustomBanner(""); }}
                  style={{
                    ...presetBtnStyle,
                    borderColor: (bannerUrl === preset.url && !customBanner) ? "var(--primary-color)" : "#333"
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <input 
              type="url" 
              placeholder="Or paste custom image URL..." 
              value={customBanner} 
              onChange={(e) => setCustomBanner(e.target.value)} 
              style={{ ...inputStyle, marginTop: "8px", fontSize: "12px", padding: "10px 14px" }}
            />
          </div>

          {/* Display Name */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Creator / Stage Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Queen Bella"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Category */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Primary Category / Niche</label>
            <div style={categoryChipsContainer}>
              {CATEGORIES.map((cat) => (
                <button
                  type="button"
                  key={cat}
                  onClick={() => setCategory(cat)}
                  style={{
                    ...chipStyle,
                    background: category === cat ? "var(--primary-color)" : "#1c1c1e",
                    color: category === cat ? "#fff" : "#ccc",
                    borderColor: category === cat ? "var(--primary-color)" : "#333"
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Bio */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Creator Bio</label>
            <textarea
              rows={3}
              maxLength={400}
              placeholder="Tell fans what exclusive content they get by following you..."
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={textareaStyle}
            />
            <span style={characterCountStyle}>{bio.length}/400</span>
          </div>

          {/* Monthly Subscription Price */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Monthly Subscription Price (₦ or $)</label>
            <div style={{ position: "relative" }}>
              <span style={currencyPrefixStyle}>₦</span>
              <input
                type="number"
                min={0}
                step={500}
                placeholder="15000 (Set 0 for Free Profile)"
                value={subscriptionPrice}
                onChange={(e) => setSubscriptionPrice(e.target.value)}
                style={{ ...inputStyle, paddingLeft: "36px" }}
              />
            </div>
            <span style={hintStyle}>Set to 0 to make your profile free to follow, or set a fee for VIP fan access.</span>
          </div>

          {/* Social Links */}
          <div style={fieldGroupStyle}>
            <label style={labelStyle}>Social Links (Optional)</label>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <input
                type="text"
                placeholder="Instagram username (e.g. queenbella)"
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                style={inputStyle}
              />
              <input
                type="text"
                placeholder="X / Twitter handle (e.g. queenbella)"
                value={twitter}
                onChange={(e) => setTwitter(e.target.value)}
                style={inputStyle}
              />
              <input
                type="text"
                placeholder="Telegram Channel / Handle (e.g. queenbellavip)"
                value={telegram}
                onChange={(e) => setTelegram(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

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
              <label style={labelStyle}>Website / Links</label>
              <input
                type="url"
                placeholder="https://yourlink.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>

          {/* Perks Guarantee */}
          <div style={guaranteeCardStyle}>
            <ShieldCheck size={20} color="#00aff0" style={{ flexShrink: 0 }} />
            <div style={{ fontSize: "12px", color: "#ccc", lineHeight: "1.4" }}>
              <b style={{ color: "#fff" }}>Instant Creator Verification:</b> Your profile will receive the official OnlyFans-style blue checkmark badge, customizable cover, and direct subscription tip monetization.
            </div>
          </div>

          {/* Action Button */}
          <button
            type="submit"
            disabled={isLoading}
            style={submitBtnStyle}
          >
            {isLoading ? (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                <Loader2 size={18} className="animate-spin" />
                <span>Activating Creator Account...</span>
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                <Sparkles size={18} />
                <span>Launch Creator Profile</span>
              </div>
            )}
          </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// 🖌 Styles
const fullscreenContainerStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 100000,
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
  padding: "20px 16px 60px",
  boxSizing: "border-box"
};

const innerContentStyle = {
  width: "100%",
  maxWidth: "520px",
  display: "flex",
  flexDirection: "column"
};

const sparkleIconStyle = {
  width: "40px",
  height: "40px",
  borderRadius: "12px",
  background: "linear-gradient(135deg, #00aff0, #0077b5, var(--primary-color))",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 4px 12px rgba(0, 175, 240, 0.4)"
};

const titleStyle = { margin: 0, fontSize: "18px", fontWeight: "800", color: "#fff" };
const subtitleStyle = { margin: "2px 0 0 0", fontSize: "12px", color: "#8e8e93" };
const closeBtnStyle = { background: "none", border: "none", cursor: "pointer", padding: "4px" };
const formStyle = { padding: "20px 24px", display: "flex", flexDirection: "column", gap: "18px" };
const fieldGroupStyle = { display: "flex", flexDirection: "column", gap: "6px" };
const labelStyle = { fontSize: "13px", fontWeight: "700", color: "#e5e5ea" };
const inputStyle = { width: "100%", background: "#1c1c1e", border: "1px solid #333", borderRadius: "12px", padding: "12px 14px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box" };
const textareaStyle = { width: "100%", background: "#1c1c1e", border: "1px solid #333", borderRadius: "12px", padding: "12px 14px", color: "#fff", fontSize: "14px", outline: "none", boxSizing: "border-box", resize: "none" };
const characterCountStyle = { fontSize: "11px", color: "#666", alignSelf: "flex-end", marginTop: "2px" };
const hintStyle = { fontSize: "11px", color: "#888", marginTop: "4px" };

const bannerPreviewStyle = {
  width: "100%",
  height: "90px",
  borderRadius: "12px",
  backgroundSize: "cover",
  backgroundPosition: "center",
  position: "relative",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.15)"
};

const bannerOverlayStyle = {
  position: "absolute",
  bottom: "8px",
  right: "8px",
  backgroundColor: "rgba(0,0,0,0.6)",
  backdropFilter: "blur(4px)",
  padding: "4px 8px",
  borderRadius: "6px",
  fontSize: "11px",
  color: "#fff"
};

const presetRowStyle = { display: "flex", gap: "8px", marginTop: "8px", overflowX: "auto", paddingBottom: "4px" };
const presetBtnStyle = { flex: "1 0 auto", background: "#1a1a1c", border: "1.5px solid #333", borderRadius: "8px", padding: "6px 12px", color: "#ccc", fontSize: "11px", fontWeight: "600", cursor: "pointer", whiteSpace: "nowrap" };

const categoryChipsContainer = { display: "flex", flexWrap: "wrap", gap: "8px" };
const chipStyle = { border: "1px solid", borderRadius: "20px", padding: "6px 12px", fontSize: "12px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s" };

const currencyPrefixStyle = { position: "absolute", left: "14px", top: "50%", transform: "translateY(-50%)", color: "#888", fontWeight: "700" };

const guaranteeCardStyle = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 16px",
  backgroundColor: "rgba(0, 175, 240, 0.08)",
  border: "1px solid rgba(0, 175, 240, 0.25)",
  borderRadius: "14px"
};

const submitBtnStyle = {
  background: "linear-gradient(135deg, #00aff0, #0088cc, var(--primary-color))",
  color: "#fff",
  border: "none",
  borderRadius: "14px",
  padding: "15px",
  fontWeight: "800",
  fontSize: "15px",
  cursor: "pointer",
  boxShadow: "0 8px 24px rgba(0, 175, 240, 0.35)",
  transition: "transform 0.15s ease",
  marginTop: "4px"
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
