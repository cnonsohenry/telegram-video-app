import React, { useEffect } from "react";
import { X } from "lucide-react";

export default function FullscreenPlayer({ video, onClose, isDesktop }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleEsc = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handleEsc);
    return () => {
      document.body.style.overflow = "auto";
      window.removeEventListener("keydown", handleEsc);
    };
  }, [onClose]);

  if (!video) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.50)", // Deep fade
        backdropFilter: isDesktop ? "blur(3px)" : "none",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isDesktop ? "20px" : "0",
      }}
    >
      {/* CLOSE BUTTON */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: "20px",
          right: "20px",
          zIndex: 10001,
          background: "rgba(255,255,255,0.1)",
          color: "#fff",
          border: "none",
          borderRadius: "50%",
          width: "44px",
          height: "44px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center"
        }}
      >
        <X size={24} />
      </button>

      {/* MODAL WRAPPER */}
      <div
        style={{
          display: "flex",
          flexDirection: isDesktop ? "row" : "column",
          // 🟢 Crucial: max-height ensures it fits the screen, 
          // width auto allows it to shrink to the content
          maxHeight: isDesktop ? "90vh" : "100vh",
          maxWidth: "95vw",
          background: "#000",
          borderRadius: isDesktop ? "8px" : "0px",
          overflow: "hidden",
          boxShadow: "0 25px 50px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* LEFT SIDE: THE VIDEO */}
        <div style={{ 
          // 🟢 We use height: 90vh to fix the scale, 
          // then the width will follow the video's actual shape
          height: isDesktop ? "90vh" : "auto",
          aspectRatio: isDesktop ? "9/16" : "unset", // Force vertical shape for Telegram clips
          background: "0, 0, 0, 0.50", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          flexShrink: 1
        }}>
          <video
            src={video.video_url}
            controls
            autoPlay
            playsInline
            style={{ 
                width: "100%", 
                height: "100%", 
                objectFit: "contain" // Video fills the vertical 9/16 box
            }}
          />
        </div>

        {/* RIGHT SIDE: THE SIDEBAR */}
        {isDesktop && (
          <div style={{ 
            width: "380px", // Fixed width for text
            background: "#000", 
            borderLeft: "1px solid #262626",
            display: "flex", 
            flexDirection: "column",
            flexShrink: 0 // Don't let the sidebar get squashed
          }}>
            {/* Header */}
            <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #262626" }}>
              <img 
                src={`https://videos.naijahomemade.com/api/avatar?user_id=${video.uploader_id}`}
                style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
              />
              <span style={{ color: "#fff", fontWeight: "600", fontSize: "14px" }}>
                @{video.uploader_name || 'Member'}
              </span>
            </div>

            {/* Caption Area */}
            <div style={{ flex: 1, padding: "16px", overflowY: "auto" }}>
              <p style={{ color: "#fff", fontSize: "14px", lineHeight: "1.5" }}>
                
                {video.caption || "No caption provided."}
              </p>
              <p style={{ color: "#8e8e8e", fontSize: "12px", marginTop: "10px" }}>
                {new Date(video.created_at).toLocaleDateString()}
              </p>
            </div>

            {/* Stats Area */}
            <div style={{ padding: "16px", borderTop: "1px solid #262626" }}>
              <div style={{ color: "#fff", fontSize: "14px", fontWeight: "bold" }}>
                {Number(video.views).toLocaleString()} views
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}