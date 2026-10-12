import React, { useState, useEffect, useRef } from "react";
import { X, Send, Loader2, Heart } from "lucide-react";
import { APP_CONFIG } from "../config";
import { renderClickableCaption } from "./ClickableCaption";

export default function CommentSectionModal({ video, onClose }) {
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // 🟢 Lock background scroll so only the modal scrolls
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = originalOverflow; };
  }, []);

  // 🟢 Fetch comments with instant response and loading feedback
  useEffect(() => {
    if (!video?.message_id) return;
    let isMounted = true;
    setIsLoading(true);
    const token = localStorage.getItem("token");
    fetch(`${APP_CONFIG.apiUrl}/api/comments/${video.message_id}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => {
        if (isMounted) {
          setComments(Array.isArray(data) ? data : []);
          setIsLoading(false);
        }
      })
      .catch(err => {
        console.error("Failed to load comments", err);
        if (isMounted) setIsLoading(false);
      });
    return () => { isMounted = false; };
  }, [video?.message_id]);

  // 🟢 Scroll to top when a new comment is added
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0;
    }
  }, [comments.length]);

  const handlePost = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const token = localStorage.getItem("token");
    if (!token) {
      window.dispatchEvent(new CustomEvent("promptLogin", { detail: { action: "comment" } }));
      return;
    }
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
          setComments([data.comment, ...comments]);
          setNewComment("");
          window.dispatchEvent(new CustomEvent("commentAdded", { 
            detail: { message_id: video.message_id, comment: data.comment } 
          }));
        }
      }
    } catch (err) {
      console.error("Post failed", err);
    }

    setIsPosting(false);
  };

  const handleReply = (username) => {
    if (!username) return;
    const replyPrefix = `@${username} `;
    setNewComment(prev => {
      if (prev.startsWith(replyPrefix)) return prev;
      return `${replyPrefix}${prev}`;
    });
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleLikeComment = async (commentId) => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.dispatchEvent(new CustomEvent("promptLogin", { detail: { action: "like" } }));
      return;
    }

    // Optimistic UI update
    setComments(prevComments =>
      prevComments.map(c => {
        if (c.id === commentId) {
          const wasLiked = Boolean(c.user_liked);
          const currentLikes = Number(c.likes_count || 0);
          return {
            ...c,
            user_liked: !wasLiked,
            likes_count: wasLiked ? Math.max(0, currentLikes - 1) : currentLikes + 1
          };
        }
        return c;
      })
    );

    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/comments/${commentId}/like`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        if (typeof data.likes_count !== "undefined") {
          setComments(prevComments =>
            prevComments.map(c => c.id === commentId ? { ...c, likes_count: data.likes_count, user_liked: data.user_liked } : c)
          );
        }
      }
    } catch (err) {
      console.error("Failed to toggle comment like:", err);
    }
  };

  const formatCommentDate = (dateStr) => {
    if (!dateStr) return "";
    const now = new Date();
    const date = new Date(dateStr);
    const diffSec = Math.floor((now - date) / 1000);
    if (diffSec < 60) return "Just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return `${diffHours}h`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d`;
    const diffWeeks = Math.floor(diffDays / 7);
    if (diffWeeks < 52) return `${diffWeeks}w`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <>
      <div style={commentBackdropStyle} onClick={onClose}>
        
        {/* 🟢 THE MODAL: Native flex column with borderless dark gray sheet */}
        <div style={commentBottomSheetStyle} onClick={e => e.stopPropagation()}>

          {/* Drag Handle */}
          <div style={dragHandleWrapper}>
            <div style={dragHandlePill} />
          </div>

          {/* Header */}
          <div style={commentHeaderWrapperStyle}>
            <h3 style={commentHeaderTitleStyle}>
              {comments.length > 0 ? comments.length : (video.comments_count || 0)} Comments
            </h3>
            <button onClick={onClose} style={closeBottomSheetBtnStyle} aria-label="Close comments">
              <X size={20} color="#fff" />
            </button>
          </div>

          {/* Comment List */}
          <div style={commentsListStyle} className="custom-scrollbar" ref={listRef}>
            {isLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "10px 0" }}>
                {[1, 2, 3].map((i) => (
                  <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start", opacity: 0.6 }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#27272a", animation: "pulse 1.5s infinite" }} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                      <div style={{ width: "90px", height: "12px", borderRadius: "4px", backgroundColor: "#27272a", animation: "pulse 1.5s infinite" }} />
                      <div style={{ width: "75%", height: "14px", borderRadius: "4px", backgroundColor: "#222225", animation: "pulse 1.5s infinite" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : comments.length === 0 ? (
              <p style={{ textAlign: "center", color: "#8e8e93", marginTop: "30px", fontSize: "14px" }}>
                No comments yet. Be the first to reply!
              </p>
            ) : (
              comments.map(c => (
                <div key={c.id} style={commentItemStyle}>
                  <img 
                    src={c.avatar_url || '/assets/default-avatar.png'} 
                    alt="avatar" 
                    style={commentAvatarStyle}
                    onClick={() => {
                      if (c.username) {
                        window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: c.username }));
                      }
                    }} 
                  />
                  <div style={commentContentWrapper}>
                    <span 
                      style={{ ...commentUsernameStyle, cursor: "pointer" }}
                      onClick={() => {
                        if (c.username) {
                          window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: c.username }));
                        }
                      }}
                      title={`View @${c.username}'s profile`}
                    >
                      @{c.username}
                    </span>
                    <p style={commentText}>{renderClickableCaption(c.content)}</p>

                    {/* Action Row: Date & Reply at extreme left, Like at extreme right */}
                    <div style={commentActionRowStyle}>
                      <div style={commentActionLeftStyle}>
                        <span style={commentDateStyle}>{formatCommentDate(c.created_at)}</span>
                        <button 
                          type="button" 
                          onClick={() => handleReply(c.username)} 
                          style={commentReplyBtnStyle}
                        >
                          Reply
                        </button>
                      </div>

                      <button 
                        type="button" 
                        onClick={() => handleLikeComment(c.id)} 
                        style={commentLikeBtnStyle}
                        aria-label="Like comment"
                      >
                        <Heart 
                          size={14} 
                          color={c.user_liked ? "#ff2d55" : "#8e8e93"} 
                          fill={c.user_liked ? "#ff2d55" : "none"} 
                        />
                        {Number(c.likes_count || 0) > 0 && (
                          <span style={{ fontSize: "11.5px", color: c.user_liked ? "#ff2d55" : "#8e8e93", fontWeight: 600 }}>
                            {c.likes_count}
                          </span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 🟢 COMPOSER: Permanently docked at the bottom with blended gray input */}
          <form onSubmit={handlePost} style={composerFormStyle}>
            <input
              ref={inputRef}
              type="text"
              value={newComment}
              onChange={e => setNewComment(e.target.value)}
              placeholder="Add a comment..."
              style={composerInputStyle}
            />
            <button
              type="submit"
              disabled={isPosting || !newComment.trim()}
              onMouseDown={e => e.preventDefault()} 
              onTouchStart={e => e.preventDefault()}
              style={{ ...commentSendBtnStyle, opacity: !newComment.trim() ? 0.5 : 1 }}
            >
              {isPosting ? <Loader2 size={20} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>

        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUpModal { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes pulse { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.75; } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const commentBackdropStyle = {
  position: "fixed", inset: 0, zIndex: 1000050,
  background: "rgba(0,0,0,0.72)", backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  display: "flex", flexDirection: "column", justifyContent: "flex-end",
  alignItems: "center",
  animation: "fadeIn 0.2s ease"
};

const dragHandleWrapper = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  paddingTop: "8px",
  paddingBottom: "4px",
  cursor: "grab",
  flexShrink: 0
};

const dragHandlePill = {
  width: "36px",
  height: "4px",
  borderRadius: "2px",
  backgroundColor: "#3e4144"
};

const commentBottomSheetStyle = {
  width: "100%", 
  maxWidth: "600px",
  height: "75dvh", // Uses dynamic viewport height so it sizes correctly on mobile
  background: "#18181b", 
  border: "none",
  borderRadius: "24px 24px 0 0",
  display: "flex", 
  flexDirection: "column", 
  overflow: "hidden",
  animation: "slideUpModal 0.28s cubic-bezier(0.16, 1, 0.3, 1)",
  boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.85)"
};

const commentHeaderWrapperStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "12px 20px 16px 20px", 
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)", 
  flexShrink: 0
};

