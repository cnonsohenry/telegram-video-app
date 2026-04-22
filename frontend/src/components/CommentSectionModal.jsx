import React, { useState, useEffect } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { APP_CONFIG } from "../config";

export default function CommentSectionModal({ video, onClose }) {
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);

  // 🟢 THE MAGIC: Visual Viewport Tracking
  const [initialHeight, setInitialHeight] = useState(0);
  const [visualHeight, setVisualHeight] = useState(0);
  const INPUT_HEIGHT = 70; // Fixed height for the composer bar

  useEffect(() => {
    // 1. Lock the document body to prevent iOS scroll push
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 2. Capture the true screen size before keyboard opens
    const initH = window.innerHeight;
    setInitialHeight(initH);
    setVisualHeight(window.visualViewport ? window.visualViewport.height : initH);

    // 3. Track the exact height of the screen above the keyboard
    const handleResize = () => {
      if (window.visualViewport) {
        setVisualHeight(window.visualViewport.height);
      } else {
        setVisualHeight(window.innerHeight);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
      window.visualViewport.addEventListener('scroll', handleResize); // Fixes iOS pinch bugs
    } else {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
        window.visualViewport.removeEventListener('scroll', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

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
          document.activeElement?.blur(); // Drop keyboard on send
        }
      }
    } catch (err) { 
      console.error("Post failed", err); 
    }
    
    setIsPosting(false);
  };

  // Prevent rendering flash while heights calculate
  if (initialHeight === 0) return null; 

  const isKeyboardOpen = visualHeight < initialHeight - 100;

  return (
    <div 
      style={{
        position: "fixed", top: 0, left: 0, right: 0, 
        height: `${initialHeight}px`, // 🟢 Hardcoded pixel height prevents browser squish
        zIndex: 999999,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(4px)",
        animation: "fadeIn 0.2s ease"
      }} 
      onClick={onClose}
    >
      
      {/* 🟢 1. THE FROZEN BOTTOM SHEET */}
      <div 
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          height: "75%", // 75% of the frozen wrapper, meaning it NEVER moves
          background: "#1c1c1e",
          borderRadius: "24px 24px 0 0",
          display: "flex", flexDirection: "column",
          animation: "slideUpModal 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
          boxShadow: "0 -10px 40px rgba(0,0,0,0.5)"
        }} 
        onClick={e => e.stopPropagation()}
      >
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
      </div>

      {/* 🟢 2. THE FLOATING INPUT (Slides independently over the sheet) */}
      <form 
        onSubmit={handlePost} 
        style={{
          position: "absolute",
          // Interpolates top position perfectly to sit above the keyboard
          top: `${visualHeight - INPUT_HEIGHT}px`, 
          left: 0, right: 0, height: `${INPUT_HEIGHT}px`,
          background: isKeyboardOpen ? "#1c1c1e" : "rgba(28, 28, 30, 0.85)",
          backdropFilter: isKeyboardOpen ? "none" : "blur(12px)",
          borderTop: "1px solid #333",
          display: "flex", gap: "10px", alignItems: "center", padding: "0 20px",
          transition: "top 0.1s cubic-bezier(0.2, 0.8, 0.2, 1), background 0.3s ease",
          // Add padding for iPhone home bar ONLY if keyboard is closed
          paddingBottom: isKeyboardOpen ? "0" : "env(safe-area-inset-bottom)",
          boxSizing: "border-box"
        }}
        onClick={e => e.stopPropagation()}
      >
        <input 
          type="text" 
          value={newComment} 
          onChange={e => setNewComment(e.target.value)} 
          placeholder="Add a comment..." 
          style={commentInputStyle} 
        />
        <button 
          type="submit" 
          disabled={isPosting || !newComment.trim()} 
          onMouseDown={e => e.preventDefault()} // Don't steal focus from input on click
          onTouchStart={e => e.preventDefault()}
          style={{...commentSendBtnStyle, opacity: !newComment.trim() ? 0.5 : 1}}
        >
          {isPosting ? <Loader2 size={20} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>

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

// 🖌 STYLES

const commentHeaderWrapperStyle = { 
  display: "flex", alignItems: "center", justifyContent: "space-between", 
  padding: "20px", borderBottom: "1px solid #333", flexShrink: 0
};

const commentHeaderTitleStyle = { margin: 0, fontSize: "16px", fontWeight: 800, color: "#fff" };

const closeBottomSheetBtnStyle = { 
  background: "#333", border: "none", borderRadius: "50%", 
  width: "32px", height: "32px", display: "flex", alignItems: "center", 
  justifyContent: "center", cursor: "pointer", transition: "background 0.2s", flexShrink: 0
};

const commentsListStyle = { 
  flex: 1, overflowY: "auto", padding: "20px", display: "flex", 
  flexDirection: "column", gap: "20px", 
  overscrollBehavior: "contain", WebkitOverflowScrolling: "touch",
  // 🟢 Massive padding ensures the user can scroll the final comment UP past the keyboard
  paddingBottom: "50vh" 
};

const commentItemStyle = { display: "flex", gap: "12px" };
const commentAvatarStyle = { width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 };
const commentContentWrapper = { display: "flex", flexDirection: "column" };
const commentUsernameStyle = { fontSize: "13px", fontWeight: 700, color: "#aaa" };
const commentDateStyle = { fontWeight: 400, color: "#666", marginLeft: "6px" };
const commentText = { fontSize: "15px", color: "#fff", margin: "4px 0 0 0", lineHeight: "1.4" };

const commentInputStyle = { 
  flex: 1, background: "#2c2c2e", border: "none", borderRadius: "20px", 
  padding: "12px 20px", color: "#fff", fontSize: "15px", outline: "none" 
};

const commentSendBtnStyle = { 
  background: "var(--primary-color)", border: "none", width: "42px", height: "42px", 
  borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", 
  color: "#fff", cursor: "pointer", transition: "opacity 0.2s ease", flexShrink: 0
};