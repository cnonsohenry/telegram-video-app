import React, { useEffect, useRef, useState } from "react";
import { 
  X, ArrowLeft, Play, Pause, Loader2, Maximize, Minimize, 
  Share2, Download, Check, Heart, MessageCircle, Bookmark, 
  Volume2, VolumeX, MoreVertical, Edit2, Trash2 
} from "lucide-react";

// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../config";

export default function FullscreenPlayer({ video, currentUser, onClose, isDesktop, onCommentClick }) {
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
  const [showMenu, setShowMenu] = useState(false);
  const [canModify, setCanModify] = useState(false); 

  // 🟢 NEW: Edit States
  const [isEditingMode, setIsEditingMode] = useState(false);
  const [editForm, setEditForm] = useState({ 
    caption: video.caption || "", 
    category: video.category || "hotties" 
  });

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

    if (currentUser?.role === 'admin' || String(currentUser?.id) === String(video.uploader_id)) {
      setCanModify(true);
    } else {
      setCanModify(false);
    }
  }, [video.message_id, video.uploader_id, currentUser]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.load();
    }
    setIsLoading(true);
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setShowMenu(false); 
  }, [video.message_id]);

  const handleTimeUpdate = () => {
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

  const handleInteraction = (e) => {
    if (e) e.stopPropagation();
    setShowControls(prev => !prev);
    setShowMenu(false); 
  };

  const handleTogglePlay = (e) => {
    e.stopPropagation();
    if (videoRef.current) {
      if (isPlaying) videoRef.current.pause();
      else videoRef.current.play().catch(() => {});
    }
  };

  // 🟢 ENGAGEMENT HANDLERS
  const handleLike = async (e) => { /*... existing code ...*/ };
  const handleSaveToProfile = async (e) => { /*... existing code ...*/ };
  const handleShare = async (e) => { /*... existing code ...*/ };
  const handleCommentClick = (e) => { /*... existing code ...*/ };
  const handleDownload = async (e) => { /*... existing code ...*/ };

  // 🟢 ACTUAL ADMIN / UPLOADER HANDLERS
  const handleEditCaption = (e) => {
    e.stopPropagation();
    setShowMenu(false);
    setIsEditingMode(true);
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("token");
      // Fallback to message_id if id is not included in the feed response
      const identifier = video.id || video.message_id; 
      
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/video/${identifier}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm)
      });

      if (res.ok) {
        // Optimistically update the local view
        video.caption = editForm.caption;
        video.category = editForm.category;
        setIsEditingMode(false);
      } else {
        alert("Failed to save changes. Make sure you have the right permissions.");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteVideo = async (e) => {
    e.stopPropagation();
    setShowMenu(false);
    
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
          window.location.reload(); // Refresh feed to completely clear the deleted video
        } else {
          alert("Failed to delete video. Make sure you have the right permissions.");
        }
      } catch (err) {
        console.error(err);
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
  const fallbackCategories = ['hotties', 'knacks', 'baddies', 'trends', 'shots', 'premium'];

  return (
    <div ref={containerRef} style={overlayStyle} onClick={onClose}>
      <div style={{ ...topGradientStyle, opacity: showControls ? 1 : 0, pointerEvents: "none" }} />

      {/* Header Buttons */}
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

      {/* 3-Dot Menu Button */}
      <button 
        onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu); }} 
        style={{ 
          ...menuButtonStyle, 
          right: isDesktop ? "90px" : "20px",
          opacity: showControls ? 1 : 0, 
          pointerEvents: showControls ? "auto" : "none", 
          zIndex: 10006 
        }}
      >
        <MoreVertical size={24} />
      </button>

      {/* Dropdown Menu */}
      {showMenu && (
        <div 
          style={{ position: "absolute", inset: 0, zIndex: 10007 }} 
          onClick={(e) => { e.stopPropagation(); setShowMenu(false); }}
        >
          <div style={{ ...dropdownMenuStyle, right: isDesktop ? "90px" : "20px" }} onClick={(e) => e.stopPropagation()}>
            
            {canModify && (
              <>
                <button style={dropdownItemStyle} onClick={handleEditCaption}>
                  <Edit2 size={16} /> Edit Caption
                </button>
                <button style={{ ...dropdownItemStyle, color: '#ef4444' }} onClick={handleDeleteVideo}>
                  <Trash2 size={16} /> Delete Video
                </button>
                <div style={dropdownDividerStyle} />
              </>
            )}
            
            <button style={dropdownItemStyle} onClick={(e) => { e.stopPropagation(); alert('Share Logic Here')}}>
              <Share2 size={16} /> Share
            </button>
            <button style={dropdownItemStyle} onClick={(e) => { e.stopPropagation(); alert('Download Logic Here')}}>
              <Download size={16} /> Download
            </button>
          </div>
        </div>
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

          <div style={{ ...bottomGradientStyle, opacity: showControls ? 1 : 0 }} />

          <div style={{ ...bottomUIWrapper, opacity: showControls ? 1 : 0, pointerEvents: showControls ? "auto" : "none" }}>
            
            {/* Top Row: Floating Controls */}
            <div style={floatingControlsRow}>
                <button onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }} style={floatingBtnStyle}>
                  {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); setIsZoomed(!isZoomed); }} style={floatingBtnStyle}>
                  {isZoomed ? <Minimize size={18} /> : <Maximize size={18} />}
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

            {/* Bottom Row: Play/Pause firmly docked next to Progress Bar */}
            <div style={controlBarContainer}>
               <button onClick={handleTogglePlay} style={playPauseBtnStyle}>
                 {isPlaying ? <Pause size={36} fill="#fff" color="#fff" /> : <Play size={36} fill="#fff" color="#fff" />}
               </button>

               <div style={progressContainerStyle}>
                 <input 
                   type="range" min="0" max={duration || 100} step="0.1"
                   value={currentTime || 0} 
                   onMouseDown={(e) => { e.stopPropagation(); setIsDragging(true); }}
                   onTouchStart={(e) => { e.stopPropagation(); setIsDragging(true); }}
                   onChange={(e) => { e.stopPropagation(); setCurrentTime(parseFloat(e.target.value)); }}
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
            </div>
          </div>
        </div>
      </div>

      {/* 🟢 NEW: Edit Video Modal (Matches AdminDashboard) */}
      {isEditingMode && (
        <div style={modalOverlayStyle} onClick={(e) => { e.stopPropagation(); setIsEditingMode(false); }}>
          <form onSubmit={handleSaveEdit} style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
            <div style={modalHeaderStyle}>
              <h2 style={{margin:0, fontSize: "18px", color: "#fff"}}>Edit Video</h2>
              <X size={20} cursor="pointer" onClick={() => setIsEditingMode(false)} color="#8e8e93"/>
            </div>

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
      )}

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        .spin-animation { animation: spin 1s linear infinite; }
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