const commentHeaderTitleStyle = { margin: 0, fontSize: "16px", fontWeight: 800, color: "#fff" };

const closeBottomSheetBtnStyle = {
  background: "rgba(255, 255, 255, 0.08)", border: "none", borderRadius: "50%",
  width: "32px", height: "32px",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", transition: "background 0.2s", flexShrink: 0
};

const commentsListStyle = {
  flex: 1, overflowY: "auto", padding: "16px 20px",
  display: "flex", flexDirection: "column", gap: "20px",
  overscrollBehavior: "contain", WebkitOverflowScrolling: "touch"
};

const commentItemStyle = { display: "flex", gap: "12px", alignItems: "flex-start" };

const commentAvatarStyle = {
  width: "36px", height: "36px", borderRadius: "50%",
  objectFit: "cover", flexShrink: 0, border: "1px solid rgba(255, 255, 255, 0.12)",
  cursor: "pointer"
};

const commentContentWrapper = { display: "flex", flexDirection: "column", flex: 1, minWidth: 0 };

const commentUsernameStyle = { fontSize: "13px", fontWeight: 700, color: "#aaa" };

const commentText = {
  fontSize: "14px", color: "#e7e9ea",
  margin: "4px 0 0 0", lineHeight: "1.4", wordBreak: "break-word"
};

const commentActionRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: "8px",
  width: "100%"
};

const commentActionLeftStyle = {
  display: "flex",
  alignItems: "center",
  gap: "14px"
};

const commentDateStyle = { 
  fontSize: "12px", 
  color: "#71767b", 
  fontWeight: "400" 
};

const commentReplyBtnStyle = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "12px",
  fontWeight: "600",
  color: "#a1a1aa",
  cursor: "pointer",
  transition: "color 0.15s ease"
};

const commentLikeBtnStyle = {
  background: "none",
  border: "none",
  padding: "4px",
  display: "flex",
  alignItems: "center",
  gap: "5px",
  cursor: "pointer",
  color: "#8e8e93",
  transition: "transform 0.15s ease"
};

// 🟢 COMPOSER (Permanently docked at the bottom of the modal)
const composerFormStyle = {
  background: "#18181b",
  padding: "14px 18px",
  paddingBottom: "max(14px, env(safe-area-inset-bottom))",
  display: "flex", gap: "10px", alignItems: "center",
  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
  flexShrink: 0
};

const composerInputStyle = {
  flex: 1, 
  background: "#27272a", 
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "20px", 
  padding: "12px 18px",
  color: "#fff", 
  fontSize: "15px", 
  outline: "none"
};

const commentSendBtnStyle = {
  background: "var(--primary-color)", border: "none",
  width: "40px", height: "40px", borderRadius: "50%",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#fff", cursor: "pointer",
  transition: "opacity 0.2s ease", flexShrink: 0
};