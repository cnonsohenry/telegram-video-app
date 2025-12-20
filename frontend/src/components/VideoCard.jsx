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
  controls                  // Add this: forces reliable loading/playback in Telegram WebView
  controlsList="nodownload" // Optional: hides download button if unwanted
  muted
  playsInline
  preload="metadata"        // Or try "auto" if you want more aggressive preloading
  poster={video.thumbnail_url || undefined}  // Add poster for better reliability (fallback to thumbnail)
  style={{
    width: "100%",
    display: "block",
    background: "#000",     // Ensures no flash of black
  }}
  onPlay={(e) => {
    const img = e.currentTarget.previousSibling;
    if (img) img.style.display = "none";

    // Optional: Hide controls after playback starts (for cleaner look)
    e.currentTarget.controls = false;
  }}
  onClick={(e) => {
    // If you want to keep thumbnail click behavior
    const v = videoRef.current;
    if (v) {
      v.muted = false;
      v.play().catch(() => {});
    }
  }}
/>
    </div>
  );
}
