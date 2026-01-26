import React, { useEffect, useState, useRef } from "react";
import VideoCard from "../components/VideoCard";
import FullscreenPlayer from "../components/FullscreenPlayer";
import { expandApp } from "../utils/telegram";
import { openRewardedAd } from "../utils/rewardedAd";
import { adReturnWatcher } from "../utils/adReturnWatcher";
import { Minus } from 'lucide-react';

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
     Fetch playable URL (NO redirect)
  ===================== */
  const fetchPlayableUrl = async (video) => {
    const res = await fetch(
      `https://videos.naijahomemade.com/api/video` +
        `?chat_id=${video.chat_id}` +
        `&message_id=${video.message_id}` +
        `&session_id=${sessionIdRef.current}`
    );

    if (!res.ok) throw new Error("Video access denied");

    const data = await res.json();
    if (!data.video_url) throw new Error("Missing video_url");

    return data.video_url;
  };

  /* =====================
     Open video (ad gated)
  ===================== */
  const handleOpenVideo = async (video) => {
  const videoKey = `${video.chat_id}:${video.message_id}`;

  try {
    // 🔐 First tap → unlock only
    if (!unlockedVideos.has(videoKey)) {
      openRewardedAd(); // click-bound

      await adReturnWatcher(); // just for confirmation

      const confirm = await fetch(
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

      if (!confirm.ok) throw new Error("Ad confirm failed");

      setUnlockedVideos(prev => {
        const next = new Set(prev);
        next.add(videoKey);
        return next;
      });

      // ❗ STOP HERE
      // Do NOT play yet
      return;
    }

    // ▶️ Second tap → play (gesture-safe)
    const playableUrl = await fetchPlayableUrl(video);

    setActiveVideo({
      ...video,
      video_url: playableUrl
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
  <div style={{ textAlign: "center", marginTop: 16, padding: "0 10px" }}>
    <button
      onClick={loadVideos}
      style={{
        display: "flex",       // Puts items on the same line
        alignItems: "center",  // Centers items vertically
        width: "100%",         // Extends button to ends of container
        gap: 12,               // Space between lines and text
        padding: "8px 16px",
        borderRadius: 8,
        border: "none",
        background: "transparent", // Optional: looks better for a full-width divider
        color: "#fff",
        cursor: "pointer"
      }}
    >
      {/* Left Line */}
      <div style={{ flex: 1, height: 1, background: "currentColor", opacity: 0.3 }} />
      
      <span style={{ fontSize: 12, fontWeight: "bold", letterSpacing: 1 }}>
        VIEW MORE
      </span>

      {/* Right Line */}
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
