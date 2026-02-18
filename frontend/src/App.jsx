import { useEffect, useState, useMemo, useCallback } from "react";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import AdminUpload from "./pages/AdminUpload";
import AuthForm from "./components/AuthForm";
import PitchView from "./components/PitchView"; // 🟢 1. Import the new PitchView
import { useAdZapper } from "./hooks/useAdZapper";
import { Home as HomeIcon, User, ShieldCheck } from "lucide-react";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [isFooterVisible, setIsFooterVisible] = useState(true);
  
  // 🟢 2. PITCH TRACKER
  // Tracks if the user has completed the onboarding slides in this session
  const [hasSeenPitch, setHasSeenPitch] = useState(false);

  // 🟢 AUTOMATIC ZAPPER
  // Turn ON for profile, admin, or during the pitch. 
  // Turn OFF (false) for the home page so you can still earn money.
  const isAdFreeZone = !hasSeenPitch || activeTab === "profile" || activeTab === "admin";
  useAdZapper(isAdFreeZone);

  const onLoginSuccess = (userData, userToken) => {
    localStorage.setItem("token", userToken);
    setToken(userToken);
    setUser(userData);
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

  useEffect(() => {
    if (token && !user) {
      fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setUser(data))
      .catch(() => {
        localStorage.removeItem("token");
        setToken(null);
      });
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "true") setActiveTab("admin");
  }, [token, user]);

  const isLoggedIn = useMemo(() => !!token, [token]);

  // 🟢 3. THE GATEKEEPER LOGIC
  // If the user is logged out, trying to access Profile/Admin, and hasn't seen the pitch:
  // We return ONLY the PitchView. This prevents the Main and Footer from ever rendering.
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
            /* Pitch is already handled by Gatekeeper, so we just show Auth here */
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

      {/* 🟢 GLOBAL FOOTER */}
      {isFooterVisible && (
        <nav style={navStyle}>
          <button onClick={() => setActiveTab("home")} style={{...btnStyle, color: activeTab === 'home' ? '#ff3b30' : '#8e8e8e'}}>
            <HomeIcon size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span style={labelStyle}>Home</span>
          </button>

          <button onClick={() => setActiveTab("profile")} style={{...btnStyle, color: activeTab === 'profile' ? '#ff3b30' : '#8e8e8e'}}>
            <User size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
            <span style={labelStyle}>Profile</span>
          </button>

          {user?.role === 'admin' && (
            <button onClick={() => setActiveTab("admin")} style={{...btnStyle, color: activeTab === 'admin' ? '#ff3b30' : '#8e8e8e'}}>
              <ShieldCheck size={24} />
              <span style={labelStyle}>Admin</span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}

// 🎨 STYLES
const navStyle = { 
  position: 'fixed', bottom: 0, left: 0, right: 0, height: '70px', 
  backgroundColor: '#121212', borderTop: '1px solid #222', 
  display: 'flex', justifyContent: 'space-around', alignItems: 'center', 
  zIndex: 10000, paddingBottom: 'env(safe-area-inset-bottom)' 
};

const btnStyle = { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flex: 1 };
const labelStyle = { fontSize: '10px', fontWeight: '700' };