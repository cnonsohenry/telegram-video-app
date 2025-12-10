import { useEffect, useState } from "react";

export default function VideoPlayer({ messageId, channelId }) {
  const [url, setUrl] = useState(null);

  useEffect(() => {
    async function fetchVideo() {
      const res = await fetch(
        `https://telegram-video-backend.onrender.com/video?message_id=${messageId}&chat_id=${channelId}`
      );
      const data = await res.json();
      setUrl(data.url);
    }

    fetchVideo();
  }, [messageId, channelId]);

  if (!url) return <p>Loading video...</p>;

  return (
    <video 
      controls 
      style={{ width: "100%", borderRadius: 12 }}
      src={url}
    />
  );
}
