import React, { useEffect, useRef, useState } from "react";
import { X, ArrowLeft, Play, Loader2, Maximize, Minimize } from "lucide-react";

export default function FullscreenPlayer({ video, onClose, isDesktop }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null); 
  const lastTap = useRef(0);
  const hideTimeout = useRef(null); 
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showControls, setShowControls] = useState(true); 

// 🟢 1. UNIVERSAL FULLSCREEN & DEEP SCROLL LOCK
  useEffect(() => {
    // A. Store original styles and scroll position
    const originalStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
      height: document.body.style.height
    };
    const scrollY = window.scrollY;

    // B. Apply "Deep Lock" (Fixes iPhone Scrollbar/Stability)
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed"; // Forces iOS to stay still
    document.body.style.top = `-${scrollY}px`; // Keeps your background spot
    document.body.style.width = "100%";
    document.body.style.height = "100dvh"; // Dynamic viewport lock

    // C. Trigger Fullscreen
    const enterFullscreen = async () => {
      try {
        const elem = containerRef.current;
        const videoElem = videoRef.current;
        if (!elem || !videoElem) return;

        // Android / Desktop / iPad (Standard)
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } 
        // iPhone / iOS Safari (Legacy/Video Only)
        else if (videoElem.webkitEnterFullscreen) {
          videoElem.webkitEnterFullscreen();
        } 
        // Older Safari/Webkit
        else if (elem.webkitRequestFullscreen) {
          await elem.webkitRequestFullscreen();
        }
      } catch (err) {
        console.warn("Fullscreen request failed", err);
      }
    };

    enterFullscreen();

    // D. Cleanup (Restore everything)
    return () => {
      // Exit Native Fullscreen if active
      if (document.fullscreenElement || document.webkitIsFullScreen) {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }

      // Restore Body Styles
      document.body.style.overflow = originalStyle.overflow;
      document.body.style.position = originalStyle.position;
      document.body.style.top = originalStyle.top;
      document.body.style.width = originalStyle.width;
      document.body.style.height = originalStyle.height;

      // Snap back to original scroll position
      window.scrollTo(0, scrollY);
    };
  }, []);

  // 🟢 2. EXIT LISTENER (Handles iPhone "Done" button and Android Back button)
  useEffect(() => {
    const handleExit = () => {
      if (!document.fullscreenElement && !document.webkitIsFullScreen) {
        onClose();
      }
    };

    const videoElem = videoRef.current;

    // Standard Events
    document.addEventListener("fullscreenchange", handleExit);
    document.addEventListener("webkitfullscreenchange", handleExit);
    
    // iPhone Specific: Triggered when the native player is closed
    if (videoElem) {
      videoElem.addEventListener("webkitendfullscreen", onClose);
    }

    return () => {
      document.removeEventListener("fullscreenchange", handleExit);
      document.removeEventListener("webkitfullscreenchange", handleExit);
      if (videoElem) {
        videoElem.removeEventListener("webkitendfullscreen", onClose);
      }
    };
  }, [onClose]);

  // 🟢 3. INTERACTION LOGIC
  const handleInteraction = (e) => {
    if (e) e.stopPropagation();
    setShowControls(true);

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      setIsZoomed(!isZoomed);
      lastTap.current = 0; 
    } else {
      lastTap.current = now;
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

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      if (duration > 0) setProgress((current / duration) * 100);
    }
  };

  const handleSeek = (e) => {
    e.stopPropagation();
    if (!videoRef.current) return;
    const newTime = (e.target.value / 100) * videoRef.current.duration;
    videoRef.current.currentTime = newTime;
    setProgress(e.target.value);
    setShowControls(true);
  };

  if (!video) return null;

  return (
    <div ref={containerRef} style={overlayStyle} onClick={onClose}>
      
      {/* CONTROLS */}
      <div style={{ ...topGradientStyle, opacity: showControls ? 1 : 0 }}>
        <div style={{ ...controlsTransitionStyle, opacity: showControls ? 1 : 0, pointerEvents: showControls ? "auto" : "none" }}>
          {!isDesktop && (
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={mobileBackButtonStyle}>
              <ArrowLeft size={28} />
            </button>
          )}
          {isDesktop && (
            <button onClick={onClose} style={desktopCloseButtonStyle}><X size={24} /></button>
          )}
        </div>
      </div>

      <div
        style={{
          display: "flex",
          width: "100%", 
          height: "100%", 
          background: "#000",
          overflow: "hidden",
          position: "relative",
        }}
        onClick={(e) => e.stopPropagation()} 
      >
        <div onClick={handleInteraction} style={videoWrapperStyle}>
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
            onLoadedData={() => setIsLoading(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
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

          <div style={{ ...bottomGradientStyle, opacity: showControls ? 1 : 0 }} />

          <button 
            onClick={(e) => { e.stopPropagation(); setIsZoomed(!isZoomed); }}
            style={{ ...zoomToggleButtonStyle, opacity: showControls ? 1 : 0, pointerEvents: showControls ? "auto" : "none" }}
          >
            {isZoomed ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>

          <div 
            style={{ 
              ...progressWrapperStyle, 
              bottom: showControls ? "max(30px, env(safe-area-inset-bottom))" : "0",
              left: showControls ? "20px" : "0",
              right: showControls ? "20px" : "0",
            }} 
          >
             <input 
               type="range" 
               min="0" max="100" 
               step="0.1"
               value={progress || 0} 
               onChange={handleSeek}
               className={showControls ? "range-active" : "range-mini"}
               style={rangeInputBaseStyle}
             />
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .spin-animation { animation: spin 1s linear infinite; }
        .range-mini::-webkit-slider-thumb { appearance: none; width: 0; height: 0; }
        .range-mini { height: 2px !important; pointer-events: none; }
        .range-active::-webkit-slider-thumb { appearance: none; width: 14px; height: 14px; background: #ff3b30; border-radius: 50%; cursor: pointer; }
        .range-active { height: 4px !important; pointer-events: auto; }
      `}</style>
    </div>
  );
}

// 🖌 STYLES
const overlayStyle = { 
  position: "fixed", 
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  
  backgroundColor: "#000", 
  zIndex: 999999, 
  display: "flex", 
  flexDirection: "column",
  overflow: "hidden", // 🟢 Force-kill any internal scrolling
  touchAction: "none" // 🟢 Prevents the "pull-to-refresh" or bounce
};
const videoWrapperStyle = { flex: 1, width: "100%", height: "100%", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer", touchAction: "manipulation" };
const controlsTransitionStyle = { transition: "opacity 0.4s ease-in-out", zIndex: 10006 };
const bottomGradientStyle = { position: "absolute", bottom: 0, left: 0, right: 0, height: "120px", background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)", pointerEvents: "none", transition: "opacity 0.4s ease-in-out", zIndex: 10001 };
const topGradientStyle = { position: "absolute", top: 0, left: 0, right: 0, height: "100px", background: "linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)", pointerEvents: "none", transition: "opacity 0.4s ease-in-out", zIndex: 10005 };
const progressWrapperStyle = { position: "absolute", zIndex: 10002, display: "flex", alignItems: "center", transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" };
const rangeInputBaseStyle = { width: "100%", cursor: "pointer", accentColor: "#ff3b30", background: "rgba(255,255,255,0.2)", appearance: "none", outline: "none", transition: "all 0.3s" };
const mobileBackButtonStyle = { position: "absolute", top: "max(20px, env(safe-area-inset-top))", left: "20px", background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: "50%", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)" };
const desktopCloseButtonStyle = { position: "absolute", top: "30px", right: "30px", background: "rgba(255,255,255,0.1)", color: "#fff", border: "none", borderRadius: "50%", width: "48px", height: "48px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(5px)" };
const zoomToggleButtonStyle = { position: "absolute", right: "20px", bottom: "80px", background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", borderRadius: "8px", padding: "10px", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)", transition: "opacity 0.4s", zIndex: 10005 };
const playIconOverlayStyle = { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.4)", borderRadius: "50%", padding: "20px", pointerEvents: "none" };