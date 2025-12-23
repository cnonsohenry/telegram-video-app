import React, { useEffect, useState, useRef } from "react";
import VideoCard from "../components/VideoCard";
import { expandApp, hapticLight } from "../utils/telegram";

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const observerRef = useRef(null);

  useEffect(() => {
    expandApp();
    loadVideos();
  }, []);

  const loadVideos = async () => {
    if (loading) return;
    setLoading(true);

    try {
      const res = await fetch(
        `https://telegram-video-backend.onrender.com/videos?page=${page}&limit=10`
      );
      const data = await res.json();

      if (data?.videos?.length) {
        setVideos((prev) => [...prev, ...data.videos]);
        setPage((p) => p + 1);
        hapticLight();
      }
    } catch (e) {
      console.error("Failed to load videos:", e);
    } finally {
      setLoading(false);
    }
  };

  // 🔁 Infinite scroll observer
  useEffect(() => {
    if (!observerRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadVideos();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(observerRef.current);
    return () => observer.disconnect();
  }, [observerRef.current, loading]);

  return (
    <div
      style={{
        padding: 8,
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: 8,
        background: "#0f0f0f", // 🟦 dark grey telegram style
        minHeight: "100vh",
      }}
    >
      {videos.map((video) => (
        <VideoCard
          key={`${video.chat_id}-${video.message_id}`}
          video={video}
        />
      ))}

      <div ref={observerRef} style={{ height: 1 }} />
    </div>
  );
}

