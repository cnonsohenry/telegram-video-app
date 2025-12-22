import React, { useState } from "react";

export default function VideoCard({ video }) {
  const [play, setPlay] = useState(false);

  if (!video) return null;

  return (
    <div
      style={{
        width: "100%",
        borderRadius: 12,
        overflow: "hidden",
        background: "#000",
      }}
    >
      {!play ? (
        <img
          src={video.thumbnail_url}
          alt="video thumbnail"
          style={{ width: "100%", display: "block", cursor: "pointer" }}
          onClick={() => setPlay(true)}
        />
      ) : (
        <video
          src={video.video_url}
          controls
          autoPlay
          playsInline
          muted
          preload="none"   // 🔥 IMPORTANT
          style={{ width: "100%", display: "block" }}
        />
      )}
    </div>
  );
}
