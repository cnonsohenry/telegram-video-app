import React, { useEffect, useRef, useState } from "react";
import { X, ArrowLeft, Play, Loader2, Maximize2 } from "lucide-react"; // 🟢 Added Maximize icon

export default function FullscreenPlayer({ video, onClose, isDesktop }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null); // 🟢 1. Ref for the main container
  const [isPlaying, setIsPlaying] = useState(true);
  const [showPlayIcon, setShowPlayIcon] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);

  // 🟢 2. Lock Scroll on Mount
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = "auto"; };
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

  // 🟢 3. Attempt Fullscreen on Interaction
  const attemptFullscreen = () => {
    if (!isDesktop && containerRef.current) {
      if (!document.fullscreenElement) {
        containerRef.current.requestFullscreen().catch((err) => {
          // Safari on iPhone doesn't support this, so we silently fail
          console.log("Fullscreen not supported or blocked:", err);
        });
      }
    }
  };

  const togglePlay = (e) => {
    e.stopPropagation(); 
    
    // 🟢 Trigger Fullscreen on first tap (Android/Desktop)
    attemptFullscreen();

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
      ref={containerRef} // 🟢 Attach ref here
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,1)", // Solid black for immersion
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

      {/* 🟢 MAIN MODAL WRAPPER */}
      <div
        style={{
          display: "flex",
          flexDirection: isDesktop ? "row" : "column",
          width: isDesktop ? "85vw" : "100%", 
          // 🟢 100dvh is crucial for mobile browsers to ignore the address bar area
          height: isDesktop ? "85vh" : "100dvh",
          maxWidth: isDesktop ? "1100px" : "none",
          background: "#000",
          borderRadius: isDesktop ? "12px" : "0px",
          overflow: "hidden",
          position: "relative",
          boxShadow: isDesktop ? "0 25px 50px rgba(0,0,0,0.5)" : "none",
        }}
        onClick={(e) => e.stopPropagation()} 
      >
        
        {/* 🟢 VIDEO AREA */}
        <div 
          onClick={togglePlay}
          style={{ 
            flex: 1, 
            minWidth: 0, 
            height: "100%", 
            background: "#000", 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            position: "relative"
          }}
        >
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
            playsInline // 🟢 KEEPS it in your custom player instead of Apple's native one
            loop
            onTimeUpdate={handleTimeUpdate}
            onWaiting={() => setIsLoading(true)}
            onCanPlay={() => setIsLoading(false)}
            style={{ 
                width: "100%", 
                height: "100%", 
                objectFit: "contain" 
            }}
          />

          {(!isPlaying || showPlayIcon) && !isLoading && (
            <div style={playIconOverlayStyle}>
              <Play size={40} fill="white" color="white" />
            </div>
          )}

          {/* Progress Bar */}
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
            <div style={{ padding: "20px", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #222" }}>
               <img 
                 src={video.avatar_url || "/assets/default-avatar.png"} 
                 onError={(e) => { e.target.onerror = null; e.target.src = "/assets/default-avatar.png"; }}
                 style={{ width: 40, height: 40, borderRadius: "50%", border: "1px solid #333" }} 
                 alt="User"
               />
               <div style={{ display: "flex", flexDirection: "column" }}>
                 <span style={{ color: "#fff", fontWeight: "700", fontSize: "15px" }}>@{video.uploader_name || 'Member'}</span>
                 <span style={{ color: "#888", fontSize: "12px" }}>Original Audio</span>
               </div>
            </div>

            <div style={{ flex: 1, padding: "20px", overflowY: "auto", color: "#ccc", fontSize: "14px", lineHeight: "1.6" }}>
              {video.caption ? video.caption : <span style={{ fontStyle: "italic", color: "#666" }}>No caption provided.</span>}
              <div style={{ marginTop: "30px", borderTop: "1px solid #222", paddingTop: "20px" }}>
                 <h4 style={{ margin: "0 0 10px 0", color: "#fff", fontSize: "14px" }}>Comments</h4>
                 <p style={{ color: "#666", fontSize: "13px" }}>No comments yet. Be the first to say something!</p>
              </div>
            </div>
            
            <div style={{ padding: "20px", borderTop: "1px solid #222", background: "#050505" }}>
               <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ color: "#fff", fontWeight: "bold" }}>{Number(video.views || 0).toLocaleString()} views</span>
                  <span style={{ color: "#888", fontSize: "12px" }}>{new Date(video.created_at).toLocaleDateString()}</span>
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
  position: "absolute", top: "20px", left: "20px", zIndex: 10002,
  background: "rgba(0,0,0,0.4)", color: "#fff", border: "none",
  borderRadius: "50%", width: "44px", height: "44px",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
  backdropFilter: "blur(5px)"
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
  position: "absolute", bottom: "10px", left: "10px", right: "10px", zIndex: 10002,
  display: "flex", alignItems: "center"
};

const rangeInputStyle = {
  width: "100%", cursor: "pointer", accentColor: "#ff3b30", height: "4px"
};