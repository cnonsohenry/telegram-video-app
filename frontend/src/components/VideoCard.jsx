import React, { useEffect, useRef, useState } from "react";
import { Play } from 'lucide-react';

export default function VideoCard({ video, onOpen }) {
  const videoRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false); // Used for subtle fade-in
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting) {
          el.play().catch(() => {}); // Autoplay preview
        } else {
          el.pause();
        }
      },
      { threshold: 0.1 } // Trigger as soon as 10% is visible
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
        background: "#111", // Slightly lighter black for "skeleton" feel
        overflow: "hidden",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent"
      }}
    >
      {/* 🟢 The Thumbnail (Poster) */}
      <img 
        src={video.thumbnail_url} 
        alt=""
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          position: "absolute",
          inset: 0,
          zIndex: 1,
          opacity: isHovered ? 0 : 1, // Fade out when video starts
          transition: "opacity 0.4s ease-in-out"
        }}
      />

      {/* 🟢 The Video Preview */}
      {isVisible && (
        <video
          ref={videoRef}
          src={video.video_url}
          muted
          loop
          playsInline
          disablePictureInPicture
          onPlaying={() => setIsHovered(true)} // Only hide thumbnail once video actually plays
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            position: "absolute",
            inset: 0,
            zIndex: 0
          }}
        />
      )}

      {/* 👁 View count (bottom-left) */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          zIndex: 2, // Above video and thumbnail
          background: "linear-gradient(to top, rgba(0,0,0,0.6), transparent)",
          color: "#fff",
          fontSize: "11px",
          fontWeight: "700",                
          padding: "8px 6px 4px",
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 4,
          pointerEvents: "none",
        }}
      >
        <Play size={12} strokeWidth={4} fill="#fff" /> 
        <span style={{ textShadow: "0px 1px 2px rgba(0,0,0,0.8)" }}>
          {video.views ? video.views.toLocaleString() : 0}
        </span>
      </div>
    </div>
  );
}