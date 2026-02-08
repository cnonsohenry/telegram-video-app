import React, { useState } from "react";
import { 
  Settings, Grid3X3, Heart, Lock, LogOut, 
  CheckCircle, Share2, ArrowLeft, ChevronRight, User, Shield, Bell 
} from "lucide-react";

export default function UserProfile({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("videos");
  const [currentView, setCurrentView] = useState("profile"); // 'profile' or 'settings'

  // 🟢 SETTINGS SCREEN COMPONENT
  if (currentView === "settings") {
    return (
      <div style={containerStyle}>
        {/* Settings Header */}
        <div style={navBarStyle}>
          <ArrowLeft 
            size={24} 
            color="#fff" 
            onClick={() => setCurrentView("profile")} 
            style={{ cursor: "pointer" }} 
          />
          <h2 style={{...usernameStyle, flex: 1, justifyContent: "center", marginRight: "24px"}}>
            Settings and activity
          </h2>
        </div>

        {/* Settings List */}
        <div style={{ padding: "10px 0" }}>
          <SettingsItem icon={<User size={20} />} label="Account" />
          <SettingsItem icon={<Lock size={20} />} label="Privacy" />
          <SettingsItem icon={<Shield size={20} />} label="Security" />
          <SettingsItem icon={<Bell size={20} />} label="Notifications" />
          
          <div style={{ height: "1px", background: "#222", margin: "20px 0" }} />
          
          <div 
            style={{...settingsItemStyle, color: "#ff3b30"}} 
            onClick={onLogout}
          >
            <LogOut size={20} />
            <span style={{ flex: 1, marginLeft: "15px", fontWeight: "600" }}>Log out</span>
          </div>
          
          <p style={{ textAlign: "center", color: "#444", fontSize: "12px", marginTop: "40px" }}>
            Version 1.0.0
          </p>
        </div>
      </div>
    );
  }

  // 🟢 MAIN PROFILE SCREEN
  return (
    <div style={containerStyle}>
      {/* Top Navigation */}
      <div style={navBarStyle}>
        <div style={{ width: "24px" }} /> {/* Spacer */}
        <h2 style={usernameStyle}>
          {user.username} 
          <CheckCircle size={14} color="#20D5EC" fill="black" style={{ marginLeft: "4px" }} />
        </h2>
        
        {/* Settings Button (Direct Link) */}
        <Settings 
          size={24} 
          color="#fff" 
          onClick={() => setCurrentView("settings")} 
          style={{ cursor: "pointer" }} 
        />
      </div>

      {/* 🟢 NEW HORIZONTAL HEADER LAYOUT */}
      <div style={headerSectionStyle}>
        
        <div style={profileTopRowStyle}>
          {/* Left Side: Avatar */}
          <div style={avatarContainerStyle}>
            <img 
              src={user.avatar_url || "/assets/default-avatar.png"} 
              onError={(e) => { e.target.onerror = null; e.target.src = "/assets/default-avatar.png"; }}
              style={avatarImageStyle} 
              alt="Profile"
            />
          </div>

          {/* Right Side: Bio & Info */}
          <div style={infoColumnStyle}>
            <h1 style={displayNameStyle}>@{user.username}</h1>
            <p style={bioStyle}>
              Creator on NaijaHomemade 🇳🇬 <br/>
              Building the future of video sharing.
            </p>
          </div>
        </div>

        {/* Action Buttons (Below the info) */}
        <div style={actionButtonsRowStyle}>
          <button style={primaryButtonStyle} onClick={() => alert("Edit Profile")}>Edit profile</button>
          <button style={secondaryButtonStyle} onClick={() => alert("Share Profile")}>
            <Share2 size={18} />
          </button>
        </div>
      </div>

      {/* Sticky Tabs */}
      <div style={tabsContainerStyle}>
        <TabButton active={activeTab === "videos"} onClick={() => setActiveTab("videos")} icon={<Grid3X3 size={20} />} />
        <TabButton active={activeTab === "premium"} onClick={() => setActiveTab("premium")} icon={<Lock size={20} />} />
        <TabButton active={activeTab === "likes"} onClick={() => setActiveTab("likes")} icon={<Heart size={20} />} />
      </div>

      {/* Content Grid */}
      <div style={contentAreaStyle}>
        <div style={gridStyle}>
          <div style={emptyStateStyle}>
            <div style={emptyIconCircle}>
              {activeTab === "videos" ? <Grid3X3 size={32} color="#666" /> : 
               activeTab === "premium" ? <Lock size={32} color="#666" /> : 
               <Heart size={32} color="#666" />}
            </div>
            <h3 style={{ fontSize: "16px", fontWeight: "600", marginTop: "15px" }}>
              {activeTab === "videos" ? "Share your first video" : 
               activeTab === "premium" ? "Premium content locked" : "You haven't liked any videos"}
            </h3>
            <p style={{ color: "#888", fontSize: "13px", marginTop: "5px" }}>
              {activeTab === "videos" ? "Tap the + button to start creating." : 
               "Videos you interact with will appear here."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// 🎨 SUB-COMPONENTS

const TabButton = ({ active, onClick, icon }) => (
  <button onClick={onClick} style={{ 
    flex: 1, background: "none", border: "none", 
    borderBottom: active ? "2px solid #fff" : "1px solid #222", 
    padding: "12px 0", color: active ? "#fff" : "#666",
    cursor: "pointer", transition: "all 0.2s"
  }}>
    {icon}
  </button>
);

const SettingsItem = ({ icon, label }) => (
  <div style={settingsItemStyle} onClick={() => alert(`${label} clicked`)}>
    {React.cloneElement(icon, { color: "#fff" })}
    <span style={{ flex: 1, marginLeft: "15px", fontSize: "15px", fontWeight: "500" }}>{label}</span>
    <ChevronRight size={16} color="#666" />
  </div>
);

// 🖌 STYLES

const containerStyle = { minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "-apple-system, sans-serif", paddingBottom: "80px" };
const navBarStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 20px", borderBottom: "0.5px solid #222", position: "sticky", top: 0, background: "rgba(0,0,0,0.9)", backdropFilter: "blur(10px)", zIndex: 100 };
const usernameStyle = { fontSize: "17px", fontWeight: "700", display: "flex", alignItems: "center", margin: 0 };
const settingsItemStyle = { display: "flex", alignItems: "center", padding: "16px 20px", cursor: "pointer", transition: "background 0.2s" };

const headerSectionStyle = { padding: "20px", display: "flex", flexDirection: "column" };

// New Horizontal Layout Styles
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