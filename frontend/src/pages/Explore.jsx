import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Heart, MessageCircle, Share2, Eye, Play, Loader2, Bookmark, CheckCircle, 
  Sparkles, Lock, ChevronLeft, ChevronRight, X, ArrowRight, Users, Film, Plus,
  Home, Compass, Flame, TrendingUp, User, Search, MoreHorizontal, Grid3X3, ArrowLeft, RefreshCw
} from "lucide-react";
import { APP_CONFIG } from "../config";
import PullToRefresh from "../components/PullToRefresh";
import AppHeader from "../components/AppHeader"; // 🟢 IMPORT APPHEADER
import DiscoverCreatorsModal from "../components/DiscoverCreatorsModal";
import CreatorUploadModal from "../components/CreatorUploadModal";
import { isUserSubscribedToCreator, getVideoCreatorHandle } from "../utils/subscription";
import { renderClickableCaption } from "../components/ClickableCaption";
import { promptLogin, showToast } from "../utils/toast";

// 🟢 INDIVIDUAL POST COMPONENT
const FeedPost = ({ video, isLast, lastElementRef, onVideoClick, onCommentClick, isAnyModalOpen, onCreatorClick, user }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  
  // 🟢 FIX: State to track if the video is vertical. Default to true (75% width).
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
  const [albumVideos, setAlbumVideos] = useState(() => (isAlbum ? [video] : []));
  const [activeSlide, setActiveSlide] = useState(0);
  const carouselRef = useRef(null);

  useEffect(() => {
    if (isAlbum && video.media_group_id && video.media_group_id !== 'none') {
      let isMounted = true;
      fetch(`${APP_CONFIG.apiUrl}/api/group?media_group_id=${video.media_group_id}`)
        .then(res => res.ok ? res.json() : [])
        .then(groupItems => {
          if (isMounted && Array.isArray(groupItems) && groupItems.length > 0) {
            setAlbumVideos(groupItems);
          }
        })
        .catch(err => console.error("Failed to load album videos in Explore", err));
      return () => { isMounted = false; };
    }
  }, [isAlbum, video.media_group_id]);

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
  }, [video.message_id]);

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
    if (isPlaying && !videoUrl && isUnlocked) {
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
      }, 300); 
    }
    return () => clearTimeout(timer);
  }, [isPlaying, videoUrl, video.chat_id, video.message_id, isUnlocked]);

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
        // Reset playback position when scrolled offscreen so autoplay restarts from start when scrolled back
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
    
    setCommentsCount(prev => prev + 1); 
    onCommentClick(video);
  };

  // 🟢 FIX: Function to check media dimensions once it loads
  const handleMediaLoad = (e) => {
    const w = e.target.naturalWidth || e.target.videoWidth;
    const h = e.target.naturalHeight || e.target.videoHeight;
    if (w && h) {
      setIsPortrait(h > w);
    }
  };

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
          src={`${APP_CONFIG.apiUrl}/api/avatar?user_id=${video.uploader_id}`}
          alt="avatar"
          onError={(e) => { e.target.src = '/assets/default-avatar.png'; }}
          style={avatarStyle}
        />
      </div>

      <div style={contentColumnStyle}>
        <div style={postHeaderStyle}>
          <span 
            style={{ ...usernameStyle, cursor: onCreatorClick ? "pointer" : "default" }}
            onClick={(e) => {
              if (onCreatorClick) {
                e.stopPropagation();
                onCreatorClick(creatorHandle);
              }
            }}
          >
            @{creatorHandle}
          </span>
          <span style={timeStyle}>&middot; {new Date(video.created_at).toLocaleDateString()} &middot; {isPremium ? "VIP Exclusive" : video.category}</span>
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
                      if (onCreatorClick) {
                        onCreatorClick(creatorHandle, { autoSubscribe: true });
                      } else {
                        window.dispatchEvent(new CustomEvent("openCreatorProfile", { 
                          detail: { username: creatorHandle, autoSubscribe: true } 
                        }));
                      }
                      return;
                    }
                    onVideoClick({ ...item, video_url: idx === 0 ? videoUrl : null });
                  }}
                  style={albumVideoCardStyle}
                >
                  {/* Thumbnail / Video */}
                  {idx === 0 && videoUrl && isUnlocked ? (
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

                  {/* VIP Badge on Top Left (transparent gray shade, no icon) */}
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

                  {/* Locked Overlay (Unblurred with Gold Lock Badge) */}
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
                if (onCreatorClick) {
                  onCreatorClick(creatorHandle, { autoSubscribe: true });
                } else {
                  window.dispatchEvent(new CustomEvent("openCreatorProfile", { 
                    detail: { username: creatorHandle, autoSubscribe: true } 
                  }));
                }
                return;
              }
              onVideoClick({ ...video, video_url: videoUrl });
            }}
          >
            {videoUrl && isUnlocked ? (
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
                src={video.thumbnail_url} 
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

            <div style={{ ...actionItemStyle, color: isSaved ? "var(--primary-color)" : "#71767b" }} onClick={handleSave}>
              <Bookmark size={18} fill={isSaved ? "var(--primary-color)" : "none"} />
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
};

// 🌟 INSTAGRAM-STYLE SUGGESTED CREATORS COMPONENT
const InstagramSuggestedCreators = ({ creators, onCreatorClick, onSeeAll, user }) => {
  const [followingMap, setFollowingMap] = useState({});
  const [loadingMap, setLoadingMap] = useState({});
  const [dismissedSet, setDismissedSet] = useState(new Set());
  const trackRef = useRef(null);

  const handleDismiss = (username) => {
    setDismissedSet((prev) => {
      const next = new Set(prev);
      next.add(username);
      return next;
    });
  };

  const handleFollowToggle = async (e, creator) => {
    e.stopPropagation();
    const token = localStorage.getItem("token");
    if (!token) {
      promptLogin("follow");
      return;
    }

    const uname = creator.username;
    if (loadingMap[uname]) return;

    const isCurrentlyFollowing = followingMap[uname] !== undefined 
      ? followingMap[uname] 
      : Boolean(creator.is_following);
    const nextFollowing = !isCurrentlyFollowing;

    // Optimistic UI update
    setFollowingMap((prev) => ({ ...prev, [uname]: nextFollowing }));
    setLoadingMap((prev) => ({ ...prev, [uname]: true }));

    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(uname)}/follow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update follow");
      }
      setFollowingMap((prev) => ({ ...prev, [uname]: Boolean(data.following) }));
      showToast(data.following ? `Following @${uname}` : `Unfollowed @${uname}`, data.following ? "success" : "error");
      window.dispatchEvent(new CustomEvent("refreshUser"));
    } catch (err) {
      // Revert optimistic state on failure
      setFollowingMap((prev) => ({ ...prev, [uname]: isCurrentlyFollowing }));
      showToast(err.message || "Failed to update follow", "error");
    } finally {
      setLoadingMap((prev) => ({ ...prev, [uname]: false }));
    }
  };

  const visibleCreators = creators.filter((c) => !dismissedSet.has(c.username));
  if (visibleCreators.length === 0) return null;

  const scrollTrack = (direction) => {
    if (trackRef.current) {
      trackRef.current.scrollBy({
        left: direction * 280,
        behavior: "smooth"
      });
    }
  };

  return (
    <div style={igSuggestedWrapper}>
      <div style={igSuggestedHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <Sparkles size={15} color="#00aff0" />
          <span style={igSuggestedTitle}>Discover Creators</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (onSeeAll) onSeeAll();
              else window.dispatchEvent(new CustomEvent("openDiscoverCreators"));
            }}
            style={igSeeAllBtn}
            title="See all creators"
          >
            <span>See All</span>
            <ArrowRight size={13} style={{ marginLeft: "3px" }} />
          </button>
          <div style={{ display: "flex", gap: "4px" }}>
            <button 
              onClick={() => scrollTrack(-1)} 
              style={igArrowBtn}
              title="Scroll left"
              aria-label="Scroll left"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              onClick={() => scrollTrack(1)} 
              style={igArrowBtn}
              title="Scroll right"
              aria-label="Scroll right"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div ref={trackRef} style={igScrollTrack}>
        {visibleCreators.map((creator) => {
          const uname = creator.username;
          const isFollowing = followingMap[uname] !== undefined 
            ? followingMap[uname] 
            : Boolean(creator.is_following);
          const isLoading = Boolean(loadingMap[uname]);

          return (
            <div 
              key={uname} 
              style={igCardBox}
              onClick={() => onCreatorClick && onCreatorClick(uname)}
            >
              {/* Dismiss (✕) button */}
              <button 
                style={igDismissBtn} 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss(uname);
                }}
                title="Dismiss"
                aria-label="Dismiss"
              >
                <X size={13} />
              </button>

              {/* Center Avatar with Story Ring */}
              <div style={igAvatarContainer}>
                <div style={igAvatarRing}>
                  <img 
                    src={creator.avatar_url || "/assets/default-avatar.png"} 
                    alt={creator.display_name || uname}
                    onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                    style={igAvatarImg}
                  />
                </div>
                {creator.is_verified && (
                  <div style={igVerifiedBadge}>
                    <CheckCircle size={13} color="#00aff0" fill="#00aff0" />
                  </div>
                )}
              </div>

              {/* Display Name */}
              <span style={igDisplayName} title={creator.display_name || uname}>
                {creator.display_name || uname}
              </span>

              {/* Handle */}
              <span style={igHandleName}>
                @{uname}
              </span>

              {/* Category tag */}
              <span style={igCategoryTag}>
                {creator.creator_category || "Telegram Creator"}
              </span>

              {/* Follow Button (Instagram Style) */}
              <button
                type="button"
                style={isFollowing ? igFollowingBtn : igFollowBtn}
                onClick={(e) => handleFollowToggle(e, creator)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : isFollowing ? (
                  "Following"
                ) : (
                  "Follow"
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// 🌟 TWITTER/X STYLE CREATOR SEARCH CARD
const SearchCreatorCard = ({ creator, onCreatorClick, onFollowToggle, isFollowing, isLoadingFollow }) => {
  const uname = creator.username;
  return (
    <div
      onClick={() => onCreatorClick && onCreatorClick(uname)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "12px",
        padding: "14px 16px",
        background: "transparent",
        borderBottom: "1px solid var(--border-color, #2f3336)",
        cursor: "pointer",
        transition: "background 0.15s ease",
        boxSizing: "border-box",
        width: "100%"
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--hover-bg, rgba(255, 255, 255, 0.03))"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", minWidth: 0, flex: 1 }}>
        <div style={{ position: "relative", width: "44px", height: "44px", flexShrink: 0 }}>
          <img
            src={creator.avatar_url || "/assets/default-avatar.png"}
            alt={creator.display_name || uname}
            onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
            style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover", border: "2px solid #1d9bf0" }}
          />
        </div>

        <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Line 1: Name, Verified Badge, Category */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
            <span style={{ 
              fontWeight: "700", 
              fontSize: "14.5px", 
              color: "var(--text-primary, #ffffff)", 
              whiteSpace: "nowrap", 
              overflow: "hidden", 
              textOverflow: "ellipsis",
              minWidth: 0,
              display: "inline-block"
            }}>
              {creator.display_name || uname}
            </span>
            {creator.is_verified && (
              <CheckCircle size={14} color="#1d9bf0" fill="#1d9bf0" stroke="#000" style={{ flexShrink: 0 }} />
            )}
            {creator.creator_category && (
              <span style={{
                fontSize: "10px",
                fontWeight: "600",
                color: "var(--primary-color, #1d9bf0)",
                background: "rgba(29, 155, 240, 0.12)",
                padding: "1px 6px",
                borderRadius: "6px",
                flexShrink: 0,
                whiteSpace: "nowrap"
              }}>
                {creator.creator_category}
              </span>
            )}
          </div>

          {/* Line 2: Handle & Stats */}
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "6px", 
            marginTop: "2px", 
            fontSize: "12.5px", 
            color: "#71767b",
            minWidth: 0,
            maxWidth: "100%",
            overflow: "hidden",
            whiteSpace: "nowrap"
          }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              @{uname}
            </span>
            {creator.followers_count > 0 && (
              <>
                <span style={{ flexShrink: 0 }}>•</span>
                <span style={{ flexShrink: 0 }}>{creator.followers_count.toLocaleString()} followers</span>
              </>
            )}
            {creator.video_count > 0 && (
              <>
                <span style={{ flexShrink: 0 }}>•</span>
                <span style={{ flexShrink: 0 }}>{creator.video_count.toLocaleString()} drops</span>
              </>
            )}
          </div>

          {/* Line 3: Bio */}
          {creator.creator_bio && (
            <p style={{
              margin: "5px 0 0 0",
              fontSize: "12.5px",
              color: "var(--text-secondary, #a0a4a8)",
              lineHeight: "1.4",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
              overflowWrap: "anywhere"
            }}>
              {creator.creator_bio}
            </p>
          )}
        </div>
      </div>

      <div style={{ marginLeft: "12px", flexShrink: 0, alignSelf: "flex-start" }}>
        <button
          type="button"
          onClick={(e) => onFollowToggle(e, creator)}
          disabled={isLoadingFollow}
          style={{
            padding: isFollowing ? "6px 14px" : "6px 16px",
            borderRadius: "20px",
            fontSize: "13px",
            fontWeight: "700",
            cursor: "pointer",
            transition: "all 0.15s ease",
            border: isFollowing ? "1px solid #536471" : "none",
            background: isFollowing ? "transparent" : "#eff3f4",
            color: isFollowing ? "#eff3f4" : "#0f1419",
            whiteSpace: "nowrap",
            minWidth: "82px",
            textAlign: "center"
          }}
          onMouseEnter={(e) => {
            if (isFollowing) {
              e.currentTarget.style.borderColor = "#f4212e";
              e.currentTarget.style.color = "#f4212e";
              e.currentTarget.innerText = "Unfollow";
            }
          }}
          onMouseLeave={(e) => {
            if (isFollowing) {
              e.currentTarget.style.borderColor = "#536471";
              e.currentTarget.style.color = "#eff3f4";
              e.currentTarget.innerText = "Following";
            }
          }}
        >
          {isLoadingFollow ? "..." : (isFollowing ? "Following" : "Follow")}
        </button>
      </div>
    </div>
  );
};

// 🟢 DESKTOP LEFT SIDEBAR (Twitter/X Style: Menus, Categories, Post Button, User Profile)
const DesktopLeftSidebar = ({
  user,
  activeTab,
  onTabSwitch,
  communityCount,
  selectedCategory,
  onSelectCategory,
  onNavigateHome,
  onProfileClick,
  onOpenDiscover,
  onPostClick
}) => {
  const categories = [
    { id: "trends", label: "Trends", icon: Flame, badge: "Hot" },
    { id: "knacks", label: "Knacks", icon: Play },
    { id: "hotties", label: "Hotties", icon: Grid3X3 },
    { id: "baddies", label: "Baddies", icon: User },
    { id: "college", label: "College", icon: Film },
    { id: "premium", label: "VIP Club", icon: Sparkles, badge: "VIP" }
  ];

  const isLoggedIn = user && (user.id || user.email);

  return (
    <aside style={desktopLeftRailStyle} className="custom-scrollbar">
      {/* Top Section: Logo + Navigation Menus + Categories */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        {/* Brand / Logo */}
        <div 
          onClick={onNavigateHome}
          style={desktopBrandHeaderStyle}
          title="NaijaHomemade"
        >
          <div style={desktopBrandLogoCircle}>
            <Flame size={20} color="#fff" />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            <span style={{ fontSize: "19px", fontWeight: "900", color: "#ffffff", letterSpacing: "-0.4px" }}>
              Naija
            </span>
            <span style={{ fontSize: "19px", fontWeight: "900", color: "var(--primary-color, #1d9bf0)", letterSpacing: "-0.4px" }}>
              homemade
            </span>
          </div>
        </div>

        {/* Primary Menus */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "3px", marginTop: "14px" }}>
          {/* Home */}
          <button
            type="button"
            onClick={onNavigateHome}
            style={desktopNavBtnStyle}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <div style={desktopNavIconBox}>
              <Home size={22} color="#ffffff" strokeWidth={2} />
            </div>
            <span style={desktopNavLabelStyle}>Home</span>
          </button>

          {/* Explore (Active) */}
          <button
            type="button"
            onClick={() => {
              onSelectCategory(null);
              onTabSwitch("for_you");
            }}
            style={{
              ...desktopNavBtnStyle,
              background: (!selectedCategory && activeTab === "for_you") ? "rgba(255, 255, 255, 0.1)" : "transparent"
            }}
            onMouseEnter={(e) => {
              if (selectedCategory || activeTab !== "for_you") e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            }}
            onMouseLeave={(e) => {
              if (selectedCategory || activeTab !== "for_you") e.currentTarget.style.background = "transparent";
            }}
          >
            <div style={desktopNavIconBox}>
              <Compass size={22} color={(!selectedCategory && activeTab === "for_you") ? "var(--primary-color, #1d9bf0)" : "#ffffff"} strokeWidth={2.4} />
            </div>
            <span style={{
              ...desktopNavLabelStyle,
              fontWeight: (!selectedCategory && activeTab === "for_you") ? "800" : "600",
              color: (!selectedCategory && activeTab === "for_you") ? "#ffffff" : "#e7e9ea"
            }}>
              Explore
            </span>
          </button>

          {/* Community */}
          <button
            type="button"
            onClick={() => onTabSwitch("community")}
            style={{
              ...desktopNavBtnStyle,
              background: activeTab === "community" ? "rgba(29, 155, 240, 0.15)" : "transparent"
            }}
            onMouseEnter={(e) => {
              if (activeTab !== "community") e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            }}
            onMouseLeave={(e) => {
              if (activeTab !== "community") e.currentTarget.style.background = "transparent";
            }}
          >
            <div style={desktopNavIconBox}>
              <Users size={22} color={activeTab === "community" ? "var(--primary-color, #1d9bf0)" : "#ffffff"} strokeWidth={2.2} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
              <span style={{
                ...desktopNavLabelStyle,
                fontWeight: activeTab === "community" ? "800" : "600",
                color: activeTab === "community" ? "var(--primary-color, #1d9bf0)" : "#e7e9ea"
              }}>
                Community
              </span>
              {communityCount > 0 && (
                <span style={communityCountPillStyle}>
                  {communityCount}
                </span>
              )}
            </div>
          </button>

          {/* Creators */}
          <button
            type="button"
            onClick={onOpenDiscover}
            style={desktopNavBtnStyle}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <div style={desktopNavIconBox}>
              <Sparkles size={22} color="#00aff0" strokeWidth={2} />
            </div>
            <span style={desktopNavLabelStyle}>Creators</span>
          </button>

          {/* Profile / Studio */}
          <button
            type="button"
            onClick={onProfileClick}
            style={desktopNavBtnStyle}
            onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <div style={desktopNavIconBox}>
              <User size={22} color="#ffffff" strokeWidth={2} />
            </div>
            <span style={desktopNavLabelStyle}>
              {user ? (user.is_creator || user.role === "creator" ? "Creator Studio" : "Profile") : "Sign In"}
            </span>
          </button>
        </nav>

        {/* Divider */}
        <div style={desktopNavDividerStyle} />

        {/* Categories Section */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={desktopSectionHeaderStyle}>
            <span>CATEGORIES</span>
            {selectedCategory && (
              <button
                type="button"
                onClick={() => onSelectCategory(null)}
                style={desktopClearCategoryBtn}
              >
                Reset
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {categories.map((cat) => {
              const Icon = cat.icon;
              const isSelected = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => onSelectCategory(cat.id)}
                  style={{
                    ...desktopCategoryBtnStyle,
                    background: isSelected ? "rgba(29, 155, 240, 0.16)" : "transparent",
                    color: isSelected ? "var(--primary-color, #1d9bf0)" : "#cfd9de",
                    borderLeft: isSelected ? "3px solid var(--primary-color, #1d9bf0)" : "3px solid transparent"
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
                    <Icon size={16} color={isSelected ? "var(--primary-color, #1d9bf0)" : "#8b98a5"} />
                    <span style={{ fontSize: "14px", fontWeight: isSelected ? "700" : "500" }}>
                      {cat.label}
                    </span>
                  </div>

                  {cat.badge && (
                    <span style={{
                      fontSize: "10px",
                      fontWeight: "700",
                      padding: "2px 6px",
                      borderRadius: "10px",
                      background: cat.badge === "VIP" ? "rgba(255, 215, 0, 0.2)" : "rgba(249, 24, 128, 0.2)",
                      color: cat.badge === "VIP" ? "#FFD700" : "#f91880"
                    }}>
                      {cat.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Twitter-style Large "Post Video" Button */}
        <button
          type="button"
          onClick={onPostClick}
          style={desktopPostBtnStyle}
          title="Post a new video"
        >
          <Plus size={20} strokeWidth={2.6} />
          <span>Post Video</span>
        </button>
      </div>

      {/* Bottom User Profile Section */}
      <div style={{ marginTop: "24px" }}>
        {isLoggedIn ? (
          <div 
            onClick={onProfileClick}
            style={desktopUserPillStyle}
            title={`Logged in as ${user.display_name || user.username || "Creator"}`}
          >
            <img 
              src={user.avatar_url || (user.id ? `${APP_CONFIG.apiUrl}/api/avatar?user_id=${user.id}` : "/assets/default-avatar.png")} 
              alt="User Avatar"
              onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
              style={desktopUserPillAvatar}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={desktopUserPillName}>
                  {user.display_name || user.username || "Member"}
                </span>
                {(user.is_creator || user.role === "creator") && (
                  <CheckCircle size={13} color="#00aff0" fill="#00aff0" />
                )}
              </div>
              <span style={desktopUserPillHandle}>
                @{user.username || "user"}
              </span>
            </div>
            <MoreHorizontal size={18} color="#71767b" />
          </div>
        ) : (
          <button
            type="button"
            onClick={onProfileClick}
            style={desktopLoginPillBtn}
          >
            <User size={16} />
            <span>Log In / Sign Up</span>
          </button>
        )}
      </div>
    </aside>
  );
};

// 🟢 DESKTOP RIGHT SIDEBAR (Twitter/X Style: Search, Trends, Highlights, Who to Follow, Legal)
const DesktopRightSidebar = ({
  searchQuery,
  setSearchQuery,
  onSearchSubmit,
  onClear,
  onSelectTopic,
  highlights,
  highlightsLoading,
  featuredCreators,
  onCreatorClick,
  onVideoClick,
  onOpenDiscover,
  user
}) => {
  const [followingMap, setFollowingMap] = useState({});
  const [loadingMap, setLoadingMap] = useState({});

  const handleSideFollowToggle = async (e, creator) => {
    e.stopPropagation();
    const uname = creator.username;
    const token = localStorage.getItem("token");
    if (!token) return promptLogin("follow");

    const isCurrentlyFollowing = followingMap[uname] !== undefined 
      ? followingMap[uname] 
      : Boolean(creator.is_following);
    const nextFollowing = !isCurrentlyFollowing;

    setFollowingMap(prev => ({ ...prev, [uname]: nextFollowing }));
    setLoadingMap(prev => ({ ...prev, [uname]: true }));

    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(uname)}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to update follow");
      setFollowingMap(prev => ({ ...prev, [uname]: Boolean(data.following) }));
      showToast(data.following ? `Following @${uname}` : `Unfollowed @${uname}`, data.following ? "success" : "error");
      window.dispatchEvent(new CustomEvent("refreshUser"));
    } catch (err) {
      setFollowingMap(prev => ({ ...prev, [uname]: isCurrentlyFollowing }));
      showToast(err.message || "Failed to update follow", "error");
    } finally {
      setLoadingMap(prev => ({ ...prev, [uname]: false }));
    }
  };

  const trendingTopics = [
    { category: "Entertainment · Trending", topic: "#NaijaKnacks", posts: "24.5K drops", catId: "knacks" },
    { category: "Trending in Nigeria", topic: "#LagosBaddies", posts: "18.2K drops", catId: "baddies" },
    { category: "VIP Club · Trending", topic: "#VIPExclusives", posts: "31.9K drops", catId: "premium" },
    { category: "Campus & College", topic: "#CollegeBabes", posts: "12.4K drops", catId: "college" },
    { category: "Models · Trending", topic: "#Hotties", posts: "15.7K drops", catId: "hotties" }
  ];

  return (
    <aside style={desktopRightRailStyle} className="custom-scrollbar">
      {/* 1. Twitter-style Search Bar */}
      <div style={desktopSearchBoxWrapper}>
        <Search size={18} color="#71767b" style={{ flexShrink: 0 }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && onSearchSubmit) {
              onSearchSubmit(searchQuery);
            }
          }}
          placeholder="Search Explore & Creators..."
          style={desktopSearchInput}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onClear ? onClear() : setSearchQuery("")}
            style={desktopSearchInputClearBtn}
            title="Clear search"
          >
            <X size={14} color="#000" />
          </button>
        )}
      </div>

      {/* 2. Trends For You Card */}
      <div style={desktopCardStyle}>
        <div style={desktopCardHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <TrendingUp size={18} color="var(--primary-color, #1d9bf0)" />
            <h3 style={desktopCardTitleStyle}>Trends for you</h3>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {trendingTopics.map((item) => (
            <div
              key={item.topic}
              onClick={() => onSelectTopic(item.catId)}
              style={desktopTrendItemStyle}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <span style={desktopTrendSublabel}>{item.category}</span>
              <span style={desktopTrendTitle}>{item.topic}</span>
              <span style={desktopTrendPosts}>{item.posts}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Trending Highlights (Mini Video Cards) */}
      <div style={desktopCardStyle}>
        <div style={desktopCardHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Film size={18} color="#FFD700" />
            <h3 style={desktopCardTitleStyle}>Highlights</h3>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {highlightsLoading && highlights.length === 0 ? (
            [...Array(3)].map((_, i) => (
              <div key={i} style={desktopHighlightSkeleton}>
                <div style={{ width: "68px", height: "82px", borderRadius: "8px", background: "#222" }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ width: "80%", height: "14px", background: "#222", borderRadius: "4px" }} />
                  <div style={{ width: "50%", height: "12px", background: "#222", borderRadius: "4px" }} />
                </div>
              </div>
            ))
          ) : highlights.length > 0 ? (
            highlights.slice(0, 4).map((v, i) => (
              <div
                key={`hl-${v.message_id || v.id}-${i}`}
                onClick={() => onVideoClick(v)}
                style={desktopHighlightCardStyle}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <div style={desktopHighlightThumbBox}>
                  <img src={v.thumbnail_url} alt="" style={desktopHighlightThumbImg} />
                  <div style={desktopHighlightPlayOverlay}>
                    <Play size={12} fill="#fff" strokeWidth={0} />
                  </div>
                  {v.category === "premium" && (
                    <div style={desktopHighlightVipTag}>VIP</div>
                  )}
                </div>

                <div style={desktopHighlightInfo}>
                  <p style={desktopHighlightCaption}>
                    {v.caption || APP_CONFIG.defaultCaption}
                  </p>
                  <div style={desktopHighlightMeta}>
                    <span style={{ color: "var(--primary-color, #1d9bf0)", fontWeight: "600" }}>
                      @{v.uploader_handle || v.uploader_name || "creator"}
                    </span>
                    <span>&middot;</span>
                    <span>{Number(v.views || 0).toLocaleString()} views</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p style={{ color: "#71767b", fontSize: "13px", padding: "14px 16px", margin: 0 }}>
              No highlights right now.
            </p>
          )}
        </div>
      </div>

      {/* 4. Top Creators ("Who to follow") */}
      {featuredCreators.length > 0 && (
        <div style={desktopCardStyle}>
          <div style={desktopCardHeaderStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Sparkles size={18} color="#00aff0" />
              <h3 style={desktopCardTitleStyle}>Top Creators</h3>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {featuredCreators.slice(0, 3).map((creator) => {
              const uname = creator.username;
              const isFollowing = followingMap[uname] !== undefined 
                ? followingMap[uname] 
                : Boolean(creator.is_following);
              const isLoading = Boolean(loadingMap[uname]);

              return (
                <div
                  key={`side-c-${uname}`}
                  onClick={() => onCreatorClick(uname)}
                  style={desktopSideCreatorRow}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <div style={desktopSideCreatorAvatarRing}>
                    <img
                      src={creator.avatar_url || "/assets/default-avatar.png"}
                      alt=""
                      onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                      style={desktopSideCreatorAvatarImg}
                    />
                  </div>

                  <div style={desktopSideCreatorInfo}>
                    <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={desktopSideCreatorName}>{creator.display_name || uname}</span>
                      {creator.is_verified && <CheckCircle size={12} color="#00aff0" fill="#00aff0" />}
                    </div>
                    <span style={desktopSideCreatorHandle}>@{uname}</span>
                  </div>

                  <button
                    type="button"
                    style={isFollowing ? desktopSideFollowingBtn : desktopSideFollowBtn}
                    onClick={(e) => handleSideFollowToggle(e, creator)}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : isFollowing ? (
                      "Following"
                    ) : (
                      "Follow"
                    )}
                  </button>
                </div>
              );
            })}

            <button
              type="button"
              onClick={onOpenDiscover}
              style={desktopCardShowMoreBtn}
            >
              <span>Show more</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* 5. Twitter-style Mini Legal Footer */}
      <footer style={desktopFooterStyle}>
        <div style={desktopFooterLinks}>
          <a href="/?legal=terms" style={desktopFooterLink}>Terms of Service</a>
          <a href="/?legal=privacy" style={desktopFooterLink}>Privacy Policy</a>
          <a href="/?legal=dmca" style={desktopFooterLink}>DMCA</a>
          <a href="/?legal=2257" style={desktopFooterLink}>18 U.S.C. 2257</a>
        </div>
        <div style={desktopFooterCopy}>
          &copy; 2026 NaijaHomemade, Inc.
        </div>
      </footer>
    </aside>
  );
};

// 🟢 EXPLORE COMPONENT
export default function Explore({ 
  user,
  onProfileClick,
  onNavigateTab,
  setHideFooter,
  onVideoClick, 
  onCommentClick, 
  isAnyModalOpen,
  onCreatorClick,
  onOpenDiscoverCreators
}) {
  // 🟢 TWO TABS: "for_you" (platform content) & "community" (web creator content)
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("explore_tab");
    if (tabParam === "community") return "community";
    return "for_you";
  });

  const [searchQuery, setSearchQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("q") || "";
  });

  // 🟢 FOR YOU FEED STATE (Platform & legacy curated drops)
  const [forYouFeed, setForYouFeed] = useState([]);
  const [forYouLoading, setForYouLoading] = useState(true);
  const [forYouLoadingMore, setForYouLoadingMore] = useState(false);

  // 🟢 COMMUNITY FEED STATE (Contents posted by web creators only)
  const [communityFeed, setCommunityFeed] = useState([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityLoadingMore, setCommunityLoadingMore] = useState(false);
  const [communityPage, setCommunityPage] = useState(1);
  const [hasMoreCommunity, setHasMoreCommunity] = useState(true);
  const [communityCount, setCommunityCount] = useState(0);

  // 🟢 SEARCH FEED & CREATOR STATES
  const [searchFeed, setSearchFeed] = useState([]);
  const [searchCreators, setSearchCreators] = useState([]);
  const [searchSubTab, setSearchSubTab] = useState("all"); // "all" | "creators" | "videos"
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreSearch, setHasMoreSearch] = useState(true);
  const [searchFollowingMap, setSearchFollowingMap] = useState({});
  const [searchFollowingLoading, setSearchFollowingLoading] = useState({});

  // 🟢 CREATOR & MODAL STATES
  const [featuredCreators, setFeaturedCreators] = useState([]);
  const [suggestedIndex, setSuggestedIndex] = useState(() => Math.floor(Math.random() * 4) + 2);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // 🟢 DESKTOP CATEGORY FILTER & HIGHLIGHTS STATE
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [highlightVideos, setHighlightVideos] = useState([]);
  const [highlightLoading, setHighlightLoading] = useState(false);

  const fetchHighlights = useCallback(async () => {
    try {
      setHighlightLoading(true);
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/videos?category=trends&limit=4`);
      if (res.ok) {
        const data = await res.json();
        if (data?.videos) setHighlightVideos(data.videos);
      }
    } catch (e) {
    } finally {
      setHighlightLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHighlights();
  }, [fetchHighlights]);

  const handleSelectCategory = (catId) => {
    if (selectedCategory === catId) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(catId);
      if (activeTab !== "for_you") setActiveTab("for_you");
    }
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleOpenDiscover = useCallback(() => {
    if (onOpenDiscoverCreators) {
      onOpenDiscoverCreators();
    } else {
      setShowDiscoverModal(true);
    }
  }, [onOpenDiscoverCreators]);

  const fetchFeaturedCreators = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/featured/list`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data?.creators) {
          // Strictly filter out any web users (gmail, yahoo, hotmail)
          const tgOnly = data.creators.filter(c => {
            const email = String(c.email || "").toLowerCase();
            return !email.includes("@gmail.com") && !email.includes("@yahoo.com") && !email.includes("@hotmail.com");
          });
          setFeaturedCreators(tgOnly);
        }
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchFeaturedCreators();
  }, [fetchFeaturedCreators]);

  // Sync explore_tab in URL without page reload
  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeTab === "community") {
      url.searchParams.set("explore_tab", "community");
    } else {
      url.searchParams.delete("explore_tab");
    }
    window.history.replaceState(window.history.state, "", url.toString());
  }, [activeTab]);

  // 🟢 SCROLL UI STATES
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);
  const [isUIHidden, setIsUIHidden] = useState(false);
  
  const scrollContainerRef = useRef(null);
  const lastScrollY = useRef(0);
  const isFirstMount = useRef(true);

  const shouldHideUI = isUIHidden && !isDesktop;

  // 🟢 Window Resize Listener
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 🟢 Split Footer Broadcast Effects (Hide footer on mobile scroll OR always hide on desktop)
  useEffect(() => {
    if (setHideFooter) setHideFooter(shouldHideUI || isDesktop);
  }, [shouldHideUI, isDesktop, setHideFooter]);

  useEffect(() => {
    return () => {
      if (setHideFooter) setHideFooter(false);
    };
  }, [setHideFooter]);

  // 🟢 Soft Delete Event Listener across all feeds
  useEffect(() => {
    const handleVideoDeleted = (event) => {
      const deletedId = String(event.detail);
      setForYouFeed(prev => prev.filter(v => String(v.id || v.message_id) !== deletedId));
      setCommunityFeed(prev => prev.filter(v => String(v.id || v.message_id) !== deletedId));
      setSearchFeed(prev => prev.filter(v => String(v.id || v.message_id) !== deletedId));
    };

    window.addEventListener('videoDeleted', handleVideoDeleted);
    return () => window.removeEventListener('videoDeleted', handleVideoDeleted);
  }, []);

  // 🟢 Scroll Listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentY = container.scrollTop;

      if (currentY < 50) {
        setIsUIHidden(false);
      } else if (currentY > lastScrollY.current + 15) {
        setIsUIHidden(true);
      } else if (currentY < lastScrollY.current - 15) {
        setIsUIHidden(false);
      }

      lastScrollY.current = currentY;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // 🟢 LOAD FOR YOU FEED (Current Explore feed excluding web creator content)
  const loadForYouFeed = useCallback(async (isLoadMore = false, cat = selectedCategory) => {
    if (isLoadMore) {
      setForYouLoadingMore(true);
    } else {
      setForYouLoading(true);
      setSuggestedIndex(Math.floor(Math.random() * 4) + 2);
      fetchFeaturedCreators();
    }

    try {
      if (cat) {
        const currentPage = isLoadMore ? Math.floor(forYouFeed.length / 10) + 1 : 1;
        const res = await fetch(`${APP_CONFIG.apiUrl}/api/videos?category=${encodeURIComponent(cat)}&limit=10&page=${currentPage}`);
        const data = res.ok ? await res.json() : { videos: [] };
        const fetched = data.videos || [];
        if (isLoadMore) {
          setForYouFeed(prev => {
            const existingIds = new Set(prev.map(v => String(v.message_id || v.id)));
            const unique = fetched.filter(v => !existingIds.has(String(v.message_id || v.id)));
            return [...prev, ...unique];
          });
        } else {
          setForYouFeed(fetched);
        }
      } else {
        const exploreCategories = [...APP_CONFIG.categories];
        if (!exploreCategories.includes("premium")) {
          exploreCategories.push("premium");
        }
        
        const fetches = exploreCategories.map(async (categoryItem) => {
          let res = await fetch(`${APP_CONFIG.apiUrl}/api/videos?category=${categoryItem}&limit=8&sort=random`);
          let data = res.ok ? await res.json() : { videos: [] };
          
          if (!data.videos || data.videos.length === 0) {
            res = await fetch(`${APP_CONFIG.apiUrl}/api/videos?category=${categoryItem}&limit=8&page=1`);
            data = res.ok ? await res.json() : { videos: [] };
          }
          return data;
        });
        
        const results = await Promise.all(fetches);
        
        let combined = [];
        results.forEach(data => {
          if (data && data.videos) combined = [...combined, ...data.videos];
        });

        const uniqueMap = new Map();
        combined.forEach(video => {
          if (video && video.message_id) {
            uniqueMap.set(video.message_id, video);
          }
        });
        
        const shuffled = Array.from(uniqueMap.values()).sort(() => 0.5 - Math.random());
        
        if (isLoadMore) {
          setForYouFeed(prev => {
            const newMap = new Map();
            prev.forEach(v => newMap.set(v.message_id, v));
            shuffled.forEach(v => newMap.set(v.message_id, v));
            return Array.from(newMap.values());
          });
        } else {
          setForYouFeed(shuffled);
        }
      }
    } catch (err) {
      console.error("Failed to load explore for you feed", err);
    } finally {
      setForYouLoading(false);
      setForYouLoadingMore(false);
    }
  }, [fetchFeaturedCreators, selectedCategory, forYouFeed.length]);

  useEffect(() => {
    if (activeTab === "for_you") {
      loadForYouFeed(false, selectedCategory);
    }
  }, [selectedCategory]);

  // 🟢 LOAD COMMUNITY FEED (Exclusively contents posted by web creators)
  const loadCommunityFeed = useCallback(async (pageNum = 1, isLoadMore = false, q = "") => {
    if (isLoadMore) {
      setCommunityLoadingMore(true);
    } else {
      setCommunityLoading(true);
    }

    try {
      const searchParam = q ? `&q=${encodeURIComponent(q)}` : "";
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/community/videos?page=${pageNum}&limit=12${searchParam}`);
      if (res.ok) {
        const data = await res.json();
        const safeVideos = data.videos || [];
        setCommunityCount(Number(data.total || safeVideos.length));
        setHasMoreCommunity(Boolean(data.hasMore));
        setCommunityPage(pageNum);

        if (isLoadMore) {
          setCommunityFeed(prev => {
            const newMap = new Map();
            prev.forEach(v => newMap.set(v.message_id || v.id, v));
            safeVideos.forEach(v => newMap.set(v.message_id || v.id, v));
            return Array.from(newMap.values());
          });
        } else {
          setCommunityFeed(safeVideos);
        }
      }
    } catch (err) {
      console.error("Failed to load community feed", err);
    }

    setCommunityLoading(false);
    setCommunityLoadingMore(false);
  }, []);

  // 🟢 LOAD SEARCH FEED (Creators + Videos)
  const loadSearchFeed = useCallback(async (pageNum = 1, isLoadMore = false, subTab = searchSubTab, queryOverride = null) => {
    const term = (queryOverride !== null ? queryOverride : searchQuery).trim();
    if (!term) return;
    if (isLoadMore) setSearchLoadingMore(true);
    else setSearchLoading(true);

    try {
      const communityParam = activeTab === "community" ? "&community=true" : "";
      const typeParam = subTab === "creators" ? "&type=creators" : subTab === "videos" ? "&type=videos" : "&type=all";
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(
        `${APP_CONFIG.apiUrl}/api/search?q=${encodeURIComponent(term)}&limit=15&page=${pageNum}${communityParam}${typeParam}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        const safeVideos = data.videos || [];
        const safeCreators = data.creators || [];

        if (isLoadMore) {
          if (subTab === "creators") {
            setSearchCreators(prev => {
              const ids = new Set(prev.map(c => c.username));
              return [...prev, ...safeCreators.filter(c => !ids.has(c.username))];
            });
          } else {
            setSearchFeed(prev => [...prev, ...safeVideos]);
          }
        } else {
          setSearchFeed(safeVideos);
          setSearchCreators(safeCreators);
          const initialFollows = {};
          safeCreators.forEach(c => {
            if (c.username && c.is_following !== undefined) {
              initialFollows[c.username] = Boolean(c.is_following);
            }
          });
          setSearchFollowingMap(prev => ({ ...initialFollows, ...prev }));
        }
        
        setHasMoreSearch(Boolean(data.hasMore));
        setSearchPage(pageNum);
      }
    } catch (err) {
      console.error("Search failed", err);
    }

    setSearchLoading(false);
    setSearchLoadingMore(false);
  }, [searchQuery, activeTab, searchSubTab]);

  // 🟢 SUBMIT SEARCH & SYNC BROWSER HISTORY
  const handleSearchSubmit = useCallback((term) => {
    const trimmed = (term || "").trim();
    if (!trimmed) {
      handleExitSearch();
      return;
    }

    setSearchQuery(trimmed);
    setSearchSubTab("all");
    setSearchPage(1);
    setHasMoreSearch(true);

    const currentState = window.history.state || {};
    const params = new URLSearchParams(window.location.search);
    params.set("tab", "explore");
    params.set("q", trimmed);
    const targetUrl = `/?${params.toString()}`;

    // If searchOpen was active or already in exploreSearch, replace history entry so back button returns to pre-search Explore
    if (currentState.searchOpen || currentState.inExploreSearch) {
      window.history.replaceState(
        { ...currentState, searchOpen: false, inExploreSearch: true, searchQuery: trimmed },
        document.title,
        targetUrl
      );
    } else {
      window.history.pushState(
        { ...currentState, inExploreSearch: true, searchQuery: trimmed },
        document.title,
        targetUrl
      );
    }

    loadSearchFeed(1, false, "all", trimmed);
  }, [loadSearchFeed]);

  // 🟢 EXIT SEARCH & RESTORE TIMELINE
  const handleExitSearch = useCallback(() => {
    setSearchQuery("");
    setSearchFeed([]);
    setSearchCreators([]);
    setSearchSubTab("all");

    const currentState = window.history.state || {};
    if (currentState.inExploreSearch) {
      window.history.back();
    } else {
      const params = new URLSearchParams(window.location.search);
      params.delete("q");
      const remaining = params.toString();
      const targetUrl = remaining ? `/?${remaining}` : "/?tab=explore";
      window.history.replaceState(
        { ...currentState, inExploreSearch: false, searchQuery: "" },
        document.title,
        targetUrl
      );
    }
  }, []);

  // 🟢 INITIAL LOAD IF Q PARAM EXISTS ON MOUNT
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQ = params.get("q");
    if (initialQ && initialQ.trim()) {
      loadSearchFeed(1, false, "all", initialQ.trim());
    }
  }, []);

  // 🟢 SYNCHRONIZE BROWSER BACK/FORWARD BUTTONS WITH EXPLORE SEARCH
  useEffect(() => {
    const handleExplorePopState = (event) => {
      const state = event.state || {};
      const params = new URLSearchParams(window.location.search);
      const urlQuery = params.get("q");

      if (state.inExploreSearch && state.searchQuery) {
        if (state.searchQuery !== searchQuery) {
          setSearchQuery(state.searchQuery);
          loadSearchFeed(1, false, "all", state.searchQuery);
        }
      } else if (urlQuery && urlQuery.trim()) {
        if (urlQuery.trim() !== searchQuery) {
          setSearchQuery(urlQuery.trim());
          loadSearchFeed(1, false, "all", urlQuery.trim());
        }
      } else {
        // Exited search via phone/browser back button!
        if (searchQuery) {
          setSearchQuery("");
          setSearchFeed([]);
          setSearchCreators([]);
          setSearchSubTab("all");
        }
      }
    };

    window.addEventListener("popstate", handleExplorePopState);
    return () => window.removeEventListener("popstate", handleExplorePopState);
  }, [searchQuery, loadSearchFeed]);

  const handleSearchCreatorFollow = async (e, creator) => {
    e.stopPropagation();
    const uname = creator.username;
    const token = localStorage.getItem("token");
    if (!token) return promptLogin("follow");
    if (searchFollowingLoading[uname]) return;

    const isCurrentlyFollowing = searchFollowingMap[uname] !== undefined
      ? searchFollowingMap[uname]
      : Boolean(creator.is_following);
    const nextFollowing = !isCurrentlyFollowing;

    setSearchFollowingMap(prev => ({ ...prev, [uname]: nextFollowing }));
    setSearchFollowingLoading(prev => ({ ...prev, [uname]: true }));

    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(uname)}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to update follow");
      setSearchFollowingMap(prev => ({ ...prev, [uname]: Boolean(data.following) }));
      showToast(data.following ? `Following @${uname}` : `Unfollowed @${uname}`, data.following ? "success" : "error");
      window.dispatchEvent(new CustomEvent("refreshUser"));
    } catch (err) {
      setSearchFollowingMap(prev => ({ ...prev, [uname]: isCurrentlyFollowing }));
      showToast(err.message || "Failed to update follow", "error");
    } finally {
      setSearchFollowingLoading(prev => ({ ...prev, [uname]: false }));
    }
  };

  // 🟢 INITIAL FEED LOADS
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      loadForYouFeed(false);
      loadCommunityFeed(1, false);
      return;
    }
  }, [loadForYouFeed, loadCommunityFeed]);

  // 🟢 AUTO-SEARCH DEBOUNCE
  useEffect(() => {
    if (isFirstMount.current) return;

    if (!searchQuery.trim()) {
      setSearchFeed([]);
      setSearchCreators([]);
      setSearchSubTab("all");
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      setSearchPage(1);
      setHasMoreSearch(true);
      loadSearchFeed(1, false, searchSubTab);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, searchSubTab]);

  // 🟢 TAB SWITCHING HANDLER
  const handleTabSwitch = (tab) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    if (tab === "community" && communityFeed.length === 0 && !communityLoading) {
      loadCommunityFeed(1, false);
    }
    if (tab === "for_you" && forYouFeed.length === 0 && !forYouLoading) {
      loadForYouFeed(false);
    }
  };

  // 🟢 INFINITE SCROLL OBSERVER
  const observer = useRef();
  const lastElementRef = useCallback(node => {
    const isSearching = Boolean(searchQuery.trim());
    if (isSearching) {
      if (searchLoading || searchLoadingMore) return;
    } else if (activeTab === "community") {
      if (communityLoading || communityLoadingMore) return;
    } else {
      if (forYouLoading || forYouLoadingMore) return;
    }
    
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        if (isSearching) {
          if (hasMoreSearch) loadSearchFeed(searchPage + 1, true);
        } else if (activeTab === "community") {
          if (hasMoreCommunity) loadCommunityFeed(communityPage + 1, true);
        } else {
          loadForYouFeed(true);
        }
      }
    });
    if (node) observer.current.observe(node);
  }, [
    searchQuery, searchLoading, searchLoadingMore, hasMoreSearch, searchPage, loadSearchFeed,
    activeTab, communityLoading, communityLoadingMore, hasMoreCommunity, communityPage, loadCommunityFeed,
    forYouLoading, forYouLoadingMore, loadForYouFeed
  ]);

  // Action for empty community state
  const handleCommunityAction = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      promptLogin("upload");
      return;
    }
    if (user?.is_creator || user?.role === "creator") {
      setShowUploadModal(true);
    } else {
      window.dispatchEvent(new CustomEvent("openCreatorSetup"));
      if (onProfileClick) onProfileClick();
    }
  };

  const isSearching = Boolean(searchQuery.trim());

  // 🟢 COMMON TIMELINE FEED CONTENT (Shared between mobile and desktop feeds)
  const renderTimelineContent = () => {
    // 1. Search Results View
    if (isSearching) {
      if (searchLoading) {
        return [...Array(5)].map((_, i) => (
          <div key={i} style={postStyle}>
            <div style={avatarColumnStyle}><div style={skeletonAvatar} /></div>
            <div style={contentColumnStyle}>
              <div style={skeletonTextBase} />
              <div style={{ ...skeletonTextBase, width: "80%", marginTop: "6px", marginBottom: "12px" }} />
              <div style={{ ...skeletonVideo, width: "75%" }} />
            </div>
          </div>
        ));
      }

      const hasCreators = searchCreators.length > 0;
      const hasVideos = searchFeed.length > 0;

      // When subTab is "creators"
      if (searchSubTab === "creators") {
        if (!hasCreators) {
          return (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "#71767b" }}>
              <Users size={40} color="#333" style={{ marginBottom: "12px" }} />
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#ccc" }}>No creators found</p>
              <p style={{ margin: "6px 0 0 0", fontSize: "13px" }}>No creators matched "{searchQuery}". Try searching for another name or handle.</p>
            </div>
          );
        }
        return (
          <div style={{ width: "100%" }}>
            {searchCreators.map(creator => (
              <SearchCreatorCard
                key={creator.username}
                creator={creator}
                onCreatorClick={onCreatorClick}
                onFollowToggle={handleSearchCreatorFollow}
                isFollowing={searchFollowingMap[creator.username] !== undefined ? searchFollowingMap[creator.username] : creator.is_following}
                isLoadingFollow={Boolean(searchFollowingLoading[creator.username])}
              />
            ))}
          </div>
        );
      }

      // When subTab is "videos"
      if (searchSubTab === "videos") {
        if (!hasVideos) {
          return (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "#71767b" }}>
              <Film size={40} color="#333" style={{ marginBottom: "12px" }} />
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#ccc" }}>No videos found</p>
              <p style={{ margin: "6px 0 0 0", fontSize: "13px" }}>No videos found for "{searchQuery}". Try a different keyword.</p>
            </div>
          );
        }
        return searchFeed.map((video, idx) => (
          <FeedPost 
            key={`search-${video.message_id || video.id}-${idx}`}
            video={video}
            isLast={searchFeed.length === idx + 1}
            lastElementRef={lastElementRef}
            onVideoClick={onVideoClick}
            onCommentClick={onCommentClick} 
            isAnyModalOpen={isAnyModalOpen} 
            onCreatorClick={onCreatorClick}
            user={user}
          />
        ));
      }

      // Default subTab: "all"
      if (!hasCreators && !hasVideos) {
        return (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#71767b" }}>
            <Search size={40} color="#333" style={{ marginBottom: "12px" }} />
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#ccc" }}>No results found</p>
            <p style={{ margin: "6px 0 0 0", fontSize: "13px" }}>No creators or videos found for "{searchQuery}". Try a different keyword, handle, or category.</p>
          </div>
        );
      }

      return (
        <div>
          {hasCreators && (
            <div style={{ borderBottom: "1px solid var(--border-color, #2f3336)" }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between", 
                padding: "14px 16px 10px 16px",
                borderBottom: "1px solid var(--border-color, #2f3336)",
                background: "transparent"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Users size={18} color="var(--primary-color, #1d9bf0)" />
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "var(--text-primary, #ffffff)" }}>
                    Creators
                  </h3>
                </div>
                {searchCreators.length > 3 && (
                  <button
                    onClick={() => {
                      setSearchSubTab("creators");
                      loadSearchFeed(1, false, "creators");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--primary-color, #1d9bf0)",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                      padding: 0
                    }}
                  >
                    View all ({searchCreators.length})
                  </button>
                )}
              </div>

              <div>
                {searchCreators.slice(0, 3).map(creator => (
                  <SearchCreatorCard
                    key={creator.username}
                    creator={creator}
                    onCreatorClick={onCreatorClick}
                    onFollowToggle={handleSearchCreatorFollow}
                    isFollowing={searchFollowingMap[creator.username] !== undefined ? searchFollowingMap[creator.username] : creator.is_following}
                    isLoadingFollow={Boolean(searchFollowingLoading[creator.username])}
                  />
                ))}
              </div>
            </div>
          )}

          {hasVideos && (
            <div>
              {hasCreators && (
                <div style={{ 
                  padding: "12px 16px 8px 16px", 
                  fontSize: "13px", 
                  fontWeight: "700", 
                  color: "#8e8e8e", 
                  textTransform: "uppercase", 
                  letterSpacing: "0.5px" 
                }}>
                  Videos
                </div>
              )}
              {searchFeed.map((video, idx) => (
                <FeedPost 
                  key={`search-${video.message_id || video.id}-${idx}`}
                  video={video}
                  isLast={searchFeed.length === idx + 1}
                  lastElementRef={lastElementRef}
                  onVideoClick={onVideoClick}
                  onCommentClick={onCommentClick} 
                  isAnyModalOpen={isAnyModalOpen} 
                  onCreatorClick={onCreatorClick}
                  user={user}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    // 2. Community Tab View (Web creator uploads only)
    if (activeTab === "community") {
      if (communityLoading) {
        return [...Array(5)].map((_, i) => (
          <div key={i} style={postStyle}>
            <div style={avatarColumnStyle}><div style={skeletonAvatar} /></div>
            <div style={contentColumnStyle}>
              <div style={skeletonTextBase} />
              <div style={{ ...skeletonTextBase, width: "80%", marginTop: "6px", marginBottom: "12px" }} />
              <div style={{ ...skeletonVideo, width: "75%" }} />
            </div>
          </div>
        ));
      }
      if (communityFeed.length === 0) {
        return (
          <div style={communityEmptyWrapper}>
            <div style={communityEmptyIconBox}>
              <Users size={32} color="var(--primary-color, #1d9bf0)" />
            </div>
            <h3 style={communityEmptyTitle}>Creator Community</h3>
            <p style={communityEmptySubtitle}>
              Exclusive videos, drops, and stories posted directly by verified web creators.
            </p>
            <div style={communityNoticeCard}>
              <Sparkles size={20} color="#FFD700" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: "13px", color: "#ccc", lineHeight: "1.4" }}>
                All content published by verified web creators appears exclusively here in the Community tab.
              </span>
            </div>
            <button
              type="button"
              onClick={handleCommunityAction}
              style={communityEmptyActionBtn}
            >
              {user?.is_creator || user?.role === "creator" ? (
                <>
                  <Film size={16} />
                  <span>Publish First Video</span>
                </>
              ) : user ? (
                <>
                  <Sparkles size={16} />
                  <span>Become a Web Creator</span>
                </>
              ) : (
                <span>Log In to Post</span>
              )}
            </button>
          </div>
        );
      }
      return communityFeed.map((video, idx) => (
        <FeedPost 
          key={`comm-${video.message_id || video.id}-${idx}`}
          video={video}
          isLast={communityFeed.length === idx + 1}
          lastElementRef={lastElementRef}
          onVideoClick={onVideoClick}
          onCommentClick={onCommentClick} 
          isAnyModalOpen={isAnyModalOpen} 
          onCreatorClick={onCreatorClick}
          user={user}
        />
      ));
    }

    // 3. For You Tab View (Platform content & Suggested Creators)
    if (forYouLoading) {
      return [...Array(5)].map((_, i) => (
        <div key={i} style={postStyle}>
          <div style={avatarColumnStyle}><div style={skeletonAvatar} /></div>
          <div style={contentColumnStyle}>
            <div style={skeletonTextBase} />
            <div style={{ ...skeletonTextBase, width: "80%", marginTop: "6px", marginBottom: "12px" }} />
            <div style={{ ...skeletonVideo, width: "75%" }} />
          </div>
        </div>
      ));
    }
    if (forYouFeed.length === 0) {
      return (
        <div style={{ padding: "50px 20px", textAlign: "center", color: "#71767b" }}>
          No videos available in {selectedCategory ? `#${selectedCategory}` : "For You"}.
        </div>
      );
    }
    return forYouFeed.map((video, idx) => {
      const isLast = forYouFeed.length === idx + 1;
      const isFirstSuggestedSpot = featuredCreators.length > 0 && !selectedCategory && (
        (idx === suggestedIndex) ||
        (idx === forYouFeed.length - 1 && forYouFeed.length <= suggestedIndex)
      );
      const isSecondSuggestedSpot = featuredCreators.length > 8 && !selectedCategory && (
        forYouFeed.length > 15 && idx === suggestedIndex + 14
      );

      return (
        <React.Fragment key={`for-you-${video.message_id || video.id}-${idx}`}>
          <FeedPost 
            video={video}
            isLast={isLast}
            lastElementRef={lastElementRef}
            onVideoClick={onVideoClick}
            onCommentClick={onCommentClick} 
            isAnyModalOpen={isAnyModalOpen} 
            onCreatorClick={onCreatorClick}
            user={user}
          />

          {isFirstSuggestedSpot && (
            <InstagramSuggestedCreators 
              creators={featuredCreators.slice(0, 8)}
              onCreatorClick={onCreatorClick}
              onSeeAll={handleOpenDiscover}
              user={user}
            />
          )}

          {isSecondSuggestedSpot && (
            <InstagramSuggestedCreators 
              creators={featuredCreators.slice(8, 16)}
              onCreatorClick={onCreatorClick}
              onSeeAll={handleOpenDiscover}
              user={user}
            />
          )}
        </React.Fragment>
      );
    });
  };

  return (
    <div style={{ background: "var(--bg-color)", height: "100vh", overflow: "hidden", position: "relative" }}>
      
      {/* 🟢 MOBILE VIEW (< 1024px) */}
      {!isDesktop && (
        <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          {/* Mobile AppHeader / Active Search Header + Two Tabs Overlay */}
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            zIndex: 1000,
            transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease",
            transform: shouldHideUI ? "translateY(-100%)" : "translateY(0)",
            opacity: shouldHideUI ? 0 : 1,
            pointerEvents: shouldHideUI ? "none" : "auto",
            background: "var(--bg-color, #0a0a0a)"
          }}>
            {/* AppHeader is kept in tree for portal search modal */}
            <div style={{ display: isSearching ? "none" : "block" }}>
              <AppHeader 
                isDesktop={false} 
                searchTerm={searchQuery} 
                setSearchTerm={setSearchQuery} 
                onSearchSubmit={handleSearchSubmit}
                user={user} 
                onProfileClick={onProfileClick} 
                onVideoClick={onVideoClick}
                onCreatorClick={onCreatorClick}
              />
            </div>

            {/* When in Active Search Mode: Show Mobile Active Search Bar Header */}
            {isSearching && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                padding: "8px 14px",
                background: "var(--bg-color, #0a0a0a)",
                borderBottom: "1px solid #262626",
                minHeight: "50px",
                boxSizing: "border-box"
              }}>
                <button
                  type="button"
                  onClick={handleExitSearch}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#ffffff",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "6px",
                    borderRadius: "50%",
                    flexShrink: 0
                  }}
                  title="Back to Explore"
                  aria-label="Back to Explore"
                >
                  <ArrowLeft size={22} />
                </button>

                <div
                  onClick={() => window.dispatchEvent(new CustomEvent("openSearchModal"))}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    background: "#1c1c1e",
                    borderRadius: "20px",
                    padding: "6px 12px",
                    border: "1px solid #333333",
                    cursor: "pointer",
                    gap: "8px"
                  }}
                >
                  <Search size={16} color="#8e8e8e" style={{ flexShrink: 0 }} />
                  <span style={{
                    color: "#ffffff",
                    fontSize: "14px",
                    fontWeight: "600",
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}>
                    {searchQuery}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExitSearch();
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#8e8e8e",
                      cursor: "pointer",
                      padding: "2px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                    title="Clear search"
                  >
                    <X size={16} />
                  </button>
                </div>

                <button 
                  type="button"
                  onClick={onProfileClick} 
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}
                >
                  {user?.id || user?.email ? (
                    <img 
                      src={user.avatar_url || "/assets/default-avatar.png"} 
                      alt="P" 
                      style={{ width: "30px", height: "30px", borderRadius: "50%", border: "2px solid var(--primary-color)", objectFit: "cover" }} 
                    />
                  ) : (
                    <div style={{ background: "var(--primary-color)", color: "#fff", padding: "5px 10px", borderRadius: "18px", fontSize: "11px", fontWeight: "800" }}>
                      LOGIN
                    </div>
                  )}
                </button>
              </div>
            )}

            {/* Mobile Explore Tabs / Search Subtabs */}
            {isSearching ? (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                background: "var(--bg-color, #0a0a0a)",
                borderBottom: "1px solid #2f3336",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch"
              }}>
                {[
                  { key: "all", label: "Top" },
                  { key: "creators", label: `Creators (${searchCreators.length})` },
                  { key: "videos", label: `Videos (${searchFeed.length})` }
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setSearchSubTab(tab.key);
                      loadSearchFeed(1, false, tab.key);
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "18px",
                      fontSize: "12.5px",
                      fontWeight: searchSubTab === tab.key ? "700" : "500",
                      background: searchSubTab === tab.key ? "var(--primary-color, #1d9bf0)" : "#16181c",
                      color: searchSubTab === tab.key ? "#fff" : "#71767b",
                      border: `1px solid ${searchSubTab === tab.key ? "transparent" : "#2f3336"}`,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      transition: "all 0.15s ease"
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : (
              <div style={exploreTabsNavWrapper}>
                <div style={exploreTabsNavInner}>
                  <button
                    type="button"
                    onClick={() => handleTabSwitch("for_you")}
                    style={exploreTabBtnStyle}
                  >
                    <span style={{
                      fontSize: "14.5px",
                      fontWeight: activeTab === "for_you" ? "700" : "500",
                      color: activeTab === "for_you" ? "#ffffff" : "#71767b",
                      letterSpacing: "0.2px",
                      transition: "color 0.2s ease, font-weight 0.15s ease"
                    }}>
                      For You
                    </span>
                    {activeTab === "for_you" && <div style={exploreTabActivePillStyle} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabSwitch("community")}
                    style={exploreTabBtnStyle}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{
                        fontSize: "14.5px",
                        fontWeight: activeTab === "community" ? "700" : "500",
                        color: activeTab === "community" ? "#ffffff" : "#71767b",
                        letterSpacing: "0.2px",
                        transition: "color 0.2s ease, font-weight 0.15s ease"
                      }}>
                        Community
                      </span>
                      {communityCount > 0 && (
                        <span style={communityCountPillStyle}>
                          {communityCount}
                        </span>
                      )}
                    </div>
                    {activeTab === "community" && <div style={exploreTabActivePillStyle} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Scrollable Timeline */}
          <div 
            ref={!isDesktop ? scrollContainerRef : null}
            style={{
              flex: 1,
              overflowY: "auto",
              paddingTop: "114px",
              paddingBottom: shouldHideUI ? "0px" : "70px",
              transition: "padding-bottom 0.3s ease, padding-top 0.2s ease"
            }}
          >
            <PullToRefresh 
              scrollRef={scrollContainerRef}
              onRefresh={async () => {
                if (isSearching) {
                  setSearchPage(1);
                  setHasMoreSearch(true);
                  await loadSearchFeed(1, false);
                } else if (activeTab === "community") {
                  setCommunityPage(1);
                  setHasMoreCommunity(true);
                  await loadCommunityFeed(1, false);
                } else {
                  setSuggestedIndex(Math.floor(Math.random() * 4) + 2);
                  fetchFeaturedCreators();
                  await loadForYouFeed(false, selectedCategory);
                }
              }}
            >
              <div style={feedWrapper}>
                {renderTimelineContent()}

                {(isSearching ? searchLoadingMore : (activeTab === "community" ? communityLoadingMore : forYouLoadingMore)) && (
                  <div style={{ padding: "20px", display: "flex", justifyContent: "center", color: "var(--primary-color, #1d9bf0)" }}>
                    <Loader2 className="animate-spin" size={24} />
                  </div>
                )}
              </div>
            </PullToRefresh>
          </div>

          {/* Mobile Community Creator Post FAB */}
          {activeTab === "community" && (user?.is_creator || user?.role === "creator") && (
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              style={communityFabStyle}
              title="Post video to Community"
              aria-label="Post video to Community"
            >
              <Plus size={22} color="#ffffff" strokeWidth={2.5} />
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#fff", marginLeft: "4px" }}>
                Post
              </span>
            </button>
          )}
        </div>
      )}

      {/* 🟢 DESKTOP VIEW (>= 1024px: 3 Columns like X/Twitter) */}
      {isDesktop && (
        <div style={desktopContainerStyle}>
          <div style={desktopInnerWrapperStyle}>
            {/* 1. LEFT SIDEBAR: Menus and Categories */}
            <DesktopLeftSidebar
              user={user}
              activeTab={activeTab}
              onTabSwitch={handleTabSwitch}
              communityCount={communityCount}
              selectedCategory={selectedCategory}
              onSelectCategory={handleSelectCategory}
              onNavigateHome={() => onNavigateTab ? onNavigateTab("home") : (window.location.href = "/")}
              onProfileClick={onProfileClick}
              onOpenDiscover={handleOpenDiscover}
              onPostClick={handleCommunityAction}
            />

            {/* 2. MIDDLE COLUMN: Main Feed */}
            <div 
              ref={isDesktop ? scrollContainerRef : null}
              style={desktopCenterRailStyle}
              className="custom-scrollbar"
            >
              {/* Desktop Sticky Header */}
              <div style={desktopHeaderStickyStyle}>
                <div style={desktopHeaderTopStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={desktopHeaderTitleStyle}>
                      {selectedCategory ? `Explore · #${selectedCategory.toUpperCase()}` : "Explore"}
                    </span>
                    {selectedCategory && (
                      <button
                        type="button"
                        onClick={() => handleSelectCategory(selectedCategory)}
                        style={categoryFilterTagStyle}
                        title="Clear category filter"
                      >
                        <span>#{selectedCategory}</span>
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      if (activeTab === "community") {
                        setCommunityPage(1);
                        setHasMoreCommunity(true);
                        await loadCommunityFeed(1, false);
                      } else {
                        await loadForYouFeed(false, selectedCategory);
                      }
                    }}
                    style={desktopRefreshBtnStyle}
                    title="Refresh Feed"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>

                {/* Explore Tabs (For You / Community) */}
                {!isSearching && (
                  <div style={desktopTabsNavInner}>
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectCategory(null);
                        handleTabSwitch("for_you");
                      }}
                      style={desktopTabBtnStyle}
                    >
                      <span style={{
                        fontSize: "15px",
                        fontWeight: activeTab === "for_you" ? "700" : "500",
                        color: activeTab === "for_you" ? "#ffffff" : "#71767b",
                        transition: "color 0.2s ease"
                      }}>
                        For You
                      </span>
                      {activeTab === "for_you" && <div style={desktopTabActivePillStyle} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleSelectCategory(null);
                        handleTabSwitch("community");
                      }}
                      style={desktopTabBtnStyle}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{
                          fontSize: "15px",
                          fontWeight: activeTab === "community" ? "700" : "500",
                          color: activeTab === "community" ? "#ffffff" : "#71767b",
                          transition: "color 0.2s ease"
                        }}>
                          Community
                        </span>
                        {communityCount > 0 && (
                          <span style={communityCountPillStyle}>
                            {communityCount}
                          </span>
                        )}
                      </div>
                      {activeTab === "community" && <div style={desktopTabActivePillStyle} />}
                    </button>
                  </div>
                )}

                {isSearching && (
                  <div style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid #2f3336",
                    background: "rgba(0, 0, 0, 0.4)",
                    backdropFilter: "blur(10px)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                      <span style={{ fontSize: "15px", color: "#e7e9ea" }}>
                        Results for "<strong>{searchQuery}</strong>"
                      </span>
                      <button
                        type="button"
                        onClick={handleExitSearch}
                        style={desktopSearchClearBtn}
                      >
                        Clear
                      </button>
                    </div>

                    {/* Sub-tab pills */}
                    <div style={{ display: "flex", gap: "8px" }}>
                      {[
                        { key: "all", label: "Top / All" },
                        { key: "creators", label: `Creators (${searchCreators.length})` },
                        { key: "videos", label: `Videos (${searchFeed.length})` }
                      ].map(tab => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => {
                            setSearchSubTab(tab.key);
                            loadSearchFeed(1, false, tab.key);
                          }}
                          style={{
                            padding: "6px 14px",
                            borderRadius: "20px",
                            fontSize: "13px",
                            fontWeight: searchSubTab === tab.key ? "700" : "500",
                            background: searchSubTab === tab.key ? "var(--primary-color, #1d9bf0)" : "#16181c",
                            color: searchSubTab === tab.key ? "#fff" : "#71767b",
                            border: `1px solid ${searchSubTab === tab.key ? "transparent" : "#2f3336"}`,
                            cursor: "pointer",
                            transition: "all 0.15s ease"
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Main timeline content */}
              <div style={{ flex: 1 }}>
                {renderTimelineContent()}

                {/* Load More Spinners */}
                {(isSearching ? searchLoadingMore : (activeTab === "community" ? communityLoadingMore : forYouLoadingMore)) && (
                  <div style={{ padding: "24px", display: "flex", justifyContent: "center", color: "var(--primary-color, #1d9bf0)" }}>
                    <Loader2 className="animate-spin" size={26} />
                  </div>
                )}
              </div>
            </div>

            {/* 3. RIGHT SIDEBAR: Highlights & Trends */}
            <DesktopRightSidebar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSearchSubmit={handleSearchSubmit}
              onClear={handleExitSearch}
              onSelectTopic={(catId) => handleSelectCategory(catId)}
              highlights={highlightVideos}
              highlightsLoading={highlightLoading}
              featuredCreators={featuredCreators}
              onCreatorClick={onCreatorClick}
              onVideoClick={onVideoClick}
              onOpenDiscover={handleOpenDiscover}
              user={user}
            />
          </div>
        </div>
      )}

      {/* 🌟 CREATOR CONTENT UPLOAD MODAL */}
      {showUploadModal && (
        <CreatorUploadModal 
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onSuccess={(newVideo) => {
            if (newVideo) {
              setCommunityFeed(prev => [newVideo, ...prev]);
              setCommunityCount(prev => prev + 1);
            }
            setActiveTab("community");
            showToast("Video published to Community!", "success");
            setShowUploadModal(false);
          }}
          defaultCategory="hotties"
          user={user}
        />
      )}

      {/* 🌟 DISCOVER CREATORS MODAL */}
      {showDiscoverModal && (
        <DiscoverCreatorsModal 
          isOpen={showDiscoverModal}
          currentUser={user}
          onClose={() => setShowDiscoverModal(false)}
          onCreatorClick={(uname) => {
            setShowDiscoverModal(false);
            if (onCreatorClick) onCreatorClick(uname);
          }}
        />
      )}

      <style>{`
        @keyframes skeleton-loading { 0% { background-color: #222; } 50% { background-color: #333; } 100% { background-color: #222; } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.22); }
      `}</style>
    </div>
  );
}

