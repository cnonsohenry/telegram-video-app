import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Play, Flame, Grid3X3, User as UserIcon, ArrowUp, ArrowLeft } from "lucide-react"; 
import AppHeader from "../components/AppHeader";
import SuggestedSidebar from "../components/SuggestedSidebar";
import VideoCard from "../components/VideoCard";
import PullToRefresh from "../components/PullToRefresh"; 
import { useVideos } from "../hooks/useVideos";
import { expandApp } from "../utils/telegram";
import { openRewardedAd } from "../utils/rewardedAd";
import { adReturnWatcher } from "../utils/adReturnWatcher";
import LegalFooter from "../components/LegalFooter";

const CATEGORIES = ["knacks", "hotties", "baddies", "trends"];
const MAX_CACHE_SIZE = 4;
const AD_FREQUENCY = 3;

export default function Home({ user, onProfileClick, setHideFooter, setActiveVideo, setShowPaywall }) {
  const [activeTab, setActiveTab] = useState(() => Math.floor(Math.random() * CATEGORIES.length)); 
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [unlockedVideos, setUnlockedVideos] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [videoCache, setVideoCache] = useState({});
  const [cacheOrder, setCacheOrder] = useState([]); 
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isChangingTab, setIsChangingTab] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);

  const [premiumPool, setPremiumPool] = useState([]);
  
  // 🟢 THE FIX: A memory bank to store the random slots so they don't jump around on re-renders
  const premiumInjectionMap = useRef(new Map());

  const currentCategory = CATEGORIES[activeTab];
  const isDesktop = windowWidth > 1024;
  
  const fetchLimit = isDesktop ? 15 : 12;
  
  const { videos, sidebarSuggestions, loading, loadMore } = useVideos(currentCategory, fetchLimit);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/videos?category=premium&limit=20`)
      .then(res => res.json())
      .then(data => {
        if (data.videos) setPremiumPool(data.videos);
      })
      .catch(err => console.error("Failed to load premium pool", err));
  }, []);

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

  // 🟢 UPGRADED RANDOM INJECTION ENGINE: Handles Refreshing & Pagination!
  const rawVideosToDisplay = useMemo(() => {
    if (isChangingTab) return []; 
    const baseList = videoCache[currentCategory] || (loading ? [] : videos);
    
    if (baseList.length > 0 && premiumPool.length > 0) {
      const newList = [...baseList];
      
      // Calculate how many pages/chunks of videos we currently have loaded
      const totalChunks = Math.ceil(newList.length / fetchLimit);

      // Loop through every page and inject exactly one premium video per page
      for (let i = 0; i < totalChunks; i++) {
        // Create a unique key for this specific category and page number
        const chunkKey = `${currentCategory}-page-${i}`;

        // If we haven't picked a random spot for this page yet, pick one now!
        if (!premiumInjectionMap.current.has(chunkKey)) {
           // Ensure it doesn't replace the very first video on the page
           const minOffset = isDesktop ? 2 : 1; 
           const randomOffset = Math.floor(Math.random() * (fetchLimit - minOffset)) + minOffset;
           premiumInjectionMap.current.set(chunkKey, randomOffset);
        }

        const offset = premiumInjectionMap.current.get(chunkKey);
        const absoluteIndex = (i * fetchLimit) + offset;

        if (absoluteIndex < newList.length) {
           // Rotate through the premium pool so they see different premium videos as they scroll
           const premiumVideo = premiumPool[i % premiumPool.length];
           newList[absoluteIndex] = premiumVideo;
        }
      }
      
      return newList;
    }
    
    return baseList;
  }, [videoCache, currentCategory, loading, videos, isChangingTab, premiumPool, fetchLimit, isDesktop]);

  useEffect(() => {
    if (!loading) setIsChangingTab(false);
  }, [loading]);

  const handleTabClick = (index) => {
    setActiveGroup(null); 
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

    if (video.is_group && !activeGroup) {
      try {
        const res = await fetch(`https://videos.naijahomemade.com/api/group?media_group_id=${video.media_group_id}`);
        const groupVideos = await res.json();
        
        setActiveGroup({
          title: video.caption || "Collection",
          videos: groupVideos
        });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (err) {
        alert("🚨 Failed to load album contents.");
      }
      return;
    }

    if (video.category === "premium") {
      if (!user || !user.is_premium) {
        setShowPaywall(true);
        return;
      }
      playVideo(video);
      return;
    }

    const videoKey = `${video.chat_id}:${video.message_id}`;
    
    if (unlockedVideos.has(videoKey)) { 
      playVideo(video); 
      return; 
    }

    const videosWatchedCount = parseInt(localStorage.getItem("ad_frequency_counter") || "0", 10);
    const shouldShowAd = videosWatchedCount % AD_FREQUENCY === 0;

    localStorage.setItem("ad_frequency_counter", (videosWatchedCount + 1).toString());

    const nextSet = new Set(unlockedVideos);
    nextSet.add(videoKey);
    setUnlockedVideos(nextSet);
    localStorage.setItem("unlockedVideos", JSON.stringify([...nextSet]));

    if (shouldShowAd) {
      try {
        openRewardedAd();
        await adReturnWatcher();
        playVideo(video);
      } catch (err) { 
        playVideo(video); 
      }
    } else {
      playVideo(video);
    }
  }, [user, unlockedVideos, activeGroup]); 

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
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/videos?category=${cat}&limit=${fetchLimit}`);
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
  }, [activeTab, loading, videos, videoCache, updateCache, fetchLimit]);

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
  const handleRefresh = async () => {
    premiumInjectionMap.current.clear(); // Clear memory on refresh to get new spots!
    setActiveGroup(null); 
    window.location.reload();
  };

  const TABS = [
    { icon: <Play size={22} />, label: "KNACKS"},
    { icon: <Grid3X3 size={22} />, label: "HOTTIES"},
    { icon: <UserIcon size={22} />, label: "BADDIES"},
    { icon: <Flame size={22} />, label: "TRENDS"}
  ];

  const actualVideosToDisplay = activeGroup ? activeGroup.videos : rawVideosToDisplay;

  return (
    <div style={{ background: "var(--bg-color)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <AppHeader 
        isDesktop={isDesktop} 
        searchTerm={searchTerm} 
        setSearchTerm={setSearchTerm} 
        user={user} 
        onProfileClick={onProfileClick} 
        suggestions={sidebarSuggestions} 
        onVideoClick={(v, e) => handleOpenVideo(v, e)} 
      />
      
      <div style={{ display: "flex", flex: 1, position: "relative" }}>
        
        {isDesktop && (
          <div style={{ 
            width: "80px", 
            flexShrink: 0, 
            position: "sticky", 
            top: "70px", 
            height: "calc(100vh - 70px)", 
            zIndex: 110 
          }}>
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
               
               {activeGroup && (
                 <div style={groupHeaderStyle}>
                   <button onClick={() => setActiveGroup(null)} style={backButtonStyle}>
                     <ArrowLeft size={20} />
                     <span>Back to {currentCategory.toUpperCase()}</span>
                   </button>
                   <span style={groupTitleStyle}>{activeGroup.videos.length} clips in collection</span>
                 </div>
               )}

               <div style={{ 
                 display: "grid", 
                 gridTemplateColumns: isDesktop ? "repeat(5, 1fr)" : "repeat(2, 1fr)", 
                 gap: isDesktop ? "20px" : "10px", 
                 animation: "fadeIn 0.3s ease-out" 
               }}>
                  {actualVideosToDisplay.map(v => (
                    <VideoCard 
                      key={`${v.chat_id}:${v.message_id}`} 
                      video={v} 
                      onOpen={(vData, e) => handleOpenVideo(vData, e)} 
                    />
                  ))}
                  
                  {(loading || isChangingTab) && !activeGroup && actualVideosToDisplay.length === 0 && (
                    [...Array(fetchLimit)].map((_, i) => <div key={i} style={skeletonSocket} />)
                  )}
               </div>
               
               {(!loading && !isChangingTab && !activeGroup) && actualVideosToDisplay.length > 0 && (
                 <button onClick={loadMore} style={showMoreButtonStyle}>Show More</button>
               )}
            </div>
            
            {actualVideosToDisplay.length > 0 && <LegalFooter />}
            
          </PullToRefresh>
        </div>

        {isDesktop && (
          <aside style={suggestedSidebarRail} className="custom-scrollbar">
            <SuggestedSidebar 
              suggestions={sidebarSuggestions}
              loading={loading} 
              onVideoClick={(v, e) => handleOpenVideo(v, e)} 
            />
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
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
}

// 🖌 STYLES
const skeletonSocket = { width: "100%", aspectRatio: "9/16", background: "#1a1a1a", borderRadius: "12px", animation: "pulse 1.5s infinite" };
const mobileNavStyle = { display: "flex", position: "sticky", top: 0, zIndex: 1000, background: "var(--bg-color)", borderBottom: "1px solid var(--border-color)" };
const indicatorStyle = { position: "absolute", bottom: 0, left: 0, width: "25%", height: "3px", background: "var(--primary-color)", transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)" };
const sidebarStyle = { height: "100%", position: "absolute", top: 0, left: 0, display: "flex", flexDirection: "column", gap: "8px", transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)", padding: "20px 0" };
const desktopTabButtonStyle = { display: "flex", alignItems: "center", border: "none", borderRadius: "12px", cursor: "pointer", width: "calc(100% - 16px)", margin: "0 8px", height: "50px", transition: "all 0.15s ease", outline: "none" };
const sidebarLabelStyle = { fontSize: "15px", fontWeight: "800", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif", letterSpacing: "0.4px", animation: "fadeIn 0.2s ease-in" };

const suggestedSidebarRail = { width: "320px", height: "calc(100vh - 70px)", position: "sticky", top: "70px", borderLeft: "1px solid var(--border-color)", padding: "30px 15px", background: "transparent", overflowY: "auto", flexShrink: 0 };

const showMoreButtonStyle = { display: "block", margin: "40px auto", background: "#1c1c1e", color: "#fff", padding: "14px 40px", borderRadius: "35px", border: "1px solid #333", fontWeight: "900", cursor: "pointer" };
const scrollTopButtonStyle = { position: "fixed", bottom: "30px", right: "10px", width: "50px", height: "50px", borderRadius: "50%", background: "var(--primary-color)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, cursor: "pointer" };

const groupHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0 15px 0", marginBottom: "15px", borderBottom: "1px solid rgba(255,255,255,0.1)" };
const backButtonStyle = { display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#fff", fontSize: "15px", fontWeight: "600", cursor: "pointer", padding: "0" };
const groupTitleStyle = { fontSize: "13px", color: "#8e8e8e", fontWeight: "500" };