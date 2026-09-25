import React, { useState, useEffect } from "react";
import { 
  ArrowLeft, User, Lock, Bell, LogOut, ChevronRight, Palette,
  Sparkles, TrendingUp, Eye, Share2, CheckCircle, DollarSign,
  ShieldCheck, Volume2, Trash2, HelpCircle, ExternalLink,
  Copy, Plus, CreditCard, X, Check, Edit3, Film, Info, Smartphone
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
  const [currentTheme, setCurrentTheme] = useState(localStorage.getItem("theme") || "red");
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

  const handleThemeChange = (newTheme) => {
    if (newTheme === currentTheme) return;
    setCurrentTheme(newTheme);
    localStorage.setItem("theme", newTheme);

    document.body.classList.remove("theme-orange", "theme-cyan", "theme-purple");
    if (newTheme === "orange") {
      document.body.classList.add("theme-orange");
    } else if (newTheme === "cyan") {
      document.body.classList.add("theme-cyan");
    } else if (newTheme === "purple") {
      document.body.classList.add("theme-purple");
    }

    syncSettingsToBackend({ theme: newTheme });
    showToast(`Accent theme updated to ${newTheme.toUpperCase()}`, "success");
  };

  const toggleAutoplay = () => {
    const next = !autoplayVideos;
    setAutoplayVideos(next);
    localStorage.setItem("autoplay_videos", String(next));
    syncSettingsToBackend({ autoplay_videos: next });
    showToast(next ? "Autoplay enabled" : "Autoplay paused", "info");
  };

  const toggleDataSaver = () => {
    const next = !dataSaver;
    setDataSaver(next);
    localStorage.setItem("data_saver", String(next));
    syncSettingsToBackend({ data_saver: next });
    showToast(next ? "Data saver enabled (Reduced preloading)" : "Data saver disabled", "info");
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
    showToast(next ? "Fan tips & direct gifts enabled" : "Fan tips disabled", "info");
  };

  const handleClearCache = () => {
    setIsClearingCache(true);
    setTimeout(() => {
      const freed = cacheSize;
      setCacheSize("0 MB");
      setIsClearingCache(false);
      showToast(`Cache successfully cleared (${freed} freed)`, "success");
    }, 600);
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
      {/* 🟢 TOP NAVIGATION BAR */}
      <div style={navBarStyle}>
        <button onClick={onBack} style={navBackBtnStyle} aria-label="Back" title="Back to profile">
          <ArrowLeft size={22} color="#fff" />
        </button>
        <span style={headerTitleStyle}>Settings & Activity</span>
        <button onClick={handleShareClick} style={navBackBtnStyle} title="Share Profile">
          <Share2 size={20} color="#fff" />
        </button>
      </div>

      <div style={scrollAreaStyle}>
        <div style={innerWrapperStyle}>
          
          {/* 🌟 1. USER IDENTITY CARD */}
          <div style={userCardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={avatarStoryRing}>
                <div style={avatarInner}>
                  <img 
                    src={user?.avatar_url || "/assets/default-avatar.png"} 
                    alt={user?.display_name || user?.username}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                  />
                </div>
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "16px", fontWeight: "800", color: "#fff" }}>
                    {user?.display_name || user?.username || "Member"}
                  </span>
                  {(user?.is_creator || user?.is_verified) && (
                    <CheckCircle size={15} color="#00aff0" fill="#00aff0" />
                  )}
                </div>
                <div style={{ fontSize: "12.5px", color: "#8e8e93", marginTop: "2px" }}>
                  @{user?.username || "user"} · <span style={{ color: user?.is_creator ? "#FFD700" : "#00aff0", fontWeight: "600" }}>
                    {user?.is_creator ? "Creator Mode Active" : "Member"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Profile Actions */}
            <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
              <button 
                onClick={onOpenEditProfile} 
                style={quickActionPillBtn}
              >
                <Edit3 size={14} />
                <span>Edit Profile</span>
              </button>

              <button 
                onClick={handleShareClick} 
                style={quickActionPillBtn}
              >
                <Share2 size={14} />
                <span>Share Profile</span>
              </button>

              {user?.is_creator && (
                <button 
                  onClick={onOpenFanView} 
                  style={{ ...quickActionPillBtn, color: "#00aff0" }}
                  title="Preview as a fan"
                >
                  <Eye size={14} />
                  <span>Fan View</span>
                </button>
              )}
            </div>
          </div>

          {/* 🌟 2. CREATOR TOOLS & STUDIO SECTION */}
          <div style={{ marginTop: "16px" }}>
            <h3 style={sectionLabelStyle}>Creator Tools</h3>

            {user?.is_creator ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "0 16px" }}>
                
                {/* Creator Studio & Analytics Golden Banner */}
                <div 
                  onClick={onOpenCreatorStudio} 
                  style={creatorStudioBannerStyle}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={creatorIconBox}>
                        <Sparkles size={20} color="#FFD700" />
                      </div>
                      <div>
                        <div style={{ fontSize: "15px", fontWeight: "800", color: "#fff" }}>
                          Creator Studio & Analytics
                        </div>
                        <div style={{ fontSize: "12px", color: "#FFD700", marginTop: "2px" }}>
                          Monetization, fan subscriptions & payout insights
                        </div>
                      </div>
                    </div>
                    <span style={studioOpenBadge}>Open Studio</span>
                  </div>

                  {/* 4 Mini Stat Blocks */}
                  <div style={miniStatsGrid}>
                    <div style={miniStatBox}>
                      <span style={miniStatNumber}>{creatorStats?.subscribers || 0}</span>
                      <span style={miniStatLabel}>VIP Fans</span>
                    </div>
                    <div style={miniStatBox}>
                      <span style={{ ...miniStatNumber, color: "#00d084" }}>
                        ${((creatorStats?.subscribers || 0) * (Number(user?.subscription_price) || 0)).toLocaleString()}
                      </span>
                      <span style={miniStatLabel}>MRR</span>
                    </div>
                    <div style={miniStatBox}>
                      <span style={miniStatNumber}>{creatorStats?.posts || 0}</span>
                      <span style={miniStatLabel}>Posts</span>
                    </div>
                    <div style={miniStatBox}>
                      <span style={miniStatNumber}>{creatorStats?.views ? Intl.NumberFormat("en-US", { notation: "compact" }).format(creatorStats.views) : 0}</span>
                      <span style={miniStatLabel}>Views</span>
                    </div>
                  </div>
                </div>

                {/* VIP Channel Pricing */}
                <div style={settingsItemCard} onClick={onOpenCreatorStudio}>
                  <div style={{ ...itemIconCircle, backgroundColor: "rgba(255, 215, 0, 0.12)" }}>
                    <DollarSign size={18} color="#FFD700" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>
                      VIP Channel Subscription
                    </div>
                    <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px" }}>
                      {Number(user?.subscription_price) > 0 
                        ? `$${Number(user.subscription_price).toLocaleString()} / month fee`
                        : "Free VIP Access (No fee set)"}
                    </div>
                  </div>
                  <ChevronRight size={18} color="#555" />
                </div>

                {/* Fan View Preview */}
                <div style={settingsItemCard} onClick={onOpenFanView}>
                  <div style={{ ...itemIconCircle, backgroundColor: "rgba(0, 175, 240, 0.12)" }}>
                    <Eye size={18} color="#00aff0" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>
                      Fan View Profile Preview
                    </div>
                    <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px" }}>
                      See how your profile appears to public subscribers and fans
                    </div>
                  </div>
                  <ChevronRight size={18} color="#555" />
                </div>

                {/* Upload Video Button */}
                <div style={settingsItemCard} onClick={onOpenUpload}>
                  <div style={{ ...itemIconCircle, backgroundColor: "rgba(0, 208, 132, 0.12)" }}>
                    <Plus size={18} color="#00d084" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>
                      Upload Video or Reel
                    </div>
                    <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px" }}>
                      Publish new public videos or VIP exclusive drops
                    </div>
                  </div>
                  <ChevronRight size={18} color="#555" />
                </div>

              </div>
            ) : (
              <div style={{ padding: "0 16px" }}>
                <div style={becomeCreatorBanner} onClick={onOpenBecomeCreator}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={creatorIconBox}>
                      <Sparkles size={20} color="#FFD700" />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "14.5px", fontWeight: "800", color: "#fff" }}>
                        Turn On Creator Mode
                      </div>
                      <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px", lineHeight: "1.4" }}>
                        Monetize your content with VIP subscriptions, fan tips, and exclusive drops.
                      </div>
                    </div>
                  </div>
                  <button style={becomeCreatorBtn}>
                    <span>Upgrade Free</span>
                    <ChevronRight size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 🌟 3. ACCOUNT & PROFILE */}
          <div style={{ marginTop: "20px" }}>
            <h3 style={sectionLabelStyle}>Account & Security</h3>
            <div style={groupedListCard}>
              
              <div style={settingsListItem} onClick={() => setActiveModal("account")}>
                <User size={19} color="#00aff0" />
                <span style={listItemLabel}>Account Information</span>
                <ChevronRight size={16} color="#555" />
              </div>

              <div style={settingsListItem} onClick={onOpenEditProfile}>
                <Edit3 size={19} color="#8e8e93" />
                <span style={listItemLabel}>Edit Profile & Bio</span>
                <ChevronRight size={16} color="#555" />
              </div>

              <div style={settingsListItem} onClick={() => setActiveModal("privacy")}>
                <Lock size={19} color="#8e8e93" />
                <span style={listItemLabel}>Privacy & Safety</span>
                <ChevronRight size={16} color="#555" />
              </div>

              <div style={{ ...settingsListItem, borderBottom: "none" }}>
                <ShieldCheck size={19} color="#00d084" />
                <div style={{ flex: 1, marginLeft: "14px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#fff" }}>Authentication Status</div>
                  <div style={{ fontSize: "11.5px", color: "#8e8e93" }}>Secured via Telegram OAuth & JWT</div>
                </div>
                <Check size={16} color="#00d084" />
              </div>

            </div>
          </div>

          {/* 🌟 4. SUBSCRIPTIONS & VIP PASSES */}
          <div style={{ marginTop: "20px" }}>
            <h3 style={sectionLabelStyle}>Subscriptions & VIP Passes</h3>
            <div style={groupedListCard}>
              
              <div style={settingsListItem} onClick={() => setActiveModal("subscriptions")}>
                <Film size={19} color="#fe2c55" />
                <div style={{ flex: 1, marginLeft: "14px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#fff" }}>Active VIP Passes</div>
                  <div style={{ fontSize: "11.5px", color: "#8e8e93" }}>
                    {subscriptionsList.length > 0 
                      ? `${subscriptionsList.length} subscribed creators` 
                      : "No active VIP subscriptions"}
                  </div>
                </div>
                <ChevronRight size={16} color="#555" />
              </div>

              <div style={{ ...settingsListItem, borderBottom: "none" }} onClick={() => setActiveModal("crypto")}>
                <CreditCard size={19} color="#FFD700" />
                <div style={{ flex: 1, marginLeft: "14px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#fff" }}>Crypto Payment Methods</div>
                  <div style={{ fontSize: "11.5px", color: "#8e8e93" }}>NOWPayments: USDT, TON, BTC, ETH, LTC</div>
                </div>
                <ChevronRight size={16} color="#555" />
              </div>

            </div>
          </div>

          {/* 🌟 5. CONTENT & PLAYBACK PREFERENCES */}
          <div style={{ marginTop: "20px" }}>
            <h3 style={sectionLabelStyle}>Content & Playback</h3>
            <div style={groupedListCard}>
              
              <div style={settingsListItem}>
                <Smartphone size={19} color="#8e8e93" />
                <div style={{ flex: 1, marginLeft: "14px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#fff" }}>Autoplay Feed Videos</div>
                  <div style={{ fontSize: "11.5px", color: "#8e8e93" }}>Automatically play next clip when scrolling</div>
                </div>
                <ToggleSwitch active={autoplayVideos} onClick={toggleAutoplay} />
              </div>

              <div style={settingsListItem}>
                <Volume2 size={19} color="#8e8e93" />
                <div style={{ flex: 1, marginLeft: "14px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#fff" }}>Mute Audio on Start</div>
                  <div style={{ fontSize: "11.5px", color: "#8e8e93" }}>Feed videos start muted until tapped</div>
                </div>
                <ToggleSwitch active={muteOnStart} onClick={toggleMuteOnStart} />
              </div>

              <div style={{ ...settingsListItem, borderBottom: "none" }}>
                <ShieldCheck size={19} color="#8e8e93" />
                <div style={{ flex: 1, marginLeft: "14px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#fff" }}>Data Saver Mode</div>
                  <div style={{ fontSize: "11.5px", color: "#8e8e93" }}>Reduces video prefetch bitrate on cellular</div>
                </div>
                <ToggleSwitch active={dataSaver} onClick={toggleDataSaver} />
              </div>

            </div>
          </div>

          {/* 🌟 6. NOTIFICATIONS */}
          <div style={{ marginTop: "20px" }}>
            <h3 style={sectionLabelStyle}>Notifications</h3>
            <div style={groupedListCard}>
              
              <div style={settingsListItem}>
                <Bell size={19} color="#00aff0" />
                <div style={{ flex: 1, marginLeft: "14px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#fff" }}>Subscribers & Tips</div>
                  <div style={{ fontSize: "11.5px", color: "#8e8e93" }}>Alerts when users subscribe or send tips</div>
                </div>
                <ToggleSwitch 
                  active={notifSubs} 
                  onClick={() => {
                    const n = !notifSubs;
                    setNotifSubs(n);
                    syncSettingsToBackend({ notif_subs: n });
                  }} 
                />
              </div>

              <div style={settingsListItem}>
                <Bell size={19} color="#fe2c55" />
                <div style={{ flex: 1, marginLeft: "14px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#fff" }}>Likes & Comments</div>
                  <div style={{ fontSize: "11.5px", color: "#8e8e93" }}>Activity on your uploaded videos</div>
                </div>
                <ToggleSwitch 
                  active={notifLikes} 
                  onClick={() => {
                    const n = !notifLikes;
                    setNotifLikes(n);
                    syncSettingsToBackend({ notif_likes: n });
                  }} 
                />
              </div>

              <div style={{ ...settingsListItem, borderBottom: "none" }}>
                <Sparkles size={19} color="#FFD700" />
                <div style={{ flex: 1, marginLeft: "14px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#fff" }}>Creator Exclusive Drops</div>
                  <div style={{ fontSize: "11.5px", color: "#8e8e93" }}>New releases from creators you follow</div>
                </div>
                <ToggleSwitch 
                  active={notifDrops} 
                  onClick={() => {
                    const n = !notifDrops;
                    setNotifDrops(n);
                    syncSettingsToBackend({ notif_drops: n });
                  }} 
                />
              </div>

            </div>
          </div>

          {/* 🌟 7. APPEARANCE & THEMES */}
          <div style={{ marginTop: "20px" }}>
            <h3 style={sectionLabelStyle}>Appearance</h3>
            <div style={groupedListCard}>
              <div style={{ padding: "16px 18px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                  <Palette size={19} color="#00aff0" />
                  <span style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>Theme Accent Color</span>
                </div>
                
                {/* 4 Theme chips */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
                  <ThemeChip 
                    label="Red" 
                    color="#ff3b30" 
                    isSelected={currentTheme === "red"} 
                    onClick={() => handleThemeChange("red")} 
                  />
                  <ThemeChip 
                    label="Orange" 
                    color="#ff8c00" 
                    isSelected={currentTheme === "orange"} 
                    onClick={() => handleThemeChange("orange")} 
                  />
                  <ThemeChip 
                    label="Cyan" 
                    color="#00aff0" 
                    isSelected={currentTheme === "cyan"} 
                    onClick={() => handleThemeChange("cyan")} 
                  />
                  <ThemeChip 
                    label="Purple" 
                    color="#a855f7" 
                    isSelected={currentTheme === "purple"} 
                    onClick={() => handleThemeChange("purple")} 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 🌟 8. STORAGE & CACHE */}
          <div style={{ marginTop: "20px" }}>
            <h3 style={sectionLabelStyle}>Storage</h3>
            <div style={groupedListCard}>
              <div style={{ ...settingsListItem, borderBottom: "none" }} onClick={handleClearCache}>
                <Trash2 size={19} color="#8e8e93" />
                <div style={{ flex: 1, marginLeft: "14px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#fff" }}>Clear Local Cache</div>
                  <div style={{ fontSize: "11.5px", color: "#8e8e93" }}>Free up space used by cached clips & thumbnails</div>
                </div>
                <span style={{ fontSize: "13px", color: "#8e8e93", fontWeight: "600" }}>
                  {isClearingCache ? "Clearing..." : cacheSize}
                </span>
              </div>
            </div>
          </div>

          {/* 🌟 9. SUPPORT & ABOUT */}
          <div style={{ marginTop: "20px" }}>
            <h3 style={sectionLabelStyle}>Support & Legal</h3>
            <div style={groupedListCard}>
              
              <a 
                href="https://t.me/+z-toLOLI2eVjMmYx" 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ ...settingsListItem, textDecoration: "none" }}
              >
                <HelpCircle size={19} color="#00aff0" />
                <span style={listItemLabel}>Official Telegram Community</span>
                <ExternalLink size={16} color="#555" />
              </a>

              <div style={settingsListItem} onClick={() => setActiveModal("guidelines")}>
                <Info size={19} color="#8e8e93" />
                <span style={listItemLabel}>Community Guidelines</span>
                <ChevronRight size={16} color="#555" />
              </div>

              <div style={{ ...settingsListItem, borderBottom: "none" }}>
                <ShieldCheck size={19} color="#8e8e93" />
                <div style={{ flex: 1, marginLeft: "14px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "600", color: "#fff" }}>App Version</div>
                  <div style={{ fontSize: "11.5px", color: "#8e8e93" }}>v2.4.0 (Build 2026.09-Release)</div>
                </div>
                <span style={{ fontSize: "12px", color: "#00d084", fontWeight: "600" }}>Up to Date</span>
              </div>

            </div>
          </div>

          {/* 🌟 10. SESSION / LOG OUT */}
          <div style={{ marginTop: "24px", padding: "0 16px" }}>
            <button 
              onClick={() => setShowLogoutConfirm(true)} 
              style={logoutPillBtn}
            >
              <LogOut size={18} color="#fe2c55" />
              <span>Log out</span>
            </button>
          </div>

          <LegalFooter />
        </div>
      </div>

      {/* 🌟 ACCOUNT DETAILS MODAL */}
      {activeModal === "account" && (
        <ModalSheet title="Account Details" onClose={() => setActiveModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <DetailRow label="Username" value={`@${user?.username || "user"}`} onCopy={() => handleCopyText(user?.username || "", "Username")} />
            <DetailRow label="Display Name" value={user?.display_name || user?.username || "Member"} />
            <DetailRow label="Email" value={user?.email || "Connected via Telegram"} onCopy={user?.email ? () => handleCopyText(user.email, "Email") : null} />
            <DetailRow label="Account Type" value={user?.is_creator ? "Verified Creator" : (user?.is_premium ? "VIP Passholder" : "Standard Member")} />
            <DetailRow label="Telegram User ID" value={String(user?.id || user?.telegram_user_id || "N/A")} onCopy={() => handleCopyText(String(user?.id || user?.telegram_user_id || ""), "User ID")} />
            <DetailRow label="Account Status" value="Active & Good Standing" statusColor="#00d084" />
          </div>
        </ModalSheet>
      )}

      {/* 🌟 PRIVACY MODAL */}
      {activeModal === "privacy" && (
        <ModalSheet title="Privacy & Safety" onClose={() => setActiveModal(null)}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={modalToggleRow}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>Private Profile</div>
                <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px" }}>Only approved followers can view your saved & liked clips</div>
              </div>
              <ToggleSwitch active={privateProfile} onClick={togglePrivateProfile} />
            </div>

            <div style={modalToggleRow}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>Show Liked Videos Tab</div>
                <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px" }}>Make your liked videos visible to profile visitors</div>
              </div>
              <ToggleSwitch active={showLikes} onClick={toggleShowLikes} />
            </div>

            <div style={modalToggleRow}>
              <div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>Allow Fan Tips & Direct Gifts</div>
                <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px" }}>Enable tipping button on your profile and videos</div>
              </div>
              <ToggleSwitch active={allowTips} onClick={toggleAllowTips} />
            </div>
          </div>
        </ModalSheet>
      )}

      {/* 🌟 VIP SUBSCRIPTIONS MODAL */}
      {activeModal === "subscriptions" && (
        <ModalSheet title="Active VIP Subscriptions" onClose={() => setActiveModal(null)}>
          {subscriptionsList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#8e8e93" }}>
              <Film size={36} color="#555" style={{ marginBottom: "12px" }} />
              <div style={{ fontSize: "15px", fontWeight: "700", color: "#fff" }}>No Active VIP Passes</div>
              <p style={{ fontSize: "13px", marginTop: "4px" }}>You haven't subscribed to any creators yet.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {subscriptionsList.map((sub, idx) => (
                <div key={idx} style={subItemCard}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "42px", height: "42px", borderRadius: "50%", overflow: "hidden", backgroundColor: "#222" }}>
                      <img 
                        src={`/api/avatar?user_id=${sub.creator_id}`}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>
                        {sub.creator_display_name || sub.creator_username || "Creator"}
                      </div>
                      <div style={{ fontSize: "12px", color: "#8e8e93" }}>@{sub.creator_username || "creator"} · <span style={{ color: "#00d084", fontWeight: "600" }}>Active</span></div>
                    </div>
                  </div>
                  <button 
                    onClick={() => {
                      setActiveModal(null);
                      onBack();
                      window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: { username: sub.creator_username } }));
                    }}
                    style={viewChannelPillBtn}
                  >
                    View
                  </button>
                </div>
              ))}
            </div>
          )}
        </ModalSheet>
      )}

      {/* 🌟 CRYPTO CHECKOUT INFO MODAL */}
      {activeModal === "crypto" && (
        <ModalSheet title="Crypto Payments & Payouts" onClose={() => setActiveModal(null)}>
          <div style={{ fontSize: "13.5px", color: "#c8c8c8", lineHeight: "1.55" }}>
            <p style={{ margin: "0 0 14px 0" }}>
              All VIP subscriptions and creator tips are settled on-chain with instant activation via <strong>NOWPayments</strong>.
            </p>
            <div style={cryptoBadgeList}>
              <span style={cryptoBadge}>USDT (TRC20 / ERC20)</span>
              <span style={cryptoBadge}>TON Network</span>
              <span style={cryptoBadge}>Bitcoin (BTC)</span>
              <span style={cryptoBadge}>Ethereum (ETH)</span>
              <span style={cryptoBadge}>Litecoin (LTC)</span>
            </div>
            <p style={{ margin: "16px 0 0 0", color: "#8e8e93", fontSize: "12.5px" }}>
              Creators receive 100% automated payouts directly to their configured personal crypto wallets upon subscription confirmation.
            </p>
          </div>
        </ModalSheet>
      )}

      {/* 🌟 GUIDELINES MODAL */}
      {activeModal === "guidelines" && (
        <ModalSheet title="Community Guidelines" onClose={() => setActiveModal(null)}>
          <div style={{ fontSize: "13.5px", color: "#c8c8c8", lineHeight: "1.6" }}>
            <p style={{ margin: "0 0 12px 0" }}>
              <strong>1. Age Requirement:</strong> All creators and participants must be at least 18 years of age.
            </p>
            <p style={{ margin: "0 0 12px 0" }}>
              <strong>2. Consensual Content:</strong> All uploads must be non-infringing and strictly consensual.
            </p>
            <p style={{ margin: "0 0 12px 0" }}>
              <strong>3. Respectful Interaction:</strong> Harassment, hate speech, or unauthorized distribution of private content is strictly prohibited.
            </p>
            <p style={{ margin: "0", color: "#8e8e93", fontSize: "12px" }}>
              Violations result in immediate permanent account termination and revocation of creator payouts.
            </p>
          </div>
        </ModalSheet>
      )}

      {/* 🌟 LOGOUT CONFIRMATION DIALOG */}
      {showLogoutConfirm && (
        <div style={modalOverlayStyle} onClick={() => setShowLogoutConfirm(false)}>
          <div style={dialogBoxStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={dialogTitleStyle}>Log out of @{user?.username || "your account"}?</h3>
            <p style={dialogSubStyle}>You will need to sign back in with your Telegram account to access your VIP channels.</p>
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
      width: "48px",
      height: "26px",
      backgroundColor: active ? "#00aff0" : "#333336",
      borderRadius: "14px",
      position: "relative",
      cursor: "pointer",
      transition: "background-color 0.25s ease",
      flexShrink: 0
    }}
    onClick={onClick}
  >
    <div style={{
      width: "22px",
      height: "22px",
      borderRadius: "50%",
      backgroundColor: "#ffffff",
      position: "absolute",
      top: "2px",
      left: active ? "24px" : "2px",
      transition: "left 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
      boxShadow: "0 2px 5px rgba(0,0,0,0.3)"
    }} />
  </div>
);

