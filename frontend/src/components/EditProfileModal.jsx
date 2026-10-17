import React, { useState } from "react";
import { ArrowLeft, Camera, Loader2, Lock, ShieldCheck } from "lucide-react";
import { APP_CONFIG } from "../config";
import useModalHistory from "../hooks/useModalHistory";

const BANNER_PRESETS = [
  { label: "Luxury Noir", url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80" },
  { label: "Neon Glow", url: "https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=1200&q=80" },
  { label: "Sunset Gold", url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80" },
  { label: "Cyber Velvet", url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&q=80" }
];

export default function EditProfileModal({ user, onClose, onUpdateSuccess, onOpenCreatorSetup }) {
  const handleSafeClose = useModalHistory(true, onClose, "editProfile");
  const [displayName, setDisplayName] = useState(user?.display_name || user?.username || "");
  const [bio, setBio] = useState(user?.creator_bio || "");
  const [category, setCategory] = useState(user?.creator_category || (user?.is_creator ? "Model & Creator" : "Community Member"));
  const [subscriptionPrice, setSubscriptionPrice] = useState(user?.subscription_price ? String(user.subscription_price) : "0");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [bannerUrl, setBannerUrl] = useState(user?.banner_url || BANNER_PRESETS[0].url);
  const [customBanner, setCustomBanner] = useState("");
  const [location, setLocation] = useState(user?.location || "");
  const [website, setWebsite] = useState(user?.website || "");
  const [twitter, setTwitter] = useState(user?.social_links?.twitter || "");
  const [instagram, setInstagram] = useState(user?.social_links?.instagram || "");
  const [telegram, setTelegram] = useState(user?.social_links?.telegram || "");
  const [hideFollowList, setHideFollowList] = useState(
    Boolean(user?.settings?.hide_follow_list || user?.settings?.private_profile)
  );

  const [uploadingField, setUploadingField] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const isVerifiedCreator = Boolean(
    user?.is_creator && (user?.kyc_status === "verified" || user?.is_verified || user?.role === "admin")
  );

  const handleImageUpload = async (file, folder, field) => {
    if (!file) return;
    setError("");
    setUploadingField(field);
    try {
      const token = localStorage.getItem("token");
      const formData = new FormData();
      formData.append("image", file);
      formData.append("folder", folder);

      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/upload-image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload image");

      if (field === "avatar") {
        setAvatarUrl(data.url);
      } else if (field === "banner") {
        setBannerUrl(data.url);
        setCustomBanner(data.url);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setUploadingField(null);
    }
  };

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
        subscription_price: isVerifiedCreator ? Number(subscriptionPrice) || 0 : 0,
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

      // Also sync hide_follow_list privacy setting if changed
      let updatedSettings = data.user?.settings || user?.settings || {};
      try {
        const sRes = await fetch(`${APP_CONFIG.apiUrl}/api/auth/settings`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ hide_follow_list: hideFollowList })
        });
        if (sRes.ok) {
          const sData = await sRes.json();
          if (sData.settings) updatedSettings = sData.settings;
        }
      } catch (e) {}

      if (onUpdateSuccess) {
        onUpdateSuccess({ ...data.user, settings: updatedSettings });
      }
      handleSafeClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={fullscreenContainerStyle}>
      {/* Top Navigation Bar */}
      <div style={topNavStyle}>
        <button onClick={handleSafeClose} style={navBackBtnStyle} aria-label="Back">
          <ArrowLeft size={22} color="#f4f4f5" />
        </button>

        <span style={topNavTitleStyle}>Edit Profile</span>

        <button onClick={handleSubmit} disabled={isLoading || Boolean(uploadingField)} style={topNavDoneBtnStyle}>
          {isLoading ? <Loader2 size={18} className="animate-spin" /> : "Done"}
        </button>
      </div>

      <div style={scrollAreaStyle}>
        <div style={innerContentStyle}>
          {error && (
            <div style={errorBannerStyle}>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} style={formStyle}>
            {/* Profile Picture Avatar + Direct Upload */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    padding: "3px",
                    borderRadius: "50%",
                    background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                    display: "inline-block"
                  }}
                >
                  <img
                    src={avatarUrl || user?.avatar_url || "/assets/default-avatar.png"}
                    alt="Avatar preview"
                    style={{
                      width: "84px",
                      height: "84px",
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2px solid #09090b",
                      display: "block"
                    }}
                    onError={(e) => {
                      e.target.src = "/assets/default-avatar.png";
                    }}
                  />
                </div>
              </div>

              <label style={uploadAvatarBtnStyle}>
                {uploadingField === "avatar" ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Camera size={14} />
                )}
                <span>{uploadingField === "avatar" ? "Uploading Photo..." : "Change Profile Photo"}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  style={{ display: "none" }}
                  onChange={(e) => handleImageUpload(e.target.files?.[0], "avatars", "avatar")}
                />
              </label>
            </div>

            {/* Cover Banner Upload & Presets */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Profile Cover Banner</label>
              <div
                style={{
                  ...bannerPreviewStyle,
                  backgroundImage: `url(${customBanner.trim() || bannerUrl})`
                }}
              >
                <label style={bannerUploadBtnStyle}>
                  {uploadingField === "banner" ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <Camera size={13} />
                  )}
                  <span>{uploadingField === "banner" ? "Uploading..." : "Upload Cover"}</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => handleImageUpload(e.target.files?.[0], "banners", "banner")}
                  />
                </label>
              </div>
              <div style={presetRowStyle}>
                {BANNER_PRESETS.map((preset) => (
                  <button
                    type="button"
                    key={preset.label}
                    onClick={() => {
                      setBannerUrl(preset.url);
                      setCustomBanner("");
                    }}
                    style={{
                      ...presetBtnStyle,
                      borderColor:
                        bannerUrl === preset.url && !customBanner ? "#e11d48" : "rgba(255,255,255,0.08)"
                    }}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
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
                placeholder="Tell people about yourself..."
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                style={textareaStyle}
              />
              <span style={characterCountStyle}>{bio.length}/400</span>
            </div>

            {/* Category */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Category / Bio Tag</label>
              <input
                type="text"
                placeholder="e.g. Model & Glamour, Lifestyle, Creator"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={inputStyle}
              />
            </div>

            {/* Privacy Toggle: Hide Followers / Following List */}
            <div style={privacyRowCardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                <Lock size={17} color="#a1a1aa" style={{ flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#f4f4f5" }}>
                    Private Followers & Following List
                  </div>
                  <div style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "2px" }}>
                    Only you will be able to view who follows you and who you follow.
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setHideFollowList((prev) => !prev)}
                style={{
                  width: "44px",
                  height: "24px",
                  borderRadius: "999px",
                  border: "none",
                  background: hideFollowList ? "#e11d48" : "#3f3f46",
                  position: "relative",
                  cursor: "pointer",
                  transition: "background 0.2s",
                  flexShrink: 0
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "2px",
                    left: hideFollowList ? "22px" : "2px",
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "#f4f4f5",
                    transition: "left 0.2s"
                  }}
                />
              </button>
            </div>

            {/* Monthly Price (for verified creators) OR Upgrade CTA */}
            {isVerifiedCreator ? (
              <div style={fieldGroupStyle}>
                <label style={labelStyle}>Monthly VIP Subscription Price ($ USD)</label>
                <input
                  type="number"
                  min={0}
                  step={1}
                  placeholder="15 (Set 0 for Free)"
                  value={subscriptionPrice}
                  onChange={(e) => setSubscriptionPrice(e.target.value)}
                  style={inputStyle}
                />
              </div>
            ) : (
              <div style={kycPromoCardStyle}>
                <ShieldCheck size={20} color="#f43f5e" style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#f4f4f5" }}>
                    Want to set a subscription price & monetize?
                  </div>
                  <div style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "2px" }}>
                    Verify your email and complete Identity KYC to unlock VIP subscription pricing and tips.
                  </div>
                </div>
                {onOpenCreatorSetup && (
                  <button
                    type="button"
                    onClick={() => onOpenCreatorSetup()}
                    style={kycPromoBtnStyle}
                  >
                    Verify
                  </button>
                )}
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
            <button type="submit" disabled={isLoading || Boolean(uploadingField)} style={submitBtnStyle}>
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
    </div>
  );
}

// 🖌 Styles
const fullscreenContainerStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000220,
  backgroundColor: "#09090b",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
};

const topNavStyle = {
  height: "52px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 16px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  backgroundColor: "#09090b",
  flexShrink: 0
};

const navBackBtnStyle = {
  background: "none",
  border: "none",
  color: "#f4f4f5",
  cursor: "pointer",
  padding: "6px",
  display: "flex",
  alignItems: "center"
};

const topNavTitleStyle = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#f4f4f5",
  letterSpacing: "-0.2px"
};

