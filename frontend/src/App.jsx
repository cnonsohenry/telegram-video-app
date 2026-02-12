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
  
  // 🟢 THE MASTER SWITCH FOR THE FOOTER
  const [isFooterVisible, setIsFooterVisible] = useState(true);

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
    setActiveTab("profile"); 
  };

  const onLogout = () => {
  console.log("Logging out...");
  
  // 1. Clear Storage First
  localStorage.removeItem("token");
  
  // 2. Clear State immediately
  setToken(null);
  setUser(null);
  
  // 3. Reset Navigation
  setActiveTab("home");
  
  // 4. Force a clean state for the Google GSI library
  if (window.google) {
    window.google.accounts.id.disableAutoSelect();
  }
};

  useEffect(() => {
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
      <main style={{ paddingBottom: isFooterVisible ? "90px" : "0" }}> 
        
        {activeTab === "home" && (
          <Home 
            user={user} 
            onProfileClick={() => setActiveTab("profile")}
            setHideFooter={(val) => setIsFooterVisible(!val)} // 🟢 Pass the setter
          />
        )}
        
        {activeTab === "profile" && (
          token && user ? (
            <Profile 
              user={user} 
              onLogout={onLogout} 
              setHideFooter={(val) => setIsFooterVisible(!val)} // 🟢 Pass the setter
            />
          ) : (
            <AuthForm onLoginSuccess={onLoginSuccess} />
          )
        )}

        {activeTab === "admin" && (token && user ? <AdminUpload /> : <AuthForm onLoginSuccess={onLoginSuccess} />)}
      </main>

      {/* 🟢 THE FOOTER GUARD */}
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

          {activeTab === "admin" && (
            <button onClick={() => handleTabClick("admin")} style={{...btnStyle, color: '#ff3b30'}}>
              <ShieldCheck size={24} />
              <span style={labelStyle}>Admin</span>
            </button>
          )}
        </nav>
      )}
    </div>
  );
}

const navStyle = { position: 'fixed', bottom: 0, left: 0, right: 0, height: '70px', backgroundColor: '#121212', borderTop: '1px solid #222', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 10000, paddingBottom: 'env(safe-area-inset-bottom)' };
const btnStyle = { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flex: 1 };
const labelStyle = { fontSize: '10px', fontWeight: '700' };