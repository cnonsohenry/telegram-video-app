import React, { useEffect, useState } from "react";
import { Grid3X3, Play, Flame, User } from "lucide-react"; 
import VideoCard from "../components/VideoCard";
import FullscreenPlayer from "../components/FullscreenPlayer";
import { expandApp } from "../utils/telegram";
import { openRewardedAd } from "../utils/rewardedAd";
import { adReturnWatcher } from "../utils/adReturnWatcher";

const ALLOWED_USERS = [1881815190, 993163169, 5806906139]; 

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [activeTab, setActiveTab] = useState(0); 
  const [unlockedVideos, setUnlockedVideos] = useState(new Set());

  useEffect(() => {
    expandApp();
    const currentHash = window.Telegram?.WebApp?.initData || "dev-mode";
    const savedHash = localStorage.getItem("session_hash");

    if (currentHash !== savedHash) {
      localStorage.clear();
      localStorage.setItem("session_hash", currentHash);
      setUnlockedVideos(new Set());
    } else {
      const saved = localStorage.getItem("unlockedVideos");
      if (saved) setUnlockedVideos(new Set(JSON.parse(saved)));
    }
  }, []);

  // 🟢 Trigger reset and first page load on tab change
  useEffect(() => {
    setVideos([]);
    setPage(1);
    loadVideos(true); 
  }, [activeTab]);

  // 🟢 Revised loadVideos to handle "View More" correctly
  const loadVideos = async (isNewTab = false) => {
    if (loading) return;
    setLoading(true);
    
    // If it's a new tab, we MUST fetch page 1. Otherwise, use the current page state.
    const pageToFetch = isNewTab ? 1 : page;

    try {
      let url = `https://videos.naijahomemade.com/api/videos?page=${pageToFetch}&limit=12`;
      
      if (activeTab === 3) {
        url += `&sort=trending`;
      } else {
        url += `&uploader_id=${ALLOWED_USERS[activeTab]}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      
      if (data?.videos) {
        setVideos(prev => {
          const combined = isNewTab ? data.videos : [...prev, ...data.videos];
          
          // 🟢 Strict Duplicate Removal
          const uniqueMap = new Map();
          combined.forEach(v => {
            uniqueMap.set(`${v.chat_id}:${v.message_id}`, v);
          });
          return Array.from(uniqueMap.values());
        });

        // 🟢 Increment page state for the next "View More" click
        setPage(pageToFetch + 1);
      }
    } catch (err) {
      console.error("Load error", err);
    } finally {
      setLoading(false);
    }
  };

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
      playVideo(video);
    }
  };

  const playVideo = async (video) => {
    try {
      const res = await fetch(
        `https://videos.naijahomemade.com/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`
      );
      const data = await res.json();
      if (data.video_url) {
        setVideos(prev => prev.map(v => 
          (v.chat_id === video.chat_id && v.message_id === video.message_id)
            ? { ...v, views: Number(v.views || 0) + 1 } : v
        ));
        setActiveVideo({ ...video, video_url: data.video_url });
      }
    } catch (e) {
      alert("Error fetching video");
    }
  };

  return (
    <div style={{ background: "#000", minHeight: "100vh" }}>
      
      {/* 🟢 STICKY TAB BAR */}
      <div style={{ 
        display: "flex", 
        position: "sticky", 
        top: 0, 
        zIndex: 10, 
        background: "#000",
        borderBottom: "1px solid #262626" 
      }}>
        {[
          { icon: <Grid3X3 size={20} />, label: "USER 1" },
          { icon: <Play size={20} />, label: "USER 2" },
          { icon: <User size={20} />, label: "USER 3" },
          { icon: <Flame size={20} />, label: "TRENDS" }
        ].map((tab, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              padding: "12px 0",
              background: "none",
              border: "none",
              color: activeTab === index ? "#fff" : "#8e8e8e",
              borderBottom: activeTab === index ? "2px solid #fff" : "2px solid transparent",
              transition: "0.2s",
              cursor: "pointer"
            }}
          >
            {tab.icon}
            <span style={{ fontSize: "8px", marginTop: "4px", fontWeight: "bold" }}>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* VIDEO GRID */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, padding: "1px" }}>
        {videos.map(video => (
          <VideoCard
            key={`${video.chat_id}:${video.message_id}`}
            video={video}
            locked={!unlockedVideos.has(`${video.chat_id}:${video.message_id}`)}
            onOpen={() => handleOpenVideo(video)}
          />
        ))}
      </div>

      {loading && (
        <div style={{ color: "#8e8e8e", textAlign: "center", padding: 20, fontSize: 12 }}>
          Loading...
        </div>
      )}

      {/* 🟢 FIXED VIEW MORE BUTTON */}
      {!loading && videos.length > 0 && (
        <div style={{ textAlign: "center", padding: "30px 10px" }}>
          <button 
            onClick={() => loadVideos(false)} 
            style={{ 
              background: "none", 
              border: "none", 
              color: "#fff", 
              cursor: "pointer", 
              width: "100%",
              display: "flex",
              alignItems: "center",
              gap: 10
            }}
          >
            <div style={{ flex: 1, height: 3, background: "#262626" }} />
            <span style={{ fontSize: 10, fontWeight: "900", letterSpacing: 2 }}>VIEW MORE</span>
            <div style={{ flex: 1, height: 3, background: "#262626" }} />
          </button>
        </div>
      )}

      {activeVideo && (
        <FullscreenPlayer video={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </div>
  );
}