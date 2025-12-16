import { useEffect, useState } from "react";
import VideoCard from "../components/VideoCard";

export default function Home() {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("https://telegram-video-backend.onrender.com/videos?page=1&limit=10")
      .then(res => res.json())
      .then(data => {
        setVideos(data.videos); // ✅ important
        setLoading(false);
      });
  }, []);

  if (loading) return <p>Loading...</p>;

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Videos</h1>

      <div className="grid gap-4">
        {videos.map(video => (
          <VideoCard
            key={`${video.chat_id}_${video.message_id}`}
            video={video}
          />
        ))}
      </div>
    </div>
  );
}
