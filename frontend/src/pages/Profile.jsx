import React, { useState, useEffect } from "react";
import { Settings, Grid3X3, Heart, Lock, Eye, EyeOff, LogOut } from "lucide-react";

export default function Profile({ onOpenVideo }) {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login");
  const [activeTab, setActiveTab] = useState("videos");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({ email: "", password: "", username: "" });
  const [error, setError] = useState("");

  // 🟢 1. SCROLL MANAGEMENT
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) fetchProfile(token);
    
    // Lock body scroll for app-like feel
    document.body.style.overflow = "hidden";
    
    return () => { 
      document.body.style.overflow = ""; 
    };
  }, []);

  // 🟢 2. ADSTERRA BLOCKER
  useEffect(() => {
    const zapAds = () => {
      const adElements = document.querySelectorAll('iframe[id^="container-"], div[id^="container-"], [id*="effectivegatecpm"], .social-bar-container');
      adElements.forEach(el => {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
        el.style.zIndex = '-100';
      });
    };
    zapAds();
    const observer = new MutationObserver(() => zapAds());
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  const fetchProfile = async (token) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const userData = await res.json();
        setUser(userData);
        setView("dashboard");
      } else {
        localStorage.removeItem("auth_token");
      }
    } catch (err) { console.error(err); }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    const endpoint = view === "login" ? "/api/auth/login" : "/api/auth/register";
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed");
      localStorage.setItem("auth_token", data.token);
      setUser(data.user);
      setView("dashboard");
    } catch (err) { setError(err.message); } finally { setIsLoading(false); }
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setUser(null);
    setView("login");
  };

  // 🟢 3. DASHBOARD VIEW (Logged In)
  if (user && view === "dashboard") {
    return (
      <div style={{ 
        height: "100vh", 
        background: "#000", 
        color: "#fff", 
        fontFamily: "-apple-system, sans-serif", 
        overflowY: "auto", 
        WebkitOverflowScrolling: "touch",
        paddingBottom: "80px" // Space for Global Nav
      }}>
        
        {/* HEADER */}
        <div style={{ padding: "20px 0", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ display: "flex", width: "100%", justifyContent: "space-between", padding: "0 20px", marginBottom: "10px" }}>
            <div /> 
            <h2 style={{ fontSize: "17px", fontWeight: "700" }}>{user.username}</h2>
            <Settings size={24} onClick={handleLogout} style={{ cursor: "pointer" }} />
          </div>

          <div style={{ width: "96px", height: "96px", borderRadius: "50%", overflow: "hidden", border: "1px solid #333", marginBottom: "12px" }}>
             <img src={user.avatar_url || "https://videos.naijahomemade.com/api/avatar?user_id=default"} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Avatar" />
          </div>

          <p style={{ margin: "0", fontSize: "14px", color: "#eee" }}>@{user.username}</p>
          
          <div style={{ display: "flex", gap: "20px", marginTop: "16px", alignItems: "center" }}>
            <div style={{ textAlign: "center" }}>
              <span style={{ fontWeight: "700", fontSize: "17px" }}>0</span>
              <p style={{ margin: 0, fontSize: "13px", color: "#888" }}>Following</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <span style={{ fontWeight: "700", fontSize: "17px" }}>0</span>
              <p style={{ margin: 0, fontSize: "13px", color: "#888" }}>Followers</p>
            </div>
            <div style={{ textAlign: "center" }}>
              <span style={{ fontWeight: "700", fontSize: "17px" }}>0</span>
              <p style={{ margin: 0, fontSize: "13px", color: "#888" }}>Likes</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", marginTop: "20px" }}>
            <button style={{ background: "#1c1c1e", border: "none", color: "#fff", padding: "10px 24px", borderRadius: "4px", fontSize: "14px", fontWeight: "600" }}>Edit Profile</button>
            <button style={{ background: "#1c1c1e", border: "none", color: "#fff", padding: "10px 14px", borderRadius: "4px" }}><Settings size={16} /></button>
          </div>
        </div>

        {/* STICKY TABS */}
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#000", display: "flex", borderBottom: "1px solid #222", marginTop: "10px" }}>
          <TabButton active={activeTab === "videos"} onClick={() => setActiveTab("videos")} icon={<Grid3X3 size={20} />} />
          <TabButton active={activeTab === "premium"} onClick={() => setActiveTab("premium")} icon={<Lock size={20} />} />
          <TabButton active={activeTab === "likes"} onClick={() => setActiveTab("likes")} icon={<Heart size={20} />} />
        </div>

        {/* GRID CONTENT */}
        <div style={{ minHeight: "300px", padding: "1px" }}>
          {activeTab === "videos" && <div style={gridStyle}><div style={emptyStateStyle}>No videos yet</div></div>}
          {activeTab === "premium" && <div style={{ padding: "40px", textAlign: "center", color: "#666" }}><Lock size={40} style={{ marginBottom: "10px" }} /><p>Premium content is locked.</p></div>}
          {activeTab === "likes" && <div style={{ padding: "40px", textAlign: "center", color: "#666" }}><Heart size={40} style={{ marginBottom: "10px" }} /><p>Videos you liked will appear here.</p></div>}
        </div>
      </div>
    );
  }

  // 🟢 4. LOGIN VIEW (Fixed Layout)
  return (
    <div style={containerStyle}>
      <div style={innerContainer}>
        <h1 style={logoStyle}>NaijaHomemade</h1>
        <form onSubmit={handleAuth} style={formStyle}>
          {view === "register" && (
            <input placeholder="Username" style={roundedInputStyle} value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} required />
          )}
          <input type="email" placeholder="Email address" style={roundedInputStyle} value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required />
          <div style={{ position: "relative", width: "100%" }}>
            <input type={showPassword ? "text" : "password"} placeholder="Password" style={roundedInputStyle} value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required />
            <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: "absolute", right: "15px", top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: "#666", cursor: "pointer", display: "flex" }}>
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && <p style={{ color: "#ff3b30", fontSize: "14px", textAlign: "center", margin: "10px 0" }}>{error}</p>}
          <button type="submit" disabled={isLoading} style={{...loginButtonStyle, opacity: formData.email && formData.password.length >= 6 ? 1 : 0.5 }}>
            {isLoading ? "Please wait..." : (view === "login" ? "Log in" : "Sign up")}
          </button>
        </form>
        <div style={dividerContainer}><div style={line} /><span style={orText}>OR</span><div style={line} /></div>
        <button onClick={() => alert("Backend setup needed for Google Auth")} style={googleButtonStyle}>
           <span style={{ fontSize: "18px", fontWeight: "bold" }}>G</span> 
           <span>Continue with Google</span>
        </button>
        {view === "login" && <p style={forgotPassword}>Forgot password?</p>}
      </div>

      {/* 🟢 FIXED FOOTER: Now sits ABOVE the Global Nav */}
      <div style={footerBox}>
        <p style={{ fontSize: "14px", color: "#fff", margin: 0 }}>
          {view === "login" ? "Don't have an account? " : "Have an account? "}
          <span onClick={() => { setView(view === "login" ? "register" : "login"); setError(""); }} style={{ color: "#ff3b30", fontWeight: "700", cursor: "pointer" }}>{view === "login" ? "Sign up" : "Log in"}</span>
        </p>
      </div>
    </div>
  );
}

