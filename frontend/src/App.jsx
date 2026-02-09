import { useEffect, useState } from "react";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import { Home as HomeIcon, User } from "lucide-react";

export default function App() {
  const [activeTab, setActiveTab] = useState("home");
  // 🟢 Track a "refresh key" for each tab
  const [refreshKey, setRefreshKey] = useState({ home: 0, profile: 0 });

  const handleTabClick = (tab) => {
    if (activeTab === tab) {
      // 🟢 If already on this tab, increment the key to force a refresh
      setRefreshKey((prev) => ({ ...prev, [tab]: prev[tab] + 1 }));
      window.scrollTo({ top: 0, behavior: "smooth" }); // Scroll to top like TikTok
    } else {
      setActiveTab(tab);
    }
  };

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      <main className="pb-20">
        {activeTab === "home" ? (
          <Home key={`home-${refreshKey.home}`} /> // 🟢 Key forces re-mount
        ) : (
          <Profile key={`profile-${refreshKey.profile}`} /> // 🟢 Key forces re-mount
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