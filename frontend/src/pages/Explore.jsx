import React, { useState, useEffect, useRef, useCallback } from "react";
import { Heart, MessageCircle, Share2, Eye, Play, Loader2, Bookmark, CheckCircle, Sparkles, Lock, ChevronLeft, ChevronRight } from "lucide-react";
import { APP_CONFIG } from "../config";
import PullToRefresh from "../components/PullToRefresh";
import AppHeader from "../components/AppHeader"; // 🟢 IMPORT APPHEADER
import { isUserSubscribedToCreator, getVideoCreatorHandle } from "../utils/subscription";

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
          const res = await fetch(`${APP_CONFIG.apiUrl}/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}&noview=1`);
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
    if (!token) return alert("Please log in to like videos!");

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
    if (!token) return alert("Please log in to save videos!");

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
    const shareUrl = `${window.location.origin}/v/${video.message_id}`;
    
    if (navigator.share) {
      navigator.share({ title: video.caption, url: shareUrl }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert("Link copied to clipboard!");
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
    if (!token) return alert("Please log in to comment!");
    
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

        <p style={captionStyle}>{video.caption || APP_CONFIG.defaultCaption}</p>

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
                      style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} 
                      muted 
                      loop 
                      playsInline 
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
                <Lock size={14} color="#FFD700" />
                <span>Subscribe to @{creatorHandle} to unlock all {albumVideos.length} videos</span>
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
                style={thumbnailImgStyle} 
                muted 
                loop 
                playsInline 
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
                    <span>Subscribe to @{creatorHandle}</span>
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
      </div>
    </div>
  );
};

