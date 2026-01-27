import React, { useEffect, useRef } from "react";
// Import the Eye icon from lucide-react
import { Eye } from "lucide-react";
import { Play } from 'lucide-react';

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
        borderRadius: 0,
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

      {/* ▶ play icon overlay 
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
         <Play /> 
        </div>
      </div>
      */}

      {/* 👁 View count (bottom-left) */}
<div
  style={{
    position: "absolute",
    bottom: 0,
    left: 0,
    background: "none",
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",                
    padding: "3px 6px",
    borderRadius: 0,                  
    display: "flex",
    alignItems: "center",
    gap: 4,
    pointerEvents: "none",
    textTransform: "uppercase",       
  }}
>
  {/* Play icon with increased stroke for a bolder look */}
  <Play size={14} strokeWidth={3} fill="none" /> 
  
  <span>
    {video.views ? video.views.toLocaleString() : 0}
  </span>
</div>
    </div>
  );
}
