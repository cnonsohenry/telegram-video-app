import React, { useEffect, useRef, useState } from "react";
import { 
  X, ArrowLeft, Play, Pause, Loader2, Maximize, Minimize, 
  Share2, Download, Check, Heart, MessageCircle, Bookmark, 
  Volume2, VolumeX, MoreVertical, Edit2, Trash2, RotateCw,
  UserPlus, SkipForward, ExternalLink, Eye, Flag, Link2
} from "lucide-react";

// 🟢 IMPORT YOUR CENTRAL CONFIG & AD UTILITIES
import { APP_CONFIG } from "../config";
import { getVideoCreatorHandle, isUserFollowingCreator } from "../utils/subscription";
import { shouldPlayVastAd, recordVastAdPlayed, getVastConfig } from "../utils/adManager";
import { fetchVastAd, sendVastBeacons } from "../utils/vastParser";
import { renderClickableCaption } from "./ClickableCaption";
import { promptLogin, showToast } from "../utils/toast";
import { getPostDisplayName } from "../utils/date";
import ReportModal from "./ReportModal";
import useModalHistory from "../hooks/useModalHistory";
import StoryAvatar from "./StoryAvatar";

export default function FullscreenPlayer({ video, currentUser, onClose, isDesktop, onCommentClick, onCreatorClick }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null); 
  const hlsRef = useRef(null);
  
  // VAST Pre-roll States
  const [adState, setAdState] = useState(() => shouldPlayVastAd(currentUser) ? "loading" : "finished");
  const [adData, setAdData] = useState(null);
  const [adCountdown, setAdCountdown] = useState(5);
  const [adCanSkip, setAdCanSkip] = useState(false);
  const [isAdMuted, setIsAdMuted] = useState(false);
  const [adCurrentTime, setAdCurrentTime] = useState(0);
  const [adDuration, setAdDuration] = useState(0);
  const adVideoRef = useRef(null);
  const adTrackedRef = useRef({
    start: false,
    firstQuartile: false,
    midpoint: false,
    thirdQuartile: false,
    complete: false
  });

  // Video States
  const [isPlaying, setIsPlaying] = useState(false); 
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [isRotated, setIsRotated] = useState(false);
  const [showControls, setShowControls] = useState(true); 
  const [isDragging, setIsDragging] = useState(false); 
  const isDraggingRef = useRef(false);
  const progressBarRef = useRef(null);
  const [isMuted, setIsMuted] = useState(false); 
  
  // Action States
  const [copied, setCopied] = useState(false); 
  const [isDownloading, setIsDownloading] = useState(false); 
  const [showMenu, setShowMenu] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [canModify, setCanModify] = useState(false); 
  const lastTapRef = useRef(0);
  const tapTimeoutRef = useRef(null);
  const [showHeartBurst, setShowHeartBurst] = useState(false);

  // Edit States
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [editForm, setEditForm] = useState({ 
    caption: video.caption || "", 
    category: video.category || "hotties" 
  });

  // 🟢 Back Button integration for overlays
  const handleCloseMenu = useModalHistory(showMenu, () => setShowMenu(false), "playerMenu");
  const handleCloseEditMode = useModalHistory(isEditingMode, () => setIsEditingMode(false), "playerEdit");

  const [isLiked, setIsLiked] = useState(false);
  const isPremium = video?.category === "premium" || video?.is_premium === true;

  // 🟢 Anti-Copy / Anti-Save protection for premium content
  useEffect(() => {
    if (!isPremium) return;
    const handleKeyDown = (e) => {
      // Prevent Ctrl+S / Cmd+S (Save), Ctrl+C / Cmd+C (Copy), Ctrl+U / Cmd+U (View Source)
      if ((e.ctrlKey || e.metaKey) && ['s', 'S', 'c', 'C', 'u', 'U'].includes(e.key)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [isPremium]);
  const [likesCount, setLikesCount] = useState(Number(video.likes_count || 0));
  const [isSaved, setIsSaved] = useState(false);
  const [savesCount, setSavesCount] = useState(Number(video.saves_count || 0));
  const [commentsCount, setCommentsCount] = useState(Number(video.comments_count || 0));
  const [sharesCount, setSharesCount] = useState(Number(video.shares_count || 0));

  // 🟢 Update comment counter when a comment is added via CommentSectionModal
  useEffect(() => {
    const handleCommentAdded = (e) => {
      if (e.detail && String(e.detail.message_id) === String(video.message_id)) {
        setCommentsCount(prev => prev + 1);
      }
    };
    window.addEventListener("commentAdded", handleCommentAdded);
    return () => window.removeEventListener("commentAdded", handleCommentAdded);
  }, [video.message_id]);

  // 🟢 Keyboard controls: Space to toggle play, ArrowRight to fast-forward 5s, ArrowLeft to rewind 5s
  useEffect(() => {
    const handlePlayerKeyDown = (e) => {
      if (['INPUT', 'TEXTAREA'].includes(e.target?.tagName) || isEditingMode) return;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (videoRef.current) {
          const maxDur = duration || videoRef.current.duration || 0;
          const next = Math.min((videoRef.current.currentTime || 0) + 5, maxDur);
          videoRef.current.currentTime = next;
          setCurrentTime(next);
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (videoRef.current) {
          const prev = Math.max((videoRef.current.currentTime || 0) - 5, 0);
          videoRef.current.currentTime = prev;
          setCurrentTime(prev);
        }
      } else if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        handleTogglePlay();
      }
    };
    window.addEventListener("keydown", handlePlayerKeyDown);
    return () => window.removeEventListener("keydown", handlePlayerKeyDown);
  }, [duration, isEditingMode, isPlaying]);

  // Creator & Follow States
  const creatorHandle = getVideoCreatorHandle(video);
  const uploaderId = video.uploader_id ? String(video.uploader_id) : null;

  const isOwner = Boolean(currentUser && (
    (currentUser.username && currentUser.username.toLowerCase().replace(/^@/, "").trim() === creatorHandle.toLowerCase()) ||
    (uploaderId && (String(currentUser.id) === uploaderId || (currentUser.telegram_user_id && String(currentUser.telegram_user_id) === uploaderId)))
  ));

  const isUserFollowing = Boolean(
    isUserFollowingCreator(currentUser, video) ||
    (currentUser && Array.isArray(currentUser.follows) && currentUser.follows.some(sub => {
      if (sub.creator_username && sub.creator_username.toLowerCase().replace(/^@/, "").trim() === creatorHandle.toLowerCase()) return true;
      if (uploaderId && (String(sub.creator_id) === uploaderId || (sub.telegram_user_id && String(sub.telegram_user_id) === uploaderId))) return true;
      return false;
    }))
  );

  const [isFollowing, setIsFollowing] = useState(isUserFollowing);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  useEffect(() => {
    setIsFollowing(isUserFollowing);
  }, [isUserFollowing, video.message_id]);

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
      if (data.isFollowing) setIsFollowing(true);
    })
    .catch(err => console.error("Failed to fetch interaction state", err));

    if (currentUser?.role === 'admin' || String(currentUser?.id) === String(video.uploader_id)) {
      setCanModify(true);
    } else {
      setCanModify(false);
    }
  }, [video.message_id, video.uploader_id, currentUser]);

  const handleFollowClick = async (e) => {
    e?.stopPropagation?.();
    const token = localStorage.getItem("token");
    if (!token || !currentUser) {
      promptLogin("follow");
      return;
    }

    setIsFollowLoading(true);
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(creatorHandle)}/follow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to follow creator");
      }

      setIsFollowing(Boolean(data.following));
      showToast(data.following ? `Following @${creatorHandle}` : `Unfollowed @${creatorHandle}`, data.following ? "success" : "error");
      window.dispatchEvent(new CustomEvent("refreshUser"));
    } catch (err) {
      console.error("Follow error:", err);
      showToast(err.message || "Failed to follow creator", "error");
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleCreatorClick = (e, customHandle) => {
    e?.stopPropagation?.();
    if (videoRef.current) {
      videoRef.current.pause();
      setIsPlaying(false);
    }
    const targetHandle = customHandle || creatorHandle;
    if (onCreatorClick) {
      onCreatorClick(targetHandle);
    } else {
      window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: targetHandle }));
    }
  };

  useEffect(() => {
    setIsLoading(true);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setShowMenu(false); 

    let isMounted = true;

    if (shouldPlayVastAd(currentUser)) {
      setAdState("loading");
      setAdData(null);
      adTrackedRef.current = {
        start: false,
        firstQuartile: false,
        midpoint: false,
        thirdQuartile: false,
        complete: false
      };

      const { vastTag, skipSeconds } = getVastConfig();
      fetchVastAd(vastTag)
        .then((parsedAd) => {
          if (!isMounted) return;
          if (parsedAd && parsedAd.mediaUrl) {
            setAdData(parsedAd);
            setAdCountdown(parsedAd.skipOffsetSeconds || skipSeconds || 5);
            setAdCanSkip(false);
            setAdCurrentTime(0);
            setAdDuration(parsedAd.durationSeconds || 30);
            setAdState("playing");
            recordVastAdPlayed();
          } else {
            setAdState("finished");
          }
        })
        .catch((err) => {
          console.warn("[VAST] Pre-roll fetch failed, skipping ad:", err);
          if (isMounted) setAdState("finished");
        });
    } else {
      setAdState("finished");
      setAdData(null);
    }

    return () => {
      isMounted = false;
    };
  }, [video.message_id, currentUser]);

  // Autoplay recovery for Ad Video
  useEffect(() => {
    if (adState === "playing" && adVideoRef.current) {
      const playPromise = adVideoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          if (adVideoRef.current) {
            adVideoRef.current.muted = true;
            setIsAdMuted(true);
            adVideoRef.current.play().catch(() => {});
          }
        });
      }
    }
  }, [adState, adData]);

  // VAST Ad Event Handlers
  const handleAdPlay = () => {
    if (!adTrackedRef.current.start && adData) {
      adTrackedRef.current.start = true;
      sendVastBeacons(adData.impressionUrls);
      sendVastBeacons(adData.trackingEvents.start);
    }
  };

  const handleAdTimeUpdate = () => {
    const el = adVideoRef.current;
    if (!el || !adData) return;

    const cur = el.currentTime;
    const dur = el.duration || adData.durationSeconds || 30;
    setAdCurrentTime(cur);
    setAdDuration(dur);

    const skipOffset = adData.skipOffsetSeconds || 5;
    const remaining = Math.max(0, Math.ceil(skipOffset - cur));
    setAdCountdown(remaining);
    if (remaining === 0 && !adCanSkip) {
      setAdCanSkip(true);
    }

    if (dur > 0) {
      const pct = (cur / dur) * 100;
      if (pct >= 25 && !adTrackedRef.current.firstQuartile) {
        adTrackedRef.current.firstQuartile = true;
        sendVastBeacons(adData.trackingEvents.firstQuartile);
      }
      if (pct >= 50 && !adTrackedRef.current.midpoint) {
        adTrackedRef.current.midpoint = true;
        sendVastBeacons(adData.trackingEvents.midpoint);
      }
      if (pct >= 75 && !adTrackedRef.current.thirdQuartile) {
        adTrackedRef.current.thirdQuartile = true;
        sendVastBeacons(adData.trackingEvents.thirdQuartile);
      }
    }
  };

  const handleAdEnded = () => {
    if (adData && !adTrackedRef.current.complete) {
      adTrackedRef.current.complete = true;
      sendVastBeacons(adData.trackingEvents.complete);
    }
    setAdState("finished");
  };

  const handleAdSkip = (e) => {
    e?.stopPropagation?.();
    if (!adCanSkip) return;
    if (adData) {
      sendVastBeacons(adData.trackingEvents.skip);
    }
    setAdState("finished");
  };

  const handleAdClick = (e) => {
    e?.stopPropagation?.();
    if (!adData || !adData.clickThroughUrl) return;

    sendVastBeacons(adData.clickTrackingUrls);

    const dest = adData.clickThroughUrl;
    if (window.Telegram?.WebApp?.openLink) {
      window.Telegram.WebApp.openLink(dest, { try_instant_view: false });
    } else {
      window.open(dest, "_blank");
    }
  };

  const handleAdError = () => {
    if (adData) {
      sendVastBeacons(adData.errorUrls, { errorCode: 405 });
    }
    setAdState("finished");
  };

  const handleClose = () => {
    if (adVideoRef.current) {
      try { adVideoRef.current.pause(); } catch (_) {}
    }
    if (videoRef.current) {
      try { videoRef.current.pause(); } catch (_) {}
    }
    onClose();
  };

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (!video.video_url) {
      setIsLoading(true);
      return;
    }

    // 🟢 Wait until VAST pre-roll is finished or skipped
    if (adState !== "finished") {
      return;
    }

    const playVideo = () => {
      const playPromise = videoElement.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsLoading(false);
            setIsPlaying(true);
          })
          .catch((err) => {
            console.warn("[Player] Autoplay promise caught:", err);
            setIsLoading(false);
            setIsPlaying(false);
            setShowControls(true);
          });
      }
    };

    if (video.video_url.includes('.m3u8') && window.Hls && window.Hls.isSupported()) {
      const hls = new window.Hls({
        startLevel: -1,
        capLevelToPlayerSize: true,
      });
      hls.loadSource(video.video_url);
      hls.attachMedia(videoElement);
      hlsRef.current = hls;

      hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
        setIsLoading(false);
        playVideo();
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
              setIsLoading(false);
              break;
          }
        }
      });
    } else {
      if (videoElement.src !== video.video_url) {
        videoElement.src = video.video_url;
        try { videoElement.load(); } catch (_) {}
      }
      playVideo();
    }

    // 🟢 Playback Watchdog: Detect and break browser range request / cache socket stalls
    const watchdogTimer = setTimeout(() => {
      if (videoElement && videoElement.readyState < 2 && video.video_url && adState === "finished") {
        console.warn("⚠️ [Watchdog] Video stream stalled in cache/socket lock. Attempting clean reconnect...");
        try {
          const cleanUrl = video.video_url.replace(/([?&])_retry=\d+/g, '');
          const retrySep = cleanUrl.includes('?') ? '&' : '?';
          const freshRetryUrl = `${cleanUrl}${retrySep}_retry=${Date.now()}`;
          videoElement.src = freshRetryUrl;
          videoElement.load();
          videoElement.play().catch(() => {
            setIsLoading(false);
            setShowControls(true);
          });
        } catch (_) {}
      }
    }, 4500);

    return () => {
      clearTimeout(watchdogTimer);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [video.video_url, video.message_id, adState]);

  const handleTimeUpdate = () => {
    if (videoRef.current && !isDraggingRef.current) {
      if (isLoading && videoRef.current.currentTime > 0) {
        setIsLoading(false);
      }
      setCurrentTime(videoRef.current.currentTime);
      if (videoRef.current.duration && Number.isFinite(videoRef.current.duration) && videoRef.current.duration !== duration) {
        setDuration(videoRef.current.duration);
      }
    }
  };

  const handlePointerDown = (e) => {
    e.stopPropagation();
    if (!progressBarRef.current) return;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {}

    isDraggingRef.current = true;
    setIsDragging(true);

    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const total = duration > 0 ? duration : (videoRef.current?.duration || 0);
    const newTime = pos * total;

    if (Number.isFinite(newTime)) {
      setCurrentTime(newTime);
      if (videoRef.current) {
        videoRef.current.currentTime = newTime;
      }
    }
  };

  const handlePointerMove = (e) => {
    if (!isDraggingRef.current || !progressBarRef.current) return;
    e.stopPropagation();

    const rect = progressBarRef.current.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const total = duration > 0 ? duration : (videoRef.current?.duration || 0);
    const newTime = pos * total;

    if (Number.isFinite(newTime)) {
      setCurrentTime(newTime);
      if (videoRef.current) {
        videoRef.current.currentTime = newTime;
      }
    }
  };

  const handlePointerUp = (e) => {
    if (!isDraggingRef.current) return;
    e.stopPropagation();

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch (err) {}

    isDraggingRef.current = false;
    setIsDragging(false);

    if (progressBarRef.current) {
      const rect = progressBarRef.current.getBoundingClientRect();
      const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
      const total = duration > 0 ? duration : (videoRef.current?.duration || 0);
      const newTime = pos * total;
      if (Number.isFinite(newTime) && videoRef.current) {
        videoRef.current.currentTime = newTime;
      }
    }
  };

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const m = Math.floor(timeInSeconds / 60);
    const s = Math.floor(timeInSeconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  useEffect(() => {
    return () => {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
    };
  }, []);

  const handleInteraction = (e) => {
    if (e) e.stopPropagation();
    setShowControls(prev => !prev);
    setShowMenu(false); 
  };

  const handleStageTap = (e) => {
    e.stopPropagation();
    const now = Date.now();
    if (now - lastTapRef.current < 320) {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
      lastTapRef.current = 0;
      if (!isLiked) {
        handleLike(e);
      }
      setShowHeartBurst(true);
      setTimeout(() => setShowHeartBurst(false), 850);
    } else {
      lastTapRef.current = now;
      tapTimeoutRef.current = setTimeout(() => {
        handleInteraction(e);
      }, 260);
    }
  };

  const handleTogglePlay = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play().catch(() => {});
    }
  };

  // 🟢 FULLY RESTORED ENGAGEMENT HANDLERS
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

  const handleSaveToProfile = async (e) => {
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
    if (e) e.stopPropagation();
    setShowMenu(false);
    if (isPremium) return;
    const shareUrl = `${window.location.origin}/v/${video.message_id}`;
    const brandName = `${APP_CONFIG.appNamePrefix} ${APP_CONFIG.appNameSuffix}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: brandName,
          text: video.caption || `Watch this video on ${brandName}`,
          url: shareUrl,
        });
      } catch (err) {}
    } else {
      navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
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
    }
  };

  const handleDownload = async (e) => {
    if (e) e.stopPropagation();
    setShowMenu(false);
    if (isPremium || isDownloading) return;
    
    setIsDownloading(true);
    try {
      const cacheBusterUrl = video.video_url + (video.video_url.includes('?') ? '&' : '?') + 'dl=' + Date.now();
      const response = await fetch(cacheBusterUrl, { mode: 'cors' });
      if (!response.ok) throw new Error("Network response was not ok");
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `${APP_CONFIG.appNamePrefix.toLowerCase()}-${video.message_id}.mp4`;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
      showToast("Download started", "success");
    } catch (err) {
      showToast("Download failed. Please try again.", "error");
    } finally {
      setIsDownloading(false);
    }
  };

  // ADMIN / UPLOADER HANDLERS
  const handleEditCaption = (e) => {
    e?.stopPropagation();
    handleCloseMenu();
    setIsEditingMode(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      const identifier = video.id || video.message_id; 
      
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/video/${identifier}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm)
      });

      if (res.ok) {
        video.caption = editForm.caption;
        video.category = editForm.category;
        handleCloseEditMode();
        showToast("Video details updated!", "success");
      } else {
        showToast("Failed to save changes. Make sure you have the right permissions.", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("Error updating video.", "error");
    }
  };

  const handleDeleteVideo = async (e) => {
    e?.stopPropagation();
    handleCloseMenu();
    
    if(window.confirm("Are you sure you want to delete this video? This cannot be undone.")) {
      try {
        const token = localStorage.getItem("token");
        const identifier = video.id || video.message_id;
        
        const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/video/${identifier}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (res.ok) {
          onClose(); 
          window.dispatchEvent(new CustomEvent('videoDeleted', { detail: identifier }));
          showToast("Video deleted successfully", "info");
        } else {
          showToast("Failed to delete video. Make sure you have the right permissions.", "error");
        }
      } catch (err) {
        console.error(err);
        showToast("Error deleting video.", "error");
      }
    }
  };

  useEffect(() => {
    const originalStyle = { overflow: document.body.style.overflow, position: document.body.style.position, top: document.body.style.top, width: document.body.style.width };
    const scrollY = window.scrollY;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    // 🟢 Pause any background feed videos to release HTTP range-request socket locks
    try {
      document.querySelectorAll('video').forEach(el => {
        if (el !== videoRef.current && el !== adVideoRef.current) {
          el.pause();
        }
      });
    } catch (_) {}

    return () => {
      document.body.style.overflow = originalStyle.overflow;
      document.body.style.position = originalStyle.position;
      document.body.style.top = originalStyle.top;
      document.body.style.width = originalStyle.width;
      window.scrollTo(0, scrollY);
    };
  }, []);

  if (!video) return null;
  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  const fallbackCategories = ['hotties', 'knacks', 'baddies', 'trends', 'shots', 'premium'];

  return (
    <div 
      ref={containerRef} 
      style={overlayStyle} 
      onClick={onClose}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      <div style={{ ...topGradientStyle, opacity: showControls ? 1 : 0, pointerEvents: "none" }} />

      {/* Header Buttons */}
      {!isDesktop ? (
        <button 
          onClick={(e) => { e.stopPropagation(); handleClose(); }} 
          style={{ 
            ...mobileBackButtonStyle, 
            opacity: (showControls || adState === "playing") ? 1 : 0, 
            pointerEvents: (showControls || adState === "playing") ? "auto" : "none", 
            zIndex: 10010 
          }}
          aria-label="Back"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
        >
          <ArrowLeft size={28} />
        </button>
      ) : (
        <button 
          onClick={(e) => { e.stopPropagation(); handleClose(); }} 
          style={{ 
            ...desktopCloseButtonStyle, 
            opacity: (showControls || adState === "playing") ? 1 : 0, 
            pointerEvents: (showControls || adState === "playing") ? "auto" : "none", 
            zIndex: 10010 
          }}
          aria-label="Close"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
        >
          <X size={24} />
        </button>
      )}

      {/* 3-Dot Menu Button - only visible on main video */}
      {adState === "finished" && (
        <button 
          onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} 
          style={{ 
            ...menuButtonStyle, 
            right: isDesktop ? "90px" : "20px",
            opacity: showControls ? 1 : 0, 
            pointerEvents: showControls ? "auto" : "none", 
            zIndex: 10006 
          }}
          aria-label="More Options"
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)"}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
        >
          <MoreVertical size={24} />
        </button>
      )}

      {/* 🌟 FULLSCREEN PLAYER ACTION SHEET (Slides up from the bottom like X) */}
      {showMenu && (
        <div 
          style={playerMenuOverlay} 
          onClick={(e) => { e.stopPropagation(); handleCloseMenu(); }}
        >
          <div style={playerMenuSheet} onClick={(e) => e.stopPropagation()}>
            <div style={dragHandleWrapper}>
              <div style={dragHandlePill} />
            </div>

            <div style={playerMenuList}>
              {canModify && (
                <>
                  <button 
                    style={playerMenuItem} 
                    onClick={handleEditCaption}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <Edit2 size={20} color="#e7e9ea" /> 
                    <span>Edit Caption</span>
                  </button>
                  <button 
                    style={{ ...playerMenuItem, color: '#f4212e' }} 
                    onClick={handleDeleteVideo}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(244, 33, 46, 0.1)"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    <Trash2 size={20} color="#f4212e" /> 
                    <span>Delete Video</span>
                  </button>
                </>
              )}
              
              {!isPremium && (
                <>
                  <button 
                    style={playerMenuItem} 
                    onClick={handleShare}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    {copied ? <Check size={20} color="#4ade80" /> : <Share2 size={20} color="#e7e9ea" />} 
                    <span>{copied ? "Copied Link!" : "Share / Copy Link"}</span>
                  </button>
                  <button 
                    style={playerMenuItem} 
                    onClick={handleDownload}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)"}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                  >
                    {isDownloading ? <Loader2 size={20} className="spin-animation" color="#e7e9ea" /> : <Download size={20} color="#e7e9ea" />} 
                    <span>Download Video</span>
                  </button>
                </>
              )}

              {/* Report Video Option */}
              <button 
                style={{ ...playerMenuItem, color: '#f4212e' }} 
                onClick={(e) => {
                  e.stopPropagation();
                  const currentState = window.history.state || {};
                  const newState = { ...currentState };
                  delete newState.playerMenu;
                  newState.reportModal = true;
                  window.history.replaceState(newState, document.title);
                  setShowMenu(false);
                  setShowReport(true);
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(244, 33, 46, 0.1)"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
              >
                <Flag size={20} color="#f4212e" />
                <span>Report Video</span>
              </button>
            </div>

            <div style={{ paddingTop: "6px" }}>
              <button 
                type="button" 
                style={playerCancelBtn} 
                onClick={(e) => { e.stopPropagation(); handleCloseMenu(); }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.14)"}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)"}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🚩 REPORT MODAL */}
      {showReport && (
        <ReportModal 
          isOpen={showReport}
          video={video}
          onClose={() => setShowReport(false)}
        />
      )}

      <div style={stageStyle} onClick={(e) => e.stopPropagation()}>
        <div onClick={adState === "finished" ? handleStageTap : undefined} style={videoWrapperStyle}>
          {/* Double Tap Heart Burst Animation */}
          {showHeartBurst && (
            <div style={centerHeartBurstStyle}>
              <Heart size={88} fill="#f91880" color="#f91880" className="heart-burst-anim" />
            </div>
          )}

          {((isLoading && !isDragging && adState === "finished") || adState === "loading") && (
            <div style={loaderContainerStyle}>
              <Loader2 size={48} color="var(--primary-color)" className="spin-animation" />
            </div>
          )}

          {/* 🟢 VAST Pre-roll Ad Layer */}
          {adState === "playing" && adData && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                zIndex: 10005,
                backgroundColor: "#000",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden"
              }}
              onClick={handleAdClick}
            >
              <video
                ref={adVideoRef}
                src={adData.mediaUrl}
                crossOrigin="anonymous"
                autoPlay
                playsInline
                muted={isAdMuted}
                onPlay={handleAdPlay}
                onTimeUpdate={handleAdTimeUpdate}
                onEnded={handleAdEnded}
                onError={handleAdError}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "contain",
                  cursor: "pointer"
                }}
              />

              {/* Top-Left: "AD · SPONSORED" Badge */}
              <div
                style={{
                  position: "absolute",
                  top: !isDesktop ? "max(24px, env(safe-area-inset-top))" : "32px",
                  left: !isDesktop ? "76px" : "30px",
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  backgroundColor: "rgba(0,0,0,0.7)",
                  backdropFilter: "blur(10px)",
                  border: "1px solid rgba(255,255,255,0.18)",
                  borderRadius: "20px",
                  padding: "6px 14px",
                  color: "#fff",
                  fontSize: "12px",
                  fontWeight: "700",
                  letterSpacing: "0.5px",
                  pointerEvents: "none",
                  zIndex: 10007
                }}
              >
                <span
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: "#f59e0b",
                    boxShadow: "0 0 8px #f59e0b"
                  }}
                />
                AD · SPONSORED
              </div>

              {/* Top-Right: Countdown / Skip Ad Button */}
              <div
                style={{
                  position: "absolute",
                  top: !isDesktop ? "max(24px, env(safe-area-inset-top))" : "32px",
                  right: isDesktop ? "90px" : "20px",
                  zIndex: 10008
                }}
              >
                {adCanSkip ? (
                  <button
                    onClick={handleAdSkip}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      backgroundColor: "#ffffff",
                      color: "#000000",
                      border: "none",
                      borderRadius: "24px",
                      padding: "8px 18px",
                      fontSize: "13px",
                      fontWeight: "800",
                      cursor: "pointer",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
                      transition: "transform 0.15s ease"
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                    onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                  >
                    <span>Skip Ad</span>
                    <SkipForward size={16} fill="#000" />
                  </button>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      backgroundColor: "rgba(0,0,0,0.7)",
                      backdropFilter: "blur(10px)",
                      border: "1px solid rgba(255,255,255,0.18)",
                      borderRadius: "20px",
                      padding: "7px 16px",
                      color: "#e2e8f0",
                      fontSize: "13px",
                      fontWeight: "600"
                    }}
                  >
                    Skip in {adCountdown}s
                  </div>
                )}
              </div>

              {/* Bottom Row inside Ad: CTA Visit Sponsor & Mute Toggle */}
              <div
                style={{
                  position: "absolute",
                  bottom: "20px",
                  left: "20px",
                  right: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  zIndex: 10008,
                  pointerEvents: "auto"
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {adData.clickThroughUrl ? (
                  <button
                    onClick={handleAdClick}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      backgroundColor: "var(--primary-color, #e11d48)",
                      color: "#fff",
                      border: "none",
                      borderRadius: "24px",
                      padding: "10px 20px",
                      fontSize: "13px",
                      fontWeight: "700",
                      cursor: "pointer",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.4)"
                    }}
                  >
                    <span>Visit Sponsor</span>
                    <ExternalLink size={15} />
                  </button>
                ) : (
                  <div />
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const next = !isAdMuted;
                    setIsAdMuted(next);
                    if (adVideoRef.current) {
                      adVideoRef.current.muted = next;
                    }
                  }}
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(0,0,0,0.7)",
                    backdropFilter: "blur(8px)",
                    border: "1px solid rgba(255,255,255,0.2)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer"
                  }}
                  title={isAdMuted ? "Unmute Ad" : "Mute Ad"}
                >
                  {isAdMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
                </button>
              </div>

              {/* Ad Progress Bar */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: "3px",
                  backgroundColor: "rgba(255,255,255,0.2)"
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${adDuration > 0 ? (adCurrentTime / adDuration) * 100 : 0}%`,
                    backgroundColor: "#f59e0b",
                    transition: "width 0.2s linear"
                  }}
                />
              </div>
            </div>
          )}

          {/* Main Video */}
          <video
            ref={videoRef}
            crossOrigin="anonymous"
            muted={isMuted}
            playsInline loop
            controlsList="nodownload noplaybackrate noremoteplayback"
            disablePictureInPicture
            disableRemotePlayback
            onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
            onDragStart={(e) => e.preventDefault()}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={() => {
              if (videoRef.current && Number.isFinite(videoRef.current.duration)) {
                setDuration(videoRef.current.duration);
              }
            }}
            onWaiting={() => setIsLoading(true)}
            onLoadedData={() => setIsLoading(false)}
            onCanPlay={() => setIsLoading(false)}
            onCanPlayThrough={() => setIsLoading(false)}
            onPlaying={() => {
              setIsLoading(false);
              setIsPlaying(true);
            }}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onError={(e) => {
              console.warn("[Player] Video error event:", e);
              setIsLoading(false);
            }}
            style={{ 
                width: "100%", height: "100%", 
                objectFit: isZoomed ? "cover" : "contain",
                // 🟢 NEW: Transition and Transform for flipping
                transition: "all 0.3s ease",
                transform: isRotated ? "rotate(90deg)" : "none",
                display: adState === "playing" ? "none" : "block",
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none"
            }}
          />

          {adState === "finished" && (
            <>
              <div style={{ ...bottomGradientStyle, opacity: showControls ? 1 : 0 }} />

              <div 
                style={{ ...bottomUIWrapper, opacity: showControls ? 1 : 0, pointerEvents: showControls ? "auto" : "none" }}
                onClick={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                
                {/* Top Row: Floating Controls (Transparent) */}
                <div style={floatingControlsRow}>
                    {/* Rotate Button */}
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsRotated(!isRotated); }} 
                      style={floatingBtnStyle} 
                      title="Rotate video"
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <RotateCw size={19} />
                    </button>

                    {/* Direct Download Button (Hidden for premium videos) */}
                    {!isPremium && (
                      <button 
                        onClick={handleDownload} 
                        style={floatingBtnStyle} 
                        title="Download video"
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                      >
                        {isDownloading ? <Loader2 size={19} className="spin-animation" /> : <Download size={19} />}
                      </button>
                    )}

                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} 
                      style={floatingBtnStyle} 
                      title={isMuted ? "Unmute" : "Mute"}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      {isMuted ? <VolumeX size={19} /> : <Volume2 size={19} />}
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); setIsZoomed(!isZoomed); }} 
                      style={floatingBtnStyle} 
                      title={isZoomed ? "Fit to screen" : "Zoom to fill"}
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.15)"}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      {isZoomed ? <Minimize size={19} /> : <Maximize size={19} />}
                    </button>
                </div>

                {/* Middle Row: Avatar, Name, Follow button (transparent, bigger, free, next to username!), and Caption */}
                <div style={postInfoStyle}>
                    <StoryAvatar
                      username={creatorHandle}
                      avatarUrl={`${APP_CONFIG.apiUrl}/api/avatar?user_id=${video.uploader_id}`}
                      displayName={getPostDisplayName(video)}
                      size={42}
                      borderWidth={2}
                      onClick={handleCreatorClick}
                    />
                   <div style={textDetailsStyle}>
                      <div style={usernameRowStyle}>
                        <div 
                          style={{ ...usernameStyle, cursor: onCreatorClick ? "pointer" : "default" }}
                          onClick={handleCreatorClick}
                        >
                          {getPostDisplayName(video)}
                        </div>

                        {!isOwner && (
                          <button
                            onClick={handleFollowClick}
                            disabled={isFollowLoading}
                            style={isFollowing ? followingBtnStyle : followBtnStyle}
                            title={isFollowing ? `Unfollow @${creatorHandle}` : `Follow @${creatorHandle}`}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = isFollowing ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.2)";
                              e.currentTarget.style.transform = "scale(1.05)";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                              e.currentTarget.style.transform = "scale(1)";
                            }}
                          >
                            <span>{isFollowLoading ? "..." : isFollowing ? "Following" : "+ Follow"}</span>
                          </button>
                        )}
                      </div>
                      <div style={captionStyle}>
                        {renderClickableCaption(video.caption || APP_CONFIG.defaultCaption, (handle) => handleCreatorClick(null, handle))}
                      </div>
                   </div>
                </div>

                {/* Bottom Row: Play/Pause firmly docked next to Progress Bar in single sleek row */}
                <div 
                  style={controlBarContainer}
                  onClick={(e) => e.stopPropagation()}
                  onTouchStart={(e) => e.stopPropagation()}
                  onPointerDown={(e) => e.stopPropagation()}
                >
                   <button 
                     onClick={handleTogglePlay} 
                     style={playPauseBtnStyle}
                     aria-label={isPlaying ? "Pause video" : "Play video"}
                     onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.12)"}
                     onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                   >
                     {isPlaying ? (
                       <Pause size={22} fill="#ffffff" color="#ffffff" />
                     ) : (
                       <Play size={22} fill="#ffffff" color="#ffffff" style={{ marginLeft: "2px" }} />
                     )}
                   </button>

                   <div 
                     ref={progressBarRef}
                     style={progressContainerStyle}
                     onPointerDown={handlePointerDown}
                     onPointerMove={handlePointerMove}
                     onPointerUp={handlePointerUp}
                     onPointerCancel={handlePointerUp}
                     onClick={(e) => e.stopPropagation()}
                     role="slider"
                     tabIndex={0}
                     aria-label="Video progress slider"
                     aria-valuemin={0}
                     aria-valuemax={duration || 100}
                     aria-valuenow={currentTime || 0}
                   >
                     {/* Visual Background Track (4px sleek bar) */}
                     <div style={visualTrackStyle}>
                       {/* Played Progress Fill */}
                       <div style={{ ...progressFillStyle, width: `${progressPercent}%` }} />
                     </div>

                     {/* Interactive Scrubbing Thumb */}
                     <div 
                       style={{
                         ...scrubberThumbStyle,
                         left: `${progressPercent}%`,
                         transform: `translate(-50%, -50%) scale(${isDragging ? 1.35 : 1})`
                       }} 
                     />
                   </div>

                   <div style={timeDisplayStyle}>
                     <span>{formatTime(currentTime)}</span>
                     <span style={{ opacity: 0.5, margin: "0 3px" }}>/</span>
                     <span>{formatTime(duration)}</span>
                   </div>
                </div>

                {/* 🟢 RESTORED: Action Bar (Views, Like, Comment, Save, Share) */}
                <div style={engagementBarStyle}>
                   <div style={{ ...engagementBtnStyle, cursor: "default" }}>
                      <Eye size={20} color="#fff" />
                      <span>{Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(Number(video.views || 0))}</span>
                   </div>
                   <button 
                     style={engagementBtnStyle} 
                     onClick={handleLike}
                     onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.08)"}
                     onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                   >
                      <Heart size={21} fill={isLiked ? "#f91880" : "none"} color={isLiked ? "#f91880" : "#fff"} />
                      <span>{likesCount > 0 ? likesCount : 'Like'}</span>
                   </button>
                   <button 
                     style={engagementBtnStyle} 
                     onClick={handleCommentClick}
                     onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.08)"}
                     onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                   >
                      <MessageCircle size={21} color="#fff" />
                      <span>{commentsCount > 0 ? commentsCount : 'Reply'}</span>
                   </button>
                   <button 
                     style={engagementBtnStyle} 
                     onClick={handleSaveToProfile}
                     onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.08)"}
                     onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                   >
                      <Bookmark size={21} fill={isSaved ? "var(--primary-color)" : "none"} color={isSaved ? "var(--primary-color)" : "#fff"} />
                      <span>{savesCount > 0 ? savesCount : 'Save'}</span>
                   </button>
                    {!isPremium && (
                      <button 
                        style={engagementBtnStyle} 
                        onClick={handleShare}
                        onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.08)"}
                        onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
                      >
                         {copied ? <Check size={21} color="#4ade80" /> : <Share2 size={21} color="#fff" />}
                         <span>{sharesCount > 0 ? sharesCount : 'Share'}</span>
                      </button>
                    )}
                </div>

              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit Video Modal */}
      {isEditingMode && (
        <div style={editFullscreenStyle} onClick={(e) => e.stopPropagation()}>
          <div style={editTopNavStyle}>
            <button 
              type="button" 
              onClick={handleCloseEditMode}
              style={editNavBackBtnStyle}
              aria-label="Back"
            >
              <ArrowLeft size={24} color="#fff" />
            </button>
            <span style={editTopNavTitleStyle}>Edit Info</span>
            <button 
              type="button" 
              onClick={handleSaveEdit}
              style={editTopNavDoneBtnStyle}
            >
              Done
            </button>
          </div>

          <div style={editScrollAreaStyle}>
            <form onSubmit={handleSaveEdit} style={editFormInnerStyle}>
              <div style={inputGroupStyle}>
                <label style={formLabelStyle}>Caption</label>
                <input 
                  type="text" 
                  value={editForm.caption} 
                  onChange={e => setEditForm({...editForm, caption: e.target.value})} 
                  style={formInputStyle} 
                />
              </div>
              <div style={inputGroupStyle}>
                <label style={formLabelStyle}>Category</label>
                <select 
                  value={editForm.category} 
                  onChange={e => setEditForm({...editForm, category: e.target.value})} 
                  style={formInputStyle}
                >
                  {(APP_CONFIG.categories || fallbackCategories).map((cat) => (
                    <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                  ))}
                </select>
              </div>
              <button type="submit" style={saveBtnStyle}>Save Changes</button>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .spin-animation { animation: spin 1s linear infinite; }


        /* Heart burst animation for double-tap */
        @keyframes heartBurst {
          0% {
            transform: scale(0.2);
            opacity: 0;
          }
          40% {
            transform: scale(1.25);
            opacity: 1;
          }
          70% {
            transform: scale(1.05);
            opacity: 0.9;
          }
          100% {
            transform: scale(1.4);
            opacity: 0;
          }
        }
        .heart-burst-anim {
          animation: heartBurst 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          filter: drop-shadow(0 4px 16px rgba(249, 24, 128, 0.6));
        }

        @keyframes playerSheetSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// 🖌 UI STYLES
const overlayStyle = { position: "fixed", inset: 0, height: "100dvh", backgroundColor: "#000", zIndex: 999999, display: "flex", flexDirection: "column", overflow: "hidden", touchAction: "none" };
const stageStyle = { display: "flex", width: "100%", height: "100%", background: "#000", position: "relative" };
const videoWrapperStyle = { flex: 1, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer", WebkitTapHighlightColor: "transparent" };
const loaderContainerStyle = { position: "absolute", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" };

const centerHeartBurstStyle = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  zIndex: 10010,
  pointerEvents: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const topGradientStyle = { position: "absolute", top: 0, left: 0, right: 0, height: "130px", background: "linear-gradient(to bottom, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.25) 60%, rgba(0,0,0,0) 100%)", zIndex: 10005, transition: "opacity 0.3s ease" };
const bottomGradientStyle = { position: "absolute", bottom: 0, left: 0, right: 0, height: "320px", background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0) 100%)", zIndex: 10001, transition: "opacity 0.3s ease", pointerEvents: "none" };

const mobileBackButtonStyle = { position: "absolute", top: "max(20px, env(safe-area-inset-top))", left: "20px", background: "transparent", color: "#fff", border: "none", borderRadius: "50%", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.7))", cursor: "pointer", transition: "all 0.2s ease" };
const desktopCloseButtonStyle = { position: "absolute", top: "30px", right: "30px", background: "transparent", color: "#fff", border: "none", borderRadius: "50%", width: "48px", height: "48px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.7))", transition: "all 0.2s ease" };

const menuButtonStyle = { position: "absolute", top: "max(20px, env(safe-area-inset-top))", background: "transparent", color: "#fff", border: "none", borderRadius: "50%", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.7))", transition: "all 0.2s ease", cursor: "pointer" };
const dropdownMenuStyle = { position: "absolute", top: "max(75px, calc(env(safe-area-inset-top) + 75px))", background: "rgba(25, 25, 25, 0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "6px", display: "flex", flexDirection: "column", gap: "2px", minWidth: "170px", backdropFilter: "blur(15px)", boxShadow: "0 10px 40px rgba(0,0,0,0.8)" };
const dropdownItemStyle = { background: "transparent", border: "none", color: "#fff", padding: "12px 14px", display: "flex", alignItems: "center", gap: "12px", fontSize: "14px", fontWeight: "500", cursor: "pointer", borderRadius: "8px", width: "100%", textAlign: "left", transition: "background 0.2s" };
const dropdownDividerStyle = { height: "1px", background: "rgba(255,255,255,0.08)", margin: "4px 0" };

const bottomUIWrapper = { position: "absolute", bottom: "max(15px, env(safe-area-inset-bottom))", left: 0, right: 0, padding: "0 15px", zIndex: 10002, display: "flex", flexDirection: "column", transition: "opacity 0.2s ease" };
const floatingControlsRow = { display: "flex", justifyContent: "flex-end", gap: "12px", marginBottom: "8px" };
const floatingBtnStyle = { background: "transparent", border: "none", color: "#fff", width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.7))", cursor: "pointer", transition: "all 0.2s ease" };

const postInfoStyle = { display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "12px", width: "100%" };
const avatarStyle = { width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover", border: "1.5px solid rgba(255,255,255,0.3)", flexShrink: 0 };
const textDetailsStyle = { display: "flex", flexDirection: "column", gap: "4px", overflow: "hidden", flex: 1, minWidth: 0 };
const usernameRowStyle = { display: "flex", alignItems: "center", justifyContent: "flex-start", width: "auto", gap: "10px" };
const usernameStyle = { fontSize: "15px", fontWeight: "700", color: "#fff", textShadow: "0px 1px 3px rgba(0,0,0,0.8)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" };
const followBtnStyle = {
  background: "transparent",
  color: "#ffffff",
  border: "1.5px solid rgba(255, 255, 255, 0.75)",
  borderRadius: "9999px",
  padding: "5px 16px",
  fontSize: "13.5px",
  fontWeight: "700",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.6))",
  transition: "all 0.2s ease"
};
const followingBtnStyle = {
  background: "transparent",
  color: "rgba(255, 255, 255, 0.85)",
  border: "1px solid rgba(255, 255, 255, 0.35)",
  borderRadius: "9999px",
  padding: "5px 14px",
  fontSize: "13px",
  fontWeight: "600",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  transition: "all 0.2s ease"
};
const captionStyle = { fontSize: "14px", color: "#e7e9ea", lineHeight: "1.4", wordWrap: "break-word", textShadow: "0px 1px 3px rgba(0,0,0,0.8)" };

