import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, Heart, MessageCircle, Share2, Eye, Play, Loader2, Bookmark, X, Send } from "lucide-react";
import { APP_CONFIG } from "../config";
import PullToRefresh from "../components/PullToRefresh";

// 🟢 NEW: TIKTOK STYLE COMMENT MODAL
const CommentSectionModal = ({ video, onClose }) => {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [videoUrl, setVideoUrl] = useState(null);
  const [isPosting, setIsPosting] = useState(false);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  useEffect(() => {
    // 1. Fetch Video Stream
    fetch(`${APP_CONFIG.apiUrl}/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`)
      .then(res => res.ok ? res.json() : {})
      .then(data => { if (data.video_url) setVideoUrl(data.video_url); });

    // 2. Fetch Comments
    fetch(`${APP_CONFIG.apiUrl}/api/comments/${video.message_id}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setComments(data));
  }, [video]);

  // 3. Initialize HLS for the mini-player
  useEffect(() => {
    if (!videoUrl || !videoRef.current) return;
    if (videoUrl.includes('.m3u8') && window.Hls && window.Hls.isSupported()) {
      if (!hlsRef.current) {
        hlsRef.current = new window.Hls({ startLevel: 1 });
        hlsRef.current.loadSource(videoUrl);
        hlsRef.current.attachMedia(videoRef.current);
      }
    } else {
      if (videoRef.current.src !== videoUrl) videoRef.current.src = videoUrl;
    }
  }, [videoUrl]);

  // 4. Submit Comment
  const handlePost = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    const token = localStorage.getItem("token");
    setIsPosting(true);

    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ message_id: video.message_id, content: newComment })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setComments([data.comment, ...comments]); // Inject new comment at the top instantly
          setNewComment("");
        }
      }
    } catch (err) { console.error("Post failed", err); }
    
    setIsPosting(false);
  };

  return (
    <div style={commentModalOverlayStyle}>
      
      {/* TOP SECTION: Mini Video Player */}
      <div style={commentModalTopStyle}>
        <button onClick={onClose} style={closeModalBtnStyle}>
          <X size={24} color="#fff" />
        </button>
        {videoUrl ? (
          <video ref={videoRef} src={videoUrl} style={commentModalVideoStyle} autoPlay playsInline loop controls />
        ) : (
          <img src={video.thumbnail_url} alt="thumbnail" style={commentModalVideoStyle} />
        )}
      </div>

      {/* BOTTOM SECTION: Comments & Input */}
      <div style={commentModalBottomStyle}>
        <h3 style={commentHeaderStyle}>{comments.length} Comments</h3>
        
        <div style={commentsListStyle} className="custom-scrollbar">
          {comments.length === 0 ? (
            <p style={{ textAlign: "center", color: "#888", marginTop: "30px" }}>No comments yet. Be the first to reply!</p>
          ) : (
            comments.map(c => (
              <div key={c.id} style={commentItemStyle}>
                <img src={c.avatar_url || '/assets/default-avatar.png'} alt="avatar" style={commentAvatarStyle} />
                <div style={commentContentWrapper}>
                  <span style={commentUsernameStyle}>@{c.username} <span style={commentDateStyle}>{new Date(c.created_at).toLocaleDateString()}</span></span>
                  <p style={commentText}>{c.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <form onSubmit={handlePost} style={commentInputWrapperStyle}>
          <input 
            type="text" 
            value={newComment} 
            onChange={e => setNewComment(e.target.value)} 
            placeholder="Add a comment..." 
            style={commentInputStyle} 
          />
          <button type="submit" disabled={isPosting || !newComment.trim()} style={{...commentSendBtnStyle, opacity: !newComment.trim() ? 0.5 : 1}}>
            {isPosting ? <Loader2 size={20} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>
    </div>
  );
};

// 🟢 INDIVIDUAL POST COMPONENT
const FeedPost = ({ video, isLast, lastElementRef, onVideoClick, onCommentClick, isAnyModalOpen }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  
  const [likesCount, setLikesCount] = useState(Number(video.likes_count || 0));
  const [isLiked, setIsLiked] = useState(false);
  
  const [savesCount, setSavesCount] = useState(Number(video.saves_count || 0));
  const [isSaved, setIsSaved] = useState(false);
  
  const [sharesCount, setSharesCount] = useState(Number(video.shares_count || 0));
  const [commentsCount, setCommentsCount] = useState(Number(video.comments_count || 0));
  
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

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
      { threshold: 0.6 }
    );
    if (containerRef.current) observer.observe(containerRef.current);
    return () => { if (containerRef.current) observer.unobserve(containerRef.current); };
  }, []);

  useEffect(() => {
    let timer;
    if (isPlaying && !videoUrl) {
      timer = setTimeout(async () => {
        try {
          const res = await fetch(`${APP_CONFIG.apiUrl}/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.video_url) setVideoUrl(data.video_url);
          }
        } catch (e) {}
      }, 300); 
    }
    return () => clearTimeout(timer);
  }, [isPlaying, videoUrl, video.chat_id, video.message_id]);

  useEffect(() => {
    if (!videoUrl || !videoRef.current) return;
    if (videoUrl.includes('.m3u8') && window.Hls && window.Hls.isSupported()) {
      if (!hlsRef.current) {
        hlsRef.current = new window.Hls({ startLevel: 1 }); 
        hlsRef.current.loadSource(videoUrl);
        hlsRef.current.attachMedia(videoRef.current);
      }
    } else {
      if (videoRef.current.src !== videoUrl) videoRef.current.src = videoUrl;
    }
  }, [videoUrl]);

  // 🟢 Auto-Pause feed video if the comment modal is open!
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying && !isAnyModalOpen) {
        videoRef.current.play().catch(() => {});
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, videoUrl, isAnyModalOpen]);

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
    
    // Updates internal count instantly anticipating a comment
    setCommentsCount(prev => prev + 1); 
    onCommentClick(video);
  };

  return (
    <div ref={isLast ? lastElementRef : null} style={postStyle}>
      <div style={avatarColumnStyle}>
        <img 
          src={`${APP_CONFIG.apiUrl}/api/avatar?user_id=${video.uploader_id}`}
          alt="avatar"
          onError={(e) => { e.target.src = '/assets/default-avatar.png'; }}
          style={avatarStyle}
        />
      </div>

      <div style={contentColumnStyle}>
        <div style={postHeaderStyle}>
          <span style={usernameStyle}>@{video.uploader_name || "Member"}</span>
          <span style={timeStyle}>&middot; {new Date(video.created_at).toLocaleDateString()} &middot; {video.category}</span>
        </div>

        <p style={captionStyle}>{video.caption || APP_CONFIG.defaultCaption}</p>

        <div ref={containerRef} style={videoContainerStyle} onClick={() => onVideoClick(video)}>
          {videoUrl ? (
            <video ref={videoRef} style={thumbnailImgStyle} muted loop playsInline poster={video.thumbnail_url} />
          ) : (
            <img src={video.thumbnail_url} alt="thumbnail" style={thumbnailImgStyle} loading="lazy" />
          )}
          {!isPlaying && <div style={playOverlayStyle}><Play size={24} fill="#fff" strokeWidth={0} /></div>}
          {video.is_group && <div style={groupBadgeStyle}>Album</div>}
        </div>

        <div style={actionBarStyle}>
          <div style={actionItemStyle}>
            <Eye size={18} />
            <span>{Number(video.views || 0).toLocaleString()}</span>
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

export default function Explore({ onVideoClick }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreSearch, setHasMoreSearch] = useState(true);
  
  // 🟢 Tracks which video's comment section is open
  const [activeCommentVideo, setActiveCommentVideo] = useState(null);

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

  const loadRandomFeed = async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const validCategories = APP_CONFIG.categories.filter(c => c.toLowerCase() !== "premium");
      
      const fetches = validCategories.map(async (cat) => {
        const randomPage = Math.floor(Math.random() * 5) + 1; 
        let res = await fetch(`${APP_CONFIG.apiUrl}/api/videos?category=${cat}&limit=8&page=${randomPage}`);
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
        if (data && data.suggestions) combined = [...combined, ...data.suggestions]; 
      });

      const uniqueMap = new Map();
      combined.forEach(video => {
        if (video.category && video.category.toLowerCase() !== "premium") {
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

  useEffect(() => { loadRandomFeed(); }, []);

  const loadSearchFeed = async (pageNum = 1, isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/search?q=${encodeURIComponent(searchQuery)}&limit=15&page=${pageNum}`);
      if (res.ok) {
        const data = await res.json();
        const safeVideos = (data.videos || []).filter(v => v.category && v.category.toLowerCase() !== "premium");

        if (isLoadMore) setFeed(prev => [...prev, ...safeVideos]);
        else setFeed(safeVideos);
        
        setHasMoreSearch(data.hasMore);
        setSearchPage(pageNum);
      }
    } catch (err) { console.error("Search failed", err); }

    setLoading(false);
    setLoadingMore(false);
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchPage(1);
      setHasMoreSearch(true);
      loadRandomFeed();
      return;
    }
    loadSearchFeed(1, false);
  };

  return (
    <div style={containerStyle}>
      <div style={headerWrapper}>
        <div style={searchContainer}>
          <Search size={18} color="#888" style={{ marginLeft: "15px" }} />
          <form onSubmit={handleSearchSubmit} style={{ flex: 1, display: "flex" }}>
            <input 
              type="text" 
              placeholder="Search trending shots..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={searchInputStyle}
            />
          </form>
        </div>
      </div>

      <PullToRefresh onRefresh={() => {
        setSearchPage(1);
        setHasMoreSearch(true);
        if (searchQuery.trim()) loadSearchFeed(1, false);
        else loadRandomFeed();
      }}>
        <div style={feedWrapper}>
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
                  onCommentClick={setActiveCommentVideo}
                  isAnyModalOpen={!!activeCommentVideo} // Pauses feed if modal is open
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

      {/* 🟢 THE MODAL OVERLAY */}
      {activeCommentVideo && (
        <CommentSectionModal 
          video={activeCommentVideo} 
          onClose={() => setActiveCommentVideo(null)} 
        />
      )}

      <style>{`
        @keyframes skeleton-loading { 0% { background-color: #222; } 50% { background-color: #333; } 100% { background-color: #222; } }
        @keyframes slideUpModal { 0% { transform: translateY(100%); } 100% { transform: translateY(0); } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
      `}</style>
    </div>
  );
}

// 🖌 STYLES 
const containerStyle = { width: "100%", minHeight: "100%", display: "flex", flexDirection: "column", background: "var(--bg-color)" };
const headerWrapper = { position: "sticky", top: 0, zIndex: 100, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border-color)", padding: "12px 16px" };
const searchContainer = { display: "flex", alignItems: "center", background: "#16181c", borderRadius: "30px", border: "1px solid #333", height: "44px", overflow: "hidden" };
const searchInputStyle = { background: "transparent", border: "none", color: "#fff", padding: "0 15px", width: "100%", fontSize: "15px", outline: "none" };
const feedWrapper = { maxWidth: "600px", margin: "0 auto", width: "100%", borderLeft: window.innerWidth > 600 ? "1px solid var(--border-color)" : "none", borderRight: window.innerWidth > 600 ? "1px solid var(--border-color)" : "none", minHeight: "100vh" };
const postStyle = { padding: "16px", borderBottom: "1px solid var(--border-color)", display: "flex", flexDirection: "row", animation: "fadeIn 0.3s ease-out" };
const avatarColumnStyle = { marginRight: "12px", flexShrink: 0 };
const contentColumnStyle = { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 };
const postHeaderStyle = { display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" };
const avatarStyle = { width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", backgroundColor: "#222" };
const usernameStyle = { fontSize: "15px", fontWeight: "700", color: "#fff" };
const timeStyle = { fontSize: "13px", color: "#71767b", textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const captionStyle = { fontSize: "15px", lineHeight: "1.5", color: "#e7e9ea", margin: "0 0 12px 0", wordWrap: "break-word" };
const videoContainerStyle = { width: "75%", position: "relative", borderRadius: "16px", overflow: "hidden", background: "#111", border: "1px solid #333", cursor: "pointer", aspectRatio: "9/16", maxHeight: "600px" };
const thumbnailImgStyle = { width: "100%", height: "100%", objectFit: "cover" };
const playOverlayStyle = { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "50px", height: "50px", borderRadius: "50%", background: "var(--primary-color)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", border: "2px solid rgba(255,255,255,0.2)" };
const groupBadgeStyle = { position: "absolute", top: "12px", right: "12px", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: "12px", fontWeight: "700", padding: "4px 8px", borderRadius: "12px", backdropFilter: "blur(4px)" };
const actionBarStyle = { display: "flex", justifyContent: "space-between", marginTop: "12px", maxWidth: "425px" };
const actionItemStyle = { display: "flex", alignItems: "center", gap: "6px", color: "#71767b", fontSize: "13px", cursor: "pointer", transition: "color 0.2s ease" };
const skeletonAvatar = { width: "40px", height: "40px", borderRadius: "50%", animation: "skeleton-loading 1.5s infinite" };
const skeletonTextBase = { width: "150px", height: "20px", borderRadius: "4px", marginTop: "4px", animation: "skeleton-loading 1.5s infinite" };
const skeletonVideo = { width: "100%", height: "300px", borderRadius: "16px", animation: "skeleton-loading 1.5s infinite" };

// 🟢 MODAL STYLES
const commentModalOverlayStyle = { position: "fixed", inset: 0, zIndex: 999999, display: "flex", flexDirection: "column", background: "#000", animation: "slideUpModal 0.3s cubic-bezier(0.16, 1, 0.3, 1)" };
const commentModalTopStyle = { flex: "0 0 35vh", position: "relative", background: "#000", display: "flex", justifyContent: "center", alignItems: "center" };
const commentModalVideoStyle = { width: "100%", height: "100%", objectFit: "contain" };
const closeModalBtnStyle = { position: "absolute", top: "20px", left: "20px", background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "50%", padding: "8px", cursor: "pointer", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center" };
const commentModalBottomStyle = { flex: 1, background: "#1c1c1e", borderRadius: "24px 24px 0 0", marginTop: "-20px", zIndex: 2, display: "flex", flexDirection: "column", overflow: "hidden", boxShadow: "0 -4px 20px rgba(0,0,0,0.5)" };
const commentHeaderStyle = { padding: "20px", margin: 0, fontSize: "16px", fontWeight: 800, borderBottom: "1px solid #333", textAlign: "center", color: "#fff" };
const commentsListStyle = { flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "20px" };
const commentItemStyle = { display: "flex", gap: "12px" };
const commentAvatarStyle = { width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover" };
const commentContentWrapper = { display: "flex", flexDirection: "column" };
const commentUsernameStyle = { fontSize: "13px", fontWeight: 700, color: "#aaa" };
const commentDateStyle = { fontWeight: 400, color: "#666", marginLeft: "6px" };
const commentText = { fontSize: "15px", color: "#fff", margin: "4px 0 0 0", lineHeight: "1.4" };
const commentInputWrapperStyle = { padding: "15px 20px", background: "#1c1c1e", borderTop: "1px solid #333", display: "flex", gap: "10px", alignItems: "center", paddingBottom: "env(safe-area-inset-bottom, 15px)" };
const commentInputStyle = { flex: 1, background: "#2c2c2e", border: "none", borderRadius: "20px", padding: "12px 20px", color: "#fff", fontSize: "15px", outline: "none" };
const commentSendBtnStyle = { background: "var(--primary-color)", border: "none", width: "42px", height: "42px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer", transition: "opacity 0.2s ease" };