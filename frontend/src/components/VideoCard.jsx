import React, { useRef, useEffect } from "react";

export default function VideoCard({ video }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null);

  if (!video) return null;

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // Attempt muted autoplay (often works in WebView if playsInline + muted)
    v.play().catch(() => {
      // Silent fail — user will tap to play
    });
  }, [video.video_url]);

  const handlePlay = (e) => {
    const img = containerRef.current.querySelector("img");
    if (img) img.style.display = "none";

    // Hide controls after playback starts (keeps UI clean)
    e.currentTarget.controls = false;
  };

  const handleContainerClick = () => {
    const v = videoRef.current;
    if (!v) return;

    if (v.paused) {
      v.muted = false; // Unmute on user gesture
      v.play().catch((err) => console.error("Play failed:", err));
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        borderRadius: 12,
        overflow: "hidden",
        background: "#000",
        cursor: "pointer", // Indicate tappable
      }}
      onClick={handleContainerClick}
    >
      {/* Thumbnail overlay (hides on play) */}
      <img
        src={video.thumbnail_url || ""}
        onError={(e) => (e.currentTarget.style.display = "none")}
        alt="Thumbnail"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          zIndex: 2,
        }}
      />

      {/* Video element */}
      <video
        ref={videoRef}
        src={video.video_url}
        controls                  // Essential for reliable playback in Telegram WebView
        muted                     // Start muted for potential autoplay
        playsInline               // Required for inline playback in WebView
        preload="metadata"        // Or try "auto" for more aggressive loading
        poster={video.thumbnail_url || undefined}  // Prevents initial black screen
        style={{
          width: "100%",
          height: "100%",
          display: "block",
          background: "#000",
        }}
        onPlay={handlePlay}
        onError={(e) => console.error("Video error:", e)}
      />
    </div>
  );
}