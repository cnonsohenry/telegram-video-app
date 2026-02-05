import React, { useEffect, useRef, useState } from "react";
import { Play } from 'lucide-react';

export default function VideoCard({ video, onOpen, layoutType }) {
  const videoRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  
  // Track image loading state
  const [isImgLoaded, setIsImgLoaded] = useState(false);

  const isKnacks = layoutType === 'knacks';

  // Cloudflare Resized URL
  const thumbSrc = `${video.thumbnail_url}&w=400`;

  const cardHeight = isKnacks 
    ? (parseInt(video.message_id) % 2 === 0 ? "260px" : "310px") 
    : "200px";

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
        display: "flex", flexDirection: "column",
        background: "#1c1c1e", borderRadius: "0px", 
        overflow: "hidden", width: "100%", height: "100%", 
        cursor: "pointer", position: "relative"
      }}
      // Hover effects
      onMouseEnter={(e) => { 
        if (window.innerWidth > 1024) {
          e.currentTarget.style.transform = 'translateY(-8px) scale(1.02)';
          e.currentTarget.style.background = "#252525";
        }
      }}
      onMouseLeave={(e) => { 
        if (window.innerWidth > 1024) {
          e.currentTarget.style.transform = 'translateY(0) scale(1)';
          e.currentTarget.style.background = "#1c1c1e";
        }
      }}
    >
      <div style={{ 
        position: "relative", width: "100%", height: cardHeight, 
        background: "#000", overflow: "hidden"
      }}>
        
        {/* 🟢 1. SKELETON (Now persists and fades out smoothly) */}
        <div style={{
          position: "absolute", inset: 0, zIndex: 1, // Sit behind image
          background: "linear-gradient(90deg, #1f1f1f 25%, #2a2a2a 50%, #1f1f1f 75%)",
          backgroundSize: "200% 100%",
          animation: "skeleton-loading 1.5s infinite",
          // Fade out logic:
          opacity: isImgLoaded ? 0 : 1,
          transition: "opacity 0.4s ease-in-out"
        }} />

        {/* 🟢 2. IMAGE (Fades in on top) */}
        <img 
          src={thumbSrc} 
          alt={video.caption || "Thumbnail"}
          loading="lazy"
          onLoad={() => setIsImgLoaded(true)}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            position: "absolute", inset: 0, zIndex: 2, // Sit on top of skeleton
            // Fade in logic:
            opacity: (isImgLoaded && !isHovered) ? 1 : 0, 
            transition: "opacity 0.4s ease-in-out"
          }}
        />

        <video
          ref={videoRef}
          src={video.video_url}
          muted loop playsInline
          onPlaying={() => setIsHovered(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", position: "absolute", inset: 0, zIndex: 3 }}
        />
        
        <div style={{
          position: "absolute", bottom: 8, left: 8, zIndex: 10, 
          display: "flex", alignItems: "center", gap: 4, 
          background: "rgba(0,0,0,0.6)", padding: "2px 6px", borderRadius: "4px"
        }}>
          <Play size={10} fill="#fff" strokeWidth={0} />
          <span style={{ color: "#fff", fontSize: "10px", fontWeight: "700" }}>
            {Number(video.views || 0).toLocaleString()}
          </span>
        </div>
      </div>

      {/* 🟢 3. PADDING FIX (Separated properties to prevent error) */}
      <div style={{ 
        paddingTop: "12px", paddingBottom: "12px", 
        paddingLeft: "10px", paddingRight: "10px",
        display: "flex", flexDirection: "column", flex: 1 
      }}>
        <p style={{
          margin: "0 0 8px 0", fontSize: "12px", color: "#fff",
          lineHeight: "1.4", display: "-webkit-box",
          WebkitLineClamp: "2", WebkitBoxOrient: "vertical",
          overflow: "hidden", minHeight: "34px", fontWeight: "500"
        }}>
          {video.caption || "No caption provided..."}
        </p>
        
        <div style={{ marginTop: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
          <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#333", overflow: "hidden", flexShrink: 0 }}>
             <img 
               src={`https://videos.naijahomemade.com/api/avatar?user_id=${video.uploader_id}`}
               alt=""
               onError={(e) => { e.target.style.display = 'none'; }}
               style={{ width: "100%", height: "100%", objectFit: "cover" }}
             />
          </div>
          <span style={{ fontSize: "11px", color: "#8e8e8e", fontWeight: "600" }}>
            @{video.uploader_name || "Member"}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes skeleton-loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}