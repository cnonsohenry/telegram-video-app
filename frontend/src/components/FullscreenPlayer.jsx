import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, ArrowLeft, Play, Pause, Loader2, Maximize, Minimize, Share2, Download, Check, Heart, MessageCircle, Bookmark } from "lucide-react";

// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../config";

export default function FullscreenPlayer({ video, onClose, isDesktop, onCommentClick }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null); 
  const lastTap = useRef(0);
  const hideTimeout = useRef(null); 
  
  // Video States
  const [isPlaying, setIsPlaying] = useState(false); 
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showControls, setShowControls] = useState(true); 
  
  // Action States
  const [copied, setCopied] = useState(false); 
  const [isDownloading, setIsDownloading] = useState(false); 

  // Engagement States (Pulled from your FeedPost logic)
  const [likesCount, setLikesCount] = useState(Number(video.likes_count || 0));
  const [isLiked, setIsLiked] = useState(false);
  const [savesCount, setSavesCount] = useState(Number(video.saves_count || 0));
  const [isSaved, setIsSaved] = useState(false);
  const [sharesCount, setSharesCount] = useState(Number(video.shares_count || 0));
  const [commentsCount, setCommentsCount] = useState(Number(video.comments_count || 0));

  // 🟢 FETCH INTERACTION STATE ON LOAD
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

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimeout.current) clearTimeout(hideTimeout.current);
    
    hideTimeout.current = setTimeout(() => {
      setIsPlaying(playing => {
        if (playing) setShowControls(false); 
        return playing;
      });
    }, 4000); // Extended slightly so users can read captions
  }, []);

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
      setDuration(videoRef.current.duration || 0);
    }
  };

  const formatTime = (timeInSeconds) => {
    if (isNaN(timeInSeconds)) return "0:00";
    const m = Math.floor(timeInSeconds / 60);
    const s = Math.floor(timeInSeconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleInteraction = (e) => {
    if (e) e.stopPropagation();
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      setIsZoomed(z => !z);
      lastTap.current = 0; 
      resetHideTimer();
    } else {
      lastTap.current = now;
      setTimeout(() => {
        if (lastTap.current === now && videoRef.current) {
          setShowControls(prev => !prev);
          resetHideTimer();
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

  const handleTogglePlay = (e) => {
    e.stopPropagation();
    resetHideTimer();
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play().catch(() => {});
    }
  };

  // 🟢 ENGAGEMENT HANDLERS
  const handleLike = async (e) => {
    e.stopPropagation();
    resetHideTimer();
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

  const handleSaveToProfile = async (e) => {
    e.stopPropagation();
    resetHideTimer();
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
    resetHideTimer();
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
    resetHideTimer();
    const token = localStorage.getItem("token");
    if (!token) return alert("Please log in to comment!");
    
    if (onCommentClick) {
        setCommentsCount(prev => prev + 1); 
        onCommentClick(video);
    }
  };

  // 🟢 CACHE-BUSTING DOWNLOAD HANDLER
  const handleDownload = async (e) => {
    e.stopPropagation();
    resetHideTimer();
    if (isDownloading) return;
    
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
    } catch (err) {
      alert("Download failed. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    const originalStyle = { overflow: document.body.style.overflow, position: document.body.style.position, top: document.body.style.top, width: document.body.style.width };
    const scrollY = window.scrollY;

    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    resetHideTimer();
    if (videoRef.current) {
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) playPromise.catch(() => { setIsPlaying(false); setShowControls(true); });
    }

    return () => {
      document.body.style.overflow = originalStyle.overflow;
      document.body.style.position = originalStyle.position;
      document.body.style.top = originalStyle.top;
      document.body.style.width = originalStyle.width;
      window.scrollTo(0, scrollY);
      if (hideTimeout.current) clearTimeout(hideTimeout.current);
    };
  }, [resetHideTimer]);

  if (!video) return null;

  return (
    <div ref={containerRef} style={overlayStyle} onClick={onClose}>
      <div style={{ ...topGradientStyle, opacity: showControls ? 1 : 0, pointerEvents: "none" }} />

      {/* Close Button */}
      {!isDesktop ? (
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ ...mobileBackButtonStyle, zIndex: 10006 }}>
          <ArrowLeft size={28} />
        </button>
      ) : (
        <button onClick={(e) => { e.stopPropagation(); onClose(); }} style={{ ...desktopCloseButtonStyle, zIndex: 10006 }}>
          <X size={24} />
        </button>
      )}

      <div style={stageStyle} onClick={(e) => e.stopPropagation()}>
        <div onClick={handleInteraction} style={videoWrapperStyle}>
          {isLoading && (
            <div style={loaderContainerStyle}>
              <Loader2 size={48} color="var(--primary-color)" className="spin-animation" />
            </div>
          )}

          <video
            ref={videoRef}
            src={video.video_url}
            crossOrigin="anonymous"
            autoPlay playsInline loop
            onTimeUpdate={handleTimeUpdate}
            onWaiting={() => setIsLoading(true)}
            onCanPlay={() => setIsLoading(false)}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            style={{ 
                width: "100%", height: "100%", 
                objectFit: isZoomed ? "cover" : "contain",
                transition: "object-fit 0.3s ease" 
            }}
          />

          <div style={{ ...bottomGradientStyle, opacity: showControls ? 1 : 0 }} />

          {/* 🟢 THE TWITTER/X BOTTOM UI STACK */}
          <div style={{ ...bottomUIWrapper, opacity: showControls ? 1 : 0, pointerEvents: showControls ? "auto" : "none" }}>
            
            {/* 1. Video Controls (Right Aligned above progress bar) */}
            <div style={floatingControlsRow}>
                <button onClick={(e) => { e.stopPropagation(); setIsZoomed(!isZoomed); resetHideTimer(); }} style={floatingBtnStyle}>
                  {isZoomed ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
                <button onClick={handleDownload} style={floatingBtnStyle}>
                  {isDownloading ? <Loader2 size={18} className="spin-animation" /> : <Download size={18} />}
                </button>
            </div>

            {/* 2. Play/Pause & Progress Bar */}
            <div style={progressRowStyle}>
               <button onClick={handleTogglePlay} style={playPauseBtnStyle}>
                 {isPlaying ? <Pause size={20} fill="#fff" /> : <Play size={20} fill="#fff" />}
               </button>
               <input 
                 type="range" min="0" max={duration || 100} step="0.1"
                 value={currentTime || 0} 
                 onChange={(e) => {
                   e.stopPropagation();
                   if (videoRef.current) {
                     videoRef.current.currentTime = e.target.value;
                     setCurrentTime(e.target.value);
                     resetHideTimer();
                   }
                 }}
                 className="x-range"
                 style={rangeInputBaseStyle}
               />
            </div>

            {/* 3. Time Display (Extreme Right) */}
            <div style={timeDisplayRow}>
               {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            {/* 4. Avatar, Name, and Caption */}
            <div style={postInfoStyle}>
               <img 
                  src={`${APP_CONFIG.apiUrl}/api/avatar?user_id=${video.uploader_id}`}
                  alt="avatar"
                  onError={(e) => { e.target.src = '/assets/default-avatar.png'; }}
                  style={avatarStyle}
                />
               <div style={textDetailsStyle}>
                  <div style={usernameStyle}>@{video.uploader_name || "Member"}</div>
                  <div style={captionStyle}>{video.caption || APP_CONFIG.defaultCaption}</div>
               </div>
            </div>

            {/* 5. Engagement Action Bar */}
            <div style={engagementBarStyle}>
               <button style={engagementBtnStyle} onClick={handleLike}>
                  <Heart size={22} fill={isLiked ? "#f91880" : "none"} color={isLiked ? "#f91880" : "#fff"} />
                  <span>{likesCount > 0 ? likesCount : 'Like'}</span>
               </button>
               <button style={engagementBtnStyle} onClick={handleCommentClick}>
                  <MessageCircle size={22} color="#fff" />
                  <span>{commentsCount > 0 ? commentsCount : 'Reply'}</span>
               </button>
               <button style={engagementBtnStyle} onClick={handleSaveToProfile}>
                  <Bookmark size={22} fill={isSaved ? "var(--primary-color)" : "none"} color={isSaved ? "var(--primary-color)" : "#fff"} />
                  <span>{savesCount > 0 ? savesCount : 'Save'}</span>
               </button>
               <button style={engagementBtnStyle} onClick={handleShare}>
                  {copied ? <Check size={22} color="#4ade80" /> : <Share2 size={22} color="#fff" />}
                  <span>{sharesCount > 0 ? sharesCount : 'Share'}</span>
               </button>
            </div>

          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .spin-animation { animation: spin 1s linear infinite; }
        
        .x-range { width: 100%; cursor: pointer; accent-color: #fff; background: rgba(255,255,255,0.3); height: 4px; border-radius: 2px; appearance: none; outline: none; }
        .x-range::-webkit-slider-thumb { appearance: none; width: 12px; height: 12px; background: #fff; border-radius: 50%; box-shadow: 0 0 5px rgba(0,0,0,0.5); }
      `}</style>
    </div>
  );
}

// 🖌 UI STYLES
const overlayStyle = { position: "fixed", inset: 0, height: "100dvh", backgroundColor: "#000", zIndex: 999999, display: "flex", flexDirection: "column", overflow: "hidden", touchAction: "none" };
const stageStyle = { display: "flex", width: "100%", height: "100%", background: "#000", position: "relative" };
const videoWrapperStyle = { flex: 1, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer", WebkitTapHighlightColor: "transparent" };
const loaderContainerStyle = { position: "absolute", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" };

// Gradients & Buttons
const topGradientStyle = { position: "absolute", top: 0, left: 0, right: 0, height: "120px", background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)", zIndex: 10005, transition: "opacity 0.4s ease" };
const bottomGradientStyle = { position: "absolute", bottom: 0, left: 0, right: 0, height: "250px", background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0) 100%)", zIndex: 10001, transition: "opacity 0.4s ease", pointerEvents: "none" };
const mobileBackButtonStyle = { position: "absolute", top: "max(20px, env(safe-area-inset-top))", left: "20px", background: "rgba(0,0,0,0.3)", color: "#fff", border: "none", borderRadius: "50%", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)" };
const desktopCloseButtonStyle = { position: "absolute", top: "30px", right: "30px", background: "rgba(0,0,0,0.3)", color: "#fff", border: "none", borderRadius: "50%", width: "48px", height: "48px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)" };

// Twitter/X Layout Elements
const bottomUIWrapper = { position: "absolute", bottom: "max(15px, env(safe-area-inset-bottom))", left: 0, right: 0, padding: "0 15px", zIndex: 10002, display: "flex", flexDirection: "column", transition: "opacity 0.3s ease" };
const floatingControlsRow = { display: "flex", justifyContent: "flex-end", gap: "12px", marginBottom: "8px" };
const floatingBtnStyle = { background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", width: "36px", height: "36px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", cursor: "pointer" };

const progressRowStyle = { display: "flex", alignItems: "center", gap: "10px", width: "100%" };
const playPauseBtnStyle = { background: "transparent", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", justifyContent: "center" };
const rangeInputBaseStyle = { flex: 1 };

const timeDisplayRow = { display: "flex", justifyContent: "flex-end", fontSize: "12px", fontWeight: "500", color: "#e7e9ea", marginTop: "4px", textShadow: "0px 1px 2px rgba(0,0,0,0.8)" };

const postInfoStyle = { display: "flex", alignItems: "flex-start", gap: "10px", marginTop: "12px", marginBottom: "16px" };
const avatarStyle = { width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,0.2)", flexShrink: 0 };
const textDetailsStyle = { display: "flex", flexDirection: "column", gap: "4px", overflow: "hidden" };
const usernameStyle = { fontSize: "16px", fontWeight: "700", color: "#fff", textShadow: "0px 1px 3px rgba(0,0,0,0.8)" };
const captionStyle = { fontSize: "14px", color: "#e7e9ea", lineHeight: "1.4", wordWrap: "break-word", textShadow: "0px 1px 3px rgba(0,0,0,0.8)" };

const engagementBarStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 10px", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "12px" };
const engagementBtnStyle = { background: "transparent", border: "none", display: "flex", alignItems: "center", gap: "6px", color: "#e7e9ea", fontSize: "13px", fontWeight: "600", cursor: "pointer", textShadow: "0px 1px 2px rgba(0,0,0,0.8)" };