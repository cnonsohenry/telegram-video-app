import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { APP_CONFIG } from "../config";

export default function CommentSectionModal({ video, onClose, onOpenComposer, latestComment }) {
  const [comments, setComments] = useState([]);
  
  useEffect(() => {
    // 🟢 Lock background scroll while modal is open
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

  // 🟢 Append newly posted comment received from App.jsx
  useEffect(() => {
    if (latestComment && latestComment._videoId === video.message_id) {
      setComments(prev => {
        // Prevent duplicates
        if (prev.find(c => c.id === latestComment.id)) return prev;
        return [latestComment, ...prev];
      });
    }
  }, [latestComment, video.message_id]);

  return (
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

        {/* 🟢 THE FAKE INPUT: Opens the real composer in App.jsx */}
        <div style={fakeInputWrapperStyle} onClick={onOpenComposer}>
          <div style={fakeInputStyle}>Add a comment...</div>
        </div>

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
const commentBackdropStyle = { position: "fixed", inset: 0, zIndex: 999999, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", flexDirection: "column", justifyContent: "flex-end", animation: "fadeIn 0.2s ease" };
const commentBottomSheetStyle = { width: "100%", height: "75dvh", background: "#1c1c1e", borderRadius: "24px 24px 0 0", display: "flex", flexDirection: "column", overflow: "hidden", animation: "slideUpModal 0.3s cubic-bezier(0.16, 1, 0.3, 1)", boxShadow: "0 -10px 40px rgba(0,0,0,0.5)" };
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

const fakeInputWrapperStyle = { padding: "15px 20px", background: "#1c1c1e", borderTop: "1px solid #333", paddingBottom: "env(safe-area-inset-bottom, 15px)", cursor: "text", marginTop: "auto", flexShrink: 0 };
const fakeInputStyle = { background: "#2c2c2e", borderRadius: "20px", padding: "12px 20px", fontSize: "15px", color: "#888" };