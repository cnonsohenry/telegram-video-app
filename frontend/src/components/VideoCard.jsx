import React, { useState } from "react";

export default function VideoCard({ video }) {
  const [play, setPlay] = useState(false);

  if (!video) return null;

  return (
    <div
      style={{
        width: "100%",
        background: "#000",
        borderRadius: 12,
        overflow: "hidden",
        aspectRatio: "16 / 9", // 🔒 CRITICAL
        position: "relative",
      }}
    >
      {!play ? (
        <img
          src={video.thumbnail_url}
          alt="video thumbnail"
          onClick={() => setPlay(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            cursor: "pointer",
          }}
        />
      ) : (
        <video
          src={video.video_url}
          controls
          autoPlay
          playsInline
          muted
          preload="none"
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
          }}
        />
      )}
    </div>
  );
}
