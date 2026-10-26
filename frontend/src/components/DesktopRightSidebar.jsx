import React, { useState, useEffect, useCallback } from "react";
import { 
  Search, 
  X, 
  Play, 
  Loader2, 
  ChevronRight, 
  RefreshCw 
} from "lucide-react";
import StoryAvatar from "./StoryAvatar";
import TwitterVerifiedBadge from "./TwitterVerifiedBadge";
import { APP_CONFIG } from "../config";
import { promptLogin, showToast } from "../utils/toast";
import { isUserSubscribedToCreator } from "../utils/subscription";
import { formatTwitterDate, getPostDisplayName } from "../utils/date";

/**
 * Reusable Desktop Right Sidebar (Twitter/X style: Search, Top Creator, Highlights, Trends, Legal)
 * Self-contained with automated fallback fetching for highlights and featured creators.
 */
export default function DesktopRightSidebar({
  searchQuery: externalSearchQuery,
  setSearchQuery: externalSetSearchQuery,
  onSearchSubmit = null,
  onClear = null,
  onSelectTopic = null,
  highlights: externalHighlights = null,
  highlightsLoading: externalHighlightsLoading = false,
  onRefreshHighlights = null,
  featuredCreators: externalFeaturedCreators = null,
  onCreatorClick = null,
  onVideoClick = null,
  onOpenDiscover = null,
  user = null,
  style = {}
}) {
  // 1. Search state (internal fallback if not controlled)
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const isSearchControlled = externalSearchQuery !== undefined && externalSetSearchQuery !== undefined;
  const searchQuery = isSearchControlled ? externalSearchQuery : internalSearchQuery;
  const setSearchQuery = isSearchControlled ? externalSetSearchQuery : setInternalSearchQuery;

  // 2. Featured Creators fallback
  const [internalFeaturedCreators, setInternalFeaturedCreators] = useState(() => {
    try {
      const saved = sessionStorage.getItem("cached_featured_creators");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });

  const featuredCreators = externalFeaturedCreators !== null && externalFeaturedCreators !== undefined
    ? externalFeaturedCreators
    : internalFeaturedCreators;

  const fetchFeaturedFallback = useCallback(async () => {
    if (externalFeaturedCreators !== null && externalFeaturedCreators !== undefined) return;
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/featured/list`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data?.creators) {
          const tgOnly = data.creators.filter(c => {
            const email = String(c.email || "").toLowerCase();
            return !email.includes("@gmail.com") && !email.includes("@yahoo.com") && !email.includes("@hotmail.com");
          });
          setInternalFeaturedCreators(tgOnly);
          try {
            sessionStorage.setItem("cached_featured_creators", JSON.stringify(tgOnly));
          } catch (e) {}
        }
      }
    } catch (e) {}
  }, [externalFeaturedCreators]);

  useEffect(() => {
    if (featuredCreators.length === 0) {
      fetchFeaturedFallback();
    }
  }, [featuredCreators.length, fetchFeaturedFallback]);

  // 3. Highlights fallback
  const [internalHighlights, setInternalHighlights] = useState([]);
  const [internalHighlightsLoading, setInternalHighlightsLoading] = useState(false);

  const isHighlightsControlled = externalHighlights !== null && externalHighlights !== undefined;
  const highlights = isHighlightsControlled ? externalHighlights : internalHighlights;
  const highlightsLoading = isHighlightsControlled ? externalHighlightsLoading : internalHighlightsLoading;

  const fetchInternalHighlights = useCallback(async () => {
    try {
      setInternalHighlightsLoading(true);
      const randomSeed = Math.floor(Math.random() * 9999999);
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/videos?category=all&sort=random&limit=16&seed=${randomSeed}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.videos && data.videos.length > 0) {
          const seen = new Set();
          const cleanVideos = data.videos.filter(v => {
            if (!v || !v.thumbnail_url) return false;
            const id = v.message_id || v.id;
            if (seen.has(id)) return false;
            seen.add(id);
            return true;
          });
          setInternalHighlights(cleanVideos.slice(0, 4));
        }
      }
    } catch (e) {
    } finally {
      setInternalHighlightsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isHighlightsControlled && internalHighlights.length === 0) {
      fetchInternalHighlights();
    }
  }, [isHighlightsControlled, internalHighlights.length, fetchInternalHighlights]);

  // 4. Follow toggling state
  const [followingMap, setFollowingMap] = useState({});
  const [loadingMap, setLoadingMap] = useState({});

  const handleSideFollowToggle = async (e, creator) => {
    e.stopPropagation();
    const uname = creator.username;
    const token = localStorage.getItem("token");
    if (!token) return promptLogin("follow");

    const isCurrentlyFollowing = followingMap[uname] !== undefined 
      ? followingMap[uname] 
      : Boolean(creator.is_following);
    const nextFollowing = !isCurrentlyFollowing;

    setFollowingMap(prev => ({ ...prev, [uname]: nextFollowing }));
    setLoadingMap(prev => ({ ...prev, [uname]: true }));

    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(uname)}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to update follow");
      setFollowingMap(prev => ({ ...prev, [uname]: Boolean(data.following) }));
      showToast(data.following ? `Following @${uname}` : `Unfollowed @${uname}`, data.following ? "success" : "error");
      window.dispatchEvent(new CustomEvent("refreshUser"));
    } catch (err) {
      setFollowingMap(prev => ({ ...prev, [uname]: isCurrentlyFollowing }));
      showToast(err.message || "Failed to update follow", "error");
    } finally {
      setLoadingMap(prev => ({ ...prev, [uname]: false }));
    }
  };

  const handleSearchKey = (e) => {
    if (e.key === "Enter") {
      if (onSearchSubmit) {
        onSearchSubmit(searchQuery);
      } else if (searchQuery.trim()) {
        window.location.href = `/?tab=explore&q=${encodeURIComponent(searchQuery.trim())}`;
      }
    }
  };

  const handleTopicClick = (catId) => {
    if (onSelectTopic) {
      onSelectTopic(catId);
    } else {
      window.location.href = `/?tab=explore&category=${catId}`;
    }
  };

  const handleCreatorClickInternal = (uname) => {
    if (onCreatorClick) {
      onCreatorClick(uname);
    } else {
      window.location.href = `/@${uname}`;
    }
  };

  const handleVideoClickInternal = (v) => {
    if (onVideoClick) {
      onVideoClick(v);
    } else {
      const isPrem = v.category === "premium" || v.is_premium;
      const isUnl = !isPrem || isUserSubscribedToCreator(user, v);
      if (!isUnl && !localStorage.getItem("token")) {
        promptLogin("subscribe");
        return;
      }
      window.location.href = `/?video=${v.message_id || v.id}`;
    }
  };

  const trendingTopics = [
    { category: "Entertainment · Trending", topic: "#NaijaKnacks", posts: "24.5K drops", catId: "knacks" },
    { category: "Trending in Nigeria", topic: "#LagosBaddies", posts: "18.2K drops", catId: "baddies" },
    { category: "VIP Club · Trending", topic: "#VIPExclusives", posts: "31.9K drops", catId: "premium" },
    { category: "Campus & College", topic: "#CollegeBabes", posts: "12.4K drops", catId: "college" },
    { category: "Models · Trending", topic: "#Hotties", posts: "15.7K drops", catId: "hotties" }
  ];

  return (
    <aside style={{ ...desktopRightRailStyle, ...style }} className="custom-scrollbar">
      {/* 1. Twitter-style Search Bar */}
      <div style={desktopSearchBoxWrapper}>
        <Search size={18} color="#71767b" style={{ flexShrink: 0 }} />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={handleSearchKey}
          placeholder="Search Explore & Creators..."
          style={desktopSearchInput}
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => {
              if (onClear) onClear();
              else setSearchQuery("");
            }}
            style={desktopSearchInputClearBtn}
            title="Clear search"
          >
            <X size={14} color="#000" />
          </button>
        )}
      </div>

      {/* 2. Top Creator Card */}
      <div style={desktopCardStyle}>
        <div style={desktopCardHeaderStyle}>
          <h3 style={desktopCardTitleStyle}>Top Creator</h3>
          <button
            type="button"
            onClick={() => onOpenDiscover && onOpenDiscover()}
            style={{
              background: "none",
              border: "none",
              color: "var(--primary-color, #f43f5e)",
              fontSize: "13px",
              fontWeight: "700",
              cursor: "pointer",
              padding: "2px 4px"
            }}
          >
            See all
          </button>
        </div>

        {featuredCreators.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "8px 16px 16px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: "#222", flexShrink: 0 }} />
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "6px" }}>
                <div style={{ width: "60%", height: "14px", background: "#222", borderRadius: "4px" }} />
                <div style={{ width: "40%", height: "11px", background: "#222", borderRadius: "4px" }} />
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "4px" }}>
              {[...Array(4)].map((_, i) => (
                <div key={i} style={{ aspectRatio: "3/4", background: "#222", borderRadius: "6px" }} />
              ))}
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {featuredCreators.slice(0, 1).map((creator) => {
              const uname = creator.username;
              const isFollowing = followingMap[uname] !== undefined 
                ? followingMap[uname] 
                : Boolean(creator.is_following);
              const isLoading = Boolean(loadingMap[uname]);
              const sampleVideos = Array.isArray(creator.sample_videos) ? creator.sample_videos : [];
              const creatorPrice = creator.subscription_price !== undefined ? Number(creator.subscription_price) : 0;
              const hasFee = creatorPrice > 0;
              const isSubscribed = Boolean(creator.is_subscribed || (user && isUserSubscribedToCreator(user, { uploader_handle: uname })));

              return (
                <div
                  key={`side-c-${uname}`}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px",
                    padding: "4px 16px 14px 16px",
                    cursor: "pointer",
                    boxSizing: "border-box",
                    width: "100%"
                  }}
                  onClick={() => handleCreatorClickInternal(uname)}
                >
                  {/* Top Row: Avatar + Info */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", minWidth: 0 }}>
                    <div style={{ flexShrink: 0 }}>
                      <StoryAvatar
                        username={uname}
                        avatarUrl={creator.avatar_url}
                        displayName={creator.display_name || uname}
                        size={52}
                        borderWidth={2.2}
                        onClick={() => handleCreatorClickInternal(uname)}
                      />
                    </div>

                    <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
                      {/* Name + Verified */}
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "3px", minWidth: 0 }}>
                        <span style={{
                          fontSize: "15px",
                          fontWeight: "800",
                          color: "#d4d4d8",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          lineHeight: "1.25"
                        }}>
                          {creator.display_name || uname}
                        </span>
                        {creator.is_verified && (
                          <TwitterVerifiedBadge size={14.5} style={{ flexShrink: 0 }} />
                        )}
                      </div>

                      {/* Bio line */}
                      {creator.creator_bio && (
                        <span style={{
                          fontSize: "12px",
                          color: "#8e8e93",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          lineHeight: "1.3",
                          marginTop: "1px",
                          marginBottom: "1px"
                        }} title={creator.creator_bio}>
                          {creator.creator_bio}
                        </span>
                      )}

                      {/* Handle & Followers */}
                      <div style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11.5px", color: "#71767b", lineHeight: "1.2" }}>
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          @{uname}
                        </span>
                        {creator.followers_count > 0 && (
                          <span style={{ flexShrink: 0 }}>
                            &middot; {Number(creator.followers_count).toLocaleString()} {creator.followers_count === 1 ? "follower" : "followers"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle Row: 4 Thumbnails */}
                  {sampleVideos.length > 0 && (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(4, 1fr)",
                      gap: "4px",
                      width: "100%",
                      borderRadius: "8px",
                      overflow: "hidden",
                      marginTop: "4px",
                      marginBottom: "2px",
                      boxSizing: "border-box"
                    }}>
                      {sampleVideos.slice(0, 4).map((video, vIdx) => {
                        const totalThumbs = Math.min(sampleVideos.length, 4);
                        const isFirst = vIdx === 0;
                        const isLast = vIdx === totalThumbs - 1;

                        let thumbRadius = "0px";
                        if (totalThumbs === 1) thumbRadius = "8px";
                        else if (isFirst) thumbRadius = "8px 0 0 8px";
                        else if (isLast) thumbRadius = "0 8px 8px 0";

                        return (
                          <div
                            key={video.id || vIdx}
                            style={{
                              position: "relative",
                              aspectRatio: "3/4",
                              overflow: "hidden",
                              backgroundColor: "#1c1c1f",
                              borderRadius: thumbRadius,
                              cursor: "pointer"
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleVideoClickInternal(video);
                            }}
                          >
                            <img
                              src={video.thumbnail_url}
                              alt=""
                              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                              loading="lazy"
                            />
                            <div style={{
                              position: "absolute",
                              inset: 0,
                              background: "linear-gradient(to top, rgba(0, 0, 0, 0.75) 0%, rgba(0, 0, 0, 0) 55%)",
                              pointerEvents: "none"
                            }} />
                            <div style={{
                              position: "absolute",
                              bottom: "5px",
                              left: "5px",
                              display: "flex",
                              alignItems: "center",
                              color: "#d4d4d8",
                              fontSize: "9.5px",
                              fontWeight: "600",
                              pointerEvents: "none"
                            }}>
                              <Play size={9} fill="#d4d4d8" strokeWidth={0} style={{ marginRight: "2px" }} />
                              {Number(video.views || 0).toLocaleString()}
                            </div>
                            {(video.is_premium || video.category === "premium") && (
                              <span style={{
                                position: "absolute",
                                top: "4px",
                                right: "4px",
                                backgroundColor: "rgba(255, 180, 0, 0.9)",
                                color: "#000000",
                                fontSize: "8px",
                                fontWeight: "800",
                                padding: "1px 4px",
                                borderRadius: "3px",
                                pointerEvents: "none"
                              }}>
                                VIP
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Action Row: Follow & VIP Buttons */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%", marginTop: "2px" }}>
                    <button
                      type="button"
                      style={{
                        flex: 1,
                        height: "34px",
                        borderRadius: "17px",
                        fontSize: "12.5px",
                        fontWeight: "700",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "all 0.15s ease",
                        border: isFollowing ? "1px solid rgba(255, 255, 255, 0.12)" : "none",
                        backgroundColor: isFollowing ? "rgba(255, 255, 255, 0.08)" : "#c4c4c8",
                        color: isFollowing ? "#a1a1aa" : "#09090b"
                      }}
                      onClick={(e) => handleSideFollowToggle(e, creator)}
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

                    {hasFee && (
                      <button
                        type="button"
                        style={{
                          flex: 1,
                          height: "34px",
                          borderRadius: "17px",
                          fontSize: "12.5px",
                          fontWeight: "700",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.15s ease",
                          border: isSubscribed ? "1px solid rgba(225, 29, 72, 0.3)" : "none",
                          backgroundColor: isSubscribed ? "rgba(225, 29, 72, 0.14)" : "var(--primary-color, #e11d48)",
                          color: isSubscribed ? "#f43f5e" : "#d4d4d8"
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCreatorClickInternal(uname);
                        }}
                      >
                        <span>VIP ${creatorPrice}/mo</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              onClick={() => onOpenDiscover && onOpenDiscover()}
              style={desktopCardShowMoreBtn}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <span>Show more creators</span>
              <ChevronRight size={15} />
            </button>
          </div>
        )}
      </div>

      {/* 3. Trending Highlights (Mini Video Cards) */}
      <div style={desktopCardStyle}>
        <div style={desktopCardHeaderStyle}>
          <h3 style={desktopCardTitleStyle}>Highlights</h3>
          <button
            type="button"
            onClick={() => {
              if (onRefreshHighlights) onRefreshHighlights();
              else fetchInternalHighlights();
            }}
            style={{
              background: "none",
              border: "none",
              color: "#71767b",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "4px",
              borderRadius: "50%",
              transition: "color 0.2s ease"
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = "#d4d4d8"}
            onMouseLeave={(e) => e.currentTarget.style.color = "#71767b"}
            title="Refresh highlights"
          >
            <RefreshCw size={14} className={highlightsLoading ? "animate-spin" : ""} />
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {highlightsLoading && highlights.length === 0 ? (
            [...Array(3)].map((_, i) => (
              <div key={i} style={desktopHighlightSkeleton}>
                <div style={{ width: "68px", height: "86px", borderRadius: "8px", background: "#222" }} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ width: "80%", height: "14px", background: "#222", borderRadius: "4px" }} />
                  <div style={{ width: "50%", height: "12px", background: "#222", borderRadius: "4px" }} />
                </div>
              </div>
            ))
          ) : highlights.length > 0 ? (
            highlights.slice(0, 3).map((v, i) => (
              <div
                key={`hl-${v.message_id || v.id}-${i}`}
                onClick={() => handleVideoClickInternal(v)}
                style={desktopHighlightCardStyle}
                onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)"}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <div style={desktopHighlightThumbBox}>
                  <img src={v.thumbnail_url} alt="" style={desktopHighlightThumbImg} />
                  <div style={desktopHighlightPlayOverlay}>
                    <Play size={12} fill="#d4d4d8" strokeWidth={0} />
                  </div>
                  {(v.category === "premium" || v.is_premium) && (
                    <div style={desktopHighlightVipTag}>VIP</div>
                  )}
                </div>

                <div style={desktopHighlightInfo}>
                  <p style={desktopHighlightCaption}>
                    {v.caption || APP_CONFIG.defaultCaption}
                  </p>
                  <div style={desktopHighlightMeta}>
                    <span style={{ color: "#8e8e93", fontWeight: "600" }}>
                      {getPostDisplayName(v)}
                    </span>
                    {v.created_at && (
                      <>
                        <span>&middot;</span>
                        <span>{formatTwitterDate(v.created_at)}</span>
                      </>
                    )}
                    <span>&middot;</span>
                    <span>{Number(v.views || 0).toLocaleString()} views</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p style={{ color: "#71767b", fontSize: "13px", padding: "14px 16px", margin: 0 }}>
              No highlights right now.
            </p>
          )}
        </div>
      </div>

      {/* 4. Trends For You Card */}
      <div style={desktopCardStyle}>
        <div style={desktopCardHeaderStyle}>
          <h3 style={desktopCardTitleStyle}>Trends for you</h3>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {trendingTopics.map((item) => (
            <div
              key={item.topic}
              onClick={() => handleTopicClick(item.catId)}
              style={desktopTrendItemStyle}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255, 255, 255, 0.03)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
            >
              <span style={desktopTrendSublabel}>{item.category}</span>
              <span style={desktopTrendTitle}>{item.topic}</span>
              <span style={desktopTrendPosts}>{item.posts}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 5. Mini Legal Footer */}
      <footer style={desktopFooterStyle}>
        <div style={desktopFooterLinks}>
          <a href="/terms" style={desktopFooterLink}>Terms of Service</a>
          <a href="/privacy" style={desktopFooterLink}>Privacy Policy</a>
          <a href="/dmca" style={desktopFooterLink}>DMCA</a>
          <a href="/2257" style={desktopFooterLink}>18 U.S.C. 2257</a>
        </div>
        <div style={desktopFooterCopy}>
          &copy; 2026 NaijaHomemade, Inc.
        </div>
      </footer>
    </aside>
  );
}

// 🟢 STYLES
const desktopRightRailStyle = {
  flex: "1 1 380px",
  minWidth: "350px",
  maxWidth: "440px",
  height: "100vh",
  overflowY: "auto",
  position: "sticky",
  top: 0,
  padding: "16px 18px 120px 18px",
  display: "flex",
  flexDirection: "column",
  gap: "16px",
  boxSizing: "border-box"
};

const desktopSearchBoxWrapper = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "10px 16px",
  borderRadius: "9999px",
  background: "#16181c",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  boxSizing: "border-box",
  transition: "border-color 0.2s ease, background 0.2s ease",
  width: "100%",
  flexShrink: 0
};

const desktopSearchInput = {
  flex: 1,
  background: "transparent",
  border: "none",
  color: "#d4d4d8",
  fontSize: "14px",
  outline: "none"
};

const desktopSearchInputClearBtn = {
  width: "20px",
  height: "20px",
  borderRadius: "50%",
  background: "#71767b",
  border: "none",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  padding: 0
};

const desktopCardStyle = {
  background: "#16181c",
  borderRadius: "16px",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  overflow: "hidden",
  display: "flex",
  flexDirection: "column",
  width: "100%",
  boxSizing: "border-box",
  flexShrink: 0,
  minHeight: "fit-content"
};

const desktopCardHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "14px 16px 10px 16px"
};

const desktopCardTitleStyle = {
  fontSize: "18px",
  fontWeight: "800",
  color: "#d4d4d8",
  margin: 0,
  letterSpacing: "-0.3px"
};

const desktopTrendItemStyle = {
  display: "flex",
  flexDirection: "column",
  padding: "11px 16px",
  cursor: "pointer",
  transition: "background 0.15s ease"
};

const desktopTrendSublabel = {
  fontSize: "12px",
  color: "#71767b",
  marginBottom: "4px"
};

const desktopTrendTitle = {
  fontSize: "15.5px",
  fontWeight: "800",
  color: "#c4c4c8",
  marginBottom: "4px",
  letterSpacing: "-0.2px"
};

const desktopTrendPosts = {
  fontSize: "12.5px",
  color: "#71767b"
};

const desktopHighlightCardStyle = {
  display: "flex",
  gap: "12px",
  padding: "10px 16px",
  cursor: "pointer",
  transition: "background 0.15s ease",
  alignItems: "center"
};

const desktopHighlightThumbBox = {
  width: "68px",
  height: "86px",
  borderRadius: "8px",
  overflow: "hidden",
  background: "#111",
  flexShrink: 0,
  position: "relative"
};

const desktopHighlightThumbImg = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block"
};

const desktopHighlightPlayOverlay = {
  position: "absolute",
  top: "50%",
  left: "50%",
  transform: "translate(-50%, -50%)",
  width: "24px",
  height: "24px",
  borderRadius: "50%",
  background: "rgba(0,0,0,0.65)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const desktopHighlightVipTag = {
  position: "absolute",
  top: 4,
  left: 4,
  background: "rgba(255, 215, 0, 0.9)",
  color: "#000",
  fontSize: "9px",
  fontWeight: "800",
  padding: "1px 5px",
  borderRadius: "4px"
};

const desktopHighlightInfo = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  flexDirection: "column",
  gap: "4px"
};

const desktopHighlightCaption = {
  color: "#c4c4c8",
  fontSize: "13.5px",
  fontWeight: "600",
  margin: "0 0 5px 0",
  lineHeight: "1.4",
  display: "-webkit-box",
  WebkitLineClamp: 2,
  WebkitBoxOrient: "vertical",
  overflow: "hidden"
};

const desktopHighlightMeta = {
  color: "#71767b",
  fontSize: "12px",
  display: "flex",
  alignItems: "center",
  gap: "6px"
};

const desktopHighlightSkeleton = {
  display: "flex",
  gap: "12px",
  padding: "10px 16px",
  alignItems: "center"
};

const desktopCardShowMoreBtn = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  padding: "14px 16px",
  background: "none",
  border: "none",
  borderTop: "1px solid rgba(255, 255, 255, 0.05)",
  color: "var(--primary-color, #f43f5e)",
  fontSize: "14px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "background 0.15s ease",
  textAlign: "left",
  width: "100%"
};

const desktopFooterStyle = {
  padding: "4px 8px",
  display: "flex",
  flexDirection: "column",
  gap: "6px",
  flexShrink: 0
};

const desktopFooterLinks = {
  display: "flex",
  flexWrap: "wrap",
  gap: "8px 12px"
};

const desktopFooterLink = {
  color: "#71767b",
  fontSize: "12px",
  textDecoration: "none"
};

const desktopFooterCopy = {
  color: "#71767b",
  fontSize: "12px",
  marginTop: "4px"
};
