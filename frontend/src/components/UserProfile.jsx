import React, { useState } from "react";
import { 
  Settings, Grid3X3, Heart, Lock, LogOut, 
  CheckCircle, Share2, ArrowLeft, ChevronRight, User, Shield, Bell 
} from "lucide-react";

import VideoCard from "../components/VideoCard"; 
import FullscreenPlayer from "../components/FullscreenPlayer"; 
import { useVideos } from "../hooks/useVideos";

export default function UserProfile({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("videos");
  const [currentView, setCurrentView] = useState("profile");
  const [activeVideo, setActiveVideo] = useState(null);
  
  const isDesktop = window.innerWidth > 1024;

  // FETCH STREAMS
  const { videos: shots, loading: shotsLoading, loadMore: loadMoreShots } = useVideos("shots");
  const { videos: premium, loading: premiumLoading, loadMore: loadMorePremium } = useVideos("premium");

  const handleOpenVideo = async (video) => {
    setActiveVideo({ ...video, video_url: null }); 
    try {
      const res = await fetch(`https://videos.naijahomemade.com/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`);
      const data = await res.json();
      if (data.video_url) {
        setActiveVideo(prev => ({ ...prev, video_url: data.video_url }));
      }
    } catch (e) { console.error("Video fetch failed"); }
  };

  // SELECT LIST
  const getCurrentList = () => {
    if (activeTab === "premium") {
      return { 
        data: premium || [], 
        loading: premiumLoading, 
        loadMore: loadMorePremium,
        emptyTitle: "No Premium Content",
        emptyMsg: "Stay tuned for exclusive drops."
      };
    }
    return { 
      data: shots || [], 
      loading: shotsLoading, 
      loadMore: loadMoreShots,
      emptyTitle: "No Shots found",
      emptyMsg: "Start uploading to see them here."
    };
  };

  const { data: videosToDisplay, loading, loadMore, emptyTitle, emptyMsg } = getCurrentList();

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
          
          {/* 🟢 ATOMIC LOGOUT HANDLER */}
          <div 
            style={{...settingsItemStyle, color: "#ff3b30", borderBottom: "none"}} 
            onClick={() => {
              if (window.confirm("Are you sure you want to log out?")) {
                // 1. Instantly flip local state so we don't "hang" in settings
                setCurrentView("profile");
                // 2. Trigger the global logout from App.jsx
                onLogout(); 
              }
            }}
          >
            <LogOut size={20} />
            <span style={{ flex: 1, marginLeft: "15px", fontWeight: "700" }}>Log out</span>
          </div>
        </div>
      </div>
    );
  }

  // MAIN PROFILE VIEW
  return (
    <div style={containerStyle}>
      {/* HEADER GRID */}
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
            <img 
              src={user?.avatar_url || "/assets/default-avatar.png"} 
              onError={(e) => { e.target.onerror = null; e.target.src = "/assets/default-avatar.png"; }}
              style={avatarImageStyle} alt="Avatar"
            />
          </div>
          <div style={infoColumnStyle}>
            <h1 style={displayNameStyle}>@{user?.username || "user"}</h1>
            <p style={bioStyle}>
              <b>Official Preview Channel</b><br/>
              Catch my latest shots here before they hit Premium 💎
            </p>
          </div>
        </div>

        <div style={actionButtonsRowStyle}>
          <button style={premiumButtonStyle} onClick={() => alert("Premium Subscriptions coming soon!")}>
            SUBSCRIBE PREMIUM
          </button>
          <button style={secondaryButtonStyle} onClick={() => {
            navigator.clipboard.writeText(window.location.href);
            alert("Profile link copied!");
          }}>
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
        {activeTab !== "likes" ? (
          <div style={gridStyle}>
            {videosToDisplay.length > 0 ? videosToDisplay.map(v => (
              <VideoCard 
                key={`${v.chat_id || 'internal'}:${v.message_id}`} 
                video={v} 
                layoutType={activeTab === "premium" ? "premium" : "shots"} 
                onOpen={() => handleOpenVideo(v)} 
                showDetails={false} 
              />
            )) : (
              <div style={{ gridColumn: "span 3", textAlign: "center", padding: "60px 20px", color: "#666" }}>
                {loading ? "Loading content..." : emptyTitle}
                {!loading && <p style={{ fontSize: "13px", marginTop: "8px" }}>{emptyMsg}</p>}
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
              <Heart size={32} color="#444" />
            </div>
            <h3 style={{ margin: "15px 0", fontSize: "16px" }}>No Liked Videos</h3>
            <p style={{ color: "#666", fontSize: "14px" }}>Start exploring to save videos to your profile.</p>
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

// 🎨 HELPER COMPONENTS
const TabButton = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} style={{ 
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center", 
    background: "none", border: "none", padding: "12px 0",
    borderBottom: active ? "2.5px solid #fff" : "1px solid #222",
    opacity: active ? 1 : 0.4, 
    color: "#fff", cursor: "pointer", transition: "0.2s"
  }}>
    {icon}
    <span style={{ fontSize: "10px", fontWeight: "700", marginTop: "6px", textTransform: "uppercase" }}>{label}</span>
  </button>
);

const SettingsItem = ({ icon, label }) => (
  <div style={settingsItemStyle} onClick={() => alert(`${label} settings coming soon!`)}>
    {icon} <span style={{ flex: 1, marginLeft: "15px" }}>{label}</span> <ChevronRight size={16} color="#444" />
  </div>
);

// 🖌 STYLES (Keep as you have them)
const containerStyle = { minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif" };
const navGridStyle = { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid #222", position: "sticky", top: 0, background: "rgba(0,0,0,0.9)", zIndex: 100, backdropFilter: "blur(10px)" };
const navBarStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 20px", borderBottom: "1px solid #222" };
const centerTitleContainer = { display: "flex", alignItems: "center" };
const usernameStyle = { fontSize: "16px", fontWeight: "700", margin: 0 };
const headerTitleStyle = { fontSize: "16px", fontWeight: "700", margin: 0, flex: 1, textAlign: "center" };
const headerSectionStyle = { padding: "20px" };
const profileTopRowStyle = { display: "flex", alignItems: "center", gap: "20px", marginBottom: "20px" };
const avatarContainerStyle = { width: "80px", height: "80px", borderRadius: "50%", padding: "2px", background: "linear-gradient(45deg, #FFD700, #ff3b30)" };
const avatarImageStyle = { width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", border: "2px solid #000" };
const infoColumnStyle = { flex: 1 };
const displayNameStyle = { fontSize: "20px", fontWeight: "800", margin: "0 0 4px 0" };
const bioStyle = { fontSize: "13px", color: "#aaa", margin: 0, lineHeight: "1.4" };
const actionButtonsRowStyle = { display: "flex", gap: "10px" };
const premiumButtonStyle = { flex: 1, background: "linear-gradient(45deg, #ff3b30, #d70015)", color: "#fff", border: "none", borderRadius: "8px", padding: "12px", fontWeight: "800", fontSize: "13px", cursor: "pointer" };
const secondaryButtonStyle = { background: "#1E1E1E", color: "#fff", border: "1px solid #333", borderRadius: "8px", padding: "0 15px", display: "flex", alignItems: "center" };
const tabsContainerStyle = { display: "flex", borderBottom: "1px solid #111", position: "sticky", top: "45px", background: "#000", zIndex: 90 };
const contentAreaStyle = { minHeight: "400px" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px" };
const loadMoreStyle = { padding: "10px 24px", background: "#111", border: "1px solid #222", color: "#fff", borderRadius: "20px", fontSize: "12px", cursor: "pointer" };
const emptyStateStyle = { textAlign: "center", padding: "100px 20px" };
const emptyIconCircle = { width: "60px", height: "60px", borderRadius: "50%", border: "1px solid #222", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "15px" };
const settingsItemStyle = { display: "flex", alignItems: "center", padding: "18px 20px", borderBottom: "1px solid #111", cursor: "pointer" };