import React, { useRef, useState } from "react";

export default function VideoCard({ video }) {
  if (!video) return null; // safety check

  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [thumbError, setThumbError] = useState(false);

  const play = () => {
    setPlaying(true);
    requestAnimationFrame(() => {
      videoRef.current?.play();
    });
  };

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        borderRadius: 12,
        overflow: "hidden",
        background: "#000",
      }}
    >
      {/* Thumbnail */}
      {!playing && video.thumbnail_url && !thumbError && (
        <img
          src={video.thumbnail_url}
          alt=""
          loading="lazy"
          onError={() => setThumbError(true)}
          onClick={play}
          style={{
            width: "100%",
            display: "block",
            cursor: "pointer",
          }}
        />
      )}

      {/* Fallback placeholder */}
      {!playing && (!video.thumbnail_url || thumbError) && (
        <div
          onClick={play}
          style={{
            width: "100%",
            aspectRatio: "9 / 16",
            background: "#111",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            fontSize: 48,
            color: "#fff",
          }}
        >
          ▶
        </div>
      )}

      {/* Video */}
      <video
        ref={videoRef}
        src={video.video_url}
        controls={playing}
        playsInline
        preload="none"
        style={{
          width: "100%",
          display: playing ? "block" : "none",
        }}
      />
    </div>
  );
}