// 🎨 COMPONENT STYLES
const TabButton = ({ active, onClick, icon }) => (
  <button onClick={onClick} style={{ flex: 1, background: "none", border: "none", borderBottom: active ? "2px solid #fff" : "2px solid transparent", padding: "12px 0", color: active ? "#fff" : "#666", cursor: "pointer", display: "flex", justifyContent: "center", transition: "color 0.2s" }}>
    {icon}
  </button>
);
const gridStyle = { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "1px" };
const emptyStateStyle = { gridColumn: "span 3", textAlign: "center", padding: "40px", color: "#444", fontSize: "14px" };

// 🎨 AUTH STYLES
const containerStyle = { 
  // 🟢 CHANGED: Removed fixed inset/z-index. Now it behaves as a normal page.
  minHeight: "100vh", 
  background: "#000", 
  display: "flex", 
  flexDirection: "column", 
  alignItems: "center", 
  justifyContent: "center", 
  padding: "20px", 
  paddingBottom: "100px", // Extra padding so content isn't hidden by footers
  touchAction: "none"
};

const innerContainer = { width: "100%", maxWidth: "350px", display: "flex", flexDirection: "column", alignItems: "center" };
const logoStyle = { fontFamily: '"Billabong", cursive', fontSize: "40px", fontWeight: "400", marginBottom: "35px", color: "#fff", fontStyle: "italic" };
const formStyle = { width: "100%", display: "flex", flexDirection: "column", gap: "12px" };
const roundedInputStyle = { width: "100%", background: "transparent", border: "1px solid #333", borderRadius: "30px", padding: "14px 20px", color: "#fff", fontSize: "15px", outline: "none", transition: "border-color 0.2s" };
const loginButtonStyle = { background: "#ff3b30", color: "#fff", border: "none", borderRadius: "30px", padding: "14px", fontSize: "15px", fontWeight: "700", marginTop: "10px", cursor: "pointer", width: "100%" };
const dividerContainer = { width: "100%", display: "flex", alignItems: "center", margin: "25px 0", gap: "15px" };
const line = { flex: 1, height: "1px", background: "#262626" };
const orText = { color: "#8e8e8e", fontSize: "13px", fontWeight: "700" };
const googleButtonStyle = { width: "100%", background: "#fff", border: "none", borderRadius: "30px", padding: "12px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", color: "#000", fontSize: "14px", fontWeight: "600", cursor: "pointer", marginBottom: "15px" };
const forgotPassword = { fontSize: "12px", color: "#ccc", cursor: "pointer", marginTop: "5px" };

// 🟢 ADJUSTED FOOTER BOX: Pinned to bottom, but high enough to clear Global Nav
const footerBox = { 
  position: "fixed", 
  bottom: "70px", // 🟢 Sits ABOVE the App.jsx bottom bar (approx 65px height)
  width: "100%", 
  textAlign: "center", 
  padding: "20px 0", 
  borderTop: "1px solid #262626", 
  background: "#000",
  zIndex: 10 // Lower z-index than the global nav
};