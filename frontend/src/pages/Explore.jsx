import React, { useState, useEffect } from "react";
import { Search, Heart, MessageCircle, Share2, Eye, Play } from "lucide-react";
import { APP_CONFIG } from "../config";
import PullToRefresh from "../components/PullToRefresh";

export default function Explore({ onVideoClick }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);

  // 🟢 FETCH & SHUFFLE NON-PREMIUM VIDEOS
  const loadRandomFeed = async () => {
    setLoading(true);
    try {
      // Get all categories EXCEPT premium
      const validCategories = APP_CONFIG.categories.filter(c => c.toLowerCase() !== "premium");
      
      // Fetch a handful from each category in parallel
      const fetches = validCategories.map(cat => 
        fetch(`${APP_CONFIG.apiUrl}/api/videos?category=${cat}&limit=8`).then(res => res.ok ? res.json() : { videos: [] })
      );
      
      const results = await Promise.all(fetches);
      
      // Combine all arrays
      let combined = [];
      results.forEach(data => {
        if (data && data.videos) combined = [...combined, ...data.videos];
      });

      // Shuffle the combined array
      const shuffled = combined.sort(() => 0.5 - Math.random());
      
      setFeed(shuffled);
    } catch (err) {
      console.error("Failed to load explore feed", err);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadRandomFeed();
  }, []);

  // 🟢 LIVE SEARCH HANDLER
  const handleSearchSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      loadRandomFeed(); // Revert to random if cleared
      return;
    }
    
    setLoading(true);
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/search?q=${encodeURIComponent(searchQuery)}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setFeed(data.videos || []);
      }
    } catch (err) {
      console.error("Search failed", err);
    }
    setLoading(false);
  };

  return (
    <div style={containerStyle}>
      {/* 🟢 STICKY SEARCH HEADER */}
      <div style={headerWrapper}>
        <div style={searchContainer}>
          <Search size={18} color="#888" style={{ marginLeft: "15px" }} />
          <form onSubmit={handleSearchSubmit} style={{ flex: 1, display: "flex" }}>
            <input 
              type="text" 
              placeholder="Search trending shots..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={searchInputStyle}
            />
          </form>
        </div>
      </div>

      <PullToRefresh onRefresh={loadRandomFeed}>
        <div style={feedWrapper}>
          
          {loading ? (
            // SKELETON LOADER (Updated to match Twitter layout)
            [...Array(5)].map((_, i) => (
              <div key={i} style={postStyle}>
                <div style={avatarColumnStyle}>
                  <div style={skeletonAvatar} />
                </div>
                <div style={contentColumnStyle}>
                  <div style={skeletonTextBase} />
                  <div style={{ ...skeletonTextBase, width: "80%", marginTop: "6px", marginBottom: "12px" }} />
                  <div style={{ ...skeletonVideo, width: "75%" }} />
                </div>
              </div>
            ))
          ) : feed.length === 0 ? (
             <div style={{ padding: "40px", textAlign: "center", color: "#888" }}>
                No videos found. Try a different search.
             </div>
          ) : (
            // TWITTER STYLE FEED
            feed.map((video, idx) => (
              <div key={`${video.message_id}-${idx}`} style={postStyle}>
                
                {/* LEFT COLUMN: AVATAR */}
                <div style={avatarColumnStyle}>
                  <img 
                    src={`${APP_CONFIG.apiUrl}/api/avatar?user_id=${video.uploader_id}`}
                    alt="avatar"
                    onError={(e) => { e.target.src = '/assets/default-avatar.png'; }}
                    style={avatarStyle}
                  />
                </div>

                {/* RIGHT COLUMN: CONTENT */}
                <div style={contentColumnStyle}>
                  
                  {/* POST HEADER */}
                  <div style={postHeaderStyle}>
                    <span style={usernameStyle}>@{video.uploader_name || "Member"}</span>
                    <span style={timeStyle}>&middot; {new Date(video.created_at).toLocaleDateString()} &middot; {video.category}</span>
                  </div>

                  {/* POST CAPTION */}
                  <p style={captionStyle}>{video.caption || APP_CONFIG.defaultCaption}</p>

                  {/* VIDEO THUMBNAIL (75% WIDTH) */}
                  <div 
                    style={videoContainerStyle}
                    onClick={() => onVideoClick(video)}
                  >
                    {video.thumbnail_url && (
                      <img 
                        src={video.thumbnail_url} 
                        alt="thumbnail" 
                        style={thumbnailImgStyle} 
                        loading="lazy"
                      />
                    )}
                    <div style={playOverlayStyle}>
                      <Play size={24} fill="#fff" strokeWidth={0} />
                    </div>
                    
                    {video.is_group && (
                      <div style={groupBadgeStyle}>Album</div>
                    )}
                  </div>

                  {/* POST ACTIONS */}
                  <div style={actionBarStyle}>
                    <div style={actionItemStyle}>
                      <Eye size={18} />
                      <span>{Number(video.views || 0).toLocaleString()}</span>
                    </div>
                    <div style={actionItemStyle}>
                      <MessageCircle size={18} />
                    </div>
                    <div style={actionItemStyle}>
                      <Heart size={18} />
                    </div>
                    <div style={actionItemStyle}>
                      <Share2 size={18} />
                    </div>
                  </div>

                </div>
              </div>
            ))
          )}
        </div>
      </PullToRefresh>

      <style>{`
        @keyframes skeleton-loading {
          0% { background-color: #222; }
          50% { background-color: #333; }
          100% { background-color: #222; }
        }
      `}</style>
    </div>
  );
}

