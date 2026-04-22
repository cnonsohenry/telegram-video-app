import React, { useState, useEffect, useRef } from "react";
import { Send, Loader2 } from "lucide-react";
import { APP_CONFIG } from "../config";

export default function CommentComposer({ video, onClose, onSuccess }) {
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const inputRef = useRef(null);

  // Auto-focus immediately to summon the keyboard
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

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
           onSuccess(data.comment);
        }
      }
    } catch (err) {
      console.error("Post failed", err);
    }
    setIsPosting(false);
  };

  return (
    <div style={composerBackdropStyle} onClick={onClose}>
      <form
        onSubmit={handlePost}
        style={composerWrapperStyle}
        onClick={e => e.stopPropagation()} // Prevent clicks inside form from closing it
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
          onMouseDown={e => e.preventDefault()} // Keeps focus on input
          onTouchStart={e => e.preventDefault()}
          style={{...commentSendBtnStyle, opacity: !newComment.trim() ? 0.5 : 1}}
        >
          {isPosting ? <Loader2 size={20} className="animate-spin" /> : <Send size={18} />}
        </button>
      </form>
      <style>{`
        @keyframes fadeOverlay { from { opacity: 0; } to { opacity: 1; } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// 🖌 COMPOSER STYLES
const composerBackdropStyle = { 
  position: "fixed", inset: 0, zIndex: 99999999, // Absolute highest layer
  backgroundColor: "rgba(0,0,0,0.4)", // Slight dim to focus attention
  animation: "fadeOverlay 0.2s ease"
};

const composerWrapperStyle = { 
  position: "absolute", bottom: 0, left: 0, right: 0,
  padding: "15px 20px", background: "#1c1c1e", borderTop: "1px solid #333", 
  display: "flex", gap: "10px", alignItems: "center", 
  paddingBottom: "env(safe-area-inset-bottom, 15px)",
  boxShadow: "0 -4px 20px rgba(0,0,0,0.5)"
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