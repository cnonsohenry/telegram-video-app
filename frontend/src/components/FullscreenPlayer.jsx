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
        backgroundColor: "rgba(0, 0, 0, 1)", // 🟢 Solid black for immersive mobile feel
        // 🟢 Z-Index Trick: On Desktop, stay high (9999). 
        // On Mobile, drop to 1 so the "Back Arrow" (z-3010) stays on top.
        zIndex: isDesktop ? 9999 : 1, 
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isDesktop ? "20px" : "0", // No padding on mobile
      }}
    >
      {/* CLOSE BUTTON - Desktop Only (Mobile uses the Back Arrow) */}
      {isDesktop && (
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
      )}

      {/* MODAL WRAPPER */}
      <div
        style={{
          display: "flex",
          flexDirection: isDesktop ? "row" : "column",
          // 🟢 Mobile: Full Screen (100% W/H). Desktop: Float (90vh/95vw)
          width: isDesktop ? "auto" : "100%",
          height: isDesktop ? "auto" : "100%",
          maxHeight: isDesktop ? "90vh" : "none",
          maxWidth: isDesktop ? "95vw" : "none",
          background: "#000",
          borderRadius: isDesktop ? "8px" : "0px", // No round corners on mobile
          overflow: "hidden",
          boxShadow: isDesktop ? "0 25px 50px rgba(0,0,0,0.5)" : "none",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        
        {/* LEFT SIDE: THE VIDEO */}
        <div style={{ 
          width: "100%",
          height: "100%", // 🟢 Force full height on mobile
          aspectRatio: isDesktop ? "9/16" : "unset",
          background: "#000", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          flexShrink: 1,
          position: "relative"
        }}>
          <video
            src={video.video_url}
            controls={isDesktop} // 🟢 Optional: Hide controls on mobile for true TikTok feel
            autoPlay
            playsInline
            loop // 🟢 Loop video like TikTok
            style={{ 
                width: "100%", 
                height: "100%", 
                objectFit: "contain" // Ensures whole video is visible
            }}
          />
        </div>

        {/* RIGHT SIDE: THE SIDEBAR (Desktop Only) */}
        {isDesktop && (
          <div style={{ 
            width: "380px",
            background: "#000", 
            borderLeft: "1px solid #262626",
            display: "flex", 
            flexDirection: "column",
            flexShrink: 0 
          }}>
            {/* Header */}
            <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #262626" }}>
              <img 
                src={video.avatar_url || "/assets/default-avatar.png"}
                onError={(e) => { e.target.onerror = null; e.target.src = "/assets/default-avatar.png"; }}
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