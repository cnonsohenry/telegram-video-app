import React, { useEffect, useState } from "react";
import VideoCard from "../components/VideoCard";
import FullscreenPlayer from "../components/FullscreenPlayer";
import { expandApp } from "../utils/telegram";
import { showRewardedAdDirect } from "../utils/rewardedAd";

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);

  useEffect(() => {
    expandApp();
    loadVideos();
  }, []);

  const loadVideos = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch(
        `https://videos.naijahomemade.com/api/videos?page=${page}&limit=12`
      );
      const data = await res.json();

      if (data?.videos?.length) {
        setVideos((prev) => [...prev, ...data.videos]);
        setPage((p) => p + 1);
      }
    } catch (err) {
      console.error("Failed to load videos", err);
    } finally {
      setLoading(false);
    }
  };

  // 🔐 SECURE AD-GATED OPEN
  const handleOpenVideo = async (video) => {
    try {
      // 1️⃣ Show ad (direct link for now)
      await showRewardedAdDirect();

      // 2️⃣ Request play token from backend
      const res = await fetch("/api/ad/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: video.chat_id,
          message_id: video.message_id,
        }),
      });

      const data = await res.json();
      if (!data.token) throw new Error("No token");

      // 3️⃣ Open fullscreen using protected URL
      setActiveVideo({
        ...video,
        video_url: `/api/video?token=${data.token}`,
      });
    } catch (err) {
      alert("You must watch the ad to play this video.");
    }
  };

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
        {videos.map((video) => (
          <VideoCard
            key={`${video.chat_id}:${video.message_id}`}
            video={video}
            locked
            onOpen={() => handleOpenVideo(video)}
          />
        ))}
      </div>

      {/* LOAD MORE */}
      {!loading && (
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <button
            onClick={loadVideos}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              border: "none",
              background: "#2c2c2e",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            Load more
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
