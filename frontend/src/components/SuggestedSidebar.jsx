import React, { useState, useEffect } from "react";
import { Play, Lock } from "lucide-react";

// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../config";

export default function SuggestedSidebar({ onVideoClick }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);

    // 🟢 AUTONOMOUS FETCH: The sidebar hits the API directly, completely bypassing the Home cache
    fetch(`${APP_CONFIG.apiUrl}/api/videos?page=1&limit=1`)
      .then((res) => res.json())
      .then((data) => {
        if (isMounted && data.suggestions) {
          // Extra safety: Randomize them here just in case the backend didn't
          const shuffled = data.suggestions.sort(() => 0.5 - Math.random());
          setSuggestions(shuffled.slice(0, 10));
        }
      })
      .catch((err) => console.error("Sidebar fetch error:", err))
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []); // Runs once perfectly on mount

  const showSkeleton = loading && suggestions.length === 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
      <h3 style={{ color: "#fff", fontSize: "16px", fontWeight: "800", margin: "0 0 10px 0" }}>Suggested for you</h3>
      
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        
        {showSkeleton ? (
          [...Array(6)].map((_, i) => (
            <div key={`skeleton-${i}`} style={{ display: "flex", gap: "12px", padding: "10px", width: "100%" }}>
              <div style={skeletonImageStyle} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                <div style={{ ...skeletonTextStyle, width: "90%" }} />
                <div style={{ ...skeletonTextStyle, width: "60%" }} />
                <div style={{ ...skeletonTextStyle, width: "40%", marginTop: "6px" }} />
              </div>
            </div>
          ))
        ) : suggestions.length > 0 ? (
          suggestions.map((v) => (
            <div 
              key={`suggested-${v.chat_id}-${v.message_id}`} 
              onClick={(e) => onVideoClick(v, e)} 
              style={{ display: "flex", gap: "12px", cursor: "pointer", alignItems: "flex-start", padding: "10px", borderRadius: "10px", transition: "0.2s", width: "100%", boxSizing: "border-box" }}
              onMouseEnter={(e) => e.currentTarget.style.background = "#1c1c1e"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ width: "80px", height: "100px", borderRadius: "6px", overflow: "hidden", background: "#111", flexShrink: 0, position: "relative" }}>
                <img src={v.thumbnail_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
                
                {v.is_group && (
                  <div style={{ position: "absolute", bottom: 4, right: 4, background: "rgba(0,0,0,0.8)", padding: "4px 6px", borderRadius: "4px", fontSize: "10px", fontWeight: "bold", color: "#fff" }}>
                    1/{v.group_count}
                  </div>
                )}

                {v.category === "premium" && (
                  <div style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.7)", padding: "4px", borderRadius: "50%", display: "flex" }}>
                    <Lock size={10} color="var(--primary-color)" />
                  </div>
                )}
              </div>
              
              <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
                <p style={{ 
                  color: "#fff", fontSize: "13px", fontWeight: "600", margin: "0 0 4px 0", 
                  lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: "2", 
                  WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" 
                }}>
                  {/* 🟢 THE FIX: Dynamic Default Caption */}
                  {v.caption || APP_CONFIG.defaultCaption}
                </p>
                <div style={{ color: "#8e8e8e", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Play size={10} fill="#8e8e8e" strokeWidth={0} />
                  <span>{Number(v.views || 0).toLocaleString()} views</span>
                </div>
                <div style={{ color: "#555", fontSize: "11px", fontWeight: "700", marginTop: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {/* 🟢 THE FIX: Dynamic Default Uploader */}
                  @{v.uploader_name || APP_CONFIG.defaultUploader}
                </div>
              </div>
            </div>
          ))
        ) : (
          <p style={{ color: "#666", fontSize: "12px", padding: "10px" }}>No suggestions right now.</p>
        )}
      </div>

      <style>{`
        @keyframes pulseSkeleton {
          0% { opacity: 0.4; }
          50% { opacity: 0.8; }
          100% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}

// 🖌 Skeleton Styles
const skeletonImageStyle = {
  width: "80px", height: "100px", borderRadius: "6px", background: "#1a1a1a",
  animation: "pulseSkeleton 1.5s infinite ease-in-out", flexShrink: 0
};

const skeletonTextStyle = {
  height: "10px", borderRadius: "4px", background: "#1a1a1a",
  animation: "pulseSkeleton 1.5s infinite ease-in-out"
};