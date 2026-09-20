import React, { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, ChevronLeft, ChevronRight, X, CheckCircle, ArrowRight } from "lucide-react";
import { APP_CONFIG } from "../config";
import { showToast } from "../utils/toast";

export default function DiscoverCreatorsSection({ 
  creators: initialCreators, 
  onCreatorClick, 
  onSeeAll,
  user,
  title = "Discover Creators",
  style = {}
}) {
  const [creators, setCreators] = useState(initialCreators || []);
  const [followingMap, setFollowingMap] = useState({});
  const [loadingMap, setLoadingMap] = useState({});
  const [dismissedSet, setDismissedSet] = useState(new Set());
  const trackRef = useRef(null);

  // If creators prop changes or was provided
  useEffect(() => {
    if (initialCreators && initialCreators.length > 0) {
      setCreators(initialCreators);
    }
  }, [initialCreators]);

  // If creators not provided, fetch them
  useEffect(() => {
    if (!initialCreators || initialCreators.length === 0) {
      const fetchFeatured = async () => {
        try {
          const token = localStorage.getItem("token");
          const headers = token ? { Authorization: `Bearer ${token}` } : {};
          const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/featured/list?limit=24`, { headers });
          if (res.ok) {
            const data = await res.json();
            if (data?.creators) {
              const tgOnly = data.creators.filter(c => {
                const email = String(c.email || "").toLowerCase();
                return !email.includes("@gmail.com") && !email.includes("@yahoo.com") && !email.includes("@hotmail.com");
              });
              setCreators(tgOnly);
            }
          }
        } catch (e) {
          console.error("Failed to load creators in section:", e);
        }
      };
      fetchFeatured();
    }
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
      window.dispatchEvent(new CustomEvent("promptLogin", { detail: { action: "follow" } }));
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

  const visibleCreators = (creators || []).filter((c) => c && c.username && !dismissedSet.has(c.username));
  if (visibleCreators.length === 0) return null;

  const scrollTrack = (direction) => {
    if (trackRef.current) {
      trackRef.current.scrollBy({
        left: direction * 280,
        behavior: "smooth"
      });
    }
  };

  return (
    <div style={{ ...igSuggestedWrapper, ...style }}>
      {/* Section Header */}
      <div style={igSuggestedHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
          <Sparkles size={16} color="#00aff0" />
          <span style={igSuggestedTitle}>{title}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* See All Button */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              if (onSeeAll) onSeeAll();
              else {
                window.dispatchEvent(new CustomEvent("openDiscoverCreators"));
              }
            }}
            style={igSeeAllBtn}
            title="See all creators"
          >
            <span>See All</span>
            <ArrowRight size={13} style={{ marginLeft: "3px" }} />
          </button>

          {/* Desktop Arrow Controls */}
          <div style={{ display: "flex", gap: "4px" }}>
            <button 
              onClick={() => scrollTrack(-1)} 
              style={igArrowBtn}
              title="Scroll left"
              aria-label="Scroll left"
            >
              <ChevronLeft size={16} />
            </button>
            <button 
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

      {/* Horizontal Carousel Track */}
      <div ref={trackRef} style={igScrollTrack}>
        {visibleCreators.map((creator) => {
          const uname = creator?.username;
          if (!uname) return null;
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

              {/* Center Avatar with Story Ring */}
              <div style={igAvatarContainer}>
                <div style={igAvatarRing}>
                  <img 
                    src={creator.avatar_url || "/assets/default-avatar.png"} 
                    alt={creator.display_name || uname}
                    onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                    style={igAvatarImg}
                  />
                </div>
                {creator.is_verified && (
                  <div style={igVerifiedBadge}>
                    <CheckCircle size={13} color="#00aff0" fill="#00aff0" />
                  </div>
                )}
              </div>

              {/* Creator Names & Category */}
              <div style={igDisplayName} title={creator.display_name || uname}>
                {creator.display_name || uname}
              </div>
              <div style={igHandleName}>
                @{uname}
              </div>
              {creator.creator_category && (
                <div style={igCategoryTag}>
                  {creator.creator_category}
                </div>
              )}

              {/* Instagram Follow Button */}
              <button 
                style={{
                  ...igFollowBtn,
                  backgroundColor: isFollowing ? "rgba(255, 255, 255, 0.15)" : "#ffffff",
                  border: isFollowing ? "1px solid rgba(255, 255, 255, 0.3)" : "none",
                  color: isFollowing ? "#ffffff" : "#000000",
                  fontWeight: "700"
                }}
                onClick={(e) => handleFollowToggle(e, creator)}
                disabled={isLoading}
              >
                {isFollowing ? "Following" : "Follow"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// 🎨 Styles
const igSuggestedWrapper = {
  width: "100%",
  padding: "16px 12px 16px 12px",
  margin: "12px 0 16px 0",
  background: "linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%)",
  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  boxSizing: "border-box"
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
  color: "#ffffff"
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
  color: "#ffffff",
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
  flex: "0 0 152px",
  width: "152px",
  minWidth: "152px",
  maxWidth: "152px",
  background: "#161616",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "12px",
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
  width: "60px",
  height: "60px",
  marginBottom: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const igAvatarRing = {
  width: "60px",
  height: "60px",
  borderRadius: "50%",
  padding: "2px",
  background: "linear-gradient(135deg, #00aff0 0%, #0077b5 100%)",
  boxSizing: "border-box",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const igAvatarImg = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  objectFit: "cover",
  backgroundColor: "#111",
  border: "2px solid #161616",
  display: "block"
};

const igVerifiedBadge = {
  position: "absolute",
  bottom: "-1px",
  right: "-1px",
  background: "#000",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1px"
};

const igDisplayName = {
  fontSize: "13px",
  fontWeight: "700",
  color: "#ffffff",
  textAlign: "center",
  width: "100%",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  lineHeight: "1.3"
};

const igHandleName = {
  fontSize: "11px",
  color: "#8e8e93",
  textAlign: "center",
  width: "100%",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  marginTop: "2px"
};

const igCategoryTag = {
  fontSize: "10px",
  fontWeight: "600",
  color: "#00aff0",
  background: "rgba(0, 175, 240, 0.12)",
  padding: "2px 7px",
  borderRadius: "10px",
  marginTop: "6px",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  maxWidth: "100%",
  display: "inline-block"
};

const igFollowBtn = {
  width: "100%",
  marginTop: "12px",
  padding: "7px 0",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: "600",
  border: "none",
  cursor: "pointer",
  transition: "all 0.2s ease"
};
