import React, { useState } from "react";
import { 
  Flag, Frown, UserPlus, UserMinus, Link2, Share2, Trash2, X, Download, Loader2 
} from "lucide-react";
import { showToast, copyToClipboard, promptLogin, promptEmailVerification } from "../utils/toast";
import { APP_CONFIG } from "../config";
import useModalHistory from "../hooks/useModalHistory";

export default function PostOptionsModal({
  isOpen,
  video,
  currentUser,
  isFollowing,
  onClose,
  onReport,
  onNotInterested,
  onFollowToggle,
  onDelete,
  onDownload
}) {
  const handleSafeClose = useModalHistory(isOpen && Boolean(video), onClose, "postOptions");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDesktop, setIsDesktop] = useState(typeof window !== "undefined" ? window.innerWidth >= 640 : false);

  React.useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 640);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

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
    handleSafeClose();
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
        handleSafeClose();
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
    handleSafeClose();
  };

  const handleFollow = () => {
    if (onFollowToggle) onFollowToggle(creatorHandle);
    handleSafeClose();
  };

  const handleReportClick = () => {
    const currentState = window.history.state || {};
    const newState = { ...currentState };
    delete newState.postOptions;
    newState.reportModal = true;
    window.history.replaceState(newState, document.title);
    if (onReport) onReport(video);
    if (onClose) onClose();
  };

  const handleDeleteClick = () => {
    if (onDelete) onDelete(video);
    handleSafeClose();
  };

  const handleDownloadClick = async () => {
    if (onDownload) {
      onDownload(video);
      handleSafeClose();
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      handleSafeClose();
      promptLogin("download");
      return;
    }

    if (currentUser && !currentUser.email_verified && currentUser.role !== "admin") {
      handleSafeClose();
      promptEmailVerification({
        reason: "download",
        email: currentUser.email,
        onVerified: () => handleDownloadClick()
      });
      return;
    }

    setIsDownloading(true);
    try {
      const identifier = video.id || video.message_id;
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/videos/${encodeURIComponent(identifier)}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();

      if (res.status === 401) {
        handleSafeClose();
        promptLogin("download");
        return;
      }
      if (res.status === 403 && data.requires_email_verification) {
        handleSafeClose();
        promptEmailVerification({
          reason: "download",
          email: data.email || currentUser?.email,
          onVerified: () => handleDownloadClick()
        });
        return;
      }
      if (!res.ok) throw new Error(data.error || "Failed to download video");

      const link = document.createElement("a");
      link.href = data.download_url;
      link.setAttribute("download", data.filename || `naijahomemade-${video.message_id || video.id}.mp4`);
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showToast("Download started", "success");
      handleSafeClose();
    } catch (err) {
      showToast(err.message || "Download failed. Please try again.", "error");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div 
      style={{
        ...overlayStyle,
        alignItems: isDesktop ? "center" : "flex-end"
      }} 
      onClick={handleSafeClose}
    >
      <div 
        style={{
          ...sheetStyle,
          borderRadius: isDesktop ? "22px" : "24px 24px 0 0",
          border: isDesktop ? "1px solid rgba(255, 255, 255, 0.08)" : "none",
          animation: isDesktop ? "promptFadeScale 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards" : "promptSlideUp 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards"
        }} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Drag Handle Indicator for Mobile */}
        {!isDesktop && (
          <div style={dragHandleWrapper}>
            <div style={dragHandlePill} />
          </div>
        )}

        {/* Options List */}
        <div style={optionsListStyle}>
          {/* Not Interested */}
          <button 
            type="button" 
            style={optionItemStyle} 
            onClick={handleNotInterested}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <div style={iconBoxStyle}>
              <Frown size={18} color="#a1a1aa" />
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
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              <div style={iconBoxStyle}>
                {isFollowing ? (
                  <UserMinus size={18} color="#a1a1aa" />
                ) : (
                  <UserPlus size={18} color="#a1a1aa" />
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
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <div style={iconBoxStyle}>
              <Link2 size={18} color="#a1a1aa" />
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
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <div style={iconBoxStyle}>
              <Share2 size={18} color="#a1a1aa" />
            </div>
            <div style={textWrapperStyle}>
              <span style={itemTitleStyle}>Share post via...</span>
            </div>
          </button>

          {/* Download Video (Non-premium or permitted) */}
          {(!video.category || video.category !== "premium" || isOwner) && (
            <button 
              type="button" 
              style={optionItemStyle} 
              onClick={handleDownloadClick}
              disabled={isDownloading}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              <div style={iconBoxStyle}>
                {isDownloading ? <Loader2 size={18} className="spin-animation" color="#38bdf8" /> : <Download size={18} color="#a1a1aa" />}
              </div>
              <div style={textWrapperStyle}>
                <span style={itemTitleStyle}>{isDownloading ? "Preparing download..." : "Download video"}</span>
              </div>
            </button>
          )}

          {/* Delete Option (for owner or admin) */}
          {isOwner && (
            <button 
              type="button" 
              style={optionItemStyle} 
              onClick={handleDeleteClick}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(244, 33, 46, 0.08)"}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
            >
              <div style={iconBoxStyle}>
                <Trash2 size={18} color="#fb7185" />
              </div>
              <div style={textWrapperStyle}>
                <span style={{ ...itemTitleStyle, color: "#fb7185" }}>Delete post</span>
              </div>
            </button>
          )}

          {/* Report Post */}
          <button 
            type="button" 
            style={optionItemStyle} 
            onClick={handleReportClick}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "rgba(244, 33, 46, 0.08)"}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
          >
            <div style={iconBoxStyle}>
              <Flag size={18} color="#fb7185" />
            </div>
            <div style={textWrapperStyle}>
              <span style={{ ...itemTitleStyle, color: "#fb7185" }}>Report post</span>
            </div>
          </button>
        </div>

        {/* Cancel Button */}
        <div style={cancelWrapperStyle}>
          <button 
            type="button" 
            style={cancelBtnStyle} 
            onClick={handleSafeClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.08)";
              e.currentTarget.style.color = "#f4f4f5";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.04)";
              e.currentTarget.style.color = "#a1a1aa";
            }}
          >
            Cancel
          </button>
        </div>
      </div>

      <style>{`
        @keyframes promptSlideUp {
          from { transform: translateY(100%); opacity: 0.9; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes promptFadeScale {
          from { transform: scale(0.96); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000075,
  backgroundColor: "rgba(0, 0, 0, 0.65)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  display: "flex",
  justifyContent: "center",
  padding: "0"
};

const sheetStyle = {
  width: "100%",
  maxWidth: "400px",
  backgroundColor: "#18181b",
  padding: "14px 16px max(20px, env(safe-area-inset-bottom, 20px))",
  boxSizing: "border-box",
  boxShadow: "0 -10px 40px rgba(0, 0, 0, 0.6), 0 20px 60px rgba(0, 0, 0, 0.7)",
  display: "flex",
  flexDirection: "column"
};

const dragHandleWrapper = {
  width: "100%",
  display: "flex",
  justifyContent: "center",
  paddingBottom: "12px",
  cursor: "grab"
};

const dragHandlePill = {
  width: "36px",
  height: "4px",
  borderRadius: "2px",
  backgroundColor: "rgba(255, 255, 255, 0.16)"
};

const optionsListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "2px",
  marginBottom: "8px"
};

const optionItemStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  width: "100%",
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "11px 12px",
  borderRadius: "12px",
  transition: "all 0.15s ease",
  textAlign: "left"
};

const iconBoxStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "22px",
  flexShrink: 0
};

const textWrapperStyle = {
  display: "flex",
  flexDirection: "column",
  flex: 1
};

const itemTitleStyle = {
  fontSize: "14px",
  fontWeight: "600",
  color: "#f4f4f5",
  letterSpacing: "-0.01em"
};

const cancelWrapperStyle = {
  paddingTop: "4px"
};

const cancelBtnStyle = {
  width: "100%",
  padding: "11px",
  borderRadius: "9999px",
  backgroundColor: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  color: "#a1a1aa",
  fontSize: "13.5px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all 0.15s ease"
};
