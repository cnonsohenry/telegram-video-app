// File: src/components/UserProfile.jsx
import React, { useState } from "react";
import { Settings, Grid3X3, Heart, Lock } from "lucide-react";

export default function UserProfile({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("videos");

  return (
    <div style={dashboardContainerStyle}>
      {/* Header Section */}
      <div style={{ padding: "20px 0", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ display: "flex", width: "100%", justifyContent: "space-between", padding: "0 20px", marginBottom: "10px" }}>
          <div /> 
          <h2 style={{ fontSize: "17px", fontWeight: "700" }}>{user.username}</h2>
          <Settings size={24} onClick={onLogout} style={{ cursor: "pointer" }} />
        </div>
        
        {/* Avatar with Loop Fix */}
        <div style={{ width: "96px", height: "96px", borderRadius: "50%", overflow: "hidden", border: "1px solid #333", marginBottom: "12px" }}>
           <img 
            src={user.avatar_url || "/assets/default-avatar.png"} 
            onError={(e) => { 
              e.target.onerror = null; 
              e.target.src = "/assets/default-avatar.png"; 
            }}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} 
            alt="Profile"
          />
        </div>
        
        <p style={{ margin: "0", fontSize: "14px", color: "#eee" }}>@{user.username}</p>
        
        {/* Stats Row */}
        <div style={{ display: "flex", gap: "20px", marginTop: "16px", alignItems: "center" }}>
          <StatBox count={0} label="Following" />
          <StatBox count={0} label="Followers" />
          <StatBox count={0} label="Likes" />
        </div>
      </div>
      
      {/* Tabs */}
      <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#000", display: "flex", borderBottom: "1px solid #222" }}>
        <TabButton active={activeTab === "videos"} onClick={() => setActiveTab("videos")} icon={<Grid3X3 size={20} />} />
        <TabButton active={activeTab === "premium"} onClick={() => setActiveTab("premium")} icon={<Lock size={20} />} />
        <TabButton active={activeTab === "likes"} onClick={() => setActiveTab("likes")} icon={<Heart size={20} />} />
      </div>
      
      {/* Content Grid */}
      <div style={{ minHeight: "300px", padding: "1px" }}>
        <div style={gridStyle}>
          <div style={emptyStateStyle}>
            {activeTab === "videos" ? "No videos yet" : 
             activeTab === "premium" ? "No premium content" : "No liked videos"}
          </div>
        </div>
      </div>
    </div>
  );
}

// Sub-components & Styles
const StatBox = ({ count, label }) => (
  <div style={{ textAlign: "center" }}>
    <span style={{ fontWeight: "700", fontSize: "17px" }}>{count}</span>
    <p style={{ margin: 0, fontSize: "13px", color: "#888" }}>{label}</p>
  </div>
);

const TabButton = ({ active, onClick, icon }) => (
  <button onClick={onClick} style={{ flex: 1, background: "none", border: "none", borderBottom: active ? "2px solid #fff" : "2px solid transparent", padding: "12px 0", color: active ? "#fff" : "#666" }}>
    {icon}
  </button>
);

const dashboardContainerStyle = { minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "-apple-system, sans-serif", overflowY: "auto", paddingBottom: "100px" };
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px" };
const emptyStateStyle = { gridColumn: "span 3", textAlign: "center", padding: "40px", color: "#444" };