const ThemeChip = ({ label, color, isSelected, onClick }) => (
  <button 
    onClick={onClick}
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: "6px",
      padding: "10px 4px",
      backgroundColor: isSelected ? "rgba(255, 255, 255, 0.1)" : "#161618",
      border: isSelected ? `2px solid ${color}` : "1px solid #262626",
      borderRadius: "12px",
      cursor: "pointer",
      transition: "all 0.2s ease"
    }}
  >
    <div style={{ width: "20px", height: "20px", borderRadius: "50%", backgroundColor: color }} />
    <span style={{ fontSize: "11px", fontWeight: "700", color: isSelected ? "#fff" : "#8e8e93" }}>{label}</span>
  </button>
);

const DetailRow = ({ label, value, onCopy, statusColor }) => (
  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 14px", backgroundColor: "#18181a", borderRadius: "10px", border: "1px solid #262626" }}>
    <div>
      <div style={{ fontSize: "11.5px", color: "#8e8e93", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ fontSize: "14px", fontWeight: "700", color: statusColor || "#fff", marginTop: "2px" }}>{value}</div>
    </div>
    {onCopy && (
      <button onClick={onCopy} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px" }} title="Copy">
        <Copy size={16} color="#8e8e93" />
      </button>
    )}
  </div>
);