const controlBarContainer = { display: "flex", alignItems: "center", gap: "12px", width: "100%", marginBottom: "14px", padding: "0 4px" };
const playPauseBtnStyle = { background: "transparent", border: "none", cursor: "pointer", padding: "4px", width: "36px", height: "36px", minWidth: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.7))", transition: "transform 0.15s ease" };
const progressContainerStyle = {
  position: "relative",
  display: "flex",
  alignItems: "center",
  flex: 1,
  height: "36px",
  cursor: "pointer",
  touchAction: "none",
  userSelect: "none",
  WebkitUserSelect: "none"
};
const visualTrackStyle = {
  position: "absolute",
  left: 0,
  right: 0,
  height: "4px",
  borderRadius: "9999px",
  backgroundColor: "rgba(255, 255, 255, 0.28)",
  pointerEvents: "none",
  overflow: "hidden"
};
const progressFillStyle = {
  height: "100%",
  backgroundColor: "#ffffff",
  borderRadius: "9999px",
  pointerEvents: "none"
};
const scrubberThumbStyle = {
  position: "absolute",
  top: "50%",
  width: "14px",
  height: "14px",
  borderRadius: "50%",
  backgroundColor: "#ffffff",
  boxShadow: "0 1px 6px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(0, 0, 0, 0.2)",
  pointerEvents: "none",
  transition: "transform 0.15s ease",
  cursor: "grab"
};
const timeDisplayStyle = { display: "flex", alignItems: "center", fontSize: "12px", fontWeight: "600", fontVariantNumeric: "tabular-nums", color: "#ffffff", whiteSpace: "nowrap", textShadow: "0px 1px 3px rgba(0,0,0,0.8)", flexShrink: 0 };

