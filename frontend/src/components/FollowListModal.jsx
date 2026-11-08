/* ============================================================================
   Component: FollowListModal.jsx
   Instagram / Twitter-Style Followers & Following List Modal with Privacy Support
   Supports Mobile Fullscreen & Desktop 3-Pane Modular Sidebar Layout
============================================================================ */
import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft } from "lucide-react";
import DesktopLeftSidebar from "./DesktopLeftSidebar";
import DesktopRightSidebar from "./DesktopRightSidebar";
import { APP_CONFIG } from "../config";
import { promptLogin, promptEmailVerification } from "../utils/toast";
import { resolveAvatar, handleAvatarError } from "../utils/avatar";
import { getGlobalFollow, setGlobalFollow } from "../utils/creatorProfileCache";

const API_BASE_URL = APP_CONFIG.apiUrl || "";
const getAuthHeaders = (json = false) => {
  const token = localStorage.getItem("token");
  const headers = {};
  if (json) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};
const resolveAssetUrl = (url, fallback = "/assets/default-avatar.png") => {
  if (!url) return fallback;
  if (url.startsWith("http://") || url.startsWith("https://") || url.startsWith("data:")) return url;
  return url.startsWith("/") ? url : `/${url}`;
};

const followListCache = new Map();

export default function FollowListModal({
  username,
  displayName,
  initialTab = "followers",
  followersCount = 0,
  followingCount = 0,
  isOwner = false,
  currentUser = null,
  onClose,
  onTabChange,
  onSelectUser,
  onCountsChange
}) {
  const cleanUname = String(username || "").replace(/^@/, "").trim().toLowerCase();
  const [activeTab, setActiveTab] = useState(initialTab === "following" ? "following" : "followers");
  const [searchQuery, setSearchQuery] = useState("");

  const cacheKey = `${cleanUname}:${activeTab}:${searchQuery.trim().toLowerCase()}`;
  const initialCached = followListCache.get(cacheKey);

  const [users, setUsers] = useState(initialCached?.users || []);
  const [loading, setLoading] = useState(!initialCached);
  const [isPrivate, setIsPrivate] = useState(Boolean(initialCached?.isPrivate));
  const [privateMessage, setPrivateMessage] = useState(initialCached?.privateMessage || "");
  const [totalCount, setTotalCount] = useState(initialCached?.totalCount ?? 0);
  const [pendingActionIds, setPendingActionIds] = useState({});

  // Responsive desktop detection (standard breakpoint: 1024px)
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth > 1024 : false
  );

  useEffect(() => {
    const handleResize = () => {
      setIsDesktop(window.innerWidth > 1024);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Keyboard navigation (Escape key to close modal)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Synchronize follow changes across the application
  useEffect(() => {
    const handleFollowChange = (e) => {
      const { username: changedUname, isFollowing } = e.detail || {};
      if (changedUname) {
        setUsers(prev =>
          prev.map(u => (u.username && u.username.toLowerCase() === changedUname.toLowerCase() ? { ...u, is_following: isFollowing } : u))
        );
      }
    };
    window.addEventListener("creatorFollowChanged", handleFollowChange);
    return () => window.removeEventListener("creatorFollowChanged", handleFollowChange);
  }, []);

  useEffect(() => {
    const nextTab = initialTab === "following" ? "following" : "followers";
    if (nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [initialTab]);

  const handleSwitchTab = (nextTab) => {
    if (nextTab === activeTab) return;
    setActiveTab(nextTab);
    onTabChange?.(nextTab);
  };

  const fetchList = useCallback(async (tab, query) => {
    if (!username) return;
    const key = `${cleanUname}:${tab}:${query.trim().toLowerCase()}`;
    const cached = followListCache.get(key);
    if (cached) {
      setUsers(cached.users);
      setIsPrivate(cached.isPrivate);
      setPrivateMessage(cached.privateMessage);
      setTotalCount(cached.totalCount);
      setLoading(false);
    } else {
      setLoading(true);
    }

    try {
      const qParam = query.trim() ? `?q=${encodeURIComponent(query.trim())}&limit=80` : `?limit=80`;
      const res = await fetch(
        `${API_BASE_URL}/api/creator/${encodeURIComponent(cleanUname)}/${tab}${qParam}`,
        { headers: getAuthHeaders() }
      );
      if (res.ok) {
        const data = await res.json();
        const nextIsPrivate = Boolean(data.is_private);
        const nextMsg = data.message || `This account's ${tab} list is private.`;
        const nextUsers = Array.isArray(data.users) ? data.users : [];
        const nextTotal = Number(data.total || 0);

        setIsPrivate(nextIsPrivate);
        setPrivateMessage(nextMsg);
        setUsers(nextUsers);
        setTotalCount(nextTotal);

        followListCache.set(key, {
          users: nextUsers,
          isPrivate: nextIsPrivate,
          privateMessage: nextMsg,
          totalCount: nextTotal
        });
      } else if (!cached) {
        setUsers([]);
      }
    } catch (err) {
      console.error("[FollowListModal] Fetch error:", err);
      if (!cached) setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [username, cleanUname]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchList(activeTab, searchQuery);
    }, searchQuery ? 220 : 0);
    return () => clearTimeout(timer);
  }, [activeTab, searchQuery, fetchList]);

  const handleToggleFollow = async (targetUser, e) => {
    e.stopPropagation();
    if (!currentUser) {
      onClose?.();
      promptLogin("follow");
      return;
    }
    if (!currentUser.email_verified && currentUser.role !== "admin") {
      promptEmailVerification({ reason: "follow", email: currentUser.email });
      return;
    }
    const uid = targetUser.id;
    if (pendingActionIds[uid]) return;

    setPendingActionIds(prev => ({ ...prev, [uid]: true }));
    const prevFollowing = Boolean(targetUser.is_following);

    // Optimistic update
    setUsers(prev =>
      prev.map(u => (u.id === uid ? { ...u, is_following: !prevFollowing } : u))
    );

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/creator/${encodeURIComponent(targetUser.username)}/follow`,
        {
          method: "POST",
          headers: getAuthHeaders()
        }
      );
      if (res.ok) {
        const data = await res.json();
        setGlobalFollow(targetUser.username, Boolean(data.following));
        setUsers(prev => {
          const updated = prev.map(u => (u.id === uid ? { ...u, is_following: Boolean(data.following) } : u));
          const key = `${cleanUname}:${activeTab}:${searchQuery.trim().toLowerCase()}`;
          const existing = followListCache.get(key);
          if (existing) {
            followListCache.set(key, { ...existing, users: updated });
          }
          return updated;
        });
        if (isOwner && activeTab === "following") {
          onCountsChange?.({ followingDelta: data.following ? 1 : -1 });
        }
      } else {
        setUsers(prev =>
          prev.map(u => (u.id === uid ? { ...u, is_following: prevFollowing } : u))
        );
      }
    } catch (err) {
      setUsers(prev =>
        prev.map(u => (u.id === uid ? { ...u, is_following: prevFollowing } : u))
      );
    } finally {
      setPendingActionIds(prev => ({ ...prev, [uid]: false }));
    }
  };

  const handleRemoveFollower = async (targetUser, e) => {
    e.stopPropagation();
    const uid = targetUser.id;
    if (pendingActionIds[`rm_${uid}`]) return;

    setPendingActionIds(prev => ({ ...prev, [`rm_${uid}`]: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/creator/followers/${uid}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setUsers(prev => {
          const updated = prev.filter(u => u.id !== uid);
          const key = `${cleanUname}:${activeTab}:${searchQuery.trim().toLowerCase()}`;
          const existing = followListCache.get(key);
          if (existing) {
            followListCache.set(key, {
              ...existing,
              users: updated,
              totalCount: Math.max(0, (existing.totalCount || 1) - 1)
            });
          }
          return updated;
        });
        setTotalCount(prev => Math.max(0, prev - 1));
        onCountsChange?.({ followersDelta: -1 });
      }
    } catch (err) {
      console.error("Failed to remove follower:", err);
    } finally {
      setPendingActionIds(prev => ({ ...prev, [`rm_${uid}`]: false }));
    }
  };

  const handleUserRowClick = (u) => {
    if (!u?.username) return;
    if (onSelectUser) {
      onSelectUser(u.username);
    } else {
      onClose?.();
      window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: { username: u.username } }));
    }
  };

  if (typeof document === "undefined") return null;

  // Render the core follow list contents (Tabs, Search, and User items)
  const renderFollowListBody = () => (
    <>
      {/* Segmented Tabs: Followers | Following */}
      <div style={isDesktop ? styles.tabsRowDesktop : styles.tabsRow}>
        <button
          onClick={() => handleSwitchTab("followers")}
          className="follow-tab-btn"
          style={{
            ...styles.tabBtn,
            color: activeTab === "followers" ? "#f4f4f5" : "#71717a",
            borderBottom: activeTab === "followers" ? "2px solid #f4f4f5" : "2px solid transparent"
          }}
        >
          <span style={{ fontWeight: "800", color: activeTab === "followers" ? "#f4f4f5" : "#a1a1aa" }}>
            {activeTab === "followers" && !loading && !isPrivate ? totalCount : followersCount}
          </span>{" "}
          Followers
        </button>
        <button
          onClick={() => handleSwitchTab("following")}
          className="follow-tab-btn"
          style={{
            ...styles.tabBtn,
            color: activeTab === "following" ? "#f4f4f5" : "#71717a",
            borderBottom: activeTab === "following" ? "2px solid #f4f4f5" : "2px solid transparent"
          }}
        >
          <span style={{ fontWeight: "800", color: activeTab === "following" ? "#f4f4f5" : "#a1a1aa" }}>
            {activeTab === "following" && !loading && !isPrivate ? totalCount : followingCount}
          </span>{" "}
          Following
        </button>
      </div>

      {/* Search Input (hidden if private) */}
      {!isPrivate && (
        <div style={isDesktop ? styles.searchWrapDesktop : styles.searchWrap}>
          <div style={styles.searchBox}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              style={styles.searchInput}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={styles.clearSearchBtn}
                title="Clear search"
                aria-label="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* List Body */}
      <div style={isDesktop ? styles.listContainerDesktop : styles.listContainer}>
        {loading ? (
          <div style={styles.centerState}>
            <div className="spinner" style={{ width: 26, height: 26, borderWidth: 2 }} />
            <span style={{ color: "#71717a", fontSize: 13, marginTop: 10 }}>
              Loading {activeTab}...
            </span>
          </div>
        ) : isPrivate ? (
          <div style={styles.privateState}>
            <div style={styles.lockCircle}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#a1a1aa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
            <h4 style={{ margin: "12px 0 6px", fontSize: 16, fontWeight: 700, color: "#f4f4f5" }}>
              This List is Private
            </h4>
            <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", lineHeight: 1.5, maxWidth: 280 }}>
              {privateMessage || `Only @${cleanUname} can see who they follow or who follows them.`}
            </p>
          </div>
        ) : users.length === 0 ? (
          <div style={styles.centerState}>
            <div style={{ fontSize: 32, marginBottom: 8, opacity: 0.6 }}>👥</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#e4e4e7" }}>
              {searchQuery ? "No matching accounts found" : activeTab === "followers" ? "No followers yet" : "Not following anyone yet"}
            </div>
            <div style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>
              {searchQuery
                ? "Try searching for a different username or name."
                : activeTab === "followers"
                ? `When people follow @${cleanUname}, they'll appear here.`
                : `Accounts followed by @${cleanUname} will appear here.`}
            </div>
          </div>
        ) : (
          users.map((u) => {
            const isMe = currentUser && Number(currentUser.id) === Number(u.id);
            const avatarSrc = resolveAvatar(u.avatar_url, u.display_name || u.username, u.id || u.username);

            return (
              <div
                key={`${activeTab}_${u.id}_${u.username}`}
                className="follow-user-row"
                style={isDesktop ? styles.userRowDesktop : styles.userRow}
                onClick={() => handleUserRowClick(u)}
              >
                <img
                  src={avatarSrc}
                  alt={u.username}
                  crossOrigin="anonymous"
                  referrerPolicy="no-referrer-when-downgrade"
                  style={styles.avatar}
                  onError={(e) => handleAvatarError(e, u.display_name || u.username, u.id || u.username)}
                />

                <div style={styles.userMainCol}>
                  {/* Top Row: Name & Handle on Left, Action Button on Right */}
                  <div style={styles.userTopRow}>
                    <div style={styles.userInfo}>
                      <div style={styles.nameRow}>
                        <span style={styles.displayName}>
                          {u.display_name || u.username}
                        </span>
                        {u.is_verified && (
                          <span style={styles.verifiedBadge} title="Verified">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                              <circle cx="12" cy="12" r="10" fill="#3897f0" />
                              <path d="M8 12.5L10.8 15.3L16 9.5" stroke="#d4d4d8" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        )}
                      </div>
                      <div style={styles.handleRow}>
                        <span style={styles.handleText}>@{u.username}</span>
                        {u.follows_you && !isMe && (
                          <span style={styles.followsYouBadge}>Follows you</span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons at Top Right */}
                    <div style={styles.actionsWrap} onClick={(e) => e.stopPropagation()}>
                      {!isMe && (
                        <button
                          onClick={(e) => handleToggleFollow(u, e)}
                          disabled={Boolean(pendingActionIds[u.id])}
                          style={
                            u.is_following
                              ? styles.followingBtn
                              : u.follows_you
                              ? styles.followBackBtn
                              : styles.followBtn
                          }
                        >
                          {u.is_following
                            ? "Following"
                            : u.follows_you
                            ? "Follow back"
                            : "Follow"}
                        </button>
                      )}

                      {isOwner && activeTab === "followers" && !isMe && (
                        <button
                          onClick={(e) => handleRemoveFollower(u, e)}
                          disabled={Boolean(pendingActionIds[`rm_${u.id}`])}
                          style={styles.removeBtn}
                          title="Remove follower"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Bio flows across full width below the button */}
                  {Boolean(u.creator_bio && u.creator_bio.trim()) && (
                    <div style={styles.bioText} title={u.creator_bio}>
                      {u.creator_bio}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );

  return createPortal(
    <div style={styles.pageContainer}>
      {isDesktop ? (
        /* 🌟 DESKTOP 3-PANE MODULAR LAYOUT (Twitter/X Inspired) */
        <div style={styles.desktopContainerStyle}>
          <div style={styles.desktopInnerWrapperStyle}>
            {/* 1. LEFT SIDEBAR: Navigation Rail */}
            <DesktopLeftSidebar
              user={currentUser}
              activeNav={isOwner ? "profile" : "creators"}
              onNavigateHome={() => {
                onClose?.();
                window.location.href = "/";
              }}
              onProfileClick={() => {
                onClose?.();
                window.location.href = "/?tab=profile";
              }}
              onOpenDiscover={() => {
                onClose?.();
                window.dispatchEvent(new CustomEvent("openDiscoverCreatorsModal"));
              }}
              onPostClick={onClose}
              onSelectCategory={(catId) => {
                onClose?.();
                window.location.href = `/?tab=explore&category=${catId}`;
              }}
              onTabSwitch={(tab) => {
                onClose?.();
                if (tab === "community") window.location.href = "/?tab=explore&sub=community";
                else window.location.href = "/?tab=explore";
              }}
            />

            {/* 2. MIDDLE COLUMN: Follow List Rail */}
            <div
              className="custom-scrollbar"
              style={styles.desktopCenterRailStyle}
            >
              {/* Desktop Sticky Header with Back Button */}
              <div style={styles.desktopStickyHeaderStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: 0 }}>
                  <button
                    onClick={onClose}
                    className="desktop-back-btn"
                    style={styles.desktopBackBtnStyle}
                    title="Back"
                    aria-label="Back"
                  >
                    <ArrowLeft size={24} strokeWidth={2.6} color="#f4f4f5" />
                  </button>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={styles.desktopHeaderTitleStyle}>
                        {displayName || `@${cleanUname}`}
                      </span>
                    </div>
                    <span style={{ fontSize: "12px", color: "#8e8e93" }}>
                      @{cleanUname}
                    </span>
                  </div>
                </div>
              </div>

              {/* Main List Body */}
              {renderFollowListBody()}
            </div>

            {/* 3. RIGHT SIDEBAR: Highlights, Trends & Featured Creators */}
            <DesktopRightSidebar
              user={currentUser}
              onCreatorClick={(uname) => {
                const cleanTarget = String(uname || "").replace(/^@/, "").trim();
                if (!cleanTarget) return;
                if (cleanTarget.toLowerCase() === cleanUname) {
                  onClose?.();
                  return;
                }
                if (onSelectUser) {
                  onSelectUser(cleanTarget);
                } else {
                  onClose?.();
                  window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: { username: cleanTarget } }));
                }
              }}
              onVideoClick={(v) => {
                onClose?.();
                window.dispatchEvent(new CustomEvent("openVideoModal", { detail: v }));
              }}
              onOpenDiscover={() => {
                onClose?.();
                window.dispatchEvent(new CustomEvent("openDiscoverCreatorsModal"));
              }}
              onSelectTopic={(catId) => {
                onClose?.();
                window.location.href = `/?tab=explore&category=${catId}`;
              }}
              onSearchSubmit={(q) => {
                onClose?.();
                window.location.href = `/?tab=explore&q=${encodeURIComponent(q)}`;
              }}
            />
          </div>
        </div>
      ) : (
        /* 📱 MOBILE VIEW (Full-Screen Clean Instagram-Style View) */
        <>
          {/* Top Navbar matching CreatorProfileModal & SettingsView */}
          <div style={styles.topNav}>
            <button onClick={onClose} style={styles.backBtn} title="Back" aria-label="Back">
              <ArrowLeft size={28} strokeWidth={2.7} color="#f4f4f5" />
            </button>
            <div style={styles.headerTitle}>
              @{cleanUname}
            </div>
            <div style={{ width: 34 }} />
          </div>

          {/* Centered Content Container */}
          <div style={styles.contentWrapper}>
            {renderFollowListBody()}
          </div>
        </>
      )}

      <style>{`
        @keyframes followPageSlideUp {
          from {
            opacity: 0;
            transform: translateY(18px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .follow-user-row:hover {
          background-color: rgba(255, 255, 255, 0.025);
        }
        .desktop-back-btn:hover {
          background-color: rgba(255, 255, 255, 0.12) !important;
        }
        .follow-tab-btn:hover {
          background-color: rgba(255, 255, 255, 0.03);
        }
      `}</style>
    </div>,
    document.body
  );
}

const styles = {
  pageContainer: {
    position: "fixed",
    inset: 0,
    backgroundColor: "#09090b",
    zIndex: 1000250,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    color: "#f4f4f5",
    animation: "followPageSlideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1) forwards"
  },
  // 🌟 DESKTOP 3-PANE LAYOUT STYLES
  desktopContainerStyle: {
    display: "flex",
    justifyContent: "center",
    width: "100%",
    height: "100vh",
    overflow: "hidden",
    backgroundColor: "#09090b"
  },
  desktopInnerWrapperStyle: {
    display: "flex",
    justifyContent: "center",
    width: "100%",
    maxWidth: "1420px",
    height: "100vh",
    position: "relative"
  },
  desktopCenterRailStyle: {
    flex: 1,
    maxWidth: "680px",
    width: "100%",
    minWidth: 0,
    height: "100vh",
    overflowY: "auto",
    borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
    borderRight: "1px solid rgba(255, 255, 255, 0.08)",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    backgroundColor: "#09090b"
  },
  desktopStickyHeaderStyle: {
    position: "sticky",
    top: 0,
    zIndex: 95,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 20px",
    backgroundColor: "rgba(9, 9, 11, 0.85)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    minHeight: "53px",
    boxSizing: "border-box"
  },
  desktopHeaderTitleStyle: {
    fontSize: "18px",
    fontWeight: "800",
    color: "#f4f4f5",
    letterSpacing: "-0.3px",
    margin: 0
  },
  desktopBackBtnStyle: {
    background: "rgba(255, 255, 255, 0.06)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "50%",
    minWidth: "42px",
    minHeight: "42px",
    width: "42px",
    height: "42px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: "pointer",
    transition: "all 0.15s ease",
    flexShrink: 0
  },
  // MOBILE NAVIGATION & WRAPPER
  topNav: {
    height: "48px",
    padding: "0 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#09090b",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    flexShrink: 0,
    zIndex: 10
  },
  backBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    minWidth: "48px",
    minHeight: "48px",
    width: "48px",
    height: "48px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0",
    margin: "0 0 0 -10px",
    outline: "none",
    touchAction: "manipulation",
    WebkitTapHighlightColor: "transparent",
    color: "#f4f4f5"
  },
  headerTitle: {
    fontSize: "16px",
    fontWeight: "700",
    color: "#f4f4f5",
    letterSpacing: "-0.2px"
  },
  contentWrapper: {
    width: "100%",
    maxWidth: "600px",
    margin: "0 auto",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden"
  },
  // TABS
  tabsRow: {
    display: "flex",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    flexShrink: 0,
    backgroundColor: "#09090b"
  },
  tabsRowDesktop: {
    display: "flex",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    flexShrink: 0,
    position: "sticky",
    top: "53px",
    zIndex: 90,
    backgroundColor: "rgba(9, 9, 11, 0.88)",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)"
  },
  tabBtn: {
    flex: 1,
    background: "transparent",
    border: "none",
    padding: "14px 10px",
    fontSize: "14.5px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.15s ease",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px"
  },
  // SEARCH
  searchWrap: {
    padding: "12px 16px 8px",
    flexShrink: 0
  },
  searchWrapDesktop: {
    padding: "14px 20px 10px",
    flexShrink: 0
  },
  searchBox: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "#18181b",
    borderRadius: "10px",
    padding: "9px 12px",
    border: "1px solid rgba(255, 255, 255, 0.08)"
  },
  searchInput: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "#f4f4f5",
    fontSize: "14px"
  },
  clearSearchBtn: {
    background: "transparent",
    border: "none",
    color: "#71717a",
    cursor: "pointer",
    fontSize: "12px",
    padding: "2px 4px"
  },
  // LIST CONTAINERS
  listContainer: {
    flex: 1,
    overflowY: "auto",
    padding: "6px 16px 40px"
  },
  listContainerDesktop: {
    flex: 1,
    padding: "6px 20px 60px"
  },
  centerState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "72px 20px",
    textAlign: "center"
  },
  privateState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    padding: "76px 24px",
    textAlign: "center"
  },
  lockCircle: {
    width: "60px",
    height: "60px",
    borderRadius: "50%",
    background: "#18181b",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  // ROWS & ITEMS
  userRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "13px 4px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
    cursor: "pointer",
    transition: "background-color 0.15s ease"
  },
  userRowDesktop: {
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
    padding: "14px 8px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
    cursor: "pointer",
    borderRadius: "8px",
    transition: "background-color 0.15s ease"
  },
  avatar: {
    width: "44px",
    height: "44px",
    borderRadius: "50%",
    objectFit: "cover",
    background: "#27272a",
    flexShrink: 0,
    marginTop: "2px"
  },
  userMainCol: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column"
  },
  userTopRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "10px",
    width: "100%"
  },
  userInfo: {
    flex: 1,
    minWidth: 0
  },
  nameRow: {
    display: "flex",
    alignItems: "center",
    gap: "5px"
  },
  displayName: {
    fontSize: "14.5px",
    fontWeight: "700",
    color: "#f4f4f5",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  verifiedBadge: {
    display: "inline-flex",
    alignItems: "center",
    flexShrink: 0
  },
  handleRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "1px"
  },
  handleText: {
    fontSize: "12.5px",
    color: "#a1a1aa",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  followsYouBadge: {
    fontSize: "10px",
    fontWeight: "600",
    color: "#a1a1aa",
    background: "rgba(255, 255, 255, 0.08)",
    padding: "1px 6px",
    borderRadius: "4px",
    letterSpacing: "0.2px",
    flexShrink: 0
  },
  bioText: {
    fontSize: "12.5px",
    lineHeight: "1.4",
    color: "#a1a1aa",
    marginTop: "6px",
    display: "-webkit-box",
    WebkitLineClamp: 2,
    WebkitBoxOrient: "vertical",
    overflow: "hidden",
    textOverflow: "ellipsis",
    wordBreak: "break-word",
    width: "100%"
  },
  actionsWrap: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexShrink: 0
  },
  followBtn: {
    background: "#f4f4f5",
    color: "#09090b",
    border: "none",
    borderRadius: "9999px",
    height: "36px",
    minWidth: "86px",
    padding: "0 16px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    letterSpacing: "-0.2px",
    transition: "all 0.15s ease",
    userSelect: "none"
  },
  followBackBtn: {
    background: "#f4f4f5",
    color: "#09090b",
    border: "none",
    borderRadius: "9999px",
    height: "36px",
    minWidth: "100px",
    padding: "0 16px",
    fontSize: "13px",
    fontWeight: "700",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    letterSpacing: "-0.2px",
    transition: "all 0.15s ease",
    userSelect: "none"
  },
  followingBtn: {
    background: "rgba(255, 255, 255, 0.06)",
    color: "#f4f4f5",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    borderRadius: "9999px",
    height: "36px",
    minWidth: "96px",
    padding: "0 16px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    letterSpacing: "-0.2px",
    transition: "all 0.15s ease",
    userSelect: "none"
  },
  removeBtn: {
    background: "#27272a",
    color: "#a1a1aa",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "9999px",
    height: "36px",
    padding: "0 14px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s ease",
    userSelect: "none"
  }
};
