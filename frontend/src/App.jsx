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
  // Helper to toggle CSS class and LocalStorage in sync
  const applyTheme = useCallback((theme) => {
    localStorage.setItem("theme", theme);
    if (theme === "orange") {
      document.body.classList.add("theme-orange");
    } else {
      document.body.classList.remove("theme-orange");
    }
  }, []);

  // Initialize theme from LocalStorage on mount (for guests)
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") || "red";
    applyTheme(savedTheme);
  }, [applyTheme]);

  const onLoginSuccess = (userData, userToken) => {
    localStorage.setItem("token", userToken);
    setToken(userToken);
    setUser(userData);
    
    // 🟢 Sync theme from DB on successful login
    if (userData.settings?.theme) {
      applyTheme(userData.settings.theme);
    }
    
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

  // 🟢 2. SESSION RECOVERY + DB THEME SYNC
  useEffect(() => {
    if (token && !user) {
      fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => {
        setUser(data);
        // 🟢 If DB has a theme, it overrides LocalStorage
        if (data.settings?.theme) {
          applyTheme(data.settings.theme);
        }
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
    <div className="min-h-screen bg-black text-white">
      <main style={{ paddingBottom: isFooterVisible && activeTab !== "admin" ? "90px" : "0" }}> 
        
        {activeTab === "home" && (
          <Home 
            user={user} 
            onProfileClick={() => setActiveTab("profile")}
            setHideFooter={(val) => setIsFooterVisible(!val)}
          />
        )}
        
        {activeTab === "profile" && (
          isLoggedIn ? (
            <Profile 
              user={user} 
              onLogout={onLogout} 
              setHideFooter={(val) => setIsFooterVisible(!val)} 
            />
          ) : (
            <AuthForm onLoginSuccess={onLoginSuccess} />
          )
        )}

        {activeTab === "admin" && (
          isLoggedIn && user?.role === 'admin' ? (
            <AdminUpload />
          ) : (
            <AuthForm onLoginSuccess={onLoginSuccess} />
          )
        )}
      </main>

      {/* 🟢 3. THEMED GLOBAL FOOTER */}
      {isFooterVisible && (
        <nav style={navStyle}>
          <button 
            onClick={() => setActiveTab("home")} 
            style={{...btnStyle, color: activeTab === 'home' ? 'var(--primary-color)' : '#8e8e8e'}}
          >
            <HomeIcon size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span style={labelStyle}>Home</span>
          </button>

          <button 
            onClick={() => setActiveTab("profile")} 
            style={{...btnStyle, color: activeTab === 'profile' ? 'var(--primary-color)' : '#8e8e8e'}}
          >
            <User size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
            <span style={labelStyle}>Profile</span>
          </button>

          {user?.role === 'admin' && (
            <button 
              onClick={() => setActiveTab("admin")} 
              style={{...btnStyle, color: activeTab === 'admin' ? 'var(--primary-color)' : '#8e8e8e'}}
            >
              <ShieldCheck size={24} />
              <span style={labelStyle}>Admin</span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}

// 🎨 CONSOLIDATED STYLES
const navStyle = { 
  position: 'fixed', bottom: 0, left: 0, right: 0, height: '70px', 
  /* Change this from '#121212' to be slightly lighter than the new navy */
  backgroundColor: 'rgba(255, 255, 255, 0.05)', 
  backdropFilter: 'blur(10px)', // Glassmorphism looks amazing on that navy background!
  borderTop: '1px solid rgba(255, 255, 255, 0.1)', 
  display: 'flex', justifyContent: 'space-around', alignItems: 'center', 
  zIndex: 10000, paddingBottom: 'env(safe-area-inset-bottom)' 
};

const btnStyle = { 
  background: 'none', border: 'none', display: 'flex', 
  flexDirection: 'column', alignItems: 'center', gap: '4px', 
  cursor: 'pointer', flex: 1, transition: 'color 0.3s ease' 
};

const labelStyle = { fontSize: '10px', fontWeight: '700' };