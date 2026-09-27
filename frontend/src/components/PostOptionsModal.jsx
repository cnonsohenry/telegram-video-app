import React from "react";
import { 
  Flag, Frown, UserPlus, UserMinus, Link2, Share2, Trash2, X 
} from "lucide-react";
import { showToast, copyToClipboard } from "../utils/toast";

export default function PostOptionsModal({
  isOpen,
  video,
  currentUser,
  isFollowing,
  onClose,
  onReport,
  onNotInterested,
  onFollowToggle,
  onDelete
}) {
  if (!isOpen || !video) return null;

  const creatorHandle = video.creator_username || video.creator?.username || video.uploader_name || "creator";
  const isOwner = currentUser && (
    (video.user_id && String(currentUser.id) === String(video.user_id)) ||
    (video.uploader_name && currentUser.username === video.uploader_name) ||
    currentUser.role === "admin"
  );

  const handleCopyLink = async () => {
    const videoId = video.message_id || video.id;
    const shareUrl = `${window.location.origin}/v/${videoId}`;
    await copyToClipboard(shareUrl, "Link copied to clipboard!");
    onClose();
  };

  const handleShare = async () => {
    const videoId = video.message_id || video.id;
    const shareUrl = `${window.location.origin}/v/${videoId}`;
    const shareData = {
      title: video.caption || "Watch this on Naija Homemade",
      text: video.caption || "Watch this on Naija Homemade",
      url: shareUrl
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        onClose();
        return;
      } catch (err) {
        if (err.name !== "AbortError") {
          handleCopyLink();
        }
      }
    } else {
      handleCopyLink();
    }
  };

  const handleNotInterested = () => {
    if (onNotInterested) onNotInterested(video);
    showToast("Got it. We'll show fewer posts like this.", "info");
    onClose();
  };

  const handleFollow = () => {
    if (onFollowToggle) onFollowToggle(creatorHandle);
    onClose();
  };

  const handleReportClick = () => {
    onClose();
    if (onReport) onReport(video);
  };

  const handleDeleteClick = () => {
    if (onDelete) onDelete(video);
    onClose();
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={sheetStyle} onClick={(e) => e.stopPropagation()}>
        {/* Top Drag Handle Indicator */}
        <div style={dragHandleWrapper}>
          <div style={dragHandlePill} />
        </div>

        {/* Options List */}
        <div style={optionsListStyle}>
          {/* Not Interested */}
          <button 
            type="button" 
            style={optionItemStyle} 
            onClick={handleNotInterested}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <div style={iconBoxStyle}>
              <Frown size={20} color="#e7e9ea" />
            </div>
            <div style={textWrapperStyle}>
              <span style={itemTitleStyle}>Not interested in this post</span>
            </div>
          </button>

          {/* Follow / Unfollow */}
          {currentUser?.username !== creatorHandle && (
            <button 
              type="button" 
              style={optionItemStyle} 
              onClick={handleFollow}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              <div style={iconBoxStyle}>
                {isFollowing ? (
                  <UserMinus size={20} color="#e7e9ea" />
                ) : (
                  <UserPlus size={20} color="#e7e9ea" />
                )}
              </div>
              <div style={textWrapperStyle}>
                <span style={itemTitleStyle}>
                  {isFollowing ? `Unfollow @${creatorHandle}` : `Follow @${creatorHandle}`}
                </span>
              </div>
            </button>
          )}

          {/* Copy Link */}
          <button 
            type="button" 
            style={optionItemStyle} 
            onClick={handleCopyLink}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <div style={iconBoxStyle}>
              <Link2 size={20} color="#e7e9ea" />
            </div>
            <div style={textWrapperStyle}>
              <span style={itemTitleStyle}>Copy link to post</span>
            </div>
          </button>

          {/* Share Via */}
          <button 
            type="button" 
            style={optionItemStyle} 
            onClick={handleShare}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <div style={iconBoxStyle}>
              <Share2 size={20} color="#e7e9ea" />
            </div>
            <div style={textWrapperStyle}>
              <span style={itemTitleStyle}>Share post via...</span>
            </div>
          </button>

          {/* Delete Option (for owner or admin) */}
          {isOwner && (
            <button 
              type="button" 
              style={optionItemStyle} 
              onClick={handleDeleteClick}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(244, 33, 46, 0.1)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              <div style={iconBoxStyle}>
                <Trash2 size={20} color="#f4212e" />
              </div>
              <div style={textWrapperStyle}>
                <span style={{ ...itemTitleStyle, color: "#f4212e" }}>Delete post</span>
              </div>
            </button>
          )}

          {/* Report Post */}
          <button 
            type="button" 
            style={optionItemStyle} 
            onClick={handleReportClick}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(244, 33, 46, 0.1)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <div style={iconBoxStyle}>
              <Flag size={20} color="#f4212e" />
            </div>
            <div style={textWrapperStyle}>
              <span style={{ ...itemTitleStyle, color: "#f4212e" }}>Report post</span>
            </div>
          </button>
        </div>

        {/* Cancel Button */}
        <div style={cancelWrapperStyle}>
          <button 
            type="button" 
            style={cancelBtnStyle} 
            onClick={onClose}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.14)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)"}
          >
            Cancel
          </button>
        </div>
      </div>

      <style>{`
        @keyframes sheetSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes sheetBackdropFade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000020,
  backgroundColor: "rgba(0, 0, 0, 0.72)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  display: "flex",
  flexDirection: "column",
  justifyContent: "flex-end",
  alignItems: "center",
  animation: "sheetBackdropFade 0.2s ease"
};

const sheetStyle = {
  width: "100%",
  maxWidth: "460px",
  backgroundColor: "#000000",
  borderTop: "1px solid #2f3336",
  borderLeft: "1px solid #2f3336",
  borderRight: "1px solid #2f3336",
  borderRadius: "22px 22px 0 0",
  padding: "10px 14px max(20px, env(safe-area-inset-bottom, 20px))",
  boxSizing: "border-box",
  animation: "sheetSlideUp 0.26s cubic-bezier(0.16, 1, 0.3, 1)",
  boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.8)",
  display: "flex",
  flexDirection: "column"
};

const dragHandleWrapper = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  paddingTop: "4px",
  paddingBottom: "10px",
  cursor: "grab"
};

const dragHandlePill = {
  width: "36px",
  height: "4px",
  borderRadius: "2px",
  backgroundColor: "#3e4144"
};

const optionsListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "4px",
  marginBottom: "12px"
};

const optionItemStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "14px",
  padding: "13px 12px",
  borderRadius: "12px",
  transition: "background-color 0.15s ease",
  textAlign: "left"
};

const iconBoxStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "24px",
  flexShrink: 0
};

const textWrapperStyle = {
  display: "flex",
  flexDirection: "column",
  flex: 1
};

const itemTitleStyle = {
  fontSize: "15px",
  fontWeight: "600",
  color: "#ffffff",
  letterSpacing: "-0.2px"
};

const cancelWrapperStyle = {
  paddingTop: "6px"
};

const cancelBtnStyle = {
  width: "100%",
  padding: "14px",
  borderRadius: "9999px",
  backgroundColor: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  color: "#ffffff",
  fontSize: "15px",
  fontWeight: "700",
  cursor: "pointer",
  transition: "background-color 0.15s ease"
};
