import React, { useEffect, useState, useRef } from "react";
import VideoCard from "../components/VideoCard";
import FullscreenPlayer from "../components/FullscreenPlayer";
import { expandApp } from "../utils/telegram";
import { openRewardedAd } from "../utils/rewardedAd";
import { adReturnWatcher } from "../utils/adReturnWatcher";

/* =====================
   UUID fallback (iOS safe)
===================== */
function generateSessionId() {
  return (
    Date.now().toString(36) +
    Math.random().toString(36).substring(2, 10)
  );
}

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [activeVideo, setActiveVideo] = useState(null);

  // 🔓 unlocked videos per session
  const [unlockedVideos, setUnlockedVideos] = useState(() => new Set());

  // 🔑 stable session id
  const sessionIdRef = useRef(null);
  if (!sessionIdRef.current) {
    let sid = sessionStorage.getItem("session_id");
    if (!sid) {
      sid = generateSessionId();
      sessionStorage.setItem("session_id", sid);
    }
    sessionIdRef.current = sid;
  }

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
     Open video (ad gated)
  ===================== */
  const handleOpenVideo = async (video) => {
    const videoKey = `${video.chat_id}:${video.message_id}`;

    // 🔓 already unlocked
    if (unlockedVideos.has(videoKey)) {
      setActiveVideo({
        ...video,
        video_url: buildVideoUrl(video)
      });
      return;
    }

    // 🔐 MUST be user-gesture bound
    try {
      openRewardedAd();          // ← sync, click-bound
      await adReturnWatcher();   // ← resolves when user returns
    } catch {
      alert("You must watch the ad to play this video.");
      return;
    }

    try {
      const res = await fetch(
        "https://videos.naijahomemade.com/api/ad/confirm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: video.chat_id,
            message_id: video.message_id,
            session_id: sessionIdRef.current
          })
        }
      );

      if (!res.ok) throw new Error("Ad confirm failed");

      // 🔓 unlock locally
      setUnlockedVideos(prev => {
        const next = new Set(prev);
        next.add(videoKey);
        return next;
      });

      setActiveVideo({
        ...video,
        video_url: buildVideoUrl(video)
      });
    } catch (err) {
      console.error("Unlock failed:", err);
      alert("Something went wrong. Please try again.");
    }
  };

  /* =====================
     Build video URL
  ===================== */
  const buildVideoUrl = (video) =>
    `https://videos.naijahomemade.com/api/video` +
    `?chat_id=${video.chat_id}` +
    `&message_id=${video.message_id}` +
    `&session_id=${sessionIdRef.current}`;

  /* =====================
     Render
  ===================== */
  return (
    <div
      style={{
        background: "#1c1c1e",
        minHeight: "100vh",
        padding: 8
      }}
    >
      {/* VIDEO GRID */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8
        }}
      >
        {videos.map(video => {
          const videoKey = `${video.chat_id}:${video.message_id}`;
          const unlocked = unlockedVideos.has(videoKey);

          return (
            <VideoCard
              key={videoKey}
              video={video}
              locked={!unlocked}
              onOpen={() => handleOpenVideo(video)}
            />
          );
        })}
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
              cursor: "pointer"
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
