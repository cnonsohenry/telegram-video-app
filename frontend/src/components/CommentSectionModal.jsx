import React, { useState, useEffect, useRef } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { APP_CONFIG } from "../config";

export default function CommentSectionModal({ video, onClose }) {
  const [comments, setComments] = useState([]);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  const inputRef = useRef(null);

  // Patch the viewport meta tag once on mount so the browser does NOT resize
  // the layout viewport when the keyboard opens — only the visual viewport shrinks.
  // This is the same trick TikTok / Instagram use.
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    const original = meta?.getAttribute("content") ?? "";
    const patched = original.includes("interactive-widget")
      ? original
      : original + ", interactive-widget=resizes-visual";
    if (meta) meta.setAttribute("content", patched);
    return () => {
      if (meta) meta.setAttribute("content", original);
    };
  }, []);

  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = originalOverflow; };
  }, []);

  useEffect(() => {
    fetch(`${APP_CONFIG.apiUrl}/api/comments/${video.message_id}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setComments(data))
      .catch(err => console.error("Failed to load comments", err));
  }, [video]);

  const openComposer = () => {
    setIsComposerOpen(true);
    // Focus after paint so the input is in the DOM
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    });
  };

  const closeComposer = () => {
    inputRef.current?.blur();
    setIsComposerOpen(false);
    setNewComment("");
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
      {/* 1. BACKDROP — covers screen, click outside dismisses */}
      <div style={commentBackdropStyle} onClick={onClose}>

        {/* 2. BOTTOM SHEET — fixed height, anchored to screen bottom, never moves */}
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
                      @{c.username}
                      <span style={commentDateStyle}>{new Date(c.created_at).toLocaleDateString()}</span>
                    </span>
                    <p style={commentText}>{c.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 3. FAKE INPUT — lives inside the sheet, never moves */}
          <div style={fakeInputWrapperStyle} onClick={openComposer}>
            <div style={fakeInputStyle}>Add a comment...</div>
          </div>

        </div>
      </div>

      {/*
        4. COMPOSER — completely separate stacking layer, position: fixed, bottom: 0.
           Because interactive-widget=resizes-visual is set, the layout viewport
           does NOT shrink when the keyboard opens. The browser automatically
           floats position:fixed elements above the software keyboard with no JS needed.
      */}
      {isComposerOpen && (
        <>
          {/* Invisible tap-outside-to-close layer */}
          <div style={composerDismissLayerStyle} onClick={closeComposer} />

          <form onSubmit={handlePost} style={composerFormStyle} onClick={e => e.stopPropagation()}>
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
              // Prevent the button tap from blurring the input before submit fires
              onMouseDown={e => e.preventDefault()}
              onTouchStart={e => e.preventDefault()}
              style={{ ...commentSendBtnStyle, opacity: !newComment.trim() ? 0.4 : 1 }}
            >
              {isPosting ? <Loader2 size={20} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>
        </>
      )}

      <style>{`
        @keyframes fadeIn       { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUpModal { from { transform: translateY(100%) } to { transform: translateY(0) } }
        @keyframes slideUpComposer { from { transform: translateY(100%) } to { transform: translateY(0) } }
        .custom-scrollbar::-webkit-scrollbar       { width: 4px }
        .custom-scrollbar::-webkit-scrollbar-track  { background: transparent }
        .custom-scrollbar::-webkit-scrollbar-thumb  { background: rgba(255,255,255,0.2); border-radius: 4px }
        .animate-spin { animation: spin 1s linear infinite }
        @keyframes spin { 100% { transform: rotate(360deg) } }
      `}</style>
    </>
  );
}

// ─── STYLES ──────────────────────────────────────────────────────────────────

const commentBackdropStyle = {
  position: "fixed", inset: 0, zIndex: 999999,
  background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
  display: "flex", flexDirection: "column", justifyContent: "flex-end",
  animation: "fadeIn 0.2s ease",
};

const commentBottomSheetStyle = {
  width: "100%", height: "75%",
  background: "#1c1c1e", borderRadius: "24px 24px 0 0",
  display: "flex", flexDirection: "column", overflow: "hidden",
  animation: "slideUpModal 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
  boxShadow: "0 -10px 40px rgba(0,0,0,0.5)",
};

const commentHeaderWrapperStyle = {
  display: "flex", alignItems: "center", justifyContent: "space-between",
  padding: "20px", borderBottom: "1px solid #333", flexShrink: 0,
};

const commentHeaderTitleStyle = { margin: 0, fontSize: "16px", fontWeight: 800, color: "#fff" };

const closeBottomSheetBtnStyle = {
  background: "#333", border: "none", borderRadius: "50%",
  width: "32px", height: "32px",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", flexShrink: 0,
};

const commentsListStyle = {
  flex: 1, overflowY: "auto", padding: "20px",
  display: "flex", flexDirection: "column", gap: "20px",
  overscrollBehavior: "contain", WebkitOverflowScrolling: "touch",
};

const commentItemStyle   = { display: "flex", gap: "12px" };
const commentAvatarStyle = { width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 };
const commentContentWrapper = { display: "flex", flexDirection: "column" };
const commentUsernameStyle  = { fontSize: "13px", fontWeight: 700, color: "#aaa" };
const commentDateStyle      = { fontWeight: 400, color: "#666", marginLeft: "6px" };
const commentText = { fontSize: "15px", color: "#fff", margin: "4px 0 0 0", lineHeight: "1.4", wordBreak: "break-word" };

const fakeInputWrapperStyle = {
  padding: "15px 20px",
  paddingBottom: "max(15px, env(safe-area-inset-bottom))",
  background: "#1c1c1e", borderTop: "1px solid #333",
  cursor: "text", flexShrink: 0,
};

const fakeInputStyle = {
  background: "#2c2c2e", borderRadius: "20px",
  padding: "12px 20px", fontSize: "15px", color: "#888",
};

// Tap-outside layer — sits above the sheet but below the composer
const composerDismissLayerStyle = {
  position: "fixed", inset: 0,
  zIndex: 1000000,
};

// The real composer — position fixed, bottom 0.
// With interactive-widget=resizes-visual on the <meta viewport>,
// the browser lifts this element above the keyboard automatically. Zero JS needed.
const composerFormStyle = {
  position: "fixed", left: 0, right: 0, bottom: 0,
  zIndex: 1000001,
  background: "#1c1c1e",
  padding: "12px 16px",
  paddingBottom: "max(12px, env(safe-area-inset-bottom))",
  display: "flex", gap: "10px", alignItems: "center",
  borderTop: "1px solid #2a2a2c",
  boxShadow: "0 -4px 20px rgba(0,0,0,0.5)",
  animation: "slideUpComposer 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
};

const composerInputStyle = {
  flex: 1, background: "#2c2c2e", border: "none",
  borderRadius: "20px", padding: "11px 18px",
  color: "#fff", fontSize: "15px", outline: "none",
};

const commentSendBtnStyle = {
  background: "var(--primary-color)", border: "none",
  width: "42px", height: "42px", borderRadius: "50%",
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "#fff", cursor: "pointer",
  transition: "opacity 0.2s ease", flexShrink: 0,
};