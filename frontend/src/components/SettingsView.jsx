import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, User, Lock, Bell, LogOut, ChevronRight,
  TrendingUp, Eye, Share2, CheckCircle, DollarSign,
  ShieldCheck, Volume2, Trash2, HelpCircle, ExternalLink,
  Copy, Plus, CreditCard, X, Edit3, Film, Info, Smartphone
} from "lucide-react";
import LegalFooter from "./LegalFooter";
import { showToast } from "../utils/toast";

// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../config";

export default function SettingsView({ 
  user,
  creatorStats = {},
  onBack, 
  onLogout,
  onOpenEditProfile,
  onOpenCreatorStudio,
  onOpenFanView,
  onOpenBecomeCreator,
  onOpenUpload,
  onShareProfile,
  onUpdateUser
}) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [activeModal, setActiveModal] = useState(null); // 'account' | 'privacy' | 'subscriptions' | 'crypto' | 'guidelines'
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);

  // Preference Toggles (persisted in localStorage)
  const [autoplayVideos, setAutoplayVideos] = useState(localStorage.getItem("autoplay_videos") !== "false");
  const [dataSaver, setDataSaver] = useState(localStorage.getItem("data_saver") === "true");
  const [muteOnStart, setMuteOnStart] = useState(localStorage.getItem("mute_start") !== "false");
  
  // Privacy Toggles
  const [privateProfile, setPrivateProfile] = useState(Boolean(user?.settings?.private_profile));
  const [showLikes, setShowLikes] = useState(user?.settings?.show_likes !== false);
  const [allowTips, setAllowTips] = useState(user?.settings?.allow_tips !== false);

  // Notification Toggles
  const [notifSubs, setNotifSubs] = useState(user?.settings?.notif_subs !== false);
  const [notifLikes, setNotifLikes] = useState(user?.settings?.notif_likes !== false);
  const [notifDrops, setNotifDrops] = useState(user?.settings?.notif_drops !== false);

  // Cache storage state
  const [cacheSize, setCacheSize] = useState("18.4 MB");
  const [isClearingCache, setIsClearingCache] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const syncSettingsToBackend = async (newSettings) => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await fetch(`${APP_CONFIG.apiUrl}/api/auth/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ settings: newSettings })
      });
    } catch (err) {
      console.error("Settings sync failed", err);
    }
  };

  const toggleAutoplay = () => {
    const next = !autoplayVideos;
    setAutoplayVideos(next);
    localStorage.setItem("autoplay_videos", String(next));
    syncSettingsToBackend({ autoplay_videos: next });
    showToast(next ? "Autoplay enabled" : "Autoplay disabled", "info");
  };

  const toggleDataSaver = () => {
    const next = !dataSaver;
    setDataSaver(next);
    localStorage.setItem("data_saver", String(next));
    syncSettingsToBackend({ data_saver: next });
    showToast(next ? "Data saver enabled" : "Data saver disabled", "info");
  };

  const toggleMuteOnStart = () => {
    const next = !muteOnStart;
    setMuteOnStart(next);
    localStorage.setItem("mute_start", String(next));
    syncSettingsToBackend({ mute_start: next });
    showToast(next ? "Videos start muted" : "Videos start unmuted", "info");
  };

  const togglePrivateProfile = () => {
    const next = !privateProfile;
    setPrivateProfile(next);
    syncSettingsToBackend({ private_profile: next });
    showToast(next ? "Private account enabled" : "Public account enabled", "info");
  };

  const toggleShowLikes = () => {
    const next = !showLikes;
    setShowLikes(next);
    syncSettingsToBackend({ show_likes: next });
    showToast(next ? "Liked videos visible on profile" : "Liked videos hidden", "info");
  };

  const toggleAllowTips = () => {
    const next = !allowTips;
    setAllowTips(next);
    syncSettingsToBackend({ allow_tips: next });
    showToast(next ? "Fan tips enabled" : "Fan tips disabled", "info");
  };

  const handleClearCache = () => {
    setIsClearingCache(true);
    setTimeout(() => {
      const freed = cacheSize;
      setCacheSize("0 MB");
      setIsClearingCache(false);
      showToast(`Cache cleared (${freed} freed)`, "success");
    }, 400);
  };

  const handleShareClick = () => {
    if (onShareProfile) {
      onShareProfile();
    } else {
      const shareUrl = `${window.location.origin}/?creator=${user?.username || ""}`;
      if (navigator.share) {
        navigator.share({
          title: `${user?.display_name || user?.username} on ${APP_CONFIG.appNamePrefix}`,
          url: shareUrl
        }).catch(() => {});
      } else {
        navigator.clipboard.writeText(shareUrl);
        showToast("Profile link copied to clipboard!", "success");
      }
    }
  };

  const handleCopyText = (text, label) => {
    navigator.clipboard.writeText(text);
    showToast(`${label} copied to clipboard!`, "success");
  };

  const subscriptionsList = user?.subscriptions || [];

  return (
    <div style={containerStyle}>
      {/* Top Navigation */}
      <div style={navBarStyle}>
        <button onClick={onBack} style={navBackBtnStyle} aria-label="Back">
          <ArrowLeft size={22} color="#fff" />
        </button>
        <h2 style={headerTitleStyle}>Settings</h2>
        <div style={{ width: "36px" }} />
      </div>

      <div style={scrollAreaStyle}>
        <div style={innerWrapperStyle}>

          {/* User Row (Minimal & Clean) */}
          <div style={userRowStyle} onClick={onOpenEditProfile}>
            <div style={avatarCircle}>
              <img 
                src={user?.avatar_url || "/assets/default-avatar.png"} 
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0, marginLeft: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ fontSize: "15px", fontWeight: "700", color: "#fff" }}>
                  {user?.display_name || user?.username || "Member"}
                </span>
                {(user?.is_creator || user?.is_verified) && (
                  <CheckCircle size={14} color="#0095f6" fill="#0095f6" />
                )}
              </div>
              <div style={{ fontSize: "13px", color: "#8e8e93", marginTop: "2px" }}>
                @{user?.username || "user"} · {user?.is_creator ? "Creator" : "Member"}
              </div>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onOpenEditProfile();
              }}
              style={editProfileBtnStyle}
            >
              Edit
            </button>
          </div>

          <div style={dividerStyle} />

          {/* 🌟 CREATOR TOOLS (Minimal row-based list) */}
          <div style={sectionLabelStyle}>Creator Tools</div>

          {user?.is_creator ? (
            <>
              <div style={settingsRowStyle} onClick={onOpenCreatorStudio}>
                <TrendingUp size={19} color="#8e8e93" />
                <span style={rowLabelStyle}>Creator Studio & Analytics</span>
                <span style={rowValueStyle}>{creatorStats?.subscribers || 0} fans</span>
                <ChevronRight size={16} color="#48484a" />
              </div>

              <div style={settingsRowStyle} onClick={onOpenCreatorStudio}>
                <DollarSign size={19} color="#8e8e93" />
                <span style={rowLabelStyle}>VIP Channel Pricing</span>
                <span style={rowValueStyle}>
                  {Number(user?.subscription_price) > 0 
                    ? `$${Number(user.subscription_price).toLocaleString()}/mo` 
                    : "Free"}
                </span>
                <ChevronRight size={16} color="#48484a" />
              </div>

              <div style={settingsRowStyle} onClick={onOpenFanView}>
                <Eye size={19} color="#8e8e93" />
                <span style={rowLabelStyle}>Fan View (Preview Profile)</span>
                <ChevronRight size={16} color="#48484a" />
              </div>

              <div style={settingsRowStyle} onClick={onOpenUpload}>
                <Plus size={19} color="#8e8e93" />
                <span style={rowLabelStyle}>Upload Video or Reel</span>
                <ChevronRight size={16} color="#48484a" />
              </div>
            </>
          ) : (
            <div style={settingsRowStyle} onClick={onOpenBecomeCreator}>
              <TrendingUp size={19} color="#8e8e93" />
              <span style={rowLabelStyle}>Turn On Creator Mode</span>
              <span style={{ fontSize: "13px", color: "#0095f6", fontWeight: "600" }}>Upgrade</span>
              <ChevronRight size={16} color="#48484a" />
            </div>
          )}

          <div style={dividerStyle} />

          {/* 🌟 ACCOUNT */}
          <div style={sectionLabelStyle}>Account</div>

          <div style={settingsRowStyle} onClick={onOpenEditProfile}>
            <Edit3 size={19} color="#8e8e93" />
            <span style={rowLabelStyle}>Edit Profile</span>
            <ChevronRight size={16} color="#48484a" />
          </div>

          <div style={settingsRowStyle} onClick={handleShareClick}>
            <Share2 size={19} color="#8e8e93" />
            <span style={rowLabelStyle}>Share Profile</span>
            <ChevronRight size={16} color="#48484a" />
          </div>

          <div style={settingsRowStyle} onClick={() => setActiveModal("account")}>
            <User size={19} color="#8e8e93" />
            <span style={rowLabelStyle}>Account Details</span>
            <ChevronRight size={16} color="#48484a" />
          </div>

          <div style={settingsRowStyle} onClick={() => setActiveModal("privacy")}>
            <Lock size={19} color="#8e8e93" />
            <span style={rowLabelStyle}>Privacy</span>
            <ChevronRight size={16} color="#48484a" />
          </div>

          <div style={settingsRowStyle}>
            <ShieldCheck size={19} color="#8e8e93" />
            <span style={rowLabelStyle}>Security</span>
            <span style={rowValueStyle}>Telegram OAuth</span>
            <CheckCircle size={15} color="#00d084" />
          </div>

          <div style={dividerStyle} />

          {/* 🌟 SUBSCRIPTIONS & VIP PASSES */}
          <div style={sectionLabelStyle}>Subscriptions</div>

          <div style={settingsRowStyle} onClick={() => setActiveModal("subscriptions")}>
            <Film size={19} color="#8e8e93" />
            <span style={rowLabelStyle}>VIP Passes</span>
            <span style={rowValueStyle}>
              {subscriptionsList.length > 0 
                ? `${subscriptionsList.length} active` 
                : "None"}
            </span>
            <ChevronRight size={16} color="#48484a" />
          </div>

          <div style={settingsRowStyle} onClick={() => setActiveModal("crypto")}>
            <CreditCard size={19} color="#8e8e93" />
            <span style={rowLabelStyle}>Payment Methods</span>
            <span style={rowValueStyle}>Crypto (NOWPayments)</span>
            <ChevronRight size={16} color="#48484a" />
          </div>

          <div style={dividerStyle} />

          {/* 🌟 PREFERENCES */}
          <div style={sectionLabelStyle}>Preferences</div>

          <div style={settingsRowStyle}>
            <Smartphone size={19} color="#8e8e93" />
            <span style={rowLabelStyle}>Autoplay Videos</span>
            <ToggleSwitch active={autoplayVideos} onClick={toggleAutoplay} />
          </div>

          <div style={settingsRowStyle}>
            <Volume2 size={19} color="#8e8e93" />
            <span style={rowLabelStyle}>Mute on Start</span>
            <ToggleSwitch active={muteOnStart} onClick={toggleMuteOnStart} />
          </div>

          <div style={settingsRowStyle}>
            <ShieldCheck size={19} color="#8e8e93" />
            <span style={rowLabelStyle}>Data Saver</span>
            <ToggleSwitch active={dataSaver} onClick={toggleDataSaver} />
          </div>

          <div style={dividerStyle} />

          {/* 🌟 NOTIFICATIONS */}
          <div style={sectionLabelStyle}>Notifications</div>

          <div style={settingsRowStyle}>
            <Bell size={19} color="#8e8e93" />
            <span style={rowLabelStyle}>Subscribers & Tips</span>
            <ToggleSwitch 
              active={notifSubs} 
              onClick={() => {
                const n = !notifSubs;
                setNotifSubs(n);
                syncSettingsToBackend({ notif_subs: n });
              }} 
            />
          </div>

          <div style={settingsRowStyle}>
            <Bell size={19} color="#8e8e93" />
            <span style={rowLabelStyle}>Likes & Comments</span>
            <ToggleSwitch 
              active={notifLikes} 
              onClick={() => {
                const n = !notifLikes;
                setNotifLikes(n);
                syncSettingsToBackend({ notif_likes: n });
              }} 
            />
          </div>

          <div style={settingsRowStyle}>
            <Bell size={19} color="#8e8e93" />
            <span style={rowLabelStyle}>Creator Releases</span>
            <ToggleSwitch 
              active={notifDrops} 
              onClick={() => {
                const n = !notifDrops;
                setNotifDrops(n);
                syncSettingsToBackend({ notif_drops: n });
              }} 
            />
          </div>

          <div style={dividerStyle} />

          {/* 🌟 STORAGE */}
          <div style={sectionLabelStyle}>Storage</div>

          <div style={settingsRowStyle} onClick={handleClearCache}>
            <Trash2 size={19} color="#8e8e93" />
            <span style={rowLabelStyle}>Clear Cache</span>
            <span style={rowValueStyle}>{isClearingCache ? "Clearing..." : cacheSize}</span>
            <ChevronRight size={16} color="#48484a" />
          </div>

          <div style={dividerStyle} />

          {/* 🌟 SUPPORT & ABOUT */}
          <div style={sectionLabelStyle}>Support & About</div>

          <a 
            href="https://t.me/+z-toLOLI2eVjMmYx" 
            target="_blank" 
            rel="noopener noreferrer" 
            style={{ ...settingsRowStyle, textDecoration: "none" }}
          >
            <HelpCircle size={19} color="#8e8e93" />
            <span style={rowLabelStyle}>Telegram Community</span>
            <ExternalLink size={15} color="#48484a" />
          </a>

          <div style={settingsRowStyle} onClick={() => setActiveModal("guidelines")}>
            <Info size={19} color="#8e8e93" />
            <span style={rowLabelStyle}>Community Guidelines</span>
            <ChevronRight size={16} color="#48484a" />
          </div>

          <div style={settingsRowStyle}>
            <Info size={19} color="#8e8e93" />
            <span style={rowLabelStyle}>Version</span>
            <span style={rowValueStyle}>2.4.0</span>
          </div>

          <div style={dividerStyle} />

          {/* 🌟 LOG OUT (Clean minimal red text) */}
          <div 
            style={{ ...settingsRowStyle, borderBottom: "none", color: "#fe2c55" }} 
            onClick={() => setShowLogoutConfirm(true)}
          >
            <LogOut size={19} color="#fe2c55" />
            <span style={{ ...rowLabelStyle, color: "#fe2c55", fontWeight: "600" }}>Log out</span>
          </div>

          <LegalFooter />
        </div>
      </div>

      {/* 🌟 ACCOUNT DETAILS MODAL */}
      {activeModal === "account" && (
        <ModalSheet title="Account Details" onClose={() => setActiveModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <DetailRow label="Username" value={`@${user?.username || "user"}`} onCopy={() => handleCopyText(user?.username || "", "Username")} />
            <DetailRow label="Display Name" value={user?.display_name || user?.username || "Member"} />
            <DetailRow label="Email" value={user?.email || "Connected via Telegram"} onCopy={user?.email ? () => handleCopyText(user.email, "Email") : null} />
            <DetailRow label="Account Type" value={user?.is_creator ? "Creator" : (user?.is_premium ? "VIP Passholder" : "Member")} />
            <DetailRow label="Telegram User ID" value={String(user?.id || user?.telegram_user_id || "N/A")} onCopy={() => handleCopyText(String(user?.id || user?.telegram_user_id || ""), "User ID")} />
            <DetailRow label="Status" value="Active" />
          </div>
        </ModalSheet>
      )}

      {/* 🌟 PRIVACY MODAL */}
      {activeModal === "privacy" && (
        <ModalSheet title="Privacy" onClose={() => setActiveModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={modalToggleRow}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "#fff" }}>Private Profile</div>
                <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px" }}>Only approved followers can view saved/liked clips</div>
              </div>
              <ToggleSwitch active={privateProfile} onClick={togglePrivateProfile} />
            </div>

            <div style={modalToggleRow}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "#fff" }}>Show Liked Videos</div>
                <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px" }}>Make liked videos tab visible to visitors</div>
              </div>
              <ToggleSwitch active={showLikes} onClick={toggleShowLikes} />
            </div>

            <div style={modalToggleRow}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "600", color: "#fff" }}>Allow Fan Tips</div>
                <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px" }}>Enable tipping button on profile</div>
              </div>
              <ToggleSwitch active={allowTips} onClick={toggleAllowTips} />
            </div>
          </div>
        </ModalSheet>
      )}

      {/* 🌟 VIP SUBSCRIPTIONS MODAL */}
      {activeModal === "subscriptions" && (
        <ModalSheet title="VIP Subscriptions" onClose={() => setActiveModal(null)}>
          {subscriptionsList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 16px", color: "#8e8e93" }}>
              <div style={{ fontSize: "14px", fontWeight: "600", color: "#fff" }}>No Active Subscriptions</div>
              <p style={{ fontSize: "13px", marginTop: "4px" }}>You are not currently subscribed to any VIP creators.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {subscriptionsList.map((sub, idx) => (
                <div key={idx} style={subItemCard}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "38px", height: "38px", borderRadius: "50%", overflow: "hidden", backgroundColor: "#222" }}>
                      <img 
                        src={`/api/avatar?user_id=${sub.creator_id}`}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "600", color: "#fff" }}>
                        {sub.creator_display_name || sub.creator_username || "Creator"}
                      </div>
                      <div style={{ fontSize: "12px", color: "#8e8e93" }}>@{sub.creator_username || "creator"}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setActiveModal(null);
                      onBack();
                      window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: { username: sub.creator_username } }));
                    }}
                    style={viewChannelBtn}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </ModalSheet>
      )}

      {/* 🌟 CRYPTO INFO MODAL */}
      {activeModal === "crypto" && (
        <ModalSheet title="Payment Methods" onClose={() => setActiveModal(null)}>
          <div style={{ fontSize: "13.5px", color: "#c8c8c8", lineHeight: "1.5" }}>
            <p style={{ margin: "0 0 12px 0" }}>
              VIP passes and tips are settled on-chain via <strong>NOWPayments</strong> with automated instant access.
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
              {["USDT", "TON", "BTC", "ETH", "LTC"].map((c) => (
                <span key={c} style={cryptoChip}>{c}</span>
              ))}
            </div>
            <p style={{ margin: "14px 0 0 0", color: "#8e8e93", fontSize: "12px" }}>
              Creator earnings are forwarded directly to configured destination wallets.
            </p>
          </div>
        </ModalSheet>
      )}

      {/* 🌟 GUIDELINES MODAL */}
      {activeModal === "guidelines" && (
        <ModalSheet title="Community Guidelines" onClose={() => setActiveModal(null)}>
          <div style={{ fontSize: "13px", color: "#c8c8c8", lineHeight: "1.55" }}>
            <p style={{ margin: "0 0 10px 0" }}>
              <strong>1. Age:</strong> All participants must be 18 years or older.
            </p>
            <p style={{ margin: "0 0 10px 0" }}>
              <strong>2. Consent:</strong> All published media must be non-infringing and consensual.
            </p>
            <p style={{ margin: "0", color: "#8e8e93" }}>
              Violations result in account suspension and revocation of creator access.
            </p>
          </div>
        </ModalSheet>
      )}

      {/* 🌟 LOGOUT DIALOG */}
      {showLogoutConfirm && (
        <div style={modalOverlayStyle} onClick={() => setShowLogoutConfirm(false)}>
          <div style={dialogBoxStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={dialogTitleStyle}>Log out?</h3>
            <p style={dialogSubStyle}>You will need to sign back in to access your profile and VIP passes.</p>
            <div style={dialogActionColumn}>
              <button style={dialogLogoutBtn} onClick={onLogout}>Log out</button>
              <button style={dialogCancelBtn} onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 🎨 SUB-COMPONENTS
const ToggleSwitch = ({ active, onClick }) => (
  <div 
    style={{
      width: "44px",
      height: "24px",
      backgroundColor: active ? "#ffffff" : "#262628",
      borderRadius: "12px",
      position: "relative",
      cursor: "pointer",
      transition: "background-color 0.2s ease",
      flexShrink: 0
    }}
    onClick={onClick}
  >
    <div style={{
      width: "20px",
      height: "20px",
      borderRadius: "50%",
      backgroundColor: active ? "#000000" : "#8e8e93",
      position: "absolute",
      top: "2px",
      left: active ? "22px" : "2px",
      transition: "left 0.2s cubic-bezier(0.2, 0.8, 0.2, 1)"
    }} />
  </div>
);

const DetailRow = ({ label, value, onCopy }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", backgroundColor: "#141416", borderRadius: "8px", border: "1px solid #222" }}>
    <div>
      <div style={{ fontSize: "11px", color: "#8e8e93", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: "13.5px", fontWeight: "600", color: "#fff", marginTop: "2px" }}>{value}</div>
    </div>
    {onCopy && (
      <button onClick={onCopy} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }} title="Copy">
        <Copy size={15} color="#8e8e93" />
      </button>
    )}
  </div>
);

const ModalSheet = ({ title, onClose, children }) => (
  <div style={modalOverlayStyle} onClick={onClose}>
    <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", borderBottom: "1px solid #222", paddingBottom: "10px" }}>
        <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#fff", margin: 0 }}>{title}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "#8e8e93" }}>
          <X size={18} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

// 🖌 STYLES (Clean monochrome AMOLED dark theme matching the rest of the app)
const containerStyle = {
  position: "fixed",
  inset: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "#000000",
  color: "#fff",
  zIndex: 99999,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  animation: "fadeIn 0.15s ease-out"
};

const navBarStyle = {
  height: "48px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 14px",
  borderBottom: "1px solid #161616",
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

const headerTitleStyle = {
  fontSize: "15px",
  fontWeight: "700",
  color: "#fff",
  margin: 0
};

const scrollAreaStyle = {
  flex: 1,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  display: "flex",
  flexDirection: "column"
};

const innerWrapperStyle = {
  width: "100%",
  maxWidth: "600px",
  margin: "0 auto",
  boxSizing: "border-box",
  paddingBottom: "40px"
};

const userRowStyle = {
  display: "flex",
  alignItems: "center",
  padding: "16px",
  cursor: "pointer"
};

const avatarCircle = {
  width: "48px",
  height: "48px",
  borderRadius: "50%",
  overflow: "hidden",
  backgroundColor: "#1c1c1e",
  flexShrink: 0,
  border: "1px solid #262626"
};

const editProfileBtnStyle = {
  padding: "6px 14px",
  borderRadius: "16px",
  backgroundColor: "#1c1c1e",
  border: "1px solid #333",
  color: "#fff",
  fontSize: "12.5px",
  fontWeight: "600",
  cursor: "pointer"
};

const sectionLabelStyle = {
  fontSize: "11px",
  color: "#8e8e93",
  textTransform: "uppercase",
  padding: "18px 16px 8px 16px",
  fontWeight: "700",
  letterSpacing: "0.6px"
};

const settingsRowStyle = {
  display: "flex",
  alignItems: "center",
  padding: "14px 16px",
  borderBottom: "1px solid #141414",
  cursor: "pointer",
  transition: "background-color 0.15s ease"
};

const rowLabelStyle = {
  flex: 1,
  marginLeft: "14px",
  fontSize: "14px",
  fontWeight: "500",
  color: "#ffffff"
};

const rowValueStyle = {
  fontSize: "13px",
  color: "#8e8e93",
  marginRight: "6px"
};

const dividerStyle = {
  height: "1px",
  backgroundColor: "#161616",
  marginTop: "6px"
};

const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.8)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100000,
  padding: "16px"
};

const modalContentStyle = {
  width: "100%",
  maxWidth: "420px",
  backgroundColor: "#161618",
  borderRadius: "16px",
  padding: "18px",
  border: "1px solid #282828",
  maxHeight: "80vh",
  overflowY: "auto"
};

const modalToggleRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 12px",
  backgroundColor: "#121214",
  borderRadius: "10px",
  border: "1px solid #222"
};

const subItemCard = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 12px",
  backgroundColor: "#121214",
  borderRadius: "10px",
  border: "1px solid #222"
};

const viewChannelBtn = {
  padding: "5px 12px",
  borderRadius: "14px",
  backgroundColor: "#222",
  border: "1px solid #333",
  color: "#fff",
  fontSize: "12px",
  fontWeight: "600",
  cursor: "pointer"
};

const cryptoChip = {
  backgroundColor: "#18181a",
  border: "1px solid #2a2a2a",
  borderRadius: "6px",
  padding: "3px 8px",
  fontSize: "11.5px",
  color: "#e0e0e0",
  fontWeight: "500"
};

const dialogBoxStyle = {
  width: "100%",
  maxWidth: "320px",
  backgroundColor: "#18181a",
  borderRadius: "16px",
  padding: "20px",
  textAlign: "center",
  border: "1px solid #2a2a2a"
};

const dialogTitleStyle = {
  fontSize: "16px",
  fontWeight: "700",
  marginBottom: "6px",
  color: "#fff"
};

const dialogSubStyle = {
  fontSize: "13px",
  color: "#8e8e93",
  marginBottom: "20px",
  lineHeight: "1.4"
};

const dialogActionColumn = {
  display: "flex",
  gap: "8px"
};

const dialogLogoutBtn = {
  flex: 1,
  padding: "10px",
  borderRadius: "10px",
  border: "none",
  backgroundColor: "#fe2c55",
  color: "#fff",
  fontWeight: "700",
  fontSize: "13.5px",
  cursor: "pointer"
};

const dialogCancelBtn = {
  flex: 1,
  padding: "10px",
  borderRadius: "10px",
  border: "1px solid #333",
  backgroundColor: "transparent",
  color: "#fff",
  fontWeight: "600",
  fontSize: "13.5px",
  cursor: "pointer"
};