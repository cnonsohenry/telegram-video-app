import React, { useState, useEffect } from "react";
import { Settings, Grid3X3, Heart, Lock, Eye, EyeOff } from "lucide-react";

export default function Profile({ onOpenVideo }) {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login");
  const [activeTab, setActiveTab] = useState("videos");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({ email: "", password: "", username: "" });
  const [error, setError] = useState("");

  // 🟢 1. HARD SCROLL REMOVAL
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) fetchProfile(token);
    
    // This physically prevents the browser from moving the page
    if (!user) {
      document.documentElement.style.overflow = "hidden";
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none"; // Kills swipe-to-scroll
      document.body.style.position = "fixed";
      document.body.style.width = "100%";
      document.body.style.height = "100%";
    } 
    
    return () => { 
      document.documentElement.style.overflow = "";
      document.body.style.overflow = ""; 
      document.body.style.touchAction = "";
      document.body.style.position = "";
    };
  }, [user]);

  // 🟢 2. ADSTERRA BLOCKER
  useEffect(() => {
    const zapAds = () => {
      const adElements = document.querySelectorAll('iframe[id^="container-"], div[id^="container-"], [id*="effectivegatecpm"], .social-bar-container');
      adElements.forEach(el => {
        el.style.display = 'none';
        el.style.visibility = 'hidden';
        el.style.pointerEvents = 'none';
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

  // 🟢 3. DASHBOARD VIEW (Scrollable only here)
  if (user && view === "dashboard") {
    return (
      <div style={{ 
        height: "100vh", background: "#000", color: "#fff", 
        fontFamily: "-apple-system, sans-serif", overflowY: "auto", 
        WebkitOverflowScrolling: "touch", paddingBottom: "80px" 
      }}>
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
        </div>
        <div style={{ position: "sticky", top: 0, zIndex: 50, background: "#000", display: "flex", borderBottom: "1px solid #222", marginTop: "10px" }}>
          <TabButton active={activeTab === "videos"} onClick={() => setActiveTab("videos")} icon={<Grid3X3 size={20} />} />
          <TabButton active={activeTab === "premium"} onClick={() => setActiveTab("premium")} icon={<Lock size={20} />} />
          <TabButton active={activeTab === "likes"} onClick={() => setActiveTab("likes")} icon={<Heart size={20} />} />
        </div>
        <div style={{ minHeight: "300px", padding: "1px" }}>
          {activeTab === "videos" && <div style={gridStyle}><div style={emptyStateStyle}>No videos yet</div></div>}
          {activeTab === "premium" && <div style={{ padding: "40px", textAlign: "center", color: "#666" }}><Lock size={40} style={{ marginBottom: "10px" }} /><p>Premium content is locked.</p></div>}
          {activeTab === "likes" && <div style={{ padding: "40px", textAlign: "center", color: "#666" }}><Heart size={40} style={{ marginBottom: "10px" }} /><p>Videos you liked will appear here.</p></div>}
        </div>
      </div>
    );
  }

  // 🟢 4. LOGIN VIEW (Totally Frozen & No Overlap)
  return (
    <div style={containerStyle}>
      
      {/* Scrollable Content Area */}
      <div style={contentWrapper}>
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

            {error && <p style={{ color: "#ff3b30", fontSize: "13px", textAlign: "center", margin: "5px 0" }}>{error}</p>}

            <button type="submit" disabled={isLoading} style={{...loginButtonStyle, opacity: formData.email && formData.password.length >= 6 ? 1 : 0.5 }}>
              {isLoading ? "..." : (view === "login" ? "Log in" : "Sign up")}
            </button>
          </form>

          <div style={dividerContainer}><div style={line} /><span style={orText}>OR</span><div style={line} /></div>
          
          <button onClick={() => alert("Coming soon")} style={googleButtonStyle}>
             <span style={{ fontWeight: "bold", marginRight: "10px" }}>G</span> Continue with Google
          </button>
          
          {view === "login" && <p style={forgotPassword}>Forgot password?</p>}
        </div>
      </div>

      {/* Footer (Now naturally placed below content) */}
      <div style={footerBox}>
        <div style={{ height: "1px", background: "#262626", width: "100%", marginBottom: "15px" }} />
        <p style={{ fontSize: "14px", color: "#fff", margin: 0 }}>
          {view === "login" ? "Don't have an account? " : "Have an account? "}
          <span 
            onClick={() => { setView(view === "login" ? "register" : "login"); setError(""); }} 
            style={{ color: "#ff3b30", fontWeight: "700", cursor: "pointer" }}
          >
            {view === "login" ? "Sign up" : "Log in"}
          </span>
        </p>
      </div>
    </div>
  );
}

// 🎨 AUTH STYLES - RE-ENGINEERED FOR STABILITY
const containerStyle = { 
  height: "100dvh", 
  background: "#000", 
  display: "flex", 
  flexDirection: "column", // 🟢 Stack content and footer
  overflow: "hidden", 
  touchAction: "none", 
  position: "fixed",
  width: "100%",
  zIndex: 100
};

const contentWrapper = {
  flex: 1, // 🟢 Takes up all available space, pushing footer down
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center", // 🟢 Centers form in the remaining space
  width: "100%",
  padding: "20px"
};

const innerContainer = { 
  width: "100%", 
  maxWidth: "350px", 
  display: "flex", 
  flexDirection: "column", 
  alignItems: "center" 
};

const logoStyle = { fontFamily: '"Billabong", cursive', fontSize: "40px", marginBottom: "30px", color: "#fff", fontStyle: "italic" };
const formStyle = { width: "100%", display: "flex", flexDirection: "column", gap: "10px" };
const roundedInputStyle = { width: "100%", background: "#121212", border: "1px solid #333", borderRadius: "30px", padding: "12px 20px", color: "#fff", fontSize: "15px", outline: "none" };
const loginButtonStyle = { background: "#ff3b30", color: "#fff", border: "none", borderRadius: "30px", padding: "14px", fontSize: "15px", fontWeight: "700", marginTop: "10px" };
const dividerContainer = { width: "100%", display: "flex", alignItems: "center", margin: "20px 0", gap: "15px" };
const line = { flex: 1, height: "1px", background: "#262626" };
const orText = { color: "#8e8e8e", fontSize: "13px", fontWeight: "600" };
const googleButtonStyle = { width: "100%", background: "#fff", border: "none", borderRadius: "30px", padding: "12px", color: "#000", fontSize: "14px", fontWeight: "600", marginBottom: "10px" };
const forgotPassword = { fontSize: "12px", color: "#ccc", cursor: "pointer" };

const footerBox = { 
  width: "100%", 
  textAlign: "center", 
  paddingBottom: "100px", // 🟢 Enough space to clear your App.jsx global nav
  background: "#000"
};