// 🖌 STYLES 
const exploreTabsNavWrapper = {
  width: "100%",
  maxWidth: "600px",
  margin: "0 auto",
  display: "flex",
  borderBottom: "1px solid var(--border-color)",
  background: "var(--bg-color)",
  boxSizing: "border-box"
};

const exploreTabsNavInner = {
  display: "flex",
  width: "100%",
  height: "46px"
};

const exploreTabBtnStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "0 16px",
  transition: "background 0.2s ease"
};

const exploreTabActivePillStyle = {
  position: "absolute",
  bottom: 0,
  height: "3px",
  width: "56px",
  borderRadius: "3px 3px 0 0",
  backgroundColor: "var(--primary-color, #1d9bf0)"
};

const communityCountPillStyle = {
  background: "rgba(29, 155, 240, 0.15)",
  color: "var(--primary-color, #1d9bf0)",
  fontSize: "11px",
  fontWeight: "700",
  padding: "1px 6px",
  borderRadius: "10px",
  lineHeight: "1.3"
};

const communityEmptyWrapper = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "48px 20px",
  textAlign: "center",
  maxWidth: "420px",
  margin: "0 auto"
};

const communityEmptyIconBox = {
  width: "64px",
  height: "64px",
  borderRadius: "50%",
  background: "rgba(29, 155, 240, 0.1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "16px"
};

