import React, { useEffect, useState } from "react";
import VideoCard from "../components/VideoCard";
import { expandApp, hapticLight } from "../utils/telegram";

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

useEffect(() => {
  expandApp();
}, []);

useEffect(() => {
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

  return (
    <div style={{ padding: 12 }}>
      {videos.map((video) =>
        video ? (
          <div
            key={`${video.chat_id}-${video.message_id}`}
            style={{ marginBottom: 16 }}
          >
            <VideoCard video={video} />
            <div style={{ fontSize: 12, opacity: 0.6 }}>
              {video.created_at
                ? new Date(video.created_at).toLocaleString()
                : ""}
            </div>
          </div>
        ) : null
      )}

      {/* Load more button for testing */}
      {!loading && (
        <button
          onClick={loadVideos}
          style={{
            padding: "8px 16px",
            marginTop: 12,
            borderRadius: 6,
            cursor: "pointer",
          }}
        >
          Load More
        </button>
      )}
    </div>
  );
}