const topNavDoneBtnStyle = {
  background: "none",
  border: "none",
  color: "#f43f5e",
  fontSize: "15px",
  fontWeight: "700",
  cursor: "pointer",
  padding: "6px"
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

const formStyle = {
  background: "#18181b",
  borderRadius: "18px",
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  gap: "16px"
};

const fieldGroupStyle = { display: "flex", flexDirection: "column", gap: "6px" };
const labelStyle = { fontSize: "13px", fontWeight: "700", color: "#e4e4e7" };
const inputStyle = {
  width: "100%",
  background: "#27272a",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "12px",
  padding: "12px 14px",
  color: "#f4f4f5",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box"
};
const textareaStyle = {
  width: "100%",
  background: "#27272a",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "12px",
  padding: "12px 14px",
  color: "#f4f4f5",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
  resize: "none"
};
const characterCountStyle = { fontSize: "11px", color: "#71717a", alignSelf: "flex-end", marginTop: "2px" };

const uploadAvatarBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  background: "#27272a",
  color: "#e4e4e7",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "999px",
  padding: "7px 14px",
  fontSize: "12px",
  fontWeight: "700",
  cursor: "pointer"
};

const bannerPreviewStyle = {
  width: "100%",
  height: "95px",
  borderRadius: "12px",
  backgroundSize: "cover",
  backgroundPosition: "center",
  position: "relative",
  overflow: "hidden",
  border: "1px solid rgba(255,255,255,0.12)"
};

