import React, { useEffect, useRef, useState } from "react";
import { X, ArrowLeft, Play, Pause, Loader2 } from "lucide-react";

export default function FullscreenPlayer({ video, onClose, isDesktop }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  // 🟢 1. Lock Body Scroll & Handle Auto-Play
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
  }, []);

  // 🟢 2. Update Progress Bar
  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      setProgress((current / duration) * 100);
    }
  };

  // 🟢 3. Handle Seeking (Scrubbing)
  const handleSeek = (e) => {
    e.stopPropagation(); // Don't pause when dragging
    const newTime = (e.target.value / 100) * videoRef.current.duration;
    videoRef.current.currentTime = newTime;
    setProgress(e.target.value);
  };

  const togglePlay = (e) => {
    e.stopPropagation(); 
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
        setIsPlaying(false);
        setShowPlayIcon(true);
      } else {
        videoRef.current.play();
        setIsPlaying(true);
        setTimeout(() => setShowPlayIcon(false), 500); 
      }
    }
  };

  if (!video) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: "#000",
        zIndex: 10000, 
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose} 
    >
      {/* 🟢 NAVIGATION BUTTONS */}
      {isDesktop ? (
        <button onClick={onClose} style={desktopCloseButtonStyle}><X size={24} /></button>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={mobileBackButtonStyle}>
          <ArrowLeft size={28} />
        </button>
      )}

      {/* 🟢 MAIN CONTAINER */}
      <div
        style={{
          display: "flex",
          flexDirection: isDesktop ? "row" : "column",
          width: isDesktop ? "auto" : "100%",
          // 🟢 100dvh forces it to fill the mobile screen even with address bars
          height: isDesktop ? "auto" : "100dvh", 
          maxHeight: isDesktop ? "90vh" : "none",
          maxWidth: isDesktop ? "95vw" : "none",
          background: "#000",
          borderRadius: isDesktop ? "12px" : "0px",
          overflow: "hidden",
          position: "relative"
        }}
        onClick={(e) => e.stopPropagation()} 
      >
        
        {/* 🟢 VIDEO AREA */}
        <div 
          onClick={togglePlay}
          style={{ 
            width: "100%", height: "100%", background: "#000", 
            display: "flex", alignItems: "center", justifyContent: "center", position: "relative"
          }}
        >
          {/* 🟢 LOADING SPINNER (Fixes Black Screen) */}
          {isLoading && (
            <div style={{ position: "absolute", zIndex: 10 }}>
              <Loader2 size={48} color="#20D5EC" className="spin-animation" />
              <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } } .spin-animation { animation: spin 1s linear infinite; }`}</style>
            </div>
          )}

          <video
            ref={videoRef}
            src={video.video_url}
            autoPlay
            playsInline 
            loop
            onTimeUpdate={handleTimeUpdate}
            onWaiting={() => setIsLoading(true)}
            onCanPlay={() => setIsLoading(false)} // Hide spinner when ready
            style={{ 
                width: "100%", height: "100%", objectFit: "contain" 
            }}
          />

          {/* 🟢 CENTER PLAY ICON */}
          {(!isPlaying || showPlayIcon) && !isLoading && (
            <div style={playIconOverlayStyle}>
              <Play size={40} fill="white" color="white" />
            </div>
          )}

          {/* 🟢 CUSTOM PROGRESS BAR (TikTok Style) */}
          <div style={progressContainerStyle} onClick={(e) => e.stopPropagation()}>
             <input 
               type="range" 
               min="0" max="100" 
               value={progress} 
               onChange={handleSeek}
               style={rangeInputStyle}
             />
          </div>
        </div>

        {/* 🟢 DESKTOP SIDEBAR (Hidden on Mobile) */}
        {isDesktop && (
          <div style={desktopSidebarStyle}>
            {/* Sidebar content (same as before) */}
            <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #333" }}>
               <img src={video.avatar_url || "/assets/default-avatar.png"} style={{ width: 32, height: 32, borderRadius: "50%" }} />
               <span style={{ color: "#fff", fontWeight: "600" }}>@{video.uploader_name || 'Member'}</span>
            </div>
            <div style={{ flex: 1, padding: "16px", overflowY: "auto", color: "#ccc" }}>
              {video.caption || "No caption"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// 🎨 STYLES

const mobileBackButtonStyle = {
  position: "absolute", top: "20px", left: "20px", zIndex: 10002,
  background: "rgba(0,0,0,0.4)", color: "#fff", border: "none",
  borderRadius: "50%", width: "44px", height: "44px",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  backdropFilter: "blur(5px)"
};

const desktopCloseButtonStyle = {
  position: "absolute", top: "20px", right: "20px", zIndex: 10002,
  background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: "50%",
  width: "44px", height: "44px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center"
};

const playIconOverlayStyle = {
  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
  background: "rgba(0,0,0,0.4)", borderRadius: "50%", padding: "20px", pointerEvents: "none"
};

const desktopSidebarStyle = {
  width: "380px", background: "#121212", borderLeft: "1px solid #333",
  display: "flex", flexDirection: "column", flexShrink: 0
};

const progressContainerStyle = {
  position: "absolute", bottom: "10px", left: "10px", right: "10px", zIndex: 10002,
  display: "flex", alignItems: "center"
};

// 🟢 Custom Range Input Style (mimics video scrubber)
const rangeInputStyle = {
  width: "100%", cursor: "pointer", accentColor: "#ff3b30", height: "4px"
};