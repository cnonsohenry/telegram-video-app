import React, { useState, useEffect, useRef, useMemo } from "react";
import { X, Send, Loader2, Heart, Search, ChevronDown, ChevronUp } from "lucide-react";
import { APP_CONFIG } from "../config";
import { renderClickableCaption } from "./ClickableCaption";

export function generateSearchPhrase(video) {
  if (video?.search_phrase && typeof video.search_phrase === "string" && video.search_phrase.trim()) {
    return video.search_phrase.trim().toLowerCase();
  }

  const caption = (video?.caption || "").trim();
  const seo = (video?.seo_description || "").trim();
  const category = (video?.category || "").toLowerCase().trim();

  // 1. Hashtags
  const hashtags = (caption.match(/#([a-zA-Z0-9_]+)/g) || []).map(h => h.slice(1).toLowerCase());
  if (hashtags.length >= 2) {
    return hashtags.slice(0, 3).join(" ");
  } else if (hashtags.length === 1) {
    return `${category || "nigerian"} ${hashtags[0]}`;
  }

  const fillerRegex = /\b(this|that|these|those|the|a|an|is|are|was|were|been|being|have|has|had|do|does|did|will|would|shall|should|can|could|may|might|must|you|your|yours|me|my|mine|we|us|our|ours|he|him|his|she|her|hers|it|its|they|them|their|theirs|think|handle|feel|feeling|know|want|see|watch|watching|look|looking|get|getting|got|and|or|but|if|then|else|when|where|why|how|all|any|both|each|few|more|most|other|some|such|no|nor|not|only|own|same|so|than|too|very|just|baby|babe|boo|dear|hey|hi|hello|peek|ready|press|play|video|clip|tape|homemade|captivating|unleashes|showcases|indulging|into|world|behind|doors|closed|night|unfolds|inner|couldn|didn|doesn|don|wasn|weren|haven|hasn|hadn|won|wouldn|ain|gonna|wanna|gotta)\b/gi;

  const cleanCap = caption
    .replace(/https?:\/\/\S+/g, "")
    .replace(/@\w+/g, "")
    .replace(/#\w+/g, "")
    .replace(/['’]/g, "")
    .replace(/[^\w\s]/gi, " ")
    .replace(fillerRegex, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  const capWords = cleanCap.split(" ").filter(w => w.length > 2);
  if (capWords.length >= 2) {
    return capWords.slice(0, 3).join(" ");
  }

  if (seo) {
    const cleanSeo = seo
      .replace(/['’]/g, "")
      .replace(/[^\w\s]/gi, " ")
      .replace(fillerRegex, " ")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
    const seoWords = cleanSeo.split(" ").filter(w => w.length > 2);
    if (seoWords.length >= 2) {
      return seoWords.slice(0, 3).join(" ");
    }
  }

  if (capWords.length === 1) {
    return `${category || "nigerian"} ${capWords[0]}`;
  }

  const categoryFallbacks = {
    baddies: "nigerian baddie dance",
    afrobeat: "afrobeat music vibes",
    premium: "vip exclusive tape",
    model: "fashion glamour model",
    fitness: "baddie fitness workout",
    community: "viral nigerian moments"
  };

  return categoryFallbacks[category] || (category ? `${category} trending viral` : "nigerian viral dance");
}

export function stripParentMention(content, parentUsername) {
  if (!content || typeof content !== "string") return "";
  let text = content;
  if (parentUsername) {
    const escaped = parentUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    text = text.replace(new RegExp(`^@${escaped}\\s*`, 'i'), '');
  }
  return text.replace(/^@\w+\s*/, '');
}

export default function CommentSectionModal({ video, onClose }) {
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newComment, setNewComment] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [expandedReplies, setExpandedReplies] = useState(() => new Set());
  const [replyingTo, setReplyingTo] = useState(null); // { parentId, username, displayName, targetCommentId }
  const listRef = useRef(null);
  const inputRef = useRef(null);

  // 🟢 Generate TikTok-style search phrase for this video
  const searchPhrase = useMemo(() => generateSearchPhrase(video), [video]);

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

  // 🟢 Structured top-level comments with stacked replies
  const structuredComments = useMemo(() => {
    const parents = [];
    const repliesMap = new Map();

    comments.forEach(c => {
      const pid = c.parent_id ? String(c.parent_id) : null;
      if (pid) {
        if (!repliesMap.has(pid)) {
          repliesMap.set(pid, []);
        }
        repliesMap.get(pid).push(c);
      } else {
        parents.push({ ...c, replies: [] });
      }
    });

    parents.forEach(p => {
      const pKey = String(p.id);
      const threadReplies = repliesMap.get(pKey) || [];
      threadReplies.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
      p.replies = threadReplies;
    });

    parents.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return parents;
  }, [comments]);

  const handlePost = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    const token = localStorage.getItem("token");
    if (!token) {
      window.dispatchEvent(new CustomEvent("promptLogin", { detail: { action: "comment" } }));
      return;
    }
    setIsPosting(true);

    const parentIdToSend = replyingTo ? replyingTo.parentId : null;
    let commentTextToSend = newComment.trim();
    if (parentIdToSend && commentTextToSend.startsWith("@")) {
      commentTextToSend = commentTextToSend.replace(/^@\w+\s*/, "").trim();
    }

    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ 
          message_id: video.message_id, 
          content: commentTextToSend,
          parent_id: parentIdToSend
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setComments(prev => [...prev, data.comment]);
          setNewComment("");
          if (parentIdToSend) {
            // Automatically expand reply thread so author sees their reply
            setExpandedReplies(prev => new Set(prev).add(String(parentIdToSend)));
          }
          setReplyingTo(null);
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

  const handleReplyClick = (targetComment, isChild = false, parentId = null) => {
    if (!targetComment) return;
    const rootParentId = isChild ? parentId : targetComment.id;
    setReplyingTo({
      parentId: rootParentId,
      username: targetComment.username,
      displayName: targetComment.display_name || targetComment.username,
      targetCommentId: targetComment.id
    });
    // Do NOT prepend @username to the input text since replies are nested
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleCancelReply = () => {
    setReplyingTo(null);
  };

  const toggleReplies = (parentId) => {
    const idKey = String(parentId);
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(idKey)) {
        next.delete(idKey);
      } else {
        next.add(idKey);
      }
      return next;
    });
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

  const handleSearchPhraseClick = () => {
    if (!searchPhrase) return;
    if (typeof onClose === "function") {
      onClose(true);
    }
    window.dispatchEvent(new CustomEvent("openSearchModal", { detail: { query: searchPhrase } }));
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

          {/* 🌟 TIKTOK SEARCH PHRASE AT TOP OF COMMENT COUNT */}
          {searchPhrase && (
            <div 
              style={searchPhraseRowStyle}
              onClick={handleSearchPhraseClick}
              role="button"
              tabIndex={0}
              onMouseEnter={(e) => {
                const textEl = e.currentTarget.querySelector(".search-phrase-text");
                if (textEl) textEl.style.textDecoration = "underline";
              }}
              onMouseLeave={(e) => {
                const textEl = e.currentTarget.querySelector(".search-phrase-text");
                if (textEl) textEl.style.textDecoration = "none";
              }}
            >
              <Search size={14} color="#00aff0" style={{ flexShrink: 0 }} />
              <span style={searchPhraseLabelStyle}>Search</span>
              <span style={searchPhraseDotStyle}>•</span>
              <span className="search-phrase-text" style={searchPhraseTextStyle}>{searchPhrase}</span>
            </div>
          )}

          {/* Header with Comment Count */}
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
            ) : structuredComments.length === 0 ? (
              <p style={{ textAlign: "center", color: "#8e8e93", marginTop: "30px", fontSize: "14px" }}>
                No comments yet. Be the first to reply!
              </p>
            ) : (
              structuredComments.map(p => (
                <div key={p.id} style={commentItemContainerStyle}>
                  {/* Top-Level Parent Comment */}
                  <div style={commentItemStyle}>
                    <img 
                      src={p.avatar_url || '/assets/default-avatar.png'} 
                      alt="avatar" 
                      style={commentAvatarStyle}
                      onClick={() => {
                        if (p.username) {
                          window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: p.username }));
                        }
                      }} 
                    />
                    <div style={commentContentWrapper}>
                      <span 
                        style={{ ...commentDisplayNameStyle, cursor: "pointer" }}
                        onClick={() => {
                          if (p.username) {
                            window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: p.username }));
                          }
                        }}
                        title={`View @${p.username}'s profile`}
                      >
                        {p.display_name || p.username}
                      </span>
                      <p style={commentText}>{renderClickableCaption(p.content)}</p>

                      {/* Parent Action Row: Date & Reply at extreme left, Like at extreme right */}
                      <div style={commentActionRowStyle}>
                        <div style={commentActionLeftStyle}>
                          <span style={commentDateStyle}>{formatCommentDate(p.created_at)}</span>
                          <button 
                            type="button" 
                            onClick={() => handleReplyClick(p, false, p.id)} 
                            style={commentReplyBtnStyle}
                          >
                            Reply
                          </button>
                        </div>

                        <button 
                          type="button" 
                          onClick={() => handleLikeComment(p.id)} 
                          style={commentLikeBtnStyle}
                          aria-label="Like comment"
                        >
                          <Heart 
                            size={14} 
                            color={p.user_liked ? "#ff2d55" : "#8e8e93"} 
                            fill={p.user_liked ? "#ff2d55" : "none"} 
                          />
                          {Number(p.likes_count || 0) > 0 && (
                            <span style={{ fontSize: "11.5px", color: p.user_liked ? "#ff2d55" : "#8e8e93", fontWeight: 600 }}>
                              {p.likes_count}
                            </span>
                          )}
                        </button>
                      </div>

                      {/* 🟢 TIKTOK STACKED REPLIES & HIDE FEATURE */}
                      {p.replies && p.replies.length > 0 && (
                        <div style={repliesWrapperStyle}>
                          {/* View Replies Toggle Button (ONLY when collapsed) */}
                          {!expandedReplies.has(String(p.id)) && (
                            <div style={repliesToggleRowStyle}>
                              <div style={repliesLineDecorator} />
                              <button 
                                type="button"
                                onClick={() => toggleReplies(p.id)}
                                style={repliesToggleBtnStyle}
                              >
                                <span>
                                  {`View ${p.replies.length} ${p.replies.length === 1 ? "reply" : "replies"}`}
                                </span>
                                <ChevronDown size={13} color="#a1a1aa" />
                              </button>
                            </div>
                          )}

                          {/* Expanded Nested Replies */}
                          {expandedReplies.has(String(p.id)) && (
                            <div style={repliesThreadContainerStyle}>
                              {p.replies.map(reply => (
                                <div key={reply.id} style={replyItemStyle}>
                                  <img 
                                    src={reply.avatar_url || '/assets/default-avatar.png'} 
                                    alt="avatar" 
                                    style={replyAvatarStyle}
                                    onClick={() => {
                                      if (reply.username) {
                                        window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: reply.username }));
                                      }
                                    }} 
                                  />
                                  <div style={commentContentWrapper}>
                                    <span 
                                      style={{ ...commentDisplayNameStyle, fontSize: "12.5px", cursor: "pointer" }}
                                      onClick={() => {
                                        if (reply.username) {
                                          window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: reply.username }));
                                        }
                                      }}
                                      title={`View @${reply.username}'s profile`}
                                    >
                                      {reply.display_name || reply.username}
                                    </span>
                                    <p style={{ ...commentText, fontSize: "13.5px" }}>
                                      {renderClickableCaption(stripParentMention(reply.content, p.username))}
                                    </p>

                                    {/* Reply Action Row */}
                                    <div style={commentActionRowStyle}>
                                      <div style={commentActionLeftStyle}>
                                        <span style={commentDateStyle}>{formatCommentDate(reply.created_at)}</span>
                                        <button 
                                          type="button" 
                                          onClick={() => handleReplyClick(reply, true, p.id)} 
                                          style={commentReplyBtnStyle}
                                        >
                                          Reply
                                        </button>
                                      </div>

                                      <button 
                                        type="button" 
                                        onClick={() => handleLikeComment(reply.id)} 
                                        style={commentLikeBtnStyle}
                                        aria-label="Like reply"
                                      >
                                        <Heart 
                                          size={13} 
                                          color={reply.user_liked ? "#ff2d55" : "#8e8e93"} 
                                          fill={reply.user_liked ? "#ff2d55" : "none"} 
                                        />
                                        {Number(reply.likes_count || 0) > 0 && (
                                          <span style={{ fontSize: "11px", color: reply.user_liked ? "#ff2d55" : "#8e8e93", fontWeight: 600 }}>
                                            {reply.likes_count}
                                          </span>
                                        )}
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))}

                              {/* Bottom Hide Replies Toggle: ONLY place "Hide replies" appears */}
                              <div style={repliesBottomHideRowStyle}>
                                <div style={repliesLineDecorator} />
                                <button 
                                  type="button"
                                  onClick={() => toggleReplies(p.id)}
                                  style={repliesToggleBtnStyle}
                                >
                                  <span>Hide replies</span>
                                  <ChevronUp size={13} color="#a1a1aa" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* 🟢 COMPOSER: Permanently docked at the bottom with blended gray input */}
          <form onSubmit={handlePost} style={composerFormStyle}>
            {/* Replying Banner Indicator */}
            {replyingTo && (
              <div style={replyingBannerStyle}>
                <span style={replyingBannerTextStyle}>
                  Replying to <span style={{ color: "#ffffff", fontWeight: 700 }}>{replyingTo.displayName || replyingTo.username}</span>
                </span>
                <button 
                  type="button" 
                  onClick={handleCancelReply}
                  style={cancelReplyBtnStyle}
                  aria-label="Cancel reply"
                >
                  <X size={14} color="#8e8e93" />
                </button>
              </div>
            )}

            <div style={{ display: "flex", gap: "10px", alignItems: "center", width: "100%" }}>
              <input
                ref={inputRef}
                type="text"
                value={newComment}
                onChange={e => setNewComment(e.target.value)}
                placeholder={replyingTo ? `Reply to ${replyingTo.displayName || replyingTo.username}...` : "Add a comment..."}
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
            </div>
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
  background: "none",
  backgroundColor: "transparent",
  border: "none",
  padding: "4px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "opacity 0.2s",
  flexShrink: 0,
  opacity: 0.85
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

const commentDisplayNameStyle = { 
  fontSize: "13.5px", 
  fontWeight: "700", 
  color: "#ffffff", 
  letterSpacing: "-0.2px" 
};
const commentUsernameStyle = commentDisplayNameStyle;

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

// ─── TIKTOK SEARCH PHRASE STYLES (UNBOXED) ───────────────────────────────────

const searchPhraseRowStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  margin: "4px 20px 8px 20px",
  padding: "2px 0",
  background: "none",
  backgroundColor: "transparent",
  border: "none",
  cursor: "pointer",
  userSelect: "none",
  width: "fit-content"
};

