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
     STORAGE LOGIC (Android Persistence)
  ===================== */
  const [unlockedVideos, setUnlockedVideos] = useState(() => {
    try {
      const saved = localStorage.getItem("unlockedVideos");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });

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
     REVISED: iOS & Android Compatible Flow
  ===================== */
  const handleOpenVideo = async (video) => {
    const videoKey = `${video.chat_id}:${video.message_id}`;

    // 1. If already unlocked, play immediately
    if (unlockedVideos.has(videoKey)) {
      try {
        const playableUrl = await fetchPlayableUrl(video);
        setActiveVideo({ ...video, video_url: playableUrl });
        return;
      } catch (e) {
        alert("Playback error");
        return;
      }
    }

    // 2. If NOT unlocked, trigger AD FLOW
    try {
      // 🟢 TRIGGER AD IMMEDIATELY (Crucial for iOS Gesture)
      // We do this BEFORE state updates to ensure Safari doesn't block the popup.
      openRewardedAd();

      // 🟢 SAVE TO STORAGE IMMEDIATELY (Crucial for Android Reload)
      // We use a local variable to update both state and localStorage fast.
      const nextSet = new Set(unlockedVideos);
      nextSet.add(videoKey);
      
      // Update React State
      setUnlockedVideos(nextSet);
      
      // Update Disk Storage (survives Android reload)
      localStorage.setItem("unlockedVideos", JSON.stringify([...nextSet]));

      // 3. Wait for ad to finish
      await adReturnWatcher();

      // 4. Fetch and play
      const playableUrl = await fetchPlayableUrl(video);
      setActiveVideo({ ...video, video_url: playableUrl });

    } catch (err) {
      console.warn("Ad skip or error detected:", err);
      // Failsafe: if ad fails but was marked as unlocked, play anyway
      const playableUrl = await fetchPlayableUrl(video);
      setActiveVideo({ ...video, video_url: playableUrl });
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
              borderRadius: 0,
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