// 🟢 RESTORED: Engagement Bar Styles
const engagementBarStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 10px 4px 10px", borderTop: "1px solid rgba(255,255,255,0.12)" };
const engagementBtnStyle = { background: "transparent", border: "none", display: "flex", alignItems: "center", gap: "6px", color: "#f3f4f6", fontSize: "13px", fontWeight: "600", cursor: "pointer", filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.8))", transition: "transform 0.15s ease", padding: "4px" };

const editFullscreenStyle = {
  position: "fixed",
  inset: 0,
  background: "#000000",
  display: "flex",
  flexDirection: "column",
  zIndex: 9999999,
  animation: "fadeIn 0.2s ease-out"
};

const editTopNavStyle = {
  height: "50px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 16px",
  borderBottom: "1px solid #1a1a1a",
  backgroundColor: "#000000",
  flexShrink: 0
};

const editNavBackBtnStyle = {
  background: "none",
  border: "none",
  color: "#fff",
  cursor: "pointer",
  padding: "6px",
  display: "flex",
  alignItems: "center"
};

const editTopNavTitleStyle = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#fff",
  letterSpacing: "0.2px"
};

const editTopNavDoneBtnStyle = {
  background: "none",
  border: "none",
  color: "var(--primary-color, #0095f6)",
  fontSize: "15px",
  fontWeight: "700",
  cursor: "pointer",
  padding: "6px"
};

