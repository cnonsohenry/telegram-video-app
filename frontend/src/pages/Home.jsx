import React, { useEffect, useState } from "react";
import VideoCard from "../components/VideoCard";
import FullscreenPlayer from "../components/FullscreenPlayer";
import { expandApp } from "../utils/telegram";
import { openRewardedAd } from "../utils/rewardedAd";
import { adReturnWatcher } from "../utils/adReturnWatcher";

// 🟢 CONFIG: Matches your server's ALLOWED_USERS
const ALLOWED_USERS = [1881815190, 993163169, 5806906139]; 

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);
  const [activeTab, setActiveTab] = useState(0); // 0, 1, 2 = Users, 3 = Trending

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

  // 🟢 Re-load videos whenever the Tab changes
  useEffect(() => {
    setVideos([]);
    setPage(1);
    loadVideos(1, true);
  }, [activeTab]);

  useEffect(() => {
    if (unlockedVideos.size > 0) {
      localStorage.setItem("unlockedVideos", JSON.stringify([...unlockedVideos]));
    }
  }, [unlockedVideos]);

  const loadVideos = async (pageToLoad = page, isNewTab = false) => {
    if (loading && !isNewTab) return;
    setLoading(true);
    
    try {
      // Construct URL based on Tab
      let url = `https://videos.naijahomemade.com/api/videos?page=${pageToLoad}&limit=12`;
      
      if (activeTab === 3) {
        url += `&sort=trending`;
      } else {
        url += `&uploader_id=${ALLOWED_USERS[activeTab]}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      
      if (data?.videos) {
        setVideos(prev => isNewTab ? data.videos : [...prev, ...data.videos]);
        setPage(pageToLoad + 1);
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
      alert("Error fetching video link.");
    }
  };

  return (
    <div style={{ background: "#000", minHeight: "100vh" }}>
      
      {/* 🟢 INSTAGRAM TABS UI */}
      <div style={{ 
        display: "flex", 
        position: "sticky", 
        top: 0, 
        zIndex: 10, 
        background: "#000",
        borderBottom: "1px solid #333" 
      }}>
        {["USER 1", "USER 2", "USER 3", "TRENDING"].map((label, index) => (
          <button
            key={index}
            onClick={() => setActiveTab(index)}
            style={{
              flex: 1,
              padding: "14px 0",
              background: "none",
              border: "none",
              color: activeTab === index ? "#fff" : "#8e8e8e",
              fontSize: "10px",
              fontWeight: "900",
              letterSpacing: "1px",
              borderBottom: activeTab === index ? "2px solid #fff" : "2px solid transparent",
              transition: "all 0.2s"
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* GRID CONTAINER */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, padding: "1px" }}>
        {videos.map(video => {
          const videoKey = `${video.chat_id}:${video.message_id}`;
          return (
            <VideoCard
              key={videoKey}
              video={video}
              locked={!unlockedVideos.has(videoKey)}
              onOpen={() => handleOpenVideo(video)}
            />
          );
        })}
      </div>

      {/* VIEW MORE BUTTON */}
      {!loading && videos.length > 0 && (
        <div style={{ textAlign: "center", padding: "20px 10px" }}>
          <button
            onClick={() => loadVideos()}
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              gap: 12,
              background: "transparent",
              border: "none",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            <div style={{ flex: 1, height: 1, background: "#333" }} />
            <span style={{ fontSize: 11, fontWeight: "900", letterSpacing: 2 }}>VIEW MORE</span>
            <div style={{ flex: 1, height: 1, background: "#333" }} />
          </button>
        </div>
      )}

      {activeVideo && (
        <FullscreenPlayer video={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </div>
  );
}