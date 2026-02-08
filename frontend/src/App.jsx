import { useEffect, useState } from "react";
import Header from "./components/Header";
import Home from "./pages/Home";
import Profile from "./pages/Profile"; // 🟢 Import your new Profile page
import { Home as HomeIcon, User } from "lucide-react"; // Icons for the nav

export default function App() {
  const [activeTab, setActiveTab] = useState("home"); // 🟢 Track current tab

  useEffect(() => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.ready();
      window.Telegram.WebApp.expand();
    }
  }, []);

  return (
    <div className="min-h-screen bg-black text-white">
      {/* 🟢 CONDITIONAL RENDERING: Shows either Home or Profile */}
      <main className="pb-20"> {/* pb-20 adds space so content isn't hidden by the nav */}
        {activeTab === "home" ? (
          <Home />
        ) : (
          <Profile />
        )}
      </main>

      {/* 🟢 BOTTOM NAVIGATION BAR */}
      <nav style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '70px',
        backgroundColor: '#121212',
        borderTop: '1px solid #222',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        zIndex: 1000,
        paddingBottom: 'env(safe-area-inset-bottom)' // Respects iPhone "notch" at bottom
      }}>
        
        {/* Home Button */}
        <button 
          onClick={() => setActiveTab("home")}
          style={{
            background: 'none', border: 'none', display: 'flex', flexDirection: 'column', 
            alignItems: 'center', gap: '4px', color: activeTab === 'home' ? '#fff' : '#666'
          }}
        >
          <HomeIcon size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} />
          <span style={{ fontSize: '10px', fontWeight: '600' }}>Home</span>
        </button>

        {/* Profile Button */}
        <button 
          onClick={() => setActiveTab("profile")}
          style={{
            background: 'none', border: 'none', display: 'flex', flexDirection: 'column', 
            alignItems: 'center', gap: '4px', color: activeTab === 'profile' ? '#fff' : '#666'
          }}
        >
          <User size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} />
          <span style={{ fontSize: '10px', fontWeight: '600' }}>Exclusive</span>
        </button>

      </nav>
    </div>
  );
}