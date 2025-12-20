import React, { useEffect, useState } from "react";
import VideoCard from "../components/VideoCard";
import { expandApp, hapticLight } from "../utils/telegram";

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  // Initial load
  useEffect(() => {
    expandApp();
    loadVideos(1);
  }, []);

  const loadVideos = async (pageToLoad) => {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch(
        `https://telegram-video-backend.onrender.com/videos?page=${pageToLoad}&limit=10`
      );

      const data = await res.json();

      setVideos((prev) => [...prev, ...data.videos]);
      setPage(pageToLoad + 1);
      hapticLight();
    } catch (err) {
      console.error("Failed to load videos", err);
    } finally {
      setLoading(false);
    }
  };

  // Infinite scroll
  useEffect(() => {
    const onScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 200
      ) {
        loadVideos(page);
      }
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [page, loading]);

  return (
    <div style={{ padding: 12 }}>
      {videos.map((video) => (
        <div
          key={`${video.chat_id}-${video.message_id}`}
          style={{ marginBottom: 16 }}
        >
          <VideoCard
            src={video.url}
            thumbnail={video.thumbnail_url}
          />

          <div style={{ fontSize: 12, opacity: 0.6 }}>
            {new Date(video.created_at).toLocaleString()}
          </div>
        </div>
      ))}

      {loading && (
        <div style={{ textAlign: "center", opacity: 0.6 }}>
          Loading…
        </div>
      )}
    </div>
  );
}
