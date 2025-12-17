import React, { useEffect, useState } from "react";

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await fetch(
          "https://telegram-video-backend.onrender.com/videos?page=1&limit=10"
        );

        if (!res.ok) {
          throw new Error(`HTTP error ${res.status}`);
        }

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

  if (loading) return <div>Loading videos… (server waking up)</div>;
  if (!videos.length) return <div>No videos found</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}>
      {videos.map((video) => (
        <div key={video.message_id}>
          <video
            src={video.url}
            controls
            playsInline
            webkitPlaysInline
            preload="metadata"
            style={{
              width: "100%",
              borderRadius: "8px",
              backgroundColor: "#000",
            }}
          />
          <p style={{ fontSize: "12px", color: "#555", marginTop: "4px" }}>
            Uploaded:{" "}
            {video.created_at
              ? new Date(video.created_at).toLocaleString()
              : "Unknown"}
          </p>
        </div>
      ))}
    </div>
  );
}
