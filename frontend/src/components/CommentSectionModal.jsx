import React, { useState, useEffect, useRef } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { APP_CONFIG } from "../config";

export default function CommentSectionModal({ video, onClose }) {
  const [comments, setComments] = useState([]);
  
  // 🟢 Composer State
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const inputRef = useRef(null);

  useEffect(() => {
    // Lock background scroll
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 🟢 Track keyboard height manually because the meta tag stops the browser from doing it
    const handleResize = () => {
      if (window.visualViewport) {
        const kbHeight = window.innerHeight - window.visualViewport.height;
        // If difference is > 50px, keyboard is open. Otherwise, it's closed.
        setKeyboardHeight(kbHeight > 50 ? kbHeight : 0);
      }
    };

    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", handleResize);
      window.visualViewport.addEventListener("scroll", handleResize);
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      if (window.visualViewport) {
        window.visualViewport.removeEventListener("resize", handleResize);
        window.visualViewport.removeEventListener("scroll", handleResize);
      }
    };
  }, []);

  useEffect(() => {
    fetch(`${APP_CONFIG.apiUrl}/api/comments/${video.message_id}`)
      .then(res => res.ok ? res.json() : [])
      .then(data => setComments(data))
      .catch(err => console.error("Failed to load comments", err));
  }, [video]);

  // Auto-focus the real input when the composer overlay opens
  useEffect(() => {
    if (isComposerOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isComposerOpen]);

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
          setIsComposerOpen(false); // Close composer on success
        }
      }
    } catch (err) { 
      console.error("Post failed", err); 
    }
    
    setIsPosting(false);
  };

  return (
    <>
      {/* 🟢 1. THE MAIN BOTTOM SHEET */}
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

          {/* 🟢 2. THE FAKE INPUT (Opens the Composer Overlay) */}
          <div style={fakeInputWrapperStyle} onClick={() => setIsComposerOpen(true)}>
            <div style={fakeInputStyle}>Add a comment...</div>
          </div>

        </div>
      </div>

      {/* 🟢 3. THE COMPOSER OVERLAY (Rides on top of the keyboard) */}
      {isComposerOpen && (
        <div style={composerOverlayStyle} onClick={() => setIsComposerOpen(false)}>
          <form 
            onSubmit={handlePost} 
            style={{ 
              ...composerFormStyle, 
              // This single line magically pushes the input above the keyboard overlay
              bottom: `${keyboardHeight}px` 
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
              style={{...commentSendBtnStyle, opacity: !newComment.trim() ? 0.5 : 1}}
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

// 🖌 MODAL STYLES
const commentBackdropStyle = { position: "fixed", inset: 0, zIndex: 999999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column", justifyContent: "flex-end", animation: "fadeIn 0.2s ease" };
const commentBottomSheetStyle = { width: "100%", height: "75%", background: "#1c1c1e", borderRadius: "24px 24px 0 0", display: "flex", flexDirection: "column", overflow: "hidden", animation: "slideUpModal 0.3s cubic-bezier(0.16, 1, 0.3, 1)", boxShadow: "0 -10px 40px rgba(0,0,0,0.5)" };
const commentHeaderWrapperStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px", borderBottom: "1px solid #333", flexShrink: 0 };
const commentHeaderTitleStyle = { margin: 0, fontSize: "16px", fontWeight: 800, color: "#fff" };
const closeBottomSheetBtnStyle = { background: "#333", border: "none", borderRadius: "50%", width: "32px", height: "32px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.2s", flexShrink: 0 };
const commentsListStyle = { flex: 1, overflowY: "auto", padding: "20px", display: "flex", flexDirection: "column", gap: "20px", overscrollBehavior: "contain", WebkitOverflowScrolling: "touch" };
const commentItemStyle = { display: "flex", gap: "12px" };
const commentAvatarStyle = { width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 };
const commentContentWrapper = { display: "flex", flexDirection: "column" };
const commentUsernameStyle = { fontSize: "13px", fontWeight: 700, color: "#aaa" };
const commentDateStyle = { fontWeight: 400, color: "#666", marginLeft: "6px" };
const commentText = { fontSize: "15px", color: "#fff", margin: "4px 0 0 0", lineHeight: "1.4", wordBreak: "break-word" };

// 🟢 Fake Input Styles
const fakeInputWrapperStyle = { padding: "15px 20px", background: "#1c1c1e", borderTop: "1px solid #333", paddingBottom: "env(safe-area-inset-bottom, 15px)", cursor: "text", marginTop: "auto", flexShrink: 0 };
const fakeInputStyle = { background: "#2c2c2e", borderRadius: "20px", padding: "12px 20px", fontSize: "15px", color: "#888" };

// 🟢 Real Composer Styles
const composerOverlayStyle = { position: "fixed", inset: 0, zIndex: 9999999, backgroundColor: "rgba(0,0,0,0.4)", animation: "fadeOverlay 0.2s ease" };
const composerFormStyle = { position: "absolute", left: 0, right: 0, background: "#1c1c1e", padding: "15px 20px", display: "flex", gap: "10px", alignItems: "center", borderTop: "1px solid #333", transition: "bottom 0.1s cubic-bezier(0.2, 0.8, 0.2, 1)" };
const composerInputStyle = { flex: 1, background: "#2c2c2e", border: "none", borderRadius: "20px", padding: "12px 20px", color: "#fff", fontSize: "15px", outline: "none" };
const commentSendBtnStyle = { background: "var(--primary-color)", border: "none", width: "42px", height: "42px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer", transition: "opacity 0.2s ease", flexShrink: 0 };