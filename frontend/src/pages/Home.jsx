import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { ArrowUp, ArrowLeft } from "lucide-react"; 
import AppHeader from "../components/AppHeader";
import SuggestedSidebar from "../components/SuggestedSidebar";
import VideoCard from "../components/VideoCard";
import PullToRefresh from "../components/PullToRefresh"; 
import { useVideos } from "../hooks/useVideos";
import { expandApp } from "../utils/telegram";
import { openRewardedAd } from "../utils/rewardedAd";
import { adReturnWatcher } from "../utils/adReturnWatcher";
import LegalFooter from "../components/LegalFooter";

// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../config"; 

const MAX_CACHE_SIZE = 4;
const AD_FREQUENCY = 3;

export default function Home({ user, onProfileClick, setHideFooter, setActiveVideo, setShowPaywall }) {
  const [activeTab, setActiveTab] = useState(() => Math.floor(Math.random() * APP_CONFIG.categories.length)); 
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [unlockedVideos, setUnlockedVideos] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [videoCache, setVideoCache] = useState({});
  const [cacheOrder, setCacheOrder] = useState([]); 
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [isChangingTab, setIsChangingTab] = useState(false);
  const [isSidebarHovered, setIsSidebarHovered] = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);

  const [isUIHidden, setIsUIHidden] = useState(false);
  const [premiumPool, setPremiumPool] = useState([]);
  
  const premiumInjectionMap = useRef(new Map());
  const premiumTracker = useRef(0);
  const scrollContainerRef = useRef(null);
  const scrollPositionRef = useRef(0); 
  const lastScrollY = useRef(0); 

  const currentCategory = APP_CONFIG.categories[activeTab];
  const isDesktop = windowWidth > 1024;
  
  const shouldHideUI = isUIHidden && !isDesktop;
  
  const fetchLimit = isDesktop ? 15 : 12;
  
  const { videos, sidebarSuggestions, loading, loadMore } = useVideos(currentCategory, fetchLimit);

  useEffect(() => {
    fetch(`${APP_CONFIG.apiUrl}/api/videos?category=premium&limit=20`)
      .then(res => res.json())
      .then(data => {
        if (data.videos) {
          const shuffled = data.videos.sort(() => 0.5 - Math.random());
          setPremiumPool(shuffled);
        }
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

  const rawVideosToDisplay = useMemo(() => {
    if (isChangingTab) return []; 
    
    let baseList = [];
    
    if (videoCache[currentCategory] && videoCache[currentCategory].length > 0) {
      baseList = videoCache[currentCategory];
    } 
    else if (!loading && videos.length > 0) {
       const isCorrectCategory = currentCategory === APP_CONFIG.categories[3] || videos[0].category === currentCategory;
       if (isCorrectCategory) {
          baseList = videos;
       }
    }

    if (baseList.length > 0 && premiumPool.length > 0) {
      const newList = [...baseList];
      const totalChunks = Math.ceil(newList.length / fetchLimit);

      for (let i = 0; i < totalChunks; i++) {
        const chunkKey = `${currentCategory}-page-${i}`;
        
        if (!premiumInjectionMap.current.has(chunkKey)) {
           const minOffset = isDesktop ? 2 : 1; 
           const randomOffset = Math.floor(Math.random() * (fetchLimit - minOffset)) + minOffset;
           
           const assignedPremiumIndex = premiumTracker.current % premiumPool.length;
           premiumTracker.current += 1;

           premiumInjectionMap.current.set(chunkKey, { offset: randomOffset, videoIndex: assignedPremiumIndex });
        }
        
        const injectionData = premiumInjectionMap.current.get(chunkKey);
        const absoluteIndex = (i * fetchLimit) + injectionData.offset;

        if (absoluteIndex < newList.length) {
           const premiumVideo = premiumPool[injectionData.videoIndex];
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

  useEffect(() => {
    if (!loading && videos?.length > 0) {
      const isCorrectCategory = currentCategory === APP_CONFIG.categories[3] || videos[0].category === currentCategory;
      if (isCorrectCategory) {
        updateCache(currentCategory, videos);
      }
    }
  }, [videos, currentCategory, loading, updateCache]);

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
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`);
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
      if (scrollContainerRef.current) {
        scrollPositionRef.current = scrollContainerRef.current.scrollTop;
      }

      try {
        const res = await fetch(`${APP_CONFIG.apiUrl}/api/group?media_group_id=${video.media_group_id}`);
        const groupVideos = await res.json();
        
        setActiveGroup({
          title: video.caption || "Collection",
          videos: groupVideos
        });
        
        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }

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
    if (!activeGroup && scrollContainerRef.current) {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollPositionRef.current;
        }
      });
    }
  }, [activeGroup]);

  useEffect(() => {
    if (loading || videos.length === 0) return;
    const prefetch = async () => {
      const neighbors = [(activeTab + 1) % APP_CONFIG.categories.length, (activeTab - 1 + APP_CONFIG.categories.length) % APP_CONFIG.categories.length];
      for (const idx of neighbors) {
        const cat = APP_CONFIG.categories[idx];
        if (!videoCache[cat]) {
          try {
            const res = await fetch(`${APP_CONFIG.apiUrl}/api/videos?category=${cat}&limit=${fetchLimit}`);
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
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentY = container.scrollTop;
      setShowScrollTop(currentY > 400);

      if (currentY < 50) {
        setIsUIHidden(false);
      } else if (currentY > lastScrollY.current + 15) {
        setIsUIHidden(true);
      } else if (currentY < lastScrollY.current - 15) {
        setIsUIHidden(false);
      }

      lastScrollY.current = currentY;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    setHideFooter(shouldHideUI);
    return () => setHideFooter(false);
  }, [shouldHideUI, setHideFooter]);

  useEffect(() => {
    expandApp();
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const handleVideoDeleted = (event) => {
      const deletedId = event.detail;

      setVideoCache(prevCache => {
        const newCache = { ...prevCache };
        Object.keys(newCache).forEach(category => {
          newCache[category] = newCache[category].filter(v => 
            (v.id || v.message_id) !== deletedId
          );
        });
        return newCache;
      });

      setActiveGroup(prevGroup => {
        if (!prevGroup) return null;
        return {
          ...prevGroup,
          videos: prevGroup.videos.filter(v => 
            (v.id || v.message_id) !== deletedId
          )
        };
      });
      
      setPremiumPool(prevPool => 
        prevPool.filter(v => (v.id || v.message_id) !== deletedId)
      );
    };

    window.addEventListener('videoDeleted', handleVideoDeleted);
    return () => window.removeEventListener('videoDeleted', handleVideoDeleted);
  }, []);

  const scrollToTop = () => {
    if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  
  const handleRefresh = async () => {
    premiumInjectionMap.current.clear(); 
    premiumTracker.current = 0;
    setActiveGroup(null); 
    window.location.reload();
  };

  const actualVideosToDisplay = activeGroup ? activeGroup.videos : rawVideosToDisplay;

  return (
    <div style={{ background: "var(--bg-color)", minHeight: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      
      {/* 🟢 THE FIX: Group Header + Tabs into a single absolute overlay for Mobile */}
      <div style={{
        position: isDesktop ? "relative" : "absolute",
        top: 0, left: 0, right: 0,
        zIndex: 1000,
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease",
        transform: shouldHideUI ? "translateY(-100%)" : "translateY(0)",
        opacity: shouldHideUI ? 0 : 1,
        pointerEvents: shouldHideUI ? "none" : "auto", 
        display: "flex",
        flexDirection: "column",
        background: "var(--bg-color)" // Prevent transparency bleed during scroll
      }}>
        <AppHeader 
          isDesktop={isDesktop} 
          searchTerm={searchTerm} 
          setSearchTerm={setSearchTerm} 
          user={user} 
          onProfileClick={onProfileClick} 
          suggestions={sidebarSuggestions} 
          onVideoClick={(v, e) => handleOpenVideo(v, e)} 
        />

        {!isDesktop && (
          <nav style={{ ...mobileNavStyle, position: "relative" }}>
            {APP_CONFIG.tabs.map((tab, index) => (
              <button 
                key={index} 
                onClick={() => handleTabClick(index)} 
                style={{ flex: 1, padding: "14px 0", background: "none", border: "none", color: activeTab === index ? "#fff" : "#8e8e8e", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", position: "relative" }}
              >
                {tab.icon}
                <span style={{ fontSize: "10px", fontWeight: "700" }}>{tab.label}</span>
              </button>
            ))}
            <div style={{ ...indicatorStyle, transform: `translateX(${activeTab * 100}%)`, width: `${100 / APP_CONFIG.tabs.length}%` }} />
          </nav>
        )}
      </div>
      
      <div style={{ display: "flex", flex: 1, position: "relative" }}>
        
        {isDesktop && (
          <div style={{ width: "80px", flexShrink: 0, position: "sticky", top: "70px", height: "calc(100vh - 70px)", zIndex: 110 }}>
            <nav 
              onMouseEnter={() => setIsSidebarHovered(true)}
              onMouseLeave={() => setIsSidebarHovered(false)}
              style={{ ...sidebarStyle, width: isSidebarHovered ? "240px" : "80px", boxShadow: isSidebarHovered ? "10px 0 30px rgba(0,0,0,0.5)" : "none", borderRight: isSidebarHovered ? "1px solid #333" : "1px solid var(--border-color)" }}
            >
              {APP_CONFIG.tabs.map((tab, index) => (
                <button 
                  key={index} 
                  onClick={() => handleTabClick(index)} 
                  style={{ ...desktopTabButtonStyle, background: activeTab === index ? "rgba(255,255,255,0.12)" : "transparent", color: activeTab === index ? "var(--primary-color)" : "#fff", justifyContent: isSidebarHovered ? "flex-start" : "center", paddingLeft: isSidebarHovered ? "24px" : "0" }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                     {tab.icon} 
                     {isSidebarHovered && <span style={sidebarLabelStyle}>{tab.label}</span>}
                  </div>
                </button>
              ))}
            </nav>
          </div>
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <PullToRefresh onRefresh={handleRefresh}>
            <div 
            ref={scrollContainerRef}
            style={{ 
              touchAction: "pan-y", 
              overscrollBehaviorY: "contain",
              overflowAnchor: "none",
              height: isDesktop ? "calc(100vh - 70px)" : "100vh", // Desktop has relative header, mobile is 100vh overlay
              overflowY: "auto", 
              paddingBottom: shouldHideUI ? "0px" : "70px", 
              transition: "padding-bottom 0.3s ease"
            }}>
              {/* 🟢 THE FIX: Push feed down via precise padding so it perfectly clears the floating UI */}
              <div style={{ 
                 paddingTop: isDesktop ? "30px" : "115px", 
                 paddingLeft: isDesktop ? "25px" : "15px",
                 paddingRight: isDesktop ? "25px" : "15px",
                 paddingBottom: "30px"
              }}>
                 
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
                   alignItems: "start", 
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

                 {actualVideosToDisplay.length > 0 && !activeGroup && (
                   <ExoClickWidget />
                 )}
                 
                 {(!loading && !isChangingTab && !activeGroup) && actualVideosToDisplay.length > 0 && (
                   <button onClick={loadMore} style={showMoreButtonStyle}>Show More</button>
                 )}
              </div>
              
              {actualVideosToDisplay.length > 0 && (
                <div style={seoFooterStyle}>
                  Naijahomemade provides you with unlimited free Naija homemade videos with the hottest models. Enjoy the largest community on the net as well as full-length scenes from the top Naija homemade videos. We update our Naijahomemade videos daily to ensure you always get the best quality Naija Homemade movies.
                </div>
              )}
              
              {actualVideosToDisplay.length > 0 && <LegalFooter />}
            </div>
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
const mobileNavStyle = { display: "flex", zIndex: 1000, background: "var(--bg-color)", borderBottom: "1px solid var(--border-color)" };
const indicatorStyle = { position: "absolute", bottom: 0, left: 0, height: "3px", background: "var(--primary-color)", transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)" };
const sidebarStyle = { height: "100%", position: "absolute", top: 0, left: 0, display: "flex", flexDirection: "column", gap: "8px", transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)", padding: "20px 0" };
const desktopTabButtonStyle = { display: "flex", alignItems: "center", border: "none", borderRadius: "12px", cursor: "pointer", width: "calc(100% - 16px)", margin: "0 8px", height: "50px", transition: "all 0.15s ease", outline: "none" };
const sidebarLabelStyle = { fontSize: "15px", fontWeight: "800", whiteSpace: "nowrap", fontFamily: "'Inter', sans-serif", letterSpacing: "0.4px", animation: "fadeIn 0.2s ease-in" };

const suggestedSidebarRail = { width: "320px", height: "calc(100vh - 70px)", position: "sticky", top: "70px", borderLeft: "1px solid var(--border-color)", padding: "30px 15px", background: "transparent", overflowY: "auto", flexShrink: 0 };

const showMoreButtonStyle = { display: "block", margin: "40px auto", background: "#1c1c1e", color: "#fff", padding: "14px 40px", borderRadius: "35px", border: "1px solid #333", fontWeight: "900", cursor: "pointer" };
const scrollTopButtonStyle = { position: "fixed", bottom: "30px", right: "10px", width: "50px", height: "50px", borderRadius: "50%", background: "var(--primary-color)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, cursor: "pointer" };

const groupHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 0 15px 0", marginBottom: "15px", borderBottom: "1px solid rgba(255,255,255,0.1)" };
const backButtonStyle = { display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#fff", fontSize: "15px", fontWeight: "600", cursor: "pointer", padding: "0" };
const groupTitleStyle = { fontSize: "13px", color: "#8e8e8e", fontWeight: "500" };

const seoFooterStyle = { padding: "20px 25px", fontSize: "12px", color: "#666", textAlign: "center", lineHeight: "1.6", maxWidth: "800px", margin: "20px auto 0", borderTop: "1px solid rgba(255,255,255,0.05)" };

const ExoClickWidget = () => {
  useEffect(() => {
    if (!document.querySelector('script[src="https://a.magsrv.com/ad-provider.js"]')) {
      const script = document.createElement('script');
      script.src = "https://a.magsrv.com/ad-provider.js";
      script.async = true;
      script.type = "application/javascript";
      document.body.appendChild(script);
    }
    window.AdProvider = window.AdProvider || [];
    window.AdProvider.push({"serve": {}});
  }, []);

  return (
    <div style={{ width: "100%", marginTop: "20px", marginBottom: "20px" }}>
      <ins className="eas6a97888e20" data-zoneid={APP_CONFIG.exoClickZoneId} style={{ display: "block", width: "100%" }}></ins>
    </div>
  );
};