// 🟢 EXPLORE COMPONENT
export default function Explore({ 
  user, // 🟢 ADDED
  onProfileClick, // 🟢 ADDED
  setHideFooter, // 🟢 ADDED
  onVideoClick, 
  onCommentClick, 
  isAnyModalOpen,
  onCreatorClick
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreSearch, setHasMoreSearch] = useState(true);
  const [featuredCreators, setFeaturedCreators] = useState([]);

  useEffect(() => {
    let isMounted = true;
    fetch(`${APP_CONFIG.apiUrl}/api/creator/featured/list`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (isMounted && data?.creators) {
          setFeaturedCreators(data.creators);
        }
      })
      .catch(() => {});
    return () => { isMounted = false; };
  }, []);

  // 🟢 SCROLL UI STATES
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);
  const [isUIHidden, setIsUIHidden] = useState(false);
  
  const scrollContainerRef = useRef(null);
  const lastScrollY = useRef(0);
  const isFirstMount = useRef(true);

  const shouldHideUI = isUIHidden && !isDesktop;
  
  const observer = useRef();
  const lastElementRef = useCallback(node => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        if (searchQuery.trim()) {
          if (hasMoreSearch) loadSearchFeed(searchPage + 1, true);
        } else {
          loadRandomFeed(true);
        }
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, searchQuery, hasMoreSearch, searchPage]);

  // 🟢 Window Resize Listener
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 🟢 Split Footer Broadcast Effects
  useEffect(() => {
    if (setHideFooter) setHideFooter(shouldHideUI);
  }, [shouldHideUI, setHideFooter]);

  useEffect(() => {
    return () => {
      if (setHideFooter) setHideFooter(false);
    };
  }, [setHideFooter]);

  // 🟢 Soft Delete Event Listener
  useEffect(() => {
    const handleVideoDeleted = (event) => {
      const deletedId = String(event.detail);
      setFeed(prevFeed => prevFeed.filter(v => String(v.id || v.message_id) !== deletedId));
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

  const loadRandomFeed = async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const exploreCategories = [...APP_CONFIG.categories];
      if (!exploreCategories.includes("premium")) {
        exploreCategories.push("premium");
      }
      
      const fetches = exploreCategories.map(async (cat) => {
        let res = await fetch(`${APP_CONFIG.apiUrl}/api/videos?category=${cat}&limit=8&sort=random`);
        let data = res.ok ? await res.json() : { videos: [] };
        
        if (!data.videos || data.videos.length === 0) {
          res = await fetch(`${APP_CONFIG.apiUrl}/api/videos?category=${cat}&limit=8&page=1`);
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
        setFeed(prev => {
          const newMap = new Map();
          prev.forEach(v => newMap.set(v.message_id, v));
          shuffled.forEach(v => newMap.set(v.message_id, v));
          return Array.from(newMap.values());
        });
      } else {
        setFeed(shuffled);
      }
    } catch (err) { console.error("Failed to load explore feed", err); }
    
    setLoading(false);
    setLoadingMore(false);
  };

  const loadSearchFeed = async (pageNum = 1, isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/search?q=${encodeURIComponent(searchQuery)}&limit=15&page=${pageNum}`);
      if (res.ok) {
        const data = await res.json();
        const safeVideos = data.videos || [];

        if (isLoadMore) setFeed(prev => [...prev, ...safeVideos]);
        else setFeed(safeVideos);
        
        setHasMoreSearch(data.hasMore);
        setSearchPage(pageNum);
      }
    } catch (err) { console.error("Search failed", err); }

    setLoading(false);
    setLoadingMore(false);
  };

  // 🟢 AUTO-SEARCH DEBOUNCE
  // Whenever the user types in the AppHeader, wait 600ms then execute the search
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      loadRandomFeed(false);
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      setSearchPage(1);
      setHasMoreSearch(true);
      if (!searchQuery.trim()) {
        loadRandomFeed(false);
      } else {
        loadSearchFeed(1, false);
      }
    }, 600);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);


  return (
    <div style={{ background: "var(--bg-color)", height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
      
      {/* 🟢 APP HEADER OVERLAY */}
      <div style={{
        position: isDesktop ? "relative" : "absolute",
        top: 0, left: 0, right: 0,
        zIndex: 1000,
        transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease",
        transform: shouldHideUI ? "translateY(-100%)" : "translateY(0)",
        opacity: shouldHideUI ? 0 : 1,
        pointerEvents: shouldHideUI ? "none" : "auto",
        background: "var(--bg-color)"
      }}>
        <AppHeader 
          isDesktop={isDesktop} 
          searchTerm={searchQuery} 
          setSearchTerm={setSearchQuery} 
          user={user} 
          onProfileClick={onProfileClick} 
          onVideoClick={onVideoClick}
        />
      </div>

      {/* 🟢 SCROLLABLE AREA */}
      <div 
        ref={scrollContainerRef}
        style={{
          flex: 1,
          overflowY: "auto",
          // Push down to clear absolute header on mobile
          paddingTop: isDesktop ? "0px" : "70px",
          paddingBottom: shouldHideUI ? "0px" : "70px",
          transition: "padding-bottom 0.3s ease"
        }}
      >
        <PullToRefresh 
          scrollRef={scrollContainerRef}
          onRefresh={async () => {
            setSearchPage(1);
            setHasMoreSearch(true);
            if (searchQuery.trim()) await loadSearchFeed(1, false);
            else await loadRandomFeed(false);
          }}
        >
          <div style={feedWrapper}>
            {/* 🌟 FEATURED CREATORS DISCOVERY BAR */}
            {featuredCreators.length > 0 && !searchQuery.trim() && (
              <div style={featuredCreatorsWrapper}>
                <div style={featuredCreatorsHeader}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Sparkles size={14} color="#00aff0" />
                    <span style={featuredTitleStyle}>Featured Creators</span>
                  </div>
                  <span style={{ fontSize: "11px", color: "#8e8e93" }}>Swipe to explore</span>
                </div>
                <div style={featuredRowStyle}>
                  {featuredCreators.map((creator) => (
                    <div
                      key={creator.username}
                      onClick={() => onCreatorClick && onCreatorClick(creator.username)}
                      style={featuredCardStyle}
                    >
                      <div style={featuredAvatarRing}>
                        <img
                          src={creator.avatar_url || "/assets/default-avatar.png"}
                          alt={creator.display_name || creator.username}
                          onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                          style={featuredAvatarImg}
                        />
                        {creator.is_verified && (
                          <div style={verifiedBadgeIcon}>
                            <CheckCircle size={13} color="#00aff0" fill="#00aff0" />
                          </div>
                        )}
                      </div>
                      <span style={featuredCreatorName}>
                        {creator.display_name || creator.username}
                      </span>
                      <span style={featuredCategoryBadge}>
                        {creator.creator_category || "Creator"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {loading ? (
              [...Array(5)].map((_, i) => (
                <div key={i} style={postStyle}>
                  <div style={avatarColumnStyle}><div style={skeletonAvatar} /></div>
                  <div style={contentColumnStyle}>
                    <div style={skeletonTextBase} />
                    <div style={{ ...skeletonTextBase, width: "80%", marginTop: "6px", marginBottom: "12px" }} />
                    <div style={{ ...skeletonVideo, width: "75%" }} />
                  </div>
                </div>
              ))
            ) : feed.length === 0 ? (
               <div style={{ padding: "40px", textAlign: "center", color: "#888" }}>
                  No videos found. Try a different search.
               </div>
            ) : (
              feed.map((video, idx) => {
                const isLast = feed.length === idx + 1;
                return (
                  <FeedPost 
                    key={`${video.message_id}-${idx}`}
                    video={video}
                    isLast={isLast}
                    lastElementRef={lastElementRef}
                    onVideoClick={onVideoClick}
                    onCommentClick={onCommentClick} 
                    isAnyModalOpen={isAnyModalOpen} 
                    onCreatorClick={onCreatorClick}
                    user={user}
                  />
                );
              })
            )}

            {loadingMore && (
              <div style={{ padding: "20px", display: "flex", justifyContent: "center", color: "var(--primary-color)" }}>
                <Loader2 className="animate-spin" size={24} />
              </div>
            )}
          </div>
        </PullToRefresh>
      </div>

      <style>{`
        @keyframes skeleton-loading { 0% { background-color: #222; } 50% { background-color: #333; } 100% { background-color: #222; } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// 🖌 STYLES 
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

// 🌟 Featured Creators Carousel Styles
const featuredCreatorsWrapper = {
  width: "100%",
  padding: "16px 16px 12px 16px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  marginBottom: "8px",
  boxSizing: "border-box",
  background: "linear-gradient(180deg, rgba(0, 175, 240, 0.03) 0%, transparent 100%)"
};

const featuredCreatorsHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "12px"
};

const featuredTitleStyle = {
  fontSize: "13px",
  fontWeight: "800",
  letterSpacing: "0.5px",
  color: "#fff",
  textTransform: "uppercase"
};

const featuredRowStyle = {
  display: "flex",
  gap: "14px",
  overflowX: "auto",
  paddingBottom: "8px",
  scrollbarWidth: "none",
  msOverflowStyle: "none"
};

const featuredCardStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "6px",
  minWidth: "76px",
  maxWidth: "84px",
  cursor: "pointer",
  flexShrink: 0
};

const featuredAvatarRing = {
  position: "relative",
  width: "58px",
  height: "58px",
  borderRadius: "50%",
  padding: "2px",
  background: "linear-gradient(135deg, #00aff0, #0077b5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const featuredAvatarImg = {
  width: "54px",
  height: "54px",
  borderRadius: "50%",
  objectFit: "cover",
  backgroundColor: "#111",
  border: "2px solid #000"
};

const verifiedBadgeIcon = {
  position: "absolute",
  bottom: "0",
  right: "0",
  background: "#000",
  borderRadius: "50%",
  display: "flex"
};

const featuredCreatorName = {
  fontSize: "12px",
  fontWeight: "700",
  color: "#fff",
  textAlign: "center",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  width: "100%"
};

const featuredCategoryBadge = {
  fontSize: "10px",
  color: "#8e8e93",
  textAlign: "center",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  width: "100%"
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
  background: "linear-gradient(135deg, #FFD700 0%, #FFA500 100%)",
  color: "#000",
  border: "none",
  borderRadius: "100px",
  padding: "10px 18px",
  fontSize: "12.5px",
  fontWeight: "800",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  cursor: "pointer",
  boxShadow: "0 4px 16px rgba(255, 215, 0, 0.3)",
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
  background: "rgba(255, 215, 0, 0.12)",
  border: "1px solid rgba(255, 215, 0, 0.35)",
  color: "#FFD700",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
  transition: "background 0.2s ease"
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