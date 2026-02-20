import React, { useEffect, useState } from "react";
import { Play, Flame, Grid3X3, User as UserIcon, ArrowUp } from "lucide-react";
import AppHeader from "../components/AppHeader";
import SuggestedSidebar from "../components/SuggestedSidebar";
import VideoCard from "../components/VideoCard";
import FullscreenPlayer from "../components/FullscreenPlayer";
import PullToRefresh from "../components/PullToRefresh"; 
import { useVideos } from "../hooks/useVideos";
import { expandApp } from "../utils/telegram";
import { openRewardedAd } from "../utils/rewardedAd";
import { adReturnWatcher } from "../utils/adReturnWatcher";

const CATEGORIES = ["knacks", "hotties", "baddies", "trends"];

export default function Home({ user, onProfileClick, setHideFooter }) {
  // 🟢 Randomize the initial category on load
  const [activeTab, setActiveTab] = useState(() => {
    return Math.floor(Math.random() * CATEGORIES.length);
  }); 
  const [activeVideo, setActiveVideo] = useState(null);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [unlockedVideos, setUnlockedVideos] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isMobileSearchVisible, setIsMobileSearchVisible] = useState(false);
  const [videoCache, setVideoCache] = useState({});
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  const [viewedCategories, setViewedCategories] = useState(new Set());

  const currentCategory = CATEGORIES[activeTab];
  const isDesktop = windowWidth > 1024;

  const { videos, sidebarSuggestions, loading, loadMore } = useVideos(currentCategory);

  // 🟢 FOOTER VISIBILITY LOGIC
  useEffect(() => {
    if (activeVideo) {
      setHideFooter(true); // Tell App.jsx to hide footer
      document.body.style.overflow = "hidden"; // Prevent background scrolling
    } else {
      setHideFooter(false); // Show footer again
      document.body.style.overflow = "auto";
    }
    
    // Cleanup if component unmounts
    return () => {
      document.body.style.overflow = "auto";
      setHideFooter(false);
    };
  }, [activeVideo, setHideFooter]);

  const shouldShowBadge = (index) => {
    const catName = CATEGORIES[index];
    if (activeTab === index || viewedCategories.has(catName)) return false;
    const catVideos = videoCache[catName];
    if (!catVideos || catVideos.length === 0) return false;
    const latestUpload = new Date(catVideos[0].created_at).getTime();
    const twentyFourHoursAgo = Date.now() - (24 * 60 * 60 * 1000);
    return latestUpload > twentyFourHoursAgo;
  };

  useEffect(() => {
    setViewedCategories(prev => new Set(prev).add(currentCategory));
  }, [currentCategory]);

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

  useEffect(() => {
    if (videos && videos.length > 0) {
      setVideoCache(prev => ({ ...prev, [currentCategory]: videos }));
    }
  }, [videos, currentCategory]);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });
  const handleRefresh = async () => window.location.reload();

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
      if (!res.ok) throw new Error("Server error");
      const data = await res.json();
      if (data.video_url) {
        setActiveVideo(prev => ({ ...prev, video_url: data.video_url }));
      }
    } catch (e) { 
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

  const videosToDisplay = (videoCache[currentCategory] && videoCache[currentCategory].length > 0) 
    ? videoCache[currentCategory] 
    : videos;

  return (
    <div style={{ background: "#000", minHeight: "100vh", display: isDesktop ? "flex" : "block" }}>
      
      {isDesktop && (
        <nav style={sidebarStyle}>
          {TABS.map((tab, index) => (
            <button 
              key={index} 
              onClick={() => { if (activeTab === index) scrollToTop(); else setActiveTab(index); }} 
              style={{ ...desktopTabButtonStyle, background: activeTab === index ? "#1c1c1e" : "none" }}
            >
              <div style={{ position: "relative", display: "flex", alignItems: "center", gap: "15px" }}>
                 {tab.icon} 
                 <span style={{ fontWeight: "bold" }}>{tab.label}</span>
                 {shouldShowBadge(index) && <div style={desktopBadgeStyle} />}
              </div>
            </button>
          ))}
        </nav>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ background: "#000" }}>
           <AppHeader 
              isDesktop={isDesktop}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              isMobileSearchVisible={isMobileSearchVisible}
              setIsMobileSearchVisible={setIsMobileSearchVisible}
              user={user} 
              onProfileClick={onProfileClick} 
            />
        </div>

        {!isDesktop && (
          <nav style={mobileNavStyle}>
            {TABS.map((tab, index) => (
              <button 
                key={index} 
                onClick={() => { if (activeTab === index) scrollToTop(); else setActiveTab(index); }} 
                style={{ flex: 1, padding: "14px 0", background: "none", border: "none", color: activeTab === index ? "#fff" : "#8e8e8e", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", position: "relative" }}
              >
                <div style={{ position: "relative" }}>
                  {tab.icon}
                  {shouldShowBadge(index) && <div style={mobileBadgeStyle} />}
                </div>
                <span style={{ fontSize: "10px", fontWeight: "700", letterSpacing: "0.5px" }}>{tab.label}</span>
              </button>
            ))}
            <div style={{ ...indicatorStyle, transform: `translateX(${activeTab * 100}%)` }} />
          </nav>
        )}
        
        <PullToRefresh onRefresh={handleRefresh}>
          <div style={{ display: "flex", flex: 1 }}>
            <div style={{ flex: 1, padding: isDesktop ? "40px" : "15px", paddingBottom: "100px" }}>
               <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(auto-fill, minmax(200px, 1fr))" : "repeat(2, 1fr)", gap: "10px", alignItems: "start" }}>
                  {videosToDisplay.map(v => (
                    <VideoCard key={`${v.chat_id}:${v.message_id}`} video={v} layoutType={currentCategory} onOpen={() => handleOpenVideo(v)} />
                  ))}
               </div>
               {loading && videosToDisplay.length === 0 && ( <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>Loading videos...</div> )}
               {!loading && videosToDisplay.length > 0 && (
                <button onClick={loadMore} style={showMoreButtonStyle}>Show More</button>
               )}
            </div>
            {isDesktop && (
              <div style={{ flexShrink: 0 }}>
                <SuggestedSidebar suggestions={sidebarSuggestions} onVideoClick={handleOpenVideo} />
              </div>
            )}
          </div>
        </PullToRefresh>
      </div>

      {!isDesktop && (
        <button onClick={scrollToTop} style={{ ...scrollTopButtonStyle, opacity: showScrollTop ? 1 : 0, transform: showScrollTop ? "translateY(0)" : "translateY(20px)", pointerEvents: showScrollTop ? "auto" : "none" }}>
          <ArrowUp size={24} color="#fff" />
        </button>
      )}

      {activeVideo && <FullscreenPlayer video={activeVideo} onClose={() => setActiveVideo(null)} isDesktop={isDesktop} />}
    </div>
  );
}

// 🎨 STYLES (Keep existing constants)
const mobileBadgeStyle = { position: "absolute", top: "-2px", right: "-6px", width: "8px", height: "8px", background: "var(--primary-color)", borderRadius: "50%", border: "1.5px solid #000" };
const desktopBadgeStyle = { width: "7px", height: "7px", background: "var(--primary-color)", borderRadius: "50%", marginLeft: "10px" };
const mobileNavStyle = { display: "flex", justifyContent: "space-evenly", position: "sticky", top: 0, zIndex: 1000, background: "rgba(0,0,0,0.95)", backdropFilter: "blur(15px)", borderBottom: "1px solid #262626" };
const indicatorStyle = { position: "absolute", bottom: 0, left: 0, width: "25%", height: "3px", background: "var(--primary-color)", transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)" };
const sidebarStyle = { width: "240px", height: "100vh", position: "sticky", top: 0, borderRight: "1px solid #262626", padding: "40px 10px", display: "flex", flexDirection: "column", gap: "10px", flexShrink: 0, zIndex: 100 };
const desktopTabButtonStyle = { display: "flex", alignItems: "center", gap: "15px", padding: "12px 20px", border: "none", color: "#fff", borderRadius: "10px", cursor: "pointer", textAlign: "left" };
const showMoreButtonStyle = { display: "block", margin: "40px auto", background: "#1c1c1e", color: "#fff", padding: "12px 30px", borderRadius: "30px", border: "none", fontWeight: "900", cursor: "pointer" };
const scrollTopButtonStyle = { position: "fixed", bottom: "30px", right: "20px", width: "50px", height: "50px", borderRadius: "50%", background: "var(--primary-color)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000, transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)", cursor: "pointer" };