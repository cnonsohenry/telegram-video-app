import React, { useEffect } from "react";
import { X, ArrowLeft } from "lucide-react";

export default function FullscreenPlayer({ video, onClose, isDesktop }) {
  // 🟢 Lock body scroll when open
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
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "#000",
        // 🟢 FORCE TOP: Highest Z-Index to cover everything (headers, navs)
        zIndex: 10000, 
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: isDesktop ? "20px" : "0",
      }}
      onClick={onClose} // Clicking background closes it
    >
      {/* 🟢 NAVIGATION BUTTONS (Built-in) */}
      {isDesktop ? (
        // Desktop: Top-Right "X"
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "20px",
            right: "20px",
            zIndex: 10002,
            background: "rgba(255,255,255,0.1)",
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: "44px",
            height: "44px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)"
          }}
        >
          <X size={24} />
        </button>
      ) : (
        // Mobile: Top-Left "Back Arrow"
        <button
          onClick={(e) => { e.stopPropagation(); onClose(); }}
          style={{
            position: "absolute",
            top: "15px", // Safe area from top
            left: "15px",
            zIndex: 10002,
            background: "rgba(0,0,0,0.5)", // Darker pill for visibility
            color: "#fff",
            border: "none",
            borderRadius: "50%",
            width: "40px",
            height: "40px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(4px)"
          }}
        >
          <ArrowLeft size={24} />
        </button>
      )}

      {/* MODAL CONTAINER */}
      <div
        style={{
          display: "flex",
          flexDirection: isDesktop ? "row" : "column",
          // 🟢 Mobile: 100dvh (Dynamic Viewport Height) fixes "stuck" address bar issues
          width: isDesktop ? "auto" : "100%",
          height: isDesktop ? "auto" : "100dvh", 
          maxHeight: isDesktop ? "90vh" : "none",
          maxWidth: isDesktop ? "95vw" : "none",
          background: "#000",
          borderRadius: isDesktop ? "8px" : "0px",
          overflow: "hidden",
          boxShadow: isDesktop ? "0 25px 50px rgba(0,0,0,0.5)" : "none",
        }}
        onClick={(e) => e.stopPropagation()} // Clicking content doesn't close
      >
        
        {/* VIDEO PLAYER */}
        <div style={{ 
          width: "100%",
          height: "100%", 
          background: "#000", 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center",
          position: "relative"
        }}>
          <video
            src={video.video_url}
            // 🟢 CRITICAL: Enable controls on mobile so you can play/pause/seek
            controls={true} 
            autoPlay
            playsInline // Prevents iOS from forcing its own player
            loop
            style={{ 
                width: "100%", 
                height: "100%", 
                // 'contain' shows the whole video (good for quality)
                // 'cover' fills the screen (good for immersion, cuts edges)
                objectFit: "contain" 
            }}
          />
        </div>

        {/* DESKTOP SIDEBAR INFO */}
        {isDesktop && (
          <div style={{ 
            width: "380px",
            background: "#121212", 
            borderLeft: "1px solid #333",
            display: "flex", 
            flexDirection: "column",
            flexShrink: 0 
          }}>
            <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: "12px", borderBottom: "1px solid #333" }}>
              <img 
                src={video.avatar_url || "/assets/default-avatar.png"}
                onError={(e) => { e.target.onerror = null; e.target.src = "/assets/default-avatar.png"; }}
                style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover" }}
                alt="uploader"
              />
              <span style={{ color: "#fff", fontWeight: "600", fontSize: "14px" }}>
                @{video.uploader_name || 'Member'}
              </span>
            </div>

            <div style={{ flex: 1, padding: "16px", overflowY: "auto" }}>
              <p style={{ color: "#eee", fontSize: "14px", lineHeight: "1.5" }}>
                {video.caption || "No caption provided."}
              </p>
              <p style={{ color: "#888", fontSize: "12px", marginTop: "10px" }}>
                {new Date(video.created_at).toLocaleDateString()}
              </p>
            </div>

            <div style={{ padding: "16px", borderTop: "1px solid #333" }}>
              <div style={{ color: "#fff", fontSize: "14px", fontWeight: "bold" }}>
                {Number(video.views || 0).toLocaleString()} views
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}