const ModalSheet = ({ title, onClose, children }) => (
  <div style={modalOverlayStyle} onClick={onClose}>
    <div style={modalContentStyle} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px", borderBottom: "1px solid #262626", paddingBottom: "12px" }}>
        <h3 style={{ fontSize: "17px", fontWeight: "800", color: "#fff", margin: 0 }}>{title}</h3>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", padding: "4px", color: "#fff" }}>
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

// 🖌 STYLES
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
  animation: "fadeIn 0.2s ease-out"
};

const navBarStyle = {
  height: "52px",
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

const headerTitleStyle = {
  fontSize: "16px",
  fontWeight: "800",
  color: "#fff",
  letterSpacing: "-0.2px",
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

const userCardStyle = {
  margin: "14px 16px 0 16px",
  padding: "16px",
  backgroundColor: "#121214",
  borderRadius: "16px",
  border: "1px solid #222"
};

const avatarStoryRing = {
  padding: "2.5px",
  borderRadius: "50%",
  background: "linear-gradient(135deg, #00aff0 0%, #0077b5 100%)",
  display: "inline-block",
  flexShrink: 0
};

const avatarInner = {
  width: "56px",
  height: "56px",
  borderRadius: "50%",
  border: "2px solid #000",
  overflow: "hidden",
  backgroundColor: "#1c1c1e"
};

const quickActionPillBtn = {
  flex: 1,
  height: "34px",
  borderRadius: "20px",
  backgroundColor: "#222224",
  border: "1px solid #333",
  color: "#fff",
  fontSize: "12px",
  fontWeight: "700",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  transition: "all 0.15s ease"
};

const sectionLabelStyle = {
  fontSize: "11.5px",
  color: "#8e8e93",
  textTransform: "uppercase",
  padding: "16px 20px 8px 20px",
  fontWeight: "800",
  letterSpacing: "0.8px"
};

const creatorStudioBannerStyle = {
  background: "linear-gradient(135deg, rgba(255, 215, 0, 0.14) 0%, rgba(255, 140, 0, 0.06) 100%)",
  border: "1px solid rgba(255, 215, 0, 0.35)",
  borderRadius: "16px",
  padding: "16px",
  cursor: "pointer",
  transition: "all 0.2s ease"
};

const creatorIconBox = {
  width: "38px",
  height: "38px",
  borderRadius: "10px",
  backgroundColor: "rgba(255, 215, 0, 0.15)",
  border: "1px solid rgba(255, 215, 0, 0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0
};

const studioOpenBadge = {
  fontSize: "11px",
  fontWeight: "800",
  color: "#FFD700",
  backgroundColor: "rgba(255, 215, 0, 0.18)",
  border: "1px solid rgba(255, 215, 0, 0.4)",
  borderRadius: "100px",
  padding: "4px 10px",
  letterSpacing: "0.4px"
};

const miniStatsGrid = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "8px",
  backgroundColor: "rgba(0, 0, 0, 0.3)",
  borderRadius: "12px",
  padding: "10px 8px"
};

const miniStatBox = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center"
};

