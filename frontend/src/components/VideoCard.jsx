import React, { useEffect, useRef, useState } from "react";
import { Play } from 'lucide-react';

// 🟢 Added showDetails prop (defaults to true)
export default function VideoCard({ video, onOpen, showDetails = true }) {
  const videoRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isImgLoaded, setIsImgLoaded] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false); // 🟢 New state to track if video is ready

  const thumbSrc = `${video.thumbnail_url}&w=400`;

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { setIsVisible(entry.isIntersecting); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, []);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (isVisible && isHovered) {
      el.play().catch(() => {});
    } else {
      el.pause();
      setIsVideoReady(false); // Reset when not hovered
    }
  }, [isVisible, isHovered]);

  return (
    <div
      onClick={() => onOpen(video)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex", 
        flexDirection: "column",
        background: "#1c1c1e", 
        borderRadius: showDetails ? "12px" : "4px", // 🟢 Sharper look for grid
        overflow: "hidden", 
        width: "100%", 
        cursor: "pointer", 
        position: "relative",
        transition: "transform 0.2s ease",
        transform: (isHovered && showDetails) ? "scale(1.02)" : "scale(1)"
      }}
    >
      <div style={{ 
        position: "relative", 
        width: "100%", 
        aspectRatio: showDetails ? "9/16" : "1/1", // 🟢 Square for profile, Vertical for Home
        background: "#000", 
        overflow: "hidden"
      }}>
        
        {/* Skeleton Loader */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 1,
          background: "linear-gradient(90deg, #1f1f1f 25%, #2a2a2a 50%, #1f1f1f 75%)",
          backgroundSize: "200% 100%",
          animation: "skeleton-loading 1.5s infinite",
          opacity: isImgLoaded ? 0 : 1,
          transition: "opacity 0.4s ease-in-out"
        }} />

        {/* Thumbnail Image - 🟢 Stays visible under video to prevent black flash */}
        <img 
          src={thumbSrc} 
          alt={video.caption || "Thumbnail"}
          loading="lazy"
          onLoad={() => setIsImgLoaded(true)}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            position: "absolute", inset: 0, zIndex: 2,
            opacity: isImgLoaded ? 1 : 0, 
            transition: "opacity 0.4s ease-in-out"
          }}
        />

        {/* Video Preview */}
        <video
          ref={videoRef}
          src={video.video_url}
          muted loop playsInline
          onPlaying={() => setIsVideoReady(true)} // 🟢 Only show when actual playback starts
          style={{ 
            width: "100%", height: "100%", objectFit: "cover", 
            position: "absolute", inset: 0, zIndex: 3,
            opacity: (isHovered && isVideoReady) ? 1 : 0, 
            transition: "opacity 0.3s ease"
          }}
        />
        
        {/* View Count Badge - 🟢 Respects showDetails */}
        {showDetails && (
          <div style={{
            position: "absolute", bottom: 8, left: 8, zIndex: 10, 
            display: "flex", alignItems: "center", gap: 4, 
            background: "rgba(0,0,0,0.6)", padding: "4px 8px", borderRadius: "100px",
            backdropFilter: "blur(4px)"
          }}>
            <Play size={10} fill="#fff" strokeWidth={0} />
            <span style={{ color: "#fff", fontSize: "11px", fontWeight: "700" }}>
              {Number(video.views || 0).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {/* 🟢 2. CONDITIONAL DETAILS AREA */}
      {showDetails && (
        <div style={{ padding: "12px", display: "flex", flexDirection: "column" }}>
          <p style={captionTextStyle}>
            {video.caption || "No caption provided"}
          </p>
          
          <div style={userInfoRowStyle}>
            <div style={avatarWrapperStyle}>
               <img 
                 src={`https://videos.naijahomemade.com/api/avatar?user_id=${video.uploader_id}`}
                 alt=""
                 onError={(e) => { e.target.style.display = 'none'; }}
                 style={{ width: "100%", height: "100%", objectFit: "cover" }}
               />
            </div>
            <span style={uploaderNameStyle}>
              @{video.uploader_name || "Member"}
            </span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes skeleton-loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// 🖌 Styles
const captionTextStyle = { margin: "0 0 6px 0", fontSize: "13px", color: "#fff", lineHeight: "1.3", display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical", overflow: "hidden", fontWeight: "500" };
const userInfoRowStyle = { display: "flex", alignItems: "center", gap: "8px" };
const avatarWrapperStyle = { width: "22px", height: "22px", borderRadius: "50%", background: "#333", overflow: "hidden", flexShrink: 0 };
const uploaderNameStyle = { fontSize: "12px", color: "#aaa", fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };