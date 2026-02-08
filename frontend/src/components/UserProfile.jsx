import React, { useState, useEffect } from "react";
import { 
  Settings, Grid3X3, Heart, Lock, LogOut, 
  CheckCircle, Share2, ArrowLeft, ChevronRight, User, Shield, Bell 
} from "lucide-react";

// 🟢 NEW IMPORTS (Video Logic)
import VideoCard from "./VideoCard"; 
import FullscreenPlayer from "./FullscreenPlayer"; 
import { useVideos } from "../hooks/useVideos";
import { openRewardedAd } from "../utils/rewardedAd";
import { adReturnWatcher } from "../utils/adReturnWatcher";

export default function UserProfile({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("videos");
  const [currentView, setCurrentView] = useState("profile");
  
  // 🟢 VIDEO STATE (Copied from Home.jsx)
  const [activeVideo, setActiveVideo] = useState(null);
  const [unlockedVideos, setUnlockedVideos] = useState(new Set());
  const [videoCache, setVideoCache] = useState({});
  const isDesktop = window.innerWidth > 1024;

  // 🟢 FETCH VIDEOS (Category: "shots")
  const { videos, loading, loadMore } = useVideos("shots");

  // 🟢 CACHE LOGIC
  useEffect(() => {
    if (videos && videos.length > 0) {
      setVideoCache(prev => ({ ...prev, shots: videos }));
    }
  }, [videos]);

  // 🟢 VIDEO UNLOCKING LOGIC
  useEffect(() => {
    const saved = localStorage.getItem("unlockedVideos");
    if (saved) setUnlockedVideos(new Set(JSON.parse(saved)));
  }, []);

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
    } catch (e) { alert("Error fetching video link"); }
  };

  // Decide what to render (Cache vs Live)
  const videosToDisplay = (videoCache["shots"] && videoCache["shots"].length > 0) 
    ? videoCache["shots"] 
    : videos;

  // 🟢 SETTINGS SCREEN
  if (currentView === "settings") {
    return (
      <div style={containerStyle}>
        <div style={navBarStyle}>
          <ArrowLeft size={24} color="#fff" onClick={() => setCurrentView("profile")} style={{ cursor: "pointer" }} />
          <h2 style={{...usernameStyle, flex: 1, justifyContent: "center", marginRight: "24px"}}>Settings and activity</h2>
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
          <p style={{ textAlign: "center", color: "#444", fontSize: "12px", marginTop: "40px" }}>Version 1.0.0</p>
        </div>
      </div>
    );
  }

  // 🟢 MAIN PROFILE SCREEN
  return (
    <div style={containerStyle}>
      <div style={navBarStyle}>
        <div style={{ width: "24px" }} />
        <h2 style={usernameStyle}>{user.username} <CheckCircle size={14} color="#20D5EC" fill="black" style={{ marginLeft: "4px" }} /></h2>
        <div style={{ display: "flex", gap: "20px", alignItems: "center" }}>
          <Bell size={24} color="#fff" style={{ cursor: "pointer" }} onClick={() => alert("No new notifications")} />
          <Settings size={24} color="#fff" onClick={() => setCurrentView("settings")} style={{ cursor: "pointer" }} />
        </div>
      </div>

      <div style={headerSectionStyle}>
        <div style={profileTopRowStyle}>
          <div style={avatarContainerStyle}>
            <img 
              src={user.avatar_url || "/assets/default-avatar.png"} 
              onError={(e) => { e.target.onerror = null; e.target.src = "/assets/default-avatar.png"; }}
              style={avatarImageStyle} alt="Profile"
            />
          </div>
          <div style={infoColumnStyle}>
            <h1 style={displayNameStyle}>@{user.username}</h1>
            <p style={bioStyle}>Creator on NaijaHomemade 🇳🇬 <br/>Building the future of video sharing.</p>
          </div>
        </div>
        <div style={actionButtonsRowStyle}>
          <button style={primaryButtonStyle} onClick={() => alert("Edit Profile")}>Edit profile</button>
          <button style={secondaryButtonStyle} onClick={() => alert("Share Profile")}><Share2 size={18} /></button>
        </div>
      </div>

      <div style={tabsContainerStyle}>
        <TabButton active={activeTab === "videos"} onClick={() => setActiveTab("videos")} icon={<Grid3X3 size={24} />} label="Videos" />
        <TabButton active={activeTab === "premium"} onClick={() => setActiveTab("premium")} icon={<Lock size={24} />} label="Premium" />
        <TabButton active={activeTab === "likes"} onClick={() => setActiveTab("likes")} icon={<Heart size={24} />} label="Likes" />
      </div>

      <div style={contentAreaStyle}>
        <div style={gridStyle}>
          
          {/* 🟢 VIDEO TAB CONTENT */}
          {activeTab === "videos" ? (
            videosToDisplay.length > 0 ? (
              <>
                {videosToDisplay.map(v => (
                  <VideoCard 
                    key={`${v.chat_id}:${v.message_id}`} 
                    video={v} 
                    layoutType="shots" 
                    onOpen={() => handleOpenVideo(v)} 
                  />
                ))}
                
                {/* Show More Button */}
                {!loading && (
                   <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "center", padding: "20px" }}>
                     <button onClick={loadMore} style={loadMoreButtonStyle}>Show More</button>
                   </div>
                )}
              </>
            ) : (
              // Loading or Empty State
              <div style={emptyStateStyle}>
                 {loading ? "Loading..." : "No videos yet"}
              </div>
            )
          ) : (
            // OTHER TABS (Premium/Likes)
            <div style={emptyStateStyle}>
              <div style={emptyIconCircle}>
                {activeTab === "premium" ? <Lock size={32} color="#666" /> : <Heart size={32} color="#666" />}
              </div>
              <h3 style={{ fontSize: "16px", fontWeight: "600", marginTop: "15px" }}>
                {activeTab === "premium" ? "Premium content locked" : "You haven't liked any videos"}
              </h3>
              <p style={{ color: "#888", fontSize: "13px", marginTop: "5px" }}>
                Videos you interact with will appear here.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 🟢 FULLSCREEN PLAYER OVERLAY */}
      {activeVideo && (
        <div style={{ position: "fixed", inset: 0, zIndex: 2000 }}>
          <FullscreenPlayer 
            video={activeVideo} 
            onClose={() => setActiveVideo(null)} 
            isDesktop={isDesktop} 
          />
        </div>
      )}
    </div>
  );
}

