import React, { useEffect, useState, useMemo } from "react";
import { Home as HomeIcon, Compass, User as UserIcon, Play, Flame, Grid3X3 } from "lucide-react";
import AppHeader from "../components/AppHeader";
import SuggestedSidebar from "../components/SuggestedSidebar";
import VideoCard from "../components/VideoCard";
import FullscreenPlayer from "../components/FullscreenPlayer";
import { useVideos } from "../hooks/useVideos";
import { expandApp } from "../utils/telegram";
import { openRewardedAd } from "../utils/rewardedAd";
import { adReturnWatcher } from "../utils/adReturnWatcher";

export default function Home() {
  const [activeBottomTab, setActiveBottomTab] = useState("explore"); 
  const [activeTab, setActiveTab] = useState(0); 
  const [activeVideo, setActiveVideo] = useState(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [unlockedVideos, setUnlockedVideos] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobileSearchVisible, setIsMobileSearchVisible] = useState(false);

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

  // 🟢 PLAYBACK HANDLER
  const handleOpenVideo = async (video) => {
    const videoKey = `${video.chat_id}:${video.message_id}`;
    if (unlockedVideos.has(videoKey)) { 
      playVideo(video); 
      return; 
    }
    try {
      openRewardedAd();
      const nextSet = new Set(unlockedVideos);
      nextSet.add(videoKey);
      setUnlockedVideos(nextSet);
      localStorage.setItem("unlockedVideos", JSON.stringify([...nextSet]));
      await adReturnWatcher();
      playVideo(video);
    } catch (err) { 
      // Fallback: play anyway if ad fails (better user experience)
      playVideo(video); 
    }
  };

  const playVideo = async (video) => {
    try {
      // Optimistic UI: Open immediately
      setActiveVideo({ ...video, video_url: "" }); // Set placeholder while fetching

      const res = await fetch(`https://videos.naijahomemade.com/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`);
      const data = await res.json();
      
      if (data.video_url) {
        // Update local view count
        setVideos(prev => prev.map(v => (v.chat_id === video.chat_id && v.message_id === video.message_id) ? { ...v, views: Number(v.views || 0) + 1 } : v));
        // Update active player with real URL
        setActiveVideo(prev => ({ ...prev, video_url: data.video_url }));
      }
    } catch (e) { 
      console.error("Video Fetch Error", e);
      alert("Error fetching video link");
    }
  };

  // 🟢 LAYOUT HELPERS
  const TABS = [
    { icon: <Play size={20} />, label: "KNACKS"},
    { icon: <Grid3X3 size={20} />, label: "HOTTIES"},
    { icon: <UserIcon size={20} />, label: "BADDIES"},
    { icon: <Flame size={20} />, label: "TRENDS"}
  ];

  return (
    <div style={{ background: "#000", minHeight: "100vh", display: isDesktop ? "flex" : "block", overflowX: "hidden" }}>
      
      {/* 1. DESKTOP SIDEBAR */}
      {isDesktop && (
        <nav style={{ width: "240px", height: "100vh", position: "sticky", top: 0, borderRight: "1px solid #262626", padding: "40px 10px", display: "flex", flexDirection: "column", gap: "10px", flexShrink: 0, zIndex: 50 }}>
          {TABS.map((tab, index) => (
            <button key={index} onClick={() => setActiveTab(index)} style={{ display: "flex", alignItems: "center", gap: "15px", padding: "12px 20px", background: activeTab === index ? "#1c1c1e" : "none", border: "none", color: "#fff", borderRadius: "10px", cursor: "pointer", textAlign: "left" }}>
              {tab.icon} <span style={{ fontWeight: "bold" }}>{tab.label}</span>
            </button>
          ))}
        </nav>
      )}

      {/* 2. MOBILE TOP TABS (Only on Explore) */}
      {!isDesktop && activeBottomTab === "explore" && (
        <nav style={{ display: "flex", position: "sticky", top: 0, zIndex: 1000, background: "#000", borderBottom: "1px solid #262626" }}>
          {TABS.map((tab, index) => (
            <button key={index} onClick={() => setActiveTab(index)} style={{ flex: 1, padding: "15px 0", background: "none", border: "none", color: activeTab === index ? "#fff" : "#8e8e8e" }}>
              {tab.icon}
            </button>
          ))}
          <div style={{ position: "absolute", bottom: 0, left: 0, width: "25%", height: "2px", background: "#fff", transform: `translateX(${activeTab * 100}%)`, transition: "0.3s" }} />
        </nav>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        {/* Header */}
        <AppHeader 
          isDesktop={isDesktop} 
          searchTerm={searchTerm} 
          setSearchTerm={setSearchTerm} 
          isMobileSearchVisible={isMobileSearchVisible} 
          setIsMobileSearchVisible={setIsMobileSearchVisible} 
        />
        
        <div style={{ display: "flex", flex: 1 }}>
          <div style={{ flex: 1, padding: isDesktop ? "40px" : "15px", paddingBottom: "100px" }}>
            
            {/* CONTENT ROUTER */}
            {(isDesktop || activeBottomTab === "explore") ? (
              // EXPLORE GRID
              <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(5, 1fr)" : "repeat(3, 1fr)", gap: isDesktop ? "20px" : "4px" }}>
                {videos.map(v => (
                  <VideoCard key={`${v.chat_id}:${v.message_id}`} video={v} layoutType={currentCategory} onOpen={() => handleOpenVideo(v)} />
                ))}
              </div>
            ) : activeBottomTab === "home" ? (
              // HOME DASHBOARD
              <div style={{ display: "flex", flexDirection: "column", gap: "40px" }}>
                {CATEGORIES.map(cat => (
                  <section key={cat}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px", alignItems: "center" }}>
                      <h3 style={{ color: "#fff", textTransform: "uppercase", fontSize: "14px", fontWeight: "900", margin: 0 }}>{cat}</h3>
                      <button 
                        onClick={() => { setActiveBottomTab("explore"); setActiveTab(CATEGORIES.indexOf(cat)); }} 
                        style={{ color: "#ff0000", fontSize: "12px", fontWeight: "800", background: "none", border: "none" }}>
                        See All
                      </button>
                    </div>
                    {/* Fixed 2-column grid for mobile dashboard */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
                      {dashboardVideos[cat]?.map(v => (
                        <VideoCard key={`dash-${v.message_id}`} video={v} layoutType={cat} onOpen={() => handleOpenVideo(v)} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              // PROFILE PLACEHOLDER
              <div style={{ color: "#8e8e8e", textAlign: "center", marginTop: "100px" }}>
                <UserIcon size={48} style={{ margin: "0 auto 20px" }} />
                <h3>Profile Coming Soon</h3>
                <p>Saved videos and settings will appear here.</p>
              </div>
            )}

            {!loading && videos.length > 0 && activeBottomTab === "explore" && (
              <button onClick={loadMore} style={{ display: "block", margin: "40px auto", background: "#1c1c1e", color: "#fff", padding: "12px 30px", borderRadius: "30px", border: "none", fontWeight: "900", cursor: "pointer" }}>
                Show More
              </button>
            )}
          </div>

          {/* DESKTOP RIGHT SIDEBAR */}
          {isDesktop && <SuggestedSidebar suggestions={sidebarSuggestions} onVideoClick={handleOpenVideo} />}
        </div>
      </div>

      {/* 3. MOBILE BOTTOM NAV */}
      {!isDesktop && (
        <div style={{ 
          position: "fixed", bottom: 0, left: 0, right: 0, height: "65px", 
          background: "rgba(0,0,0,0.95)", backdropFilter: "blur(10px)", 
          borderTop: "1px solid #262626", display: "flex", alignItems: "center", 
          justifyContent: "space-around", zIndex: 2000 // High z-index to sit above grid
        }}>
          <button onClick={() => setActiveBottomTab("home")} style={{ background: "none", border: "none", color: activeBottomTab === "home" ? "#fff" : "#8e8e8e", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
            <HomeIcon size={24} />
            <span style={{ fontSize: "10px", fontWeight: "600" }}>Home</span>
          </button>
          <button onClick={() => setActiveBottomTab("explore")} style={{ background: "none", border: "none", color: activeBottomTab === "explore" ? "#fff" : "#8e8e8e", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
            <Compass size={24} />
            <span style={{ fontSize: "10px", fontWeight: "600" }}>Explore</span>
          </button>
          <button onClick={() => setActiveBottomTab("profile")} style={{ background: "none", border: "none", color: activeBottomTab === "profile" ? "#fff" : "#8e8e8e", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
            <UserIcon size={24} />
            <span style={{ fontSize: "10px", fontWeight: "600" }}>Profile</span>
          </button>
        </div>
      )}

      {/* 4. FULLSCREEN PLAYER (Highest Z-Index) */}
      {activeVideo && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999 }}>
          <FullscreenPlayer 
            video={activeVideo} 
            onClose={() => setActiveVideo(null)} 
            isDesktop={isDesktop} 
          />
        </div>
      )}
    </div>
  );
}