import React, { useRef, useState } from "react";

export default function VideoCard({ video }) {
  if (!video) return null;

  const videoRef = useRef(null);
  const [ready, setReady] = useState(false);

  const handlePlay = () => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  };

  return (
    <div
      style={{
        width: "100%",
        borderRadius: 12,
        overflow: "hidden",
        background: "#000",
        position: "relative",
      }}
      onClick={handlePlay} // 👈 ensures user gesture for Telegram
    >
      <video
        ref={videoRef}
        src={video.video_url}
        poster={video.thumbnail_url || undefined} // 👈 SAFE
        controls
        muted
        playsInline
        preload="metadata"
        onLoadedMetadata={() => setReady(true)}
        style={{
          width: "100%",
          display: "block",
        }}
      />

      {/* ▶ Play overlay (only before metadata loads) */}
      {!ready && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
            background:
              "linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.4))",
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: "50%",
              background: "rgba(0,0,0,0.6)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 0,
                height: 0,
                borderLeft: "14px solid white",
                borderTop: "8px solid transparent",
                borderBottom: "8px solid transparent",
                marginLeft: 4,
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
