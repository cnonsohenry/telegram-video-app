import React, { useEffect, useRef, useState } from "react";
import { X, ArrowLeft, Play, Pause, Loader2, Maximize, Minimize, Share2, Download, Check, Heart, MessageCircle, Bookmark, Volume2, VolumeX } from "lucide-react";

// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../config";

export default function FullscreenPlayer({ video, onClose, isDesktop, onCommentClick }) {
  const videoRef = useRef(null);
  const containerRef = useRef(null); 
  
  // Video States
  const [isPlaying, setIsPlaying] = useState(false); 
  const [isLoading, setIsLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showControls, setShowControls] = useState(true); 
  const [isDragging, setIsDragging] = useState(false); 
  const [isMuted, setIsMuted] = useState(false); 
  
  // Action States
  const [copied, setCopied] = useState(false); 
  const [isDownloading, setIsDownloading] = useState(false); 

  // Engagement States
  const [likesCount, setLikesCount] = useState(Number(video.likes_count || 0));
  const [isLiked, setIsLiked] = useState(false);
  const [savesCount, setSavesCount] = useState(Number(video.saves_count || 0));
  const [isSaved, setIsSaved] = useState(false);
  const [sharesCount, setSharesCount] = useState(Number(video.shares_count || 0));
  const [commentsCount, setCommentsCount] = useState(Number(video.comments_count || 0));

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

  const handleTimeUpdate = () => {
    // Only read from the video if the user isn't dragging the thumb
    if (videoRef.current && !isDragging) {
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

  // 🟢 Screen Tap strictly toggles UI (No auto-hiding)
  const handleInteraction = (e) => {
    if (e) e.stopPropagation();
    setShowControls(prev => !prev);
  };

  const handleTogglePlay = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play().catch(() => {});
    }
  };

  // 🟢 ENGAGEMENT HANDLERS
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

  const handleSaveToProfile = async (e) => {
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
    if (!token) return alert("Please log in to comment!");
    
    if (onCommentClick) {
        setCommentsCount(prev => prev + 1); 
        onCommentClick(video);
    }
  };

  const handleDownload = async (e) => {
    e.stopPropagation();
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
    };
  }, []);

  if (!video) return null;

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div ref={containerRef} style={overlayStyle} onClick={onClose}>
      <div style={{ ...topGradientStyle, opacity: showControls ? 1 : 0, pointerEvents: "none" }} />

      {/* Close Buttons */}
      {!isDesktop ? (
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }} 
          style={{ ...mobileBackButtonStyle, opacity: showControls ? 1 : 0, pointerEvents: showControls ? "auto" : "none", zIndex: 10006 }}
        >
          <ArrowLeft size={28} />
        </button>
      ) : (
        <button 
          onClick={(e) => { e.stopPropagation(); onClose(); }} 
          style={{ ...desktopCloseButtonStyle, opacity: showControls ? 1 : 0, pointerEvents: showControls ? "auto" : "none", zIndex: 10006 }}
        >
          <X size={24} />
        </button>
      )}

      <div style={stageStyle} onClick={(e) => e.stopPropagation()}>
        <div onClick={handleInteraction} style={videoWrapperStyle}>
          
          {isLoading && !isDragging && (
            <div style={loaderContainerStyle}>
              <Loader2 size={48} color="var(--primary-color)" className="spin-animation" />
            </div>
          )}

          <video
            ref={videoRef}
            src={video.video_url}
            crossOrigin="anonymous"
            muted={isMuted}
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

          {/* 🟢 MASSIVE CENTER PLAY/PAUSE BUTTON */}
          <button 
             onClick={handleTogglePlay} 
             style={{
               ...centerPlayButtonStyle,
               opacity: showControls ? 1 : 0,
               pointerEvents: showControls ? "auto" : "none"
             }}
          >
             <div style={centerIconCircle}>
               {isPlaying ? <Pause size={56} fill="#fff" color="#fff" /> : <Play size={56} fill="#fff" color="#fff" />}
             </div>
          </button>

          <div style={{ ...bottomGradientStyle, opacity: showControls ? 1 : 0 }} />

          <div style={{ ...bottomUIWrapper, opacity: showControls ? 1 : 0, pointerEvents: showControls ? "auto" : "none" }}>
            
            {/* Top Row: Floating Controls (Right Aligned) */}
            <div style={floatingControlsRow}>
                <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} style={floatingBtnStyle}>
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); setIsZoomed(!isZoomed); }} style={floatingBtnStyle}>
                  {isZoomed ? <Minimize size={18} /> : <Maximize size={18} />}
                </button>
                <button onClick={handleDownload} style={floatingBtnStyle}>
                  {isDownloading ? <Loader2 size={18} className="spin-animation" /> : <Download size={18} />}
                </button>
            </div>

            {/* Middle Row: Avatar, Name, and Caption */}
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

            {/* 🟢 Bottom Row: Tight Progress Bar + Timer Grouping */}
            <div style={progressContainerStyle}>
               <input 
                 type="range" min="0" max={duration || 100} step="0.1"
                 value={currentTime || 0} 
                 
                 // 🟢 THE FIX: stopPropagation prevents the background from stealing the touch event
                 onMouseDown={(e) => { e.stopPropagation(); setIsDragging(true); }}
                 onTouchStart={(e) => { e.stopPropagation(); setIsDragging(true); }}
                 
                 onChange={(e) => {
                   e.stopPropagation();
                   setCurrentTime(parseFloat(e.target.value)); // Visual instantly updates
                 }}
                 
                 onMouseUp={(e) => {
                   e.stopPropagation();
                   setIsDragging(false);
                   if (videoRef.current) videoRef.current.currentTime = parseFloat(e.target.value);
                 }}
                 onTouchEnd={(e) => {
                   e.stopPropagation();
                   setIsDragging(false);
                   if (videoRef.current) videoRef.current.currentTime = parseFloat(e.target.value);
                 }}
                 className="x-range"
                 style={{
                   ...rangeInputBaseStyle,
                   background: `linear-gradient(to right, #ffffff ${progressPercent}%, rgba(255,255,255,0.3) ${progressPercent}%)`
                 }}
               />
               <div style={timeDisplayStyle}>
                 {formatTime(currentTime)} / {formatTime(duration)}
               </div>
            </div>

            {/* Action Bar */}
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
        
        /* 🟢 Makes the slider thumb slightly bigger for easier grabbing */
        .x-range { width: 100%; cursor: pointer; height: 6px; border-radius: 3px; appearance: none; outline: none; }
        .x-range::-webkit-slider-thumb { appearance: none; width: 16px; height: 16px; background: #fff; border-radius: 50%; box-shadow: 0 0 5px rgba(0,0,0,0.5); }
        .x-range::-moz-range-thumb { width: 16px; height: 16px; background: #fff; border-radius: 50%; border: none; box-shadow: 0 0 5px rgba(0,0,0,0.5); }
      `}</style>
    </div>
  );
}

// 🖌 UI STYLES
const overlayStyle = { position: "fixed", inset: 0, height: "100dvh", backgroundColor: "#000", zIndex: 999999, display: "flex", flexDirection: "column", overflow: "hidden", touchAction: "none" };
const stageStyle = { display: "flex", width: "100%", height: "100%", background: "#000", position: "relative" };
const videoWrapperStyle = { flex: 1, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer", WebkitTapHighlightColor: "transparent" };
const loaderContainerStyle = { position: "absolute", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" };

const topGradientStyle = { position: "absolute", top: 0, left: 0, right: 0, height: "120px", background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, rgba(0,0,0,0) 100%)", zIndex: 10005, transition: "opacity 0.4s ease" };
const bottomGradientStyle = { position: "absolute", bottom: 0, left: 0, right: 0, height: "300px", background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.6) 50%, rgba(0,0,0,0) 100%)", zIndex: 10001, transition: "opacity 0.4s ease", pointerEvents: "none" };
const mobileBackButtonStyle = { position: "absolute", top: "max(20px, env(safe-area-inset-top))", left: "20px", background: "rgba(0,0,0,0.3)", color: "#fff", border: "none", borderRadius: "50%", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)", transition: "opacity 0.4s ease" };
const desktopCloseButtonStyle = { position: "absolute", top: "30px", right: "30px", background: "rgba(0,0,0,0.3)", color: "#fff", border: "none", borderRadius: "50%", width: "48px", height: "48px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)", transition: "opacity 0.4s ease" };

// 🟢 New Center Play/Pause Button
const centerPlayButtonStyle = { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", background: "transparent", border: "none", cursor: "pointer", zIndex: 10005, transition: "opacity 0.2s ease" };
const centerIconCircle = { background: "rgba(0,0,0,0.4)", borderRadius: "50%", padding: "20px", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" };

const bottomUIWrapper = { position: "absolute", bottom: "max(15px, env(safe-area-inset-bottom))", left: 0, right: 0, padding: "0 15px", zIndex: 10002, display: "flex", flexDirection: "column", transition: "opacity 0.2s ease" };
const floatingControlsRow = { display: "flex", justifyContent: "flex-end", gap: "12px", marginBottom: "8px" };
const floatingBtnStyle = { background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", cursor: "pointer" };

const postInfoStyle = { display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "12px" };
const avatarStyle = { width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,0.2)", flexShrink: 0 };
const textDetailsStyle = { display: "flex", flexDirection: "column", gap: "4px", overflow: "hidden" };
const usernameStyle = { fontSize: "16px", fontWeight: "700", color: "#fff", textShadow: "0px 1px 3px rgba(0,0,0,0.8)" };
const captionStyle = { fontSize: "14px", color: "#e7e9ea", lineHeight: "1.4", wordWrap: "break-word", textShadow: "0px 1px 3px rgba(0,0,0,0.8)" };

// 🟢 Tightly grouped Progress and Timer
const progressContainerStyle = { display: "flex", flexDirection: "column", gap: "4px", width: "100%", marginBottom: "16px" };
const rangeInputBaseStyle = { flex: 1 };
const timeDisplayStyle = { fontSize: "11px", fontWeight: "500", color: "#ccc", textAlign: "right", paddingRight: "4px", textShadow: "0px 1px 2px rgba(0,0,0,0.8)" };

const engagementBarStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 10px", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "14px" };
const engagementBtnStyle = { background: "transparent", border: "none", display: "flex", alignItems: "center", gap: "6px", color: "#e7e9ea", fontSize: "13px", fontWeight: "600", cursor: "pointer", textShadow: "0px 1px 2px rgba(0,0,0,0.8)" };