const bannerUploadBtnStyle = {
  position: "absolute",
  bottom: "8px",
  right: "8px",
  backgroundColor: "rgba(24, 24, 27, 0.85)",
  backdropFilter: "blur(6px)",
  padding: "6px 11px",
  borderRadius: "8px",
  fontSize: "11px",
  color: "#f4f4f5",
  fontWeight: "700",
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  cursor: "pointer",
  border: "1px solid rgba(255,255,255,0.15)"
};

const presetRowStyle = { display: "flex", gap: "8px", marginTop: "6px", overflowX: "auto", paddingBottom: "4px" };
const presetBtnStyle = {
  flex: "1 0 auto",
  background: "#27272a",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "8px",
  padding: "6px 12px",
  color: "#e4e4e7",
  fontSize: "11px",
  fontWeight: "600",
  cursor: "pointer",
  whiteSpace: "nowrap"
};

const privacyRowCardStyle = {
  background: "#27272a",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "12px",
  padding: "12px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px"
};

const kycPromoCardStyle = {
  background: "rgba(225, 29, 72, 0.08)",
  border: "1px solid rgba(225, 29, 72, 0.22)",
  borderRadius: "12px",
  padding: "12px 14px",
  display: "flex",
  alignItems: "center",
  gap: "10px"
};

const kycPromoBtnStyle = {
  background: "#e4e4e7",
  color: "#09090b",
  border: "none",
  borderRadius: "8px",
  padding: "7px 12px",
  fontSize: "12px",
  fontWeight: "800",
  cursor: "pointer",
  flexShrink: 0
};

const submitBtnStyle = {
  background: "#e4e4e7",
  color: "#09090b",
  border: "none",
  borderRadius: "14px",
  padding: "14px",
  fontWeight: "800",
  fontSize: "15px",
  cursor: "pointer",
  marginTop: "6px"
};

const errorBannerStyle = {
  marginBottom: "12px",
  padding: "12px 16px",
  backgroundColor: "rgba(239, 68, 68, 0.14)",
  border: "1px solid rgba(239, 68, 68, 0.35)",
  borderRadius: "12px",
  color: "#f87171",
  fontSize: "13px"
};