const communityEmptyTitle = {
  fontSize: "19px",
  fontWeight: "800",
  color: "#fff",
  marginBottom: "8px"
};

const communityEmptySubtitle = {
  fontSize: "14px",
  color: "#71767b",
  lineHeight: "1.5",
  marginBottom: "20px"
};

const communityNoticeCard = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "12px 16px",
  borderRadius: "12px",
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  textAlign: "left",
  marginBottom: "24px",
  width: "100%",
  boxSizing: "border-box"
};

const communityEmptyActionBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 24px",
  borderRadius: "24px",
  background: "var(--primary-color, #1d9bf0)",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "700",
  border: "none",
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(29, 155, 240, 0.35)",
  transition: "transform 0.15s ease, opacity 0.2s ease"
};

const communityFabStyle = {
  position: "fixed",
  bottom: "84px",
  right: "20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 18px",
  borderRadius: "24px",
  background: "var(--primary-color, #1d9bf0)",
  color: "#fff",
  border: "none",
  boxShadow: "0 6px 20px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(29, 155, 240, 0.4)",
  cursor: "pointer",
  zIndex: 990,
  transition: "transform 0.15s ease, box-shadow 0.2s ease"
};

// 🌟 DESKTOP 3-COLUMN LAYOUT STYLES (Twitter/X Inspired)
const desktopContainerStyle = {
  display: "flex",
  justifyContent: "center",
  width: "100%",
  height: "100vh",
  overflow: "hidden",
  background: "var(--bg-color)"
};

