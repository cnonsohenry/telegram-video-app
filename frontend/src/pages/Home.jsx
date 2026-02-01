import React, { useState } from "react";
import { Home as HomeIcon, Compass, User as UserIcon, Play, Flame, Grid3X3 } from "lucide-react";
import AppHeader from "../components/AppHeader";
import SuggestedSidebar from "../components/SuggestedSidebar";
import VideoCard from "../components/VideoCard";
import FullscreenPlayer from "../components/FullscreenPlayer";
import { useVideos } from "../hooks/useVideos";

export default function Home() {
  const [activeBottomTab, setActiveBottomTab] = useState("home"); 
  const [activeTab, setActiveTab] = useState(0); 
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  const [activeVideo, setActiveVideo] = useState(null);
  const isDesktop = windowWidth > 1024;

  const CATEGORIES = ["knacks", "hotties", "baddies", "trends"];
  const currentCategory = CATEGORIES[activeTab];
  const { videos, dashboardVideos, sidebarSuggestions, loading, loadMore } = useVideos(currentCategory);

  const TABS = [
    { icon: <Play size={20} />, label: "KNACKS"},
    { icon: <Grid3X3 size={20} />, label: "HOTTIES"},
    { icon: <UserIcon size={20} />, label: "BADDIES"},
    { icon: <Flame size={20} />, label: "TRENDS"}
  ];

  return (
    <div style={{ background: "#000", minHeight: "100vh", display: isDesktop ? "flex" : "block", paddingBottom: !isDesktop ? "80px" : 0 }}>
      
      {/* 1. TOP STICKY TABS (Mobile - Only on Explore) */}
      {!isDesktop && activeBottomTab === "explore" && (
        <nav style={{ display: "flex", position: "sticky", top: 0, zIndex: 1000, background: "#000", borderBottom: "1px solid #262626" }}>
          {TABS.map((tab, index) => (
            <button key={index} onClick={() => setActiveTab(index)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0", background: "none", border: "none", color: activeTab === index ? "#fff" : "#8e8e8e" }}>
              {tab.icon} <span style={{ fontSize: "8px", fontWeight: "bold" }}>{tab.label}</span>
            </button>
          ))}
          <div style={{ position: "absolute", bottom: 0, left: 0, width: "25%", height: "2px", background: "#fff", transform: `translateX(${activeTab * 100}%)`, transition: "0.3s" }} />
        </nav>
      )}

      {/* 2. MAIN CONTENT */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        <AppHeader isDesktop={isDesktop} />

        <div style={{ display: "flex", flex: 1 }}>
          <div style={{ flex: 1, padding: isDesktop ? "40px" : "15px" }}>
            
            {/* 🟢 DASHBOARD VIEW */}
            {!isDesktop && activeBottomTab === "home" ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "30px" }}>
                {CATEGORIES.map(cat => (
                  <section key={cat}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                      <h3 style={{ color: "#fff", fontSize: "16px", fontWeight: "900", textTransform: "uppercase" }}>{cat}</h3>
                      <span onClick={() => { setActiveBottomTab("explore"); setActiveTab(CATEGORIES.indexOf(cat)); }} style={{ color: "#ff0000", fontSize: "12px", fontWeight: "bold" }}>See All</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
                      {dashboardVideos[cat]?.map(video => (
                        <VideoCard key={video.message_id} video={video} layoutType={cat} onOpen={setActiveVideo} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              /* 🟢 EXPLORE GRID */
              <div style={{ display: "grid", gridTemplateColumns: isDesktop ? "repeat(5, 1fr)" : "repeat(3, 1fr)", gap: "15px" }}>
                {videos.map(video => (
                  <VideoCard key={video.message_id} video={video} layoutType={currentCategory} onOpen={setActiveVideo} />
                ))}
              </div>
            )}
          </div>
          {isDesktop && <SuggestedSidebar suggestions={sidebarSuggestions} onVideoClick={setActiveVideo} />}
        </div>
      </div>

      {/* 🟢 3. BOTTOM STICKY NAV (Mobile) */}
      {!isDesktop && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: "70px", background: "rgba(0,0,0,0.95)", backdropFilter: "blur(15px)", borderTop: "1px solid #262626", display: "flex", alignItems: "center", justifyContent: "space-around", zIndex: 2000 }}>
          <TabButton icon={<HomeIcon />} label="Home" active={activeBottomTab === "home"} onClick={() => setActiveBottomTab("home")} />
          <TabButton icon={<Compass />} label="Explore" active={activeBottomTab === "explore"} onClick={() => setActiveBottomTab("explore")} />
          <TabButton icon={<UserIcon />} label="Profile" active={activeBottomTab === "profile"} onClick={() => setActiveBottomTab("profile")} />
        </div>
      )}

      {activeVideo && <FullscreenPlayer video={activeVideo} onClose={() => setActiveVideo(null)} />}
    </div>
  );
}

// Small helper component for bottom tabs
function TabButton({ icon, label, active, onClick }) {
  return (
    <button onClick={onClick} style={{ background: "none", border: "none", color: active ? "#fff" : "#8e8e8e", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
      {React.cloneElement(icon, { size: 24 })}
      <span style={{ fontSize: "10px", fontWeight: "bold" }}>{label}</span>
    </button>
  );
}