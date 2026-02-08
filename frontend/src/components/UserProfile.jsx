import React, { useState, useEffect } from "react";
import { 
  Settings, Grid3X3, Heart, Lock, LogOut, 
  CheckCircle, Share2, ArrowLeft, ChevronRight, User, Shield, Bell 
} from "lucide-react";

import VideoCard from "./VideoCard"; 
import FullscreenPlayer from "./FullscreenPlayer"; 
import { useVideos } from "../hooks/useVideos";
import { openRewardedAd } from "../utils/rewardedAd";
import { adReturnWatcher } from "../utils/adReturnWatcher";

export default function UserProfile({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("videos");
  const [currentView, setCurrentView] = useState("profile");
  const [activeVideo, setActiveVideo] = useState(null);
  const [unlockedVideos, setUnlockedVideos] = useState(new Set());
  const [videoCache, setVideoCache] = useState({});
  const isDesktop = window.innerWidth > 1024;

  const { videos, loading, loadMore } = useVideos("shots");

  useEffect(() => {
    if (videos?.length > 0) {
      setVideoCache(prev => ({ ...prev, shots: videos }));
    }
  }, [videos]);

  const handleOpenVideo = async (video) => {
    const videoKey = `${video.chat_id}:${video.message_id}`;
    if (unlockedVideos.has(videoKey)) { playVideo(video); return; }
    
    try {
      openRewardedAd();
      const nextSet = new Set(unlockedVideos);
      nextSet.add(videoKey);
      setUnlockedVideos(nextSet);
      localStorage.setItem("unlockedVideos", JSON.stringify([...nextSet]));
      await adReturnWatcher();
      playVideo(video);
    } catch (err) { playVideo(video); }
  };

  const playVideo = async (video) => {
    try {
      setActiveVideo({ ...video, video_url: null }); 
      const res = await fetch(`https://videos.naijahomemade.com/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`);
      const data = await res.json();
      if (data.video_url) {
        setActiveVideo(prev => ({ ...prev, video_url: data.video_url }));
      }
    } catch (e) { console.error("Video fetch failed"); }
  };

  const videosToDisplay = videoCache["shots"] || videos || [];

  // 🟢 SETTINGS VIEW
  if (currentView === "settings") {
    return (
      <div style={containerStyle}>
        <div style={navBarStyle}>
          <ArrowLeft size={24} color="#fff" onClick={() => setCurrentView("profile")} style={{ cursor: "pointer" }} />
          <h2 style={headerTitleStyle}>Settings</h2>
          <div style={{ width: "24px" }} />
        </div>
        <div style={{ padding: "10px 0" }}>
          <SettingsItem icon={<User size={20} />} label="Account" />
          <SettingsItem icon={<Lock size={20} />} label="Privacy" />
          <SettingsItem icon={<Shield size={20} />} label="Security" />
          <SettingsItem icon={<Bell size={20} />} label="Notifications" />
          <div style={{ height: "1px", background: "#222", margin: "20px 0" }} />
          <div style={{...settingsItemStyle, color: "#ff3b30"}} onClick={onLogout}>
            <LogOut size={20} />
            <span style={{ flex: 1, marginLeft: "15px", fontWeight: "600" }}>Log out</span>
          </div>
        </div>
      </div>
    );
  }

  // 🟢 MAIN PROFILE VIEW
  return (
    <div style={containerStyle}>
      {/* HEADER GRID */}
      <div style={navGridStyle}>
        {/* Left Spacer */}
        <div style={{ width: "40px" }}></div>
        
        {/* Center Title */}
        <div style={centerTitleContainer}>
          <h2 style={usernameStyle}>{user.username}</h2>
          <CheckCircle size={14} color="#20D5EC" fill="black" style={{ marginLeft: "4px" }} />
        </div>

        {/* 🟢 Right Icons (Pushed to Extreme Right) */}
        <div style={{ display: "flex", gap: "16px", justifyContent: "flex-end", flex: 1 }}>
          <Bell size={24} color="#fff" style={{ cursor: "pointer" }} />
          <Settings size={24} color="#fff" onClick={() => setCurrentView("settings")} style={{ cursor: "pointer" }} />
        </div>
      </div>

      <div style={headerSectionStyle}>
        <div style={profileTopRowStyle}>
          <div style={avatarContainerStyle}>
            <img 
              src={user.avatar_url || "/assets/default-avatar.png"} 
              onError={(e) => { e.target.onerror = null; e.target.src = "/assets/default-avatar.png"; }}
              style={avatarImageStyle} alt="Avatar"
            />
          </div>
          <div style={infoColumnStyle}>
            <h1 style={displayNameStyle}>@{user.username}</h1>
            <p style={bioStyle}>
              <b>Official Preview Channel</b><br/>
              Catch my latest shots here before they hit Premium 💎
            </p>
          </div>
        </div>

        {/* 🟢 NEW: RED PREMIUM BUTTON */}
        <div style={actionButtonsRowStyle}>
          <button style={premiumButtonStyle} onClick={() => alert("Redirecting to Premium...")}>
            SUBSCRIBE PREMIUM
          </button>
          <button style={secondaryButtonStyle} onClick={() => alert("Share Profile")}>
            <Share2 size={18} />
          </button>
        </div>
      </div>

      <div style={tabsContainerStyle}>
        <TabButton active={activeTab === "videos"} onClick={() => setActiveTab("videos")} icon={<Grid3X3 size={24} />} label="Shots" />
        <TabButton active={activeTab === "premium"} onClick={() => setActiveTab("premium")} icon={<Lock size={24} />} label="Premium" />
        <TabButton active={activeTab === "likes"} onClick={() => setActiveTab("likes")} icon={<Heart size={24} />} label="Liked" />
      </div>

      <div style={contentAreaStyle}>
        {activeTab === "videos" ? (
          <div style={gridStyle}>
            {videosToDisplay.length > 0 ? videosToDisplay.map(v => (
              <VideoCard key={v.message_id} video={v} layoutType="shots" onOpen={() => handleOpenVideo(v)} />
            )) : (
              <div style={{ gridColumn: "span 3", textAlign: "center", padding: "40px", color: "#666" }}>
                {loading ? "Loading..." : "No Shots found."}
              </div>
            )}
            {!loading && videosToDisplay.length > 0 && (
              <div style={{ gridColumn: "span 3", padding: "20px", display: "flex", justifyContent: "center" }}>
                <button onClick={loadMore} style={loadMoreStyle}>Load More</button>
              </div>
            )}
          </div>
        ) : (
          <div style={emptyStateStyle}>
            <div style={emptyIconCircle}>
              {activeTab === "premium" ? <Lock size={32} color="#444" /> : <Heart size={32} color="#444" />}
            </div>
            <h3 style={{ margin: "10px 0", fontSize: "16px" }}>{activeTab === "premium" ? "Premium Content" : "No Liked Videos"}</h3>
            <p style={{ color: "#666", fontSize: "14px" }}>{activeTab === "premium" ? "Join the inner circle to unlock." : "Start exploring to save videos."}</p>
          </div>
        )}
      </div>

      {activeVideo && (
        <FullscreenPlayer 
          video={activeVideo} 
          onClose={() => setActiveVideo(null)} 
          isDesktop={isDesktop} 
        />
      )}
    </div>
  );
}

// 🎨 COMPONENT STYLES
const TabButton = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} style={{ 
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", 
    background: "none", border: "none", padding: "12px 0",
    borderBottom: active ? "2.5px solid #fff" : "1px solid #222",
    opacity: active ? 1 : 0.5, 
    color: active ? "#fff" : "#fff", cursor: "pointer", transition: "0.2s"
  }}>
    {icon}
    <span style={{ fontSize: "12px", fontWeight: "700", marginTop: "6px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</span>
  </button>
);

const SettingsItem = ({ icon, label }) => (
  <div style={settingsItemStyle} onClick={() => alert(label)}>
    {icon} <span style={{ flex: 1, marginLeft: "15px" }}>{label}</span> <ChevronRight size={16} color="#444" />
  </div>
);

// 🖌 STYLES
const containerStyle = { minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "sans-serif" };

// 🟢 HEADER GRID (Optimized for Extreme Right Alignment)
const navGridStyle = { 
  display: "grid", 
  gridTemplateColumns: "1fr auto 1fr", 
  alignItems: "center", 
  padding: "15px 20px", 
  borderBottom: "1px solid #222", 
  position: "sticky", 
  top: 0, 
  background: "rgba(0,0,0,0.95)", 
  zIndex: 100, 
  backdropFilter: "blur(10px)" 
};

const navBarStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 20px", borderBottom: "1px solid #222" };
const centerTitleContainer = { display: "flex", alignItems: "center", justifyContent: "center" };
const usernameStyle = { fontSize: "16px", fontWeight: "700", margin: 0 };
const headerTitleStyle = { fontSize: "16px", fontWeight: "700", margin: 0, flex: 1, textAlign: "center" };
const headerSectionStyle = { padding: "20px" };
const profileTopRowStyle = { display: "flex", alignItems: "flex-start", gap: "20px", marginBottom: "20px" };
const avatarContainerStyle = { width: "86px", height: "86px", borderRadius: "50%", padding: "2px", background: "linear-gradient(45deg, #FFD700, #ff3b30)" };
const avatarImageStyle = { width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", border: "3px solid #000" };
const infoColumnStyle = { flex: 1, paddingTop: "4px" };
const displayNameStyle = { fontSize: "20px", fontWeight: "800", margin: "0 0 6px 0" };
const bioStyle = { fontSize: "13px", color: "#ccc", margin: 0, lineHeight: "1.4" };
const actionButtonsRowStyle = { display: "flex", gap: "10px", alignItems: "center" };

// 🟢 BEAUTIFUL PREMIUM BUTTON STYLE
const premiumButtonStyle = { 
  flex: 1, 
  background: "linear-gradient(45deg, #ff3b30, #d70015)", // Vibrant Red Gradient
  color: "#fff", 
  border: "none", 
  borderRadius: "10px", 
  padding: "12px", 
  fontWeight: "800", // Extra Bold
  fontSize: "14px", 
  textTransform: "uppercase",
  letterSpacing: "0.5px",
  boxShadow: "0 4px 15px rgba(255, 59, 48, 0.4)", // Red Glow
  cursor: "pointer",
  transition: "transform 0.1s ease"
};

const secondaryButtonStyle = { background: "#1E1E1E", color: "#fff", border: "1px solid #333", borderRadius: "10px", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "center" };

const tabsContainerStyle = { display: "flex", background: "#000", position: "sticky", top: "54px", zIndex: 90 };
const contentAreaStyle = { minHeight: "400px" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px" };
const loadMoreStyle = { padding: "10px 24px", background: "#111", border: "none", color: "#fff", borderRadius: "30px", fontWeight: "600", fontSize: "13px" };
const emptyStateStyle = { textAlign: "center", padding: "80px 20px" };
const emptyIconCircle = { width: "64px", height: "64px", borderRadius: "50%", border: "2px solid #222", display: "inline-flex", alignItems: "center", justifyContent: "center" };
const settingsItemStyle = { display: "flex", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #111", cursor: "pointer" };