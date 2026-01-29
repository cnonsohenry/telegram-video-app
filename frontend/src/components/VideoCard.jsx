import React, { useEffect, useRef, useState } from "react";
import { Play } from 'lucide-react';

export default function VideoCard({ video, onOpen, layoutType }) {
  const videoRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Layout Logic: 0: Hotties, 1: Knacks, 2: Baddies (Large), 3: Trends (Compact)
  const isLarge = layoutType === 2;
  const isCompact = layoutType === 3;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
        if (entry.isIntersecting) {
          el.play().catch(() => {});
        } else {
          el.pause();
        }
      },
      { threshold: 0.1 }
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
        background: "#111",
        overflow: "hidden",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        // 🟢 VIBE FIX: Rounded corners only for the 2-column "BADDIES" tab
        borderRadius: isLarge ? "12px" : "0px",
        // Adding a slight margin for rounded cards so they don't touch edges
        transform: isLarge ? "scale(0.96)" : "scale(1)", 
        transition: "transform 0.2s ease"
      }}
    >
      {/* Thumbnail */}
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
          opacity: isHovered ? 0 : 1,
          transition: "opacity 0.4s ease-in-out"
        }}
      />

      {/* Video Preview */}
      {isVisible && (
        <video
          ref={videoRef}
          src={video.video_url}
          muted
          loop
          playsInline
          disablePictureInPicture
          onPlaying={() => setIsHovered(true)}
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

      {/* View count Overlay */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          zIndex: 2,
          background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)",
          color: "#fff",
          fontSize: isLarge ? "13px" : isCompact ? "9px" : "11px",
          fontWeight: "700",                
          padding: isLarge ? "12px 10px 8px" : isCompact ? "6px 4px 2px" : "8px 6px 4px",
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: isCompact ? 2 : 4,
          pointerEvents: "none",
        }}
      >
        <Play 
          size={isLarge ? 14 : isCompact ? 10 : 12} 
          strokeWidth={4} 
          fill="#fff" 
        /> 
        <span style={{ textShadow: "0px 1px 2px rgba(0,0,0,0.8)" }}>
          {video.views ? video.views.toLocaleString() : 0}
        </span>
      </div>
    </div>
  );
}