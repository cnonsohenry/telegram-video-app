import React, { useEffect, useRef, useState } from "react";
import { Play } from 'lucide-react';

export default function VideoCard({ video, onOpen, layoutType }) {
  const videoRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const isKnacks = layoutType === 1; // TikTok Explore Vibe
  const isLarge = layoutType === 2; // Baddies
  const isCompact = layoutType === 3; // Trends

  // 🟢 Intersection Observer for Autoplay
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // 🟢 Play/Pause Logic
  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    
    if (isVisible) {
      el.play().catch(() => {});
    } else {
      el.pause();
      setIsHovered(false); // Reset thumbnail overlay when scrolled away
    }
  }, [isVisible]);

  return (
    <div
      onClick={() => onOpen(video)}
      style={{
        display: "flex",
        flexDirection: "column",
        background: isKnacks ? "#1c1c1e" : "transparent",
        borderRadius: (isLarge || isKnacks) ? "8px" : "0px",
        overflow: "hidden",
        cursor: "pointer",
        WebkitTapHighlightColor: "transparent",
        transition: "transform 0.1s active"
      }}
    >
      {/* THUMBNAIL / VIDEO CONTAINER */}
      <div style={{ 
        position: "relative", 
        width: "100%", 
        aspectRatio: (isKnacks || isLarge) ? "9 / 14" : "9 / 16",
        background: "#111" 
      }}>
        <img 
          src={video.thumbnail_url} 
          alt=""
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            position: "absolute", inset: 0, zIndex: 1,
            opacity: isHovered ? 0 : 1, transition: "opacity 0.4s ease-in-out"
          }}
        />
        <video
          ref={videoRef}
          src={video.video_url}
          muted loop playsInline
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

        {/* View Count Overlay */}
        <div style={{
          position: "absolute", bottom: 8, left: 8, zIndex: 2,
          display: "flex", alignItems: "center", gap: 4, color: "#fff",
          fontSize: "10px", fontWeight: "bold", textShadow: "0 1px 4px rgba(0,0,0,0.8)"
        }}>
          <Play size={10} fill="#fff" />
          {video.views?.toLocaleString() || 0}
        </div>
      </div>

      {/* 🟢 TIKTOK EXPLORE CAPTION SECTION */}
      {isKnacks && (
        <div style={{ padding: "10px 8px", background: "#1c1c1e" }}>
          <p style={{
            margin: 0,
            fontSize: "12px",
            color: "#eee",
            fontWeight: "400",
            lineHeight: "1.4",
            display: "-webkit-box",
            WebkitLineClamp: "2",
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
            minHeight: "34px" // Keeps grid aligned if captions are 1 vs 2 lines
          }}>
            {video.caption || "No caption provided..."}
          </p>
          
          <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ position: "relative", width: 18, height: 18 }}>
              <img 
                src={`https://videos.naijahomemade.com/api/avatar?user_id=${video.uploader_id}`}
                alt=""
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
                style={{ 
                  width: "100%", 
                  height: "100%", 
                  borderRadius: "50%", 
                  objectFit: "cover",
                  background: "#333" 
                }} 
              />
              <div style={{ 
                display: 'none', 
                width: "100%", 
                height: "100%", 
                borderRadius: "50%", 
                background: "linear-gradient(45deg, #ff0050, #00f2ea)" 
              }} />
            </div>

            <span style={{ fontSize: "10px", color: "#8e8e8e", fontWeight: "600" }}>
              {String(video.uploader_id) === "1881815190" ? "Chief" : "Admin"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}