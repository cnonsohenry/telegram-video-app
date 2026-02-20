import React, { useState, useEffect, useCallback } from "react";
import { Settings, Grid3X3, Heart, Lock, CheckCircle, Share2 } from "lucide-react";
import VideoCard from "../components/VideoCard"; 
import SettingsView from "./SettingsView"; 
import { useVideos } from "../hooks/useVideos";

export default function UserProfile({ user, onLogout, setHideFooter, setActiveVideo }) {
  const [activeTab, setActiveTab] = useState("videos");
  const [currentView, setCurrentView] = useState("profile");

  // 🟢 1. FOOTER VISIBILITY LOGIC
  // We only hide the footer here for the SettingsView. 
  // App.jsx handles hiding the footer when activeVideo is playing.
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

  // 🟢 2. GLOBAL PLAYER HANDLER
  const handleOpenVideo = useCallback(async (video, e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }

    try {
      // Open the global player immediately (shows loader)
      setActiveVideo({ ...video, video_url: null }); 

      const res = await fetch(`https://videos.naijahomemade.com/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      
      if (data.video_url) {
        setActiveVideo(prev => ({ ...prev, video_url: data.video_url }));
      }
    } catch (err) {
      console.error("Video fetch failed", err);
      setActiveVideo(null); // Close player on error
    }
  }, [setActiveVideo]);

  const { data: videosToDisplay, loading, loadMore } = activeTab === "premium" 
    ? { data: premium || [], loading: premiumLoading, loadMore: loadMorePremium }
    : { data: shots || [], loading: shotsLoading, loadMore: loadMoreShots };

  // 🟢 RENDER SETTINGS VIEW
  if (currentView === "settings") {
    return <SettingsView 
      onBack={() => setCurrentView("profile")} 
      onLogout={() => {
        setCurrentView("profile");
        onLogout();
      }} 
    />;
  }

  return (
    <div style={containerStyle}>
      {/* NAVIGATION BAR */}
      <div style={navGridStyle}>
        <div style={{ width: "40px" }}></div>
        <div style={centerTitleContainer}>
          <h2 style={usernameStyle}>{user?.username || "Member"}</h2>
          <CheckCircle size={14} color="#20D5EC" fill="black" style={{ marginLeft: "4px" }} />
        </div>
        <div style={{ display: "flex", gap: "16px", justifyContent: "flex-end", flex: 1 }}>
          <Settings 
            size={24} 
            color="#fff" 
            onClick={() => setCurrentView("settings")} 
            style={{ cursor: "pointer" }} 
          />
        </div>
      </div>

      {/* PROFILE HEADER */}
      <div style={headerSectionStyle}>
        <div style={profileTopRowStyle}>
          <div style={avatarContainerStyle}>
            <img src={user?.avatar_url || "/assets/default-avatar.png"} style={avatarImageStyle} alt="Avatar" />
          </div>
          <div style={infoColumnStyle}>
            <h1 style={displayNameStyle}>@{user?.username || "user"}</h1>
            <p style={bioStyle}><b>Official Preview Channel</b><br/>Catch my latest shots here before they hit Premium 💎</p>
          </div>
        </div>

        <div style={actionButtonsRowStyle}>
          <button style={premiumButtonStyle} onClick={() => alert("Coming soon!")}>SUBSCRIBE PREMIUM</button>
          <button style={secondaryButtonStyle} onClick={() => alert("Link copied!")}><Share2 size={18} /></button>
        </div>
      </div>

      {/* TABS SECTION */}
      <div style={tabsContainerStyle}>
        <TabButton active={activeTab === "videos"} onClick={() => setActiveTab("videos")} icon={<Grid3X3 size={24} />} label="Shots" />
        <TabButton active={activeTab === "premium"} onClick={() => setActiveTab("premium")} icon={<Lock size={24} />} label="Premium" />
        <TabButton active={activeTab === "likes"} onClick={() => setActiveTab("likes")} icon={<Heart size={24} />} label="Liked" />
      </div>

      {/* GRID CONTENT */}
      <div style={contentAreaStyle}>
        <div style={gridStyle}>
          {videosToDisplay.map(v => (
            <VideoCard 
              key={`${v.chat_id}:${v.message_id}`} 
              video={v} 
              onOpen={(videoData, e) => handleOpenVideo(videoData, e)} 
              showDetails={false} 
            />
          ))}
        </div>
        
        {loading && (
           <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>Loading shots...</div>
        )}
        
        {!loading && videosToDisplay.length > 0 && (
          <button onClick={loadMore} style={loadMoreBtnStyle}>Load More</button>
        )}
      </div>
    </div>
  );
}

// 🎨 COMPONENT UI PARTS
const TabButton = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} style={{ 
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", 
    background: "none", border: "none", padding: "12px 0",
    borderBottom: active ? "2px solid #fff" : "1px solid #1a1a1a",
    opacity: active ? 1 : 0.4, color: "#fff", cursor: "pointer",
    transition: "all 0.2s ease"
  }}>
    {icon}
    <span style={{ fontSize: "10px", fontWeight: "700", marginTop: "6px" }}>{label}</span>
  </button>
);

// 🖌 STYLES
const containerStyle = { minHeight: "100%", background: "var(--bg-color)", color: "#fff", paddingBottom: "100px" };
const navGridStyle = { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid #1a1a1a", position: "sticky", top: 0, background: "var(--bg-color)", zIndex: 100, backdropFilter: "blur(15px)" };
const centerTitleContainer = { display: "flex", alignItems: "center" };
const usernameStyle = { fontSize: "16px", fontWeight: "700", margin: 0 };
const headerSectionStyle = { padding: "20px" };
const profileTopRowStyle = { display: "flex", alignItems: "center", gap: "20px", marginBottom: "20px" };
const avatarContainerStyle = { width: "80px", height: "80px", borderRadius: "50%", padding: "2px", background: "linear-gradient(45deg, #FFD700, var(--primary-color))" };
const avatarImageStyle = { width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", border: "2px solid #000" };
const infoColumnStyle = { flex: 1 };
const displayNameStyle = { fontSize: "20px", fontWeight: "800", margin: "0 0 4px 0" };
const bioStyle = { fontSize: "13px", color: "#aaa", margin: 0, lineHeight: "1.4" };
const actionButtonsRowStyle = { display: "flex", gap: "10px" };
const premiumButtonStyle = { flex: 1, background: "var(--primary-color)", color: "#fff", border: "none", borderRadius: "8px", padding: "12px", fontWeight: "800", fontSize: "13px", cursor: "pointer" };
const secondaryButtonStyle = { background: "#1a1a1a", color: "#fff", border: "1px solid #333", borderRadius: "8px", padding: "0 15px", display: "flex", alignItems: "center" };
const tabsContainerStyle = { display: "flex", borderBottom: "1px solid #1a1a1a", position: "sticky", top: "48px", background: "var(--bg-color)", zIndex: 90 };
const contentAreaStyle = { width: "100%" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px" };
const loadMoreBtnStyle = { display: "block", width: "100%", padding: "20px", background: "none", border: "none", color: "#8e8e8e", fontSize: "13px", fontWeight: "600", cursor: "pointer" };