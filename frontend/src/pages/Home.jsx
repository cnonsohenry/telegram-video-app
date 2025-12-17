import React, { useEffect, useState } from "react";
import VideoPlayer from "../components/VideoPlayer";

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVideos = async () => {
      try {
        const res = await fetch(
          "https://telegram-video-backend.onrender.com/videos?page=1&limit=10"
        );

        const data = await res.json();
        setVideos(data.videos || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchVideos();
  }, []);

  if (loading) return <div>Loading videos…</div>;
  if (!videos.length) return <div>No videos found</div>;

  return (
    <div style={{ padding: "16px" }}>
      {videos.map((video) => (
        <div key={video.message_id} style={{ marginBottom: "16px" }}>
          <VideoPlayer src={video.url} />
        </div>
      ))}
    </div>
  );
}
