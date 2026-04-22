import React, { useState, useEffect, useRef } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { APP_CONFIG } from "../config";

export default function CommentSectionModal({ video, onClose }) {
  const [comments, setComments] = useState([]);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  // 🟢 Tracks how far up the keyboard has pushed the viewport
  const [keyboardOffset, setKeyboardOffset] = useState(0);

  const inputRef = useRef(null);

  // 🟢 Lock background scroll
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

  // 🟢 THE KEY: Visual Viewport API tracks the keyboard in real time.
  // When the keyboard opens, visualViewport.height shrinks.
  // We compute the gap between window.innerHeight and the viewport bottom
  // to get the exact keyboard height — and push ONLY the composer up by that amount.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const handleResize = () => {
      // keyboardHeight = how much the keyboard is covering from the bottom
      const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop;
      setKeyboardOffset(Math.max(0, keyboardHeight));
    };

    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);

    return () => {
      vv.removeEventListener("resize", handleResize);
      vv.removeEventListener("scroll", handleResize);
    };
  }, []);

  const openComposer = () => {
    // 🟢 Always reset to 0 first — prevents stale offset from a previous session
    // pre-shifting the composer before the Visual Viewport fires its first event.
    setKeyboardOffset(0);
    setIsComposerOpen(true);
    setTimeout(() => {
      if (inputRef.current) inputRef.current.focus();
    }, 50);
  };

  const closeComposer = () => {
    setIsComposerOpen(false);
    setKeyboardOffset(0);
    if (inputRef.current) inputRef.current.blur();
  };

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
          closeComposer();
        }
      }
    } catch (err) {
      console.error("Post failed", err);
    }

    setIsPosting(false);
  };

  return (
    <>
      {/* 1. BACKDROP + BOTTOM SHEET — never moves, keyboard does not affect it */}
      <div style={commentBackdropStyle} onClick={onClose}>
        <div style={commentBottomSheetStyle} onClick={e => e.stopPropagation()}>

          <div style={commentHeaderWrapperStyle}>
            <h3 style={commentHeaderTitleStyle}>{comments.length} Comments</h3>
            <button onClick={onClose} style={closeBottomSheetBtnStyle}>
              <X size={20} color="#fff" />
            </button>
          </div>

          <div style={commentsListStyle} className="custom-scrollbar">
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

          {/* 2. FAKE INPUT — always sits at the bottom of the sheet, never moves */}
          <div style={fakeInputWrapperStyle} onClick={openComposer}>
            <div style={fakeInputStyle}>Add a comment...</div>
          </div>

        </div>
      </div>

      {/* 3. COMPOSER — floats above the keyboard using keyboardOffset */}
      {isComposerOpen && (
        <div
          style={composerOverlayStyle}
          onClick={closeComposer}
        >
          <form
            onSubmit={handlePost}
            // 🟢 `bottom` is driven by the keyboard height from the Visual Viewport API.
            // This slides the composer up exactly as much as the keyboard rises —
            // the sheet behind it stays completely still.
            style={{
              ...composerFormStyle,
              bottom: keyboardOffset,
              // Smooth follow as keyboard animates open/closed
              transition: keyboardOffset > 0
                ? "bottom 0.02s linear"   // nearly instant while keyboard is rising
                : "bottom 0.25s ease-out" // spring back when keyboard drops
            }}
            onClick={e => e.stopPropagation()}
          >
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
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeOverlay { from { opacity: 0; } to { opacity: 1; } }
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
  width: "100%", height: "75%",
  background: "#1c1c1e", borderRadius: "24px 24px 0 0",
  display: "flex", flexDirection: "column", overflow: "hidden",
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

// Fake input — anchored to the sheet, never moves
const fakeInputWrapperStyle = {
  padding: "15px 20px",
  background: "#1c1c1e",
  borderTop: "1px solid #333",
  paddingBottom: "env(safe-area-inset-bottom, 15px)",
  cursor: "text",
  marginTop: "auto",
  flexShrink: 0
};

const fakeInputStyle = {
  background: "#2c2c2e", borderRadius: "20px",
  padding: "12px 20px", fontSize: "15px", color: "#888"
};

// Composer overlay — dim backdrop, click-outside to dismiss
const composerOverlayStyle = {
  position: "fixed", inset: 0,
  zIndex: 9999999,
  backgroundColor: "rgba(0,0,0,0.0)", // invisible — sheet is already dimmed
  animation: "fadeOverlay 0.15s ease"
};

// Composer form — fixed to bottom, slides up by keyboardOffset
const composerFormStyle = {
  position: "fixed",
  left: 0, right: 0,
  // bottom is set dynamically via inline style above
  background: "#1c1c1e",
  padding: "12px 16px",
  paddingBottom: "max(12px, env(safe-area-inset-bottom))",
  display: "flex", gap: "10px", alignItems: "center",
  borderTop: "1px solid #2a2a2c",
  boxShadow: "0 -4px 20px rgba(0,0,0,0.4)"
};

const composerInputStyle = {
  flex: 1, background: "#2c2c2e", border: "none",
  borderRadius: "20px", padding: "11px 18px",
  color: "#fff", fontSize: "15px", outline: "none"
};

const commentSendBtnStyle = {
  background: "var(--primary-color)", border: "none",
  width: "42px", height: "42px", borderRadius: "50%",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#fff", cursor: "pointer",
  transition: "opacity 0.2s ease", flexShrink: 0
};