import React, { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, X, Loader2 } from "lucide-react";
import TwitterVerifiedBadge from "./TwitterVerifiedBadge";
import { APP_CONFIG } from "../config";
import { showToast, promptLogin } from "../utils/toast";
import StoryAvatar from "./StoryAvatar";

// 🌟 IN-MEMORY & LOCAL STORAGE CACHE (INSTANT 0MS APPEARANCE)
let memoryFeaturedCreators = null;
try {
  const cached = localStorage.getItem("cached_featured_creators");
  if (cached) {
    const parsed = JSON.parse(cached);
    if (Array.isArray(parsed) && parsed.length > 0) {
      memoryFeaturedCreators = parsed;
    }
  }
} catch (e) {}

// Eager background pre-fetch function
export const prefetchFeaturedCreators = async () => {
  try {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/featured/list?limit=24`, { headers });
    if (res.ok) {
      const data = await res.json();
      if (data?.creators && data.creators.length > 0) {
        memoryFeaturedCreators = data.creators;
        try {
          localStorage.setItem("cached_featured_creators", JSON.stringify(data.creators));
        } catch (e) {}
        return data.creators;
      }
    }
  } catch (e) {}
  return memoryFeaturedCreators || [];
};

// Immediately prefetch on module load if in browser
if (typeof window !== "undefined") {
  setTimeout(() => {
    prefetchFeaturedCreators();
  }, 50);
}

export default function DiscoverCreatorsSection({ 
  creators: initialCreators, 
  onCreatorClick, 
  onSeeAll,
  user,
  excludeUsername,
  title = "Discover Creators",
  style = {}
}) {
  const [creators, setCreators] = useState(() => {
    if (initialCreators && initialCreators.length > 0) return initialCreators;
    if (memoryFeaturedCreators && memoryFeaturedCreators.length > 0) return memoryFeaturedCreators;
    return [];
  });
  const [isLoadingFeatured, setIsLoadingFeatured] = useState(!creators || creators.length === 0);
  const [followingMap, setFollowingMap] = useState({});
  const [loadingMap, setLoadingMap] = useState({});
  const [dismissedSet, setDismissedSet] = useState(new Set());
  const [viewedStoriesSet, setViewedStoriesSet] = useState(new Set());
  const trackRef = useRef(null);

  // Synchronize viewed stories on creators prop update or local storage
  useEffect(() => {
    const s = new Set();
    (creators || []).forEach(c => {
      if (c?.has_viewed_story) {
        s.add(String(c.username || '').toLowerCase());
      }
    });

    try {
      const token = localStorage.getItem("token");
      if (token) {
        const payload = JSON.parse(atob(token.split(".")[1]));
        const currentUserId = payload?.id;
        if (currentUserId) {
          const storageKey = `viewed_stories_${currentUserId}`;
          const views = JSON.parse(localStorage.getItem(storageKey) || "[]");
          (creators || []).forEach(c => {
            if (c?.active_story_id && views.includes(c.active_story_id)) {
              s.add(String(c.username || '').toLowerCase());
            }
          });
        }
      }
    } catch (e) {}

    setViewedStoriesSet(s);
  }, [creators]);

  // Real-time listener for story view events
  useEffect(() => {
    const handleStoryViewed = (e) => {
      const viewedUname = e.detail?.username;
      if (viewedUname) {
        setViewedStoriesSet(prev => {
          const next = new Set(prev);
          next.add(String(viewedUname).toLowerCase());
          return next;
        });
      }
    };
    window.addEventListener("storyViewed", handleStoryViewed);
    return () => window.removeEventListener("storyViewed", handleStoryViewed);
  }, []);

  // If initialCreators prop changes or was provided
  useEffect(() => {
    if (initialCreators && initialCreators.length > 0) {
      setCreators(initialCreators);
      setIsLoadingFeatured(false);
    }
  }, [initialCreators]);

  // Background fetch / refresh
  useEffect(() => {
    let isMounted = true;
    if (!initialCreators || initialCreators.length === 0) {
      prefetchFeaturedCreators().then((data) => {
        if (isMounted && data && data.length > 0) {
          setCreators(data);
          setIsLoadingFeatured(false);
        }
      });
    }
    return () => { isMounted = false; };
  }, [initialCreators]);

  const handleDismiss = (username) => {
    setDismissedSet((prev) => {
      const next = new Set(prev);
      next.add(username);
      return next;
    });
  };

  const handleFollowToggle = async (e, creator) => {
    e.stopPropagation();
    const token = localStorage.getItem("token");
    if (!token) {
      promptLogin("follow");
      return;
    }

    const uname = creator?.username;
    if (!uname || loadingMap[uname]) return;

    const isCurrentlyFollowing = followingMap[uname] !== undefined 
      ? followingMap[uname] 
      : Boolean(creator.is_following);
    const nextFollowing = !isCurrentlyFollowing;

    // Optimistic UI update
    setFollowingMap((prev) => ({ ...prev, [uname]: nextFollowing }));
    setLoadingMap((prev) => ({ ...prev, [uname]: true }));

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
      setFollowingMap((prev) => ({ ...prev, [uname]: Boolean(data.following) }));
      showToast(data.following ? `Following @${uname}` : `Unfollowed @${uname}`, data.following ? "success" : "error");
      window.dispatchEvent(new CustomEvent("refreshUser"));
    } catch (err) {
      // Revert optimistic state on failure
      setFollowingMap((prev) => ({ ...prev, [uname]: isCurrentlyFollowing }));
      showToast(err.message || "Failed to update follow", "error");
    } finally {
      setLoadingMap((prev) => ({ ...prev, [uname]: false }));
    }
  };

  const normExclude = String(excludeUsername || "").toLowerCase().replace(/^@/, "").trim();
  const normUser = String(user?.username || "").toLowerCase().replace(/^@/, "").trim();

  const visibleCreators = (creators || []).filter((c) => {
    if (!c || !c.username) return false;
    const u = String(c.username).toLowerCase().trim();
    if (dismissedSet.has(c.username)) return false;
    if (normExclude && u === normExclude) return false;
    if (normUser && u === normUser) return false;
    return true;
  });

  const scrollTrack = (direction) => {
    if (trackRef.current) {
      trackRef.current.scrollBy({
        left: direction * 280,
        behavior: "smooth"
      });
    }
  };

  // If loading and no creators in cache yet, show instant skeleton placeholder cards
  if (visibleCreators.length === 0 && isLoadingFeatured) {
    return (
      <div style={{ ...igSuggestedWrapper, ...style }}>
        <div style={igSuggestedHeader}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={igSuggestedTitle}>{title}</span>
          </div>
        </div>
        <div style={igScrollTrack}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={igCardBox}>
              <div style={{ width: "84px", height: "84px", borderRadius: "50%", background: "rgba(255, 255, 255, 0.08)", animation: "skeleton-loading 1.2s infinite" }} />
              <div style={{ width: "96px", height: "14px", borderRadius: "4px", background: "rgba(255, 255, 255, 0.08)", marginTop: "12px", animation: "skeleton-loading 1.2s infinite" }} />
              <div style={{ width: "64px", height: "12px", borderRadius: "4px", background: "rgba(255, 255, 255, 0.05)", marginTop: "6px", animation: "skeleton-loading 1.2s infinite" }} />
              <div style={{ width: "100%", height: "30px", borderRadius: "8px", background: "rgba(255, 255, 255, 0.08)", marginTop: "12px", animation: "skeleton-loading 1.2s infinite" }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (visibleCreators.length === 0) return null;

  return (
    <div style={{ ...igSuggestedWrapper, ...style }}>
      <div style={igSuggestedHeader}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <span style={igSuggestedTitle}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onSeeAll) onSeeAll();
              else window.dispatchEvent(new CustomEvent("openDiscoverCreators"));
            }}
            style={igSeeAllBtn}
            title="See all creators"
          >
            <span>See All</span>
          </button>
          <div style={{ display: "flex", gap: "4px" }}>
            <button 
              type="button"
              onClick={() => scrollTrack(-1)} 
              style={igArrowBtn}
              title="Scroll left"
              aria-label="Scroll left"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
              type="button"
              onClick={() => scrollTrack(1)} 
              style={igArrowBtn}
              title="Scroll right"
              aria-label="Scroll right"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div ref={trackRef} style={igScrollTrack}>
        {visibleCreators.map((creator) => {
          const uname = creator.username;
          const isFollowing = followingMap[uname] !== undefined 
            ? followingMap[uname] 
            : Boolean(creator.is_following);
          const isLoading = Boolean(loadingMap[uname]);

          return (
            <div 
              key={uname} 
              style={igCardBox}
              onClick={() => onCreatorClick && onCreatorClick(uname)}
            >
              {/* Dismiss (✕) button */}
              <button 
                type="button"
                style={igDismissBtn} 
                onClick={(e) => {
                  e.stopPropagation();
                  handleDismiss(uname);
                }}
                title="Dismiss"
                aria-label="Dismiss"
              >
                <X size={13} />
              </button>

              {/* Center Avatar with Story Ring (Big Instagram Suggested Accounts Style) */}
              <div style={igAvatarContainer}>
                <StoryAvatar
                  username={uname}
                  avatarUrl={creator.avatar_url}
                  displayName={creator.display_name || uname}
                  size={84}
                  borderWidth={2.8}
                  onClick={() => onCreatorClick && onCreatorClick(uname)}
                />
              </div>

              {/* Display Name + Twitter Verified Badge */}
              <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: "2.5px", width: "100%", minWidth: 0, marginTop: "2px" }}>
                <span style={igDisplayName} title={creator.display_name || uname}>
                  {creator.display_name || uname}
                </span>
                {creator.is_verified && (
                  <TwitterVerifiedBadge size={13.5} style={{ flexShrink: 0 }} />
                )}
              </div>

              {/* Handle */}
              <span style={igHandleName}>
                @{uname}
              </span>

              {/* Follow Button (Instagram Style) */}
              <button
                type="button"
                style={isFollowing ? igFollowingBtn : igFollowBtn}
                onClick={(e) => handleFollowToggle(e, creator)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : isFollowing ? (
                  "Following"
                ) : (
                  "Follow"
                )}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 🌟 Export alias matching Explore's naming
export { DiscoverCreatorsSection as InstagramSuggestedCreators };

// 🌟 Instagram-Style Suggested Creators Styles (Exact match with Explore.jsx)
const igSuggestedWrapper = {
  width: "100%",
  padding: "16px 12px 16px 12px",
  margin: "12px 0 16px 0",
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)",
  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  boxSizing: "border-box",
  animation: "fadeInDown 0.18s ease-out"
};

const igSuggestedHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "14px",
  padding: "0 4px"
};

const igSuggestedTitle = {
  fontSize: "14px",
  fontWeight: "700",
  letterSpacing: "0.2px",
  color: "#d4d4d8"
};

const igSeeAllBtn = {
  background: "transparent",
  border: "none",
  color: "#0095f6",
  fontSize: "12.5px",
  fontWeight: "600",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 8px",
  borderRadius: "6px",
  transition: "background 0.2s ease, opacity 0.2s ease"
};

const igArrowBtn = {
  width: "24px",
  height: "24px",
  borderRadius: "50%",
  background: "rgba(255, 255, 255, 0.08)",
  border: "none",
  color: "#d4d4d8",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  transition: "background 0.2s ease"
};

const igScrollTrack = {
  display: "flex",
  gap: "12px",
  overflowX: "auto",
  paddingBottom: "6px",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  scrollSnapType: "x mandatory",
  WebkitOverflowScrolling: "touch"
};

const igCardBox = {
  position: "relative",
  flex: "0 0 174px",
  width: "174px",
  minWidth: "174px",
  maxWidth: "174px",
  background: "var(--bg-color, #09090b)",
  border: "1px solid rgba(255, 255, 255, 0.10)",
  borderRadius: "14px",
  padding: "16px 10px 14px 10px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  boxSizing: "border-box",
  scrollSnapAlign: "start",
  cursor: "pointer",
  transition: "transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease"
};

const igDismissBtn = {
  position: "absolute",
  top: "8px",
  right: "8px",
  width: "20px",
  height: "20px",
  borderRadius: "50%",
  background: "transparent",
  border: "none",
  color: "#71767b",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 0,
  zIndex: 2,
  transition: "color 0.2s ease, background 0.2s ease"
};

const igAvatarContainer = {
  position: "relative",
  width: "90px",
  height: "90px",
  marginBottom: "6px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const igDisplayName = {
  fontSize: "14px",
  fontWeight: "700",
  color: "#d4d4d8",
  textAlign: "center",
  maxWidth: "calc(100% - 18px)",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  lineHeight: "1.25"
};

const igHandleName = {
  fontSize: "12px",
  color: "#8e8e93",
  textAlign: "center",
  width: "100%",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  marginTop: "1px"
};

const igFollowBtn = {
  width: "100%",
  marginTop: "12px",
  padding: "7px 0",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: "700",
  color: "#09090b",
  backgroundColor: "#e4e4e7",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.15s ease, transform 0.1s ease"
};

const igFollowingBtn = {
  width: "100%",
  marginTop: "12px",
  padding: "6px 0",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: "700",
  color: "#a1a1aa",
  backgroundColor: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "background 0.15s ease"
};
