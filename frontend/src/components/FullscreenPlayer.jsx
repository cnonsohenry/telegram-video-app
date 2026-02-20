import React, { useEffect, useRef, useState, useCallback } from "react";
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

  // 🟢 1. DEFINE FUNCTIONS FIRST
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    
    // Only set the timer if the video is actually playing
    hideTimeout.current = setTimeout(() => {
      // Use functional update to check latest isPlaying state
      setIsPlaying(playing => {
        if (playing) setShowControls(false);
        return playing;
      });
    }, 3000);
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      const current = videoRef.current.currentTime;
      const duration = videoRef.current.duration;
      if (duration > 0) setProgress((current / duration) * 100);
    }
  };

  const handleInteraction = (e) => {
    if (e) e.stopPropagation();
    resetHideTimer();

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      setIsZoomed(z => !z);
      lastTap.current = 0; 
    } else {
      lastTap.current = now;
      setTimeout(() => {
        if (lastTap.current === now && videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
          } else {
            videoRef.current.pause();
          }
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

  // 🟢 2. EFFECTS (After function definitions)
  useEffect(() => {
    const originalStyle = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      top: document.body.style.top,
      width: document.body.style.width,
    };
    const scrollY = window.scrollY;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    const enterFullscreen = async () => {
      try {
        const elem = containerRef.current;
        if (elem?.requestFullscreen) await elem.requestFullscreen();
        else if (videoRef.current?.webkitEnterFullscreen) videoRef.current.webkitEnterFullscreen();
      } catch (err) { console.warn("FS blocked"); }
    };

    enterFullscreen();
    resetHideTimer();

    return () => {
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      document.body.style.overflow = originalStyle.overflow;
      document.body.style.position = originalStyle.position;
      document.body.style.top = originalStyle.top;
      document.body.style.width = originalStyle.width;
      window.scrollTo(0, scrollY);
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, [resetHideTimer]);

  if (!video) return null;

  return (
    <div ref={containerRef} style={overlayStyle} onClick={onClose}>
      {/* Top Controls */}
      <div style={{ ...topGradientStyle, opacity: showControls ? 1 : 0 }}>
        <div style={{ ...controlsTransitionStyle, opacity: showControls ? 1 : 0 }}>
          {!isDesktop ? (
            <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={mobileBackButtonStyle}>
              <ArrowLeft size={28} />
            </button>
          ) : (
            <button onClick={onClose} style={desktopCloseButtonStyle}><X size={24} /></button>
          )}
        </div>
      </div>

      {/* Video Stage */}
      <div style={stageStyle} onClick={(e) => e.stopPropagation()}>
        <div onClick={handleInteraction} style={videoWrapperStyle}>
          {isLoading && (
            <div style={loaderContainerStyle}>
              <Loader2 size={48} color="var(--primary-color)" className="spin-animation" />
            </div>
          )}

          <video
            ref={videoRef}
            src={video.video_url}
            autoPlay playsInline loop
            onTimeUpdate={handleTimeUpdate}
            onWaiting={() => setIsLoading(true)}
            onCanPlay={() => setIsLoading(false)}
            onPlay={() => { setIsPlaying(true); setShowPlayIcon(false); }}
            onPause={() => { setIsPlaying(false); setShowPlayIcon(true); }}
            style={{ 
                width: "100%", height: "100%", 
                objectFit: isZoomed ? "cover" : "contain",
                transition: "object-fit 0.3s ease" 
            }}
          />

          {(!isPlaying || showPlayIcon) && !isLoading && (
            <div style={playIconOverlayStyle}>
              <Play size={40} fill="white" color="white" />
            </div>
          )}

          {/* Bottom UI */}
          <div style={{ ...bottomGradientStyle, opacity: showControls ? 1 : 0 }} />

          <button 
            onClick={(e) => { e.stopPropagation(); setIsZoomed(!isZoomed); resetHideTimer(); }}
            style={{ ...zoomToggleButtonStyle, opacity: showControls ? 1 : 0, pointerEvents: showControls ? "auto" : "none" }}
          >
            {isZoomed ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>

          <div style={{ 
              ...progressWrapperStyle, 
              bottom: showControls ? "max(30px, env(safe-area-inset-bottom))" : "10px",
              padding: showControls ? "0 20px" : "0",
              opacity: 1 // Keep progress visible but mini when controls hide
          }}>
             <input 
               type="range" min="0" max="100" step="0.1"
               value={progress || 0} 
               onChange={(e) => {
                 e.stopPropagation();
                 if (videoRef.current) {
                   videoRef.current.currentTime = (e.target.value / 100) * videoRef.current.duration;
                   setProgress(e.target.value);
                   resetHideTimer();
                 }
               }}
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
        .range-mini { height: 2px !important; pointer-events: none; opacity: 0.5; }
        .range-active::-webkit-slider-thumb { appearance: none; width: 16px; height: 16px; background: #fff; border-radius: 50%; box-shadow: 0 0 10px rgba(0,0,0,0.5); }
        .range-active { height: 6px !important; pointer-events: auto; }
      `}</style>
    </div>
  );
}

// 🖌 STYLES (Keep existing constants from previous message)
const overlayStyle = { position: "fixed", inset: 0, height: "100dvh", backgroundColor: "#000", zIndex: 999999, display: "flex", flexDirection: "column", overflow: "hidden", touchAction: "none" };
const stageStyle = { display: "flex", width: "100%", height: "100%", background: "#000", position: "relative" };
const videoWrapperStyle = { flex: 1, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer" };
const loaderContainerStyle = { position: "absolute", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" };
const controlsTransitionStyle = { transition: "opacity 0.4s ease", zIndex: 10006, width: "100%", height: "100%", position: "relative" };
const topGradientStyle = { position: "absolute", top: 0, left: 0, right: 0, height: "120px", background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)", zIndex: 10005, transition: "opacity 0.4s ease" };
const bottomGradientStyle = { position: "absolute", bottom: 0, left: 0, right: 0, height: "140px", background: "linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0) 100%)", zIndex: 10001, transition: "opacity 0.4s ease", pointerEvents: "none" };
const progressWrapperStyle = { position: "absolute", left: 0, right: 0, zIndex: 10002, transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)" };
const rangeInputBaseStyle = { width: "100%", cursor: "pointer", accentColor: "var(--primary-color)", background: "rgba(255,255,255,0.2)", appearance: "none", outline: "none" };
const mobileBackButtonStyle = { position: "absolute", top: "max(20px, env(safe-area-inset-top))", left: "20px", background: "rgba(0,0,0,0.3)", color: "#fff", border: "none", borderRadius: "50%", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)" };
const desktopCloseButtonStyle = { position: "absolute", top: "30px", right: "30px", background: "rgba(0,0,0,0.3)", color: "#fff", border: "none", borderRadius: "50%", width: "48px", height: "48px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)" };
const zoomToggleButtonStyle = { position: "absolute", right: "20px", bottom: "100px", background: "rgba(0,0,0,0.5)", color: "#fff", border: "none", borderRadius: "10px", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)", zIndex: 10005 };
const playIconOverlayStyle = { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "rgba(0,0,0,0.5)", borderRadius: "50%", padding: "20px", pointerEvents: "none", zIndex: 5 };