import React, { useRef } from "react";

export default function VideoCard({ video }) {
  const videoRef = useRef(null);

  if (!video) return null;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        borderRadius: 12,
        overflow: "hidden",
        background: "#000",
      }}
    >
      {/* Thumbnail overlay */}
      <img
        src={video.thumbnail_url || ""}
        onError={(e) => (e.currentTarget.style.display = "none")}
        alt=""
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 2,
          cursor: "pointer",
        }}
        onClick={() => {
          const v = videoRef.current;
          if (!v) return;
          v.muted = false;
          v.play().catch(() => {});
        }}
      />

      {/* Video is ALWAYS mounted */}
      <video
        ref={videoRef}
        src={video.video_url}
        controls
        muted
        playsInline
        preload="metadata"
        style={{
          width: "100%",
          display: "block",
        }}
        onPlay={(e) => {
          // hide thumbnail when video starts
          const img = e.currentTarget.previousSibling;
          if (img) img.style.display = "none";
        }}
      />
    </div>
  );
}
