import React, { useEffect, useState } from "react";

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch videos from backend
  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await fetch("https://telegram-video-backend.onrender.com/videos?page=1&limit=10");
        const data = await res.json();
        setVideos(data.videos || []);
      } catch (err) {
        console.error("Failed to fetch videos:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  if (loading) return <div>Loading videos...</div>;
  if (!videos.length) return <div>No videos found</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}>
      {videos.map((video) => (
        <div key={video.message_id}>
          <video
            src={video.url}
            controls
            playsInline
            webkit-playsinline="true"
            style={{ width: "100%", borderRadius: "8px", backgroundColor: "#000" }}
          />
          <p style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>
            Uploaded: {new Date(video.created_at).toLocaleString()}
          </p>
        </div>
      ))}
    </div>
  );
}
