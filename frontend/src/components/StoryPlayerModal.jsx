import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import useModalHistory from "../hooks/useModalHistory";
import { APP_CONFIG } from "../config";
import { promptLogin } from "../utils/toast";

function formatStoryTimeAgo(story) {
  if (!story) return "";
  let ts = null;
  if (story.created_at) {
    ts = new Date(story.created_at).getTime();
  } else if (story.expires_at) {
    ts = new Date(story.expires_at).getTime() - 24 * 60 * 60 * 1000;
  }
  if (!ts || isNaN(ts)) return "";

  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  return `${diffDays}d ago`;
}

export function StoryPlayerModal({ isOpen, onClose, story, stories, creator }) {
  const handleSafeClose = useModalHistory(isOpen, onClose, "storyPlayer");

  // 🟢 DUAL-PLAYER PING-PONG SLOTS (0ms Instant Transitions, No DOM Re-mounts)
  const videoRef0 = useRef(null);
  const videoRef1 = useRef(null);
  const containerRef = useRef(null);

  const [activeSlot, setActiveSlot] = useState(0); // 0 or 1
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);

  const pauseTimeoutRef = useRef(null);
  const pointerStartRef = useRef({ time: 0, x: 0, y: 0, isHolding: false });
  const lastNavTimeRef = useRef(0);

  // Normalize list of active stories
  const storyList = useMemo(() => {
    if (Array.isArray(stories) && stories.length > 0) return stories;
    if (story) return [story];
    return [];
  }, [stories, story]);

  const currentStory = storyList[currentIndex] || story;

  // Helper to retrieve the currently active video DOM element
  const getActiveVideo = useCallback(() => {
    return activeSlot === 0 ? videoRef0.current : videoRef1.current;
  }, [activeSlot]);

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

  // 🟢 Pause background feed videos when story modal is open, resume when closed
  useEffect(() => {
    if (isOpen) {
      document.querySelectorAll("video").forEach((el) => {
        if (el !== videoRef0.current && el !== videoRef1.current) {
          try { el.pause(); } catch (_) {}
        }
      });
      window.dispatchEvent(new CustomEvent("pauseMainVideo"));
    }
    return () => {
      if (videoRef0.current) {
        try { videoRef0.current.pause(); videoRef0.current.currentTime = 0; } catch (_) {}
      }
      if (videoRef1.current) {
        try { videoRef1.current.pause(); videoRef1.current.currentTime = 0; } catch (_) {}
      }
      window.dispatchEvent(new CustomEvent("resumeMainVideo"));
    };
  }, [isOpen]);

  // Initialize Dual-Player on open: Slot 0 plays current, Slot 1 pre-buffers next
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
      setActiveSlot(0);
      setProgress(0);
      setIsPaused(false);
      setIsVideoReady(false);

      const currentStoryObj = storyList[initIdx];
      const currentUrl = currentStoryObj?.video_url || currentStoryObj?.raw_video_url;

      const nextStoryObj = storyList[initIdx + 1];
      const nextUrl = nextStoryObj?.video_url || nextStoryObj?.raw_video_url;

      if (videoRef0.current && currentUrl) {
        videoRef0.current.src = currentUrl;
        videoRef0.current.currentTime = 0;
        videoRef0.current.play().catch(() => {});
      }

      if (videoRef1.current) {
        if (nextUrl) {
          videoRef1.current.src = nextUrl;
          videoRef1.current.preload = "auto";
          videoRef1.current.load();
        } else {
          videoRef1.current.removeAttribute("src");
        }
      }
    }
  }, [isOpen, story?.id, storyList]);

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

  // Video time tracking (filtered strictly to the active slot)
  const handleTimeUpdate = (e, slotId) => {
    if (slotId !== activeSlot) return;
    const v = e.currentTarget;
    const duration = v.duration || (currentStory?.duration ? parseFloat(currentStory.duration) : 15);
    const current = v.currentTime;
    const pct = Math.min(100, (current / duration) * 100);
    setProgress(pct);
  };

  // Jump directly to an arbitrary story segment
  const jumpToStory = useCallback(
    (targetIdx) => {
      if (targetIdx === currentIndex) {
        const activeVid = getActiveVideo();
        if (activeVid) {
          activeVid.currentTime = 0;
          activeVid.play().catch(() => {});
        }
        setProgress(0);
        return;
      }

      const targetStory = storyList[targetIdx];
      if (!targetStory) return;
      const targetUrl = targetStory.video_url || targetStory.raw_video_url;
      const newSlot = activeSlot === 0 ? 1 : 0;

      const currentVid = activeSlot === 0 ? videoRef0.current : videoRef1.current;
      const targetVid = newSlot === 0 ? videoRef0.current : videoRef1.current;

      if (currentVid) {
        try {
          currentVid.pause();
          currentVid.currentTime = 0;
        } catch (_) {}
      }

      if (targetVid) {
        targetVid.src = targetUrl;
        targetVid.currentTime = 0;
        targetVid.play().catch(() => {});
      }

      // Preload next upcoming story into the standby slot
      const nextStory = storyList[targetIdx + 1];
      if (nextStory && currentVid) {
        const nextUrl = nextStory.video_url || nextStory.raw_video_url;
        if (nextUrl) {
          currentVid.src = nextUrl;
          currentVid.preload = "auto";
          currentVid.load();
        } else {
          currentVid.removeAttribute("src");
        }
      }

      setActiveSlot(newSlot);
      setCurrentIndex(targetIdx);
      setProgress(0);
      setIsVideoReady(true);
    },
    [currentIndex, storyList, activeSlot, getActiveVideo]
  );

  // Debounced, 0ms latency navigation handlers
  const navigateWithDebounce = useCallback(
    (direction) => {
      const now = Date.now();
      if (now - lastNavTimeRef.current < 250) return;
      lastNavTimeRef.current = now;

      if (direction === "next") {
        if (currentIndex < storyList.length - 1) {
          const nextIdx = currentIndex + 1;
          const nextStoryObj = storyList[nextIdx];
          const nextUrl = nextStoryObj?.video_url || nextStoryObj?.raw_video_url;
          const newSlot = activeSlot === 0 ? 1 : 0;

          const currentVideo = activeSlot === 0 ? videoRef0.current : videoRef1.current;
          const upcomingVideo = newSlot === 0 ? videoRef0.current : videoRef1.current;

          // 1. Pause previous video
          if (currentVideo) {
            try {
              currentVideo.pause();
              currentVideo.currentTime = 0;
            } catch (_) {}
          }

          // 2. Play upcoming video (already pre-loaded into hardware buffer!)
          if (upcomingVideo) {
            if (nextUrl && upcomingVideo.src !== nextUrl && !upcomingVideo.src.endsWith(nextUrl)) {
              upcomingVideo.src = nextUrl;
            }
            upcomingVideo.currentTime = 0;
            upcomingVideo.play().catch(() => {});
          }

          // 3. Pre-load the next-next story into the standby slot
          const futureIdx = nextIdx + 1;
          if (futureIdx < storyList.length && currentVideo) {
            const futureStory = storyList[futureIdx];
            const futureUrl = futureStory?.video_url || futureStory?.raw_video_url;
            if (futureUrl) {
              currentVideo.src = futureUrl;
              currentVideo.preload = "auto";
              currentVideo.load();
            } else {
              currentVideo.removeAttribute("src");
            }
          }

          setActiveSlot(newSlot);
          setCurrentIndex(nextIdx);
          setProgress(0);
          setIsVideoReady(true);
        } else {
          handleSafeClose();
        }
      } else if (direction === "prev") {
        const currentVideo = getActiveVideo();
        if (currentVideo && currentVideo.currentTime > 2) {
          currentVideo.currentTime = 0;
          setProgress(0);
          currentVideo.play().catch(() => {});
          return;
        }

        if (currentIndex > 0) {
          const prevIdx = currentIndex - 1;
          const prevStoryObj = storyList[prevIdx];
          const prevUrl = prevStoryObj?.video_url || prevStoryObj?.raw_video_url;
          const newSlot = activeSlot === 0 ? 1 : 0;

          const activeVid = activeSlot === 0 ? videoRef0.current : videoRef1.current;
          const targetVid = newSlot === 0 ? videoRef0.current : videoRef1.current;

          if (activeVid) {
            try {
              activeVid.pause();
              activeVid.currentTime = 0;
            } catch (_) {}
          }

          if (targetVid) {
            if (prevUrl && targetVid.src !== prevUrl && !targetVid.src.endsWith(prevUrl)) {
              targetVid.src = prevUrl;
            }
            targetVid.currentTime = 0;
            targetVid.play().catch(() => {});
          }

          // Preload next story into the standby slot
          const futureStory = storyList[prevIdx + 1];
          const futureUrl = futureStory?.video_url || futureStory?.raw_video_url;
          if (futureUrl && activeVid) {
            activeVid.src = futureUrl;
            activeVid.preload = "auto";
            activeVid.load();
          }

          setActiveSlot(newSlot);
          setCurrentIndex(prevIdx);
          setProgress(0);
          setIsVideoReady(true);
        } else {
          if (currentVideo) {
            currentVideo.currentTime = 0;
            currentVideo.play().catch(() => {});
          }
          setProgress(0);
        }
      }
    },
    [currentIndex, storyList, activeSlot, getActiveVideo, handleSafeClose]
  );

  const goToNext = useCallback(() => navigateWithDebounce("next"), [navigateWithDebounce]);
  const goToPrev = useCallback(() => navigateWithDebounce("prev"), [navigateWithDebounce]);

  const handleVideoEnded = () => {
    goToNext();
  };

  // Pointer Down / Up tap & hold handling (unified across touch and mouse)
  const handlePointerDown = (e) => {
    if (e.button && e.button !== 0) return;
    pointerStartRef.current = {
      time: Date.now(),
      x: e.clientX,
      y: e.clientY,
      isHolding: false
    };

    if (pauseTimeoutRef.current) clearTimeout(pauseTimeoutRef.current);
    pauseTimeoutRef.current = setTimeout(() => {
      pointerStartRef.current.isHolding = true;
      const activeVid = getActiveVideo();
      if (activeVid && !activeVid.paused) {
        activeVid.pause();
        setIsPaused(true);
      }
    }, 200);
  };

  const handlePointerUp = (e) => {
    if (pauseTimeoutRef.current) {
      clearTimeout(pauseTimeoutRef.current);
      pauseTimeoutRef.current = null;
    }

    const activeVid = getActiveVideo();

    if (pointerStartRef.current.isHolding) {
      pointerStartRef.current.isHolding = false;
      if (activeVid && isPaused) {
        activeVid.play().catch(() => {});
        setIsPaused(false);
      }
      return;
    }

    const elapsed = Date.now() - pointerStartRef.current.time;
    // Fast tap (< 250ms): navigate left 35% prev, right 65% next
    if (elapsed < 250 && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      if (clickX < rect.width * 0.35) {
        goToPrev();
      } else {
        goToNext();
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
        const activeVid = getActiveVideo();
        if (activeVid) {
          if (activeVid.paused) {
            activeVid.play().catch(() => {});
            setIsPaused(false);
          } else {
            activeVid.pause();
            setIsPaused(true);
          }
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleSafeClose, goToPrev, goToNext, getActiveVideo]);

  // Volume / Mute Toggle (applies to both players simultaneously)
  const toggleMute = (e) => {
    e.stopPropagation();
    setIsMuted((prev) => {
      const next = !prev;
      if (videoRef0.current) videoRef0.current.muted = next;
      if (videoRef1.current) videoRef1.current.muted = next;
      return next;
    });
  };

  if (!isOpen || !currentStory) return null;

  const displayName =
    creator?.display_name ||
    currentStory.display_name ||
    creator?.username ||
    currentStory.username;
  const avatarUrl =
    creator?.avatar_url || currentStory.avatar_url || "/assets/default-avatar.png";
  const soundTitle = currentStory.sound_title || "Trending Afrobeat Track";
  const storyTimeAgo = formatStoryTimeAgo(currentStory);

  const modalContent = (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000200,
        backgroundColor: "rgba(0, 0, 0, 0.95)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden"
      }}
    >
      {/* Desktop Prev Button (Outside Frame) */}
      {storyList.length > 1 && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
          style={{
            position: "absolute",
            left: "calc(50% - 280px)",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255, 255, 255, 0.2)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: "50%",
            width: "48px",
            height: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#d4d4d8",
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

      {/* Desktop Next Button (Outside Frame) */}
      {storyList.length > 1 && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          style={{
            position: "absolute",
            right: "calc(50% - 280px)",
            top: "50%",
            transform: "translateY(-50%)",
            background: "rgba(255, 255, 255, 0.2)",
            border: "1px solid rgba(255, 255, 255, 0.3)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            borderRadius: "50%",
            width: "48px",
            height: "48px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#d4d4d8",
            cursor: "pointer",
            zIndex: 100,
            transition: "all 0.2s"
          }}
          title={currentIndex < storyList.length - 1 ? "Next Story" : "Close Story"}
        >
          <svg width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Story Container (Vertical 9:16 mobile frame on desktop, full screen on mobile) */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
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
        {/* 🟢 Dual-Player Ping-Pong Slot 0 */}
        <video
          ref={videoRef0}
          preload="auto"
          playsInline
          muted={isMuted}
          onTimeUpdate={(e) => handleTimeUpdate(e, 0)}
          onEnded={() => { if (activeSlot === 0) handleVideoEnded(); }}
          onCanPlay={() => { if (activeSlot === 0) setIsVideoReady(true); }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            backgroundColor: "#09090b",
            opacity: activeSlot === 0 ? 1 : 0,
            zIndex: activeSlot === 0 ? 2 : 1,
            pointerEvents: activeSlot === 0 ? "auto" : "none",
            transition: "opacity 0.12s ease-out"
          }}
        />

        {/* 🟢 Dual-Player Ping-Pong Slot 1 */}
        <video
          ref={videoRef1}
          preload="auto"
          playsInline
          muted={isMuted}
          onTimeUpdate={(e) => handleTimeUpdate(e, 1)}
          onEnded={() => { if (activeSlot === 1) handleVideoEnded(); }}
          onCanPlay={() => { if (activeSlot === 1) setIsVideoReady(true); }}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            backgroundColor: "#09090b",
            opacity: activeSlot === 1 ? 1 : 0,
            zIndex: activeSlot === 1 ? 2 : 1,
            pointerEvents: activeSlot === 1 ? "auto" : "none",
            transition: "opacity 0.12s ease-out"
          }}
        />

        {/* Top Gradient Shadow */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: "150px",
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
            height: "100px",
            background: "linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0) 100%)",
            pointerEvents: "none",
            zIndex: 10
          }}
        />

        {/* Subtle in-frame Chevrons for visual affordance */}
        {storyList.length > 1 && (
          <>
            {currentIndex > 0 && (
              <div
                style={{
                  position: "absolute",
                  left: "12px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  zIndex: 12,
                  pointerEvents: "none",
                  opacity: 0.75,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  backgroundColor: "rgba(0, 0, 0, 0.4)",
                  backdropFilter: "blur(4px)"
                }}
              >
                <svg width="18" height="18" fill="none" stroke="#d4d4d8" strokeWidth="2.5" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </div>
            )}
            <div
              style={{
                position: "absolute",
                right: "12px",
                top: "50%",
                transform: "translateY(-50%)",
                zIndex: 12,
                pointerEvents: "none",
                opacity: 0.75,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                backgroundColor: "rgba(0, 0, 0, 0.4)",
                backdropFilter: "blur(4px)"
              }}
            >
              <svg width="18" height="18" fill="none" stroke="#d4d4d8" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </>
        )}

        {/* Top Controls Overlay */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            zIndex: 20,
            padding: "16px 16px 8px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}
        >
          {/* Sleek Instagram-Style Segmented Story Progress Bar */}
          <div style={{ display: "flex", gap: "3.5px", width: "100%" }}>
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
                    jumpToStory(idx);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    height: "2px",
                    backgroundColor: "rgba(255, 255, 255, 0.35)",
                    borderRadius: "2px",
                    overflow: "hidden",
                    cursor: "pointer"
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${fill}%`,
                      backgroundColor: "#d4d4d8",
                      transition: idx === currentIndex && !isPaused ? "width 0.1s linear" : "none"
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Creator Profile Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
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
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                {/* Creator Display Name & Checkmark */}
                <div style={{ display: "flex", alignItems: "center", gap: "4px", minWidth: 0 }}>
                  <span
                    style={{
                      color: "#d4d4d8",
                      fontSize: "14px",
                      fontWeight: "700",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      textShadow: "0 1px 3px rgba(0, 0, 0, 0.8)"
                    }}
                  >
                    {displayName}
                  </span>
                  <svg width="14" height="14" fill="#1d9bf0" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                </div>

                {/* Song Details & Time Ago */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    marginTop: "2px",
                    minWidth: 0
                  }}
                >
                  <svg width="12" height="12" fill="#ff007f" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                    <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                  </svg>
                  <span
                    style={{
                      color: "rgba(255, 255, 255, 0.88)",
                      fontSize: "12px",
                      fontWeight: "500",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      maxWidth: "180px"
                    }}
                    title={soundTitle}
                  >
                    {soundTitle}
                  </span>
                  {storyTimeAgo && (
                    <span
                      style={{
                        color: "rgba(255, 255, 255, 0.65)",
                        fontSize: "11px",
                        fontWeight: "500",
                        flexShrink: 0
                      }}
                    >
                      • {storyTimeAgo}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Top Right Close Button */}
            <div style={{ display: "flex", alignItems: "center", flexShrink: 0 }}>
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSafeClose();
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  width: "36px",
                  height: "36px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: "#d4d4d8",
                  padding: 0,
                  filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.6))"
                }}
                title="Close Story"
              >
                <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
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
            <svg width="28" height="28" fill="#d4d4d8" viewBox="0 0 24 24">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
            </svg>
          </div>
        )}

        {/* Lower Left Corner Volume / Mute Button */}
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={toggleMute}
          style={{
            position: "absolute",
            bottom: "18px",
            left: "16px",
            zIndex: 35,
            background: "transparent",
            border: "none",
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            color: "#d4d4d8",
            padding: 0,
            filter: "drop-shadow(0 2px 6px rgba(0, 0, 0, 0.7))"
          }}
          title={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? (
            <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
              <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
            </svg>
          ) : (
            <svg width="22" height="22" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export default StoryPlayerModal;
