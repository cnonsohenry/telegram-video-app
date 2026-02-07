import React, { useState, useEffect } from "react";
import { Settings, ChevronRight, PlayCircle, ShieldCheck, Eye, EyeOff } from "lucide-react";

export default function Profile({ onOpenVideo }) {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login"); // 'login', 'register', 'dashboard'
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({ email: "", password: "", username: "" });
  const [error, setError] = useState("");

  // 🟢 1. CHECK LOGIN & LOCK SCROLL
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) fetchProfile(token);
    
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
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
    return () => {
      observer.disconnect();
      const adElements = document.querySelectorAll('iframe[id^="container-"], div[id^="container-"]');
      adElements.forEach(el => {
        el.style.display = 'block';
        el.style.visibility = 'visible';
        el.style.pointerEvents = 'auto';
        el.style.zIndex = '2147483647';
      });
    };
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

  const handleGoogleLogin = () => {
    // Ideally, this would redirect to your backend's Google OAuth endpoint
    alert("Google Login requires backend setup. Coming soon!");
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setUser(null);
    setView("login");
  };

  // 🟢 3. DASHBOARD VIEW
  if (user && view === "dashboard") {
    return (
      <div style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "-apple-system, sans-serif" }}>
        <div style={{ 
          padding: "40px 20px", 
          background: "linear-gradient(180deg, #1c1c1e 0%, #000 100%)",
          display: "flex", flexDirection: "column", alignItems: "center", borderBottom: "1px solid #222"
        }}>
          <div style={{ position: "relative", marginBottom: "16px" }}>
            <div style={{ width: "90px", height: "90px", borderRadius: "50%", background: "#333", overflow: "hidden", border: "3px solid #1c1c1e", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
               <img src={user.avatar_url || "https://videos.naijahomemade.com/api/avatar?user_id=default"} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Avatar" />
            </div>
            <div style={{ position: "absolute", bottom: 0, right: 0, background: "#ff3b30", padding: "6px", borderRadius: "50%", border: "2px solid #000" }}>
              <Settings size={14} color="#fff" />
            </div>
          </div>
          
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>{user.username}</h2>
          <p style={{ margin: "4px 0 0", color: "#666", fontSize: "14px" }}>{user.email}</p>

          <div style={{ display: "flex", gap: "30px", marginTop: "20px" }}>
            <div style={{ textAlign: "center" }}>
              <span style={{ display: "block", fontWeight: "800", fontSize: "18px" }}>0</span>
              <span style={{ color: "#666", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Videos</span>
            </div>
            <div style={{ textAlign: "center" }}>
              <span style={{ display: "block", fontWeight: "800", fontSize: "18px" }}>0</span>
              <span style={{ color: "#666", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px" }}>Views</span>
            </div>
          </div>
        </div>

        <div style={{ padding: "20px" }}>
          <h3 style={{ color: "#444", fontSize: "13px", fontWeight: "600", marginBottom: "10px", paddingLeft: "10px", textTransform: "uppercase" }}>Content</h3>
          <div style={menuGroupStyle}>
            <MenuRow icon={<PlayCircle size={20} color="#ff3b30" />} label="My Videos" onClick={() => {}} />
            <MenuRow icon={<ShieldCheck size={20} color="#34c759" />} label="Privacy Settings" onClick={() => {}} border={false} />
          </div>

          <h3 style={{ color: "#444", fontSize: "13px", fontWeight: "600", marginBottom: "10px", marginTop: "30px", paddingLeft: "10px", textTransform: "uppercase" }}>Account</h3>
          <div style={menuGroupStyle}>
             <button onClick={handleLogout} style={{ ...rowStyle, color: "#ff3b30", justifyContent: "center", borderBottom: "none" }}>
               Log Out
             </button>
          </div>
        </div>
      </div>
    );
  }

  // 🟢 4. RED AUTH VIEW
  return (
    <div style={containerStyle}>
      <div style={innerContainer}>
        {/* Logo */}
        <h1 style={logoStyle}>NaijaHomemade</h1>

        <form onSubmit={handleAuth} style={formStyle}>
          {view === "register" && (
            <input 
              placeholder="Username" 
              style={igInputStyle}
              value={formData.username}
              onChange={e => setFormData({...formData, username: e.target.value})}
              required
            />
          )}

          <input 
            type="email" 
            placeholder="Email address" 
            style={igInputStyle}
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})}
            required
          />

          {/* Password Field with Toggle */}
          <div style={{ position: "relative", width: "100%" }}>
            <input 
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              style={igInputStyle}
              value={formData.password}
              onChange={e => setFormData({...formData, password: e.target.value})}
              required
            />
            <button 
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{ 
                position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", 
                background: "none", border: "none", color: "#888", cursor: "pointer", display: "flex" 
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {error && <p style={{ color: "#ff3b30", fontSize: "14px", textAlign: "center", margin: "10px 0" }}>{error}</p>}

          <button type="submit" disabled={isLoading} style={{
            ...loginButtonStyle,
            opacity: formData.email && formData.password.length >= 6 ? 1 : 0.5
          }}>
            {isLoading ? "Please wait..." : (view === "login" ? "Log in" : "Sign up")}
          </button>
        </form>

        <div style={dividerContainer}>
          <div style={line} />
          <span style={orText}>OR</span>
          <div style={line} />
        </div>

        {/* Google Login Button */}
        <button onClick={handleGoogleLogin} style={googleButtonStyle}>
           <span style={{ fontSize: "16px", fontWeight: "bold" }}>G</span> 
           <span>Continue with Google</span>
        </button>
        
        {view === "login" && <p style={forgotPassword}>Forgot password?</p>}
      </div>

      <div style={footerBox}>
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

// 🎨 STYLES (Red Theme Applied)
const MenuRow = ({ icon, label, onClick, border = true }) => (
  <button onClick={onClick} style={{ ...rowStyle, borderBottom: border ? "1px solid #2a2a2a" : "none" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>{icon}<span style={{ fontSize: "15px", fontWeight: "500" }}>{label}</span></div>
    <ChevronRight size={16} color="#444" />
  </button>
);
const menuGroupStyle = { background: "#1c1c1e", borderRadius: "16px", overflow: "hidden" };
const rowStyle = { width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "none", border: "none", color: "#fff", cursor: "pointer", transition: "background 0.2s" };

// 🎨 AUTH STYLES
const containerStyle = { position: "fixed", inset: 0, background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 1000 };
const innerContainer = { width: "100%", maxWidth: "350px", display: "flex", flexDirection: "column", alignItems: "center" };
const logoStyle = { fontFamily: '"Billabong", cursive', fontSize: "40px", fontWeight: "400", marginBottom: "35px", color: "#fff", fontStyle: "italic" };
const formStyle = { width: "100%", display: "flex", flexDirection: "column", gap: "8px" };
const igInputStyle = { width: "100%", background: "#121212", border: "1px solid #363636", borderRadius: "3px", padding: "12px", color: "#fff", fontSize: "14px", outline: "none" };
const loginButtonStyle = { background: "#ff3b30", color: "#fff", border: "none", borderRadius: "8px", padding: "12px", fontSize: "14px", fontWeight: "700", marginTop: "10px", cursor: "pointer" };
const dividerContainer = { width: "100%", display: "flex", alignItems: "center", margin: "25px 0", gap: "15px" };
const line = { flex: 1, height: "1px", background: "#262626" };
const orText = { color: "#8e8e8e", fontSize: "13px", fontWeight: "700" };
const googleButtonStyle = { width: "100%", background: "#fff", border: "none", borderRadius: "8px", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", color: "#000", fontSize: "14px", fontWeight: "600", cursor: "pointer", marginBottom: "15px" };
const forgotPassword = { fontSize: "12px", color: "#ccc", cursor: "pointer", marginTop: "5px" };
const footerBox = { position: "absolute", bottom: "0", width: "100%", textAlign: "center", padding: "20px 0", borderTop: "1px solid #262626", background: "#000" };