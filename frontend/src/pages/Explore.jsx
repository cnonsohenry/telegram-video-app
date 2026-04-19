import React, { useState, useEffect, useRef, useCallback } from "react";
import { Search, Heart, MessageCircle, Share2, Eye, Play, Loader2 } from "lucide-react";
import { APP_CONFIG } from "../config";
import PullToRefresh from "../components/PullToRefresh";

// 🟢 NEW: INDIVIDUAL POST COMPONENT (Handles Inline Autoplay)
const FeedPost = ({ video, isLast, lastElementRef, onVideoClick }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoUrl, setVideoUrl] = useState(null);
  
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const hlsRef = useRef(null);

  // 1. Monitor when the video scrolls into view
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Play when at least 60% of the video is visible
        setIsPlaying(entry.isIntersecting); 
      },
      { threshold: 0.6 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => {
      if (containerRef.current) observer.unobserve(containerRef.current);
    };
  }, []);

  // 2. Fetch the video URL only if it stays on screen (prevents API spam on fast scrolls)
  useEffect(() => {
    let timer;
    if (isPlaying && !videoUrl) {
      timer = setTimeout(async () => {
        try {
          const res = await fetch(`${APP_CONFIG.apiUrl}/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`);
          if (res.ok) {
            const data = await res.json();
            if (data.video_url) setVideoUrl(data.video_url);
          }
        } catch (e) { console.error("Auto-fetch failed", e); }
      }, 300); // 300ms debounce
    }
    return () => clearTimeout(timer);
  }, [isPlaying, videoUrl, video.chat_id, video.message_id]);

  // 3. Handle HLS Streaming and HTML5 Autoplay
  useEffect(() => {
    if (!videoUrl || !videoRef.current) return;

    if (videoUrl.includes('.m3u8') && window.Hls && window.Hls.isSupported()) {
      if (!hlsRef.current) {
        hlsRef.current = new window.Hls({ startLevel: 1 }); // Start low res for fast feed scroll
        hlsRef.current.loadSource(videoUrl);
        hlsRef.current.attachMedia(videoRef.current);
      }
    } else {
      if (videoRef.current.src !== videoUrl) {
        videoRef.current.src = videoUrl;
      }
    }
  }, [videoUrl]);

  // 4. Play/Pause based on visibility
  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        // Muted is strictly required by mobile browsers for autoplay
        videoRef.current.play().catch(() => console.log("Autoplay blocked by browser"));
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying, videoUrl]);

  return (
    <div ref={isLast ? lastElementRef : null} style={postStyle}>
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
        <div style={postHeaderStyle}>
          <span style={usernameStyle}>@{video.uploader_name || "Member"}</span>
          <span style={timeStyle}>&middot; {new Date(video.created_at).toLocaleDateString()} &middot; {video.category}</span>
        </div>

        <p style={captionStyle}>{video.caption || APP_CONFIG.defaultCaption}</p>

        {/* 🟢 AUTOPLAY CONTAINER */}
        <div 
          ref={containerRef}
          style={videoContainerStyle}
          onClick={() => onVideoClick(video)} // Fullscreen open
        >
          {videoUrl ? (
            <video 
              ref={videoRef}
              style={thumbnailImgStyle}
              muted 
              loop 
              playsInline
              poster={video.thumbnail_url} // Show thumbnail until video loads
            />
          ) : (
            <img 
              src={video.thumbnail_url} 
              alt="thumbnail" 
              style={thumbnailImgStyle} 
              loading="lazy"
            />
          )}

          {/* Hide play button if playing inline to mimic Twitter */}
          {!isPlaying && (
            <div style={playOverlayStyle}>
              <Play size={24} fill="#fff" strokeWidth={0} />
            </div>
          )}
          
          {video.is_group && <div style={groupBadgeStyle}>Album</div>}
        </div>

        <div style={actionBarStyle}>
          <div style={actionItemStyle}><Eye size={18} /><span>{Number(video.views || 0).toLocaleString()}</span></div>
          <div style={actionItemStyle}><MessageCircle size={18} /></div>
          <div style={actionItemStyle}><Heart size={18} /></div>
          <div style={actionItemStyle}><Share2 size={18} /></div>
        </div>
      </div>
    </div>
  );
};