const desktopInnerWrapperStyle = {
  display: "flex",
  width: "100%",
  maxWidth: "1260px",
  height: "100vh",
  position: "relative"
};

const desktopLeftRailStyle = {
  width: "260px",
  height: "100vh",
  overflowY: "auto",
  position: "sticky",
  top: 0,
  flexShrink: 0,
  borderRight: "1px solid var(--border-color)",
  padding: "16px 14px 20px 14px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  boxSizing: "border-box"
};

const desktopBrandHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "8px 12px",
  cursor: "pointer",
  borderRadius: "9999px",
  transition: "background 0.2s ease",
  userSelect: "none"
};

const desktopBrandLogoCircle = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  background: "linear-gradient(135deg, #FF6B00 0%, #FF0055 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 2px 10px rgba(255, 107, 0, 0.4)",
  flexShrink: 0
};

const desktopNavBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  padding: "12px 16px",
  width: "100%",
  border: "none",
  background: "transparent",
  borderRadius: "9999px",
  cursor: "pointer",
  transition: "background 0.2s ease",
  textAlign: "left",
  boxSizing: "border-box"
};

const desktopNavIconBox = {
  width: "26px",
  height: "26px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0
};

const desktopNavLabelStyle = {
  fontSize: "17px",
  fontWeight: "600",
  color: "#e7e9ea",
  letterSpacing: "0.2px"
};