const miniStatNumber = {
  fontSize: "15px",
  fontWeight: "800",
  color: "#ffffff"
};

const miniStatLabel = {
  fontSize: "10.5px",
  color: "#a8a8a8",
  marginTop: "2px",
  fontWeight: "500"
};

const settingsItemCard = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "14px 16px",
  backgroundColor: "#121214",
  border: "1px solid #222",
  borderRadius: "14px",
  cursor: "pointer",
  transition: "all 0.15s ease"
};

const itemIconCircle = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0
};

const becomeCreatorBanner = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px",
  background: "linear-gradient(135deg, rgba(255, 215, 0, 0.12) 0%, rgba(0, 175, 240, 0.08) 100%)",
  border: "1px solid rgba(255, 215, 0, 0.3)",
  borderRadius: "16px",
  cursor: "pointer"
};

const becomeCreatorBtn = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  backgroundColor: "rgba(255, 215, 0, 0.2)",
  border: "1px solid rgba(255, 215, 0, 0.4)",
  borderRadius: "20px",
  color: "#FFD700",
  fontSize: "12px",
  fontWeight: "800",
  padding: "6px 12px",
  cursor: "pointer",
  flexShrink: 0
};

const groupedListCard = {
  margin: "0 16px",
  backgroundColor: "#121214",
  borderRadius: "16px",
  border: "1px solid #222",
  overflow: "hidden"
};

