import { useEffect, useState } from "react";
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

  const handleTabClick = (tab) => {
    if (activeTab === tab) {
      setRefreshKey((prev) => ({ ...prev, [tab]: prev[tab] + 1 }));
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setActiveTab(tab);
    }
  };

  const onLoginSuccess = (userData, userToken) => {
    localStorage.setItem("token", userToken);
    setToken(userToken);
    setUser(userData);
    // After login, send them to the Profile they were trying to reach
    setActiveTab("profile"); 
  };

  const onLogout = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    setActiveTab("home");
  };

  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    document.body.appendChild(script);

    if (token && !user) {
      fetch(`${import.meta.env.VITE_API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setUser(data))
      .catch(() => onLogout());
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "true") setActiveTab("admin");
  }, [token]);

  return (
    <div className="min-h-screen bg-black text-white">
      <main style={{ paddingBottom: "90px" }}> 
        
        {/* 🟢 1. HOME: Always accessible to everyone */}
        {activeTab === "home" && (
          <Home key={`home-${refreshKey.home}`} user={user} />
        )}
        
        {/* 🟢 2. PROFILE: Guarded logic */}
        {activeTab === "profile" && (
          token && user ? (
            <Profile 
              key={`profile-${refreshKey.profile}`} 
              user={user} 
              onLogout={onLogout} 
            />
          ) : (
            <AuthForm onLoginSuccess={onLoginSuccess} />
          )
        )}

        {/* 🟢 3. ADMIN: Guarded logic */}
        {activeTab === "admin" && (
          token && user ? (
            <AdminUpload />
          ) : (
            <AuthForm onLoginSuccess={onLoginSuccess} />
          )
        )}
      </main>

      {/* 🟢 STICKY FOOTER (Always rendered) */}
      <nav style={navStyle}>
        <button 
          onClick={() => handleTabClick("home")}
          style={{...btnStyle, color: activeTab === 'home' ? '#ff3b30' : '#8e8e8e'}}
        >
          <HomeIcon size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
          <span style={labelStyle}>Home</span>
        </button>

        <button 
          onClick={() => handleTabClick("profile")}
          style={{...btnStyle, color: activeTab === 'profile' ? '#ff3b30' : '#8e8e8e'}}
        >
          <User size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
          <span style={labelStyle}>Profile</span>
        </button>

        {activeTab === "admin" && (
          <button 
            onClick={() => handleTabClick("admin")}
            style={{...btnStyle, color: '#ff3b30'}}
          >
            <ShieldCheck size={24} />
            <span style={labelStyle}>Admin</span>
          </button>
        )}
      </nav>
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