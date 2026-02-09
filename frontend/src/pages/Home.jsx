import React, { useEffect, useState } from "react";
import { Play, Flame, Grid3X3, User as UserIcon } from "lucide-react";
import AppHeader from "../components/AppHeader";
import SuggestedSidebar from "../components/SuggestedSidebar";
import VideoCard from "../components/VideoCard";
import FullscreenPlayer from "../components/FullscreenPlayer";
import { useVideos } from "../hooks/useVideos";
import { expandApp } from "../utils/telegram";
import { openRewardedAd } from "../utils/rewardedAd";
import { adReturnWatcher } from "../utils/adReturnWatcher";

export default function Home() {
  const [viewMode, setViewMode] = useState("dashboard"); // 'dashboard' or 'category'
  const [activeTab, setActiveTab] = useState(0); 
  const [activeVideo, setActiveVideo] = useState(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [unlockedVideos, setUnlockedVideos] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobileSearchVisible, setIsMobileSearchVisible] = useState(false);
  
  // 🟢 1. Client-Side Cache
  const [videoCache, setVideoCache] = useState({});

  const CATEGORIES = ["knacks", "hotties", "baddies", "trends"];
  const currentCategory = CATEGORIES[activeTab];
  const isDesktop = windowWidth > 1024;

  const { videos, dashboardVideos, sidebarSuggestions, loading, loadMore, setVideos } = useVideos(currentCategory);

  useEffect(() => {
    expandApp();
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 🟢 2. Update Cache
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
      setActiveVideo({ ...video, video_url: null }); 
      const res = await fetch(`https://videos.naijahomemade.com/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`);
      const data = await res.json();
      if (data.video_url) {
        const updateLogic = (prev) => prev.map(v => (v.chat_id === video.chat_id && v.message_id === video.message_id) ? { ...v, views: Number(v.views || 0) + 1 } : v);
        setVideos(updateLogic);
        setVideoCache(prev => ({
          ...prev,
          [currentCategory]: updateLogic(prev[currentCategory] || [])
        }));
        setActiveVideo(prev => ({ ...prev, video_url: data.video_url }));
      }
    } catch (e) { alert("Error fetching video link"); }
  };

  const TABS = [
    { icon: <Play size={18} />, label: "KNACKS"},
    { icon: <Grid3X3 size={18} />, label: "HOTTIES"},
    { icon: <UserIcon size={18} />, label: "BADDIES"},
    { icon: <Flame size={18} />, label: "TRENDS"}
  ];

  const getGridStyle = () => {
    if (isDesktop) {
      return { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" };
    }
    return { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" };
  };

  const videosToDisplay = (videoCache[currentCategory] && videoCache[currentCategory].length > 0) 
    ? videoCache[currentCategory] 
    : videos;

  return (
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

      {/* RIGHT SIDE (Mobile & Desktop) */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        
        {/* 🟢 1. APP HEADER - Not Sticky anymore */}
        <div style={{ background: "#000" }}>
           <AppHeader isDesktop={isDesktop} searchTerm={searchTerm} setSearchTerm={setSearchTerm} isMobileSearchVisible={isMobileSearchVisible} setIsMobileSearchVisible={setIsMobileSearchVisible} />
        </div>

        {/* 🟢 2. MOBILE TOP TABS - Sticky at Top: 0 */}
        {!isDesktop && (
          <nav style={{ 
            display: "flex", justifyContent: "space-evenly", 
            position: "sticky", top: 0, // 🟢 Sticks to the very top now
            zIndex: 1000,
            background: "rgba(0,0,0,0.95)", backdropFilter: "blur(15px)", WebkitBackdropFilter: "blur(15px)", borderBottom: "1px solid #262626"
          }}>
            {TABS.map((tab, index) => (
              <button 
                key={index} 
                onClick={() => { 
                  // 🟢 Auto-switch to category view on click
                  setViewMode("category"); 
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
            
            {/* CONDITIONAL RENDER */}
            {(isDesktop || viewMode === "category") ? (
              // FULL GRID VIEW
              <>
                 {/* 🟢 Removed "Back to Overview" Button as requested */}
                 
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
              </>
            ) : (
              // DASHBOARD SUMMARY VIEW
              <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
                {CATEGORIES.map(cat => (
                  <section key={cat}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
                      <h3 style={{ color: "#fff", textTransform: "uppercase", fontSize: "14px", fontWeight: "900", margin: 0 }}>{cat}</h3>
                      <button 
                        onClick={() => { 
                          setViewMode("category"); 
                          setActiveTab(CATEGORIES.indexOf(cat)); 
                          scrollToTop(); 
                        }} 
                        style={{ color: "#ff0000", fontSize: "12px", fontWeight: "800", background: "none", border: "none" }}
                      >
                        See All
                      </button>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
                      {dashboardVideos[cat]?.map(v => (
                        <VideoCard key={`dash-${v.message_id}`} video={v} layoutType={cat} onOpen={() => handleOpenVideo(v)} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
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
  );
}