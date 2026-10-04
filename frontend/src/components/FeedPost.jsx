import React, { useState, useEffect, useRef } from "react";
import { 
  Heart, MessageCircle, Share2, Eye, Play, Lock, 
  ChevronLeft, ChevronRight, MoreVertical, Bookmark 
} from "lucide-react";
import { APP_CONFIG } from "../config";
import { isUserSubscribedToCreator, getVideoCreatorHandle } from "../utils/subscription";
import { renderClickableCaption } from "./ClickableCaption";
import { promptLogin, showToast } from "../utils/toast";
import { formatTwitterDate, getPostDisplayName } from "../utils/date";

export const postStyle = { 
  padding: "16px", 
  borderBottom: "1px solid var(--border-color, #262626)", 
  display: "flex", 
  flexDirection: "row", 
  animation: "fadeIn 0.3s ease-out" 
};

export const avatarColumnStyle = { marginRight: "12px", flexShrink: 0 };
export const contentColumnStyle = { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 };
const postHeaderStyle = { display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" };
const avatarStyle = { width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", backgroundColor: "#222" };
const usernameStyle = { fontSize: "15px", fontWeight: "700", color: "#fff" };
const timeStyle = { fontSize: "13px", color: "#71767b", textTransform: "none", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const captionStyle = { fontSize: "15px", lineHeight: "1.5", color: "#e7e9ea", margin: "0 0 12px 0", wordWrap: "break-word" };

const videoContainerStyle = { 
  position: "relative", 
  borderRadius: "16px", 
  overflow: "hidden", 
  background: "#111", 
  border: "1px solid #333", 
  cursor: "pointer", 
  maxHeight: "600px" 
};

const thumbnailImgStyle = { width: "100%", height: "auto", maxHeight: "600px", objectFit: "cover", display: "block" };
const playOverlayStyle = { 
  position: "absolute", 
  top: "50%", 
  left: "50%", 
  transform: "translate(-50%, -50%)", 
  width: "48px", 
  height: "48px", 
  borderRadius: "50%", 
  background: "rgba(0, 0, 0, 0.6)", 
  color: "#ffffff", 
  display: "flex", 
  alignItems: "center", 
  justifyContent: "center", 
  boxShadow: "0 4px 16px rgba(0,0,0,0.5)", 
  border: "1.5px solid rgba(255,255,255,0.25)", 
  backdropFilter: "blur(4px)" 
};

const groupBadgeStyle = { 
  position: "absolute", 
  top: "12px", 
  right: "12px", 
  background: "rgba(0,0,0,0.6)", 
  color: "#fff", 
  fontSize: "11px", 
  fontWeight: "700", 
  padding: "3px 8px", 
  borderRadius: "12px", 
  border: "1px solid rgba(255, 255, 255, 0.15)", 
  zIndex: 11 
};

const actionBarStyle = { display: "flex", justifyContent: "space-between", marginTop: "12px", maxWidth: "425px" };
const actionItemStyle = { display: "flex", alignItems: "center", gap: "6px", color: "#71767b", fontSize: "13px", cursor: "pointer", transition: "color 0.2s ease" };

const vipLockedOverlayStyle = {
  position: "absolute",
  inset: 0,
  zIndex: 10,
  background: "rgba(0, 0, 0, 0.45)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  textAlign: "center",
  borderRadius: "inherit"
};

const vipBadgePillStyle = {
  position: "absolute",
  top: "12px",
  left: "12px",
  background: "rgba(0, 0, 0, 0.55)",
  color: "#ffffff",
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
};

const vipLockCenterStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "10px",
  maxWidth: "240px"
};

const vipLockCircleStyle = {
  width: "52px",
  height: "52px",
  borderRadius: "50%",
  background: "rgba(0, 0, 0, 0.5)",
  border: "1px solid rgba(255, 215, 0, 0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)"
};

const vipSubscribeButtonStyle = {
  background: "#fe2c55",
  color: "#ffffff",
  border: "none",
  borderRadius: "100px",
  padding: "10px 18px",
  fontSize: "12.5px",
  fontWeight: "800",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  cursor: "pointer",
  boxShadow: "0 4px 16px rgba(254, 44, 85, 0.4)",
  transition: "transform 0.15s ease",
  marginTop: "4px"
};

const vipUnlockedBadgeStyle = {
  position: "absolute",
  top: "12px",
  left: "12px",
  background: "rgba(0, 0, 0, 0.55)",
  color: "#ffffff",
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
};

const albumWrapperStyle = {
  position: "relative",
  width: "100%",
  margin: "4px 0 8px 0"
};

const albumRowTrackStyle = {
  display: "flex",
  flexDirection: "row",
  gap: "12px",
  overflowX: "auto",
  overflowY: "hidden",
  scrollSnapType: "x mandatory",
  WebkitOverflowScrolling: "touch",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  padding: "4px 2px 8px 2px",
  width: "100%"
};

const albumVideoCardStyle = {
  flex: "0 0 min(260px, 80%)",
  width: "min(260px, 80%)",
  height: "360px",
  borderRadius: "16px",
  overflow: "hidden",
  position: "relative",
  background: "#0e0e0e",
  border: "1.5px solid rgba(255, 255, 255, 0.16)",
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.45)",
  scrollSnapAlign: "start",
  scrollSnapStop: "normal",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0
};

const albumCardCounterStyle = {
  position: "absolute",
  top: "10px",
  right: "10px",
  background: "rgba(0, 0, 0, 0.65)",
  color: "#fff",
  fontSize: "10.5px",
  fontWeight: "700",
  padding: "3px 8px",
  borderRadius: "10px",
  letterSpacing: "0.5px",
  zIndex: 11,
  pointerEvents: "none",
  border: "1px solid rgba(255, 255, 255, 0.16)"
};

const albumLockedCardOverlayStyle = {
  position: "absolute",
  inset: 0,
  background: "rgba(0, 0, 0, 0.38)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10,
  pointerEvents: "none"
};

const albumLockCircleStyle = {
  width: "46px",
  height: "46px",
  borderRadius: "50%",
  background: "rgba(0, 0, 0, 0.65)",
  border: "1.5px solid rgba(255, 215, 0, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.5)"
};

const albumSubscribeBarBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  width: "100%",
  marginTop: "10px",
  padding: "10px 16px",
  borderRadius: "24px",
  background: "#fe2c55",
  border: "none",
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
  boxShadow: "0 4px 16px rgba(254, 44, 85, 0.35)",
  transition: "all 0.18s ease"
};

const albumDotsContainerStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "6px",
  marginTop: "8px"
};

const carouselNavBtnStyle = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  width: "32px",
  height: "32px",
  borderRadius: "50%",
  background: "rgba(0, 0, 0, 0.75)",
  border: "1px solid rgba(255, 255, 255, 0.25)",
  color: "#fff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  zIndex: 15,
  boxShadow: "0 2px 8px rgba(0,0,0,0.5)"
};

export default function FeedPost({ 
  video, 
  isLast = false, 
  lastElementRef = null, 
  onVideoClick, 
  onCommentClick, 
  isAnyModalOpen = false, 
  onCreatorClick, 
  onReportClick, 
  onOptionsClick, 
  user 
}) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState(video.video_url || null);
  
  // Track vertical vs landscape orientation. Default to true (75% width).
  const [isPortrait, setIsPortrait] = useState(true);
  
  const [likesCount, setLikesCount] = useState(Number(video.likes_count || 0));
  const [isLiked, setIsLiked] = useState(false);
  
  const [savesCount, setSavesCount] = useState(Number(video.saves_count || 0));
  const [isSaved, setIsSaved] = useState(false);
  
  const [sharesCount, setSharesCount] = useState(Number(video.shares_count || 0));
  const [commentsCount, setCommentsCount] = useState(Number(video.comments_count || 0));

  const isPremium = video.category === "premium" || video.is_premium === true;
  const isUnlocked = !isPremium || isUserSubscribedToCreator(user, video);
  const creatorHandle = getVideoCreatorHandle(video);
  
  const isAlbum = Boolean(video.is_group);
  const [albumVideos, setAlbumVideos] = useState(() => (Array.isArray(video.group_videos) && video.group_videos.length > 0 ? video.group_videos : (isAlbum ? [video] : [])));
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef(null);

  useEffect(() => {
    if (isAlbum && video.media_group_id && video.media_group_id !== 'none' && albumVideos.length <= 1) {
      let isMounted = true;
      fetch(`${APP_CONFIG.apiUrl}/api/group?media_group_id=${video.media_group_id}`)
        .then(res => res.ok ? res.json() : [])
        .then(groupItems => {
          if (isMounted && Array.isArray(groupItems) && groupItems.length > 0) {
            setAlbumVideos(groupItems);
          }
        })
        .catch(err => console.error("Failed to load album videos in FeedPost", err));
      return () => { isMounted = false; };
    }
  }, [isAlbum, video.media_group_id, albumVideos.length]);

  useEffect(() => {
    const handleCommentAdded = (e) => {
      if (e.detail && String(e.detail.message_id) === String(video.message_id)) {
        setCommentsCount(prev => prev + 1);
      }
    };
    window.addEventListener("commentAdded", handleCommentAdded);
    return () => window.removeEventListener("commentAdded", handleCommentAdded);
  }, [video.message_id]);

  const handleCarouselScroll = (e) => {
    const track = e.currentTarget;
    if (track && track.children) {
      const scrollLeft = track.scrollLeft;
      let closestIdx = 0;
      let minDiff = Infinity;
      for (let i = 0; i < track.children.length; i++) {
        const child = track.children[i];
        const diff = Math.abs(child.offsetLeft - track.offsetLeft - scrollLeft);
        if (diff < minDiff) {
          minDiff = diff;
          closestIdx = i;
        }
      }
      if (closestIdx !== activeSlide) {
        setActiveSlide(closestIdx);
      }
    }
  };

  const scrollToSlide = (index) => {
    if (!carouselRef.current || !carouselRef.current.children) return;
    const target = Math.max(0, Math.min(albumVideos.length - 1, index));
    const child = carouselRef.current.children[target];
    if (child) {
      carouselRef.current.scrollTo({
        left: child.offsetLeft - carouselRef.current.offsetLeft,
        behavior: "smooth"
      });
      setActiveSlide(target);
    }
  };

  const scrollByCards = (direction) => {
    scrollToSlide(activeSlide + direction);
  };

  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);
  const isPlayingRef = useRef(isPlaying);
  const isAnyModalOpenRef = useRef(isAnyModalOpen);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
    isAnyModalOpenRef.current = isAnyModalOpen;
  }, [isPlaying, isAnyModalOpen]);

  useEffect(() => {
    if (!isPlaying) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    fetch(`${APP_CONFIG.apiUrl}/api/interactions/state/${video.message_id}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.ok ? res.json() : {})
    .then(data => {
      if (data.isLiked) setIsLiked(true);
      if (data.isSaved) setIsSaved(true);
    })
    .catch(err => console.error("Failed to fetch interaction state", err));
  }, [isPlaying, video.message_id]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => setIsPlaying(entry.isIntersecting),
      { threshold: 0.4 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => { 
      if (containerRef.current) observer.unobserve(containerRef.current);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    let timer;
    if (isPlaying && isUnlocked) {
      timer = setTimeout(async () => {
        try {
          const token = localStorage.getItem("token");
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const res = await fetch(`${APP_CONFIG.apiUrl}/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}&noview=1`, { headers });
          if (res.ok) {
            const data = await res.json();
            if (data.video_url) setVideoUrl(data.video_url);
          }
        } catch (e) {}
      }, 250); 
    } else if (!isPlaying) {
      // 🟢 Offscreen memory & decoder cleanup to keep mobile devices cool and prevent crashes
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      }
      setVideoUrl(null);
    }
    return () => clearTimeout(timer);
  }, [isPlaying, isUnlocked, video.chat_id, video.message_id]);

  // Attach HLS or video src whenever videoUrl is available
  useEffect(() => {
    const el = videoRef.current;
    if (!videoUrl || !el) return;

    if (videoUrl.includes('.m3u8') && window.Hls && window.Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      const hls = new window.Hls({ 
        startLevel: 1,
        capLevelToPlayerSize: true 
      }); 
      hlsRef.current = hls;
      hls.loadSource(videoUrl);
      hls.attachMedia(el);
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        if (isPlayingRef.current && !isAnyModalOpenRef.current && videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
      });
      hls.on(window.Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case window.Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case window.Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              hls.destroy();
              hlsRef.current = null;
              break;
          }
        }
      });
    } else {
      if (el.src !== videoUrl) {
        el.src = videoUrl;
      }
      const handleCanPlay = () => {
        if (isPlayingRef.current && !isAnyModalOpenRef.current && videoRef.current) {
          videoRef.current.muted = true;
          videoRef.current.play().catch(() => {});
        }
      };
      el.addEventListener('canplay', handleCanPlay, { once: true });
      if (isPlayingRef.current && !isAnyModalOpenRef.current) {
        el.muted = true;
        el.play().catch(() => {});
      }
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [videoUrl]);

  // Control playback: pause when offscreen or modal open; play when onscreen & no modal
  useEffect(() => {
    const el = videoRef.current;
    if (!el || !videoUrl) return;

    if (isPlaying && !isAnyModalOpen) {
      el.muted = true;
      const playPromise = el.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {});
      }
    } else {
      el.pause();
      if (!isPlaying) {
        try {
          el.currentTime = 0;
        } catch (e) {}
      }
    }
  }, [isPlaying, isAnyModalOpen, videoUrl]);

  const handleLike = async (e) => {
    e.stopPropagation();
    const token = localStorage.getItem("token");
    if (!token) return promptLogin("like");

    setIsLiked(!isLiked);
    setLikesCount(prev => isLiked ? Math.max(0, prev - 1) : prev + 1);

    try {
      await fetch(`${APP_CONFIG.apiUrl}/api/interactions/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message_id: video.message_id })
      });
    } catch (err) {}
  };

  const handleSave = async (e) => {
    e.stopPropagation();
    const token = localStorage.getItem("token");
    if (!token) return promptLogin("save");

    setIsSaved(!isSaved);
    setSavesCount(prev => isSaved ? Math.max(0, prev - 1) : prev + 1);

    try {
      await fetch(`${APP_CONFIG.apiUrl}/api/interactions/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message_id: video.message_id })
      });
    } catch (err) {}
  };

  const handleShare = async (e) => {
    e.stopPropagation();
    if (isPremium) return;
    const shareUrl = `${window.location.origin}/v/${video.message_id}`;
    
    if (navigator.share) {
      navigator.share({ title: video.caption, url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      showToast("Link copied to clipboard!", "success");
    }

    setSharesCount(prev => prev + 1);
    fetch(`${APP_CONFIG.apiUrl}/api/interactions/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message_id: video.message_id })
    }).catch(() => {});
  };

  const handleCommentClick = (e) => {
    e.stopPropagation();
    const token = localStorage.getItem("token");
    if (!token) return promptLogin("comment");
    
    if (onCommentClick) {
      onCommentClick(video);
    } else {
      window.dispatchEvent(new CustomEvent("openCommentModal", { detail: { video } }));
    }
  };

  const handleMediaLoad = (e) => {
    const w = e.target.naturalWidth || e.target.videoWidth;
    const h = e.target.naturalHeight || e.target.videoHeight;
    if (w && h) {
      setIsPortrait(h > w);
    }
  };

  const uploaderId = video.uploader_id || video.user_id || video.creator_id || (video.creator && video.creator.id);
  const avatarUrl = video.avatar_url || video.creator?.avatar_url || (uploaderId ? `${APP_CONFIG.apiUrl}/api/avatar?user_id=${uploaderId}` : '/assets/default-avatar.png');
  const displayName = getPostDisplayName(video);
  const formattedDate = formatTwitterDate(video.created_at);

  return (
    <div ref={isLast ? lastElementRef : null} style={postStyle}>
      <div 
        style={{ ...avatarColumnStyle, cursor: onCreatorClick ? "pointer" : "default" }}
        onClick={(e) => {
          if (onCreatorClick) {
            e.stopPropagation();
            onCreatorClick(creatorHandle);
          }
        }}
      >
        <img 
          src={avatarUrl}
          alt={displayName}
          onError={(e) => { e.target.src = '/assets/default-avatar.png'; }}
          style={avatarStyle}
        />
      </div>

      <div style={contentColumnStyle}>
        <div style={{ ...postHeaderStyle, justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, overflow: "hidden" }}>
            <span 
              style={{ ...usernameStyle, cursor: onCreatorClick ? "pointer" : "default" }}
              onClick={(e) => {
                if (onCreatorClick) {
                  e.stopPropagation();
                  onCreatorClick(creatorHandle);
                }
              }}
            >
              {displayName}
            </span>
            {formattedDate && (
              <span style={timeStyle}>
                &middot; {formattedDate}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onOptionsClick) onOptionsClick(video);
            }}
            style={{
              background: "none",
              border: "none",
              color: "#71767b",
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              flexShrink: 0,
              width: "28px",
              height: "28px",
              transition: "background-color 0.15s ease, color 0.15s ease"
            }}
            title="More"
            aria-label="More options"
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(239, 243, 244, 0.1)";
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "#71767b";
            }}
          >
            <MoreVertical size={16} />
          </button>
        </div>

        <p style={captionStyle}>
          {renderClickableCaption(video.caption || APP_CONFIG.defaultCaption, onCreatorClick)}
        </p>

        {/* 🟢 Album: Separate videos with clear boundaries, aligned horizontally and swipable */}
        {isAlbum && albumVideos.length > 1 ? (
          <div ref={containerRef} style={albumWrapperStyle}>
            {/* Desktop Nav Arrows (Left / Right) */}
            {activeSlide > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  scrollByCards(-1);
                }}
                style={{ ...carouselNavBtnStyle, left: "6px" }}
                aria-label="Previous video"
              >
                <ChevronLeft size={18} color="#fff" />
              </button>
            )}

            {activeSlide < albumVideos.length - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  scrollByCards(1);
                }}
                style={{ ...carouselNavBtnStyle, right: "6px" }}
                aria-label="Next video"
              >
                <ChevronRight size={18} color="#fff" />
              </button>
            )}

            {/* Horizontal Swipable Track of Separate Videos */}
            <div
              ref={carouselRef}
              onScroll={handleCarouselScroll}
              style={albumRowTrackStyle}
            >
              {albumVideos.map((item, idx) => (
                <div
                  key={item.message_id || item.id || idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isUnlocked) {
                      const token = localStorage.getItem("token");
                      if (!token) {
                        promptLogin("subscribe");
                        return;
                      }
                      if (onCreatorClick) {
                        onCreatorClick(creatorHandle, { autoSubscribe: true });
                      } else {
                        window.dispatchEvent(new CustomEvent("openCreatorProfile", { 
                          detail: { username: creatorHandle, autoSubscribe: true } 
                        }));
                      }
                      return;
                    }
                    if (onVideoClick) {
                      onVideoClick({ ...item, video_url: idx === 0 ? videoUrl : null });
                    }
                  }}
                  style={albumVideoCardStyle}
                >
                  {/* Thumbnail / Video */}
                  {idx === 0 && isPlaying && videoUrl && isUnlocked ? (
                    <video 
                      ref={videoRef} 
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }} 
                      muted 
                      loop 
                      playsInline 
                      controlsList="nodownload noplaybackrate noremoteplayback"
                      disablePictureInPicture
                      disableRemotePlayback
                      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      onDragStart={(e) => e.preventDefault()}
                      poster={item.thumbnail_url} 
                      preload="metadata" 
                      onLoadedMetadata={handleMediaLoad} 
                    />
                  ) : (
                    <img 
                      src={item.thumbnail_url} 
                      alt={`Video ${idx + 1}`} 
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} 
                      loading="lazy" 
                      onLoad={handleMediaLoad} 
                    />
                  )}

                  {/* VIP Badge on Top Left */}
                  {isPremium && (
                    <div style={vipBadgePillStyle}>
                      <span>VIP</span>
                    </div>
                  )}

                  {/* Clip index counter on Top Right */}
                  <div style={albumCardCounterStyle}>
                    {idx + 1} / {albumVideos.length}
                  </div>

                  {/* Unlocked Play Icon Overlay */}
                  {isUnlocked && (!isPlaying || idx !== 0 || isAnyModalOpen) && (
                    <div style={playOverlayStyle}>
                      <Play size={24} fill="#fff" strokeWidth={0} />
                    </div>
                  )}

                  {/* Locked Overlay */}
                  {!isUnlocked && (
                    <div style={albumLockedCardOverlayStyle}>
                      <div style={albumLockCircleStyle}>
                        <Lock size={20} color="#FFD700" />
                      </div>
                      <span style={{ color: "#fff", fontSize: "11px", fontWeight: "800", marginTop: "6px", letterSpacing: "0.5px" }}>
                        Locked
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Indicator Dots Below Row */}
            <div style={albumDotsContainerStyle}>
              {albumVideos.map((_, dotIdx) => (
                <div
                  key={dotIdx}
                  onClick={(e) => {
                    e.stopPropagation();
                    scrollToSlide(dotIdx);
                  }}
                  style={{
                    width: dotIdx === activeSlide ? "16px" : "6px",
                    height: "6px",
                    borderRadius: "3px",
                    background: dotIdx === activeSlide ? "#ffffff" : "rgba(255, 255, 255, 0.3)",
                    cursor: "pointer",
                    transition: "all 0.2s ease"
                  }}
                />
              ))}
            </div>

            {/* If Locked: Actionable subscribe button below row */}
            {!isUnlocked && (
              <button
                type="button"
                style={albumSubscribeBarBtnStyle}
                onClick={(e) => {
                  e.stopPropagation();
                  const token = localStorage.getItem("token");
                  if (!token) {
                    promptLogin("subscribe");
                    return;
                  }
                  if (onCreatorClick) {
                    onCreatorClick(creatorHandle, { autoSubscribe: true });
                  } else {
                    window.dispatchEvent(new CustomEvent("openCreatorProfile", { 
                      detail: { username: creatorHandle, autoSubscribe: true } 
                    }));
                  }
                }}
              >
                <Lock size={14} color="#ffffff" />
                <span>Subscribe</span>
              </button>
            )}
          </div>
        ) : (
          /* Standard Single Video Post */
          <div 
            ref={containerRef} 
            style={{ ...videoContainerStyle, width: isPortrait ? "75%" : "100%" }} 
            onClick={() => {
              if (!isUnlocked) {
                const token = localStorage.getItem("token");
                if (!token) {
                  promptLogin("subscribe");
                  return;
                }
                if (onCreatorClick) {
                  onCreatorClick(creatorHandle, { autoSubscribe: true });
                } else {
                  window.dispatchEvent(new CustomEvent("openCreatorProfile", { 
                    detail: { username: creatorHandle, autoSubscribe: true } 
                  }));
                }
                return;
              }
              if (onVideoClick) {
                onVideoClick({ ...video, video_url: videoUrl });
              }
            }}
          >
            {isPlaying && videoUrl && isUnlocked ? (
              <video 
                ref={videoRef} 
                style={{ ...thumbnailImgStyle, userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none" }} 
                muted 
                loop 
                playsInline 
                controlsList="nodownload noplaybackrate noremoteplayback"
                disablePictureInPicture
                disableRemotePlayback
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragStart={(e) => e.preventDefault()}
                poster={video.thumbnail_url} 
                preload="metadata" 
                onLoadedMetadata={handleMediaLoad} 
              />
            ) : (
              <img 
                src={video.thumbnail_url || (video.message_id ? `${APP_CONFIG.apiUrl}/api/thumb/${video.chat_id}/${video.message_id}` : '/assets/default-thumbnail.jpg')} 
                alt="thumbnail" 
                style={thumbnailImgStyle} 
                loading="lazy" 
                onLoad={handleMediaLoad} 
              />
            )}

            {!isUnlocked ? (
              <div style={vipLockedOverlayStyle}>
                <div style={vipBadgePillStyle}>
                  <span>VIP</span>
                </div>
                <div style={vipLockCenterStyle}>
                  <div style={vipLockCircleStyle}>
                    <Lock size={24} color="#FFD700" />
                  </div>
                  <div style={{ color: "#fff", fontSize: "13px", fontWeight: "800", textAlign: "center" }}>
                    Locked Premium Release
                  </div>
                  <button
                    type="button"
                    style={vipSubscribeButtonStyle}
                    onClick={(e) => {
                      e.stopPropagation();
                      const token = localStorage.getItem("token");
                      if (!token) {
                        promptLogin("subscribe");
                        return;
                      }
                      if (onCreatorClick) {
                        onCreatorClick(creatorHandle, { autoSubscribe: true });
                      } else {
                        window.dispatchEvent(new CustomEvent("openCreatorProfile", { 
                          detail: { username: creatorHandle, autoSubscribe: true } 
                        }));
                      }
                    }}
                  >
                    <span>Subscribe</span>
                  </button>
                </div>
              </div>
            ) : (
              <>
                {(!isPlaying || isAnyModalOpen) && (
                  <div style={playOverlayStyle}>
                    <Play size={24} fill="#fff" strokeWidth={0} />
                  </div>
                )}
                {isPremium && (
                  <div style={vipUnlockedBadgeStyle}>
                    <span>VIP</span>
                  </div>
                )}
              </>
            )}

            {video.is_group && <div style={groupBadgeStyle}>Album</div>}
          </div>
        )}

        {!isPremium && (
          <div style={actionBarStyle}>
            <div style={actionItemStyle}>
              <Eye size={18} />
              <span>{Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(video.views || 0))}</span>
            </div>
            
            <div style={actionItemStyle} onClick={handleCommentClick}>
              <MessageCircle size={18} />
              <span>{commentsCount > 0 ? commentsCount : ''}</span>
            </div>

            <div style={{ ...actionItemStyle, color: isLiked ? "#f91880" : "#71767b" }} onClick={handleLike}>
              <Heart size={18} fill={isLiked ? "#f91880" : "none"} />
              <span>{likesCount > 0 ? likesCount : ''}</span>
            </div>

            <div style={{ ...actionItemStyle, color: isSaved ? "#ffffff" : "#71767b" }} onClick={handleSave}>
              <Bookmark size={18} fill={isSaved ? "#ffffff" : "none"} />
              <span>{savesCount > 0 ? savesCount : ''}</span>
            </div>

            <div style={actionItemStyle} onClick={handleShare}>
              <Share2 size={18} />
              <span>{sharesCount > 0 ? sharesCount : ''}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
