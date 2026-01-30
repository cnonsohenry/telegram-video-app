import React, { useEffect, useRef, useState } from "react";
import { Play } from 'lucide-react';

export default function VideoCard({ video, onOpen, layoutType }) {
  const videoRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  const isKnacks = layoutType === 1;

  // 🟢 Fixed height for Knacks to ensure Android & iPhone look identical
  const cardHeight = isKnacks 
    ? (parseInt(video.message_id) % 2 === 0 ? "280px" : "320px") 
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
        borderRadius: (layoutType === 1 || layoutType === 2) ? "12px" : "0px",
        overflow: "hidden",
        width: "100%",
        // 🟢 Crucial for iOS: keeps the card as one unit
        height: "fit-content"
      }}
    >
      {/* MEDIA BOX */}
      <div style={{ 
        position: "relative", 
        width: "100%", 
        height: isKnacks ? cardHeight : "auto",
        aspectRatio: isKnacks ? "unset" : (layoutType === 2 ? "9/14" : "9/16"),
        background: "#000",
        flexShrink: 0 // Prevents iPhone from squishing the video top
      }}>
        <img 
          src={video.thumbnail_url} 
          style={{
            width: "100%", height: "100%", object_fit: "cover",
            position: "absolute", zIndex: 1,
            opacity: isHovered ? 0 : 1, transition: "0.3s"
          }}
        />
        <video
          ref={videoRef}
          src={video.video_url}
          muted loop playsInline
          onPlaying={() => setIsHovered(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>

      {/* CAPTION BOX */}
      {isKnacks && (
        <div style={{ 
          padding: "10px", 
          background: "inherit", // Forces inheritance of the #1c1c1e
          marginTop: "-1px" // Closes tiny browser-rendered gaps
        }}>
          <p style={{
            margin: 0, fontSize: "12px", color: "#fff",
            lineHeight: "1.4", display: "-webkit-box",
            WebkitLineClamp: "2", WebkitBoxOrient: "vertical",
            overflow: "hidden"
          }}>
            {video.caption || "View more vibes..."}
          </p>
          <div style={{ marginTop: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
            <img 
              src={`https://videos.naijahomemade.com/api/avatar?user_id=${video.uploader_id}`}
              style={{ width: 14, height: 14, borderRadius: "50%", objectFit: "cover" }}
            />
            <span style={{ fontSize: "10px", color: "#8e8e8e" }}>
              {String(video.uploader_id) === "1881815190" ? "Chief" : "Admin"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}