const menuButtonStyle = { position: "absolute", top: "max(20px, env(safe-area-inset-top))", background: "rgba(0,0,0,0.3)", color: "#fff", border: "none", borderRadius: "50%", width: "44px", height: "44px", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(10px)", transition: "opacity 0.4s ease", cursor: "pointer" };
const dropdownMenuStyle = { position: "absolute", top: "max(75px, calc(env(safe-area-inset-top) + 75px))", background: "rgba(25, 25, 25, 0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "12px", padding: "6px", display: "flex", flexDirection: "column", gap: "2px", minWidth: "170px", backdropFilter: "blur(15px)", boxShadow: "0 10px 40px rgba(0,0,0,0.8)" };
const dropdownItemStyle = { background: "transparent", border: "none", color: "#fff", padding: "12px 14px", display: "flex", alignItems: "center", gap: "12px", fontSize: "14px", fontWeight: "500", cursor: "pointer", borderRadius: "8px", width: "100%", textAlign: "left", transition: "background 0.2s" };
const dropdownDividerStyle = { height: "1px", background: "rgba(255,255,255,0.08)", margin: "4px 0" };

const bottomUIWrapper = { position: "absolute", bottom: "max(15px, env(safe-area-inset-bottom))", left: 0, right: 0, padding: "0 15px", zIndex: 10002, display: "flex", flexDirection: "column", transition: "opacity 0.2s ease" };
const floatingControlsRow = { display: "flex", justifyContent: "flex-end", gap: "12px", marginBottom: "8px" };
const floatingBtnStyle = { background: "rgba(0,0,0,0.6)", border: "none", color: "#fff", width: "40px", height: "40px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)", cursor: "pointer" };

const postInfoStyle = { display: "flex", alignItems: "flex-start", gap: "10px", marginBottom: "12px" };
const avatarStyle = { width: "42px", height: "42px", borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,0.2)", flexShrink: 0 };
const textDetailsStyle = { display: "flex", flexDirection: "column", gap: "4px", overflow: "hidden" };
const usernameStyle = { fontSize: "16px", fontWeight: "700", color: "#fff", textShadow: "0px 1px 3px rgba(0,0,0,0.8)" };
const captionStyle = { fontSize: "14px", color: "#e7e9ea", lineHeight: "1.4", wordWrap: "break-word", textShadow: "0px 1px 3px rgba(0,0,0,0.8)" };

const controlBarContainer = { display: "flex", alignItems: "center", gap: "12px", width: "100%", marginBottom: "16px" };
const playPauseBtnStyle = { background: "transparent", border: "none", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", justifyContent: "center" };
const progressContainerStyle = { display: "flex", flexDirection: "column", gap: "4px", flex: 1 };
const rangeInputBaseStyle = { width: "100%" };
const timeDisplayStyle = { fontSize: "11px", fontWeight: "500", color: "#ccc", textAlign: "right", paddingRight: "4px", textShadow: "0px 1px 2px rgba(0,0,0,0.8)" };

// 🟢 NEW: Modal Styles (Inherited from AdminDashboard)
const modalOverlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999999 };
const modalBoxStyle = { background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "25px", width: "100%", maxWidth: "400px", margin: "0 15px", zIndex: 10000000 };
const modalHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" };
const inputGroupStyle = { display: "flex", flexDirection: "column", gap: "6px", marginBottom: "15px" };
const formLabelStyle = { fontSize: "13px", color: "#8e8e93", fontWeight: "600" };
const formInputStyle = { background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", padding: "12px", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none" };
const saveBtnStyle = { width: "100%", background: "var(--primary-color)", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: "700", fontSize: "15px", cursor: "pointer", marginTop: "10px" };