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

  useEffect(() => {
    expandApp();
    loadVideos();
  }, []);

  /* =====================
     Load videos
  ===================== */
  const loadVideos = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch(
        `https://videos.naijahomemade.com/api/videos?page=${page}&limit=12`
      );
      const data = await res.json();

      if (data?.videos?.length) {
        setVideos(prev => [...prev, ...data.videos]);
        setPage(p => p + 1);
      }
    } catch (err) {
      console.error("Failed to load videos", err);
    } finally {
      setLoading(false);
    }
  };

  /* =====================
     Fetch signed playable URL
  ===================== */
  const fetchPlayableUrl = async (video) => {
    const res = await fetch(
      `https://videos.naijahomemade.com/api/video` +
        `?chat_id=${video.chat_id}` +
        `&message_id=${video.message_id}`
    );

    if (!res.ok) throw new Error("Access denied");

    const data = await res.json();
    if (!data.video_url) throw new Error("Missing video_url");

    return data.video_url;
  };

  /* =====================
     Open video (ad → signed URL → play)
  ===================== */
  const handleOpenVideo = async (video) => {
    try {
      // 1️⃣ Must be click-bound
      openRewardedAd();

      // 2️⃣ Wait until user returns
      await adReturnWatcher();

      // 3️⃣ Fetch fresh signed URL
      const playableUrl = await fetchPlayableUrl(video);

      // 4️⃣ Play
      setActiveVideo({
        ...video,
        video_url: playableUrl,
      });
    } catch (err) {
      console.error("Playback error:", err);
      alert("You must watch the ad to play this video.");
    }
  };

  /* =====================
     Render
  ===================== */
  return (
    <div
      style={{
        background: "#1c1c1e",
        minHeight: "100vh",
        padding: 8,
      }}
    >
      {/* VIDEO GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
        }}
      >
        {videos.map(video => (
          <VideoCard
            key={`${video.chat_id}:${video.message_id}`}
            video={video}
            locked={true} // UI only
            onOpen={() => handleOpenVideo(video)}
          />
        ))}
      </div>

      {/* LOAD MORE */}
      {!loading && (
        <div style={{ textAlign: "center", marginTop: 16, padding: "0 10px" }}>
          <button
            onClick={loadVideos}
            style={{
              display: "flex",
              alignItems: "center",
              width: "100%",
              gap: 12,
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "transparent",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            <div style={{ flex: 1, height: 1, background: "currentColor", opacity: 0.3 }} />
            <span style={{ fontSize: 12, fontWeight: "bold", letterSpacing: 1 }}>
              VIEW MORE
            </span>
            <div style={{ flex: 1, height: 1, background: "currentColor", opacity: 0.3 }} />
          </button>
        </div>
      )}

      {/* FULLSCREEN PLAYER */}
      {activeVideo && (
        <FullscreenPlayer
          video={activeVideo}
          onClose={() => setActiveVideo(null)}
        />
      )}
    </div>
  );
}
