import React, { useEffect, useRef, useState } from "react";
import { X, ArrowLeft, Play, Pause } from "lucide-react";

export default function FullscreenPlayer({ video, onClose, isDesktop }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayIcon, setShowPlayIcon] = useState(false);

  // 🟢 1. Lock Body Scroll & Auto-Play
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  // 🟢 2. Handle Tap to Play/Pause
  const togglePlay = (e) => {
    e.stopPropagation(); // Prevent closing the modal
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
        setShowPlayIcon(true);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
        setTimeout(() => setShowPlayIcon(false), 500); // Fade out icon
      }
    }
  };

  if (!video) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#000",
        zIndex: 10000, 
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose} // Clicking black background closes
    >
      {/* 🟢 NAVIGATION BUTTONS */}
      {isDesktop ? (
        <button
          onClick={onClose}
          style={desktopCloseButtonStyle}
        >
          <X size={24} />
        </button>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={mobileBackButtonStyle}
        >
          <ArrowLeft size={28} />
        </button>
      )}

      {/* 🟢 MAIN CONTAINER */}
      <div
        style={{
          display: "flex",
          flexDirection: isDesktop ? "row" : "column",
          // Mobile: 100dvh ignores the URL bar for a taller view
          width: isDesktop ? "auto" : "100%",
          height: isDesktop ? "auto" : "100dvh", 
          maxHeight: isDesktop ? "90vh" : "none",
          maxWidth: isDesktop ? "95vw" : "none",
          background: "#000",
          borderRadius: isDesktop ? "12px" : "0px",
          overflow: "hidden",
          boxShadow: isDesktop ? "0 25px 50px rgba(0,0,0,0.5)" : "none",
          position: "relative"
        }}
        onClick={(e) => e.stopPropagation()} 
      >
        
        {/* 🟢 VIDEO AREA (Clickable) */}
        <div 
          onClick={togglePlay}
          style={{ 
            width: "100%",
            height: "100%", 
            background: "#000", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center",
            position: "relative",
            cursor: "pointer"
          }}
        >
          <video
            ref={videoRef}
            src={video.video_url}
            autoPlay
            playsInline // 🟢 KEEPS it in your app (prevents native fullscreen takeover)
            loop
            style={{ 
                width: "100%", 
                height: "100%", 
                // 'contain' ensures you see the whole video (no cropping)
                objectFit: "contain" 
            }}
          />

          {/* 🟢 CENTER PLAY ICON OVERLAY */}
          {(!isPlaying || showPlayIcon) && (
            <div style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: "rgba(0,0,0,0.4)",
              borderRadius: "50%",
              padding: "20px",
              pointerEvents: "none", // Let clicks pass through
              animation: "fadein 0.2s"
            }}>
              <Play size={40} fill="white" color="white" />
            </div>
          )}
        </div>

        {/* 🟢 DESKTOP SIDEBAR INFO (Hidden on Mobile) */}
        {isDesktop && (
          <div style={desktopSidebarStyle}>
            <div style={sidebarHeaderStyle}>
              <img 
                src={video.avatar_url || "/assets/default-avatar.png"}
                onError={(e) => { e.target.onerror = null; e.target.src = "/assets/default-avatar.png"; }}
                style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                alt="uploader"
              />
              <span style={{ color: "#fff", fontWeight: "600", fontSize: "14px" }}>
                @{video.uploader_name || 'Member'}
              </span>
            </div>

            <div style={{ flex: 1, padding: "16px", overflowY: "auto" }}>
              <p style={{ color: "#eee", fontSize: "14px", lineHeight: "1.5" }}>
                {video.caption || "No caption provided."}
              </p>
              <p style={{ color: "#888", fontSize: "12px", marginTop: "10px" }}>
                {new Date(video.created_at).toLocaleDateString()}
              </p>
            </div>

            <div style={{ padding: "16px", borderTop: "1px solid #333" }}>
              <div style={{ color: "#fff", fontSize: "14px", fontWeight: "bold" }}>
                {Number(video.views || 0).toLocaleString()} views
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 🎨 STYLES
const mobileBackButtonStyle = {
  position: "absolute",
  top: "20px", // Lowered slightly for dynamic islands/notches
  left: "20px",
  zIndex: 10002,
  background: "rgba(0,0,0,0.4)", // Subtle dark circle
  color: "#fff",
  border: "none",
  borderRadius: "50%",
  width: "44px",
  height: "44px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backdropFilter: "blur(5px)"
};

const desktopCloseButtonStyle = {
  position: "absolute",
  top: "20px",
  right: "20px",
  zIndex: 10002,
  background: "rgba(255,255,255,0.1)",
  color: "#fff",
  border: "none",
  borderRadius: "50%",
  width: "44px",
  height: "44px",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  backdropFilter: "blur(4px)"
};

const desktopSidebarStyle = {
  width: "380px",
  background: "#121212", 
  borderLeft: "1px solid #333",
  display: "flex", 
  flexDirection: "column",
  flexShrink: 0 
};

const sidebarHeaderStyle = {
  padding: "16px", 
  display: "flex", 
  alignItems: "center", 
  gap: "12px", 
  borderBottom: "1px solid #333"
};