const searchPhraseLabelStyle = {
  fontSize: "13px",
  color: "#a1a1aa",
  fontWeight: "500"
};

const searchPhraseDotStyle = {
  fontSize: "13px",
  color: "#71767b"
};

const searchPhraseTextStyle = {
  fontSize: "13.5px",
  fontWeight: "700",
  color: "#00aff0",
  letterSpacing: "-0.2px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  transition: "text-decoration 0.15s ease"
};

// ─── TIKTOK STACKED REPLIES & REPLY HIDE STYLES ─────────────────────────────────

const commentItemContainerStyle = {
  display: "flex",
  flexDirection: "column"
};

const repliesWrapperStyle = {
  marginTop: "6px"
};

const repliesToggleRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  marginTop: "4px"
};

const repliesLineDecorator = {
  width: "24px",
  height: "1px",
  backgroundColor: "rgba(255, 255, 255, 0.18)"
};

const repliesToggleBtnStyle = {
  background: "none",
  border: "none",
  padding: 0,
  fontSize: "12.5px",
  fontWeight: "600",
  color: "#a1a1aa",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  gap: "4px",
  transition: "color 0.15s ease"
};

const repliesThreadContainerStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
  marginTop: "12px",
  paddingLeft: "14px",
  marginLeft: "10px",
  borderLeft: "1.5px solid rgba(255, 255, 255, 0.08)"
};

const replyItemStyle = {
  display: "flex",
  gap: "10px",
  alignItems: "flex-start"
};

const replyAvatarStyle = {
  width: "28px",
  height: "28px",
  borderRadius: "50%",
  objectFit: "cover",
  flexShrink: 0,
  border: "1px solid rgba(255, 255, 255, 0.12)",
  cursor: "pointer"
};

const repliesBottomHideRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  paddingTop: "4px"
};

// ─── COMPOSER REPLYING BANNER STYLES ────────────────────────────────────────────

const replyingBannerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  width: "100%",
  padding: "4px 8px 8px 8px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
  marginBottom: "8px"
};

const replyingBannerTextStyle = {
  fontSize: "12px",
  color: "#8e8e93"
};

const cancelReplyBtnStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "2px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};