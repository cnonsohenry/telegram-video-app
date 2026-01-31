import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Grid3X3, Play, Flame, User } from "lucide-react"; 
import VideoCard from "../components/VideoCard";
import FullscreenPlayer from "../components/FullscreenPlayer";
import { expandApp } from "../utils/telegram";
import { openRewardedAd } from "../utils/rewardedAd";
import { adReturnWatcher } from "../utils/adReturnWatcher";

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [activeTab, setActiveTab] = useState(0); 
  const [unlockedVideos, setUnlockedVideos] = useState(new Set());
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [sidebarSuggestions, setSidebarSuggestions] = useState([]);

  const CATEGORIES = ["knacks", "hotties", "baddies", "trends"];
  const currentCategory = CATEGORIES[activeTab];
  const isDesktop = windowWidth > 1024;

  // 🟢 Fixed loadVideos logic
  const loadVideos = useCallback(async (isNewTab = false) => {
    if (loading) return;
    setLoading(true);
    const pageToFetch = isNewTab ? 1 : page;
    try {
      let url = `https://videos.naijahomemade.com/api/videos?page=${pageToFetch}&limit=20&category=${currentCategory}`;
      if (currentCategory === "trends") url += `&sort=trending`;
      
      const res = await fetch(url);
      const data = await res.json();
      
      if (data?.videos) {
        setVideos(prev => {
          const combined = isNewTab ? data.videos : [...prev, ...data.videos];
          const uniqueMap = new Map();
          combined.forEach(v => uniqueMap.set(`${v.chat_id}:${v.message_id}`, v));
          return Array.from(uniqueMap.values());
        });

        if (data.suggestions && data.suggestions.length > 0) {
          setSidebarSuggestions(data.suggestions);
        }

        setPage(pageToFetch + 1);
      }
    } catch (err) { 
        console.error("Fetch Error:", err); 
    } finally { 
        setLoading(false); 
    }
  }, [currentCategory, loading, page]);

  useEffect(() => {
    expandApp();
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    
    const currentHash = window.Telegram?.WebApp?.initData || "dev-mode";
    const savedHash = localStorage.getItem("session_hash");
    if (currentHash !== savedHash) {
      localStorage.clear();
      localStorage.setItem("session_hash", currentHash);
    } else {
      const saved = localStorage.getItem("unlockedVideos");
      if (saved) setUnlockedVideos(new Set(JSON.parse(saved)));
    }
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setVideos([]);
    setPage(1);
    loadVideos(true); 
  }, [activeTab]);

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
      const res = await fetch(`https://videos.naijahomemade.com/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`);
      const data = await res.json();
      if (data.video_url) {
        setVideos(prev => prev.map(v => (v.chat_id === video.chat_id && v.message_id === video.message_id) ? { ...v, views: Number(v.views || 0) + 1 } : v));
        setActiveVideo({ ...video, video_url: data.video_url });
      }
    } catch (e) { alert("Error fetching video"); }
  };

  const isDetailedLayout = currentCategory === "knacks" || currentCategory === "baddies";

  const getGridColumns = () => {
    if (isDesktop) return isDetailedLayout ? "repeat(3, 1fr)" : "repeat(5, 1fr)";
    return isDetailedLayout ? "repeat(2, 1fr)" : 
           currentCategory === "trends" ? "repeat(4, 1fr)" : "repeat(3, 1fr)";
  };

  const TABS = [
    { icon: <Play size={isDesktop ? 22 : 20} />, label: "KNACKS"},
    { icon: <Grid3X3 size={isDesktop ? 22 : 20} />, label: "HOTTIES"},
    { icon: <User size={isDesktop ? 22 : 20} />, label: "BADDIES"},
    { icon: <Flame size={isDesktop ? 22 : 20} />, label: "TRENDS"}
  ];

  return (
    <div style={{ background: "#000", minHeight: "100vh", display: isDesktop ? "flex" : "block" }}>
      
      {/* LEFT SIDEBAR */}
      <nav style={isDesktop ? { width: "240px", height: "100vh", position: "sticky", top: 0, borderRight: "1px solid #262626", padding: "40px 10px", display: "flex", flexDirection: "column", gap: "10px", flexShrink: 0 } : { display: "flex", position: "sticky", top: 0, zIndex: 100, background: "#000", borderBottom: "1px solid #262626" }}>
        {TABS.map((tab, index) => (
          <button 
            key={index} 
            onClick={() => setActiveTab(index)} 
            style={{ 
                flex: isDesktop ? "none" : 1, 
                display: "flex", 
                flexDirection: isDesktop ? "row" : "column", 
                alignItems: "center", 
                gap: isDesktop ? "15px" : "4px", 
                padding: isDesktop ? "12px 20px" : "12px 0", 
                background: isDesktop && activeTab === index ? "#1c1c1e" : "none", 
                borderRadius: isDesktop ? "10px" : "0px", // 🟢 Fixed Syntax Error here
                border: "none", 
                color: activeTab === index ? "#fff" : "#8e8e8e", 
                cursor: "pointer", 
                textAlign: "left" 
            }}
          >
            {tab.icon}
            <span style={{ fontSize: isDesktop ? "14px" : "8px", fontWeight: "bold" }}>{tab.label}</span>
          </button>
        ))}
      </nav>

      {/* MAIN CONTENT AREA */}
      <div style={{ flex: 1, padding: isDesktop ? "40px 20px" : "0px", borderRight: isDesktop ? "1px solid #262626" : "none" }}>
        <div style={{ minHeight: "80vh", padding: isDetailedLayout ? "10px" : "1px" }}>
          <div style={{ display: "grid", gridTemplateColumns: getGridColumns(), gridAutoRows: "min-content", gap: isDetailedLayout ? "12px" : "1px" }}>
            {videos.map(video => (
              <VideoCard key={`${video.chat_id}:${video.message_id}`} video={video} layoutType={currentCategory} onOpen={() => handleOpenVideo(video)} />
            ))}
          </div>
        </div>
        {!loading && videos.length > 0 && (
          <div style={{ textAlign: "center", padding: "40px 10px" }}>
            <button onClick={() => loadVideos(false)} style={{ background: "#1c1c1e", border: "none", color: "#fff", padding: "12px 30px", borderRadius: "30px", fontSize: 12, fontWeight: "900", cursor: "pointer" }}>SHOW MORE</button>
          </div>
        )}
      </div>

      {/* RIGHT SIDEBAR */}
      {isDesktop && (
        <aside style={{ width: "380px", height: "100vh", position: "sticky", top: 0, padding: "40px 20px", display: "flex", flexDirection: "column", gap: "20px", flexShrink: 0, overflowY: "auto" }}>
          <h3 style={{ color: "#fff", fontSize: "16px", fontWeight: "800", margin: 0 }}>Suggested for you</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {sidebarSuggestions.map((v) => (
              <div 
                key={`suggested-${v.chat_id}-${v.message_id}`} 
                onClick={() => handleOpenVideo(v)}
                style={{ display: "flex", gap: "12px", cursor: "pointer", alignItems: "flex-start" }}
              >
                <div style={{ width: "100px", height: "130px", borderRadius: "8px", overflow: "hidden", background: "#111", flexShrink: 0 }}>
                  <img src={v.thumbnail_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                </div>
                <div style={{ flex: 1 }}>
                  <p style={{ color: "#fff", fontSize: "13px", fontWeight: "600", margin: "0 0 6px 0", lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {v.caption || "View trending video..."}
                  </p>
                  <div style={{ color: "#8e8e8e", fontSize: "12px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Play size={12} fill="#8e8e8e" strokeWidth={0} />
                    <span>{Number(v.views).toLocaleString()} views</span>
                  </div>
                  <div style={{ color: "#555", fontSize: "11px", marginTop: "8px", fontWeight: "700" }}>
                    @{v.uploader_name || "Member"}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
      )}

      {activeVideo && <FullscreenPlayer video={activeVideo} onClose={() => setActiveVideo(null)} isDesktop={isDesktop} />}
    </div>
  );
}