/* ============================================================================
   Component: FollowListModal.jsx
   Instagram-Style Followers & Following List Modal with Privacy Support
============================================================================ */
import React, { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { APP_CONFIG } from "../config";
import { promptLogin } from "../utils/toast";

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
      window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: u.username }));
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <div style={styles.pageContainer}>
      {/* Top Navbar matching CreatorProfileModal & SettingsView */}
      <div style={styles.topNav}>
        <button onClick={onClose} style={styles.backBtn} title="Back" aria-label="Back">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f4f4f5" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <div style={styles.headerTitle}>
          @{String(username || "").replace(/^@/, "")}
        </div>
        <div style={{ width: 34 }} />
      </div>

      {/* Centered Content Container */}
      <div style={styles.contentWrapper}>
        {/* Segmented Tabs: Followers | Following */}
        <div style={styles.tabsRow}>
          <button
            onClick={() => handleSwitchTab("followers")}
            style={{
              ...styles.tabBtn,
              color: activeTab === "followers" ? "#f4f4f5" : "#71717a",
              borderBottom: activeTab === "followers" ? "2px solid #f4f4f5" : "2px solid transparent"
            }}
          >
            <span>{activeTab === "followers" && !loading && !isPrivate ? totalCount : followersCount}</span>{" "}
            Followers
          </button>
          <button
            onClick={() => handleSwitchTab("following")}
            style={{
              ...styles.tabBtn,
              color: activeTab === "following" ? "#f4f4f5" : "#71717a",
              borderBottom: activeTab === "following" ? "2px solid #f4f4f5" : "2px solid transparent"
            }}
          >
            <span>{activeTab === "following" && !loading && !isPrivate ? totalCount : followingCount}</span>{" "}
            Following
          </button>
        </div>

        {/* Search Input (hidden if private) */}
        {!isPrivate && (
          <div style={styles.searchWrap}>
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
                >
                  ✕
                </button>
              )}
            </div>
          </div>
        )}

        {/* List Body */}
        <div style={styles.listContainer}>
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
                {privateMessage || `Only @${String(username || "").replace(/^@/, "")} can see who they follow or who follows them.`}
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
                  ? `When people follow @${String(username || "").replace(/^@/, "")}, they'll appear here.`
                  : `Accounts followed by @${String(username || "").replace(/^@/, "")} will appear here.`}
              </div>
            </div>
          ) : (
            users.map((u) => {
              const isMe = currentUser && Number(currentUser.id) === Number(u.id);
              const avatarSrc = resolveAssetUrl(u.avatar_url) || "/assets/default-avatar.png";

              return (
                <div
                  key={`${activeTab}_${u.id}_${u.username}`}
                  style={styles.userRow}
                  onClick={() => handleUserRowClick(u)}
                >
                  <img
                    src={avatarSrc}
                    alt={u.username}
                    style={styles.avatar}
                    onError={(e) => {
                      e.target.onerror = null;
                      e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(u.display_name || u.username || "U")}&background=27272a&color=f4f4f5&bold=true`;
                    }}
                  />

                  <div style={styles.userInfo}>
                    <div style={styles.nameRow}>
                      <span style={styles.displayName}>
                        {u.display_name || u.username}
                      </span>
                      {u.is_verified && (
                        <span style={styles.verifiedBadge} title="Verified">
                          <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" fill="#3897f0" />
                            <path d="M8 12.5L10.8 15.3L16 9.5" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      )}
                      {u.is_creator && (
                        <span style={styles.creatorTag}>Creator</span>
                      )}
                    </div>
                    <div style={styles.handleText}>@{u.username}</div>
                  </div>

                  {/* Action Buttons */}
                  <div style={styles.actionsWrap} onClick={(e) => e.stopPropagation()}>
                    {!isMe && (
                      <button
                        onClick={(e) => handleToggleFollow(u, e)}
                        disabled={Boolean(pendingActionIds[u.id])}
                        style={u.is_following ? styles.followingBtn : styles.followBtn}
                      >
                        {u.is_following ? "Following" : "Follow"}
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
              );
            })
          )}
        </div>
      </div>

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
    padding: "6px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
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
  tabsRow: {
    display: "flex",
    borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
    flexShrink: 0
  },
  tabBtn: {
    flex: 1,
    background: "transparent",
    border: "none",
    padding: "13px 10px",
    fontSize: "14px",
    fontWeight: "700",
    cursor: "pointer",
    transition: "all 0.15s ease"
  },
  searchWrap: {
    padding: "12px 16px 8px",
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
  listContainer: {
    flex: 1,
    overflowY: "auto",
    padding: "6px 16px 40px"
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
  userRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "11px 4px",
    borderBottom: "1px solid rgba(255, 255, 255, 0.04)",
    cursor: "pointer"
  },
  avatar: {
    width: "46px",
    height: "46px",
    borderRadius: "50%",
    objectFit: "cover",
    background: "#27272a",
    flexShrink: 0
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
    fontSize: "14px",
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
  creatorTag: {
    fontSize: "10px",
    fontWeight: "700",
    padding: "1px 6px",
    borderRadius: "4px",
    background: "rgba(225, 29, 72, 0.14)",
    color: "#f43f5e",
    flexShrink: 0
  },
  handleText: {
    fontSize: "12.5px",
    color: "#a1a1aa",
    marginTop: "1px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis"
  },
  actionsWrap: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexShrink: 0
  },
  followBtn: {
    background: "#e4e4e7",
    color: "#09090b",
    border: "none",
    borderRadius: "8px",
    padding: "7px 14px",
    fontSize: "12px",
    fontWeight: "700",
    cursor: "pointer"
  },
  followingBtn: {
    background: "rgba(255, 255, 255, 0.08)",
    color: "#a1a1aa",
    border: "1px solid rgba(255, 255, 255, 0.12)",
    borderRadius: "8px",
    padding: "6px 12px",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer"
  },
  removeBtn: {
    background: "#27272a",
    color: "#a1a1aa",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "8px",
    padding: "6px 10px",
    fontSize: "11px",
    fontWeight: "600",
    cursor: "pointer"
  }
};
