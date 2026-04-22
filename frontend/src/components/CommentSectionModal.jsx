import React, { useState, useEffect, useRef } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { APP_CONFIG } from "../config";

export default function CommentSectionModal({ video, onClose }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  
  // 🟢 NEW: The TikTok Composer Architecture
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    // Lock the body to prevent background scrolling
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = "hidden";
    
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Fetch Comments on Mount
  useEffect(() => {
    fetch(`${APP_CONFIG.apiUrl}/api/comments/${video.message_id}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setComments(data))
      .catch(err => console.error("Failed to load comments", err));
  }, [video]);

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
          inputRef.current?.blur(); // Drops the keyboard after sending
        }
      }
    } catch (err) { 
      console.error("Post failed", err); 
    }
    
    setIsPosting(false);
  };

  return (
    <div style={commentBackdropStyle} onClick={onClose}>
      
      {/* 🟢 1. THE MAIN BOTTOM SHEET */}
      <div style={commentBottomSheetStyle} onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <div style={commentHeaderWrapperStyle}>
          <h3 style={commentHeaderTitleStyle}>{comments.length} Comments</h3>
          <button onClick={onClose} style={closeBottomSheetBtnStyle}>
            <X size={20} color="#fff" />
          </button>
        </div>

        {/* Comments List */}
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

        {/* 🟢 2. THE FAKE INPUT (Sits in the normal layout) */}
        <div 
          style={fakeInputWrapperStyle} 
          onClick={() => inputRef.current?.focus()} // Synchronously triggers the real input!
        >
          <div style={{...fakeInputStyle, color: newComment ? "#fff" : "#888"}}>
            {newComment ? newComment : "Add a comment..."}
          </div>
        </div>
      </div>

      {/* 🟢 3. THE TIKTOK COMPOSER OVERLAY (Mounts on top of everything when focused) */}
      <div 
        style={{
          ...composerOverlayStyle,
          opacity: isFocused ? 1 : 0,
          pointerEvents: isFocused ? "auto" : "none"
        }}
        onClick={(e) => {
          // Tapping the dim backdrop drops the keyboard and hides this overlay
          if (e.target === e.currentTarget) inputRef.current?.blur();
        }}
      >
        <form onSubmit={handlePost} style={composerFormStyle}>
          <input 
            ref={inputRef}
            type="text" 
            value={newComment} 
            onChange={e => setNewComment(e.target.value)} 
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="Add a comment..." 
            style={composerInputStyle} 
          />
          <button 
            type="submit" 
            disabled={isPosting || !newComment.trim()} 
            // PREVENT DEFAULT ensures clicking "Send" doesn't blur the input first
            onMouseDown={e => e.preventDefault()} 
            onTouchStart={e => e.preventDefault()}
            style={{...commentSendBtnStyle, opacity: !newComment.trim() ? 0.5 : 1}}
          >
            {isPosting ? <Loader2 size={20} className="animate-spin" /> : <Send size={18} />}
          </button>
        </form>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUpModal { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }
      `}</style>
    </div>
  );
}

// 🖌 MODAL STYLES

const commentBackdropStyle = { 
  position: "fixed", inset: 0, zIndex: 9999999, 
  background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", 
  display: "flex", flexDirection: "column", justifyContent: "flex-end", 
  animation: "fadeIn 0.2s ease" 
};

const commentBottomSheetStyle = { 
  width: "100%", height: "75dvh", background: "#1c1c1e", 
  borderRadius: "24px 24px 0 0", display: "flex", flexDirection: "column", 
  overflow: "hidden", animation: "slideUpModal 0.3s cubic-bezier(0.16, 1, 0.3, 1)", 
  boxShadow: "0 -10px 40px rgba(0,0,0,0.5)" 
};

const commentHeaderWrapperStyle = { 
  display: "flex", alignItems: "center", justifyContent: "space-between", 
  padding: "20px", borderBottom: "1px solid #333" 
};

const commentHeaderTitleStyle = { margin: 0, fontSize: "16px", fontWeight: 800, color: "#fff" };

const closeBottomSheetBtnStyle = { 
  background: "#333", border: "none", borderRadius: "50%", 
  width: "32px", height: "32px", display: "flex", alignItems: "center", 
  justifyContent: "center", cursor: "pointer", transition: "background 0.2s" 
};

const commentsListStyle = { 
  flex: 1, overflowY: "auto", padding: "20px", display: "flex", 
  flexDirection: "column", gap: "20px", 
  overscrollBehavior: "contain", WebkitOverflowScrolling: "touch",
};

const commentItemStyle = { display: "flex", gap: "12px" };
const commentAvatarStyle = { width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 };
const commentContentWrapper = { display: "flex", flexDirection: "column" };
const commentUsernameStyle = { fontSize: "13px", fontWeight: 700, color: "#aaa" };
const commentDateStyle = { fontWeight: 400, color: "#666", marginLeft: "6px" };
const commentText = { fontSize: "15px", color: "#fff", margin: "4px 0 0 0", lineHeight: "1.4" };

// 🟢 NEW: Fake Input Styles (Sits inside the Bottom Sheet)
const fakeInputWrapperStyle = { 
  padding: "15px 20px", background: "#1c1c1e", borderTop: "1px solid #333", 
  paddingBottom: "env(safe-area-inset-bottom, 15px)", cursor: "pointer"
};

const fakeInputStyle = { 
  background: "#2c2c2e", borderRadius: "20px", padding: "12px 20px", 
  fontSize: "15px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
};

// 🟢 NEW: Composer Overlay Styles (Mounts over the whole screen)
const composerOverlayStyle = {
  position: "fixed", inset: 0, zIndex: 99999999, // Extremely high
  background: "rgba(0,0,0,0.5)", // Dims the bottom sheet slightly
  display: "flex", flexDirection: "column", justifyContent: "flex-end",
  transition: "opacity 0.2s ease"
};

// Form sits at absolute bottom of the overlay so it gets natively lifted by the keyboard
const composerFormStyle = {
  background: "#1c1c1e", padding: "15px 20px", display: "flex", gap: "10px", 
  alignItems: "center", borderTop: "1px solid #333",
  paddingBottom: "env(safe-area-inset-bottom, 15px)"
};

const composerInputStyle = { 
  flex: 1, background: "#2c2c2e", border: "none", borderRadius: "20px", 
  padding: "12px 20px", color: "#fff", fontSize: "15px", outline: "none" 
};

const commentSendBtnStyle = { 
  background: "var(--primary-color)", border: "none", width: "42px", height: "42px", 
  borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", 
  color: "#fff", cursor: "pointer", transition: "opacity 0.2s ease", flexShrink: 0
};