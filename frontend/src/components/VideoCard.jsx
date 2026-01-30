import React, { useEffect, useRef, useState } from "react";
import { Play } from 'lucide-react';

export default function VideoCard({ video, onOpen, layoutType }) {
  const videoRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const isKnacks = layoutType === 1;
  const isLarge = layoutType === 2;

  // 🟢 Deterministic heights to keep Android and iPhone consistent
  const cardHeight = isKnacks 
    ? (parseInt(video.message_id) % 2 === 0 ? "260px" : "310px") 
    : "auto";

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setIsVisible(entry.isIntersecting), { threshold: 0.1 });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !isVisible) return;
    el.play().catch(() => {});
    return () => { el.pause(); setIsHovered(false); };
  }, [isVisible]);

  return (
    <div
      onClick={() => onOpen(video)}
      style={{
        display: "flex",
        flexDirection: "column",
        background: isKnacks ? "#1c1c1e" : "transparent",
        borderRadius: (isKnacks || isLarge) ? "12px" : "0px",
        overflow: "hidden",
        width: "100%",
        height: "fit-content", // Essential for iPhone
      }}
    >
      {/* MEDIA CONTAINER */}
      <div style={{ 
        position: "relative", 
        width: "100%", 
        height: isKnacks ? cardHeight : "auto",
        aspectRatio: isKnacks ? "unset" : (isLarge ? "9/14" : "9/16"),
        background: "#111",
        overflow: "hidden"
      }}>
        <img 
          src={video.thumbnail_url} 
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            position: "absolute", inset: 0, zIndex: 2, // Layered above video initially
            opacity: isHovered ? 0 : 1, transition: "opacity 0.4s"
          }}
        />
        <video
          ref={videoRef}
          src={video.video_url}
          muted loop playsInline
          onPlaying={() => setIsHovered(true)}
          style={{ 
            width: "100%", height: "100%", objectFit: "cover",
            position: "absolute", inset: 0, zIndex: 1 
          }}
        />
        
        {/* 🟢 VIEW COUNT OVERLAY - Boosted Z-Index */}
        <div style={{
          position: "absolute", 
          bottom: 10, 
          left: 10, 
          zIndex: 10, // Must be higher than the image and video
          display: "flex", 
          alignItems: "center", 
          gap: 4, 
          color: "#fff",
          fontSize: "11px", 
          fontWeight: "800", 
          textShadow: "0px 1px 8px rgba(0,0,0,1)" // Added heavy shadow for visibility
        }}>
          <Play size={12} fill="#fff" strokeWidth={0} />
          <span>{Number(video.views || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* CAPTION SECTION */}
      {isKnacks && (
        <div style={{ padding: "12px 10px", background: "inherit" }}>
          <p style={{
            margin: 0, fontSize: "13px", color: "#fff",
            lineHeight: "1.4", display: "-webkit-box",
            WebkitLineClamp: "2", WebkitBoxOrient: "vertical",
            overflow: "hidden", minHeight: "36px"
          }}>
            {video.caption || "No caption provided..."}
          </p>
          <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "8px" }}>
            <img 
              src={`https://videos.naijahomemade.com/api/avatar?user_id=${video.uploader_id}`}
              onError={(e) => { e.target.style.opacity = 0; }}
              style={{ width: 16, height: 16, borderRadius: "50%", objectFit: "cover", background: "#333" }}
            />
            <span style={{ fontSize: "11px", color: "#8e8e8e", fontWeight: "600" }}>
              {String(video.uploader_id) === "1881815190" ? "Chief" : "Admin"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}