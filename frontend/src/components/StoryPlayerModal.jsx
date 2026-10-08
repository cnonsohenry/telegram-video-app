import React, { useState, useEffect, useRef, useCallback } from "react";
import useModalHistory from "../hooks/useModalHistory";

export function StoryPlayerModal({ isOpen, onClose, story, creator }) {
  const handleSafeClose = useModalHistory(isOpen, onClose, "storyPlayer");
  const videoRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const pauseTimeoutRef = useRef(null);

  // Reset when story or open state changes
  useEffect(() => {
    if (isOpen) {
      setProgress(0);
      setIsPaused(false);
      setIsVideoReady(false);
    }
  }, [isOpen, story]);

  // Video time tracking
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const duration = videoRef.current.duration || 10;
    const current = videoRef.current.currentTime;
    const pct = Math.min(100, (current / duration) * 100);
    setProgress(pct);
  };

  const handleVideoEnded = () => {
    handleSafeClose();
  };

  // Tap-and-hold to pause story
  const handlePointerDown = () => {
    pauseTimeoutRef.current = setTimeout(() => {
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setIsPaused(true);
      }
    }, 150);
  };

  const handlePointerUp = () => {
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
    }
    if (videoRef.current && isPaused) {
      videoRef.current.play().catch(() => {});
      setIsPaused(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleSafeClose();
      } else if (e.key === " ") {
        e.preventDefault();
        if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play();
            setIsPaused(false);
          } else {
            videoRef.current.pause();
            setIsPaused(true);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleSafeClose]);

  if (!isOpen || !story) return null;

  const displayName = creator?.display_name || story.display_name || creator?.username || story.username;
  const username = creator?.username || story.username;
  const avatarUrl = creator?.avatar_url || story.avatar_url || "/assets/default-avatar.png";
  const soundTitle = story.sound_title || "Trending TikTok Sound";
  const videoSrc = story.video_url || story.raw_video_url;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 99999,
        backgroundColor: "rgba(0, 0, 0, 0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden"
      }}
    >
      {/* Story Container (Vertical 9:16 mobile frame on desktop, full screen on mobile) */}
      <div
        onMouseDown={handlePointerDown}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchEnd={handlePointerUp}
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "460px",
          height: "100%",
          maxHeight: "920px",
          backgroundColor: "#000",
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0, 0, 0, 0.8)",
          display: "flex",
          flexDirection: "column",
          userSelect: "none"
        }}
      >
        {/* Background Video Element */}
        <video
          ref={videoRef}
          src={videoSrc}
          playsInline
          autoPlay
          muted={isMuted}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleVideoEnded}
          onCanPlay={() => setIsVideoReady(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            backgroundColor: "#09090b"
          }}
        />

        {/* Top Gradient Shadow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "140px",
            background: "linear-gradient(to bottom, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 100%)",
            pointerEvents: "none",
            zIndex: 10
          }}
        />

        {/* Bottom Gradient Shadow */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: "160px",
            background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0) 100%)",
            pointerEvents: "none",
            zIndex: 10
          }}
        />

        {/* Top Header & Segmented Progress Bar */}
        <div
          style={{
            position: "relative",
            zIndex: 20,
            padding: "16px 16px 8px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}
        >
          {/* Segmented Story Progress Bar */}
          <div style={{ display: "flex", gap: "6px", width: "100%" }}>
            <div
              style={{
                flex: 1,
                height: "3.5px",
                backgroundColor: "rgba(255, 255, 255, 0.3)",
                borderRadius: "3px",
                overflow: "hidden"
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  backgroundColor: "#ffffff",
                  transition: isPaused ? "none" : "width 0.1s linear"
                }}
              />
            </div>
          </div>

          {/* Creator Profile Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  padding: "2px",
                  background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}
              >
                <img
                  src={avatarUrl}
                  alt={displayName}
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    objectFit: "cover",
                    backgroundColor: "#18181b"
                  }}
                />
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: "#fff", fontWeight: "700", fontSize: "15px" }}>
                    {displayName}
                  </span>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="#00d2ff">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: "#00e5ff", fontSize: "12px", fontWeight: "600" }}>
                    Status Story
                  </span>
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>• 24h</span>
                </div>
              </div>
            </div>

            {/* Top Right Controls (Mute & Close) */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsMuted(!isMuted);
                }}
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "none",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#fff"
                }}
                title={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted ? (
                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                  </svg>
                ) : (
                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                  </svg>
                )}
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleSafeClose();
                }}
                style={{
                  background: "rgba(0, 0, 0, 0.4)",
                  border: "none",
                  borderRadius: "50%",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#fff"
                }}
                title="Close Story"
              >
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Center Pause Indicator */}
        {isPaused && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              borderRadius: "50%",
              width: "64px",
              height: "64px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 30,
              pointerEvents: "none"
            }}
          >
            <svg width="28" height="28" fill="#ffffff" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Bottom Audio Info Pill */}
        <div
          style={{
            position: "relative",
            zIndex: 20,
            padding: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between"
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "rgba(0, 0, 0, 0.65)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              padding: "8px 16px",
              borderRadius: "999px",
              border: "1px solid rgba(255, 255, 255, 0.15)"
            }}
          >
            <svg width="16" height="16" fill="#ff007f" viewBox="0 0 24 24">
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
            <span style={{ color: "#f4f4f5", fontSize: "13px", fontWeight: "600" }}>
              {soundTitle}
            </span>
          </div>

          <div
            style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: "12px",
              fontWeight: "600",
              letterSpacing: "0.05em"
            }}
          >
            10s REEL
          </div>
        </div>
      </div>
    </div>
  );
}

export default StoryPlayerModal;
