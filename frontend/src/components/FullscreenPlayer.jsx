import React, { useEffect, useRef, useState } from "react";
import { X, ArrowLeft, Play, Loader2, Maximize, Minimize } from "lucide-react";

export default function FullscreenPlayer({ video, onClose, isDesktop }) {
  const videoRef = useRef(null);
  const lastTap = useRef(0); // 🟢 Track timing of the last tap
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);

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

  // 🟢 1. REFINED INTERACTION LOGIC
  const handleInteraction = (e) => {
    e.stopPropagation();
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      // 🟢 DOUBLE TAP DETECTED: Toggle Zoom
      setIsZoomed(!isZoomed);
      // Reset lastTap so a triple tap doesn't trigger another zoom immediately
      lastTap.current = 0; 
    } else {
      // 🟢 SINGLE TAP DETECTED: Toggle Play/Pause
      lastTap.current = now;
      
      // Delay the play/pause slightly to see if a second tap is coming
      setTimeout(() => {
        if (lastTap.current === now && videoRef.current) {
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
      }, DOUBLE_TAP_DELAY);
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
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose} 
    >
      {/* NAVIGATION */}
      {!isDesktop && (
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={mobileBackButtonStyle}>
          <ArrowLeft size={28} />
        </button>
      )}

      {isDesktop && (
        <button onClick={onClose} style={desktopCloseButtonStyle}><X size={24} /></button>
      )}

      {/* MAIN CONTAINER */}
      <div
        style={{
          display: "flex",
          flexDirection: isDesktop ? "row" : "column",
          width: "100%", 
          height: isDesktop ? "85vh" : "100dvh", 
          background: "#000",
          borderRadius: isDesktop ? "12px" : "0px",
          overflow: "hidden",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()} 
      >
        
        {/* VIDEO AREA */}
        <div 
          onClick={handleInteraction} // 🟢 Updated to our new handler
          style={{ 
            flex: 1, 
            width: "100%",
            height: "100%", 
            background: "#000", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            position: "relative",
            cursor: "pointer",
            touchAction: "manipulation" // 🟢 Prevents browser zooming on double-tap
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
                objectFit: isZoomed ? "cover" : "contain",
                transition: "object-fit 0.25s cubic-bezier(0.4, 0, 0.2, 1)" 
            }}
          />

          {(!isPlaying || showPlayIcon) && !isLoading && (
            <div style={playIconOverlayStyle}>
              <Play size={40} fill="white" color="white" />
            </div>
          )}

          {/* Optional: Keep the button as a visual indicator, or remove it to keep UI clean */}
          <button 
            onClick={(e) => { e.stopPropagation(); setIsZoomed(!isZoomed); }}
            style={zoomToggleButtonStyle}
          >
            {isZoomed ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>

          {/* PROGRESS BAR */}
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
      </div>

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .spin-animation { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

// 🎨 STYLES (Same as before)
const mobileBackButtonStyle = {
  position: "absolute", top: "max(20px, env(safe-area-inset-top))", left: "20px", 
  zIndex: 10005, background: "rgba(0,0,0,0.5)", color: "#fff", border: "none",
  borderRadius: "50%", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)"
};

const desktopCloseButtonStyle = {
  position: "absolute", top: "30px", right: "30px", zIndex: 10002,
  background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: "50%",
  width: "48px", height: "48px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(5px)"
};

const zoomToggleButtonStyle = {
  position: "absolute", right: "20px", bottom: "80px", zIndex: 10005,
  background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", borderRadius: "8px",
  padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)"
};

const playIconOverlayStyle = {
  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
  background: "rgba(0,0,0,0.4)", borderRadius: "50%", padding: "20px", pointerEvents: "none"
};

const progressContainerStyle = {
  position: "absolute", bottom: "max(30px, env(safe-area-inset-bottom))",
  left: "20px", right: "20px", zIndex: 10002, display: "flex", alignItems: "center"
};

const rangeInputStyle = { width: "100%", cursor: "pointer", accentColor: "#ff3b30", height: "4px" };