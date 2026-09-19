import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { 
  X, ArrowLeft, Search, CheckCircle, Sparkles, UserPlus, UserCheck, 
  Users, Flame, Award, RefreshCw 
} from "lucide-react";
import { APP_CONFIG } from "../config";
import { showToast } from "../utils/toast";

export default function DiscoverCreatorsModal({ 
  isOpen, 
  onClose, 
  currentUser, 
  onCreatorClick 
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
          const tgOnly = data.creators.filter(c => {
            const email = String(c.email || "").toLowerCase();
            return !email.includes("@gmail.com") && !email.includes("@yahoo.com") && !email.includes("@hotmail.com");
          });
          setCreators(tgOnly);

          // Seed following map
          const initialFollows = {};
          tgOnly.forEach(c => {
            if (c.is_following !== undefined) {
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
        {/* Sticky Header */}
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
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Sparkles size={16} color="#00aff0" />
                <h2 style={titleStyle}>Discover Creators</h2>
              </div>
              <div style={subtitleStyle}>
                {creators.length > 0 ? `${creators.length} authentic Telegram creators` : "Telegram creators"}
              </div>
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

        {/* Search Input Bar */}
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

        {/* Category Pills Bar */}
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
                    background: isActive ? "#0095f6" : "#1f1f1f",
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

        {/* Creator List */}
        <div style={listContainerStyle}>
          {loading && creators.length === 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "10px 0" }}>
              {[1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} style={skeletonRowStyle}>
                  <div style={skeletonAvatar} />
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div style={{ ...skeletonLine, width: "45%" }} />
                    <div style={{ ...skeletonLine, width: "30%", height: "10px" }} />
                  </div>
                  <div style={skeletonButton} />
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

                return (
                  <div 
                    key={uname} 
                    style={creatorRowStyle}
                    onClick={() => {
                      if (onCreatorClick) {
                        onCreatorClick(uname);
                      }
                    }}
                  >
                    {/* Left: Avatar with Story Ring */}
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

                    {/* Middle: Name, Handle, Category, Bio */}
                    <div style={creatorInfoStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={displayNameStyle}>
                          {creator.display_name || uname}
                        </span>
                        {creator.creator_category && (
                          <span style={categoryBadgeStyle}>
                            {creator.creator_category}
                          </span>
                        )}
                      </div>

                      <div style={handleStyle}>
                        @{uname}
                        {creator.followers_count > 0 && (
                          <span style={{ color: "#71767b", marginLeft: "8px" }}>
                            · {creator.followers_count.toLocaleString()} {creator.followers_count === 1 ? "follower" : "followers"}
                          </span>
                        )}
                      </div>

                      {creator.creator_bio && (
                        <div style={bioStyle}>
                          {creator.creator_bio}
                        </div>
                      )}
                    </div>

                    {/* Right: Instagram Follow Button */}
                    <div style={{ marginLeft: "12px", flexShrink: 0 }}>
                      <button
                        onClick={(e) => handleFollowToggle(e, creator)}
                        disabled={isUpdating}
                        style={{
                          ...followBtnStyle,
                          background: isFollowing ? "rgba(255, 255, 255, 0.15)" : "#ffffff",
                          color: isFollowing ? "#ffffff" : "#000000",
                          border: isFollowing ? "1px solid rgba(255, 255, 255, 0.3)" : "none",
                          fontWeight: "700"
                        }}
                      >
                        {isFollowing ? "Following" : "Follow"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
  flexShrink: 0
};

const titleStyle = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#ffffff",
  margin: 0,
  letterSpacing: "0.2px"
};

const subtitleStyle = {
  fontSize: "11.5px",
  color: "#8e8e93",
  marginTop: "2px"
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

const searchBarWrapper = {
  padding: "12px 16px 8px 16px",
  flexShrink: 0,
  background: "#121212"
};

const searchBoxStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  backgroundColor: "#262626",
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
  flexShrink: 0,
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

const listContainerStyle = {
  flex: 1,
  overflowY: "auto",
  padding: "12px 16px",
  WebkitOverflowScrolling: "touch"
};

const gridOrListStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "10px"
};

const creatorRowStyle = {
  display: "flex",
  alignItems: "center",
  padding: "12px 14px",
  borderRadius: "12px",
  backgroundColor: "#181818",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  cursor: "pointer",
  transition: "background 0.2s ease, transform 0.15s ease",
  boxSizing: "border-box"
};

const avatarContainerStyle = {
  position: "relative",
  width: "50px",
  height: "50px",
  flexShrink: 0,
  marginRight: "12px"
};

const avatarRingStyle = {
  width: "50px",
  height: "50px",
  borderRadius: "50%",
  padding: "2px",
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
  bottom: "-2px",
  right: "-2px",
  backgroundColor: "#000",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1px"
};

const creatorInfoStyle = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "2px"
};

const displayNameStyle = {
  fontSize: "14px",
  fontWeight: "700",
  color: "#ffffff",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis"
};

const handleStyle = {
  fontSize: "12px",
  color: "#8e8e93",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis"
};

const categoryBadgeStyle = {
  fontSize: "10px",
  fontWeight: "600",
  color: "#00aff0",
  background: "rgba(0, 175, 240, 0.12)",
  padding: "1px 6px",
  borderRadius: "8px",
  whiteSpace: "nowrap"
};

const bioStyle = {
  fontSize: "12px",
  color: "#a8a8a8",
  marginTop: "3px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis"
};

const followBtnStyle = {
  padding: "7px 16px",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all 0.2s ease",
  minWidth: "86px",
  textAlign: "center"
};

const emptyStateStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "60px 20px",
  textAlign: "center"
};

const skeletonRowStyle = {
  display: "flex",
  alignItems: "center",
  padding: "12px 14px",
  borderRadius: "12px",
  backgroundColor: "#181818",
  gap: "12px"
};

const skeletonAvatar = {
  width: "50px",
  height: "50px",
  borderRadius: "50%",
  backgroundColor: "#262626",
  flexShrink: 0
};

const skeletonLine = {
  height: "14px",
  borderRadius: "6px",
  backgroundColor: "#262626"
};

const skeletonButton = {
  width: "80px",
  height: "32px",
  borderRadius: "8px",
  backgroundColor: "#262626",
  flexShrink: 0
};
