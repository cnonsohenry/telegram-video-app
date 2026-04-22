import React, { useState, useEffect, useRef } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { APP_CONFIG } from "../config";

export default function CommentSectionModal({ video, onClose }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const listRef = useRef(null);

  // 🟢 Lock background scroll so only the modal scrolls
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = originalOverflow; };
  }, []);

  // 🟢 Fetch comments
  useEffect(() => {
    fetch(`${APP_CONFIG.apiUrl}/api/comments/${video.message_id}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setComments(data))
      .catch(err => console.error("Failed to load comments", err));
  }, [video]);

  // 🟢 Scroll to bottom when a new comment is added
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = 0; // Assuming we want newest at the top, or you can scroll to bottom
    }
  }, [comments.length]);

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
          setComments([data.comment, ...comments]);
          setNewComment("");
          // Note: We deliberately DO NOT blur the input here. 
          // This allows users to type multiple comments rapidly without the keyboard dropping!
        }
      }
    } catch (err) {
      console.error("Post failed", err);
    }

    setIsPosting(false);
  };

  return (
    <>
      <div style={commentBackdropStyle} onClick={onClose}>
        
        {/* 🟢 THE MODAL: Native flex column. The browser will shove this up natively when typing. */}
        <div style={commentBottomSheetStyle} onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div style={commentHeaderWrapperStyle}>
            <h3 style={commentHeaderTitleStyle}>{comments.length} Comments</h3>
            <button onClick={onClose} style={closeBottomSheetBtnStyle}>
              <X size={20} color="#fff" />
            </button>
          </div>

          {/* Comment List */}
          <div style={commentsListStyle} className="custom-scrollbar" ref={listRef}>
            {comments.length === 0 ? (
              <p style={{ textAlign: "center", color: "#888", marginTop: "30px" }}>
                No comments yet. Be the first to reply!
              </p>
            ) : (
              comments.map(c => (
                <div key={c.id} style={commentItemStyle}>
                  <img src={c.avatar_url || '/assets/default-avatar.png'} alt="avatar" style={commentAvatarStyle} />
                  <div style={commentContentWrapper}>
                    <span style={commentUsernameStyle}>
                      @{c.username} <span style={commentDateStyle}>{new Date(c.created_at).toLocaleDateString()}</span>
                    </span>
                    <p style={commentText}>{c.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 🟢 THE REAL COMPOSER: Permanently docked at the bottom of the modal */}
          <form onSubmit={handlePost} style={composerFormStyle}>
            <input
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
  position: "fixed", inset: 0, zIndex: 999999,
  background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
  display: "flex", flexDirection: "column", justifyContent: "flex-end",
  animation: "fadeIn 0.2s ease"
};

const commentBottomSheetStyle = {
  width: "100%", 
  height: "75dvh", // Uses dynamic viewport height so it sizes correctly on mobile
  background: "#1c1c1e", 
  borderRadius: "24px 24px 0 0",
  display: "flex", 
  flexDirection: "column", 
  overflow: "hidden",
  animation: "slideUpModal 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
  boxShadow: "0 -10px 40px rgba(0,0,0,0.5)"
};

const commentHeaderWrapperStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "20px", borderBottom: "1px solid #333", flexShrink: 0
};

const commentHeaderTitleStyle = { margin: 0, fontSize: "16px", fontWeight: 800, color: "#fff" };

const closeBottomSheetBtnStyle = {
  background: "#333", border: "none", borderRadius: "50%",
  width: "32px", height: "32px",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", transition: "background 0.2s", flexShrink: 0
};

const commentsListStyle = {
  flex: 1, overflowY: "auto", padding: "20px",
  display: "flex", flexDirection: "column", gap: "20px",
  overscrollBehavior: "contain", WebkitOverflowScrolling: "touch"
};

const commentItemStyle = { display: "flex", gap: "12px" };

const commentAvatarStyle = {
  width: "36px", height: "36px", borderRadius: "50%",
  objectFit: "cover", flexShrink: 0
};

const commentContentWrapper = { display: "flex", flexDirection: "column" };

const commentUsernameStyle = { fontSize: "13px", fontWeight: 700, color: "#aaa" };

const commentDateStyle = { fontWeight: 400, color: "#666", marginLeft: "6px" };

const commentText = {
  fontSize: "15px", color: "#fff",
  margin: "4px 0 0 0", lineHeight: "1.4", wordBreak: "break-word"
};

// 🟢 COMPOSER (Now natively embedded in the flex column)
const composerFormStyle = {
  background: "#1c1c1e",
  padding: "15px 20px",
  paddingBottom: "max(15px, env(safe-area-inset-bottom))",
  display: "flex", gap: "10px", alignItems: "center",
  borderTop: "1px solid #2a2a2c",
  flexShrink: 0 // Ensures the input box is never crushed by the comment list
};

const composerInputStyle = {
  flex: 1, background: "#2c2c2e", border: "none",
  borderRadius: "20px", padding: "12px 20px",
  color: "#fff", fontSize: "15px", outline: "none"
};

const commentSendBtnStyle = {
  background: "var(--primary-color)", border: "none",
  width: "42px", height: "42px", borderRadius: "50%",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#fff", cursor: "pointer",
  transition: "opacity 0.2s ease", flexShrink: 0
};