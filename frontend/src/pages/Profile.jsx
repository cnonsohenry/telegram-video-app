import React, { useState, useEffect, useCallback } from "react";
import { Settings, Grid3X3, Heart, Lock, CheckCircle, Share2 } from "lucide-react";
import VideoCard from "../components/VideoCard"; 
import SettingsView from "../components/SettingsView"; 
import { useVideos } from "../hooks/useVideos";

export default function Profile({ user, onLogout, setHideFooter, setActiveVideo }) {
  const [activeTab, setActiveTab] = useState("videos");
  const [currentView, setCurrentView] = useState("profile");
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);

  // Handle Resize for layout switching
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (currentView === "settings") {
      setHideFooter(true);
    } else {
      setHideFooter(false);
    }
    return () => setHideFooter(false);
  }, [currentView, setHideFooter]);

  const { videos: shots, loading: shotsLoading, loadMore: loadMoreShots } = useVideos("shots");
  const { videos: premium, loading: premiumLoading, loadMore: loadMorePremium } = useVideos("premium");

  const handleOpenVideo = useCallback(async (video, e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    try {
      setActiveVideo({ ...video, video_url: null }); 
      const res = await fetch(`https://videos.naijahomemade.com/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      if (data.video_url) setActiveVideo(prev => ({ ...prev, video_url: data.video_url }));
    } catch (err) {
      console.error("Profile Video Load Error:", err);
      setActiveVideo(null);
    }
  }, [setActiveVideo]);

  const { data: videosToDisplay, loading, loadMore } = activeTab === "premium" 
    ? { data: premium || [], loading: premiumLoading, loadMore: loadMorePremium }
    : { data: shots || [], loading: shotsLoading, loadMore: loadMoreShots };

  if (currentView === "settings") {
    return <SettingsView onBack={() => setCurrentView("profile")} onLogout={onLogout} />;
  }

  return (
    <div style={{ ...containerStyle, padding: isDesktop ? "30px 20px" : "0" }}>
      <div style={isDesktop ? desktopInnerWrapper : {}}>
        
        {/* 🟢 TOP NAV (Mobile Only) */}
        {!isDesktop && (
          <div style={navGridStyle}>
            <div style={{ width: "40px" }}></div>
            <div style={centerTitleContainer}>
              <h2 style={usernameStyle}>{user?.username || "Member"}</h2>
              <CheckCircle size={14} color="#20D5EC" fill="black" style={{ marginLeft: "4px" }} />
            </div>
            <div style={{ display: "flex", gap: "16px", justifyContent: "flex-end", flex: 1 }}>
              <Settings size={24} color="#fff" onClick={() => setCurrentView("settings")} style={{ cursor: "pointer" }} />
            </div>
          </div>
        )}

        {/* 🟢 USER IDENTITY SECTION (Instagram Style) */}
        <div style={{ 
          ...headerSectionStyle, 
          flexDirection: isDesktop ? "row" : "column",
          alignItems: isDesktop ? "flex-start" : "stretch",
          gap: isDesktop ? "80px" : "20px",
          padding: isDesktop ? "40px 20px" : "20px"
        }}>
          <div style={{ 
            ...avatarContainerStyle, 
            width: isDesktop ? "150px" : "80px", 
            height: isDesktop ? "150px" : "80px" 
          }}>
            <img 
              src={user?.avatar_url || "/assets/default-avatar.png"} 
              style={avatarImageStyle} 
              alt="Avatar" 
              onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
            />
          </div>

          <div style={infoColumnStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "20px" }}>
              <h1 style={{ ...displayNameStyle, fontSize: isDesktop ? "28px" : "20px" }}>
                @{user?.username || "user"}
              </h1>
              {isDesktop && (
                <div style={{ display: "flex", gap: "10px" }}>
                   <button style={desktopEditBtnStyle} onClick={() => setCurrentView("settings")}>Edit Profile</button>
                   <Settings size={24} color="#fff" onClick={() => setCurrentView("settings")} style={{ cursor: "pointer" }} />
                </div>
              )}
            </div>

            <div style={{ marginBottom: "20px" }}>
              <p style={{ ...bioStyle, fontSize: isDesktop ? "16px" : "13px" }}>
                <b>Official Preview Channel</b><br/>
                Catch my latest shots here before they hit Premium 💎
              </p>
            </div>

            <div style={{ ...actionButtonsRowStyle, width: isDesktop ? "fit-content" : "100%" }}>
              <button style={premiumButtonStyle} onClick={() => alert("Premium Coming Soon")}>SUBSCRIBE PREMIUM</button>
              <button style={secondaryButtonStyle} onClick={() => alert("Link Copied")}><Share2 size={18} /></button>
            </div>
          </div>
        </div>

        {/* 🟢 TABS NAV */}
        <div style={{ 
          ...tabsContainerStyle, 
          justifyContent: isDesktop ? "center" : "space-around",
          gap: isDesktop ? "60px" : "0",
          borderTop: isDesktop ? "1px solid #222" : "none",
          top: isDesktop ? "0" : "48px"
        }}>
          <TabButton isDesktop={isDesktop} active={activeTab === "videos"} onClick={() => setActiveTab("videos")} icon={<Grid3X3 size={isDesktop ? 18 : 24} />} label="POSTS" />
          <TabButton isDesktop={isDesktop} active={activeTab === "premium"} onClick={() => setActiveTab("premium")} icon={<Lock size={isDesktop ? 18 : 24} />} label="PREMIUM" />
          <TabButton isDesktop={isDesktop} active={activeTab === "likes"} onClick={() => setActiveTab("likes")} icon={<Heart size={isDesktop ? 18 : 24} />} label="LIKED" />
        </div>

        {/* 🟢 VIDEO GRID */}
        <div style={contentAreaStyle}>
          <div style={{ 
            ...gridStyle, 
            gridTemplateColumns: isDesktop ? "repeat(3, 1fr)" : "repeat(3, 1fr)",
            gap: isDesktop ? "28px" : "1px"
          }}>
            {videosToDisplay.map(v => (
              <VideoCard 
                key={`${v.chat_id}:${v.message_id}`} 
                video={v} 
                onOpen={(vData, e) => handleOpenVideo(vData, e)} 
                showDetails={false} 
              />
            ))}
          </div>
          {loading && <div style={loaderStyle}>Refreshing shots...</div>}
          {!loading && videosToDisplay.length > 0 && (
            <button onClick={loadMore} style={loadMoreBtnStyle}>Load More</button>
          )}
        </div>
      </div>
    </div>
  );
}

// 🎨 COMPONENT UI PIECES
const TabButton = ({ active, onClick, icon, label, isDesktop }) => (
  <button onClick={onClick} style={{ 
    display: "flex", 
    flexDirection: isDesktop ? "row" : "column", 
    alignItems: "center", 
    gap: isDesktop ? "8px" : "6px",
    background: "none", border: "none", 
    padding: isDesktop ? "15px 0" : "12px 0",
    borderTop: (isDesktop && active) ? "1px solid #fff" : "none",
    borderBottom: (!isDesktop && active) ? "2px solid #fff" : (!isDesktop ? "1px solid var(--border-color)" : "none"),
    opacity: active ? 1 : 0.4, color: "#fff", cursor: "pointer",
    marginTop: isDesktop ? "-1px" : "0"
  }}>
    {icon}
    <span style={{ fontSize: isDesktop ? "12px" : "10px", fontWeight: "700", letterSpacing: isDesktop ? "1px" : "0" }}>{label}</span>
  </button>
);

// 🖌 STYLES
const containerStyle = { minHeight: "100%", background: "var(--bg-color)", color: "#fff", position: "relative", overflowX: "hidden" };
const desktopInnerWrapper = { maxWidth: "935px", margin: "0 auto", width: "100%" };
const navGridStyle = { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid var(--border-color)", position: "sticky", top: 0, background: "var(--bg-color)", zIndex: 100, backdropFilter: "blur(15px)" };
const centerTitleContainer = { display: "flex", alignItems: "center" };
const usernameStyle = { fontSize: "16px", fontWeight: "700", margin: 0 };
const headerSectionStyle = { display: "flex" };
const avatarContainerStyle = { borderRadius: "50%", padding: "4px", background: "linear-gradient(45deg, #FFD700, var(--primary-color))", flexShrink: 0 };
const avatarImageStyle = { width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", border: "4px solid #000" };
const infoColumnStyle = { flex: 1 };
const displayNameStyle = { fontWeight: "300", margin: 0, color: "#fff" };
const bioStyle = { color: "#fff", margin: 0, lineHeight: "1.5" };
const actionButtonsRowStyle = { display: "flex", gap: "10px" };
const premiumButtonStyle = { background: "var(--primary-color)", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 24px", fontWeight: "800", fontSize: "14px", cursor: "pointer" };
const secondaryButtonStyle = { background: "#1a1a1a", color: "#fff", border: "1px solid #333", borderRadius: "8px", padding: "0 15px", display: "flex", alignItems: "center" };
const desktopEditBtnStyle = { background: "#363636", color: "#fff", border: "none", borderRadius: "8px", padding: "5px 15px", fontWeight: "600", fontSize: "14px", cursor: "pointer" };
const tabsContainerStyle = { display: "flex", position: "sticky", background: "var(--bg-color)", zIndex: 90 };
const contentAreaStyle = { width: "100%", paddingBottom: "100px" };
const gridStyle = { display: "grid" };
const loadMoreBtnStyle = { display: "block", width: "100%", padding: "20px", background: "none", border: "none", color: "#8e8e8e", fontSize: "13px", fontWeight: "600", cursor: "pointer" };
const loaderStyle = { padding: "40px", textAlign: "center", color: "#666", fontSize: "14px" };