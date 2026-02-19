import React, { useState, useEffect } from "react";
import { ArrowLeft, User, Lock, Shield, Bell, LogOut, ChevronRight, Palette, Circle } from "lucide-react";

export default function SettingsView({ onBack, onLogout }) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(localStorage.getItem("theme") || "red");

  // 🟢 THEME TOGGLE LOGIC
  const toggleTheme = (theme) => {
    setCurrentTheme(theme);
    localStorage.setItem("theme", theme);
    if (theme === "orange") {
      document.body.classList.add("theme-orange");
    } else {
      document.body.classList.remove("theme-orange");
    }
  };

  return (
    <div style={containerStyle}>
      <div style={navBarStyle}>
        <ArrowLeft size={24} color="#fff" onClick={onBack} style={{ cursor: "pointer" }} />
        <h2 style={headerTitleStyle}>Settings</h2>
        <div style={{ width: "24px" }} />
      </div>

      <div style={{ padding: "10px 0" }}>
        <h3 style={sectionLabelStyle}>Account</h3>
        <SettingsItem icon={<User size={20} />} label="Account Details" />
        <SettingsItem icon={<Lock size={20} />} label="Privacy" />
        
        <h3 style={sectionLabelStyle}>Appearance</h3>
        <div style={settingsItemStyle}>
          <Palette size={20} />
          <span style={{ flex: 1, marginLeft: "15px" }}>Theme</span>
          <div style={{ display: "flex", gap: "10px" }}>
            {/* Red Option */}
            <div 
              onClick={() => toggleTheme("red")}
              style={{...colorDotStyle, backgroundColor: "#ff3b30", border: currentTheme === "red" ? "2px solid #fff" : "none"}} 
            />
            {/* Orange Option */}
            <div 
              onClick={() => toggleTheme("orange")}
              style={{...colorDotStyle, backgroundColor: "#ff8c00", border: currentTheme === "orange" ? "2px solid #fff" : "none"}} 
            />
          </div>
        </div>

        <div style={{ height: "1px", background: "#222", margin: "20px 0" }} />
        
        <div 
          style={{...settingsItemStyle, color: "var(--primary-color)", borderBottom: "none"}} 
          onClick={() => setShowLogoutConfirm(true)}
        >
          <LogOut size={20} />
          <span style={{ flex: 1, marginLeft: "15px", fontWeight: "700" }}>Log out</span>
        </div>
      </div>

      {/* Logout Dialog */}
      {showLogoutConfirm && (
        <div style={modalOverlayStyle} onClick={() => setShowLogoutConfirm(false)}>
          <div style={dialogBoxStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={dialogTitleStyle}>Log out?</h3>
            <p style={dialogSubStyle}>You'll need to sign back in to access your premium content.</p>
            <div style={dialogActionColumn}>
              {/* Note: using var(--primary-color) here too */}
              <button style={{...dialogLogoutBtn, backgroundColor: "var(--primary-color)"}} onClick={onLogout}>Log out</button>
              <button style={dialogCancelBtn} onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 🖌 STYLES
const sectionLabelStyle = { fontSize: "12px", color: "#666", textTransform: "uppercase", padding: "20px 20px 10px 20px", fontWeight: "700", letterSpacing: "1px" };
const colorDotStyle = { width: "24px", height: "24px", borderRadius: "50%", cursor: "pointer", transition: "transform 0.2s" };

// Re-using your existing styles...
const containerStyle = { minHeight: "100vh", background: "#000", color: "#fff" };
const navBarStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 20px", borderBottom: "1px solid #222" };
const headerTitleStyle = { fontSize: "16px", fontWeight: "700", margin: 0 };
const settingsItemStyle = { display: "flex", alignItems: "center", padding: "18px 20px", borderBottom: "1px solid #111", cursor: "pointer" };
const modalOverlayStyle = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0, 0, 0, 0.85)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 20000, padding: "20px" };
const dialogBoxStyle = { width: "100%", maxWidth: "300px", backgroundColor: "#1c1c1e", borderRadius: "16px", padding: "24px", textAlign: "center" };
const dialogTitleStyle = { fontSize: "18px", fontWeight: "800", marginBottom: "8px" };
const dialogSubStyle = { fontSize: "14px", color: "#8e8e93", marginBottom: "24px" };
const dialogActionColumn = { display: "flex", flexDirection: "column", gap: "10px" };
const dialogLogoutBtn = { padding: "14px", borderRadius: "10px", border: "none", color: "#fff", fontWeight: "700", cursor: "pointer" };
const dialogCancelBtn = { padding: "14px", borderRadius: "10px", border: "1px solid #3a3a3c", backgroundColor: "transparent", color: "#fff", fontWeight: "600", cursor: "pointer" };

const SettingsItem = ({ icon, label }) => (
  <div style={settingsItemStyle} onClick={() => alert(`${label} coming soon!`)}>
    {icon} <span style={{ flex: 1, marginLeft: "15px" }}>{label}</span> <ChevronRight size={16} color="#444" />
  </div>
);