// 🖌 STYLES
const containerStyle = { width: "100%", minHeight: "100%", display: "flex", flexDirection: "column", background: "var(--bg-color)" };

const headerWrapper = {
  position: "sticky", top: 0, zIndex: 100,
  background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)",
  borderBottom: "1px solid var(--border-color)", padding: "12px 16px"
};

const searchContainer = {
  display: "flex", alignItems: "center",
  background: "#16181c", borderRadius: "30px",
  border: "1px solid #333", height: "44px", overflow: "hidden"
};

const searchInputStyle = {
  background: "transparent", border: "none", color: "#fff",
  padding: "0 15px", width: "100%", fontSize: "15px", outline: "none"
};

const feedWrapper = {
  maxWidth: "600px", margin: "0 auto", width: "100%",
  borderLeft: window.innerWidth > 600 ? "1px solid var(--border-color)" : "none",
  borderRight: window.innerWidth > 600 ? "1px solid var(--border-color)" : "none",
  minHeight: "100vh"
};

const postStyle = {
  padding: "16px", borderBottom: "1px solid var(--border-color)",
  display: "flex", flexDirection: "row", // 🟢 Changed to row for 2-column layout
  animation: "fadeIn 0.3s ease-out"
};

// 🟢 NEW LAYOUT COLUMNS
const avatarColumnStyle = { marginRight: "12px", flexShrink: 0 };
const contentColumnStyle = { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 };

const postHeaderStyle = { display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" };

const avatarStyle = { width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", backgroundColor: "#222" };
const usernameStyle = { fontSize: "15px", fontWeight: "700", color: "#fff" };
const timeStyle = { fontSize: "13px", color: "#71767b", textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };

const captionStyle = { fontSize: "15px", lineHeight: "1.5", color: "#e7e9ea", margin: "0 0 12px 0", wordWrap: "break-word" };

const videoContainerStyle = {
  width: "75%", // 🟢 75% width leaves 25% empty on the right (which is exactly 1/3 of the 75% image width)
  position: "relative", borderRadius: "16px",
  overflow: "hidden", background: "#111", border: "1px solid #333",
  cursor: "pointer", aspectRatio: "9/16", maxHeight: "600px" 
};

const thumbnailImgStyle = { width: "100%", height: "100%", objectFit: "cover" };

const playOverlayStyle = {
  position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)",
  width: "50px", height: "50px", borderRadius: "50%", background: "var(--primary-color)",
  display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
  border: "2px solid rgba(255,255,255,0.2)"
};

const groupBadgeStyle = {
  position: "absolute", top: "12px", right: "12px", background: "rgba(0,0,0,0.7)",
  color: "#fff", fontSize: "12px", fontWeight: "700", padding: "4px 8px",
  borderRadius: "12px", backdropFilter: "blur(4px)"
};

const actionBarStyle = { display: "flex", justifyContent: "space-between", marginTop: "12px", maxWidth: "425px" };
const actionItemStyle = { display: "flex", alignItems: "center", gap: "6px", color: "#71767b", fontSize: "13px", cursor: "pointer" };

const skeletonAvatar = { width: "40px", height: "40px", borderRadius: "50%", animation: "skeleton-loading 1.5s infinite" };
const skeletonTextBase = { width: "150px", height: "20px", borderRadius: "4px", marginTop: "4px", animation: "skeleton-loading 1.5s infinite" };
const skeletonVideo = { width: "100%", height: "300px", borderRadius: "16px", animation: "skeleton-loading 1.5s infinite" };