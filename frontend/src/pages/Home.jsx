import React, { useEffect, useState } from "react";
import VideoCard from "../components/VideoCard";
import FullscreenPlayer from "../components/FullscreenPlayer";
import { expandApp } from "../utils/telegram";
import { useRewardedAd } from "../hooks/useRewardedAd";

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);

  // Telegram user ID (used for ymid tracking)
  const telegramUserId =
    window.Telegram?.WebApp?.initDataUnsafe?.user?.id || "guest";

  // Rewarded Ad hook
  const { ready: adReady, showAd } = useRewardedAd(
    `home:${telegramUserId}`
  );

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

  // 🔐 Ad-gated open
  const handleOpenVideo = async (video) => {
    // If ad not ready, allow fallback (or block if you prefer)
    if (!adReady) {
      setActiveVideo(video);
      return;
    }

    try {
      await showAd(video.message_id);
      setActiveVideo(video);
    } catch {
      alert("Ad unavailable. Please try again.");
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
      {/* GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8,
        }}
      >
        {videos.map((video) => (
          <VideoCard
            key={`${video.chat_id}-${video.message_id}`}
            video={video}
            onOpen={handleOpenVideo}
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