export default function Explore({ onVideoClick }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [feed, setFeed] = useState([]);
  
  // Pagination & Scroll States
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreSearch, setHasMoreSearch] = useState(true);

  // 🟢 INFINITE SCROLL OBSERVER
  const observer = useRef();
  const lastElementRef = useCallback(node => {
    if (loading || loadingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      // If the last element hits the screen, fetch more data
      if (entries[0].isIntersecting) {
        if (searchQuery.trim()) {
          if (hasMoreSearch) loadSearchFeed(searchPage + 1, true);
        } else {
          loadRandomFeed(true);
        }
      }
    });
    if (node) observer.current.observe(node);
  }, [loading, loadingMore, searchQuery, hasMoreSearch, searchPage]);

  // 🟢 FETCH RANDOM FEED
  const loadRandomFeed = async (isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const validCategories = APP_CONFIG.categories.filter(c => c.toLowerCase() !== "premium");
      
      const fetches = validCategories.map(async (cat) => {
        // Dig into random pages for endless variety
        const randomPage = Math.floor(Math.random() * 5) + 1; 
        let res = await fetch(`${APP_CONFIG.apiUrl}/api/videos?category=${cat}&limit=8&page=${randomPage}`);
        let data = res.ok ? await res.json() : { videos: [] };
        
        if (!data.videos || data.videos.length === 0) {
          res = await fetch(`${APP_CONFIG.apiUrl}/api/videos?category=${cat}&limit=8&page=1`);
          data = res.ok ? await res.json() : { videos: [] };
        }
        return data;
      });
      
      const results = await Promise.all(fetches);
      
      let combined = [];
      results.forEach(data => {
        if (data && data.videos) combined = [...combined, ...data.videos];
        if (data && data.suggestions) combined = [...combined, ...data.suggestions]; 
      });

      const uniqueMap = new Map();
      combined.forEach(video => uniqueMap.set(video.message_id, video));
      const shuffled = Array.from(uniqueMap.values()).sort(() => 0.5 - Math.random());
      
      if (isLoadMore) {
        setFeed(prev => {
          // Prevent duplicates when appending
          const newMap = new Map();
          prev.forEach(v => newMap.set(v.message_id, v));
          shuffled.forEach(v => newMap.set(v.message_id, v));
          return Array.from(newMap.values());
        });
      } else {
        setFeed(shuffled);
      }
    } catch (err) {
      console.error("Failed to load explore feed", err);
    }
    
    setLoading(false);
    setLoadingMore(false);
  };

  useEffect(() => {
    loadRandomFeed();
  }, []);

  // 🟢 FETCH SEARCH FEED
  const loadSearchFeed = async (pageNum = 1, isLoadMore = false) => {
    if (isLoadMore) setLoadingMore(true);
    else setLoading(true);

    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/search?q=${encodeURIComponent(searchQuery)}&limit=15&page=${pageNum}`);
      if (res.ok) {
        const data = await res.json();
        if (isLoadMore) {
          setFeed(prev => [...prev, ...data.videos]);
        } else {
          setFeed(data.videos || []);
        }
        setHasMoreSearch(data.hasMore);
        setSearchPage(pageNum);
      }
    } catch (err) {
      console.error("Search failed", err);
    }

    setLoading(false);
    setLoadingMore(false);
  };

  const handleSearchSubmit = (e) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      setSearchPage(1);
      setHasMoreSearch(true);
      loadRandomFeed();
      return;
    }
    loadSearchFeed(1, false);
  };

  return (
    <div style={containerStyle}>
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

      <PullToRefresh onRefresh={() => {
        setSearchPage(1);
        setHasMoreSearch(true);
        if (searchQuery.trim()) loadSearchFeed(1, false);
        else loadRandomFeed();
      }}>
        <div style={feedWrapper}>
          
          {/* INITIAL SKELETON */}
          {loading ? (
            [...Array(5)].map((_, i) => (
              <div key={i} style={postStyle}>
                <div style={avatarColumnStyle}><div style={skeletonAvatar} /></div>
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
            // FEED LIST
            feed.map((video, idx) => {
              const isLast = feed.length === idx + 1;
              return (
                <FeedPost 
                  key={`${video.message_id}-${idx}`}
                  video={video}
                  isLast={isLast}
                  lastElementRef={lastElementRef}
                  onVideoClick={onVideoClick}
                />
              );
            })
          )}

          {/* INFINITE SCROLL LOADER */}
          {loadingMore && (
            <div style={{ padding: "20px", display: "flex", justifyContent: "center", color: "var(--primary-color)" }}>
              <Loader2 className="animate-spin" size={24} />
            </div>
          )}
          
        </div>
      </PullToRefresh>

      <style>{`
        @keyframes skeleton-loading { 0% { background-color: #222; } 50% { background-color: #333; } 100% { background-color: #222; } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

// 🖌 STYLES (Unchanged from previous iteration)
const containerStyle = { width: "100%", minHeight: "100%", display: "flex", flexDirection: "column", background: "var(--bg-color)" };
const headerWrapper = { position: "sticky", top: 0, zIndex: 100, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(12px)", borderBottom: "1px solid var(--border-color)", padding: "12px 16px" };
const searchContainer = { display: "flex", alignItems: "center", background: "#16181c", borderRadius: "30px", border: "1px solid #333", height: "44px", overflow: "hidden" };
const searchInputStyle = { background: "transparent", border: "none", color: "#fff", padding: "0 15px", width: "100%", fontSize: "15px", outline: "none" };
const feedWrapper = { maxWidth: "600px", margin: "0 auto", width: "100%", borderLeft: window.innerWidth > 600 ? "1px solid var(--border-color)" : "none", borderRight: window.innerWidth > 600 ? "1px solid var(--border-color)" : "none", minHeight: "100vh" };
const postStyle = { padding: "16px", borderBottom: "1px solid var(--border-color)", display: "flex", flexDirection: "row", animation: "fadeIn 0.3s ease-out" };
const avatarColumnStyle = { marginRight: "12px", flexShrink: 0 };
const contentColumnStyle = { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 };
const postHeaderStyle = { display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" };
const avatarStyle = { width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", backgroundColor: "#222" };
const usernameStyle = { fontSize: "15px", fontWeight: "700", color: "#fff" };
const timeStyle = { fontSize: "13px", color: "#71767b", textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const captionStyle = { fontSize: "15px", lineHeight: "1.5", color: "#e7e9ea", margin: "0 0 12px 0", wordWrap: "break-word" };
const videoContainerStyle = { width: "75%", position: "relative", borderRadius: "16px", overflow: "hidden", background: "#111", border: "1px solid #333", cursor: "pointer", aspectRatio: "9/16", maxHeight: "600px" };
const thumbnailImgStyle = { width: "100%", height: "100%", objectFit: "cover" };
const playOverlayStyle = { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "50px", height: "50px", borderRadius: "50%", background: "var(--primary-color)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 12px rgba(0,0,0,0.5)", border: "2px solid rgba(255,255,255,0.2)" };
const groupBadgeStyle = { position: "absolute", top: "12px", right: "12px", background: "rgba(0,0,0,0.7)", color: "#fff", fontSize: "12px", fontWeight: "700", padding: "4px 8px", borderRadius: "12px", backdropFilter: "blur(4px)" };
const actionBarStyle = { display: "flex", justifyContent: "space-between", marginTop: "12px", maxWidth: "425px" };
const actionItemStyle = { display: "flex", alignItems: "center", gap: "6px", color: "#71767b", fontSize: "13px", cursor: "pointer" };
const skeletonAvatar = { width: "40px", height: "40px", borderRadius: "50%", animation: "skeleton-loading 1.5s infinite" };
const skeletonTextBase = { width: "150px", height: "20px", borderRadius: "4px", marginTop: "4px", animation: "skeleton-loading 1.5s infinite" };
const skeletonVideo = { width: "100%", height: "300px", borderRadius: "16px", animation: "skeleton-loading 1.5s infinite" };