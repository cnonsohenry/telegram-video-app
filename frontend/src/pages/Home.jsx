import React, { useEffect, useState } from "react";
import VideoCard from "../components/VideoCard";
import FullscreenPlayer from "../components/FullscreenPlayer";
import { expandApp } from "../utils/telegram";

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

    const res = await fetch(
      `https://telegram-video-backend.onrender.com/videos?page=${page}&limit=10`
    );
    const data = await res.json();

    if (data?.videos?.length) {
      setVideos((prev) => [...prev, ...data.videos]);
      setPage((p) => p + 1);
    }

    setLoading(false);
  };

  return (
    <div
      style={{
        background: "#1c1c1e",
        minHeight: "100vh",
        padding: 8,
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, 1fr)",
          gap: 8,
        }}
      >
        {videos.map((video) => (
          <VideoCard
            key={`${video.chat_id}-${video.message_id}`}
            video={video}
            onOpen={setActiveVideo}
          />
        ))}
      </div>

      {activeVideo && (
        <FullscreenPlayer
          video={activeVideo}
          onClose={() => setActiveVideo(null)}
        />
      )}
    </div>
  );
}
