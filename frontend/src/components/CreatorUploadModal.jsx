import React, { useState, useRef, useEffect } from "react";
import { 
  X, UploadCloud, Film, Lock, Globe, Sparkles, AlertCircle, 
  CheckCircle2, Loader2, Play, Trash2, ShieldCheck, Flame, 
  GraduationCap, Zap, Video
} from "lucide-react";
import { APP_CONFIG } from "../config";

const PUBLIC_CATEGORIES = [
  { id: "hotties", label: "Hotties", icon: Flame, desc: "Trending & popular model drops" },
  { id: "amateur", label: "Amateur", icon: Video, desc: "Real, raw, and authentic clips" },
  { id: "college", label: "College", icon: GraduationCap, desc: "Campus vibes & lifestyle" },
  { id: "trends", label: "Trends", icon: Zap, desc: "Viral challenges & reels" },
  { id: "shots", label: "Shots", icon: Film, desc: "Vertical short-form highlights" }
];

export default function CreatorUploadModal({ 
  isOpen, 
  onClose, 
  onSuccess, 
  defaultCategory = "hotties",
  user 
}) {
  const [videoFile, setVideoFile] = useState(null);
  const [videoPreviewUrl, setVideoPreviewUrl] = useState(null);
  const [caption, setCaption] = useState("");
  const [isVip, setIsVip] = useState(defaultCategory === "premium");
  const [publicCategory, setPublicCategory] = useState(
    defaultCategory !== "premium" ? defaultCategory : "hotties"
  );
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState("idle"); // 'idle' | 'uploading' | 'processing' | 'success' | 'error'
  const [errorMessage, setErrorMessage] = useState("");
  const [isDragOver, setIsDragOver] = useState(false);

  const fileInputRef = useRef(null);
  const activeXhrRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setIsVip(defaultCategory === "premium");
      if (defaultCategory !== "premium") {
        setPublicCategory(defaultCategory);
      }
    } else {
      document.body.style.overflow = "";
      handleReset();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, defaultCategory]);

  // Clean up object URL when component unmounts or file changes
  useEffect(() => {
    return () => {
      if (videoPreviewUrl) {
        URL.revokeObjectURL(videoPreviewUrl);
      }
    };
  }, [videoPreviewUrl]);

  const handleReset = () => {
    if (videoPreviewUrl) {
      URL.revokeObjectURL(videoPreviewUrl);
    }
    setVideoFile(null);
    setVideoPreviewUrl(null);
    setCaption("");
    setUploadProgress(0);
    setUploadStatus("idle");
    setErrorMessage("");
    if (activeXhrRef.current) {
      activeXhrRef.current.abort();
      activeXhrRef.current = null;
    }
  };

  const handleFileSelect = (file) => {
    if (!file) return;

    // Validate type
    if (!file.type.startsWith("video/")) {
      setErrorMessage("Please select a valid video file (MP4, MOV, WebM, etc.)");
      return;
    }

    // Validate size (500MB max)
    const maxSizeBytes = 500 * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setErrorMessage("File size exceeds 500MB limit. Please compress or choose a smaller video.");
      return;
    }

    setErrorMessage("");
    setVideoFile(file);

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

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!videoFile) {
      setErrorMessage("Please select a video to upload.");
      return;
    }

    setErrorMessage("");
    setUploadStatus("uploading");
    setUploadProgress(0);

    const token = localStorage.getItem("token");
    if (!token) {
      setErrorMessage("You must be logged in to upload videos.");
      setUploadStatus("error");
      return;
    }

    const formData = new FormData();
    formData.append("video", videoFile);
    formData.append("caption", caption.trim());
    formData.append("is_premium", isVip ? "true" : "false");
    formData.append("category", isVip ? "premium" : publicCategory);

    const xhr = new XMLHttpRequest();
    activeXhrRef.current = xhr;

    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) {
        const percent = Math.round((event.loaded / event.total) * 100);
        setUploadProgress(percent);
        if (percent >= 100) {
          setUploadStatus("processing");
        }
      }
    });

    xhr.onreadystatechange = () => {
      if (xhr.readyState === XMLHttpRequest.DONE) {
        activeXhrRef.current = null;
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const data = JSON.parse(xhr.responseText);
            setUploadStatus("success");
            setUploadProgress(100);

            if (onSuccess) {
              onSuccess(data.video);
            }

            // Auto close modal after brief delay
            setTimeout(() => {
              onClose();
              handleReset();
            }, 1600);
          } catch (jsonErr) {
            setErrorMessage("Unexpected response from server.");
            setUploadStatus("error");
          }
        } else {
          try {
            const errData = JSON.parse(xhr.responseText);
            setErrorMessage(errData.error || "Failed to upload video. Please try again.");
          } catch (e) {
            setErrorMessage(`Upload failed with status code ${xhr.status}.`);
          }
          setUploadStatus("error");
        }
      }
    };

    xhr.onerror = () => {
      activeXhrRef.current = null;
      setErrorMessage("Network error during upload. Please check your connection.");
      setUploadStatus("error");
    };

    xhr.open("POST", `${APP_CONFIG.apiUrl}/api/creator/upload`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.send(formData);
  };

  if (!isOpen) return null;

  return (
    <div style={overlayStyle} onClick={uploadStatus === "uploading" || uploadStatus === "processing" ? undefined : onClose}>
      <div 
        style={modalContainerStyle} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={headerIconStyle}>
              <UploadCloud size={20} color="var(--primary-color, #00aff0)" />
            </div>
            <div>
              <h2 style={titleStyle}>Upload Creator Video</h2>
              <p style={subtitleStyle}>Publish to Cloudflare R2: Public Feed or VIP Exclusive Channel</p>
            </div>
          </div>
          {uploadStatus !== "uploading" && uploadStatus !== "processing" && (
            <button onClick={onClose} style={closeBtnStyle} aria-label="Close">
              <X size={20} color="#8e8e93" />
            </button>
          )}
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div style={errorBannerStyle}>
            <AlertCircle size={18} color="#ff3b30" style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Upload State = Success */}
        {uploadStatus === "success" ? (
          <div style={successContainerStyle}>
            <div style={successIconCircle}>
              <CheckCircle2 size={48} color="#00d084" />
            </div>
            <h3 style={{ color: "#fff", fontSize: "20px", fontWeight: "800", margin: "16px 0 6px 0" }}>
              Video Uploaded!
            </h3>
            <p style={{ color: "#8e8e93", fontSize: "14px", margin: 0, textAlign: "center", maxWidth: "340px" }}>
              Your {isVip ? "VIP Exclusive" : publicCategory} video has been uploaded to Cloudflare R2 and published to your profile.
            </p>
          </div>
        ) : (
          <form onSubmit={handleUploadSubmit} style={formBodyStyle}>
            {/* Step 1: File Dropzone / Video Preview */}
            {!videoFile ? (
              <div 
                style={{
                  ...dropzoneStyle,
                  borderColor: isDragOver ? "var(--primary-color, #00aff0)" : "#333",
                  backgroundColor: isDragOver ? "rgba(0, 175, 240, 0.08)" : "#161618"
                }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
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
                <div style={uploadIconCircle}>
                  <UploadCloud size={32} color="#00aff0" />
                </div>
                <div style={{ textAlign: "center", marginTop: "12px" }}>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: "#fff" }}>
                    Select video to upload
                  </div>
                  <div style={{ fontSize: "12.5px", color: "#8e8e93", marginTop: "4px" }}>
                    Or drag and drop video files here
                  </div>
                  <div style={{ fontSize: "11px", color: "#636366", marginTop: "8px" }}>
                    MP4, MOV, WebM up to 500MB • Cloudflare R2 High-Speed Storage
                  </div>
                </div>
              </div>
            ) : (
              <div style={previewBoxStyle}>
                <div style={videoWrapperStyle}>
                  <video 
                    src={videoPreviewUrl} 
                    controls 
                    playsInline 
                    style={videoElementStyle}
                  />
                </div>
                <div style={fileInfoRowStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                    <Film size={18} color="#00aff0" style={{ flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={fileNameStyle}>
                        {videoFile.name}
                      </div>
                      <div style={{ fontSize: "11px", color: "#8e8e93" }}>
                        {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                      </div>
                    </div>
                  </div>
                  {uploadStatus === "idle" && (
                    <button 
                      type="button" 
                      onClick={handleReset} 
                      style={removeFileBtnStyle}
                      title="Remove file"
                    >
                      <Trash2 size={15} color="#ff3b30" />
                      <span>Change</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Step 2: Post Caption / Title */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Caption / Title</label>
              <textarea 
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, 500))}
                placeholder="What's this video about? Add tags or description..."
                style={textareaStyle}
                rows={3}
                disabled={uploadStatus === "uploading" || uploadStatus === "processing"}
              />
              <div style={charCountStyle}>{caption.length} / 500</div>
            </div>

            {/* Step 3: Visibility & Audience (Public vs VIP Exclusive) */}
            <div style={fieldGroupStyle}>
              <label style={labelStyle}>Visibility & Audience</label>
              <div style={visibilityGridStyle}>
                {/* Public Option */}
                <div 
                  style={{
                    ...visibilityCardStyle,
                    borderColor: !isVip ? "var(--primary-color, #00aff0)" : "#2c2c2e",
                    backgroundColor: !isVip ? "rgba(0, 175, 240, 0.08)" : "#18181a"
                  }}
                  onClick={() => {
                    if (uploadStatus === "idle") setIsVip(false);
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <div style={{
                      ...visIconBox,
                      backgroundColor: !isVip ? "rgba(0, 175, 240, 0.2)" : "#262628"
                    }}>
                      <Globe size={18} color={!isVip ? "#00aff0" : "#8e8e93"} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>
                        Public Feed
                      </div>
                      <div style={{ fontSize: "11.5px", color: "#8e8e93", marginTop: "2px", lineHeight: "1.35" }}>
                        Free for all viewers. Boosts your reach and follower growth.
                      </div>
                    </div>
                  </div>
                </div>

                {/* VIP Exclusive Option */}
                <div 
                  style={{
                    ...visibilityCardStyle,
                    borderColor: isVip ? "#FFD700" : "#2c2c2e",
                    backgroundColor: isVip ? "rgba(255, 215, 0, 0.08)" : "#18181a"
                  }}
                  onClick={() => {
                    if (uploadStatus === "idle") setIsVip(true);
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <div style={{
                      ...visIconBox,
                      backgroundColor: isVip ? "rgba(255, 215, 0, 0.2)" : "#262628"
                    }}>
                      <Lock size={18} color={isVip ? "#FFD700" : "#8e8e93"} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>
                          VIP Exclusive
                        </span>
                        <span style={vipTagStyle}>MONETIZED</span>
                      </div>
                      <div style={{ fontSize: "11.5px", color: "#8e8e93", marginTop: "2px", lineHeight: "1.35" }}>
                        Locked for your VIP subscribers and paying members only.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* VIP Note if selected */}
              {isVip ? (
                <div style={vipNoticeBoxStyle}>
                  <Sparkles size={14} color="#FFD700" style={{ flexShrink: 0 }} />
                  <span style={{ fontSize: "12px", color: "#ffd700", lineHeight: "1.4" }}>
                    Subscribers to your VIP pass (₦{Number(user?.subscription_price || 15000).toLocaleString()}/month) will get instant access. Free viewers will see a lock screen with a prompt to subscribe.
                  </span>
                </div>
              ) : (
                /* Public category pills */
                <div style={{ marginTop: "12px" }}>
                  <span style={{ fontSize: "12px", color: "#8e8e93", display: "block", marginBottom: "8px" }}>
                    Select Feed Category:
                  </span>
                  <div style={categoryChipsRow}>
                    {PUBLIC_CATEGORIES.map(cat => {
                      const Icon = cat.icon;
                      const isSelected = publicCategory === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            if (uploadStatus === "idle") setPublicCategory(cat.id);
                          }}
                          style={{
                            ...chipBtnStyle,
                            backgroundColor: isSelected ? "rgba(0, 175, 240, 0.15)" : "#1e1e20",
                            borderColor: isSelected ? "#00aff0" : "#333",
                            color: isSelected ? "#00aff0" : "#ccc"
                          }}
                        >
                          <Icon size={13} />
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Upload Progress Bar */}
            {(uploadStatus === "uploading" || uploadStatus === "processing") && (
              <div style={progressBoxStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#ccc", marginBottom: "6px" }}>
                  <span>
                    {uploadStatus === "uploading" 
                      ? `Uploading video... (${uploadProgress}%)` 
                      : "Storing & finalizing on Cloudflare R2..."}
                  </span>
                  <span>{uploadProgress}%</span>
                </div>
                <div style={progressBarTrack}>
                  <div 
                    style={{
                      ...progressBarFill,
                      width: `${uploadProgress}%`,
                      background: isVip 
                        ? "linear-gradient(90deg, #FFD700, #ffae00)" 
                        : "linear-gradient(90deg, #00aff0, var(--primary-color, #0088cc))"
                    }} 
                  />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", fontSize: "11px", color: "#8e8e93" }}>
                  <Loader2 size={13} className="animate-spin" color={isVip ? "#FFD700" : "#00aff0"} />
                  <span>Please keep this window open while the upload completes.</span>
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
              {uploadStatus === "idle" && (
                <button 
                  type="button" 
                  onClick={onClose} 
                  style={cancelBtnStyle}
                >
                  Cancel
                </button>
              )}
              <button
                type="submit"
                disabled={!videoFile || uploadStatus === "uploading" || uploadStatus === "processing"}
                style={{
                  ...submitBtnStyle,
                  opacity: (!videoFile || uploadStatus === "uploading" || uploadStatus === "processing") ? 0.6 : 1,
                  background: isVip 
                    ? "linear-gradient(135deg, #FFD700, #ffae00)" 
                    : "linear-gradient(135deg, #00aff0, #0088cc)",
                  color: isVip ? "#000" : "#fff"
                }}
              >
                {uploadStatus === "uploading" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Uploading ({uploadProgress}%)...</span>
                  </>
                ) : uploadStatus === "processing" ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Finalizing Video...</span>
                  </>
                ) : (
                  <>
                    <UploadCloud size={16} />
                    <span>Publish {isVip ? "VIP Exclusive" : "Public"} Video</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

// ---------------- STYLES ----------------
const overlayStyle = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.85)",
  backdropFilter: "blur(8px)",
  WebkitBackdropFilter: "blur(8px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
  padding: "16px"
};

const modalContainerStyle = {
  width: "100%",
  maxWidth: "520px",
  backgroundColor: "#121214",
  border: "1px solid #28282b",
  borderRadius: "20px",
  boxShadow: "0 24px 60px rgba(0, 0, 0, 0.7)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  maxHeight: "90vh"
};

const headerStyle = {
  padding: "18px 22px",
  borderBottom: "1px solid #222",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between"
};

const headerIconStyle = {
  width: "36px",
  height: "36px",
  borderRadius: "10px",
  backgroundColor: "rgba(0, 175, 240, 0.12)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const titleStyle = {
  margin: 0,
  fontSize: "17px",
  fontWeight: "800",
  color: "#fff",
  letterSpacing: "-0.2px"
};

const subtitleStyle = {
  margin: "2px 0 0 0",
  fontSize: "12px",
  color: "#8e8e93"
};

const closeBtnStyle = {
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "6px",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const formBodyStyle = {
  padding: "20px 22px",
  display: "flex",
  flexDirection: "column",
  gap: "18px",
  overflowY: "auto"
};

const dropzoneStyle = {
  border: "2px dashed #333",
  borderRadius: "14px",
  padding: "28px 16px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.2s ease"
};

const uploadIconCircle = {
  width: "56px",
  height: "56px",
  borderRadius: "50%",
  backgroundColor: "rgba(0, 175, 240, 0.12)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const previewBoxStyle = {
  borderRadius: "14px",
  backgroundColor: "#18181a",
  border: "1px solid #2c2c2e",
  overflow: "hidden"
};

const videoWrapperStyle = {
  width: "100%",
  maxHeight: "220px",
  backgroundColor: "#000",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const videoElementStyle = {
  width: "100%",
  maxHeight: "220px",
  objectFit: "contain"
};

const fileInfoRowStyle = {
  padding: "10px 14px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  borderTop: "1px solid #262628"
};

const fileNameStyle = {
  fontSize: "13px",
  fontWeight: "600",
  color: "#fff",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: "240px"
};

const removeFileBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  background: "none",
  border: "none",
  color: "#ff3b30",
  fontSize: "12px",
  fontWeight: "600",
  cursor: "pointer",
  padding: "4px 8px",
  borderRadius: "6px"
};

const fieldGroupStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px"
};

const labelStyle = {
  fontSize: "13px",
  fontWeight: "700",
  color: "#e5e5ea"
};

const textareaStyle = {
  width: "100%",
  backgroundColor: "#18181a",
  border: "1px solid #2e2e32",
  borderRadius: "12px",
  padding: "12px 14px",
  color: "#fff",
  fontSize: "13.5px",
  outline: "none",
  boxSizing: "border-box",
  resize: "none",
  fontFamily: "inherit"
};

const charCountStyle = {
  fontSize: "11px",
  color: "#666",
  alignSelf: "flex-end"
};

const visibilityGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "10px"
};

const visibilityCardStyle = {
  border: "1.5px solid",
  borderRadius: "14px",
  padding: "12px 14px",
  cursor: "pointer",
  transition: "all 0.15s ease"
};

const visIconBox = {
  width: "32px",
  height: "32px",
  borderRadius: "8px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0
};

const vipTagStyle = {
  fontSize: "9px",
  fontWeight: "800",
  backgroundColor: "rgba(255, 215, 0, 0.2)",
  color: "#FFD700",
  padding: "2px 6px",
  borderRadius: "4px",
  letterSpacing: "0.5px"
};

const vipNoticeBoxStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: "8px",
  marginTop: "10px",
  padding: "10px 12px",
  backgroundColor: "rgba(255, 215, 0, 0.08)",
  border: "1px solid rgba(255, 215, 0, 0.2)",
  borderRadius: "10px"
};

const categoryChipsRow = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px"
};

const chipBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  border: "1px solid",
  borderRadius: "20px",
  padding: "6px 12px",
  fontSize: "12px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all 0.15s ease"
};

const progressBoxStyle = {
  padding: "12px 14px",
  backgroundColor: "#18181a",
  border: "1px solid #2c2c2e",
  borderRadius: "12px"
};

const progressBarTrack = {
  width: "100%",
  height: "8px",
  backgroundColor: "#2c2c2e",
  borderRadius: "4px",
  overflow: "hidden"
};

const progressBarFill = {
  height: "100%",
  transition: "width 0.2s ease"
};

const cancelBtnStyle = {
  flex: "0 0 90px",
  backgroundColor: "#222",
  color: "#ccc",
  border: "none",
  borderRadius: "12px",
  padding: "13px",
  fontSize: "14px",
  fontWeight: "700",
  cursor: "pointer"
};

const submitBtnStyle = {
  flex: 1,
  border: "none",
  borderRadius: "12px",
  padding: "13px",
  fontSize: "14px",
  fontWeight: "800",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  transition: "all 0.15s ease"
};

const errorBannerStyle = {
  margin: "12px 22px 0 22px",
  padding: "10px 14px",
  backgroundColor: "rgba(255, 59, 48, 0.12)",
  border: "1px solid rgba(255, 59, 48, 0.3)",
  borderRadius: "10px",
  color: "#ff3b30",
  fontSize: "13px",
  display: "flex",
  alignItems: "center",
  gap: "8px"
};

const successContainerStyle = {
  padding: "48px 24px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center"
};

const successIconCircle = {
  width: "72px",
  height: "72px",
  borderRadius: "50%",
  backgroundColor: "rgba(0, 208, 132, 0.12)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};
