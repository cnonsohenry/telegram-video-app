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
  
  const [isSharedVideoView, setIsSharedVideoView] = useState(false);

  const isLoggedIn = !!token;
  const needsPitch = !isLoggedIn && activeTab === "profile" && !hasSeenPitch;

  // 🟢 AdFreeZone logic
  const isAdFreeZone = needsPitch || activeTab === "profile" || activeTab === "admin" || showPaywall || !!activeLegalPage || (!!activeVideo && !isSharedVideoView);
  
  useAdZapper(isAdFreeZone);

  // 🟢 ABSOLUTE NUCLEAR AD BLOCKER (CSS + JS TERMINATOR)
  useEffect(() => {
    const styleId = "nuclear-ad-blocker";
    let styleEl = document.getElementById(styleId);
    let adKillerInterval; // Define the interval variable

    if (isAdFreeZone) {
      // 1. Inject aggressive CSS rules
      if (!styleEl) {
        styleEl = document.createElement("style");
        styleEl.id = styleId;
        styleEl.innerHTML = `
          div[id^="container-"], 
          iframe[src*="adsterra"], 
          iframe[src*="topcreativeformat"],
          .adsterra-social-bar,
          .adsterra-wrapper,
          [id*="effectivegatecpm"],
          div[style*="z-index: 2147483647"],
          div[style*="z-index: 2147483646"] { 
            display: none !important; 
            opacity: 0 !important; 
            pointer-events: none !important; 
            visibility: hidden !important; 
            z-index: -9999 !important;
            width: 0 !important;
            height: 0 !important;
          }
        `;
        document.head.appendChild(styleEl);
      }

      // 2. Start the physical Terminator Interval
      const nukeAds = () => {
        const ads = document.querySelectorAll('iframe[src*="adsterra"], div[id^="container-"], .adsterra-social-bar, [id*="effectivegatecpm"], .adsterra-wrapper');
        ads.forEach(ad => ad.remove());
        
        // Remove sneaky padding/margins Adsterra adds to the body to push content down
        if (document.body.style.paddingTop) document.body.style.paddingTop = "";
        if (document.body.style.marginTop) document.body.style.marginTop = "";
      };

      nukeAds(); // Fire immediately
      adKillerInterval = setInterval(nukeAds, 400); // Fire every 400ms relentlessly

    } else {
      // Clean up when we go back to the Home feed (where ads are allowed)
      if (styleEl) styleEl.remove();
      if (adKillerInterval) clearInterval(adKillerInterval);
    }

    // Cleanup on unmount or dependency change
    return () => {
      if (adKillerInterval) clearInterval(adKillerInterval);
    };
  }, [isAdFreeZone]);

  // TELEGRAM IN-APP BROWSER FIX
  useEffect(() => {
    const preventOverscroll = (e) => {
      const scrollable = e.target.closest('[style*="overflow-y: auto"], [style*="overflowY: auto"]');
      if (!scrollable) {
        if (e.cancelable) e.preventDefault();
        return;
      }
    };
    document.addEventListener('touchmove', preventOverscroll, { passive: false });
    return () => document.removeEventListener('touchmove', preventOverscroll);
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
    const params = new URLSearchParams(window.location.search);
    let sharedVideoId = params.get("v");

    if (!sharedVideoId && window.location.pathname.startsWith('/v/')) {
      sharedVideoId = window.location.pathname.split('/')[2];
    }

    if (sharedVideoId) {
      setIsSharedVideoView(true);
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

  const shouldShowFooter = isFooterVisible && !activeVideo && !showPaywall && activeTab !== "admin"; 

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
          paddingBottom: shouldShowFooter ? "70px" : "0",
        }}
      > 
        {/* 🟢 HOME SLIDE */}
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
        
        {/* 🟢 PROFILE SLIDE */}
        <div style={{ 
          ...slideContainerStyle,
          transform: activeTab === "profile" ? "translateX(0)" : (activeTab === "home" ? "translateX(100%)" : "translateX(-100%)"),
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

        
      </main>
      {/* 🟢 ADMIN PORTAL */}
        {activeTab === "admin" && (
          <AdminUpload 
            onClose={() => {
              window.history.replaceState({}, document.title, "/"); 
              setActiveTab("home"); 
            }} 
          />
        )}

      {/* 🟢 NAVIGATION FOOTER */}
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

      {/* 🟢 MODALS & OVERLAYS */}
      {showPaywall && (
        <PaywallModal user={user} onClose={() => setShowPaywall(false)} />
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
            onClose={() => {
              setActiveVideo(null);
              setIsSharedVideoView(false); 
            }} 
            isDesktop={window.innerWidth > 1024} 
          />
        </div>
      )}
    </div>
  );
}

// 🖌 STYLES
const navStyle = { position: 'fixed', bottom: 0, left: 0, right: 0, height: '70px', backgroundColor: '#0a0a0a', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-around', alignItems: 'center', zIndex: 10000, paddingBottom: 'env(safe-area-inset-bottom)' };
const btnStyle = { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', cursor: 'pointer', flex: 1, transition: 'all 0.3s ease' };
const labelStyle = { fontSize: '10px', fontWeight: '700' };

const slideContainerStyle = { 
  position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', 
  overflowY: 'auto', backgroundColor: 'var(--bg-color)', 
  transition: 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease', 
  willChange: 'transform, opacity', 
  WebkitOverflowScrolling: 'touch',
  transform: 'translateZ(0)', 
  WebkitBackfaceVisibility: 'hidden', 
  backfaceVisibility: 'hidden',
  overscrollBehaviorY: 'contain', 
  touchAction: 'pan-y'            
};