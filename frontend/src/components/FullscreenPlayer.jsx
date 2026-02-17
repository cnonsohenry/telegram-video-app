import React, { useEffect, useRef } from "react";
import { X, ArrowLeft } from "lucide-react";

export default function FullscreenPlayer({ video, onClose, isDesktop }) {
  const videoRef = useRef(null);

  useEffect(() => {
    // 🟢 LOCK SCROLL
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    // 🟢 AUTO-FULLSCREEN ATTEMPT
    const videoElem = videoRef.current;
    if (videoElem) {
      if (videoElem.webkitEnterFullscreen) {
        // iPhone specific
        videoElem.webkitEnterFullscreen();
      } else if (videoElem.requestFullscreen) {
        // Android/Desktop specific
        videoElem.requestFullscreen().catch(() => {});
      }
    }

    return () => {
      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";
    };
  }, []);

  // 🟢 EXIT LISTENER (Critical for iPhone "Done" button)
  useEffect(() => {
    const videoElem = videoRef.current;
    if (videoElem) {
      const handleExit = () => onClose();
      
      // Standard events
      videoElem.addEventListener("webkitendfullscreen", handleExit); // iOS
      videoElem.addEventListener("fullscreenchange", () => {
        if (!document.fullscreenElement) handleExit();
      }); // Android/PC

      return () => {
        videoElem.removeEventListener("webkitendfullscreen", handleExit);
      };
    }
  }, [onClose]);

  if (!video) return null;

  return (
    <div style={overlayStyle}>
      {/* 🟢 TOP NAV (Visible before native player takes over) */}
      <div style={headerStyle}>
        {!isDesktop ? (
          <button onClick={onClose} style={mobileBackButtonStyle}>
            <ArrowLeft size={28} />
          </button>
        ) : (
          <button onClick={onClose} style={desktopCloseButtonStyle}>
            <X size={24} />
          </button>
        )}
      </div>

      <div style={videoWrapperStyle}>
        <video
          ref={videoRef}
          src={video.video_url}
          autoPlay
          playsInline
          controls // 🟢 THE NATIVE FIX: Enables browser controls
          loop
          style={videoElementStyle}
        />
      </div>
    </div>
  );
}

// 🖌 MINIMAL STYLES
const overlayStyle = { 
  position: "fixed", 
  inset: 0, 
  backgroundColor: "#000", 
  zIndex: 10000, 
  display: "flex", 
  flexDirection: "column" 
};

const headerStyle = {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  height: "70px",
  zIndex: 10001,
  padding: "10px 20px",
  display: "flex",
  alignItems: "center"
};

const videoWrapperStyle = { 
  flex: 1, 
  width: "100%", 
  display: "flex", 
  alignItems: "center", 
  justifyContent: "center", 
  background: "#000" 
};

const videoElementStyle = { 
  width: "100%", 
  maxHeight: "100%", 
  outline: "none" 
};

const mobileBackButtonStyle = { 
  background: "rgba(255,255,255,0.1)", 
  color: "#fff", 
  border: "none", 
  borderRadius: "50%", 
  width: "44px", 
  height: "44px", 
  display: "flex", 
  alignItems: "center", 
  justifyContent: "center", 
  backdropFilter: "blur(10px)" 
};

const desktopCloseButtonStyle = { 
  background: "rgba(255,255,255,0.1)", 
  color: "#fff", 
  border: "none", 
  borderRadius: "50%", 
  width: "48px", 
  height: "48px", 
  display: "flex", 
  alignItems: "center", 
  justifyContent: "center", 
  cursor: "pointer" 
};