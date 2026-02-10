import { useEffect, useState } from "react";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import AdminUpload from "./pages/AdminUpload"; // 🟢 1. Import Admin Page
import { Home as HomeIcon, User, ShieldCheck } from "lucide-react";

export default function App() {
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

  useEffect(() => {
    // Check for a secret URL parameter to open Admin (e.g., yoursite.com/?admin=true)
    const params = new URLSearchParams(window.location.search);
    if (params.get("admin") === "true") {
      setActiveTab("admin");
    }

    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="pb-20">
        {/* 🟢 2. UPDATED SWITCH LOGIC */}
        {activeTab === "home" && (
          <Home key={`home-${refreshKey.home}`} />
        )}
        
        {activeTab === "profile" && (
          <Profile key={`profile-${refreshKey.profile}`} />
        )}

        {activeTab === "admin" && (
          <AdminUpload />
        )}
      </main>

      {/* BOTTOM NAVIGATION */}
      <nav style={navStyle}>
        {/* Home Button */}
        <button 
          onClick={() => handleTabClick("home")}
          style={{...btnStyle, color: activeTab === 'home' ? '#fff' : '#666'}}
        >
          <HomeIcon size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
          <span style={labelStyle}>Home</span>
        </button>

        {/* Profile Button */}
        <button 
          onClick={() => handleTabClick("profile")}
          style={{...btnStyle, color: activeTab === 'profile' ? '#fff' : '#666'}}
        >
          <User size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
          <span style={labelStyle}>Profile</span>
        </button>

        {/* 🟢 SECRET ADMIN ACCESS 
            This button only shows if you are in admin mode, 
            or you can keep it hidden and use the URL param instead. 
        */}
        {activeTab === "admin" && (
          <button 
            onClick={() => setActiveTab("admin")}
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

// 🎨 Styles
const navStyle = {
  position: 'fixed', bottom: 0, left: 0, right: 0, height: '70px',
  backgroundColor: '#121212', borderTop: '1px solid #222',
  display: 'flex', justifyContent: 'space-around', alignItems: 'center',
  zIndex: 1000, paddingBottom: 'env(safe-area-inset-bottom)'
};

const btnStyle = { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer' };
const labelStyle = { fontSize: '10px', fontWeight: '600' };