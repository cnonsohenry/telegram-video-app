import React, { useEffect, useRef, useState } from "react";
import { Play } from 'lucide-react';

export default function VideoCard({ video, onOpen, layoutType }) {
  const videoRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const isKnacks = layoutType === 'knacks';
  const isLarge = layoutType === 'baddies';

  const cardHeight = isKnacks 
    ? (parseInt(video.message_id) % 2 === 0 ? "260px" : "310px") 
    : "auto";

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
    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    if (isVisible) {
      el.play().catch(() => {});
    } else {
      el.pause();
      setIsHovered(false);
    }
  }, [isVisible]);

  return (
    <div
      onClick={() => onOpen(video)}
      style={{
        display: "flex",
        flexDirection: "column",
        background: isKnacks ? "#1c1c1e" : "transparent",
        // 🟢 Rounded corners applied to ALL tabs for consistency
        borderRadius: "12px", 
        overflow: "hidden",
        width: "100%",
        height: "fit-content",
        cursor: "pointer",
        transition: "transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), background 0.2s"
      }}
      // 🟢 Consistent Desktop Hover: Slight lift and scale
      onMouseEnter={(e) => { 
        if (window.innerWidth > 1024) {
          e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
          if (!isKnacks) e.currentTarget.style.background = "#0a0a0a";
        }
      }}
      onMouseLeave={(e) => { 
        if (window.innerWidth > 1024) {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          if (!isKnacks) e.currentTarget.style.background = "transparent";
        }
      }}
    >
      {/* MEDIA CONTAINER */}
      <div style={{ 
        position: "relative", 
        width: "100%", 
        height: isKnacks ? cardHeight : "auto",
        aspectRatio: isKnacks ? "unset" : (isLarge ? "9/14" : "9/16"),
        background: "#111",
        borderRadius: "12px", // 🟢 Ensure internal rounding matches
        overflow: "hidden"
      }}>
        <img 
          src={video.thumbnail_url} 
          alt={video.caption || "Thumbnail"}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            position: "absolute", inset: 0, zIndex: 2,
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
        
        {/* VIEW COUNT OVERLAY */}
        <div style={{
          position: "absolute", bottom: 10, left: 10, zIndex: 10, 
          display: "flex", alignItems: "center", gap: 4, color: "#fff",
          fontSize: "11px", fontWeight: "800", textShadow: "0px 1px 8px rgba(0,0,0,1)"
        }}>
          <Play size={12} fill="#fff" strokeWidth={0} />
          <span>{Number(video.views || 0).toLocaleString()}</span>
        </div>
      </div>

      {/* CAPTION SECTION */}
      {(isKnacks || isLarge) && (
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
              alt="Avatar"
              onError={(e) => { e.target.style.display = 'none'; }}
              style={{ width: 18, height: 18, borderRadius: "50%", objectFit: "cover", background: "#333" }}
            />
            <span style={{ fontSize: "11px", color: "#8e8e8e", fontWeight: "600" }}>
              @{video.uploader_name || "Member"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}