// 🎨 SUB-COMPONENTS & STYLES
const TabButton = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "none", border: "none", borderBottom: active ? "2px solid #fff" : "1px solid #333", padding: "12px 0", color: active ? "#fff" : "#666", cursor: "pointer", transition: "all 0.2s", gap: "5px" }}>
    {React.cloneElement(icon, { color: active ? "#fff" : "#666" })}
    <span style={{ fontSize: "12px", fontWeight: active ? "600" : "400" }}>{label}</span>
  </button>
);

const SettingsItem = ({ icon, label }) => (
  <div style={settingsItemStyle} onClick={() => alert(`${label} clicked`)}>
    {React.cloneElement(icon, { color: "#fff" })}
    <span style={{ flex: 1, marginLeft: "15px", fontSize: "15px", fontWeight: "500" }}>{label}</span>
    <ChevronRight size={16} color="#666" />
  </div>
);

const containerStyle = { minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "-apple-system, sans-serif", paddingBottom: "80px" };
const navBarStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 20px", borderBottom: "0.5px solid #222", position: "sticky", top: 0, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(10px)", zIndex: 100 };
const usernameStyle = { fontSize: "17px", fontWeight: "700", display: "flex", alignItems: "center", margin: 0 };
const settingsItemStyle = { display: "flex", alignItems: "center", padding: "16px 20px", cursor: "pointer", transition: "background 0.2s" };
const headerSectionStyle = { padding: "20px", display: "flex", flexDirection: "column" };
const profileTopRowStyle = { display: "flex", alignItems: "center", marginBottom: "20px", gap: "20px" };
const infoColumnStyle = { display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" };
const avatarContainerStyle = { width: "86px", height: "86px", borderRadius: "50%", padding: "2px", background: "linear-gradient(45deg, #FFD700, #ff3b30)", flexShrink: 0 };
const avatarImageStyle = { width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", border: "3px solid #000" };
const displayNameStyle = { fontSize: "20px", fontWeight: "700", margin: "0 0 5px 0", lineHeight: "1.2" };
const bioStyle = { fontSize: "14px", color: "#ccc", margin: 0, lineHeight: "1.4" };
const actionButtonsRowStyle = { display: "flex", gap: "8px", width: "100%" };
const primaryButtonStyle = { flex: 1, background: "#1E1E1E", color: "#fff", border: "none", borderRadius: "8px", padding: "10px", fontSize: "14px", fontWeight: "600", cursor: "pointer" };
const secondaryButtonStyle = { background: "#1E1E1E", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 14px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
const tabsContainerStyle = { display: "flex", borderBottom: "1px solid #222", background: "#000", position: "sticky", top: "54px", zIndex: 40 };
const contentAreaStyle = { minHeight: "300px", background: "#000" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px" };
const emptyStateStyle = { gridColumn: "span 3", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "60px 20px", textAlign: "center" };
const emptyIconCircle = { width: "60px", height: "60px", borderRadius: "50%", border: "2px solid #333", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "15px" };
const loadMoreButtonStyle = { background: "#1c1c1e", color: "#fff", padding: "10px 24px", borderRadius: "30px", border: "none", fontWeight: "700", cursor: "pointer", fontSize: "13px" };