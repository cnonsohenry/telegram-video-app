import React, { useState, useEffect } from "react";
import { ArrowLeft, User, Lock, Bell, LogOut, ChevronRight, Palette } from "lucide-react";
import LegalFooter from "./LegalFooter";

// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../config";

export default function SettingsView({ onBack, onLogout }) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [currentTheme, setCurrentTheme] = useState(localStorage.getItem("theme") || "red");
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);

  // 🟢 Responsive Detection
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleThemeChange = async (newTheme) => {
    if (newTheme === currentTheme) return;
    setCurrentTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    
    if (newTheme === "orange") {
      document.body.classList.add("theme-orange");
    } else {
      document.body.classList.remove("theme-orange");
    }

    setIsSyncing(true);
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      await fetch(`${APP_CONFIG.apiUrl}/api/auth/settings`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ settings: { theme: newTheme } })
      });
    } catch (err) {
      console.error("Theme sync failed", err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div style={containerStyle}>
      {/* 🟢 INSTAGRAM TOP NAVIGATION BAR */}
      <div style={navBarStyle}>
        <button onClick={onBack} style={navBackBtnStyle} aria-label="Back">
          <ArrowLeft size={24} color="#fff" />
        </button>
        <span style={headerTitleStyle}>
          Settings
        </span>
        <div style={{ width: "36px" }} />
      </div>

      <div style={scrollAreaStyle}>
        <div style={innerWrapperStyle}>
          <div style={{ padding: "10px 0" }}>
            <h3 style={sectionLabelStyle}>Account</h3>
            <SettingsItem icon={<User size={20} />} label="Account Details" />
            <SettingsItem icon={<Lock size={20} />} label="Privacy" />
            
            <h3 style={sectionLabelStyle}>Appearance</h3>
            <div style={settingsItemStyle}>
              <Palette size={20} />
              <span style={{ flex: 1, marginLeft: "15px" }}>App Theme</span>
              
              <div 
                style={toggleTrackStyle} 
                onClick={() => handleThemeChange(currentTheme === "red" ? "orange" : "red")}
              >
                <div style={{
                    ...toggleThumbStyle,
                    transform: currentTheme === "orange" ? "translateX(26px)" : "translateX(0px)",
                    backgroundColor: currentTheme === "orange" ? "#ff8c00" : "#ff3b30"
                }} />
              </div>
            </div>

            <div style={{ height: "1px", background: "#1a1a1a", margin: "20px 0" }} />
            
            <div 
              style={{
                ...settingsItemStyle, 
                color: "var(--primary-color, #ff3b30)", 
                borderBottom: "none"
              }} 
              onClick={() => setShowLogoutConfirm(true)}
            >
              <LogOut size={20} />
              <span style={{ flex: 1, marginLeft: "15px", fontWeight: "700" }}>Log out</span>
            </div>
          </div>

          <LegalFooter />
        </div>
      </div>

      {/* Logout Dialog */}
      {showLogoutConfirm && (
        <div style={modalOverlayStyle} onClick={() => setShowLogoutConfirm(false)}>
          <div style={dialogBoxStyle} onClick={(e) => e.stopPropagation()}>
            <h3 style={dialogTitleStyle}>Log out?</h3>
            <p style={dialogSubStyle}>You'll need to sign back in to access your premium content.</p>
            <div style={dialogActionColumn}>
              <button style={{...dialogLogoutBtn, flex: 1, backgroundColor: "var(--primary-color)"}} onClick={onLogout}>Log out</button>
              <button style={{...dialogCancelBtn, flex: 1}} onClick={() => setShowLogoutConfirm(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 🎨 COMPONENT UI PIECES
const SettingsItem = ({ icon, label }) => (
  <div style={settingsItemStyle} onClick={() => alert(`${label} coming soon!`)}>
    {icon} <span style={{ flex: 1, marginLeft: "15px" }}>{label}</span> <ChevronRight size={16} color="#555" />
  </div>
);

// 🖌 STYLES
const containerStyle = {
  position: "fixed",
  inset: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "#000000",
  color: "#fff",
  zIndex: 99999,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  animation: "fadeIn 0.2s ease-out"
};

const navBarStyle = {
  height: "50px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 16px",
  borderBottom: "1px solid #1a1a1a",
  backgroundColor: "#000000",
  position: "sticky",
  top: 0,
  zIndex: 50,
  flexShrink: 0
};

const navBackBtnStyle = {
  background: "none",
  border: "none",
  color: "#fff",
  cursor: "pointer",
  padding: "6px",
  display: "flex",
  alignItems: "center"
};

const headerTitleStyle = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#fff",
  letterSpacing: "0.2px",
  margin: 0
};

const scrollAreaStyle = {
  flex: 1,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  display: "flex",
  flexDirection: "column"
};

const innerWrapperStyle = {
  width: "100%",
  maxWidth: "600px",
  margin: "0 auto",
  boxSizing: "border-box",
  paddingBottom: "40px"
};

const sectionLabelStyle = { fontSize: "12px", color: "#8e8e93", textTransform: "uppercase", padding: "20px 20px 10px 20px", fontWeight: "700", letterSpacing: "1px" };
const settingsItemStyle = { display: "flex", alignItems: "center", padding: "18px 20px", cursor: "pointer", borderBottom: "1px solid #141414", transition: "all 0.2s ease" };
const toggleTrackStyle = { width: "52px", height: "26px", backgroundColor: "#333", borderRadius: "15px", position: "relative", cursor: "pointer" };
const toggleThumbStyle = { width: "22px", height: "22px", borderRadius: "50%", position: "absolute", top: "2px", left: "2px", transition: "0.3s cubic-bezier(0.4, 0, 0.2, 1)", boxShadow: "0 2px 4px rgba(0,0,0,0.3)" };
const modalOverlayStyle = { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100000, padding: "20px" };
const dialogBoxStyle = { width: "100%", maxWidth: "340px", backgroundColor: "#1c1c1e", borderRadius: "16px", padding: "24px", textAlign: "center", border: "1px solid #333" };
const dialogTitleStyle = { fontSize: "18px", fontWeight: "800", marginBottom: "8px", color: "#fff" };
const dialogSubStyle = { fontSize: "14px", color: "#8e8e93", marginBottom: "24px" };
const dialogActionColumn = { display: "flex", gap: "10px" };
const dialogLogoutBtn = { padding: "14px", borderRadius: "10px", border: "none", color: "#fff", fontWeight: "700", cursor: "pointer" };
const dialogCancelBtn = { padding: "14px", borderRadius: "10px", border: "1px solid #3a3a3c", backgroundColor: "transparent", color: "#fff", fontWeight: "600", cursor: "pointer" };