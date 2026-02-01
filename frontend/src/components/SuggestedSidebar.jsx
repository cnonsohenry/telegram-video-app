import React from "react";
import { Play } from "lucide-react";

export default function SuggestedSidebar({ suggestions, onVideoClick }) {
  return (
    <aside style={{ 
      width: "380px", height: "calc(100vh - 70px)", position: "sticky", top: "70px", 
      padding: "30px 15px", display: "flex", flexDirection: "column", gap: "10px", 
      flexShrink: 0, overflowY: "auto", borderLeft: "1px solid #262626" 
    }}>
      <h3 style={{ color: "#fff", fontSize: "16px", fontWeight: "800", margin: "0 0 10px 0" }}>Suggested for you</h3>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {suggestions.map((v) => (
          <div 
            key={`suggested-${v.chat_id}-${v.message_id}`} 
            onClick={() => onVideoClick(v)}
            style={{ display: "flex", gap: "12px", cursor: "pointer", alignItems: "flex-start", padding: "10px", borderRadius: "10px", transition: "0.2s" }}
            onMouseEnter={(e) => e.currentTarget.style.background = "#1c1c1e"}
            onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
          >
            <div style={{ width: "80px", height: "100px", borderRadius: "6px", overflow: "hidden", background: "#111", flexShrink: 0 }}>
              <img src={v.thumbnail_url} style={{ width: "100%", height: "100%", objectFit: "cover" }} alt="" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: "#fff", fontSize: "13px", fontWeight: "600", margin: "0 0 4px 0", lineHeight: "1.4", wordWrap: "break-word" }}>
                {v.caption || "View trending video..."}
              </p>
              <div style={{ color: "#8e8e8e", fontSize: "11px", display: "flex", alignItems: "center", gap: "6px" }}>
                <Play size={10} fill="#8e8e8e" strokeWidth={0} />
                <span>{Number(v.views).toLocaleString()} views</span>
              </div>
              <div style={{ color: "#555", fontSize: "11px", fontWeight: "700", marginTop: "4px" }}>@{v.uploader_name}</div>
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}