const settingsListItem = {
  display: "flex",
  alignItems: "center",
  padding: "15px 18px",
  borderBottom: "1px solid #1c1c1e",
  cursor: "pointer",
  transition: "background-color 0.15s ease"
};

const listItemLabel = {
  flex: 1,
  marginLeft: "14px",
  fontSize: "14px",
  fontWeight: "600",
  color: "#ffffff"
};

const logoutPillBtn = {
  width: "100%",
  height: "46px",
  borderRadius: "24px",
  backgroundColor: "rgba(254, 44, 85, 0.1)",
  border: "1px solid rgba(254, 44, 85, 0.3)",
  color: "#fe2c55",
  fontSize: "14.5px",
  fontWeight: "700",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  cursor: "pointer",
  transition: "all 0.15s ease"
};

const modalOverlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.82)",
  backdropFilter: "blur(12px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 100000,
  padding: "20px"
};

const modalContentStyle = {
  width: "100%",
  maxWidth: "460px",
  backgroundColor: "#141416",
  borderRadius: "20px",
  padding: "22px 24px",
  border: "1px solid #2e2e32",
  boxShadow: "0 10px 40px rgba(0,0,0,0.6)",
  maxHeight: "85vh",
  overflowY: "auto"
};

const modalToggleRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  backgroundColor: "#1a1a1c",
  borderRadius: "12px",
  border: "1px solid #28282c"
};

