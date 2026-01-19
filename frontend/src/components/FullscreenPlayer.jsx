import React, { useEffect } from "react";

export default function FullscreenPlayer({ video, onClose }) {
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  if (!video) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "#000",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        style={{
          position: "absolute",
          top: "12px",
          left: "12px",
          zIndex: 10000,
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          border: "none",
          borderRadius: "8px",
          padding: "8px 12px",
          fontSize: "14px",
          cursor: "pointer",
        }}
      >
        ← Back
      </button>

      {/* Video wrapper */}
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px 0", // prevents cut-off on mobile
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <video
          src={video.video_url}
          controls
          autoPlay
          playsInline
          style={{
            maxWidth: "100%",
            maxHeight: "100%",
            objectFit: "contain",
          }}
        />
      </div>
    </div>
  );
}
