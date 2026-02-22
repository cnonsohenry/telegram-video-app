import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Play, Flame, Grid3X3, User as UserIcon, ArrowUp, Zap } from "lucide-react";
import AppHeader from "../components/AppHeader";
import SuggestedSidebar from "../components/SuggestedSidebar";
import VideoCard from "../components/VideoCard";
import PullToRefresh from "../components/PullToRefresh"; 
import { useVideos } from "../hooks/useVideos";
import { expandApp } from "../utils/telegram";
import { openRewardedAd } from "../utils/rewardedAd";
import { adReturnWatcher } from "../utils/adReturnWatcher";

const CATEGORIES = ["knacks", "hotties", "baddies", "trends"];
const MAX_CACHE_SIZE = 4;

export default function Home({ user, onProfileClick, setHideFooter, setActiveVideo }) {
  const [activeTab, setActiveTab] = useState(() => Math.floor(Math.random() * CATEGORIES.length)); 
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [unlockedVideos, setUnlockedVideos] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [videoCache, setVideoCache] = useState({});
  const [cacheOrder, setCacheOrder] = useState([]); 
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isChangingTab, setIsChangingTab] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);

  const currentCategory = CATEGORIES[activeTab];
  const isDesktop = windowWidth > 1024;
  const { videos, sidebarSuggestions, loading, loadMore } = useVideos(currentCategory);

  const updateCache = useCallback((category, data) => {
    setCacheOrder(prevOrder => {
      const filtered = prevOrder.filter(c => c !== category);
      const newOrder = [category, ...filtered].slice(0, MAX_CACHE_SIZE);
      setVideoCache(prevCache => {
        const newCache = { ...prevCache, [category]: data };
        const currentKeys = Object.keys(newCache);
        if (currentKeys.length > MAX_CACHE_SIZE) {
          const evicted = currentKeys.find(key => !newOrder.includes(key));
          if (evicted) delete newCache[evicted];
        }
        return newCache;
      });
      return newOrder;
    });
  }, []);

  const videosToDisplay = useMemo(() => {
    if (isChangingTab) return []; 
    if (videoCache[currentCategory]) return videoCache[currentCategory];
    if (loading) return [];
    return videos;
  }, [videoCache, currentCategory, loading, videos, isChangingTab]);

  useEffect(() => {
    if (!loading) setIsChangingTab(false);
  }, [loading]);

  const handleTabClick = (index) => {
    if (activeTab === index) {
      scrollToTop();
    } else {
      window.scrollTo(0, 0);
      setIsChangingTab(true); 
      setActiveTab(index);
    }
  };

  const playVideo = async (video) => {
    try {
      setActiveVideo({ ...video, video_url: null }); 
      const res = await fetch(`https://videos.naijahomemade.com/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`);
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      if (data.video_url) {
        setActiveVideo(prev => ({ ...prev, video_url: data.video_url }));
      }
    } catch (e) { 
      setActiveVideo(null);
      alert(`🚨 Playback Error: ${e.message}`); 
    }
  };

  const handleOpenVideo = useCallback(async (video, e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!video) return;
    const videoKey = `${video.chat_id}:${video.message_id}`;
    if (unlockedVideos.has(videoKey)) { playVideo(video); return; }
    try {
      openRewardedAd();
      const nextSet = new Set(unlockedVideos);
      nextSet.add(videoKey);
      setUnlockedVideos(nextSet);
      localStorage.setItem("unlockedVideos", JSON.stringify([...nextSet]));
      await adReturnWatcher();
      playVideo(video);
    } catch (err) { playVideo(video); }
  }, [unlockedVideos]);

  useEffect(() => {
    if (!loading && videos?.length > 0) {
      updateCache(currentCategory, videos);
    }
  }, [videos, currentCategory, loading, updateCache]);

  useEffect(() => {
    if (loading || videos.length === 0) return;
    const prefetch = async () => {
      const neighbors = [(activeTab + 1) % CATEGORIES.length, (activeTab - 1 + CATEGORIES.length) % CATEGORIES.length];
      for (const idx of neighbors) {
        const cat = CATEGORIES[idx];
        if (!videoCache[cat]) {
          try {
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/videos?category=${cat}&limit=12`);
            if (res.ok) {
              const data = await res.json();
              updateCache(cat, data.videos);
            }
          } catch (e) {}
        }
      }
    };
    const timer = setTimeout(prefetch, 3000);
    return () => clearTimeout(timer);
  }, [activeTab, loading, videos, videoCache, updateCache]);

  useEffect(() => {
    const handleScroll = () => setShowScrollTop(window.scrollY > 400);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    expandApp();
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const handleRefresh = async () => window.location.reload();

  const TABS = [
    { icon: <Play size={22} />, label: "KNACKS"},
    { icon: <Grid3X3 size={22} />, label: "HOTTIES"},
    { icon: <UserIcon size={22} />, label: "BADDIES"},
    { icon: <Flame size={22} />, label: "TRENDS"}
  ];

  return (
    <div style={{ background: "var(--bg-color)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader isDesktop={isDesktop} searchTerm={searchTerm} user={user} onProfileClick={onProfileClick} />
      
      <div style={{ display: "flex", flex: 1, position: "relative" }}>
        
        {/* 🟢 LEFT SIDEBAR (Fixed Width Base + Floating Expansion) */}
        {isDesktop && (
          <div style={{ width: "80px", flexShrink: 0 }}> {/* Static Placeholder to prevent Grid shifting */}
            <nav 
              onMouseEnter={() => setIsSidebarHovered(true)}
              onMouseLeave={() => setIsSidebarHovered(false)}
              style={{ 
                ...sidebarStyle, 
                width: isSidebarHovered ? "240px" : "80px",
                boxShadow: isSidebarHovered ? "10px 0 30px rgba(0,0,0,0.5)" : "none",
                borderRight: isSidebarHovered ? "1px solid #333" : "1px solid var(--border-color)"
              }}
            >
              {TABS.map((tab, index) => (
                <button 
                  key={index} 
                  onClick={() => handleTabClick(index)} 
                  style={{ 
                    ...desktopTabButtonStyle, 
                    /* 🟢 FIX: Highlighting only depends on activeTab, not mouse position */
                    background: activeTab === index ? "rgba(255,255,255,0.12)" : "transparent",
                    color: activeTab === index ? "var(--primary-color)" : "#fff",
                    justifyContent: isSidebarHovered ? "flex-start" : "center",
                    paddingLeft: isSidebarHovered ? "24px" : "0"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                     {tab.icon} 
                     {isSidebarHovered && (
                       <span style={sidebarLabelStyle}>
                         {tab.label}
                       </span>
                     )}
                  </div>
                </button>
              ))}
            </nav>
          </div>
        )}

        {/* 🟢 CENTER FEED (Stable Width) */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {!isDesktop && (
            <nav style={mobileNavStyle}>
              {TABS.map((tab, index) => (
                <button 
                  key={index} 
                  onClick={() => handleTabClick(index)} 
                  style={{ flex: 1, padding: "14px 0", background: "none", border: "none", color: activeTab === index ? "#fff" : "#8e8e8e", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", position: "relative" }}
                >
                  {tab.icon}
                  <span style={{ fontSize: "10px", fontWeight: "700" }}>{tab.label}</span>
                </button>
              ))}
              <div style={{ ...indicatorStyle, transform: `translateX(${activeTab * 100}%)` }} />
            </nav>
          )}
          
          <PullToRefresh onRefresh={handleRefresh}>
            <div style={{ padding: isDesktop ? "30px 25px" : "15px" }}>
               <div style={{ 
                 display: "grid", 
                 gridTemplateColumns: isDesktop ? "repeat(5, 1fr)" : "repeat(2, 1fr)", 
                 gap: isDesktop ? "20px" : "10px", 
                 animation: "fadeIn 0.3s ease-out" 
               }}>
                  {videosToDisplay.map(v => (
                    <VideoCard 
                      key={`${v.chat_id}:${v.message_id}`} 
                      video={v} 
                      onOpen={(vData, e) => handleOpenVideo(vData, e)} 
                    />
                  ))}
                  {(loading || isChangingTab) && videosToDisplay.length === 0 && (
                    [...Array(8)].map((_, i) => <div key={i} style={skeletonSocket} />)
                  )}
               </div>
               {(!loading && !isChangingTab) && videosToDisplay.length > 0 && (
                 <button onClick={loadMore} style={showMoreButtonStyle}>Show More</button>
               )}
            </div>
          </PullToRefresh>
        </div>

        {/* 🟢 RIGHT SIDEBAR (Suggested Contents) */}
        {isDesktop && (
          <aside style={suggestedSidebarRail}>
            <div style={suggestedHeaderStyle}>
              <Zap size={18} color="var(--primary-color)" fill="var(--primary-color)" />
              <h3 style={suggestedTitleStyle}>Suggested Content</h3>
            </div>
            <SuggestedSidebar suggestions={sidebarSuggestions} onVideoClick={playVideo} />
          </aside>
        )}
      </div>

      {!isDesktop && (
        <button 
          onClick={scrollToTop} 
          style={{ ...scrollTopButtonStyle, opacity: showScrollTop ? 1 : 0, transform: showScrollTop ? "translateY(0)" : "translateY(20px)", pointerEvents: showScrollTop ? "auto" : "none" }}
        >
          <ArrowUp size={24} color="#fff" />
        </button>
      )}
      
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes pulse { 0% { opacity: 0.5; } 50% { opacity: 0.8; } 100% { opacity: 0.5; } }
      `}</style>
    </div>
  );
}

// 🖌 STYLES
const skeletonSocket = { width: "100%", aspectRatio: "9/16", background: "#1a1a1a", borderRadius: "12px", animation: "pulse 1.5s infinite" };
const mobileNavStyle = { display: "flex", position: "sticky", top: 0, zIndex: 1000, background: "var(--bg-color)", backdropFilter: "blur(15px)", borderBottom: "1px solid var(--border-color)" };
const indicatorStyle = { position: "absolute", bottom: 0, left: 0, width: "25%", height: "3px", background: "var(--primary-color)", transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)" };

const sidebarStyle = { 
  height: "calc(100vh - 70px)", 
  position: "fixed", // 🟢 Changed to fixed so it floats over content
  top: "70px", 
  left: 0,
  display: "flex", 
  flexDirection: "column", 
  gap: "8px", 
  zIndex: 110, 
  transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
  background: "var(--bg-color)",
  padding: "20px 0"
};

const desktopTabButtonStyle = { 
  display: "flex", 
  alignItems: "center", 
  border: "none", 
  borderRadius: "12px", 
  cursor: "pointer", 
  width: "calc(100% - 16px)",
  margin: "0 8px",
  height: "50px",
  transition: "all 0.15s ease",
  outline: "none"
};

const sidebarLabelStyle = { 
  fontSize: "15px", 
  fontWeight: "800", 
  whiteSpace: "nowrap",
  fontFamily: "'Inter', sans-serif",
  letterSpacing: "0.4px",
  animation: "fadeIn 0.2s ease-in"
};

const suggestedSidebarRail = { 
  width: "320px", 
  height: "calc(100vh - 70px)", 
  position: "sticky", 
  top: "70px", 
  borderLeft: "1px solid var(--border-color)", 
  padding: "25px 15px",
  background: "var(--bg-color)",
  overflowY: "auto",
  flexShrink: 0
};

const suggestedHeaderStyle = { display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px" };
const suggestedTitleStyle = { fontSize: "16px", fontWeight: "900", margin: 0 };
const showMoreButtonStyle = { display: "block", margin: "40px auto", background: "#1c1c1e", color: "#fff", padding: "14px 40px", borderRadius: "35px", border: "1px solid #333", fontWeight: "900", cursor: "pointer" };
const scrollTopButtonStyle = { position: "fixed", bottom: "30px", right: "10px", width: "50px", height: "50px", borderRadius: "50%", background: "var(--primary-color)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, cursor: "pointer" };