import { useEffect, useState, useCallback } from "react";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import AdminUpload from "./pages/AdminUpload";
import AuthForm from "./components/AuthForm"; 
import { Home as HomeIcon, User, ShieldCheck } from "lucide-react";

export default function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [activeTab, setActiveTab] = useState("home");
  const [refreshKey, setRefreshKey] = useState({ home: 0, profile: 0 });
  const [isFooterVisible, setIsFooterVisible] = useState(true);

  // 🟢 1. ATOMIC LOGOUT: Clears everything in one shot
  const onLogout = useCallback(() => {
    console.log("Atomic logout initiated...");
    
    // Nuke storage
    localStorage.removeItem("token");
    
    // Reset Google Session
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }

    // Update all states together to prevent "Guest" flicker
    setUser(null);
    setToken(null);
    setActiveTab("home");
    setIsFooterVisible(true);

    // Hard reload as a final cleanup
    window.location.href = "/";
  }, []);

  // 🟢 2. ATOMIC LOGIN: Syncs state and storage instantly
  const onLoginSuccess = (userData, userToken) => {
    localStorage.setItem("token", userToken);
    
    // Batch updates
    setToken(userToken);
    setUser(userData);
    
    // Logic: If user is admin, they might want to see the admin tab, 
    // but usually, landing on Profile is the best feedback.
    setActiveTab("profile");
  };

  const handleTabClick = (tab) => {
    if (activeTab === tab) {
      setRefreshKey((prev) => ({ ...prev, [tab]: prev[tab] + 1 }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setActiveTab(tab);
    }
  };

  // 🟢 3. SESSION RECOVERY: Effect now depends on token
  useEffect(() => {
    if (token && !user) {
      fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setUser(data))
      .catch(() => {
        // If the token is invalid, clear it
        localStorage.removeItem("token");
        setToken(null);
      });
    }
    
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "true") setActiveTab("admin");
  }, [token]); // Triggers whenever token changes

  return (
    <div className="min-h-screen bg-black text-white">
      <main style={{ paddingBottom: isFooterVisible ? "90px" : "0" }}> 
        
        {/* HOME TAB */}
        {activeTab === "home" && (
          <Home 
            user={user} 
            onProfileClick={() => setActiveTab("profile")}
            setHideFooter={(val) => setIsFooterVisible(!val)}
          />
        )}
        
        {/* PROFILE TAB: Handled by Auth Gate */}
        {activeTab === "profile" && (
          token ? (
            user ? (
              <Profile 
                user={user} 
                onLogout={onLogout} 
                setHideFooter={(val) => setIsFooterVisible(!val)}
              />
            ) : (
              <div style={loadingOverlay}>Loading profile...</div>
            )
          ) : (
            <AuthForm onLoginSuccess={onLoginSuccess} />
          )
        )}

        {/* ADMIN TAB: Logic check */}
        {activeTab === "admin" && (
          token && user ? <AdminUpload /> : <AuthForm onLoginSuccess={onLoginSuccess} />
        )}
      </main>

      {/* STICKY FOOTER */}
      {isFooterVisible && (
        <nav style={navStyle}>
          <button onClick={() => handleTabClick("home")} style={{...btnStyle, color: activeTab === 'home' ? '#ff3b30' : '#8e8e8e'}}>
            <HomeIcon size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
            <span style={labelStyle}>Home</span>
          </button>

          <button onClick={() => handleTabClick("profile")} style={{...btnStyle, color: activeTab === 'profile' ? '#ff3b30' : '#8e8e8e'}}>
            <User size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
            <span style={labelStyle}>Profile</span>
          </button>

          {/* Only show Admin icon if user is actually an admin */}
          {(user?.role === 'admin' || activeTab === "admin") && (
            <button onClick={() => handleTabClick("admin")} style={{...btnStyle, color: activeTab === 'admin' ? '#ff3b30' : '#8e8e8e'}}>
              <ShieldCheck size={24} />
              <span style={labelStyle}>Admin</span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}

// 🎨 SHARED STYLES
const navStyle = { position: 'fixed', bottom: 0, left: 0, right: 0, height: '70px', backgroundColor: '#121212', borderTop: '1px solid #222', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 10000, paddingBottom: 'env(safe-area-inset-bottom)' };
const btnStyle = { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flex: 1 };
const labelStyle = { fontSize: '10px', fontWeight: '700' };
const loadingOverlay = { height: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#666" };