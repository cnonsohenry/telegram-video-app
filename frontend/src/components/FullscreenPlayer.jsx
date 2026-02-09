import React, { useEffect, useRef, useState } from "react";
import { X, ArrowLeft, Play, Loader2 } from "lucide-react";

export default function FullscreenPlayer({ video, onClose, isDesktop }) {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden"; 
    return () => { 
      document.body.style.overflow = "auto";
      document.documentElement.style.overflow = "auto";
    };
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      setProgress((current / duration) * 100);
    }
  };

  const handleSeek = (e) => {
    e.stopPropagation();
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
        inset: 0,
        backgroundColor: "#000",
        zIndex: 10000, 
        display: "flex",
        flexDirection: "column", // Stack elements vertically
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose} 
    >
      {/* 🟢 NAVIGATION BUTTONS */}
      {!isDesktop && (
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={mobileBackButtonStyle}>
          <ArrowLeft size={28} />
        </button>
      )}

      {isDesktop && (
        <button onClick={onClose} style={desktopCloseButtonStyle}><X size={24} /></button>
      )}

      {/* 🟢 MAIN CONTAINER */}
      <div
        style={{
          display: "flex",
          flexDirection: isDesktop ? "row" : "column",
          width: "100%", 
          height: isDesktop ? "85vh" : "100dvh", 
          maxWidth: isDesktop ? "1100px" : "none",
          background: "#000",
          borderRadius: isDesktop ? "12px" : "0px",
          overflow: "hidden",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()} 
      >
        
        {/* 🟢 VIDEO AREA */}
        <div 
          onClick={togglePlay}
          style={{ 
            flex: 1, 
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
          {isLoading && (
            <div style={{ position: "absolute", zIndex: 10 }}>
              <Loader2 size={48} color="#20D5EC" className="spin-animation" />
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
            onCanPlay={() => setIsLoading(false)}
            style={{ 
                width: "100%", 
                height: "100%", 
                // 🟢 FIXED: 'contain' prevents the "flat" look by keeping original ratio.
                // We use 'contain' for both to ensure quality and proper dimensions.
                objectFit: "contain" 
            }}
          />

          {(!isPlaying || showPlayIcon) && !isLoading && (
            <div style={playIconOverlayStyle}>
              <Play size={40} fill="white" color="white" />
            </div>
          )}

          {/* 🟢 PROGRESS BAR (Pushed up slightly for Safe Area) */}
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

        {/* 🟢 DESKTOP SIDEBAR */}
        {isDesktop && (
          <div style={desktopSidebarStyle}>
            {/* ... Sidebar code remains same ... */}
          </div>
        )}
      </div>
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .spin-animation { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

// 🎨 STYLES
const mobileBackButtonStyle = {
  position: "absolute", 
  top: "max(20px, env(safe-area-inset-top))", // 🟢 iPhone Notch Protection
  left: "20px", 
  zIndex: 10005,
  background: "rgba(0,0,0,0.5)", 
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
  position: "absolute", top: "30px", right: "30px", zIndex: 10002,
  background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: "50%",
  width: "48px", height: "48px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  backdropFilter: "blur(5px)"
};

const playIconOverlayStyle = {
  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
  background: "rgba(0,0,0,0.4)", borderRadius: "50%", padding: "20px", pointerEvents: "none"
};

const desktopSidebarStyle = {
  width: "360px", background: "#121212", borderLeft: "1px solid #222",
  display: "flex", flexDirection: "column", flexShrink: 0
};

const progressContainerStyle = {
  position: "absolute", 
  bottom: "max(30px, env(safe-area-inset-bottom))", // 🟢 iPhone Home Bar Protection
  left: "20px", 
  right: "20px", 
  zIndex: 10002,
  display: "flex", alignItems: "center"
};

const rangeInputStyle = {
  width: "100%", cursor: "pointer", accentColor: "#ff3b30", height: "4px"
};