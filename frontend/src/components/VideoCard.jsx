import React, { useEffect, useRef, useState, useMemo } from "react";
import { Play, Copy, Lock } from 'lucide-react';

import { APP_CONFIG } from "../config";
import { renderClickableCaption } from "./ClickableCaption";
import { formatTwitterDate, getPostDisplayName } from "../utils/date";
import TwitterVerifiedBadge from "./TwitterVerifiedBadge";
import { resolveAvatar, handleAvatarError } from "../utils/avatar";

// Global loaded image cache to guarantee 0ms instant display without blink on re-mounts/scroll
export const loadedThumbnailsCache = new Set();

function VideoCard({ video, onOpen, showDetails = true, priority = false, onCreatorClick }) {
  const videoRef = useRef(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);

  const thumbSrc = useMemo(() => {
    let url = video.thumbnail_url;
    if (!url && video.chat_id && video.message_id) {
      if (video.chat_id === "internal") {
        url = `https://bucket.naijahomemade.com/thumbs/internal_${video.message_id}.jpg`;
      } else {
        url = `/api/thumbnail?chat_id=${video.chat_id}&message_id=${video.message_id}`;
      }
    }
    if (!url) return '';
    // Canonicalize internal URLs directly to CDN (bypasses 301 redirects completely)
    if (url.includes('chat_id=internal') && url.includes('message_id=')) {
      const match = url.match(/message_id=([^&]+)/);
      if (match && match[1]) {
        return `https://bucket.naijahomemade.com/thumbs/internal_${match[1]}.jpg`;
      }
    }
    if (url.includes('/api/thumb?')) {
      url = url.replace('/api/thumb?', '/api/thumbnail?');
    }
    if (url.startsWith('/')) {
      url = `${APP_CONFIG.apiUrl}${url}`;
    }
    return url;
  }, [video.thumbnail_url, video.chat_id, video.message_id]);

  const [isImgLoaded, setIsImgLoaded] = useState(() => {
    if (!thumbSrc) return false;
    return loadedThumbnailsCache.has(thumbSrc);
  });

  useEffect(() => {
    if (thumbSrc && loadedThumbnailsCache.has(thumbSrc)) {
      setIsImgLoaded(true);
    }
  }, [thumbSrc]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { setIsVisible(entry.isIntersecting); },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, []);

  const hlsRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el || !video.video_url) return;

    if (isVisible && isHovered) {
      if (video.video_url.includes('.m3u8') && window.Hls && window.Hls.isSupported()) {
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
  }, [isVisible, isHovered, video.video_url]);

  return (
    <a
      href={`${APP_CONFIG.apiUrl}/v/${video.message_id}`}
      onClick={(e) => {
        e.preventDefault(); 
        onOpen(video, e);   
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex", 
        flexDirection: "column",
        background: "transparent", 
        borderRadius: showDetails ? "12px" : "6px",
        width: "100%", 
        cursor: "pointer", 
        position: "relative",
        transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: isHovered ? "translateY(-3px)" : "translateY(0)",
        zIndex: isHovered ? 10 : 1,
        textDecoration: "none", 
        color: "inherit"        
      }}
    >
      <div style={{ 
        position: "relative", 
        width: "100%", 
        aspectRatio: "9/16",
        objectFit: "cover", 
        background: "#18181b", 
        overflow: "hidden",
        borderRadius: showDetails ? "12px" : "6px",
        flexShrink: 0,
        transform: "translateZ(0)",
        WebkitTransform: "translateZ(0)",
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        contain: "paint"
      }}>
        
        {!isImgLoaded && !hasError && (
          <div style={{
            position: "absolute", inset: 0, zIndex: 1,
            backgroundColor: "#18181b",
            background: "linear-gradient(90deg, #18181b 25%, #27272a 50%, #18181b 75%)",
            backgroundSize: "200% 100%",
            animation: "skeleton-loading 1.5s infinite"
          }} />
        )}

        {thumbSrc && !hasError && (
          <img 
            src={thumbSrc} 
            alt={video.caption ? `${video.caption} - Naija video thumbnail` : "Naija video thumbnail"}
            aria-label="Thumbnail"
            loading={priority ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={priority ? "high" : "auto"}
            onLoad={() => {
              loadedThumbnailsCache.add(thumbSrc);
              setIsImgLoaded(true);
            }}
            onError={() => { 
              setIsImgLoaded(true); 
              setHasError(true);
            }}
            style={{
              width: "100%", height: "100%", 
              objectFit: "cover", 
              position: "absolute", inset: 0, zIndex: 2,
              opacity: isImgLoaded ? 1 : 0,
              transition: loadedThumbnailsCache.has(thumbSrc) ? "none" : "opacity 0.2s ease-out",
              transform: "translateZ(0)",
              WebkitTransform: "translateZ(0)",
              backfaceVisibility: "hidden",
              WebkitBackfaceVisibility: "hidden"
            }}
          />
        )}

        <video
          ref={videoRef}
          preload="none" 
          muted loop playsInline
          controlsList="nodownload noplaybackrate noremoteplayback"
          disablePictureInPicture
          disableRemotePlayback
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDragStart={(e) => e.preventDefault()}
          onPlaying={() => setIsVideoReady(true)}
          style={{ 
            width: "100%", height: "100%", objectFit: "cover", 
            position: "absolute", inset: 0, zIndex: 3,
            opacity: (isHovered && isVideoReady) ? 1 : 0, 
            transition: "opacity 0.3s ease",
            userSelect: "none",
            WebkitUserSelect: "none",
            WebkitTouchCallout: "none"
          }}
        />

        {/* 🟢 THE FIX: The Edge-Only Blending Layer */}
        <div style={{
          position: "absolute", 
          inset: 0, 
          zIndex: 4, 
          borderRadius: "inherit", 
          pointerEvents: "none", 
          // 1. Center is now "transparent" so the middle pops at 100% brightness
          background: "linear-gradient(180deg, rgba(0,0,0,0.5) 0%, transparent 20%, transparent 75%, rgba(0,0,0,0.85) 100%)",
          // 2. Slightly deeper edge shadow to maintain the smooth melt into the background
          boxShadow: "inset 0px 0px 24px 2px rgba(0, 0, 0, 0.75)"
        }} />
        
        {video.is_group && (
          <div style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            background: "rgba(0,0,0,0.4)",
            padding: "6px",
            borderRadius: "8px",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 11 
          }}>
            <Copy size={16} color="#d4d4d8" />
          </div>
        )}

        {(video.category === "premium" || video.is_premium) && (
          <div style={{
            position: "absolute",
            top: "10px",
            left: "10px",
            background: "rgba(0, 0, 0, 0.55)",
            color: "#d4d4d8",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            padding: "3px 8px",
            borderRadius: "6px",
            fontSize: "10px",
            fontWeight: "800",
            letterSpacing: "0.5px",
            display: "flex",
            alignItems: "center",
            zIndex: 11,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
          }}>
            <span>VIP</span>
          </div>
        )}

        {!(video.category === "premium" || video.is_premium) && (
          <div style={{
            position: "absolute", bottom: 8, left: 8, zIndex: 10, 
            display: "flex", alignItems: "center", gap: 4,
            pointerEvents: "none"
          }}>
            <Play size={10} fill="#d4d4d8" strokeWidth={0} style={{ filter: "drop-shadow(0 1px 2px rgba(0,0,0,0.85))" }} />
            <span style={{ color: "#d4d4d8", fontSize: "11px", fontWeight: "700", textShadow: "0 1px 3px rgba(0,0,0,0.85)" }}>
              {Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(video.views || 0))}
            </span>
          </div>
        )}
      </div>

      {showDetails && (
        <div style={{ padding: "12px 4px", display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <p style={captionTextStyle}>
            {renderClickableCaption(video.caption || APP_CONFIG.defaultCaption, onCreatorClick)}
          </p>
          
          <div 
            style={{ ...userInfoRowStyle, cursor: (video.uploader_handle || video.uploader_name) ? "pointer" : "default" }}
            onClick={(e) => {
              const handle = video.uploader_handle || video.uploader_name;
              if (handle) {
                e.preventDefault();
                e.stopPropagation();
                if (onCreatorClick) {
                  onCreatorClick(handle);
                } else {
                  window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: handle }));
                }
              }
            }}
            title={video.uploader_handle ? `View @${video.uploader_handle}'s profile` : (video.uploader_name ? `View ${video.uploader_name}'s profile` : "")}
          >
            <div style={avatarWrapperStyle}>
               <img 
                 src={resolveAvatar(video.avatar_url || (video.uploader_id ? `${APP_CONFIG.apiUrl}/avatar.jpg?user_id=${video.uploader_id}&v=2` : (video.uploader_handle ? `${APP_CONFIG.apiUrl}/avatar.jpg?username=${encodeURIComponent(video.uploader_handle)}&v=2` : "")), getPostDisplayName(video), video.uploader_id || video.uploader_handle)}
                 alt={getPostDisplayName(video)}
                 loading="lazy"
                 decoding="async"
                 onError={(e) => handleAvatarError(e, getPostDisplayName(video), video.uploader_id || video.uploader_handle)}
                 style={{ width: "100%", height: "100%", objectFit: "cover" }}
               />
            </div>
            <span style={uploaderNameStyle}>
              {getPostDisplayName(video)}
            </span>
            <TwitterVerifiedBadge size={11} style={{ flexShrink: 0 }} />
            {(video.uploader_handle || video.creator_username || video.creator?.username) && (
              <span style={{ fontSize: "10px", color: "#71767b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flexShrink: 1, minWidth: 0 }}>
                @{String(video.uploader_handle || video.creator_username || video.creator?.username).replace(/^@/, '')}
              </span>
            )}
            {video.created_at && (
              <span style={postDateStyle}>
                &middot; {formatTwitterDate(video.created_at)}
              </span>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes skeleton-loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </a>
  );
}

export default React.memo(VideoCard, (prevProps, nextProps) => {
  return (
    prevProps.video.id === nextProps.video.id &&
    prevProps.video.message_id === nextProps.video.message_id &&
    prevProps.video.views === nextProps.video.views &&
    prevProps.video.likes === nextProps.video.likes &&
    prevProps.priority === nextProps.priority &&
    prevProps.showDetails === nextProps.showDetails &&
    prevProps.video.thumbnail_url === nextProps.video.thumbnail_url
  );
});

const captionTextStyle = { margin: "0 0 6px 0", fontSize: "12px", color: "#c4c4c8", lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical", overflow: "hidden", fontWeight: "500" };
const userInfoRowStyle = { display: "flex", alignItems: "center", gap: "8px" };
const avatarWrapperStyle = { width: "14px", height: "14px", borderRadius: "50%", background: "#1a1a1a", overflow: "hidden", flexShrink: 0, border: "1px solid rgba(255,255,255,0.08)" };
const uploaderNameStyle = { fontSize: "10px", color: "#8e8e93", fontWeight: "600", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "140px" };
const postDateStyle = { fontSize: "10px", color: "#71767b", whiteSpace: "nowrap", flexShrink: 0 };