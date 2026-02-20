import React, { useState, useEffect } from "react";
import { Settings, Grid3X3, Heart, Lock, CheckCircle, Share2 } from "lucide-react";
import VideoCard from "../components/VideoCard"; 
import FullscreenPlayer from "../components/FullscreenPlayer"; 
import SettingsView from "./SettingsView"; // 🟢 Import the new component
import { useVideos } from "../hooks/useVideos";

export default function UserProfile({ user, onLogout, setHideFooter }) {
  const [activeTab, setActiveTab] = useState("videos");
  const [currentView, setCurrentView] = useState("profile");
  const [activeVideo, setActiveVideo] = useState(null);

  useEffect(() => {
    // 🟢 The logic gate
    if (activeVideo || currentView === "settings") {
      setHideFooter(true);
    } else {
      setHideFooter(false);
    }

    // Cleanup: Ensure footer returns if the user navigates away 
    // from the Profile tab entirely
    return () => setHideFooter(false);
  }, [activeVideo, currentView, setHideFooter]);
  
  const isDesktop = window.innerWidth > 1024;
  const { videos: shots, loading: shotsLoading, loadMore: loadMoreShots } = useVideos("shots");
  const { videos: premium, loading: premiumLoading, loadMore: loadMorePremium } = useVideos("premium");

  const handleOpenVideo = async (video) => {
    setActiveVideo({ ...video, video_url: null }); 
    try {
      const res = await fetch(`https://videos.naijahomemade.com/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`);
      const data = await res.json();
      if (data.video_url) setActiveVideo(prev => ({ ...prev, video_url: data.video_url }));
    } catch (e) { console.error("Video fetch failed"); }
  };

  const { data: videosToDisplay, loading, loadMore, emptyTitle, emptyMsg } = activeTab === "premium" 
    ? { data: premium || [], loading: premiumLoading, loadMore: loadMorePremium, emptyTitle: "No Premium Content", emptyMsg: "Stay tuned." }
    : { data: shots || [], loading: shotsLoading, loadMore: loadMoreShots, emptyTitle: "No Shots found", emptyMsg: "Start uploading." };

  // 🟢 RENDER SETTINGS VIEW
  if (currentView === "settings") {
    return <SettingsView 
      onBack={() => setCurrentView("profile")} 
      onLogout={() => {
        setCurrentView("profile"); // Reset view state
        onLogout(); // Trigger global logout
      }} 
    />;
  }

  // MAIN PROFILE VIEW
  return (
    <div style={containerStyle}>
      <div style={navGridStyle}>
        <div style={{ width: "40px" }}></div>
        <div style={centerTitleContainer}>
          <h2 style={usernameStyle}>{user?.username || "Guest"}</h2>
          <CheckCircle size={14} color="#20D5EC" fill="black" style={{ marginLeft: "4px" }} />
        </div>
        <div style={{ display: "flex", gap: "16px", justifyContent: "flex-end", flex: 1 }}>
          <Settings size={24} color="#fff" onClick={() => setCurrentView("settings")} style={{ cursor: "pointer" }} />
        </div>
      </div>

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

      <div style={tabsContainerStyle}>
        <TabButton active={activeTab === "videos"} onClick={() => setActiveTab("videos")} icon={<Grid3X3 size={24} />} label="Shots" />
        <TabButton active={activeTab === "premium"} onClick={() => setActiveTab("premium")} icon={<Lock size={24} />} label="Premium" />
        <TabButton active={activeTab === "likes"} onClick={() => setActiveTab("likes")} icon={<Heart size={24} />} label="Liked" />
      </div>

      <div style={contentAreaStyle}>
        <div style={gridStyle}>
          {videosToDisplay.map(v => (
            <VideoCard 
              key={`${v.chat_id}:${v.message_id}`} // 🟢 More unique key
              video={v} 
              onOpen={() => handleOpenVideo(v)} 
              showDetails={false} 
            />
          ))}
        </div>
      </div>

      {activeVideo && <FullscreenPlayer video={activeVideo} onClose={() => setActiveVideo(null)} isDesktop={isDesktop} />}
    </div>
  );
}

// 🎨 SHARED TAB BUTTON
const TabButton = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} style={{ 
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", 
    background: "none", border: "none", padding: "12px 0",
    borderBottom: active ? "2.5px solid #fff" : "1px solid #222",
    opacity: active ? 1 : 0.4, color: "#fff", cursor: "pointer"
  }}>
    {icon}
    <span style={{ fontSize: "10px", fontWeight: "700", marginTop: "6px" }}>{label}</span>
  </button>
);

// Styles... (Your existing styles remain here)
const containerStyle = { minHeight: "100vh", background: "var(--bg-color)", color: "#fff" };
const navGridStyle = { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid #222", position: "sticky", top: 0, background: "var(--bg-color)", zIndex: 100, backdropFilter: "blur(10px)" };
const centerTitleContainer = { display: "flex", alignItems: "center" };
const usernameStyle = { fontSize: "16px", fontWeight: "700", margin: 0 };
const headerSectionStyle = { padding: "20px" };
const profileTopRowStyle = { display: "flex", alignItems: "center", gap: "20px", marginBottom: "20px" };
const avatarContainerStyle = { width: "80px", height: "80px", borderRadius: "50%", padding: "2px", background: "linear-gradient(45deg, #FFD700, var(--primary-color))" };
const avatarImageStyle = { width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", border: "2px solid var(--bg-color)" };
const infoColumnStyle = { flex: 1 };
const displayNameStyle = { fontSize: "20px", fontWeight: "800", margin: "0 0 4px 0" };
const bioStyle = { fontSize: "13px", color: "#aaa", margin: 0, lineHeight: "1.4" };
const actionButtonsRowStyle = { display: "flex", gap: "10px" };
const premiumButtonStyle = { flex: 1, background: "linear-gradient(45deg, #ff3b30, var(--primary-color))", color: "#fff", border: "none", borderRadius: "8px", padding: "12px", fontWeight: "800", fontSize: "13px", cursor: "pointer" };
const secondaryButtonStyle = { background: "#1E1E1E", color: "#fff", border: "1px solid #333", borderRadius: "8px", padding: "0 15px", display: "flex", alignItems: "center" };
const tabsContainerStyle = { display: "flex", borderBottom: "1px solid #111", position: "sticky", top: "45px", background: "var(--bg-color)", zIndex: 90 };
const contentAreaStyle = { minHeight: "400px" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px" };