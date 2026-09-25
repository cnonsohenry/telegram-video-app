import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  X, ArrowLeft, Search, CheckCircle, Sparkles, 
  Users, Flame, Play 
} from "lucide-react";
import { APP_CONFIG } from "../config";
import { showToast } from "../utils/toast";

export default function DiscoverCreatorsModal({ 
  isOpen, 
  onClose, 
  currentUser, 
  onCreatorClick,
  onVideoClick
}) {
  const [creators, setCreators] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [followingMap, setFollowingMap] = useState({});
  const [loadingFollowMap, setLoadingFollowMap] = useState({});
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);
  const historyPushedRef = useRef(false);

  // Resize listener
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Browser back button (popstate) integration
  useEffect(() => {
    if (!isOpen) return;

    if (!window.history.state?.discoverCreators) {
      window.history.pushState(
        { ...(window.history.state || {}), discoverCreators: true },
        document.title
      );
      historyPushedRef.current = true;
    }

    const handlePopState = (e) => {
      if (!e.state?.discoverCreators) {
        historyPushedRef.current = false;
        onClose();
      }
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [isOpen, onClose]);

  const handleSafeClose = useCallback(() => {
    if (historyPushedRef.current && window.history.state?.discoverCreators) {
      historyPushedRef.current = false;
      window.history.back();
    } else {
      onClose();
    }
  }, [onClose]);

  // Fetch creators list
  const fetchCreators = useCallback(async (query = "") => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const endpoint = query.trim()
        ? `${APP_CONFIG.apiUrl}/api/creator/featured/list?limit=100&q=${encodeURIComponent(query.trim())}`
        : `${APP_CONFIG.apiUrl}/api/creator/featured/list?limit=100`;

      const res = await fetch(endpoint, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data?.creators) {
          // Strictly filter out any web user accounts
          const tgOnly = (data.creators || []).filter(c => {
            if (!c || !c.username) return false;
            const email = String(c.email || "").toLowerCase();
            return !email.includes("@gmail.com") && !email.includes("@yahoo.com") && !email.includes("@hotmail.com");
          });
          setCreators(tgOnly);

          // Seed following map
          const initialFollows = {};
          tgOnly.forEach(c => {
            if (c?.username && c.is_following !== undefined) {
              initialFollows[c.username] = Boolean(c.is_following);
            }
          });
          setFollowingMap(prev => ({ ...initialFollows, ...prev }));
        }
      }
    } catch (e) {
      console.error("[DISCOVER CREATORS ERROR]", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchCreators();
    }
  }, [isOpen, fetchCreators]);

  // Search debounce
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      if (searchQuery.trim().length > 1) {
        fetchCreators(searchQuery.trim());
      } else if (searchQuery.trim().length === 0) {
        fetchCreators();
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, isOpen, fetchCreators]);

  // Follow / Unfollow handler
  const handleFollowToggle = async (e, creator) => {
    e.stopPropagation();
    const token = localStorage.getItem("token");
    if (!token) {
      window.dispatchEvent(new CustomEvent("promptLogin", { detail: { action: "follow" } }));
      return;
    }

    const uname = creator.username;
    if (loadingFollowMap[uname]) return;

    const isCurrentlyFollowing = followingMap[uname] !== undefined 
      ? followingMap[uname] 
      : Boolean(creator.is_following);
    const nextFollowing = !isCurrentlyFollowing;

    // Optimistic UI update
    setFollowingMap(prev => ({ ...prev, [uname]: nextFollowing }));
    setLoadingFollowMap(prev => ({ ...prev, [uname]: true }));

    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(uname)}/follow`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update follow");
      }
      setFollowingMap(prev => ({ ...prev, [uname]: Boolean(data.following) }));
      showToast(data.following ? `Following @${uname}` : `Unfollowed @${uname}`, data.following ? "success" : "error");
      window.dispatchEvent(new CustomEvent("refreshUser"));
    } catch (err) {
      setFollowingMap(prev => ({ ...prev, [uname]: isCurrentlyFollowing }));
      showToast(err.message || "Failed to update follow", "error");
    } finally {
      setLoadingFollowMap(prev => ({ ...prev, [uname]: false }));
    }
  };

  // Subscribe button click handler
  const handleSubscribeClick = (e, creator) => {
    e.stopPropagation();
    const token = localStorage.getItem("token");
    if (!token) {
      window.dispatchEvent(new CustomEvent("promptLogin", { detail: { action: "subscribe" } }));
      return;
    }
    if (onCreatorClick) {
      onCreatorClick(creator.username, { autoSubscribe: true });
    } else {
      window.dispatchEvent(new CustomEvent("openCreatorProfile", { 
        detail: { username: creator.username, autoSubscribe: true } 
      }));
    }
  };

  // Thumbnail click handler
  const handleThumbnailClick = (e, video) => {
    e.stopPropagation();
    if (onVideoClick) {
      onVideoClick(video, e);
    } else {
      window.dispatchEvent(new CustomEvent("openFullscreenVideo", { detail: video }));
    }
  };

  // Format view counts
  const formatViews = (count) => {
    const n = Number(count) || 0;
    if (n >= 1000000) return `${(n / 1000000).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}K`;
    return `${n}`;
  };

  // Derive categories
  const categories = useMemo(() => {
    const set = new Set();
    creators.forEach(c => {
      if (c.creator_category && c.creator_category.trim()) {
        set.add(c.creator_category.trim());
      }
    });
    return ["all", "verified", "popular", ...Array.from(set)];
  }, [creators]);

  // Filtered creators
  const filteredCreators = useMemo(() => {
    return creators.filter(creator => {
      // Category filter
      if (selectedCategory === "verified" && !creator.is_verified) return false;
      if (selectedCategory === "popular" && (creator.followers_count || 0) < 1) return false;
      if (selectedCategory !== "all" && selectedCategory !== "verified" && selectedCategory !== "popular") {
        if (creator.creator_category !== selectedCategory) return false;
      }

      // Query filter (in-memory fast filter)
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const uname = String(creator.username || "").toLowerCase();
        const name = String(creator.display_name || "").toLowerCase();
        const cat = String(creator.creator_category || "").toLowerCase();
        const bio = String(creator.creator_bio || "").toLowerCase();
        if (!uname.includes(q) && !name.includes(q) && !cat.includes(q) && !bio.includes(q)) {
          return false;
        }
      }

      return true;
    });
  }, [creators, selectedCategory, searchQuery]);

  if (!isOpen) return null;

  return (
    <div style={backdropStyle} onClick={handleSafeClose}>
      <div 
        style={isDesktop ? desktopModalStyle : mobileModalStyle} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Fixed Header: ONLY Back button, Title and Close button */}
        <div style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button 
              onClick={handleSafeClose} 
              style={iconBtnStyle} 
              title="Back"
              aria-label="Back"
            >
              <ArrowLeft size={22} color="#ffffff" />
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Sparkles size={18} color="#00aff0" />
              <h2 style={titleStyle}>Discover Creators</h2>
            </div>
          </div>

          <button 
            onClick={handleSafeClose} 
            style={iconBtnStyle} 
            title="Close"
            aria-label="Close"
          >
            <X size={20} color="#8e8e93" />
          </button>
        </div>

        {/* Scrollable Container: holds search bar, categories, and creator cards */}
        <div style={listContainerStyle}>
          {/* Search Input Bar (Scrolls with content) */}
          <div style={searchBarWrapper}>
            <div style={searchBoxStyle}>
              <Search size={16} color="#8e8e93" style={{ flexShrink: 0 }} />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search creators, handles or categories..."
                style={searchInputStyle}
                autoFocus={false}
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery("")} 
                  style={clearSearchBtn}
                  title="Clear"
                >
                  <X size={14} color="#8e8e93" />
                </button>
              )}
            </div>
          </div>

          {/* Category Pills Bar (Scrolls with content) */}
          {categories.length > 1 && (
            <div style={categoryTrackStyle}>
              {categories.map((cat) => {
                const isActive = selectedCategory === cat;
                let label = cat;
                if (cat === "all") label = "All Creators";
                else if (cat === "verified") label = "Verified";
                else if (cat === "popular") label = "Popular";

                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    style={{
                      ...categoryPillStyle,
                      background: isActive ? "#0095f6" : "rgba(255, 255, 255, 0.08)",
                      color: isActive ? "#ffffff" : "#a8a8a8",
                      borderColor: isActive ? "#0095f6" : "rgba(255, 255, 255, 0.1)"
                    }}
                  >
                    {cat === "verified" && <CheckCircle size={12} style={{ marginRight: "4px" }} />}
                    {cat === "popular" && <Flame size={12} style={{ marginRight: "4px" }} />}
                    {label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Creator Cards Section */}
          <div style={cardsContainerStyle}>
            {loading && creators.length === 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {[1, 2, 3, 4].map(i => (
                  <div key={i} style={skeletonCardStyle}>
                    {/* Top row skeleton */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", height: "50px" }}>
                      <div style={skeletonAvatar} />
                      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                        <div style={{ ...skeletonLine, width: "45%", height: "13px" }} />
                        <div style={{ ...skeletonLine, width: "70%", height: "11px" }} />
                        <div style={{ ...skeletonLine, width: "30%", height: "10px" }} />
                      </div>
                    </div>
                    {/* 4 Thumbnails skeleton with tiny gap */}
                    <div style={thumbnailsGridStyle}>
                      {[1, 2, 3, 4].map(k => (
                        <div key={k} style={skeletonThumbnail} />
                      ))}
                    </div>
                    {/* Action buttons skeleton */}
                    <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                      <div style={{ ...skeletonButton, flex: 1, borderRadius: "20px" }} />
                      <div style={{ ...skeletonButton, flex: 1, borderRadius: "20px" }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredCreators.length === 0 ? (
              <div style={emptyStateStyle}>
                <Users size={44} color="#555555" style={{ marginBottom: "12px" }} />
                <div style={{ fontSize: "16px", fontWeight: "600", color: "#ffffff", marginBottom: "6px" }}>
                  No creators found
                </div>
                <div style={{ fontSize: "13px", color: "#8e8e93", maxWidth: "260px", textAlign: "center" }}>
                  {searchQuery ? `No Telegram creators matched "${searchQuery}"` : "No creators available in this category."}
                </div>
              </div>
            ) : (
              <div style={gridOrListStyle}>
                {filteredCreators.map((creator) => {
                  const uname = creator.username;
                  const isFollowing = followingMap[uname] !== undefined 
                    ? followingMap[uname] 
                    : Boolean(creator.is_following);
                  const isUpdating = Boolean(loadingFollowMap[uname]);

                  const isSubscribed = Boolean(
                    creator.is_subscribed ||
                    (currentUser?.subscriptions && currentUser.subscriptions.some(s => {
                      const handle = String(s.creator_username || "").toLowerCase().replace(/^@/, "").trim();
                      return handle === String(uname || "").toLowerCase();
                    }))
                  );

                  const sampleVideos = Array.isArray(creator.sample_videos) ? creator.sample_videos : [];

                  return (
                    <div 
                      key={uname} 
                      style={creatorCardStyle}
                      onClick={() => {
                        if (onCreatorClick) {
                          onCreatorClick(uname);
                        }
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.05)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(255, 255, 255, 0.025)"; }}
                    >
                      {/* Top Row: Avatar on left; Name, bio, follow count closer together without exceeding avatar pic */}
                      <div style={topRowStyle}>
                        <div style={avatarContainerStyle}>
                          <div style={avatarRingStyle}>
                            <img 
                              src={creator.avatar_url || "/assets/default-avatar.png"} 
                              alt={creator.display_name || uname}
                              onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                              style={avatarImgStyle}
                            />
                          </div>
                          {creator.is_verified && (
                            <div style={verifiedBadgeStyle}>
                              <CheckCircle size={13} color="#00aff0" fill="#00aff0" />
                            </div>
                          )}
                        </div>

                        <div style={creatorInfoStyle}>
                          {/* Line 1: Display Name */}
                          <div style={nameRowStyle}>
                            <span style={displayNameStyle}>
                              {creator.display_name || uname}
                            </span>
                          </div>

                          {/* Line 2: Bio directly next after display name, 1 line with ellipsis "..." */}
                          <div style={bioStyle} title={creator.creator_bio || ""}>
                            {creator.creator_bio || ""}
                          </div>

                          {/* Line 3: Handle & Follow count */}
                          <div style={followCountRowStyle}>
                            <span style={handleStyle}>
                              @{uname}
                            </span>
                            {creator.followers_count > 0 && (
                              <span style={followersCountStyle}>
                                · {creator.followers_count.toLocaleString()} {creator.followers_count === 1 ? "follower" : "followers"}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Middle Row: 4 Thumbnails with NO captions, tiny gap, enclosed outer curves */}
                      {sampleVideos.length > 0 && (
                        <div style={thumbnailsGridStyle}>
                          {sampleVideos.slice(0, 4).map((video, vIdx) => {
                            const totalThumbs = Math.min(sampleVideos.length, 4);
                            const isFirst = vIdx === 0;
                            const isLast = vIdx === totalThumbs - 1;

                            let thumbRadius = "0px";
                            if (totalThumbs === 1) {
                              thumbRadius = "8px";
                            } else if (isFirst) {
                              thumbRadius = "8px 0 0 8px";
                            } else if (isLast) {
                              thumbRadius = "0 8px 8px 0";
                            }

                            return (
                              <div 
                                key={video.id || vIdx}
                                style={{
                                  ...thumbnailWrapperStyle,
                                  borderRadius: thumbRadius
                                }}
                                onClick={(e) => handleThumbnailClick(e, video)}
                                title="Play video"
                              >
                                <img 
                                  src={video.thumbnail_url || "/assets/placeholder-thumb.jpg"} 
                                  alt=""
                                  loading="lazy"
                                  onError={(e) => {
                                    e.target.onerror = null;
                                    e.target.src = "/assets/placeholder-thumb.jpg";
                                  }}
                                  style={thumbnailImgStyle}
                                />
                                {/* Bottom gradient vignette */}
                                <div style={thumbnailOverlayStyle} />

                                {/* View count at bottom-left */}
                                <div style={viewBadgeStyle}>
                                  <Play size={9} fill="#ffffff" color="#ffffff" style={{ marginRight: "3px" }} />
                                  <span>{formatViews(video.views)}</span>
                                </div>

                                {/* Optional premium badge */}
                                {video.is_premium && (
                                  <div style={premiumBadgeStyle}>
                                    ★
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* Bottom Row: Follow (white, rounded edge) & Subscribe (red, rounded edge), no icons */}
                      <div style={actionRowStyle}>
                        <button
                          onClick={(e) => handleFollowToggle(e, creator)}
                          disabled={isUpdating}
                          style={{
                            ...followBtnStyle,
                            background: isFollowing ? "rgba(255, 255, 255, 0.15)" : "#ffffff",
                            color: isFollowing ? "#ffffff" : "#000000",
                            border: isFollowing ? "1px solid rgba(255, 255, 255, 0.3)" : "none"
                          }}
                        >
                          {isFollowing ? "Following" : "Follow"}
                        </button>

                        <button
                          onClick={(e) => handleSubscribeClick(e, creator)}
                          style={{
                            ...subscribeBtnStyle,
                            background: isSubscribed ? "rgba(254, 44, 85, 0.18)" : "#fe2c55",
                            color: isSubscribed ? "#fe2c55" : "#ffffff",
                            border: isSubscribed ? "1px solid #fe2c55" : "none"
                          }}
                        >
                          {isSubscribed ? "Subscribed" : "Subscribe"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes discoverFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes discoverDesktopSlideIn {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes discoverMobileSlideUp {
          from { opacity: 0; transform: translateY(28px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// 🎨 Styles
const backdropStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000010,
  backgroundColor: "rgba(0, 0, 0, 0.82)",
  backdropFilter: "blur(10px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  animation: "discoverFadeIn 0.2s ease-out forwards"
};

const desktopModalStyle = {
  width: "100%",
  maxWidth: "620px",
  height: "85vh",
  maxHeight: "820px",
  backgroundColor: "#121212",
  borderRadius: "16px",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  boxShadow: "0 25px 60px rgba(0, 0, 0, 0.9)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  animation: "discoverDesktopSlideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards"
};

const mobileModalStyle = {
  position: "fixed",
  inset: 0,
  width: "100%",
  height: "100%",
  backgroundColor: "#000000",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  animation: "discoverMobileSlideUp 0.26s cubic-bezier(0.16, 1, 0.3, 1) forwards"
};

const headerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 18px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  background: "#121212",
  flexShrink: 0,
  zIndex: 10
};

const titleStyle = {
  fontSize: "16.5px",
  fontWeight: "700",
  color: "#ffffff",
  margin: 0,
  letterSpacing: "0.2px"
};

const iconBtnStyle = {
  background: "transparent",
  border: "none",
  color: "#ffffff",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "6px",
  borderRadius: "50%",
  transition: "background 0.2s ease"
};

const listContainerStyle = {
  flex: 1,
  overflowY: "auto",
  padding: "0",
  WebkitOverflowScrolling: "touch"
};

const searchBarWrapper = {
  padding: "14px 16px 8px 16px",
  background: "transparent"
};

const searchBoxStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  backgroundColor: "#1e1e1e",
  borderRadius: "10px",
  padding: "9px 14px",
  border: "1px solid rgba(255, 255, 255, 0.08)"
};

const searchInputStyle = {
  flex: 1,
  background: "transparent",
  border: "none",
  outline: "none",
  color: "#ffffff",
  fontSize: "14px",
  lineHeight: "1.4"
};

const clearSearchBtn = {
  background: "transparent",
  border: "none",
  padding: 0,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const categoryTrackStyle = {
  display: "flex",
  gap: "8px",
  overflowX: "auto",
  padding: "6px 16px 12px 16px",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  borderBottom: "1px solid rgba(255, 255, 255, 0.06)"
};

const categoryPillStyle = {
  border: "1px solid",
  borderRadius: "20px",
  padding: "6px 13px",
  fontSize: "12px",
  fontWeight: "600",
  cursor: "pointer",
  whiteSpace: "nowrap",
  display: "flex",
  alignItems: "center",
  transition: "all 0.2s ease",
  flexShrink: 0
};

const cardsContainerStyle = {
  padding: "14px 16px 28px 16px"
};

const gridOrListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "12px"
};

const creatorCardStyle = {
  backgroundColor: "rgba(255, 255, 255, 0.025)",
  border: "1px solid rgba(255, 255, 255, 0.07)",
  borderRadius: "14px",
  padding: "14px 14px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  cursor: "pointer",
  transition: "background-color 0.15s ease, border-color 0.15s ease",
  boxSizing: "border-box",
  width: "100%"
};

const topRowStyle = {
  display: "flex",
  alignItems: "center",
  width: "100%",
  boxSizing: "border-box"
};

const avatarContainerStyle = {
  position: "relative",
  width: "50px",
  height: "50px",
  flexShrink: 0,
  marginRight: "10px"
};

const avatarRingStyle = {
  width: "58px",
  height: "58px",
  borderRadius: "50%",
  padding: "2.5px",
  background: "linear-gradient(135deg, #00aff0 0%, #0077b5 100%)",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const avatarImgStyle = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  objectFit: "cover",
  backgroundColor: "#161616",
  border: "2px solid #181818",
  display: "block"
};

const verifiedBadgeStyle = {
  position: "absolute",
  bottom: "0px",
  right: "0px",
  backgroundColor: "#000",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1px"
};

const creatorInfoStyle = {
  flex: "1 1 0%",
  minWidth: 0,
  height: "58px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "center",
  gap: "2px",
  overflow: "hidden"
};

const nameRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  minWidth: 0,
  lineHeight: "1.2"
};

const displayNameStyle = {
  fontFamily: "'TikTok Sans', 'Plus Jakarta Sans', 'Proxima Nova', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  fontSize: "16px",
  fontWeight: "800",
  letterSpacing: "-0.2px",
  color: "#ffffff",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
  lineHeight: "1.25"
};

const categoryBadgeStyle = {
  fontSize: "9.5px",
  fontWeight: "600",
  color: "#00aff0",
  background: "rgba(0, 175, 240, 0.12)",
  padding: "1px 5px",
  borderRadius: "6px",
  whiteSpace: "nowrap",
  flexShrink: 0,
  lineHeight: "1.2"
};

const bioStyle = {
  fontSize: "12px",
  color: "#8e8e93",
  lineHeight: "1.2",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  width: "100%",
  display: "block",
  margin: 0
};

const followCountRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  minWidth: 0,
  lineHeight: "1.2"
};

const handleStyle = {
  fontSize: "11.5px",
  color: "#71767b",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  minWidth: 0,
  lineHeight: "1.2"
};

const followersCountStyle = {
  color: "#71767b",
  fontSize: "11.5px",
  flexShrink: 0,
  whiteSpace: "nowrap",
  lineHeight: "1.2"
};

const thumbnailsGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "2px",
  width: "100%",
  boxSizing: "border-box",
  borderRadius: "8px",
  overflow: "hidden"
};

const thumbnailWrapperStyle = {
  position: "relative",
  aspectRatio: "3/4",
  overflow: "hidden",
  backgroundColor: "#1c1c1f",
  cursor: "pointer",
  transition: "transform 0.15s ease, filter 0.15s ease",
  userSelect: "none"
};

const thumbnailImgStyle = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block"
};

const thumbnailOverlayStyle = {
  position: "absolute",
  inset: 0,
  background: "linear-gradient(to top, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0) 55%)",
  pointerEvents: "none"
};

const viewBadgeStyle = {
  position: "absolute",
  bottom: "5px",
  left: "5px",
  display: "flex",
  alignItems: "center",
  color: "#ffffff",
  fontSize: "10px",
  fontWeight: "600",
  textShadow: "0 1px 3px rgba(0, 0, 0, 0.85)",
  pointerEvents: "none"
};

const premiumBadgeStyle = {
  position: "absolute",
  top: "4px",
  right: "4px",
  backgroundColor: "rgba(255, 180, 0, 0.9)",
  color: "#000000",
  fontSize: "8px",
  fontWeight: "800",
  padding: "1px 3px",
  borderRadius: "3px",
  pointerEvents: "none"
};

const actionRowStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  width: "100%",
  marginTop: "2px"
};

const followBtnStyle = {
  flex: 1,
  height: "36px",
  borderRadius: "20px",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.18s ease",
  border: "none",
  outline: "none"
};

const subscribeBtnStyle = {
  flex: 1,
  height: "36px",
  borderRadius: "20px",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.18s ease",
  border: "none",
  outline: "none"
};

const emptyStateStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "60px 20px",
  textAlign: "center"
};

const skeletonCardStyle = {
  backgroundColor: "rgba(255, 255, 255, 0.025)",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  borderRadius: "14px",
  padding: "14px 14px",
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  boxSizing: "border-box",
  width: "100%"
};

const skeletonAvatar = {
  width: "50px",
  height: "50px",
  borderRadius: "50%",
  backgroundColor: "#242424",
  flexShrink: 0
};

const skeletonLine = {
  height: "12px",
  borderRadius: "6px",
  backgroundColor: "#242424"
};

const skeletonThumbnail = {
  aspectRatio: "3/4",
  backgroundColor: "#242424",
  width: "100%"
};

const skeletonButton = {
  height: "36px",
  borderRadius: "20px",
  backgroundColor: "#242424"
};
