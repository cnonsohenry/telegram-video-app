import React, { useState, useEffect, useCallback, useRef } from "react";
import { Settings, Grid3X3, Heart, Lock, CheckCircle, Share2, ArrowLeft } from "lucide-react"; 
import VideoCard from "../components/VideoCard"; 
import SettingsView from "../components/SettingsView"; 
import { useVideos } from "../hooks/useVideos";

// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../config";

export default function Profile({ user, onLogout, setHideFooter, setActiveVideo, setShowPaywall }) {
  const [activeTab, setActiveTab] = useState("videos");
  const [currentView, setCurrentView] = useState("profile");
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);
  
  const [activeGroup, setActiveGroup] = useState(null);
  
  // 🟢 NEW: Local state to track soft-deleted videos instantly
  const [deletedVideoIds, setDeletedVideoIds] = useState(new Set());
  
  const loaderRef = useRef(null);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    if (currentView === "settings") {
      setHideFooter(true);
    } else {
      setHideFooter(false);
    }
    return () => setHideFooter(false);
  }, [currentView, setHideFooter]);

  useEffect(() => {
    setActiveGroup(null);
  }, [activeTab]);

  const fetchLimit = isDesktop ? 15 : 12;

  const { videos: shots, loading: shotsLoading, loadMore: loadMoreShots } = useVideos("shots", fetchLimit);
  const { videos: premium, loading: premiumLoading, loadMore: loadMorePremium } = useVideos("premium", fetchLimit);

  const { data: rawVideosToDisplay, loading, loadMore } = activeTab === "premium" 
    ? { data: premium || [], loading: premiumLoading, loadMore: loadMorePremium }
    : { data: shots || [], loading: shotsLoading, loadMore: loadMoreShots };

  // 🟢 THE FIX: Soft Delete Event Listener
  useEffect(() => {
    const handleVideoDeleted = (event) => {
      const deletedId = String(event.detail); // Normalize to string for safe comparison

      // 1. Add to the hidden list to filter out from raw feeds
      setDeletedVideoIds(prev => new Set(prev).add(deletedId));

      // 2. Instantly remove from active album/group if open
      setActiveGroup(prevGroup => {
        if (!prevGroup) return null;
        return {
          ...prevGroup,
          videos: prevGroup.videos.filter(v => 
            String(v.id || v.message_id) !== deletedId
          )
        };
      });
    };

    window.addEventListener('videoDeleted', handleVideoDeleted);
    return () => window.removeEventListener('videoDeleted', handleVideoDeleted);
  }, []);

  // 🟢 Filter out any videos we just soft-deleted
  const filteredRawVideos = rawVideosToDisplay.filter(v => 
    !deletedVideoIds.has(String(v.id || v.message_id))
  );

  const videosToDisplay = activeGroup ? activeGroup.videos : filteredRawVideos;

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && !loading && !activeGroup) {
          loadMore();
        }
      },
      { 
        root: null, 
        rootMargin: "200px", 
        threshold: 0.1 
      }
    );

    if (loaderRef.current) observer.observe(loaderRef.current);

    return () => observer.disconnect();
  }, [loading, loadMore, activeGroup]);

  const handleOpenVideo = useCallback(async (video, e) => {
    if (e && typeof e.preventDefault === 'function') {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!video) return;

    if (video.is_group && !activeGroup) {
      try {
        const res = await fetch(`${APP_CONFIG.apiUrl}/api/group?media_group_id=${video.media_group_id}`);
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

    if (video.category === "premium" || activeTab === "premium") {
      if (!user || !user.is_premium) {
        setShowPaywall(true);
        return;
      }
    }

    try {
      setActiveVideo({ ...video, video_url: null }); 
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      if (data.video_url) setActiveVideo(prev => ({ ...prev, video_url: data.video_url }));
    } catch (err) {
      console.error("Profile Video Load Error:", err);
      setActiveVideo(null);
    }
  }, [user, activeTab, setActiveVideo, activeGroup, isDesktop]); 

  if (currentView === "settings") {
    return <SettingsView onBack={() => setCurrentView("profile")} onLogout={onLogout} />;
  }

  return (
    <div style={{ ...containerStyle, padding: isDesktop ? "30px 20px" : "0" }}>
      <div style={isDesktop ? desktopInnerWrapper : {}}>
        
        {/* TOP NAV (Mobile Only) */}
        {!isDesktop && (
          <div style={navGridStyle}>
            <div style={{ width: "40px" }}></div>
            <div style={centerTitleContainer}>
              <h2 style={usernameStyle}>{user?.username || APP_CONFIG.defaultUploader}</h2>
              <CheckCircle size={14} color="#20D5EC" fill="black" style={{ marginLeft: "4px" }} />
            </div>
            <div style={{ display: "flex", gap: "16px", justifyContent: "flex-end", flex: 1 }}>
              <Settings size={24} color="#fff" onClick={() => setCurrentView("settings")} style={{ cursor: "pointer" }} />
            </div>
          </div>
        )}

        {/* USER IDENTITY SECTION */}
        <div style={{ padding: isDesktop ? "40px 20px" : "20px" }}>
          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: isDesktop ? "80px" : "15px" }}>
            
            <div style={{ ...avatarContainerStyle, width: isDesktop ? "150px" : "80px", height: isDesktop ? "150px" : "80px" }}>
              <img
                src={user?.avatar_url || "/assets/default-avatar.png"}
                style={avatarImageStyle}
                alt="Avatar"
                onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <h1 style={{ ...displayNameStyle, fontSize: isDesktop ? "28px" : "16px", fontWeight: isDesktop ? "300" : "700" }}>
                  @{user?.username || "user"}
                </h1>
                {isDesktop && (
                  <div style={{ display: "flex", gap: "10px", marginLeft: "14px" }}>
                     <button style={desktopEditBtnStyle} onClick={() => setCurrentView("settings")}>Edit Profile</button>
                     <Settings size={24} color="#fff" onClick={() => setCurrentView("settings")} style={{ cursor: "pointer" }} />
                  </div>
                )}
              </div>

              <p style={{ ...bioStyle, fontSize: isDesktop ? "16px" : "12px", color: "#ccc", lineHeight: "1.4" }}>
                <b style={{ color: "#fff" }}>{APP_CONFIG.profileBioTitle}</b><br/>
                {APP_CONFIG.profileBioSubtitle}
              </p>

              {isDesktop && (
                <div style={{ ...actionButtonsRowStyle, width: "fit-content", marginTop: "20px" }}>
                  <button
                    style={premiumButtonStyle}
                    onClick={() => (!user || !user.is_premium) ? setShowPaywall(true) : alert("You are already Premium!")}
                  >
                    {user?.is_premium ? APP_CONFIG.profileVipText : APP_CONFIG.profileSubscribeText}
                  </button>
                  <button style={secondaryButtonStyle} onClick={() => alert("Link Copied")}><Share2 size={18} /></button>
                </div>
              )}
            </div>
          </div>

          {!isDesktop && (
            <div style={{ ...actionButtonsRowStyle, width: "100%", marginTop: "15px" }}>
              <button
                style={{ ...premiumButtonStyle, flex: 1, padding: "8px 16px", fontSize: "13px" }}
                onClick={() => (!user || !user.is_premium) ? setShowPaywall(true) : alert("You are already Premium!")}
              >
                {user?.is_premium ? APP_CONFIG.profileVipText : APP_CONFIG.profileSubscribeText}
              </button>
              <button style={{ ...secondaryButtonStyle, padding: "0 15px" }} onClick={() => alert("Link Copied")}><Share2 size={18} /></button>
            </div>
          )}
        </div>

        {/* TABS NAV */}
        <div style={{ 
          ...tabsContainerStyle, 
          justifyContent: isDesktop ? "center" : "space-around",
          gap: isDesktop ? "60px" : "0",
          borderTop: isDesktop ? "1px solid var(--border-color)" : "none",
          top: isDesktop ? "0" : "48px"
        }}>
          <TabButton 
            isDesktop={isDesktop} 
            active={activeTab === "videos"} 
            onClick={() => setActiveTab("videos")} 
            icon={<Grid3X3 size={isDesktop ? 18 : 24} />} 
            label={APP_CONFIG.profileTabs.posts} 
          />
          <TabButton 
            isDesktop={isDesktop} 
            active={activeTab === "premium"} 
            onClick={() => setActiveTab("premium")} 
            icon={<Lock size={isDesktop ? 18 : 24} />} 
            label={APP_CONFIG.profileTabs.premium} 
          />
          <TabButton 
            isDesktop={isDesktop} 
            active={activeTab === "likes"} 
            onClick={() => setActiveTab("likes")} 
            icon={<Heart size={isDesktop ? 18 : 24} />} 
            label={APP_CONFIG.profileTabs.liked} 
          />
        </div>

        {/* VIDEO GRID */}
        <div style={{ padding: isDesktop ? "30px 25px" : "15px" }}>
          
          {activeGroup && (
            <div style={groupHeaderStyle}>
              <button onClick={() => setActiveGroup(null)} style={backButtonStyle}>
                <ArrowLeft size={20} />
                <span>Back</span>
              </button>
              <span style={groupTitleStyle}>{activeGroup.videos.length} clips in collection</span>
            </div>
          )}

          <div style={{ 
            ...gridStyle, 
            gridTemplateColumns: isDesktop ? "repeat(5, 1fr)" : "repeat(2, 1fr)",
            gap: isDesktop ? "20px" : "10px"
          }}>
            {videosToDisplay.map(v => (
              <VideoCard 
                key={`${v.chat_id}:${v.message_id}`} 
                video={v} 
                onOpen={(vData, e) => handleOpenVideo(vData, e)} 
                showDetails={true} 
              />
            ))}
          </div>
          
          {/* Loading state message */}
          {loading && !activeGroup && <div style={loaderStyle}>Refreshing shots...</div>}
          
          {/* The invisible trigger for our IntersectionObserver */}
          {!loading && !activeGroup && filteredRawVideos.length > 0 && (
            <div ref={loaderRef} style={{ height: "10px", width: "100%" }} />
          )}

        </div>
      </div>
    </div>
  );
}

