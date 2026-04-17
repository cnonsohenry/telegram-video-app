import React, { useEffect, useRef, useState } from "react";
import { Play, Copy } from 'lucide-react'; 

// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../config";

export default function VideoCard({ video, onOpen, showDetails = true }) {
  const videoRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isImgLoaded, setIsImgLoaded] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);

  const thumbSrc = video.thumbnail_url 
    ? (video.thumbnail_url.includes('?') ? `${video.thumbnail_url}&w=400` : `${video.thumbnail_url}?w=400`)
    : '';

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
      setIsVideoReady(false);
    }
  }, [isVisible, isHovered]);

  return (
    <div
      onClick={(e) => onOpen(video, e)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex", 
        flexDirection: "column",
        background: "var(--bg-color)", 
        borderRadius: showDetails ? "12px" : "4px",
        width: "100%", 
        cursor: "pointer", 
        position: "relative",
        transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: (isHovered && showDetails) ? "translateY(-4px)" : "translateY(0)",
        zIndex: isHovered ? 10 : 1, 
      }}
    >
      <div style={{ 
        position: "relative", 
        width: "100%", 
        aspectRatio: "9/16",
        background: "#111", 
        overflow: "hidden",
        borderRadius: showDetails ? "12px" : "4px",
        flexShrink: 0 
      }}>
        
        {!isImgLoaded && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 1,
            background: "linear-gradient(90deg, #121212 25%, #1a1a1a 50%, #121212 75%)",
            backgroundSize: "200% 100%",
            animation: "skeleton-loading 1.5s infinite"
          }} />
        )}

        {thumbSrc && (
          <img 
            src={thumbSrc} 
            alt={video.caption || "Thumbnail"}
            loading="eager"
            onLoad={() => setIsImgLoaded(true)}
            onError={(e) => { 
              setIsImgLoaded(true); 
              e.target.style.display = 'none'; 
            }}
            style={{
              width: "100%", height: "100%", objectFit: "cover",
              position: "absolute", inset: 0, zIndex: 2,
              opacity: 1, 
              transition: "opacity 0.2s ease-in"
            }}
          />
        )}

        <video
          ref={videoRef}
          src={video.video_url}
          preload="none" 
          muted loop playsInline
          onPlaying={() => setIsVideoReady(true)}
          style={{ 
            width: "100%", height: "100%", objectFit: "cover", 
            position: "absolute", inset: 0, zIndex: 3,
            opacity: (isHovered && isVideoReady) ? 1 : 0, 
            transition: "opacity 0.3s ease"
          }}
        />
        
        {video.is_group && (
          <div style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "rgba(0,0,0,0.6)",
            padding: "6px",
            borderRadius: "8px",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 11 
          }}>
            <Copy size={16} color="#fff" />
          </div>
        )}

        {showDetails && (
          <div style={{
            position: "absolute", bottom: 10, left: 10, zIndex: 10, 
            display: "flex", alignItems: "center", gap: 6, 
            background: "rgba(0,0,0,0.6)", padding: "5px 10px", borderRadius: "100px",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)"
          }}>
            <Play size={10} fill="#fff" strokeWidth={0} />
            <span style={{ color: "#fff", fontSize: "11px", fontWeight: "800" }}>
              {Number(video.views || 0).toLocaleString()}
            </span>
          </div>
        )}
      </div>

      {showDetails && (
        <div style={{ padding: "12px 4px", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <p style={captionTextStyle}>
            {/* 🟢 THE FIX: Dynamic fallback caption */}
            {video.caption || APP_CONFIG.defaultCaption}
          </p>
          
          <div style={userInfoRowStyle}>
            <div style={avatarWrapperStyle}>
               <img 
                 src={`${APP_CONFIG.apiUrl}/api/avatar?user_id=${video.uploader_id}`}
                 alt=""
                 onError={(e) => { e.target.style.display = 'none'; }}
                 style={{ width: "100%", height: "100%", objectFit: "cover" }}
               />
            </div>
            <span style={uploaderNameStyle}>
              {/* 🟢 THE FIX: Dynamic fallback username */}
              @{video.uploader_name || APP_CONFIG.defaultUploader}
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
const captionTextStyle = { margin: "0 0 6px 0", fontSize: "12px", color: "#fff", lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical", overflow: "hidden", fontWeight: "600" };
const userInfoRowStyle = { display: "flex", alignItems: "center", gap: "8px" };
const avatarWrapperStyle = { width: "14px", height: "14px", borderRadius: "50%", background: "#1a1a1a", overflow: "hidden", flexShrink: 0, border: "1px solid #333" };
const uploaderNameStyle = { fontSize: "8px", color: "#8e8e8e", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };