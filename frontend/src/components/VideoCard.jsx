import React, { useEffect, useRef, useState } from "react";
import { Play } from 'lucide-react';

export default function VideoCard({ video, onOpen, layoutType }) {
  const videoRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  // Layout Logic: 0: Hotties, 1: Knacks, 2: Baddies, 3: Trends
  const isKnacks = layoutType === 1;
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
        borderRadius: isLarge ? "12px" : "0px",
        transform: isLarge ? "scale(0.96)" : "scale(1)", 
        transition: "transform 0.2s ease"
      }}
    >
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

      {/* 🟢 THE OVERLAY LAYER */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          zIndex: 2,
          // Stronger gradient for Knacks to ensure caption readability
          background: isKnacks 
            ? "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 40%, transparent 100%)" 
            : "linear-gradient(to top, rgba(0,0,0,0.8) 0%, transparent 100%)",
          color: "#fff",
          width: "100%",
          padding: isLarge ? "12px 10px 8px" : isCompact ? "6px 4px 2px" : "8px 6px 6px",
          display: "flex",
          flexDirection: "column",
          gap: 2,
          pointerEvents: "none",
        }}
      >
        {/* 🟢 Caption Display (Specific to Knacks) */}
        {isKnacks && video.caption && (
          <span style={{
            fontSize: "10px",
            fontWeight: "500",
            lineHeight: "1.2",
            marginBottom: "4px",
            display: "-webkit-box",
            WebkitLineClamp: "2", // Limit to 2 lines
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            textShadow: "0px 1px 3px rgba(0,0,0,1)"
          }}>
            {video.caption}
          </span>
        )}

        {/* View Count Row */}
        <div style={{ display: "flex", alignItems: "center", gap: isCompact ? 2 : 4 }}>
          <Play 
            size={isLarge ? 14 : isCompact ? 10 : 12} 
            strokeWidth={4} 
            fill="#fff" 
          /> 
          <span style={{ 
            fontSize: isLarge ? "13px" : isCompact ? "9px" : "11px",
            fontWeight: "700",
            textShadow: "0px 1px 2px rgba(0,0,0,0.8)" 
          }}>
            {video.views ? video.views.toLocaleString() : 0}
          </span>
        </div>
      </div>
    </div>
  );
}