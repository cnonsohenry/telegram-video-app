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
     UNLOCK STATE (localStorage for Android)
  ===================== */
  const [unlockedVideos, setUnlockedVideos] = useState(() => {
    try {
      // 🟢 Using localStorage instead of sessionStorage
      const saved = localStorage.getItem("unlockedVideos");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

  /* =====================
     Persist unlocks immediately
  ===================== */
  useEffect(() => {
    localStorage.setItem(
      "unlockedVideos",
      JSON.stringify([...unlockedVideos])
    );
  }, [unlockedVideos]);

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
        setVideos(prev => [...prev, ...data.videos]);
        setPage(p => p + 1);
      }
    } catch (err) {
      console.error("Failed to load videos", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlayableUrl = async (video) => {
    const res = await fetch(
      `https://videos.naijahomemade.com/api/video` +
        `?chat_id=${video.chat_id}` +
        `&message_id=${video.message_id}`
    );
    if (!res.ok) throw new Error("Failed to fetch video");
    const data = await res.json();
    return data.video_url;
  };

  /* =====================
     Optimized handleOpenVideo
  ===================== */
  const handleOpenVideo = async (video) => {
    const videoKey = `${video.chat_id}:${video.message_id}`;

    try {
      // 🔐 If not unlocked, trigger ad flow
      if (!unlockedVideos.has(videoKey)) {
        
        // 🟢 OPTIMISTIC UPDATE: Mark as unlocked BEFORE the ad
        // This ensures that if Android reloads the app, the video stays unlocked.
        const nextSet = new Set(unlockedVideos);
        nextSet.add(videoKey);
        setUnlockedVideos(nextSet);
        
        // Immediate save to handle abrupt reloads
        localStorage.setItem("unlockedVideos", JSON.stringify([...nextSet]));

        // Show ad
        openRewardedAd();
        
        // Wait for return (this might fail on Android reloads, 
        // but the code above already secured the unlock for the next attempt)
        await adReturnWatcher();
      }

      // ▶️ Always attempt to play
      const playableUrl = await fetchPlayableUrl(video);

      setActiveVideo({
        ...video,
        video_url: playableUrl,
      });

    } catch (err) {
      console.error("Playback error:", err);
      // If adWatcher fails but video is now unlocked, user just taps again to play.
    }
  };

  return (
    <div style={{ background: "#1c1c1e", minHeight: "100vh", padding: 8 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 2,
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
              borderRadius: 0, // Sharp edges as requested
              border: "none",
              background: "transparent",
              color: "#fff",
              cursor: "pointer",
            }}
          >
            <div style={{ flex: 1, height: 1, background: "currentColor", opacity: 0.3 }} />
            <span style={{ fontSize: 12, fontWeight: "800", letterSpacing: 1 }}>
              VIEW MORE
            </span>
            <div style={{ flex: 1, height: 1, background: "currentColor", opacity: 0.3 }} />
          </button>
        </div>
      )}

      {activeVideo && (
        <FullscreenPlayer
          video={activeVideo}
          onClose={() => setActiveVideo(null)}
        />
      )}
    </div>
  );
}