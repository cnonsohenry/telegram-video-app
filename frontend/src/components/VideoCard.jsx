import React from "react";

export default function VideoCard({ video }) {
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
      <video
        src={video.video_url}
        poster={video.thumbnail_url || undefined}
        controls
        muted
        playsInline
        preload="metadata"
        style={{
          width: "100%",
          display: "block",
        }}
      />
    </div>
  );
}
