import React, { useEffect, useState } from "react";
import { Play, Flame, Grid3X3, User as UserIcon } from "lucide-react";
import AppHeader from "../components/AppHeader";
import SuggestedSidebar from "../components/SuggestedSidebar";
import VideoCard from "../components/VideoCard";
import FullscreenPlayer from "../components/FullscreenPlayer";
import PullToRefresh from "../components/PullToRefresh"; 
import { useVideos } from "../hooks/useVideos";
import { expandApp } from "../utils/telegram";
import { openRewardedAd } from "../utils/rewardedAd";
import { adReturnWatcher } from "../utils/adReturnWatcher";

export default function Home() {
  // 🟢 1. Removed "viewMode" (Dashboard caused loops, so we stick to Grid)
  const [activeTab, setActiveTab] = useState(0); 
  const [activeVideo, setActiveVideo] = useState(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [unlockedVideos, setUnlockedVideos] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobileSearchVisible, setIsMobileSearchVisible] = useState(false);
  
  const [videoCache, setVideoCache] = useState({});

  const CATEGORIES = ["knacks", "hotties", "baddies", "trends"];
  const currentCategory = CATEGORIES[activeTab];
  const isDesktop = windowWidth > 1024;

  // 🟢 2. Clean Hook Call (No dashboardVideos)
  const { videos, sidebarSuggestions, loading, loadMore, setVideos } = useVideos(currentCategory);

  useEffect(() => {
    expandApp();
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (videos && videos.length > 0) {
      setVideoCache(prev => ({
        ...prev,
        [currentCategory]: videos
      }));
    }
  }, [videos, currentCategory]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleRefresh = async () => {
    // 🟢 Hard Refresh to clear any stale states
    window.location.reload(); 
  };

  const handleOpenVideo = async (video) => {
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
  };

  const playVideo = async (video) => {
    try {
      // 1. Show the loader
      setActiveVideo({ ...video, video_url: null }); 

      // 2. Fetch the link
      const res = await fetch(`https://videos.naijahomemade.com/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`);
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error ${res.status}`);
      }

      const data = await res.json();

      if (data.video_url) {
        // 3. Just set the URL and play
        setActiveVideo(prev => ({ ...prev, video_url: data.video_url }));
        
        // 🟢 Note: We removed the setVideos/setVideoCache logic here.
        // The view count will update globally next time the tab is refreshed.
      }
    } catch (e) { 
      console.error("Playback fetch error:", e);
      alert(`🚨 Playback Error: ${e.message}`);
      setActiveVideo(null); 
    }
  };

  
  const TABS = [
    { icon: <Play size={18} />, label: "KNACKS"},
    { icon: <Grid3X3 size={18} />, label: "HOTTIES"},
    { icon: <UserIcon size={18} />, label: "BADDIES"},
    { icon: <Flame size={18} />, label: "TRENDS"}
  ];

  const getGridStyle = () => {
    if (isDesktop) {
      return { 
        display: "grid", 
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", 
        gap: "10px",
        alignItems: "start" 
      };
    }
    return { 
      display: "grid", 
      gridTemplateColumns: "repeat(2, 1fr)", 
      gap: "10px",
      alignItems: "start"
    };
  };

  const videosToDisplay = (videoCache[currentCategory] && videoCache[currentCategory].length > 0) 
    ? videoCache[currentCategory] 
    : videos;

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <div style={{ background: "#000", minHeight: "100vh", display: isDesktop ? "flex" : "block" }}>
        
        {/* DESKTOP SIDEBAR */}
        {isDesktop && (
          <nav style={{ width: "240px", height: "100vh", position: "sticky", top: 0, borderRight: "1px solid #262626", padding: "40px 10px", display: "flex", flexDirection: "column", gap: "10px", flexShrink: 0, zIndex: 100 }}>
            {TABS.map((tab, index) => (
              <button key={index} onClick={() => { if (activeTab === index) scrollToTop(); else setActiveTab(index); }} style={{ display: "flex", alignItems: "center", gap: "15px", padding: "12px 20px", background: activeTab === index ? "#1c1c1e" : "none", border: "none", color: "#fff", borderRadius: "10px", cursor: "pointer", textAlign: "left" }}>
                {tab.icon} <span style={{ fontWeight: "bold" }}>{tab.label}</span>
              </button>
            ))}
          </nav>
        )}

        {/* MAIN CONTENT AREA */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          
          {/* APP HEADER */}
          <div style={{ background: "#000" }}>
             <AppHeader isDesktop={isDesktop} searchTerm={searchTerm} setSearchTerm={setSearchTerm} isMobileSearchVisible={isMobileSearchVisible} setIsMobileSearchVisible={setIsMobileSearchVisible} />
          </div>

          {/* MOBILE TABS */}
          {!isDesktop && (
            <nav style={{ 
              display: "flex", justifyContent: "space-evenly", 
              position: "sticky", top: 0, 
              zIndex: 1000,
              background: "rgba(0,0,0,0.95)", backdropFilter: "blur(15px)", WebkitBackdropFilter: "blur(15px)", borderBottom: "1px solid #262626"
            }}>
              {TABS.map((tab, index) => (
                <button 
                  key={index} 
                  // 🟢 3. Simplified Click Handler
                  onClick={() => { 
                    if (activeTab === index) scrollToTop(); 
                    else setActiveTab(index); 
                  }} 
                  style={{ flex: 1, padding: "14px 0", background: "none", border: "none", color: activeTab === index ? "#fff" : "#8e8e8e", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}
                >
                  {tab.icon}
                  <span style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.5px" }}>{tab.label}</span>
                </button>
              ))}
              <div style={{ position: "absolute", bottom: 0, left: 0, width: "25%", height: "3px", background: "#ff0000", transform: `translateX(${activeTab * 100}%)`, transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)" }} />
            </nav>
          )}
          
          <div style={{ display: "flex", flex: 1 }}>
            <div style={{ flex: 1, padding: isDesktop ? "40px" : "15px", paddingBottom: "100px" }}>
              
              {/* 🟢 4. Simplified Render: Always Show Grid */}
               <div style={getGridStyle()}>
                  {videosToDisplay.map(v => (
                    <VideoCard key={`${v.chat_id}:${v.message_id}`} video={v} layoutType={currentCategory} onOpen={() => handleOpenVideo(v)} />
                  ))}
               </div>

               {loading && videosToDisplay.length === 0 && (
                 <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>Loading videos...</div>
               )}

               {!loading && videosToDisplay.length > 0 && (
                <button onClick={loadMore} style={{ display: "block", margin: "40px auto", background: "#1c1c1e", color: "#fff", padding: "12px 30px", borderRadius: "30px", border: "none", fontWeight: "900", cursor: "pointer" }}>Show More</button>
               )}

            </div>

            {isDesktop && (
              <div style={{ flexShrink: 0 }}>
                <SuggestedSidebar suggestions={sidebarSuggestions} onVideoClick={handleOpenVideo} />
              </div>
            )}
          </div>
        </div>

        {activeVideo && <FullscreenPlayer video={activeVideo} onClose={() => setActiveVideo(null)} isDesktop={isDesktop} />}
      </div>
    </PullToRefresh>
  );
}