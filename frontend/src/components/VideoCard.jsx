import { useState } from "react";

export default function VideoCard({ src, thumbnail }) {
  const [playing, setPlaying] = useState(false);

  return (
    <div style={{ position: "relative" }}>
      {!playing && thumbnail && (
        <div
          onClick={() => setPlaying(true)}
          style={{ cursor: "pointer" }}
        >
          <img
            src={thumbnail}
            alt=""
            style={{ width: "100%", borderRadius: 8 }}
          />
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              fontSize: 40,
              color: "white",
            }}
          >
            ▶
          </div>
        </div>
      )}

      {(playing || !thumbnail) && (
        <video
          src={src}
          controls
          autoPlay
          style={{ width: "100%", borderRadius: 8 }}
        />
      )}
    </div>
  );
}
