import React, { useState } from "react";
import { 
  Settings, Grid3X3, Heart, Lock, LogOut, Edit3, 
  CheckCircle, Share2 
} from "lucide-react";

export default function UserProfile({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("videos");
  const [showSettings, setShowSettings] = useState(false);

  return (
    <div style={containerStyle}>
      {/* 🟢 1. TOP NAVIGATION BAR */}
      <div style={navBarStyle}>
        <div style={{ width: "24px" }} /> {/* Spacer to center title */}
        <h2 style={usernameStyle}>
          {user.username} 
          <CheckCircle size={14} color="#20D5EC" fill="black" style={{ marginLeft: "4px" }} />
        </h2>
        
        {/* Settings Toggle */}
        <div style={{ position: "relative" }}>
          <Settings 
            size={24} 
            color="#fff" 
            onClick={() => setShowSettings(!showSettings)} 
            style={{ cursor: "pointer" }} 
          />
          
          {/* 🟢 DROPDOWN MENU */}
          {showSettings && (
            <div style={dropdownStyle}>
              <div style={dropdownItemStyle} onClick={() => alert("Edit Profile coming soon!")}>
                <Edit3 size={16} /> Edit Profile
              </div>
              <div style={{ height: "1px", background: "#333", margin: "4px 0" }} />
              <div style={{...dropdownItemStyle, color: "#ff3b30"}} onClick={onLogout}>
                <LogOut size={16} /> Log Out
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 🟢 2. PROFILE HEADER */}
      <div style={headerSectionStyle}>
        
        {/* Avatar with Status Ring */}
        <div style={avatarContainerStyle}>
          <img 
            src={user.avatar_url || "/assets/default-avatar.png"} 
            onError={(e) => { e.target.onerror = null; e.target.src = "/assets/default-avatar.png"; }}
            style={avatarImageStyle} 
            alt="Profile"
          />
        </div>

        {/* Username & Bio */}
        <h1 style={displayNameStyle}>@{user.username}</h1>
        <p style={bioStyle}>
          Creator on NaijaHomemade 🇳🇬 <br/>
          Building the future of video sharing.
        </p>

        {/* Stats Row */}
        <div style={statsRowStyle}>
          <StatBox count="0" label="Following" />
          <StatBox count="0" label="Followers" />
          <StatBox count="0" label="Likes" />
        </div>

        {/* Action Buttons */}
        <div style={actionButtonsRowStyle}>
          <button style={primaryButtonStyle} onClick={() => alert("Edit Profile")}>Edit profile</button>
          <button style={secondaryButtonStyle} onClick={() => alert("Share Profile")}>
            <Share2 size={18} />
          </button>
        </div>
      </div>

      {/* 🟢 3. TABS (Sticky) */}
      <div style={tabsContainerStyle}>
        <TabButton 
          active={activeTab === "videos"} 
          onClick={() => setActiveTab("videos")} 
          icon={<Grid3X3 size={20} />} 
        />
        <TabButton 
          active={activeTab === "premium"} 
          onClick={() => setActiveTab("premium")} 
          icon={<Lock size={20} />} 
        />
        <TabButton 
          active={activeTab === "likes"} 
          onClick={() => setActiveTab("likes")} 
          icon={<Heart size={20} />} 
        />
      </div>

      {/* 🟢 4. CONTENT GRID */}
      <div style={contentAreaStyle}>
        <div style={gridStyle}>
          {/* Empty State Logic */}
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

// 🎨 SUB-COMPONENTS & STYLES

const StatBox = ({ count, label }) => (
  <div style={{ textAlign: "center", minWidth: "60px" }}>
    <span style={{ fontWeight: "700", fontSize: "17px", display: "block" }}>{count}</span>
    <span style={{ fontSize: "13px", color: "#888" }}>{label}</span>
  </div>
);

const TabButton = ({ active, onClick, icon }) => (
  <button onClick={onClick} style={{ 
    flex: 1, 
    background: "none", 
    border: "none", 
    borderBottom: active ? "2px solid #fff" : "1px solid #222", 
    padding: "12px 0", 
    color: active ? "#fff" : "#666",
    cursor: "pointer",
    transition: "all 0.2s"
  }}>
    {icon}
  </button>
);

// CSS-IN-JS STYLES (Mobile Optimized)

const containerStyle = {
  minHeight: "100vh", 
  background: "#000", 
  color: "#fff", 
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  paddingBottom: "80px"
};

const navBarStyle = {
  display: "flex", 
  justifyContent: "space-between", 
  alignItems: "center", 
  padding: "15px 20px", 
  borderBottom: "0.5px solid #222",
  position: "sticky",
  top: 0,
  background: "rgba(0,0,0,0.9)",
  backdropFilter: "blur(10px)",
  zIndex: 100
};

const usernameStyle = { 
  fontSize: "17px", 
  fontWeight: "700", 
  display: "flex", 
  alignItems: "center" 
};

const dropdownStyle = {
  position: "absolute",
  right: 0,
  top: "35px",
  background: "#1E1E1E",
  borderRadius: "12px",
  width: "160px",
  boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
  border: "1px solid #333",
  overflow: "hidden",
  zIndex: 200
};

const dropdownItemStyle = {
  padding: "12px 15px",
  fontSize: "14px",
  fontWeight: "500",
  display: "flex",
  alignItems: "center",
  gap: "10px",
  cursor: "pointer",
  color: "#fff"
};

const headerSectionStyle = {
  padding: "20px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center"
};

const avatarContainerStyle = {
  width: "96px",
  height: "96px",
  borderRadius: "50%",
  padding: "2px",
  background: "linear-gradient(45deg, #FFD700, #ff3b30)", // Gold to Red border
  marginBottom: "12px"
};

const avatarImageStyle = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  objectFit: "cover",
  border: "3px solid #000" // Creates gap between ring and image
};

const displayNameStyle = {
  fontSize: "18px",
  fontWeight: "600",
  margin: "0 0 5px 0"
};

const bioStyle = {
  fontSize: "14px",
  color: "#ccc",
  textAlign: "center",
  lineHeight: "1.4",
  marginBottom: "20px",
  maxWidth: "300px"
};

const statsRowStyle = {
  display: "flex",
  gap: "30px",
  marginBottom: "20px"
};

const actionButtonsRowStyle = {
  display: "flex",
  gap: "8px",
  width: "100%",
  maxWidth: "350px"
};

const primaryButtonStyle = {
  flex: 1,
  background: "#1E1E1E",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "10px",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer"
};

const secondaryButtonStyle = {
  background: "#1E1E1E",
  color: "#fff",
  border: "none",
  borderRadius: "8px",
  padding: "10px 14px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const tabsContainerStyle = {
  display: "flex",
  borderBottom: "1px solid #222",
  background: "#000",
  position: "sticky",
  top: "54px", // Below navbar
  zIndex: 40
};

const contentAreaStyle = {
  minHeight: "300px",
  background: "#000"
};

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "1px"
};

const emptyStateStyle = {
  gridColumn: "span 3",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "60px 20px",
  textAlign: "center"
};

const emptyIconCircle = {
  width: "60px",
  height: "60px",
  borderRadius: "50%",
  border: "2px solid #333",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "15px"
};