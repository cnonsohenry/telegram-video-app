import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import useModalHistory from "../hooks/useModalHistory";
import { APP_CONFIG } from "../config";
import { promptLogin } from "../utils/toast";

export function StoryPlayerModal({ isOpen, onClose, story, stories, creator }) {
  const handleSafeClose = useModalHistory(isOpen, onClose, "storyPlayer");
  const videoRef = useRef(null);
  const containerRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const pauseTimeoutRef = useRef(null);
  const pointerStartRef = useRef({ time: 0, x: 0, y: 0 });
  const isHoldingRef = useRef(false);

  // Normalize list of active stories
  const storyList = useMemo(() => {
    if (Array.isArray(stories) && stories.length > 0) return stories;
    if (story) return [story];
    return [];
  }, [stories, story]);

  const [currentIndex, setCurrentIndex] = useState(0);

  // Enforce authentication: Only logged-in users can view stories
  useEffect(() => {
    if (isOpen) {
      const token = localStorage.getItem("token");
      if (!token) {
        promptLogin("view story");
        handleSafeClose();
        return;
      }
    }
  }, [isOpen, handleSafeClose]);

  // Initialize currentIndex to targeted story or first unviewed story upon opening
  useEffect(() => {
    if (isOpen && storyList.length > 0) {
      let initIdx = 0;
      if (story?.id) {
        const found = storyList.findIndex((s) => s.id === story.id);
        if (found !== -1) initIdx = found;
      } else {
        const unviewedIdx = storyList.findIndex((s) => !s.has_viewed);
        if (unviewedIdx !== -1) initIdx = unviewedIdx;
      }
      setCurrentIndex(initIdx);
      setProgress(0);
      setIsPaused(false);
      setIsVideoReady(false);
    }
  }, [isOpen, story?.id, storyList]);

  const currentStory = storyList[currentIndex] || story;

  // Record story view when player is open and currentStory is loaded
  useEffect(() => {
    if (!isOpen || !currentStory) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    const recordStoryView = async () => {
      try {
        const uname = creator?.username || currentStory?.username;
        if (!uname || !currentStory.id) return;

        // Optimistically record in local storage for instant responsiveness
        try {
          const tokenPayload = JSON.parse(atob(token.split(".")[1]));
          const userId = tokenPayload?.id;
          if (userId && currentStory.id) {
            const storageKey = `viewed_stories_${userId}`;
            const currentViews = JSON.parse(localStorage.getItem(storageKey) || "[]");
            if (!currentViews.includes(currentStory.id)) {
              currentViews.push(currentStory.id);
              localStorage.setItem(storageKey, JSON.stringify(currentViews));
            }
          }
        } catch (e) {}

        // Dispatch event so avatar rings in explore/profile immediately update
        window.dispatchEvent(
          new CustomEvent("storyViewed", {
            detail: {
              storyId: currentStory.id,
              username: uname
            }
          })
        );

        // Send view record to backend
        await fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(uname)}/story/view`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ story_id: currentStory.id })
        });
      } catch (err) {
        console.warn("[STORY VIEW RECORD NOTICE]", err);
      }
    };

    recordStoryView();
  }, [isOpen, currentStory?.id, creator?.username, currentStory?.username]);

  // Video time tracking
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const duration =
      videoRef.current.duration ||
      (currentStory?.duration ? parseFloat(currentStory.duration) : 30);
    const current = videoRef.current.currentTime;
    const pct = Math.min(100, (current / duration) * 100);
    setProgress(pct);
  };

  // Navigation handlers
  const goToNext = useCallback(() => {
    if (currentIndex < storyList.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setProgress(0);
      setIsVideoReady(false);
    } else {
      handleSafeClose();
    }
  }, [currentIndex, storyList.length, handleSafeClose]);

  const goToPrev = useCallback(() => {
    if (videoRef.current && videoRef.current.currentTime > 2) {
      videoRef.current.currentTime = 0;
      setProgress(0);
      videoRef.current.play().catch(() => {});
      return;
    }
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      setProgress(0);
      setIsVideoReady(false);
    } else {
      if (videoRef.current) {
        videoRef.current.currentTime = 0;
        videoRef.current.play().catch(() => {});
      }
      setProgress(0);
    }
  }, [currentIndex]);

  const handleVideoEnded = () => {
    goToNext();
  };

  // Tap-and-hold to pause story, quick tap left/right to navigate
  const handlePointerDown = (e) => {
    if (e.button && e.button !== 0) return;
    const clientX = e.clientX ?? (e.touches && e.touches[0]?.clientX) ?? 0;
    const clientY = e.clientY ?? (e.touches && e.touches[0]?.clientY) ?? 0;
    pointerStartRef.current = { time: Date.now(), x: clientX, y: clientY };
    isHoldingRef.current = false;

    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => {
      isHoldingRef.current = true;
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
        setIsPaused(true);
      }
    }, 200);
  };

  const handlePointerUp = (e) => {
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }

    if (isHoldingRef.current) {
      // User held down to pause, now release to resume
      isHoldingRef.current = false;
      if (videoRef.current && isPaused) {
        videoRef.current.play().catch(() => {});
        setIsPaused(false);
      }
      return;
    }

    // Quick tap
    const elapsed = Date.now() - pointerStartRef.current.time;
    if (elapsed < 250) {
      const clientX = e.clientX ?? (e.changedTouches && e.changedTouches[0]?.clientX) ?? 0;
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const clickX = clientX - rect.left;
        if (clickX < rect.width * 0.35) {
          goToPrev();
        } else {
          goToNext();
        }
      }
    }
  };

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleSafeClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goToPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goToNext();
      } else if (e.key === " ") {
        e.preventDefault();
        if (videoRef.current) {
          if (videoRef.current.paused) {
            videoRef.current.play().catch(() => {});
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
  }, [isOpen, handleSafeClose, goToPrev, goToNext]);

  if (!isOpen || !currentStory) return null;

  const displayName =
    creator?.display_name ||
    currentStory.display_name ||
    creator?.username ||
    currentStory.username;
  const username = creator?.username || currentStory.username;
  const avatarUrl =
    creator?.avatar_url || currentStory.avatar_url || "/assets/default-avatar.png";
  const soundTitle = currentStory.sound_title || "Trending TikTok Sound";
  const videoSrc = currentStory.video_url || currentStory.raw_video_url;

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
      {/* Desktop Prev Button */}
      {storyList.length > 1 && currentIndex > 0 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
          style={{
            position: "absolute",
            left: "calc(50% - 290px)",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255, 255, 255, 0.15)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderRadius: "50%",
            width: "48px",
            height: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            cursor: "pointer",
            zIndex: 100,
            transition: "all 0.2s"
          }}
          title="Previous Story"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Desktop Next Button */}
      {storyList.length > 1 && currentIndex < storyList.length - 1 && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          style={{
            position: "absolute",
            right: "calc(50% - 290px)",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255, 255, 255, 0.15)",
            border: "1px solid rgba(255, 255, 255, 0.25)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            borderRadius: "50%",
            width: "48px",
            height: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fff",
            cursor: "pointer",
            zIndex: 100,
            transition: "all 0.2s"
          }}
          title="Next Story"
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Story Container (Vertical 9:16 mobile frame on desktop, full screen on mobile) */}
      <div
        ref={containerRef}
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
          key={currentStory.id || currentIndex}
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
            {storyList.map((item, idx) => {
              let fill = 0;
              if (idx < currentIndex) {
                fill = 100;
              } else if (idx === currentIndex) {
                fill = progress;
              } else {
                fill = 0;
              }
              return (
                <div
                  key={item.id || idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentIndex(idx);
                    setProgress(0);
                    setIsVideoReady(false);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    height: "3.5px",
                    backgroundColor: "rgba(255, 255, 255, 0.3)",
                    borderRadius: "3px",
                    overflow: "hidden",
                    cursor: "pointer"
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${fill}%`,
                      backgroundColor: "#ffffff",
                      transition: idx === currentIndex && !isPaused ? "width 0.1s linear" : "none"
                    }}
                  />
                </div>
              );
            })}
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
                  background: "rgba(255, 255, 255, 0.35)",
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
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ color: "#00e5ff", fontSize: "12px", fontWeight: "600" }}>
                    Status Story
                  </span>
                  {storyList.length > 1 && (
                    <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "12px", fontWeight: "600" }}>
                      ({currentIndex + 1}/{storyList.length})
                    </span>
                  )}
                  <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "12px" }}>• 24h</span>
                </div>
              </div>
            </div>

            {/* Top Right Controls (Mute & Close) */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
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
                    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                  </svg>
                ) : (
                  <svg width="18" height="18" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                  </svg>
                )}
              </button>

              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
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
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
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
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              backgroundColor: "rgba(0, 0, 0, 0.65)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              padding: "8px 16px",
              borderRadius: "999px",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              maxWidth: "80%",
              overflow: "hidden"
            }}
          >
            <svg width="16" height="16" fill="#ff007f" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
            </svg>
            <span
              style={{
                color: "#f4f4f5",
                fontSize: "13px",
                fontWeight: "600",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis"
              }}
            >
              {soundTitle}
            </span>
          </div>

          <div
            style={{
              color: "rgba(255, 255, 255, 0.6)",
              fontSize: "12px",
              fontWeight: "600",
              letterSpacing: "0.05em",
              flexShrink: 0
            }}
          >
            STATUS REEL
          </div>
        </div>
      </div>
    </div>
  );
}

export default StoryPlayerModal;