const editScrollAreaStyle = {
  flex: 1,
  overflowY: "auto",
  padding: "24px 16px"
};

const editFormInnerStyle = {
  width: "100%",
  maxWidth: "500px",
  margin: "0 auto",
  display: "flex",
  flexDirection: "column",
  gap: "16px"
};
const inputGroupStyle = { display: "flex", flexDirection: "column", gap: "6px", marginBottom: "15px" };
const formLabelStyle = { fontSize: "13px", color: "#8e8e93", fontWeight: "600" };
const formInputStyle = { background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", padding: "12px", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none" };
const saveBtnStyle = { width: "100%", background: "var(--primary-color)", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: "700", fontSize: "15px", cursor: "pointer", marginTop: "10px" };

const playerMenuOverlay = {
  position: "fixed",
  inset: 0,
  zIndex: 100020,
  backgroundColor: "rgba(0, 0, 0, 0.72)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  alignItems: "center"
};

const playerMenuSheet = {
  width: "100%",
  maxWidth: "460px",
  backgroundColor: "#000000",
  borderTop: "1px solid #2f3336",
  borderLeft: "1px solid #2f3336",
  borderRight: "1px solid #2f3336",
  borderRadius: "24px 24px 0 0",
  padding: "10px 16px max(24px, env(safe-area-inset-bottom, 24px))",
  boxSizing: "border-box",
  boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.8)",
  display: "flex",
  flexDirection: "column",
  animation: "playerSheetSlideUp 0.28s cubic-bezier(0.16, 1, 0.3, 1)"
};

const dragHandleWrapper = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  paddingTop: "2px",
  paddingBottom: "10px",
  cursor: "grab"
};

const dragHandlePill = {
  width: "36px",
  height: "4px",
  borderRadius: "2px",
  backgroundColor: "#3e4144"
};

const playerMenuList = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  marginBottom: "12px"
};

const playerMenuItem = {
  background: "none",
  border: "none",
  cursor: "pointer",
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "14px",
  padding: "13px 12px",
  borderRadius: "12px",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "600",
  textAlign: "left",
  transition: "background-color 0.15s ease"
};

const playerCancelBtn = {
  width: "100%",
  padding: "14px",
  borderRadius: "9999px",
  backgroundColor: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "700",
  cursor: "pointer",
  transition: "background-color 0.15s ease"
};