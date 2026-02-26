import React from "react";
import { Play, Lock } from "lucide-react";

export default function SuggestedSidebar({ suggestions, onVideoClick }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
      <h3 style={{ color: "#fff", fontSize: "16px", fontWeight: "800", margin: "0 0 10px 0" }}>Suggested for you</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {suggestions.map((v) => (
          <div 
            key={`suggested-${v.chat_id}-${v.message_id}`} 
            onClick={(e) => onVideoClick(v, e)} 
            style={{ display: "flex", gap: "12px", cursor: "pointer", alignItems: "flex-start", padding: "10px", borderRadius: "10px", transition: "0.2s", width: "100%", boxSizing: "border-box" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#1c1c1e"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ width: "80px", height: "100px", borderRadius: "6px", overflow: "hidden", background: "#111", flexShrink: 0, position: "relative" }}>
              <img src={v.thumbnail_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
              
              {v.category === "premium" && (
                <div style={{ position: "absolute", top: 4, right: 4, background: "rgba(0,0,0,0.7)", padding: "4px", borderRadius: "50%", display: "flex" }}>
                  <Lock size={10} color="var(--primary-color)" />
                </div>
              )}
            </div>
            
            {/* 🟢 Added strict overflow hiding to prevent width stretching */}
            <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
              <p style={{ 
                color: "#fff", fontSize: "13px", fontWeight: "600", margin: "0 0 4px 0", 
                lineHeight: "1.4", display: "-webkit-box", WebkitLineClamp: "2", 
                WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" 
              }}>
                {v.caption || "View trending video..."}
              </p>
              <div style={{ color: "#8e8e8e", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Play size={10} fill="#8e8e8e" strokeWidth={0} />
                <span>{Number(v.views).toLocaleString()} views</span>
              </div>
              <div style={{ color: "#555", fontSize: "11px", fontWeight: "700", marginTop: "4px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                @{v.uploader_name}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}