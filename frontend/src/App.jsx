import { useEffect, useState, useMemo, useCallback } from "react";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import AdminUpload from "./pages/AdminUpload";
import AuthForm from "./components/AuthForm"; 
import { Home as HomeIcon, User, ShieldCheck } from "lucide-react";

export default function App() {
  // 🟢 1. CENTRALIZED STATE
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [isFooterVisible, setIsFooterVisible] = useState(true);

  // 🟢 2. ATOMIC LOGIN
  // This updates the "One Brain" instantly
  const onLoginSuccess = (userData, userToken) => {
    localStorage.setItem("token", userToken);
    setToken(userToken);
    setUser(userData);
    // After login, send them to the Profile tab they were trying to access
    setActiveTab("profile"); 
  };

  // 🟢 3. ATOMIC LOGOUT
  // Nukes memory and forces a clean browser slate
  const onLogout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setActiveTab("home");
    
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
    
    // Redirect is the only way to be 100% sure Google GSI cache is cleared
    window.location.href = "/"; 
  }, []);

  // 🟢 4. SESSION RECOVERY
  // Only runs when the token exists but user data is missing
  useEffect(() => {
    if (token && !user) {
      fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setUser(data))
      .catch(() => {
        // If fetch fails, the token is dead. Clean up.
        localStorage.removeItem("token");
        setToken(null);
      });
    }
    
    // Admin deep-link check
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "true") setActiveTab("admin");
  }, [token, user]);

  const isLoggedIn = useMemo(() => !!token, [token]);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* 🟢 DYNAMIC PADDING based on footer visibility */}
      <main style={{ paddingBottom: isFooterVisible ? "90px" : "0" }}> 
        
        {/* TAB 1: HOME (Public) */}
        {activeTab === "home" && (
          <Home 
            user={user} 
            onProfileClick={() => setActiveTab("profile")}
            setHideFooter={(val) => setIsFooterVisible(!val)}
          />
        )}
        
        {/* TAB 2: PROFILE (Guarded) */}
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

        {/* TAB 3: ADMIN (Double Guarded) */}
        {activeTab === "admin" && (
          isLoggedIn && user?.role === 'admin' ? (
            <AdminUpload />
          ) : (
            <AuthForm onLoginSuccess={onLoginSuccess} />
          )
        )}
      </main>

      {/* 🟢 GLOBAL FOOTER (Always listens to One Brain) */}
      {isFooterVisible && (
        <nav style={navStyle}>
          <button 
            onClick={() => setActiveTab("home")} 
            style={{...btnStyle, color: activeTab === 'home' ? '#ff3b30' : '#8e8e8e'}}
          >
            <HomeIcon size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span style={labelStyle}>Home</span>
          </button>

          <button 
            onClick={() => setActiveTab("profile")} 
            style={{...btnStyle, color: activeTab === 'profile' ? '#ff3b30' : '#8e8e8e'}}
          >
            <User size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
            <span style={labelStyle}>Profile</span>
          </button>

          {/* Role-based icon display */}
          {user?.role === 'admin' && (
            <button 
              onClick={() => setActiveTab("admin")} 
              style={{...btnStyle, color: activeTab === 'admin' ? '#ff3b30' : '#8e8e8e'}}
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
  backgroundColor: '#121212', borderTop: '1px solid #222', 
  display: 'flex', justifyContent: 'space-around', alignItems: 'center', 
  zIndex: 10000, paddingBottom: 'env(safe-area-inset-bottom)' 
};

const btnStyle = { 
  background: 'none', border: 'none', display: 'flex', 
  flexDirection: 'column', alignItems: 'center', gap: '4px', 
  cursor: 'pointer', flex: 1 
};

const labelStyle = { fontSize: '10px', fontWeight: '700' };