const subItemCard = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "12px 14px",
  backgroundColor: "#1a1a1c",
  borderRadius: "12px",
  border: "1px solid #28282c"
};

const viewChannelPillBtn = {
  padding: "6px 14px",
  borderRadius: "100px",
  backgroundColor: "rgba(0, 175, 240, 0.15)",
  border: "1px solid rgba(0, 175, 240, 0.35)",
  color: "#00aff0",
  fontSize: "12px",
  fontWeight: "700",
  cursor: "pointer"
};

const cryptoBadgeList = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px",
  marginTop: "10px"
};

const cryptoBadge = {
  backgroundColor: "#202024",
  border: "1px solid #333",
  borderRadius: "8px",
  padding: "4px 10px",
  fontSize: "12px",
  color: "#FFD700",
  fontWeight: "600"
};

const dialogBoxStyle = {
  width: "100%",
  maxWidth: "360px",
  backgroundColor: "#161618",
  borderRadius: "20px",
  padding: "24px",
  textAlign: "center",
  border: "1px solid #2c2c30"
};

const dialogTitleStyle = {
  fontSize: "17px",
  fontWeight: "800",
  marginBottom: "8px",
  color: "#fff"
};

const dialogSubStyle = {
  fontSize: "13.5px",
  color: "#8e8e93",
  marginBottom: "22px",
  lineHeight: "1.4"
};

const dialogActionColumn = {
  display: "flex",
  gap: "10px"
};

const dialogLogoutBtn = {
  flex: 1,
  padding: "12px",
  borderRadius: "12px",
  border: "none",
  backgroundColor: "#fe2c55",
  color: "#fff",
  fontWeight: "700",
  fontSize: "14px",
  cursor: "pointer"
};

const dialogCancelBtn = {
  flex: 1,
  padding: "12px",
  borderRadius: "12px",
  border: "1px solid #3a3a3c",
  backgroundColor: "transparent",
  color: "#fff",
  fontWeight: "600",
  fontSize: "14px",
  cursor: "pointer"
};