const desktopNavDividerStyle = {
  height: "1px",
  background: "var(--border-color)",
  margin: "14px 8px 12px 8px"
};

const desktopSectionHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 14px 8px 14px",
  fontSize: "11px",
  fontWeight: "800",
  color: "#71767b",
  letterSpacing: "0.8px"
};

const desktopClearCategoryBtn = {
  background: "none",
  border: "none",
  color: "var(--primary-color, #1d9bf0)",
  fontSize: "11px",
  fontWeight: "700",
  cursor: "pointer",
  padding: 0
};

const desktopCategoryBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "9px 14px",
  width: "100%",
  border: "none",
  background: "transparent",
  borderRadius: "10px",
  cursor: "pointer",
  transition: "all 0.15s ease",
  textAlign: "left",
  boxSizing: "border-box"
};

const desktopPostBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  width: "100%",
  height: "48px",
  borderRadius: "9999px",
  background: "var(--primary-color, #1d9bf0)",
  color: "#ffffff",
  border: "none",
  fontSize: "16px",
  fontWeight: "800",
  cursor: "pointer",
  marginTop: "18px",
  boxShadow: "0 4px 16px rgba(29, 155, 240, 0.35)",
  transition: "opacity 0.2s ease, transform 0.15s ease",
  boxSizing: "border-box"
};

const desktopUserPillStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "10px 12px",
  borderRadius: "9999px",
  cursor: "pointer",
  transition: "background 0.2s ease",
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(255, 255, 255, 0.04)"
};

const desktopUserPillAvatar = {
  width: "38px",
  height: "38px",
  borderRadius: "50%",
  objectFit: "cover",
  flexShrink: 0,
  border: "1px solid rgba(255, 255, 255, 0.12)"
};

const desktopUserPillName = {
  fontSize: "14px",
  fontWeight: "700",
  color: "#ffffff",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis"
};

const desktopUserPillHandle = {
  fontSize: "12px",
  color: "#71767b",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "block"
};

const desktopLoginPillBtn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  width: "100%",
  padding: "12px 16px",
  borderRadius: "9999px",
  background: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "700",
  cursor: "pointer",
  transition: "background 0.2s ease"
};

const desktopCenterRailStyle = {
  flex: 1,
  maxWidth: "620px",
  width: "100%",
  minWidth: 0,
  height: "100vh",
  overflowY: "auto",
  borderLeft: "1px solid var(--border-color)",
  borderRight: "1px solid var(--border-color)",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box"
};

const desktopHeaderStickyStyle = {
  position: "sticky",
  top: 0,
  zIndex: 100,
  background: "rgba(0, 0, 0, 0.8)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  borderBottom: "1px solid var(--border-color)",
  boxSizing: "border-box"
};

const desktopHeaderTopStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  height: "54px",
  padding: "0 16px",
  boxSizing: "border-box"
};

const desktopHeaderTitleStyle = {
  fontSize: "20px",
  fontWeight: "800",
  color: "#ffffff",
  letterSpacing: "-0.3px"
};

const categoryFilterTagStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  padding: "3px 10px",
  borderRadius: "12px",
  background: "rgba(29, 155, 240, 0.15)",
  color: "var(--primary-color, #1d9bf0)",
  border: "1px solid rgba(29, 155, 240, 0.3)",
  fontSize: "12px",
  fontWeight: "700",
  cursor: "pointer"
};

const desktopRefreshBtnStyle = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  background: "none",
  border: "none",
  color: "#71767b",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "color 0.2s ease, background 0.2s ease"
};

const desktopTabsNavInner = {
  display: "flex",
  width: "100%",
  height: "48px",
  borderTop: "1px solid rgba(255, 255, 255, 0.05)"
};

const desktopTabBtnStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  background: "none",
  border: "none",
  cursor: "pointer",
  transition: "background 0.2s ease"
};

const desktopTabActivePillStyle = {
  position: "absolute",
  bottom: 0,
  height: "4px",
  width: "56px",
  borderRadius: "4px 4px 0 0",
  backgroundColor: "var(--primary-color, #1d9bf0)"
};

const desktopSearchActiveBanner = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 16px",
  background: "rgba(29, 155, 240, 0.08)",
  borderTop: "1px solid rgba(29, 155, 240, 0.2)"
};

