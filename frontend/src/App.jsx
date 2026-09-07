import { useEffect, useState, useCallback, useRef } from "react"; 
import Home from "./pages/Home";
import Explore from "./pages/Explore"; 
import Profile from "./pages/Profile";
import AdminDashboard from "./components/AdminDashboard"; 
import AuthForm from "./components/AuthForm";
import PitchView from "./components/PitchView";
import FullscreenPlayer from "./components/FullscreenPlayer"; 
import PaywallModal from "./components/PaywallModal"; 
import LegalPages from "./pages/LegalPages"; 
import CommentSectionModal from "./components/CommentSectionModal"; 
import { useAdZapper } from "./hooks/useAdZapper";
import { Home as HomeIcon, Compass, User, ShieldCheck } from "lucide-react";

import { APP_CONFIG } from "./config";

export default function App() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  
  // 🟢 Initialize activeTab from URL search params if present (?tab=explore, ?tab=profile, etc.)
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("tab");
    if (tabParam && ["home", "explore", "profile", "admin"].includes(tabParam.toLowerCase())) {
      return tabParam.toLowerCase();
    }
    if (params.get("admin") === "true") return "admin";
    if (window.location.pathname === "/login") return "profile";
    return "home";
  });

  const [isFooterVisible, setIsFooterVisible] = useState(true);
  const [hasSeenPitch, setHasSeenPitch] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null); 
  const [showPaywall, setShowPaywall] = useState(false);
  // 🟢 Initialize activeLegalPage from URL query param (?legal=about, ?legal=terms, etc.)
  const [activeLegalPage, setActiveLegalPage] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("legal") || null;
  }); 
  const [isSharedVideoView, setIsSharedVideoView] = useState(false);
  
  const [activeCommentVideo, setActiveCommentVideo] = useState(null);

  // 🟢 THE FIX: App Height Lock Architecture
  const windowWidth = useRef(window.innerWidth);
  const [appHeight, setAppHeight] = useState(`${window.innerHeight}px`);

  // 🟢 1. Track the active tab in a Ref so our callbacks can check it without re-rendering
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
    // Reset footer to visible whenever the user switches tabs!
    setIsFooterVisible(true);
  }, [activeTab]);

  // 🟢 Switch footer tabs with browser history integration
  const handleTabSwitch = useCallback((tabName, fromHistory = false) => {
    if (activeTabRef.current === tabName && !fromHistory) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      window.dispatchEvent(new CustomEvent("tabReselected", { detail: tabName }));
      return;
    }

    activeTabRef.current = tabName;
    setActiveTab(tabName);

    if (!fromHistory) {
      let targetUrl = "/";
      const currentState = window.history.state || {};
      const stateData = { ...currentState, tab: tabName };

      // Clean up overlay modal flags from new tab state
      delete stateData.videoPlayer;
      delete stateData.messageId;
      delete stateData.commentModal;
      delete stateData.paywall;
      delete stateData.searchOpen;
      delete stateData.albumOpen;

      if (tabName === "home") {
        const cat = stateData.cat || new URLSearchParams(window.location.search).get("cat");
        if (cat) {
          targetUrl = `/?cat=${encodeURIComponent(cat)}`;
        } else {
          targetUrl = "/";
        }
      } else {
        targetUrl = `/?tab=${encodeURIComponent(tabName)}`;
      }

      window.history.pushState(stateData, document.title, targetUrl);
    }
  }, []);

  // 🟢 Normalize initial history state on mount
  useEffect(() => {
    const currentState = window.history.state || {};
    if (!currentState.tab) {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      const currentTab = tabParam && ["home", "explore", "profile", "admin"].includes(tabParam.toLowerCase())
        ? tabParam.toLowerCase()
        : (params.get("admin") === "true" ? "admin" : (window.location.pathname === "/login" ? "profile" : "home"));
      
      const catParam = params.get("cat");
      const legalParam = params.get("legal");
      window.history.replaceState({
        ...currentState,
        tab: currentTab,
        ...(catParam ? { cat: catParam } : {}),
        ...(legalParam ? { legal: legalParam } : {})
      }, document.title, window.location.href);
    }
  }, []);

  // 🟢 2. Create exclusive, stable callbacks for each specific tab
  const handleHomeHideFooter = useCallback((hide) => {
    if (activeTabRef.current === "home") setIsFooterVisible(!hide);
  }, []);

  const handleProfileHideFooter = useCallback((hide) => {
    if (activeTabRef.current === "profile") setIsFooterVisible(!hide);
  }, []);

  const handleExploreHideFooter = useCallback((hide) => {
    if (activeTabRef.current === "explore") setIsFooterVisible(!hide);
  }, []);

  // 🟢 Browser History & Back Button Management for Video/Modals
  const activeVideoRef = useRef(null);
  const activeCommentVideoRef = useRef(null);
  const showPaywallRef = useRef(false);
  const activeLegalPageRef = useRef(null);

  useEffect(() => {
    activeVideoRef.current = activeVideo;
  }, [activeVideo]);

  useEffect(() => {
    activeCommentVideoRef.current = activeCommentVideo;
  }, [activeCommentVideo]);

  useEffect(() => {
    showPaywallRef.current = showPaywall;
  }, [showPaywall]);

  useEffect(() => {
    activeLegalPageRef.current = activeLegalPage;
  }, [activeLegalPage]);

  // 🟢 Synchronize browser history when opening a video
  useEffect(() => {
    if (activeVideo && activeVideo.message_id) {
      const currentState = window.history.state;
      const targetPath = `/v/${activeVideo.message_id}`;

      // Only push a new history entry if this video is not already the active entry
      if (!currentState?.videoPlayer || currentState?.messageId !== String(activeVideo.message_id)) {
        window.history.pushState(
          { ...(currentState || {}), videoPlayer: true, messageId: String(activeVideo.message_id) },
          document.title,
          targetPath
        );
      }
    }
  }, [activeVideo?.message_id]);

  // 🟢 Synchronize browser history when opening comment modal
  useEffect(() => {
    if (activeCommentVideo && activeCommentVideo.message_id) {
      if (!window.history.state?.commentModal) {
        window.history.pushState(
          { ...(window.history.state || {}), commentModal: true, videoPlayer: true, messageId: String(activeCommentVideo.message_id) },
          document.title
        );
      }
    }
  }, [activeCommentVideo]);

  // 🟢 Synchronize browser history when opening paywall modal
  useEffect(() => {
    if (showPaywall) {
      if (!window.history.state?.paywall) {
        window.history.pushState(
          { ...(window.history.state || {}), paywall: true },
          document.title
        );
      }
    }
  }, [showPaywall]);

  // 🟢 Handle browser Back button (popstate) to close overlays and switch tabs
  useEffect(() => {
    const handlePopState = (event) => {
      const state = event.state || {};

      // 1. If comments modal was open and state no longer has commentModal, close comments
      if (activeCommentVideoRef.current && !state.commentModal) {
        activeCommentVideoRef.current = null;
        setActiveCommentVideo(null);
        return;
      }

      // 2. If video player was open and state no longer has videoPlayer, close video
      if (activeVideoRef.current && !state.videoPlayer) {
        activeVideoRef.current = null;
        setActiveVideo(null);
        setIsSharedVideoView(false);
        return;
      }

      // 3. If paywall was open and state no longer has paywall, close paywall
      if (showPaywallRef.current && !state.paywall) {
        showPaywallRef.current = false;
        setShowPaywall(false);
        return;
      }

      // 4. If legal page was open and state no longer has legal, close legal page
      if (activeLegalPageRef.current && !state.legal) {
        activeLegalPageRef.current = null;
        setActiveLegalPage(null);
        return;
      }
      if (state.legal && state.legal !== activeLegalPageRef.current) {
        activeLegalPageRef.current = state.legal;
        setActiveLegalPage(state.legal);
        return;
      }

      // 5. If search overlay was open, AppHeader's popstate listener closes it
      if (state.searchOpen) {
        return;
      }

      // 6. Global Footer Tabs navigation
      const params = new URLSearchParams(window.location.search);
      const targetTab = state.tab || params.get("tab") || (params.get("admin") === "true" ? "admin" : "home");

      if (targetTab !== activeTabRef.current) {
        activeTabRef.current = targetTab;
        setActiveTab(targetTab);
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  // 🟢 Seamless in-app legal page navigation
  const handleOpenLegal = useCallback((pageId) => {
    setActiveLegalPage(pageId);
    activeLegalPageRef.current = pageId;
    const currentState = window.history.state || {};
    window.history.pushState(
      { ...currentState, legal: pageId },
      document.title,
      `/?legal=${encodeURIComponent(pageId)}`
    );
  }, []);

  const handleCloseLegal = useCallback(() => {
    activeLegalPageRef.current = null;
    setActiveLegalPage(null);
    if (window.history.state?.legal) {
      window.history.back();
    } else {
      const currentState = window.history.state || {};
      const currentTab = currentState.tab || "home";
      const targetUrl = currentTab === "home"
        ? (currentState.cat ? `/?cat=${encodeURIComponent(currentState.cat)}` : "/")
        : `/?tab=${encodeURIComponent(currentTab)}`;
      window.history.replaceState({ ...currentState, legal: null }, document.title, targetUrl);
    }
  }, []);

  useEffect(() => {
    const handleOpenLegalEvent = (e) => {
      if (e.detail) {
        handleOpenLegal(e.detail);
      }
    };
    window.addEventListener("openLegalPage", handleOpenLegalEvent);
    return () => window.removeEventListener("openLegalPage", handleOpenLegalEvent);
  }, [handleOpenLegal]);

  const handleCloseVideo = useCallback(() => {
    activeVideoRef.current = null;
    setActiveVideo(null);
    setIsSharedVideoView(false);
    if (window.history.state?.videoPlayer) {
      window.history.back();
    } else if (window.location.pathname.startsWith('/v/') || window.location.search.includes('v=')) {
      window.history.replaceState({}, document.title, "/");
    }
  }, []);

  const handleCloseComments = useCallback(() => {
    activeCommentVideoRef.current = null;
    setActiveCommentVideo(null);
    if (window.history.state?.commentModal) {
      window.history.back();
    }
  }, []);

  const handleClosePaywall = useCallback(() => {
    showPaywallRef.current = false;
    setShowPaywall(false);
    if (window.history.state?.paywall) {
      window.history.back();
    }
  }, []);

  useEffect(() => {
    // 🟢 Let React mount and render the UI, then tell Prerender to take the snapshot instantly
    // We use a small 1.5-second timeout to ensure your feed videos have fetched from the DB
    const timer = setTimeout(() => {
      if (window.prerenderReady === false) {
        window.prerenderReady = true;
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      // Only recalculate height if the phone rotates (width changes). 
      // This completely ignores the vertical height shrinkage from the keyboard!
      if (window.innerWidth !== windowWidth.current) {
        setAppHeight(`${window.innerHeight}px`);
        windowWidth.current = window.innerWidth;
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isLoggedIn = !!token;
  const needsPitch = !isLoggedIn && activeTab === "profile" && !hasSeenPitch;

  useEffect(() => {
    document.title = `${APP_CONFIG.appNamePrefix}${APP_CONFIG.appNameSuffix}`;
  }, []);

  const isAdFreeZone = needsPitch || activeTab === "profile" || activeTab === "admin" || showPaywall || !!activeLegalPage || (!!activeVideo && !isSharedVideoView) || !!activeCommentVideo;
  
  useAdZapper(isAdFreeZone);

  useEffect(() => {
    const styleId = "nuclear-ad-blocker";
    let styleEl = document.getElementById(styleId);
    let adKillerInterval; 

    if (isAdFreeZone) {
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

      const nukeAds = () => {
        const ads = document.querySelectorAll('iframe[src*="adsterra"], div[id^="container-"], .adsterra-social-bar, [id*="effectivegatecpm"], .adsterra-wrapper');
        ads.forEach(ad => ad.remove());
        
        if (document.body.style.paddingTop) document.body.style.paddingTop = "";
        if (document.body.style.marginTop) document.body.style.marginTop = "";
      };

      nukeAds(); 
      adKillerInterval = setInterval(nukeAds, 400); 

    } else {
      if (styleEl) styleEl.remove();
      if (adKillerInterval) clearInterval(adKillerInterval);
    }

    return () => {
      if (adKillerInterval) clearInterval(adKillerInterval);
    };
  }, [isAdFreeZone]);

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
      // Replace direct URL with '/' so browser back button returns to the home feed instead of leaving the site
      window.history.replaceState({ page: 'home' }, document.title, "/");
      window.history.pushState(
        { videoPlayer: true, messageId: String(sharedVideoId) },
        document.title,
        `/v/${sharedVideoId}`
      );
      const fetchSharedVideo = async () => {
        try {
          const res = await fetch(`${APP_CONFIG.apiUrl}/api/video/details?message_id=${sharedVideoId}`);
          if (res.ok) {
            const videoData = await res.json();
            
            const playRes = await fetch(`${APP_CONFIG.apiUrl}/api/video?chat_id=${videoData.chat_id}&message_id=${videoData.message_id}`);
            if (playRes.ok) {
              const playData = await playRes.json();
              setActiveVideo({ ...videoData, video_url: playData.video_url });
            }
          }
        } catch (error) {
          console.error("Failed to load shared video:", error);
        } finally {
          // 🟢 Tell Prerender the video is loaded and ready for snapshotting
          if (window.prerenderReady === false) {
            window.prerenderReady = true;
          }
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
    handleTabSwitch("profile"); 
  };

  const onLogout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
    handleTabSwitch("home", true);
    if (window.google?.accounts?.id) window.google.accounts.id.disableAutoSelect();
    window.location.href = "/"; 
  }, [handleTabSwitch]);

  useEffect(() => {
    if (token && !user) {
      fetch(`${APP_CONFIG.apiUrl}/api/auth/me`, {
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
    if (params.get("admin") === "true") handleTabSwitch("admin", true);
    
    const legalParam = params.get("legal");
    if (legalParam) {
      setActiveLegalPage(legalParam);
    }

    if (window.location.pathname === "/login") {
      handleTabSwitch("profile", true); 
      setHasSeenPitch(true);   
      window.history.replaceState({ tab: "profile" }, document.title, "/"); 
    }
  }, [token, user, applyTheme, handleTabSwitch]);

  // 🟢 FIX: Only hide the footer when logged out if we are currently on the profile tab (showing AuthForm)
  const shouldShowFooter = isFooterVisible && !activeVideo && !showPaywall && activeTab !== "admin" && !activeCommentVideo && (activeTab !== "profile" || isLoggedIn);

  const handleOpenVideo = async (video) => {
    try {
      // Clear completely first
      setActiveVideo(null);
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // 🟢 THE FIX: The Cache-Buster Trick
      // We append ?fs=1 to the URL. This forces the browser to open a fresh, 
      // clean connection, ignoring any aborted downloads from the background feed!
      if (video.video_url) {
        console.log("⚡ Instant Fullscreen (Busting browser cache lock)");
        const separator = video.video_url.includes('?') ? '&' : '?';
        const freshUrl = `${video.video_url}${separator}fs=1`;
        
        setActiveVideo({ ...video, video_url: freshUrl });
        return;
      }

      // Fallback for shared links or components that don't pass the URL
      setActiveVideo({ ...video, video_url: null });
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`);
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      
      if (data.video_url) {
        const separator = data.video_url.includes('?') ? '&' : '?';
        const freshUrl = `${data.video_url}${separator}fs=1`;
        setActiveVideo({ ...video, video_url: freshUrl });
      }
    } catch (e) { 
      setActiveVideo(null);
      alert(`🚨 Playback Error: ${e.message}`); 
    }
  };

  if (needsPitch) {
    return <PitchView onComplete={() => setHasSeenPitch(true)} />;
  }

  return (
    <div style={{ 
      height: appHeight, // 🟢 NO MORE 100dvh! Frozen rigid height.
      width: '100vw', 
      backgroundColor: 'var(--bg-color)', 
      color: '#fff', 
      overflow: 'hidden',
      position: 'fixed',
      top: 0, 
      left: 0
    }}>
      <main 
        style={{ 
          position: 'relative',
          width: '100%',
          height: '100%',
          paddingBottom: shouldShowFooter ? "70px" : "0",
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
            onProfileClick={() => handleTabSwitch("profile")}
            setHideFooter={handleHomeHideFooter} // 🟢 UPDATED
            setActiveVideo={setActiveVideo}
            setShowPaywall={setShowPaywall} 
          />
        </div>

        <div style={{ 
          ...slideContainerStyle,
          transform: activeTab === "explore" ? "translateX(0)" : (activeTab === "home" ? "translateX(100%)" : "translateX(-100%)"),
          opacity: activeTab === "explore" ? 1 : 0,
          pointerEvents: activeTab === "explore" ? "auto" : "none"
        }}>
          <Explore 
            user={user} 
            onProfileClick={() => handleTabSwitch("profile")}
            setHideFooter={handleExploreHideFooter} // Make sure this matches whatever your callback is named in App.jsx!
            onVideoClick={handleOpenVideo}
            onCommentClick={setActiveCommentVideo}
            isAnyModalOpen={!!activeVideo || !!activeCommentVideo || showPaywall || !!activeLegalPage || activeTab !== "explore"} 
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
              setHideFooter={handleProfileHideFooter} 
              setShowPaywall={setShowPaywall} 
            />
          ) : (
            <AuthForm 
              onLoginSuccess={onLoginSuccess} 
              onClose={() => handleTabSwitch("home")} 
            />
          )}
        </div>
      </main>

      {activeTab === "admin" && (
        <AdminDashboard 
          user={user}
          onLogout={() => {
            window.history.replaceState({}, document.title, "/"); 
            handleTabSwitch("home", true); 
          }} 
        />
      )}

      {shouldShowFooter && (
        <nav style={navStyle}>
          <button 
            onClick={() => handleTabSwitch("home")} 
            style={{...btnStyle, color: activeTab === 'home' ? 'var(--primary-color)' : '#8e8e8e'}}
          >
            <HomeIcon size={24} strokeWidth={activeTab === 'home' ? 2.5 : 2} fill={activeTab === 'home' ? 'currentColor' : 'none'} />
            <span style={labelStyle}>Home</span>
          </button>

          <button 
            onClick={() => handleTabSwitch("explore")} 
            style={{...btnStyle, color: activeTab === 'explore' ? 'var(--primary-color)' : '#8e8e8e'}}
          >
            <Compass size={24} strokeWidth={activeTab === 'explore' ? 2.5 : 2} fill={activeTab === 'explore' ? 'currentColor' : 'none'} />
            <span style={labelStyle}>Explore</span>
          </button>

          <button 
            onClick={() => handleTabSwitch("profile")} 
            style={{...btnStyle, color: activeTab === 'profile' ? 'var(--primary-color)' : '#8e8e8e'}}
          >
            <User size={24} strokeWidth={activeTab === 'profile' ? 2.5 : 2} fill={activeTab === 'profile' ? 'currentColor' : 'none'} />
            <span style={labelStyle}>Profile</span>
          </button>

          {user?.role === 'admin' && (
            <button 
              onClick={() => handleTabSwitch("admin")} 
              style={{...btnStyle, color: activeTab === 'admin' ? 'var(--primary-color)' : '#8e8e8e'}}
            >
              <ShieldCheck size={24} strokeWidth={activeTab === 'admin' ? 2.5 : 2} fill={activeTab === 'admin' ? 'currentColor' : 'none'} />
              <span style={labelStyle}>Admin</span>
            </button>
          )}
        </nav>
      )}

      {showPaywall && (
        <PaywallModal user={user} onClose={handleClosePaywall} />
      )}

      {activeLegalPage && (
        <LegalPages 
          initialPage={activeLegalPage} 
          onBack={handleCloseLegal} 
        />
      )}

      {activeVideo && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999999, background: "#000" }}>
          <FullscreenPlayer 
            video={activeVideo}
            currentUser={user} 
            onClose={handleCloseVideo} 
            isDesktop={window.innerWidth > 1024} 
            onCommentClick={setActiveCommentVideo}
          />
        </div>
      )}

      {/* 🟢 THE FIX: Actually render the Comment Modal when activeCommentVideo is set */}
      {activeCommentVideo && (
        <CommentSectionModal 
          video={activeCommentVideo} 
          onClose={handleCloseComments} 
        />
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