// 🎨 COMPONENT UI PIECES
const TabButton = ({ active, onClick, icon, label, isDesktop }) => (
  <button onClick={onClick} style={{ 
    display: "flex", 
    flexDirection: isDesktop ? "row" : "column", 
    alignItems: "center", 
    gap: isDesktop ? "8px" : "6px",
    background: "none", border: "none", 
    padding: isDesktop ? "15px 0" : "12px 0",
    borderTop: (isDesktop && active) ? "1px solid #fff" : "none",
    borderBottom: (!isDesktop && active) ? "2px solid #fff" : (!isDesktop ? "1px solid var(--border-color)" : "none"),
    opacity: active ? 1 : 0.4, color: "#fff", cursor: "pointer",
    marginTop: isDesktop ? "-1px" : "0"
  }}>
    {icon}
    <span style={{ fontSize: isDesktop ? "12px" : "10px", fontWeight: "700", letterSpacing: isDesktop ? "1px" : "0" }}>{label}</span>
  </button>
);

// 🖌 STYLES
const containerStyle = { minHeight: "100%", background: "var(--bg-color)", color: "#fff", position: "relative", overflowX: "hidden" };
const desktopInnerWrapper = { maxWidth: "935px", margin: "0 auto", width: "100%" };
const navGridStyle = { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "12px 20px", borderBottom: "1px solid var(--border-color)", position: "sticky", top: 0, background: "var(--bg-color)", zIndex: 100, backdropFilter: "blur(15px)" };
const centerTitleContainer = { display: "flex", alignItems: "center" };
const usernameStyle = { fontSize: "16px", fontWeight: "700", margin: 0 };
const avatarContainerStyle = { borderRadius: "50%", padding: "4px", background: "linear-gradient(45deg, #FFD700, var(--primary-color))", flexShrink: 0 };
const avatarImageStyle = { width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", border: "4px solid #000" };
const displayNameStyle = { fontWeight: "300", margin: 0, color: "#fff" };
const bioStyle = { margin: 0, lineHeight: "1.5" };
const actionButtonsRowStyle = { display: "flex", gap: "10px" };
const premiumButtonStyle = { background: "var(--primary-color)", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 24px", fontWeight: "800", fontSize: "14px", cursor: "pointer" };
const secondaryButtonStyle = { background: "#1a1a1a", color: "#fff", border: "1px solid #333", borderRadius: "8px", padding: "0 15px", display: "flex", alignItems: "center" };
const desktopEditBtnStyle = { background: "#363636", color: "#fff", border: "none", borderRadius: "8px", padding: "5px 15px", fontWeight: "600", fontSize: "14px", cursor: "pointer" };
const tabsContainerStyle = { display: "flex", position: "sticky", background: "var(--bg-color)", zIndex: 90 };
const gridStyle = { display: "grid" };
const loaderStyle = { padding: "40px", textAlign: "center", color: "#666", fontSize: "14px" };

const groupHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px", background: "var(--bg-color)", borderBottom: "1px solid rgba(255,255,255,0.05)" };
const backButtonStyle = { display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#fff", fontSize: "15px", fontWeight: "600", cursor: "pointer", padding: "0" };
const groupTitleStyle = { fontSize: "13px", color: "#8e8e8e", fontWeight: "500" };