const desktopSearchClearBtn = {
  background: "none",
  border: "none",
  color: "var(--primary-color, #1d9bf0)",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer"
};

const desktopRightRailStyle = {
  width: "350px",
  height: "100vh",
  overflowY: "auto",
  position: "sticky",
  top: 0,
  flexShrink: 0,
  padding: "16px 18px 24px 18px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  boxSizing: "border-box"
};

const desktopSearchBoxWrapper = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "10px 16px",
  borderRadius: "9999px",
  background: "#202327",
  border: "1px solid transparent",
  boxSizing: "border-box",
  transition: "border-color 0.2s ease"
};

const desktopSearchInput = {
  flex: 1,
  background: "transparent",
  border: "none",
  color: "#ffffff",
  fontSize: "14px",
  outline: "none"
};

const desktopSearchInputClearBtn = {
  width: "20px",
  height: "20px",
  borderRadius: "50%",
  background: "#71767b",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0
};

const desktopCardStyle = {
  background: "#16181c",
  borderRadius: "16px",
  border: "1px solid var(--border-color)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column"
};

const desktopCardHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 16px 10px 16px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.05)"
};

const desktopCardTitleStyle = {
  fontSize: "17px",
  fontWeight: "800",
  color: "#ffffff",
  margin: 0,
  letterSpacing: "-0.2px"
};

const desktopTrendItemStyle = {
  display: "flex",
  flexDirection: "column",
  padding: "12px 16px",
  cursor: "pointer",
  transition: "background 0.15s ease",
  borderBottom: "1px solid rgba(255, 255, 255, 0.03)"
};

const desktopTrendSublabel = {
  fontSize: "11px",
  color: "#71767b",
  marginBottom: "2px"
};

const desktopTrendTitle = {
  fontSize: "15px",
  fontWeight: "700",
  color: "#ffffff",
  marginBottom: "3px"
};

const desktopTrendPosts = {
  fontSize: "12px",
  color: "#71767b"
};

const desktopHighlightCardStyle = {
  display: "flex",
  gap: "12px",
  padding: "10px 16px",
  cursor: "pointer",
  transition: "background 0.15s ease",
  alignItems: "center",
  borderBottom: "1px solid rgba(255, 255, 255, 0.03)"
};

const desktopHighlightThumbBox = {
  width: "68px",
  height: "82px",
  borderRadius: "8px",
  overflow: "hidden",
  background: "#111",
  flexShrink: 0,
  position: "relative"
};

const desktopHighlightThumbImg = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block"
};

const desktopHighlightPlayOverlay = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "24px",
  height: "24px",
  borderRadius: "50%",
  background: "rgba(0,0,0,0.65)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const desktopHighlightVipTag = {
  position: "absolute",
  top: 4,
  left: 4,
  background: "rgba(255, 215, 0, 0.9)",
  color: "#000",
  fontSize: "9px",
  fontWeight: "800",
  padding: "1px 5px",
  borderRadius: "4px"
};

const desktopHighlightInfo = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "4px"
};

const desktopHighlightCaption = {
  color: "#ffffff",
  fontSize: "13px",
  fontWeight: "600",
  margin: 0,
  lineHeight: "1.35",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden"
};

const desktopHighlightMeta = {
  color: "#71767b",
  fontSize: "11px",
  display: "flex",
  alignItems: "center",
  gap: "6px"
};

const desktopHighlightSkeleton = {
  display: "flex",
  gap: "12px",
  padding: "10px 16px",
  alignItems: "center"
};

const desktopSideCreatorRow = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 16px",
  cursor: "pointer",
  transition: "background 0.15s ease",
  borderBottom: "1px solid rgba(255, 255, 255, 0.03)"
};

const desktopSideCreatorAvatarRing = {
  width: "42px",
  height: "42px",
  borderRadius: "50%",
  padding: "2px",
  background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
  flexShrink: 0
};

const desktopSideCreatorAvatarImg = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  objectFit: "cover",
  display: "block",
  background: "#222"
};

const desktopSideCreatorInfo = {
  flex: 1,
  minWidth: 0
};

const desktopSideCreatorName = {
  fontSize: "14px",
  fontWeight: "700",
  color: "#ffffff",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "block"
};

const desktopSideCreatorHandle = {
  fontSize: "12px",
  color: "#71767b",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "block"
};

const desktopSideFollowBtn = {
  padding: "6px 16px",
  borderRadius: "9999px",
  background: "#eff3f4",
  color: "#0f1419",
  border: "none",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
  flexShrink: 0,
  transition: "background 0.2s ease"
};

const desktopSideFollowingBtn = {
  padding: "6px 16px",
  borderRadius: "9999px",
  background: "transparent",
  color: "#eff3f4",
  border: "1px solid #536471",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
  flexShrink: 0
};

const desktopCardShowMoreBtn = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "14px 16px",
  background: "none",
  border: "none",
  color: "var(--primary-color, #1d9bf0)",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "background 0.15s ease",
  textAlign: "left"
};

const desktopFooterStyle = {
  padding: "4px 8px",
  display: "flex",
  flexDirection: "column",
  gap: "6px"
};

const desktopFooterLinks = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 12px"
};

const desktopFooterLink = {
  color: "#71767b",
  fontSize: "12px",
  textDecoration: "none"
};

const desktopFooterCopy = {
  color: "#71767b",
  fontSize: "12px",
  marginTop: "4px"
};

const feedWrapper = { maxWidth: "600px", margin: "0 auto", width: "100%", borderLeft: window.innerWidth > 600 ? "1px solid var(--border-color)" : "none", borderRight: window.innerWidth > 600 ? "1px solid var(--border-color)" : "none", minHeight: "100vh" };
const postStyle = { padding: "16px", borderBottom: "1px solid var(--border-color)", display: "flex", flexDirection: "row", animation: "fadeIn 0.3s ease-out" };
const avatarColumnStyle = { marginRight: "12px", flexShrink: 0 };
const contentColumnStyle = { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 };
const postHeaderStyle = { display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" };
const avatarStyle = { width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", backgroundColor: "#222" };
const usernameStyle = { fontSize: "15px", fontWeight: "700", color: "#fff" };
const timeStyle = { fontSize: "13px", color: "#71767b", textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const captionStyle = { fontSize: "15px", lineHeight: "1.5", color: "#e7e9ea", margin: "0 0 12px 0", wordWrap: "break-word" };

// 🟢 FIX: Removed hardcoded width (now handled inline by state). Removed aspectRatio.
const videoContainerStyle = { position: "relative", borderRadius: "16px", overflow: "hidden", background: "#111", border: "1px solid #333", cursor: "pointer", maxHeight: "600px" };

// 🟢 FIX: Let media scale naturally up to 600px tall
const thumbnailImgStyle = { width: "100%", height: "auto", maxHeight: "600px", objectFit: "cover", display: "block" };
const playOverlayStyle = { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "50px", height: "50px", borderRadius: "50%", background: "var(--primary-color)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", border: "2px solid rgba(255,255,255,0.2)" };
const groupBadgeStyle = { position: "absolute", top: "12px", right: "12px", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.15)", zIndex: 11 };
const actionBarStyle = { display: "flex", justifyContent: "space-between", marginTop: "12px", maxWidth: "425px" };
const actionItemStyle = { display: "flex", alignItems: "center", gap: "6px", color: "#71767b", fontSize: "13px", cursor: "pointer", transition: "color 0.2s ease" };
const skeletonAvatar = { width: "40px", height: "40px", borderRadius: "50%", animation: "skeleton-loading 1.5s infinite" };
const skeletonTextBase = { width: "150px", height: "20px", borderRadius: "4px", marginTop: "4px", animation: "skeleton-loading 1.5s infinite" };
const skeletonVideo = { width: "100%", height: "300px", borderRadius: "16px", animation: "skeleton-loading 1.5s infinite" };

// 🌟 Instagram-Style Suggested Creators Styles
const igSuggestedWrapper = {
  width: "100%",
  padding: "16px 12px 16px 12px",
  margin: "12px 0 16px 0",
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)",
  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  boxSizing: "border-box"
};

const igSuggestedHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "14px",
  padding: "0 4px"
};

const igSuggestedTitle = {
  fontSize: "14px",
  fontWeight: "700",
  letterSpacing: "0.2px",
  color: "#ffffff"
};

const igSeeAllBtn = {
  background: "transparent",
  border: "none",
  color: "#0095f6",
  fontSize: "12.5px",
  fontWeight: "600",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 8px",
  borderRadius: "6px",
  transition: "background 0.2s ease, opacity 0.2s ease"
};

const igSuggestedSubtitle = {
  fontSize: "11px",
  color: "#8e8e93",
  fontWeight: "500"
};

const igArrowBtn = {
  width: "24px",
  height: "24px",
  borderRadius: "50%",
  background: "rgba(255, 255, 255, 0.08)",
  border: "none",
  color: "#ffffff",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  transition: "background 0.2s ease"
};

const igScrollTrack = {
  display: "flex",
  gap: "12px",
  overflowX: "auto",
  paddingBottom: "6px",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  scrollSnapType: "x mandatory",
  WebkitOverflowScrolling: "touch"
};

const igCardBox = {
  position: "relative",
  flex: "0 0 152px",
  width: "152px",
  minWidth: "152px",
  maxWidth: "152px",
  background: "#161616",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "12px",
  padding: "16px 10px 14px 10px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  boxSizing: "border-box",
  scrollSnapAlign: "start",
  cursor: "pointer",
  transition: "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease"
};

const igDismissBtn = {
  position: "absolute",
  top: "8px",
  right: "8px",
  width: "20px",
  height: "20px",
  borderRadius: "50%",
  background: "transparent",
  border: "none",
  color: "#71767b",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  zIndex: 2,
  transition: "color 0.2s ease, background 0.2s ease"
};

const igAvatarContainer = {
  position: "relative",
  width: "60px",
  height: "60px",
  marginBottom: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const igAvatarRing = {
  width: "60px",
  height: "60px",
  borderRadius: "50%",
  padding: "2px",
  background: "linear-gradient(135deg, #00aff0 0%, #0077b5 100%)",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const igAvatarImg = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  objectFit: "cover",
  backgroundColor: "#111",
  border: "2px solid #161616",
  display: "block"
};

const igVerifiedBadge = {
  position: "absolute",
  bottom: "-1px",
  right: "-1px",
  background: "#000",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1px"
};

const igDisplayName = {
  fontSize: "13px",
  fontWeight: "700",
  color: "#ffffff",
  textAlign: "center",
  width: "100%",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  lineHeight: "1.3"
};

const igHandleName = {
  fontSize: "11px",
  color: "#8e8e93",
  textAlign: "center",
  width: "100%",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  marginTop: "2px"
};

const igCategoryTag = {
  fontSize: "10px",
  fontWeight: "600",
  color: "#00aff0",
  background: "rgba(0, 175, 240, 0.12)",
  padding: "2px 7px",
  borderRadius: "10px",
  marginTop: "6px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "100%",
  display: "inline-block"
};

const igFollowBtn = {
  width: "100%",
  marginTop: "12px",
  padding: "7px 0",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: "700",
  color: "#000000",
  backgroundColor: "#ffffff",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.15s ease, transform 0.1s ease"
};

const igFollowingBtn = {
  width: "100%",
  marginTop: "12px",
  padding: "6px 0",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: "700",
  color: "#ffffff",
  backgroundColor: "rgba(255, 255, 255, 0.15)",
  border: "1px solid rgba(255, 255, 255, 0.3)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.15s ease"
};

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