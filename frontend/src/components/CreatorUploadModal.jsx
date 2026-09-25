import React, { useState, useRef, useEffect } from "react";
import { 
  X, Film, Lock, Globe, Sparkles, AlertCircle, 
  CheckCircle2, Loader2, Video, ChevronDown, Check,
  Image as ImageIcon
} from "lucide-react";
import { APP_CONFIG } from "../config";
import { showToast } from "../utils/toast";

export default function CreatorUploadModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  defaultCategory = "community",
  user 
}) {
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [caption, setCaption] = useState("");
  const [isVip, setIsVip] = useState(defaultCategory === "premium");
  const [showAudienceMenu, setShowAudienceMenu] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("idle"); // 'idle' | 'uploading' | 'processing' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);
  const [thumbBlob, setThumbBlob] = useState(null);

  // VIP Subscription Price
  const [newPriceInput, setNewPriceInput] = useState("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [currentSubPrice, setCurrentSubPrice] = useState(Number(user?.subscription_price || 0));

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const activeXhrRef = useRef(null);
  const audienceMenuRef = useRef(null);

  useEffect(() => {
    setCurrentSubPrice(Number(user?.subscription_price || 0));
  }, [user?.subscription_price]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setIsVip(defaultCategory === "premium");
      setShowAudienceMenu(false);
      setErrorMessage("");
    } else {
      document.body.style.overflow = "";
      handleReset();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, defaultCategory]);

  // Clean up video object URL
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  // Close audience dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (audienceMenuRef.current && !audienceMenuRef.current.contains(e.target)) {
        setShowAudienceMenu(false);
      }
    };
    if (showAudienceMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAudienceMenu]);

  const captureVideoThumbnail = (file) => {
    return new Promise((resolve) => {
      try {
        const video = document.createElement("video");
        video.preload = "metadata";
        video.playsInline = true;
        video.muted = true;
        const url = URL.createObjectURL(file);
        video.src = url;

        const timer = setTimeout(() => {
          URL.revokeObjectURL(url);
          resolve(null);
        }, 4000);

        video.onloadeddata = () => {
          video.currentTime = Math.min(1.0, video.duration > 0.5 ? 0.5 : 0);
        };

        video.onseeked = () => {
          clearTimeout(timer);
          try {
            const canvas = document.createElement("canvas");
            const maxDim = 640;
            let width = video.videoWidth || 640;
            let height = video.videoHeight || 360;
            if (width > maxDim) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            }
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(video, 0, 0, width, height);

            canvas.toBlob((blob) => {
              URL.revokeObjectURL(url);
              resolve(blob);
            }, "image/jpeg", 0.85);
          } catch (e) {
            URL.revokeObjectURL(url);
            resolve(null);
          }
        };

        video.onerror = () => {
          clearTimeout(timer);
          URL.revokeObjectURL(url);
          resolve(null);
        };
      } catch (err) {
        resolve(null);
      }
    });
  };

  const handleReset = () => {
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setThumbBlob(null);
    setCaption("");
    setUploadProgress(0);
    setUploadStatus("idle");
    setErrorMessage("");
    setShowAudienceMenu(false);
    if (activeXhrRef.current) {
      activeXhrRef.current.abort();
      activeXhrRef.current = null;
    }
  };

  const handleFileSelect = (file) => {
    if (!file) return;

    if (!file.type.startsWith("video/")) {
      setErrorMessage("Please select a valid video file (MP4, MOV, WebM).");
      return;
    }

    const maxSizeBytes = 500 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setErrorMessage("File exceeds 500MB limit. Please choose a smaller video.");
      return;
    }

    setErrorMessage("");
    setVideoFile(file);
    setThumbBlob(null);

    // Asynchronously capture thumbnail in browser
    captureVideoThumbnail(file).then((blob) => {
      if (blob) setThumbBlob(blob);
    });

    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    const previewUrl = URL.createObjectURL(file);
    setVideoPreviewUrl(previewUrl);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleSavePrice = async () => {
    const val = Math.max(1, Number(newPriceInput) || 0);
    if (val <= 0) return;
    setSavingPrice(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/profile`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ subscription_price: val })
      });
      if (res.ok) {
        setCurrentSubPrice(val);
        if (user) user.subscription_price = val;
        showToast(`Monthly VIP subscription fee set to $${val}!`, "success");
        window.dispatchEvent(new CustomEvent("refreshUser"));
      } else {
        const errData = await res.json().catch(() => ({}));
        showToast(errData.error || "Failed to set subscription price", "error");
      }
    } catch (e) {
      showToast("Network error setting price", "error");
    } finally {
      setSavingPrice(false);
    }
  };

  const handleCaptionChange = (e) => {
    const val = e.target.value.slice(0, 500);
    setCaption(val);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.max(72, textareaRef.current.scrollHeight)}px`;
    }
  };

  const handleUploadSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!videoFile) {
      setErrorMessage("Please choose a video to post.");
      return;
    }

    if (isVip && currentSubPrice <= 0) {
      setErrorMessage("Please set your monthly subscription fee before posting VIP Exclusive drops.");
      return;
    }

    setErrorMessage("");
    setUploadStatus("uploading");
    setUploadProgress(0);

    const token = localStorage.getItem("token");
    if (!token) {
      setErrorMessage("You must be logged in to post.");
      setUploadStatus("error");
      return;
    }

    try {
      // 1. Request presigned upload URLs directly to Cloudflare R2
      const presignedRes = await fetch(`${APP_CONFIG.apiUrl}/api/creator/presigned-url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          filename: videoFile.name,
          filetype: videoFile.type || "video/mp4",
          category: isVip ? "premium" : "community",
          is_premium: isVip
        })
      });

      if (!presignedRes.ok) {
        const errData = await presignedRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to initialize cloud upload.");
      }

      const { videoUploadUrl, thumbUploadUrl, internalId, safeCategory, r2Key, thumbKey } = await presignedRes.json();

      // 2. Upload video file DIRECTLY to Cloudflare R2 (Bypasses VPS middleman)
      const xhr = new XMLHttpRequest();
      activeXhrRef.current = xhr;

      xhr.upload.addEventListener("progress", (event) => {
        if (event.lengthComputable) {
          // Scale progress 0% to 92% for video bytes arriving at Cloudflare Edge
          const percent = Math.round((event.loaded / event.total) * 92);
          setUploadProgress(percent);
          if (percent >= 90) {
            setUploadStatus("processing");
          }
        }
      });

      await new Promise((resolve, reject) => {
        xhr.onload = () => {
          activeXhrRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Cloud upload rejected with status ${xhr.status}.`));
          }
        };
        xhr.onerror = () => {
          activeXhrRef.current = null;
          reject(new Error("Network error during direct cloud upload. Check your connection."));
        };
        xhr.onabort = () => {
          activeXhrRef.current = null;
          reject(new Error("Upload cancelled."));
        };

        xhr.open("PUT", videoUploadUrl);
        xhr.setRequestHeader("Content-Type", videoFile.type || "video/mp4");
        xhr.send(videoFile);
      });

      // 3. Upload thumbnail directly to Cloudflare R2 if available (instant ~50KB)
      if (thumbBlob && thumbUploadUrl) {
        try {
          await fetch(thumbUploadUrl, {
            method: "PUT",
            headers: { "Content-Type": "image/jpeg" },
            body: thumbBlob
          });
        } catch (tErr) {
          console.warn("[UPLOAD] Thumbnail upload warning (non-fatal):", tErr);
        }
      }

      // 4. Finalize & register video in database (instant ~20ms call)
      setUploadProgress(97);
      const completeRes = await fetch(`${APP_CONFIG.apiUrl}/api/creator/complete-upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          internalId,
          category: safeCategory,
          is_premium: isVip,
          caption: caption.trim(),
          r2Key,
          thumbKey
        })
      });

      if (!completeRes.ok) {
        const completeErr = await completeRes.json().catch(() => ({}));
        throw new Error(completeErr.error || "Failed to register video.");
      }

      const completeData = await completeRes.json();
      setUploadStatus("success");
      setUploadProgress(100);

      if (onSuccess) {
        onSuccess(completeData.video);
      }

      setTimeout(() => {
        onClose();
        handleReset();
      }, 1200);

    } catch (err) {
      console.error("[DIRECT R2 UPLOAD ERROR]", err);
      setErrorMessage(err.message || "Failed to post video. Please try again.");
      setUploadStatus("error");
    }
  };

  if (!isOpen) return null;

  const isUploading = uploadStatus === "uploading" || uploadStatus === "processing";
  const canPost = videoFile && !isUploading && !(isVip && currentSubPrice <= 0);

  return (
    <div style={backdropContainerStyle}>
      <div style={modalWindowStyle}>
        
        {/* Top Header Bar (X Style) */}
        <div style={headerBarStyle}>
          <button 
            type="button" 
            onClick={onClose} 
            disabled={isUploading}
            style={closeIconButtonStyle}
            aria-label="Close"
          >
            <X size={20} color="#ffffff" />
          </button>

          <div style={headerCenterTitleStyle}>
            {isUploading ? (
              <span style={{ fontSize: "14px", color: "#8e8e93", fontWeight: "600" }}>
                {uploadStatus === "uploading" ? `Posting (${uploadProgress}%)...` : "Finalizing..."}
              </span>
            ) : null}
          </div>

          {/* X-Style Pill "Post" Button */}
          <button
            type="button"
            onClick={handleUploadSubmit}
            disabled={!canPost}
            style={{
              ...postPillButtonStyle,
              backgroundColor: canPost ? "#ffffff" : "rgba(255, 255, 255, 0.2)",
              color: canPost ? "#000000" : "rgba(255, 255, 255, 0.4)",
              cursor: canPost ? "pointer" : "not-allowed"
            }}
          >
            {isUploading ? (
              <>
                <Loader2 size={14} className="animate-spin" color="#000000" />
                <span>Posting</span>
              </>
            ) : (
              <span>Post</span>
            )}
          </button>
        </div>

        {/* Upload Progress Bar (Thin X-style line at top) */}
        {isUploading && (
          <div style={progressTrackStyle}>
            <div 
              style={{
                ...progressBarFillStyle,
                width: `${uploadProgress}%`,
                backgroundColor: isVip ? "#FFD700" : "#ffffff"
              }} 
            />
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div style={errorBannerStyle}>
            <AlertCircle size={16} color="#ff453a" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{errorMessage}</span>
            <button 
              type="button" 
              onClick={() => setErrorMessage("")} 
              style={{ background: "none", border: "none", color: "#888", cursor: "pointer", padding: "2px" }}
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Success Screen */}
        {uploadStatus === "success" ? (
          <div style={successWrapperStyle}>
            <div style={successIconCircleStyle}>
              <CheckCircle2 size={44} color="#ffffff" />
            </div>
            <h3 style={{ color: "#ffffff", fontSize: "19px", fontWeight: "800", margin: "16px 0 6px 0" }}>
              Your post was sent!
            </h3>
            <p style={{ color: "#71767b", fontSize: "13.5px", margin: 0, textAlign: "center" }}>
              Published to {isVip ? "VIP Subscribers" : "Community"}.
            </p>
          </div>
        ) : (
          /* Composer Body */
          <div style={composerScrollAreaStyle}>
            <div style={composerLayoutRowStyle}>
              {/* Left: User Avatar */}
              <div style={avatarColumnStyle}>
                <div style={avatarCircleStyle}>
                  <img 
                    src={user?.avatar_url || "/assets/default-avatar.png"} 
                    alt=""
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                  />
                </div>
              </div>

              {/* Right: Composer Content */}
              <div style={composerMainColumnStyle}>
                
                {/* Audience Selector Pill (Everyone / Community vs VIP) */}
                <div style={{ position: "relative", marginBottom: "12px" }} ref={audienceMenuRef}>
                  <button
                    type="button"
                    onClick={() => {
                      if (!isUploading) setShowAudienceMenu(!showAudienceMenu);
                    }}
                    style={{
                      ...audiencePillStyle,
                      borderColor: isVip ? "rgba(255, 215, 0, 0.4)" : "#333336",
                      color: isVip ? "#FFD700" : "#ffffff"
                    }}
                  >
                    {isVip ? (
                      <>
                        <Lock size={12} color="#FFD700" />
                        <span>VIP Subscribers</span>
                      </>
                    ) : (
                      <>
                        <Globe size={12} color="#ffffff" />
                        <span>Everyone</span>
                      </>
                    )}
                    <ChevronDown size={12} color={isVip ? "#FFD700" : "#8e8e93"} />
                  </button>

                  {/* Audience Dropdown Popover */}
                  {showAudienceMenu && (
                    <div style={audienceDropdownStyle}>
                      <div style={dropdownTitleStyle}>Choose audience</div>

                      {/* Public Community Option */}
                      <div 
                        style={{
                          ...dropdownOptionStyle,
                          backgroundColor: !isVip ? "rgba(255, 255, 255, 0.06)" : "transparent"
                        }}
                        onClick={() => {
                          setIsVip(false);
                          setShowAudienceMenu(false);
                        }}
                      >
                        <div style={dropdownOptionIconStyle}>
                          <Globe size={18} color="#ffffff" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "14px", fontWeight: "700", color: "#ffffff" }}>
                            Everyone
                          </div>
                          <div style={{ fontSize: "12px", color: "#71767b", marginTop: "2px" }}>
                            Community feed • Free for all viewers
                          </div>
                        </div>
                        {!isVip && <Check size={16} color="#ffffff" />}
                      </div>

                      {/* VIP Subscribers Option */}
                      <div 
                        style={{
                          ...dropdownOptionStyle,
                          backgroundColor: isVip ? "rgba(255, 215, 0, 0.08)" : "transparent"
                        }}
                        onClick={() => {
                          setIsVip(true);
                          setShowAudienceMenu(false);
                        }}
                      >
                        <div style={{ ...dropdownOptionIconStyle, backgroundColor: "rgba(255, 215, 0, 0.15)" }}>
                          <Lock size={18} color="#FFD700" />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "14px", fontWeight: "700", color: "#ffffff" }}>
                              VIP Subscribers
                            </span>
                            <span style={monetizedBadgeStyle}>VIP</span>
                          </div>
                          <div style={{ fontSize: "12px", color: "#71767b", marginTop: "2px" }}>
                            Locked for paying members and subscribers
                          </div>
                        </div>
                        {isVip && <Check size={16} color="#FFD700" />}
                      </div>
                    </div>
                  )}
                </div>

                {/* Seamless Borderless Textarea */}
                <textarea
                  ref={textareaRef}
                  value={caption}
                  onChange={handleCaptionChange}
                  placeholder="What is happening?!"
                  disabled={isUploading}
                  rows={2}
                  style={seamlessTextareaStyle}
                />

                {/* VIP Subscription Price Inline Requirement (if VIP selected) */}
                {isVip && (
                  <div style={vipInlineCardStyle}>
                    {currentSubPrice > 0 ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Sparkles size={14} color="#FFD700" style={{ flexShrink: 0 }} />
                        <span style={{ fontSize: "12.5px", color: "#ffd700", lineHeight: "1.4" }}>
                          Locked for your VIP subscribers (${currentSubPrice}/month). Free viewers will see a lock screen.
                        </span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <AlertCircle size={15} color="#ff453a" />
                          <span style={{ fontSize: "13px", fontWeight: "700", color: "#ff453a" }}>
                            Subscription Price Required
                          </span>
                        </div>
                        <p style={{ fontSize: "12px", color: "#aaa", margin: 0 }}>
                          Set your monthly pass fee to monetize this VIP video.
                        </p>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                          <div style={currencyInputWrapperStyle}>
                            <span style={{ color: "#71767b", fontSize: "14px" }}>$</span>
                            <input 
                              type="number"
                              min="1"
                              max="1000"
                              placeholder="10"
                              value={newPriceInput}
                              onChange={(e) => setNewPriceInput(e.target.value)}
                              style={priceInputStyle}
                            />
                            <span style={{ color: "#71767b", fontSize: "12px" }}>/mo</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleSavePrice}
                            disabled={savingPrice || !newPriceInput || Number(newPriceInput) <= 0}
                            style={savePriceBtnStyle}
                          >
                            {savingPrice ? "Saving..." : "Set Price"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Video Attachment Box */}
                {!videoFile ? (
                  /* Video Picker / Dropzone */
                  <div 
                    style={{
                      ...videoDropzoneStyle,
                      borderColor: isDragOver ? "#ffffff" : "#222224",
                      backgroundColor: isDragOver ? "rgba(255, 255, 255, 0.04)" : "#0c0c0e"
                    }}
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={(e) => { e.preventDefault(); setIsDragOver(false); }}
                    onClick={() => {
                      if (!isUploading) fileInputRef.current?.click();
                    }}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      accept="video/mp4,video/quicktime,video/webm,video/*" 
                      style={{ display: "none" }} 
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          handleFileSelect(e.target.files[0]);
                        }
                      }}
                    />
                    <div style={mediaUploadIconCircleStyle}>
                      <Video size={24} color="#ffffff" />
                    </div>
                    <div style={{ textAlign: "center", marginTop: "10px" }}>
                      <span style={{ fontSize: "14px", fontWeight: "700", color: "#ffffff" }}>
                        Add video
                      </span>
                      <p style={{ fontSize: "12px", color: "#71767b", margin: "4px 0 0 0" }}>
                        Drag & drop or tap to browse • MP4, MOV, WebM up to 500MB
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Video Attached Preview with floating X remove button */
                  <div style={videoPreviewCardStyle}>
                    <div style={videoPlayerWrapperStyle}>
                      <video 
                        src={videoPreviewUrl} 
                        controls 
                        playsInline 
                        style={videoElementStyle}
                      />
                      
                      {/* Floating circular 'X' remove button (top-right of media) */}
                      {!isUploading && (
                        <button 
                          type="button" 
                          onClick={handleReset} 
                          style={floatingRemoveBtnStyle}
                          title="Remove video"
                          aria-label="Remove video"
                        >
                          <X size={16} color="#ffffff" />
                        </button>
                      )}
                    </div>

                    {/* Metadata strip below video */}
                    <div style={videoMetaStripStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                        <Film size={14} color="#8e8e93" style={{ flexShrink: 0 }} />
                        <span style={videoFileNameStyle}>
                          {videoFile.name}
                        </span>
                      </div>
                      <span style={{ fontSize: "11.5px", color: "#71767b", flexShrink: 0, fontWeight: "600" }}>
                        {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                      </span>
                    </div>
                  </div>
                )}

                {/* Bottom Toolbar & Character Count */}
                <div style={bottomToolbarStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    {!videoFile && (
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploading}
                        style={toolbarIconBtnStyle}
                        title="Add Video"
                        aria-label="Add Video"
                      >
                        <Video size={19} color="#ffffff" />
                      </button>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {caption.length > 0 && (
                      <span style={{ 
                        fontSize: "12px", 
                        color: caption.length > 450 ? "#ff453a" : "#71767b",
                        fontWeight: "500"
                      }}>
                        {500 - caption.length}
                      </span>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ---------------- AMOLED MONOCHROME X-STYLE ----------------
const backdropContainerStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 100000,
  backgroundColor: "rgba(0, 0, 0, 0.85)",
  backdropFilter: "blur(6px)",
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "center",
  overflowY: "auto",
  animation: "fadeIn 0.15s ease-out"
};

const modalWindowStyle = {
  width: "100%",
  maxWidth: "600px",
  minHeight: "100vh",
  backgroundColor: "#000000",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  boxSizing: "border-box"
};

const headerBarStyle = {
  height: "54px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 16px",
  borderBottom: "1px solid #1f1f1f",
  backgroundColor: "#000000",
  position: "sticky",
  top: 0,
  zIndex: 50,
  flexShrink: 0
};

const closeIconButtonStyle = {
  background: "none",
  border: "none",
  color: "#ffffff",
  cursor: "pointer",
  padding: "8px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background-color 0.15s ease"
};

const headerCenterTitleStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const postPillButtonStyle = {
  border: "none",
  borderRadius: "9999px",
  padding: "7px 18px",
  fontSize: "14px",
  fontWeight: "700",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  letterSpacing: "0.2px",
  transition: "all 0.15s ease"
};

const progressTrackStyle = {
  width: "100%",
  height: "3px",
  backgroundColor: "#1c1c1e",
  position: "sticky",
  top: "54px",
  zIndex: 51,
  overflow: "hidden"
};

const progressBarFillStyle = {
  height: "100%",
  transition: "width 0.2s ease"
};

const errorBannerStyle = {
  margin: "12px 16px 0 16px",
  padding: "10px 14px",
  backgroundColor: "rgba(255, 69, 58, 0.12)",
  border: "1px solid rgba(255, 69, 58, 0.25)",
  borderRadius: "10px",
  color: "#ff453a",
  fontSize: "13px",
  display: "flex",
  alignItems: "center",
  gap: "10px"
};

const successWrapperStyle = {
  padding: "60px 24px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center"
};

const successIconCircleStyle = {
  width: "68px",
  height: "68px",
  borderRadius: "50%",
  backgroundColor: "rgba(255, 255, 255, 0.1)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const composerScrollAreaStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  padding: "16px 16px 40px",
  boxSizing: "border-box"
};

const composerLayoutRowStyle = {
  display: "flex",
  gap: "12px",
  alignItems: "flex-start"
};

const avatarColumnStyle = {
  flexShrink: 0
};

const avatarCircleStyle = {
  width: "42px",
  height: "42px",
  borderRadius: "50%",
  overflow: "hidden",
  backgroundColor: "#161618",
  border: "1px solid #262628"
};

const composerMainColumnStyle = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column"
};

const audiencePillStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  background: "transparent",
  border: "1px solid",
  borderRadius: "9999px",
  padding: "4px 12px",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
  transition: "all 0.15s ease"
};

const audienceDropdownStyle = {
  position: "absolute",
  top: "36px",
  left: 0,
  zIndex: 100,
  width: "280px",
  backgroundColor: "#0d0d0f",
  border: "1px solid #2a2a2c",
  borderRadius: "14px",
  boxShadow: "0 10px 30px rgba(0, 0, 0, 0.8)",
  padding: "8px",
  display: "flex",
  flexDirection: "column",
  gap: "4px"
};

const dropdownTitleStyle = {
  padding: "6px 10px 4px",
  fontSize: "12px",
  fontWeight: "700",
  color: "#71767b",
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

const dropdownOptionStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "8px 10px",
  borderRadius: "10px",
  cursor: "pointer",
  transition: "background-color 0.15s ease"
};

const dropdownOptionIconStyle = {
  width: "32px",
  height: "32px",
  borderRadius: "50%",
  backgroundColor: "#1c1c1f",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0
};

const monetizedBadgeStyle = {
  fontSize: "9px",
  fontWeight: "800",
  backgroundColor: "rgba(255, 215, 0, 0.2)",
  color: "#FFD700",
  padding: "1px 5px",
  borderRadius: "4px"
};

const seamlessTextareaStyle = {
  width: "100%",
  backgroundColor: "transparent",
  border: "none",
  outline: "none",
  color: "#ffffff",
  fontSize: "18px",
  lineHeight: "1.4",
  resize: "none",
  fontFamily: "inherit",
  padding: "6px 0",
  boxSizing: "border-box",
  minHeight: "72px"
};

const vipInlineCardStyle = {
  marginTop: "4px",
  marginBottom: "12px",
  padding: "10px 12px",
  backgroundColor: "#121214",
  border: "1px solid rgba(255, 215, 0, 0.25)",
  borderRadius: "12px"
};

const currencyInputWrapperStyle = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  backgroundColor: "#1c1c1e",
  border: "1px solid #333336",
  borderRadius: "8px",
  padding: "4px 8px"
};

const priceInputStyle = {
  width: "60px",
  background: "none",
  border: "none",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "700",
  outline: "none"
};

const savePriceBtnStyle = {
  padding: "6px 14px",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "#FFD700",
  color: "#000000",
  fontWeight: "800",
  fontSize: "12.5px",
  cursor: "pointer"
};

const videoDropzoneStyle = {
  border: "1px dashed #333336",
  borderRadius: "16px",
  padding: "36px 16px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.15s ease",
  marginTop: "8px"
};

const mediaUploadIconCircleStyle = {
  width: "48px",
  height: "48px",
  borderRadius: "50%",
  backgroundColor: "#1c1c1f",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const videoPreviewCardStyle = {
  marginTop: "8px",
  borderRadius: "16px",
  backgroundColor: "#0a0a0c",
  border: "1px solid #222224",
  overflow: "hidden"
};

const videoPlayerWrapperStyle = {
  position: "relative",
  width: "100%",
  maxHeight: "360px",
  backgroundColor: "#000000",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const videoElementStyle = {
  width: "100%",
  maxHeight: "360px",
  objectFit: "contain"
};

const floatingRemoveBtnStyle = {
  position: "absolute",
  top: "10px",
  right: "10px",
  zIndex: 10,
  width: "32px",
  height: "32px",
  borderRadius: "50%",
  backgroundColor: "rgba(0, 0, 0, 0.75)",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  color: "#ffffff",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "transform 0.15s ease, background-color 0.15s ease"
};

const videoMetaStripStyle = {
  padding: "8px 12px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderTop: "1px solid #1a1a1c",
  backgroundColor: "#0d0d0f"
};

const videoFileNameStyle = {
  fontSize: "12px",
  fontWeight: "600",
  color: "#d0d0d0",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: "280px"
};

const bottomToolbarStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  marginTop: "14px",
  paddingTop: "10px",
  borderTop: "1px solid #18181a"
};

const toolbarIconBtnStyle = {
  background: "none",
  border: "none",
  color: "#ffffff",
  cursor: "pointer",
  padding: "6px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "opacity 0.15s ease"
};
