import React, { useEffect, useRef } from "react";

export default function VideoCard({ video, onOpen }) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) el.pause();
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      onClick={() => onOpen(video)}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "9 / 16",
        background: "#000",
        borderRadius: 12,
        overflow: "hidden",
        cursor: "pointer",
      }}
    >
      <video
        ref={videoRef}
        src={video.video_url}
        poster={video.thumbnail_url}
        muted
        preload="metadata"
        playsInline
        disablePictureInPicture
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
        }}
      />

      {/* ▶ play icon overlay */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: 48,
            height: 48,
            borderRadius: "50%",
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            fontSize: 20,
          }}
        >
          ▶
        </div>
      </div>

      {/* 👁 View count (bottom-left) */}
      <div
        style={{
          position: "absolute",
          bottom: 6,
          left: 6,
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          fontSize: 12,
          padding: "3px 6px",
          borderRadius: 6,
          display: "flex",
          alignItems: "center",
          gap: 4,
          pointerEvents: "none",
        }}
      >
        👁 {video.views ? video.views.toLocaleString() : 0}
      </div>
    </div>
  );
}
