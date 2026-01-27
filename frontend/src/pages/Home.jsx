import React, { useEffect, useState } from "react";
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

  /* =====================
     SESSION-LOCKED STORAGE
  ===================== */
  const [unlockedVideos, setUnlockedVideos] = useState(new Set());

  useEffect(() => {
    expandApp();
    
    // 1. Get unique session hash from Telegram
    const currentHash = window.Telegram?.WebApp?.initData || "dev-mode";
    const savedHash = localStorage.getItem("session_hash");

    // 2. If it's a NEW launch (hashes don't match), wipe storage
    if (currentHash !== savedHash) {
      localStorage.clear();
      localStorage.setItem("session_hash", currentHash);
      setUnlockedVideos(new Set());
    } else {
      // 3. If it's a reload (same session), restore the unlocks
      const saved = localStorage.getItem("unlockedVideos");
      if (saved) setUnlockedVideos(new Set(JSON.parse(saved)));
    }

    loadVideos();
  }, []);

  /* =====================
     State Persistence (within current session)
  ===================== */
  useEffect(() => {
    if (unlockedVideos.size > 0) {
      localStorage.setItem("unlockedVideos", JSON.stringify([...unlockedVideos]));
    }
  }, [unlockedVideos]);

  const loadVideos = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`https://videos.naijahomemade.com/api/videos?page=${page}&limit=12`);
      const data = await res.json();
      if (data?.videos?.length) {
        setVideos(prev => [...prev, ...data.videos]);
        setPage(p => p + 1);
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
      // Immediate trigger for iOS
      openRewardedAd();

      // Optimistic unlock for Android persistence
      const nextSet = new Set(unlockedVideos);
      nextSet.add(videoKey);
      setUnlockedVideos(nextSet);
      localStorage.setItem("unlockedVideos", JSON.stringify([...nextSet]));

      await adReturnWatcher();
      playVideo(video);
    } catch (err) {
      console.warn("Ad skip/error:", err);
      playVideo(video); // Failsafe
    }
  };

  const playVideo = async (video) => {
    try {
      const res = await fetch(
        `https://videos.naijahomemade.com/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`
      );
      const data = await res.json();
      setActiveVideo({ ...video, video_url: data.video_url });
    } catch (e) {
      alert("Error fetching video link.");
    }
  };

  return (
    <div style={{ background: "#1c1c1e", minHeight: "100vh", padding: 8 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2 }}>
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

      {!loading && (
        <div style={{ textAlign: "center", marginTop: 16, padding: "0 10px" }}>
          <button
            onClick={loadVideos}
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              gap: 12,
              padding: "12px 16px",
              borderRadius: 0,
              border: "none",
              background: "transparent",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            <div style={{ flex: 1, height: 1, background: "currentColor", opacity: 0.2 }} />
            <span style={{ fontSize: 11, fontWeight: "900", letterSpacing: 2 }}>VIEW MORE</span>
            <div style={{ flex: 1, height: 1, background: "currentColor", opacity: 0.2 }} />
          </button>
        </div>
      )}

      {activeVideo && (
        <FullscreenPlayer video={activeVideo} onClose={() => setActiveVideo(null)} />
      )}
    </div>
  );
}