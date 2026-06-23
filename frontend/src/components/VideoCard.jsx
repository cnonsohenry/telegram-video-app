import React, { useEffect, useRef, useState } from "react";
import { Play, Copy } from 'lucide-react'; 

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
    <a
      href={`${APP_CONFIG.apiUrl}/v/${video.message_id}`}
      onClick={(e) => {
        e.preventDefault(); 
        onOpen(video, e);   
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex", 
        flexDirection: "column",
        background: "transparent", 
        borderRadius: showDetails ? "12px" : "4px",
        width: "100%", 
        cursor: "pointer", 
        position: "relative",
        transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: (isHovered && showDetails) ? "translateY(-4px)" : "translateY(0)",
        zIndex: isHovered ? 10 : 1,
        textDecoration: "none", 
        color: "inherit"        
      }}
    >
      <div style={{ 
        position: "relative", 
        width: "100%", 
        aspectRatio: "9/16",
        background: "#080808", // Softened from harsh #111
        overflow: "hidden",
        borderRadius: showDetails ? "12px" : "4px",
        flexShrink: 0 
      }}>
        
        {!isImgLoaded && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 1,
            background: "linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.03) 50%, transparent 75%)",
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
              width: "100%", height: "100%", 
              objectFit: "cover", 
              position: "absolute", inset: 0, zIndex: 2,
              // 🟢 OPTICAL FIX 1: Tame the peak whites & pull out vibrating neons
              filter: "brightness(0.84) contrast(0.96) saturate(0.88)",
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
            // 🟢 MUST match the image filter so it doesn't flash bright when playback starts!
            filter: "brightness(0.84) contrast(0.96) saturate(0.88)",
            opacity: (isHovered && isVideoReady) ? 1 : 0, 
            transition: "opacity 0.3s ease"
          }}
        />

        {/* 🟢 OPTICAL FIX 2 & 3: The 360-Degree Snapchat Dampening Layer */}
        <div style={{
          position: "absolute", 
          inset: 0, 
          zIndex: 4, 
          borderRadius: "inherit", // Crucial so the inner shadow rounds the corners
          pointerEvents: "none", 
          // Applies a 15% dimming film over the center + the heavy top/bottom fades
          background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, rgba(0,0,0,0.15) 25%, rgba(0,0,0,0.15) 70%, rgba(0,0,0,0.85) 100%)",
          // The Inset Airbrush: melts the left and right pixel edges into the black background
          boxShadow: "inset 0px 0px 22px 3px rgba(0, 0, 0, 0.65)"
        }} />
        
        {video.is_group && (
          <div style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "rgba(0,0,0,0.4)",
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
            background: "rgba(0,0,0,0.4)", 
            padding: "5px 10px", borderRadius: "100px",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.08)"
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
    </a>
  );
}

const captionTextStyle = { margin: "0 0 6px 0", fontSize: "12px", color: "#e0e0e0", lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical", overflow: "hidden", fontWeight: "500" }; // Dimmed text slightly from #fff to #e0e0e0
const userInfoRowStyle = { display: "flex", alignItems: "center", gap: "8px" };
const avatarWrapperStyle = { width: "14px", height: "14px", borderRadius: "50%", background: "#1a1a1a", overflow: "hidden", flexShrink: 0, border: "1px solid rgba(255,255,255,0.08)" };
const uploaderNameStyle = { fontSize: "10px", color: "#777777", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };