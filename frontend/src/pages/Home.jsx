import React, { useEffect, useState, useMemo, useCallback } from "react";
import { Grid3X3, Play, Flame, User, Search, X } from "lucide-react"; 
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
  const [searchTerm, setSearchTerm] = useState("");

  const CATEGORIES = ["knacks", "hotties", "baddies", "trends"];
  const currentCategory = CATEGORIES[activeTab];
  const isDesktop = windowWidth > 1024;

  const filteredSuggestions = useMemo(() => {
    if (!searchTerm.trim()) return sidebarSuggestions;
    return sidebarSuggestions.filter(v => 
      v.caption?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      v.uploader_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [sidebarSuggestions, searchTerm]);

  const loadVideos = useCallback(async (isNewTab = false) => {
    setLoading(true);
    setPage(prevPage => {
      const pageToFetch = isNewTab ? 1 : prevPage;
      const fetchData = async () => {
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
          }
        } catch (err) { console.error("Fetch Error:", err); } finally { setLoading(false); }
      };
      fetchData();
      return isNewTab ? 2 : prevPage + 1;
    });
  }, [currentCategory]);

  useEffect(() => {
    expandApp();
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    setVideos([]);
    loadVideos(true); 
  }, [activeTab, loadVideos]);

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
    return isDetailedLayout ? "repeat(2, 1fr)" : "repeat(3, 1fr)";
  };

  const TABS = [
    { icon: <Play size={isDesktop ? 22 : 20} />, label: "KNACKS"},
    { icon: <Grid3X3 size={isDesktop ? 22 : 20} />, label: "HOTTIES"},
    { icon: <User size={isDesktop ? 22 : 20} />, label: "BADDIES"},
    { icon: <Flame size={isDesktop ? 22 : 20} />, label: "TRENDS"}
  ];

  return (
    <div style={{ background: "#000", minHeight: "100vh", display: isDesktop ? "flex" : "block" }}>
      
      {/* LEFT NAV SIDEBAR */}
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
                padding: "12px 20px", 
                background: activeTab === index ? "#1c1c1e" : "transparent", 
                borderRadius: "10px",
                border: "none", 
                color: activeTab === index ? "#fff" : "#8e8e8e", 
                cursor: "pointer", 
                transition: "background 0.2s, color 0.2s" 
            }}
            onMouseEnter={(e) => { if (isDesktop && activeTab !== index) e.currentTarget.style.background = "#121212"; }}
            onMouseLeave={(e) => { if (isDesktop && activeTab !== index) e.currentTarget.style.background = "transparent"; }}
          >
            {tab.icon}
            <span style={{ fontSize: isDesktop ? "14px" : "8px", fontWeight: "bold" }}>{tab.label}</span>
          </button>
        ))}
      </nav>

      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <header style={{ position: "sticky", top: 0, zIndex: 100, height: "70px", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid #262626", padding: isDesktop ? "0 40px" : "0 15px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ userSelect: "none" }}>
            <h1 style={{ color: "#fff", fontSize: isDesktop ? "24px" : "18px", fontWeight: "900", letterSpacing: "-1px", margin: 0 }}>
              NAIJA<span style={{ color: "#ff0000" }}>HOMEMADE</span>
            </h1>
          </div>
          {isDesktop && (
            <div style={{ display: "flex", alignItems: "center", background: "#1c1c1e", borderRadius: "20px", padding: "0 15px", width: "400px", border: "1px solid #333" }}>
              <Search size={18} color="#8e8e8e" />
              <input type="text" placeholder="Search suggestions..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} style={{ background: "none", border: "none", color: "#fff", padding: "10px", width: "100%", outline: "none", fontSize: "14px" }} />
              {searchTerm && <X size={16} color="#8e8e8e" style={{ cursor: "pointer" }} onClick={() => setSearchTerm("")} />}
            </div>
          )}
        </header>

        <div style={{ display: "flex", flex: 1 }}>
          <div style={{ flex: 1, padding: isDesktop ? "40px" : "0px", borderRight: isDesktop ? "1px solid #262626" : "none" }}>
            <div style={{ minHeight: "80vh", padding: isDesktop ? "0" : (isDetailedLayout ? "10px" : "1px") }}>
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: getGridColumns(), 
                gridAutoRows: "min-content", 
                gap: isDesktop ? "20px" : (isDetailedLayout ? "12px" : "1px") // 🟢 Desktop Spacing applied here
              }}>
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

          {isDesktop && (
            <aside style={{ width: "380px", height: "calc(100vh - 70px)", position: "sticky", top: "70px", padding: "30px 15px", display: "flex", flexDirection: "column", gap: "10px", flexShrink: 0, overflowY: "auto", borderLeft: "1px solid #262626" }}>
              <h3 style={{ color: "#fff", fontSize: "16px", fontWeight: "800", margin: "0 0 10px 0" }}>Suggested for you</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {filteredSuggestions.map((v) => (
                  <div 
                    key={`suggested-${v.chat_id}-${v.message_id}`} 
                    onClick={() => handleOpenVideo(v)}
                    style={{ display: "flex", gap: "12px", cursor: "pointer", alignItems: "flex-start", padding: "10px", borderRadius: "10px", transition: "background 0.2s" }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#1c1c1e"} // 🟢 Sidebar Hover
                    onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ width: "80px", height: "100px", borderRadius: "6px", overflow: "hidden", background: "#111", flexShrink: 0 }}>
                      <img src={v.thumbnail_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: "#fff", fontSize: "13px", fontWeight: "600", margin: "0 0 4px 0", lineHeight: "1.4", wordWrap: "break-word" }}>{v.caption || "View trending video..."}</p>
                      <div style={{ color: "#8e8e8e", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}>
                        <Play size={10} fill="#8e8e8e" strokeWidth={0} />
                        <span>{Number(v.views).toLocaleString()} views</span>
                      </div>
                      <div style={{ color: "#555", fontSize: "11px", fontWeight: "700", marginTop: "4px" }}>@{v.uploader_name || "Member"}</div>
                    </div>
                  </div>
                ))}
              </div>
            </aside>
          )}
        </div>
      </div>
      {activeVideo && <FullscreenPlayer video={activeVideo} onClose={() => setActiveVideo(null)} isDesktop={isDesktop} />}
    </div>
  );
}