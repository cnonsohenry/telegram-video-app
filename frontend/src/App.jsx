import { useEffect, useState, useMemo, useCallback } from "react";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import AdminUpload from "./pages/AdminUpload";
import AuthForm from "./components/AuthForm";
import PitchView from "./components/PitchView";
import { useAdZapper } from "./hooks/useAdZapper";
import { Home as HomeIcon, User, ShieldCheck } from "lucide-react";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [isFooterVisible, setIsFooterVisible] = useState(true);
  const [hasSeenPitch, setHasSeenPitch] = useState(false);

  // 🛡️ AD ZAPPER
  const isAdFreeZone = !hasSeenPitch || activeTab === "profile" || activeTab === "admin";
  useAdZapper(isAdFreeZone);

  // 🟢 1. THEME ENGINE
  const applyTheme = useCallback((theme) => {
    localStorage.setItem("theme", theme);
    if (theme === "orange") {
      document.body.classList.add("theme-orange");
    } else {
      document.body.classList.remove("theme-orange");
    }
  }, []);

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "red";
    applyTheme(savedTheme);
  }, [applyTheme]);

  const onLoginSuccess = (userData, userToken) => {
    localStorage.setItem("token", userToken);
    setToken(userToken);
    setUser(userData);
    if (userData.settings?.theme) applyTheme(userData.settings.theme);
    setActiveTab("profile"); 
  };

  const onLogout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setActiveTab("home");
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
    window.location.href = "/"; 
  }, []);

  // 🟢 2. SESSION RECOVERY
  useEffect(() => {
    if (token && !user) {
      fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setUser(data);
        if (data.settings?.theme) applyTheme(data.settings.theme);
      })
      .catch(() => {
        localStorage.removeItem("token");
        setToken(null);
      });
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "true") setActiveTab("admin");
  }, [token, user, applyTheme]);

  const isLoggedIn = useMemo(() => !!token, [token]);

  // GATEKEEPER
  const needsPitch = !isLoggedIn && (activeTab === "profile" || activeTab === "admin") && !hasSeenPitch;

  if (needsPitch) {
    return <PitchView onComplete={() => setHasSeenPitch(true)} />;
  }

  return (
    /* 🟢 root div: fixed height to prevent "bounce" space */
    <div style={{ 
      height: '100dvh', 
      width: '100vw', 
      backgroundColor: 'var(--bg-color)', 
      color: '#fff', 
      overflow: 'hidden',
      position: 'fixed' // Prevents browser chrome from shifting layout
    }}>
      <main 
        style={{ 
          position: 'relative',
          width: '100%',
          height: '100%',
          /* 🟢 Padding matches the footer height exactly */
          paddingBottom: isFooterVisible && activeTab !== "admin" ? "70px" : "0",
        }}
      > 
        
        {/* 🟢 HOME TAB (Persistent + Left Slide) */}
        <div style={{ 
          ...slideContainerStyle,
          transform: activeTab === "home" ? "translateX(0)" : "translateX(-100%)",
          opacity: activeTab === "home" ? 1 : 0,
          pointerEvents: activeTab === "home" ? "auto" : "none"
        }}>
          <Home 
            user={user} 
            onProfileClick={() => setActiveTab("profile")}
            setHideFooter={(val) => setIsFooterVisible(!val)}
          />
        </div>
        
        {/* 🟢 PROFILE TAB (Persistent + Right Slide) */}
        <div style={{ 
          ...slideContainerStyle,
          transform: activeTab === "profile" ? "translateX(0)" : "translateX(100%)",
          opacity: activeTab === "profile" ? 1 : 0,
          pointerEvents: activeTab === "profile" ? "auto" : "none"
        }}>
          {isLoggedIn ? (
            <Profile 
              user={user} 
              onLogout={onLogout} 
              setHideFooter={(val) => setIsFooterVisible(!val)} 
            />
          ) : (
            <AuthForm onLoginSuccess={onLoginSuccess} />
          )}
        </div>

        {/* ADMIN OVERLAY */}
        {activeTab === "admin" && (
          <div style={{ 
            position: 'fixed', 
            inset: 0, 
            zIndex: 10001, 
            backgroundColor: 'var(--bg-color)',
            overflowY: 'auto'
          }}>
            {isLoggedIn && user?.role === 'admin' ? (
              <AdminUpload />
            ) : (
              <AuthForm onLoginSuccess={onLoginSuccess} />
            )}
          </div>
        )}
      </main>

      {/* 🟢 GLOBAL FOOTER */}
      {isFooterVisible && (
        <nav style={navStyle}>
          <button 
            onClick={() => setActiveTab("home")} 
            style={{...btnStyle, color: activeTab === 'home' ? 'var(--primary-color)' : '#8e8e8e'}}
          >
            <HomeIcon 
              size={24} 
              strokeWidth={activeTab === 'home' ? 2.5 : 2} 
              fill={activeTab === 'home' ? 'currentColor' : 'none'}
            />
            <span style={labelStyle}>Home</span>
          </button>

          <button 
            onClick={() => setActiveTab("profile")} 
            style={{...btnStyle, color: activeTab === 'profile' ? 'var(--primary-color)' : '#8e8e8e'}}
          >
            <User 
              size={24} 
              strokeWidth={activeTab === 'profile' ? 2.5 : 2} 
              fill={activeTab === 'profile' ? 'currentColor' : 'none'}
            />
            <span style={labelStyle}>Profile</span>
          </button>

          {user?.role === 'admin' && (
            <button 
              onClick={() => setActiveTab("admin")} 
              style={{...btnStyle, color: activeTab === 'admin' ? 'var(--primary-color)' : '#8e8e8e'}}
            >
              <ShieldCheck 
                size={24} 
                strokeWidth={activeTab === 'admin' ? 2.5 : 2} 
                fill={activeTab === 'admin' ? 'currentColor' : 'none'}
              />
              <span style={labelStyle}>Admin</span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}

// 🎨 UPDATED STYLES
const navStyle = { 
  position: 'fixed', bottom: 0, left: 0, right: 0, height: '70px', 
  backgroundColor: 'rgba(10, 10, 10, 0.8)', // 🟢 Darker for better contrast
  backdropFilter: 'blur(20px)', 
  WebkitBackdropFilter: 'blur(20px)',
  borderTop: '1px solid rgba(255, 255, 255, 0.08)', 
  display: 'flex', justifyContent: 'space-around', alignItems: 'center', 
  zIndex: 10000, paddingBottom: 'env(safe-area-inset-bottom)' 
};

const btnStyle = { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flex: 1, transition: 'all 0.3s ease' };
const labelStyle = { fontSize: '10px', fontWeight: '700' };

const slideContainerStyle = {
  position: 'absolute',
  top: 0,
  left: 0,
  width: '100%',
  /* 🟢 Forces each slide to be exactly as tall as the main area */
  height: '100%', 
  overflowY: 'auto',
  /* 🟢 Prevents background leakage */
  backgroundColor: 'var(--bg-color)', 
  transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease',
  willChange: 'transform, opacity',
  /* 🟢 Standardizes scrolling for mobile */
  WebkitOverflowScrolling: 'touch' 
};