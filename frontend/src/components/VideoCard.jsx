import React, { useEffect, useRef, useState } from "react";

export default function VideoCard({ video }) {
  const [play, setPlay] = useState(false);
  const videoRef = useRef(null);
  const cardRef = useRef(null);

  /* =====================
     Pause when off-screen
  ===================== */
  useEffect(() => {
    if (!videoRef.current || !cardRef.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting && videoRef.current) {
          videoRef.current.pause();
        }
      },
      { threshold: 0.4 }
    );

    observer.observe(cardRef.current);

    return () => observer.disconnect();
  }, []);

  /* =====================
     Telegram fullscreen
  ===================== */
  const handleFullscreen = () => {
    const tg = window.Telegram?.WebApp;

    if (tg?.isExpanded === false) {
      tg.expand();
    }

    if (videoRef.current?.requestFullscreen) {
      videoRef.current.requestFullscreen().catch(() => {});
    }
  };

  if (!video) return null;

  return (
    <div
      ref={cardRef}
      style={{
        width: "100%",
        aspectRatio: "1 / 1",
        background: "#000",
        borderRadius: 10,
        overflow: "hidden",
        position: "relative",
      }}
    >
      {!play ? (
        <>
          {/* Thumbnail */}
          <img
            src={video.thumbnail_url}
            alt=""
            onClick={() => setPlay(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              cursor: "pointer",
            }}
          />

          {/* ▶ Play overlay */}
          <div
            onClick={() => setPlay(true)}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.25)",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.6)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderTop: "10px solid transparent",
                  borderBottom: "10px solid transparent",
                  borderLeft: "16px solid white",
                  marginLeft: 4,
                }}
              />
            </div>
          </div>
        </>
      ) : (
        <video
          ref={videoRef}
          src={video.video_url}
          autoPlay
          controls
          playsInline
          muted
          preload="none"
          onClick={handleFullscreen}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "contain",
            background: "#000",
          }}
        />
      )}
    </div>
  );
}
