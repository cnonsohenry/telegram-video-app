import React from "react";

const VideoPlayer = React.memo(function VideoPlayer({ src }) {
  return (
    <video
      src={src}
      controls
      muted
      playsInline
      preload="metadata"
      style={{
        width: "100%",
        borderRadius: "8px",
        backgroundColor: "#000",
      }}
    />
  );
});

export default VideoPlayer;
