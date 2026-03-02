import { useEffect, useState, useCallback } from "react";
import Home from "./pages/Home";
import Profile from "./pages/Profile";
import AdminUpload from "./pages/AdminUpload";
import AuthForm from "./components/AuthForm";
import PitchView from "./components/PitchView";
import FullscreenPlayer from "./components/FullscreenPlayer"; 
import PaywallModal from "./components/PaywallModal"; 
import LegalPages from "./pages/LegalPages"; 
import { useAdZapper } from "./hooks/useAdZapper";
import { Home as HomeIcon, User, ShieldCheck } from "lucide-react";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState("home");
  const [isFooterVisible, setIsFooterVisible] = useState(true);
  const [hasSeenPitch, setHasSeenPitch] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null); 
  const [showPaywall, setShowPaywall] = useState(false);
  const [activeLegalPage, setActiveLegalPage] = useState(null); 

  // 🟢 Define auth and viewing states BEFORE the zapper hook
  const isLoggedIn = !!token;
  const needsPitch = !isLoggedIn && (activeTab === "profile" || activeTab === "admin") && !hasSeenPitch;

  // 🟢 AdFreeZone logic
  const isAdFreeZone = needsPitch || activeTab === "profile" || activeTab === "admin" || !!activeVideo || showPaywall || !!activeLegalPage;
  
  useAdZapper(isAdFreeZone);

  // 🟢 TELEGRAM IN-APP BROWSER FIX (The Touch Shield)
  // This physically blocks the WebView from minimizing when swiping on non-scrollable areas
  useEffect(() => {
    const preventOverscroll = (e) => {
      // Find out if the user is touching something that is supposed to scroll
      const scrollable = e.target.closest('[style*="overflow-y: auto"], [style*="overflowY: auto"]');
      
      // If we aren't touching a scrollable list (like touching the header/footer), block the swipe
      if (!scrollable) {
        if (e.cancelable) e.preventDefault();
        return;
      }

      // If we ARE touching the list, but we are at the very top, block the swipe down
      if (scrollable.scrollTop <= 0 && e.touches && e.touches.length > 0 && e.touches[0].clientY > 0) {
        // We rely heavily on the CSS 'contain' rule below, but this stops aggressive rogue touches
      }
    };

    // Attach to the document with passive: false so we have permission to cancel the event
    document.addEventListener('touchmove', preventOverscroll, { passive: false });
    
    return () => {
      document.removeEventListener('touchmove', preventOverscroll);
    };
  }, []);

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

  useEffect(() => {
    // 1. Check for query parameter (/?v=1847)
    const params = new URLSearchParams(window.location.search);
    let sharedVideoId = params.get("v");

    // 🟢 2. FIX: Check for clean path from the sitemap (/v/1847)
    if (!sharedVideoId && window.location.pathname.startsWith('/v/')) {
      sharedVideoId = window.location.pathname.split('/')[2];
    }

    if (sharedVideoId) {
      const fetchSharedVideo = async () => {
        try {
          const res = await fetch(`${import.meta.env.VITE_API_URL}/api/video/details?message_id=${sharedVideoId}`);
          if (res.ok) {
            const videoData = await res.json();
            setActiveVideo({ ...videoData, video_url: null });
            
            const playRes = await fetch(`${import.meta.env.VITE_API_URL}/api/video?chat_id=${videoData.chat_id}&message_id=${videoData.message_id}`);
            if (playRes.ok) {
              const playData = await playRes.json();
              setActiveVideo(prev => ({ ...prev, video_url: playData.video_url }));
            }
          }
        } catch (error) {
          console.error("Failed to load shared video:", error);
        } finally {
          // Clean up the URL in the browser bar after the video loads
          window.history.replaceState({}, document.title, "/");
        }
      };
      
      fetchSharedVideo();
    }
  }, []);

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
    
    const legalParam = params.get("legal");
    if (legalParam) {
      setActiveLegalPage(legalParam);
    }
  }, [token, user, applyTheme]);

  const shouldShowFooter = isFooterVisible && !activeVideo && !showPaywall; 

  if (needsPitch) {
    return <PitchView onComplete={() => setHasSeenPitch(true)} />;
  }

  return (
    <div style={{ 
      height: '100dvh', 
      width: '100vw', 
      backgroundColor: 'var(--bg-color)', 
      color: '#fff', 
      overflow: 'hidden',
      position: 'fixed' 
    }}>
      <main 
        style={{ 
          position: 'relative',
          width: '100%',
          height: '100%',
          paddingBottom: shouldShowFooter && activeTab !== "admin" ? "70px" : "0",
        }}
      > 
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
            setActiveVideo={setActiveVideo}
            setShowPaywall={setShowPaywall} 
          />
        </div>
        
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
              setActiveVideo={setActiveVideo} 
              setHideFooter={(val) => setIsFooterVisible(!val)} 
              setShowPaywall={setShowPaywall} 
            />
          ) : (
            <AuthForm onLoginSuccess={onLoginSuccess} />
          )}
        </div>

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

      {shouldShowFooter && (
        <nav style={navStyle}>
          <button 
            onClick={() => setActiveTab("home")} 
            style={{...btnStyle, color: activeTab === 'home' ? 'var(--primary-color)' : '#8e8e8e'}}
          >
            <HomeIcon size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} fill={activeTab === 'home' ? 'currentColor' : 'none'} />
            <span style={labelStyle}>Home</span>
          </button>

          <button 
            onClick={() => setActiveTab("profile")} 
            style={{...btnStyle, color: activeTab === 'profile' ? 'var(--primary-color)' : '#8e8e8e'}}
          >
            <User size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} fill={activeTab === 'profile' ? 'currentColor' : 'none'} />
            <span style={labelStyle}>Profile</span>
          </button>

          {user?.role === 'admin' && (
            <button 
              onClick={() => setActiveTab("admin")} 
              style={{...btnStyle, color: activeTab === 'admin' ? 'var(--primary-color)' : '#8e8e8e'}}
            >
              <ShieldCheck size={24} strokeWidth={activeTab === 'admin' ? 2.5 : 2} fill={activeTab === 'admin' ? 'currentColor' : 'none'} />
              <span style={labelStyle}>Admin</span>
            </button>
          )}
        </nav>
      )}

      {showPaywall && (
        <PaywallModal 
          user={user} 
          onClose={() => setShowPaywall(false)} 
        />
      )}

      {activeLegalPage && (
        <LegalPages 
          initialPage={activeLegalPage} 
          onBack={() => {
            setActiveLegalPage(null);
            window.history.replaceState({}, document.title, window.location.pathname);
          }} 
        />
      )}

      {activeVideo && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999999, background: "#000" }}>
          <FullscreenPlayer 
            video={activeVideo} 
            onClose={() => setActiveVideo(null)} 
            isDesktop={window.innerWidth > 1024} 
          />
        </div>
      )}
    </div>
  );
}

const navStyle = { position: 'fixed', bottom: 0, left: 0, right: 0, height: '70px', backgroundColor: '#0a0a0a', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 10000, paddingBottom: 'env(safe-area-inset-bottom)' };
const btnStyle = { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flex: 1, transition: 'all 0.3s ease' };
const labelStyle = { fontSize: '10px', fontWeight: '700' };

// 🟢 FIX: Added GPU acceleration, overscroll trap, and specific touch actions
const slideContainerStyle = { 
  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
  overflowY: 'auto', backgroundColor: 'var(--bg-color)', 
  transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease', 
  willChange: 'transform, opacity', 
  WebkitOverflowScrolling: 'touch',
  transform: 'translateZ(0)', 
  WebkitBackfaceVisibility: 'hidden', 
  backfaceVisibility: 'hidden',
  overscrollBehaviorY: 'contain', // Traps the scroll inside this div!
  touchAction: 'pan-y'            // Tells the browser this div only handles vertical swipes
};