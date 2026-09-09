import React, { useState, useRef, useEffect } from "react";
import { Play, Copy, Lock, Heart, MessageCircle, Film } from "lucide-react";
import { APP_CONFIG } from "../config";

export default function InstagramMediaCard({ 
  video, 
  onClick, 
  isDesktop = false 
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isImgLoaded, setIsImgLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const cardRef = useRef(null);

  const thumbSrc = React.useMemo(() => {
    let url = video.thumbnail_url;
    if (!url && video.chat_id && video.message_id) {
      url = `/api/thumbnail?chat_id=${video.chat_id}&message_id=${video.message_id}`;
    }
    if (!url) return "";
    if (url.includes("/api/thumb?")) {
      url = url.replace("/api/thumb?", "/api/thumbnail?");
    }
    if (url.startsWith("/")) {
      url = `${APP_CONFIG.apiUrl}${url}`;
    }
    return url.includes("?") ? `${url}&w=500` : `${url}?w=500`;
  }, [video.thumbnail_url, video.chat_id, video.message_id]);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, []);

  // Hover play on desktop like web Instagram
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video.video_url || !isDesktop) return;

    if (isVisible && isHovered) {
      if (video.video_url.includes(".m3u8") && window.Hls && window.Hls.isSupported()) {
        if (!hlsRef.current) {
          hlsRef.current = new window.Hls({ startLevel: 0 });
          hlsRef.current.loadSource(video.video_url);
          hlsRef.current.attachMedia(el);
          hlsRef.current.on(window.Hls.Events.MANIFEST_PARSED, () => {
            el.play().catch(() => {});
          });
        } else {
          el.play().catch(() => {});
        }
      } else {
        if (el.src !== video.video_url) el.src = video.video_url;
        el.play().catch(() => {});
      }
    } else {
      el.pause();
      setIsVideoReady(false);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [isVisible, isHovered, video.video_url, isDesktop]);

  const formattedViews = Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(Number(video.views || 0));

  const formattedLikes = Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1
  }).format(Number(video.likes || Math.max(1, Math.round(Number(video.views || 0) * 0.12))));

  const isLocked = video.category === "premium";

  return (
    <div
      ref={cardRef}
      onClick={(e) => {
        if (onClick) onClick(video, e);
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",
        backgroundColor: "#121214",
        cursor: "pointer",
        overflow: "hidden",
        userSelect: "none",
        transition: "opacity 0.2s ease"
      }}
    >
      {/* Skeleton loader */}
      {!isImgLoaded && !hasError && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 1,
            backgroundColor: "#1a1a1c"
          }}
        />
      )}

      {/* Fallback placeholder if thumbnail is missing or fails to load */}
      {(!thumbSrc || hasError) && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 2,
            backgroundColor: "#16161a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          <Play size={26} color="rgba(255,255,255,0.2)" fill="rgba(255,255,255,0.08)" />
        </div>
      )}

      {/* Thumbnail */}
      {thumbSrc && !hasError && (
        <img
          src={thumbSrc}
          alt=""
          aria-label="Post thumbnail"
          loading="lazy"
          onLoad={() => setIsImgLoaded(true)}
          onError={() => {
            setIsImgLoaded(true);
            setHasError(true);
          }}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            position: "absolute",
            inset: 0,
            zIndex: 2,
            transition: "transform 0.25s ease, filter 0.2s ease",
            transform: isHovered && isDesktop ? "scale(1.02)" : "scale(1)"
          }}
        />
      )}

      {/* Video preview element on desktop hover */}
      {isDesktop && (
        <video
          ref={videoRef}
          preload="none"
          muted
          loop
          playsInline
          onPlaying={() => setIsVideoReady(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            position: "absolute",
            inset: 0,
            zIndex: 3,
            opacity: isHovered && isVideoReady ? 1 : 0,
            transition: "opacity 0.25s ease"
          }}
        />
      )}

      {/* Top-Right Badge (Instagram multi-post or reel or lock) */}
      <div
        style={{
          position: "absolute",
          top: "8px",
          right: "8px",
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          gap: "4px"
        }}
      >
        {video.is_group ? (
          <div style={badgeStyle}>
            <Copy size={13} color="#fff" />
          </div>
        ) : isLocked ? (
          <div style={{ ...badgeStyle, backgroundColor: "rgba(0,0,0,0.65)", border: "1px solid rgba(255,215,0,0.4)" }}>
            <Lock size={12} color="#FFD700" />
          </div>
        ) : (
          <div style={badgeStyle}>
            <Film size={12} color="#fff" />
          </div>
        )}
      </div>

      {/* Bottom-Left View Count (always visible on mobile, or subtle bottom shadow) */}
      <div
        style={{
          position: "absolute",
          bottom: "6px",
          left: "8px",
          zIndex: 5,
          display: "flex",
          alignItems: "center",
          gap: "4px",
          color: "#fff",
          textShadow: "0 1px 4px rgba(0,0,0,0.8)",
          fontSize: "11px",
          fontWeight: "700"
        }}
      >
        <Play size={10} fill="#fff" strokeWidth={0} />
        <span>{formattedViews}</span>
      </div>

      {/* Desktop Hover Overlay (Instagram classic stats overlay) */}
      {isDesktop && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 6,
            backgroundColor: "rgba(0, 0, 0, 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "24px",
            color: "#fff",
            opacity: isHovered ? 1 : 0,
            transition: "opacity 0.2s ease",
            pointerEvents: "none"
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "700", fontSize: "14px" }}>
            <Heart size={18} fill="#fff" color="#fff" />
            <span>{formattedLikes}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: "700", fontSize: "14px" }}>
            <MessageCircle size={18} fill="#fff" color="#fff" />
            <span>{formattedViews}</span>
          </div>
        </div>
      )}
    </div>
  );
}

const badgeStyle = {
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  backdropFilter: "blur(4px)",
  borderRadius: "4px",
  padding: "4px 5px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};
