import React, { useState, useEffect } from "react";
import { User, Mail, Lock, LogOut, Settings, ChevronRight, PlayCircle, ShieldCheck } from "lucide-react";

export default function Profile({ onOpenVideo }) {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("login"); // 'login', 'register', 'dashboard'
  const [isLoading, setIsLoading] = useState(false);
  
  // Form State
  const [formData, setFormData] = useState({ email: "", password: "", username: "" });
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) fetchProfile(token);
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
    } catch (err) {
      console.error(err);
    }
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
      if (!res.ok) throw new Error(data.error || "Something went wrong");

      localStorage.setItem("auth_token", data.token);
      setUser(data.user);
      setView("dashboard");
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("auth_token");
    setUser(null);
    setView("login");
  };

useEffect(() => {
  // 1. Function to find and destroy the ad
  const zapAds = () => {
    // This targets both the iframe and the dynamic container Adsterra creates
    const adElements = document.querySelectorAll('iframe[id^="container-"], div[id^="container-"], [id*="effectivegatecpm"]');
    adElements.forEach(el => {
      el.style.display = 'none';
      el.style.opacity = '0';
      el.style.pointerEvents = 'none';
      // Optional: el.remove(); // Use this if style hiding isn't enough
    });
  };

  // 2. Zap existing ads immediately
  zapAds();

  // 3. Set up a MutationObserver to zap ads that try to pop up later
  const observer = new MutationObserver((mutations) => {
    zapAds();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // 4. Cleanup when leaving the profile page
  return () => {
    observer.disconnect();
    // Allow ads to return when we go back to Home
    const adElements = document.querySelectorAll('iframe[id^="container-"], div[id^="container-"]');
    adElements.forEach(el => {
      el.style.display = 'block';
      el.style.opacity = '1';
      el.style.pointerEvents = 'auto';
    });
  };
}, []);

  // 🟢 1. MODERN DASHBOARD VIEW
  if (user && view === "dashboard") {
    return (
      <div style={{ minHeight: "100vh", background: "#000", color: "#fff", fontFamily: "-apple-system, sans-serif" }}>
        
        {/* Profile Header Card */}
        <div style={{ 
          padding: "40px 20px", 
          background: "linear-gradient(180deg, #1c1c1e 0%, #000 100%)",
          display: "flex", flexDirection: "column", alignItems: "center", borderBottom: "1px solid #222"
        }}>
          <div style={{ position: "relative", marginBottom: "16px" }}>
            <div style={{ width: "90px", height: "90px", borderRadius: "50%", background: "#333", overflow: "hidden", border: "3px solid #1c1c1e", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}>
               <img src={user.avatar_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="Avatar" />
            </div>
            <div style={{ position: "absolute", bottom: 0, right: 0, background: "#ff3b30", padding: "6px", borderRadius: "50%", border: "2px solid #000" }}>
              <Settings size={14} color="#fff" />
            </div>
          </div>
          
          <h2 style={{ margin: 0, fontSize: "22px", fontWeight: "700" }}>{user.username}</h2>
          <p style={{ margin: "4px 0 0", color: "#666", fontSize: "14px" }}>{user.email}</p>

          {/* Mini Stats (Placeholder) */}
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

        {/* Menu Actions List */}
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

  // 🟢 2. SLEEK AUTH VIEW (LOCKED)
  return (
    <div style={{ 
      position: "fixed",      // 🟢 1. Locks it to the screen
      inset: 0,               // 🟢 2. Stretches to all 4 corners
      height: "100dvh",       // 🟢 3. Dynamic height (fixes mobile address bar glitches)
      overflow: "hidden",     // 🟢 4. Kills the scrollbar
      display: "flex", 
      flexDirection: "column", 
      justifyContent: "center", 
      padding: "30px", 
      background: "#000", 
      color: "#fff",
      touchAction: "none"     // 🟢 5. Disables swipe gestures on the background
    }}>
      
      {/* Brand Header */}
      <div style={{ textAlign: "center", marginBottom: "50px", animation: "fadeIn 0.8s ease" }}>
        <h1 style={{ fontSize: "28px", fontWeight: "800", letterSpacing: "-1px", margin: 0 }}>
          NAIJA<span style={{ color: "#ff3b30" }}>HOMEMADE</span>
        </h1>
        <p style={{ color: "#666", fontSize: "14px", marginTop: "8px" }}>
          {view === "login" ? "Welcome back, Chief." : "Join the movement."}
        </p>
      </div>

      <form onSubmit={handleAuth} style={{ display: "flex", flexDirection: "column", gap: "16px", animation: "slideUp 0.5s ease" }}>
        
        {view === "register" && (
          <div style={inputWrapperStyle}>
            <User size={18} color="#666" style={{ position: "absolute", left: "16px" }} />
            <input 
              placeholder="Username" 
              required
              style={modernInputStyle}
              value={formData.username}
              onChange={e => setFormData({...formData, username: e.target.value})}
            />
          </div>
        )}

        <div style={inputWrapperStyle}>
          <Mail size={18} color="#666" style={{ position: "absolute", left: "16px" }} />
          <input 
            type="email" 
            placeholder="Email Address" 
            required
            style={modernInputStyle}
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})}
          />
        </div>

        <div style={inputWrapperStyle}>
          <Lock size={18} color="#666" style={{ position: "absolute", left: "16px" }} />
          <input 
            type="password" 
            placeholder="Password" 
            required
            style={modernInputStyle}
            value={formData.password}
            onChange={e => setFormData({...formData, password: e.target.value})}
          />
        </div>

        {error && <p style={{ color: "#ff3b30", fontSize: "13px", textAlign: "center", background: "rgba(255, 59, 48, 0.1)", padding: "10px", borderRadius: "8px" }}>{error}</p>}

        <button type="submit" disabled={isLoading} style={primaryButtonStyle}>
          {isLoading ? <span className="loader"></span> : (view === "login" ? "Log In" : "Create Account")}
        </button>
      </form>

      {/* Switcher */}
      <div style={{ marginTop: "40px", textAlign: "center" }}>
        <p style={{ color: "#666", fontSize: "14px" }}>
          {view === "login" ? "Don't have an account?" : "Already a member?"}
        </p>
        <button 
          onClick={() => { setError(""); setView(view === "login" ? "register" : "login"); }}
          style={{ background: "none", border: "none", color: "#fff", fontWeight: "600", fontSize: "14px", marginTop: "5px", cursor: "pointer", textDecoration: "underline", textDecorationColor: "#333" }}
        >
          {view === "login" ? "Sign up now" : "Log in here"}
        </button>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        /* 🟢 Optional: Prevent rubber-banding on iOS */
        html, body { overscroll-behavior: none; }
      `}</style>
    </div>
  );
}

// 🎨 SUB-COMPONENTS & STYLES

const MenuRow = ({ icon, label, onClick, border = true }) => (
  <button onClick={onClick} style={{ ...rowStyle, borderBottom: border ? "1px solid #2a2a2a" : "none" }}>
    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
      {icon}
      <span style={{ fontSize: "15px", fontWeight: "500" }}>{label}</span>
    </div>
    <ChevronRight size={16} color="#444" />
  </button>
);

const menuGroupStyle = {
  background: "#1c1c1e", borderRadius: "16px", overflow: "hidden"
};

const rowStyle = {
  width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
  padding: "16px 20px", background: "none", border: "none", color: "#fff", cursor: "pointer",
  transition: "background 0.2s"
};

const inputWrapperStyle = {
  position: "relative", display: "flex", alignItems: "center"
};

const modernInputStyle = {
  width: "100%", background: "#111", border: "1px solid #222", borderRadius: "12px",
  padding: "16px 16px 16px 48px", color: "#fff", fontSize: "16px", outline: "none",
  transition: "all 0.2s ease"
};

const primaryButtonStyle = {
  background: "#ff3b30", color: "#fff", border: "none", padding: "16px", 
  borderRadius: "12px", fontSize: "16px", fontWeight: "700", marginTop: "10px",
  cursor: "pointer", boxShadow: "0 4px 12px rgba(255, 59, 48, 0.3)",
  transition: "transform 0.1s"
};