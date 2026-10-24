import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  ArrowLeft, Share2, Heart, Lock, Grid3X3, 
  MapPin, Globe, Sparkles, Send, Play, Loader2, MessageCircle,
  Film, Link2, ChevronDown, Plus
} from "lucide-react";
import { APP_CONFIG } from "../config";
import VideoCard from "./VideoCard";
import FeedPost from "./FeedPost";
import PostOptionsModal from "./PostOptionsModal";
import ReportModal from "./ReportModal";
import CreatorTipModal from "./CreatorTipModal";
import CreatorSubscribeModal from "./CreatorSubscribeModal";
import TwitterVerifiedBadge from "./TwitterVerifiedBadge";
import StoryAvatar from "./StoryAvatar";
import StoryHighlightsTray from "./StoryHighlightsTray";
import FollowListModal from "./FollowListModal";
import { promptLogin, showToast } from "../utils/toast";

export default function CreatorProfileModal({ 
  creatorUsername, 
  currentUser, 
  onClose, 
  onVideoClick, 
  autoOpenSubscribe = false,
  setShowPaywall,
  onSubscriptionUpdated,
  onCommentClick
}) {
  const normalizedTarget = String(creatorUsername || "").toLowerCase().replace(/^@/, "").trim();
  const [creatorData, setCreatorData] = useState(null);
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("posts");
  const [isFollowing, setIsFollowing] = useState(false);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [followListTab, setFollowListTab] = useState(() => {
    const st = window.history.state || {};
    return (st.creatorFollowList && st.creatorFollowListUser === normalizedTarget) ? st.creatorFollowList : null;
  });
  const followListTabRef = useRef(followListTab);
  useEffect(() => {
    followListTabRef.current = followListTab;
  }, [followListTab]);

  const [isFollowLoading, setIsFollowLoading] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscribersCount, setSubscribersCount] = useState(0);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [optionsVideo, setOptionsVideo] = useState(null);
  const [reportedVideo, setReportedVideo] = useState(null);
  const [highlights, setHighlights] = useState([]);
  const isAnyModalOpen = Boolean(showTipModal || showSubscribeModal || optionsVideo || reportedVideo || followListTab);
  const [tabVideos, setTabVideos] = useState({
    posts: [],
    reels: [],
    premium: []
  });
  const [tabPages, setTabPages] = useState({
    posts: 1,
    reels: 1,
    premium: 1
  });
  const [tabHasMore, setTabHasMore] = useState({
    posts: false,
    reels: false,
    premium: false
  });
  const [tabLoading, setTabLoading] = useState({
    posts: false,
    reels: false,
    premium: false
  });
  const [loadedTabs, setLoadedTabs] = useState({
    posts: true,
    reels: false,
    premium: false
  });

  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleOpenFollowList = useCallback((tab) => {
    followListTabRef.current = tab;
    setFollowListTab(tab);
    const currentState = window.history.state || {};
    if (!currentState.creatorFollowList || currentState.creatorFollowListUser !== normalizedTarget) {
      window.history.pushState(
        { ...currentState, creatorFollowList: tab, creatorFollowListUser: normalizedTarget },
        document.title,
        window.location.href
      );
    } else if (currentState.creatorFollowList !== tab) {
      window.history.replaceState(
        { ...currentState, creatorFollowList: tab, creatorFollowListUser: normalizedTarget },
        document.title,
        window.location.href
      );
    }
  }, [normalizedTarget]);

  const handleFollowListTabChange = useCallback((newTab) => {
    followListTabRef.current = newTab;
    setFollowListTab(newTab);
    const currentState = window.history.state || {};
    if (currentState.creatorFollowList && currentState.creatorFollowList !== newTab) {
      window.history.replaceState(
        { ...currentState, creatorFollowList: newTab, creatorFollowListUser: normalizedTarget },
        document.title,
        window.location.href
      );
    }
  }, [normalizedTarget]);

  const handleCloseFollowList = useCallback(() => {
    followListTabRef.current = null;
    setFollowListTab(null);
    if (window.history.state?.creatorFollowList) {
      window.history.back();
    }
  }, []);

  useEffect(() => {
    const syncFollowListFromHistory = (stateObj) => {
      const st = stateObj || window.history.state || {};
      if (
        st.creatorFollowList &&
        st.creatorFollowListUser === normalizedTarget &&
        !st.videoPlayer &&
        !st.storyPlayer
      ) {
        if (followListTabRef.current !== st.creatorFollowList) {
          followListTabRef.current = st.creatorFollowList;
          setFollowListTab(st.creatorFollowList);
        }
      } else if (followListTabRef.current) {
        followListTabRef.current = null;
        setFollowListTab(null);
      }
    };

    syncFollowListFromHistory(window.history.state);

    const handlePopState = (e) => {
      syncFollowListFromHistory(e.state || {});
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [normalizedTarget]);

  const fetchTabVideos = useCallback(async (targetTab, targetPage = 1, isAppend = false) => {
    setTabLoading(prev => ({ ...prev, [targetTab]: true }));
    try {
      const cleanUsername = String(creatorUsername || "").replace(/^@/, "").trim();
      const token = localStorage.getItem("token");
      const headers = {};
      if (token) headers.Authorization = `Bearer ${token}`;

      const res = await fetch(
        `${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(cleanUsername)}/videos?tab=${targetTab}&page=${targetPage}&limit=12`,
        { headers }
      );
      const data = await res.json();
      if (data?.videos) {
        setTabVideos(prev => {
          const prevList = isAppend ? (prev[targetTab] || []) : [];
          const map = new Map();
          prevList.forEach(v => map.set(`${v.chat_id}:${v.message_id}`, v));
          data.videos.forEach(v => map.set(`${v.chat_id}:${v.message_id}`, v));
          return {
            ...prev,
            [targetTab]: Array.from(map.values())
          };
        });
        setTabPages(prev => ({ ...prev, [targetTab]: targetPage }));
        setTabHasMore(prev => ({ ...prev, [targetTab]: Boolean(data.hasMore) }));
        setLoadedTabs(prev => ({ ...prev, [targetTab]: true }));
      }
    } catch (err) {
      console.error(`Failed to load ${targetTab} videos`, err);
    } finally {
      setTabLoading(prev => ({ ...prev, [targetTab]: false }));
    }
  }, [creatorUsername]);

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError("");

    const fetchCreator = async () => {
      try {
        const cleanUsername = String(creatorUsername || "").replace(/^@/, "").trim();
        const token = localStorage.getItem("token");
        const headers = {};
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(cleanUsername)}`, { headers });
        if (!res.ok) throw new Error("Creator not found");

        const data = await res.json();
        if (isMounted) {
          setCreatorData(data.creator);

          const initialVideos = data.videos || [];
          setVideos(initialVideos);
          setTabVideos(prev => ({
            ...prev,
            posts: initialVideos
          }));
          const isSub = Boolean(data.creator.is_subscribed);
          const isFoll = Boolean(data.creator.is_following);
          setIsSubscribed(isSub);
          setIsFollowing(isFoll);
          setSubscribersCount(Number(data.creator.stats?.subscribers || 0));
          setFollowersCount(Number(data.creator.stats?.followers || 0));
          setFollowingCount(Number(data.creator.stats?.following || 0));
          const st = window.history.state || {};
          const restoredTab = (st.creatorFollowList && st.creatorFollowListUser === normalizedTarget) ? st.creatorFollowList : null;
          followListTabRef.current = restoredTab;
          setFollowListTab(restoredTab);
          setHighlights(data.creator.highlights || []);
          setTabHasMore(prev => ({
            ...prev,
            posts: Boolean(initialVideos.length >= 12)
          }));
          setTabPages(prev => ({
            ...prev,
            posts: 1
          }));
          setLoadedTabs({
            posts: true,
            reels: false,
            premium: false
          });

          if (autoOpenSubscribe && !isSub && !data.creator.is_owner) {
            const token = localStorage.getItem("token");
            if (!token) {
              promptLogin("subscribe");
            } else {
              setShowSubscribeModal(true);
            }
          }
        }
      } catch (err) {
        if (isMounted) setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchCreator();

    return () => {
      isMounted = false;
    };
  }, [creatorUsername, normalizedTarget]);

  useEffect(() => {
    if (!creatorData) return;
    if (activeTab === "premium" && !loadedTabs.premium && !tabLoading.premium) {
      fetchTabVideos("premium", 1, false);
    } else if (activeTab === "reels" && !loadedTabs.reels && !tabLoading.reels) {
      fetchTabVideos("reels", 1, false);
    } else if (activeTab === "posts" && !loadedTabs.posts && !tabLoading.posts) {
      fetchTabVideos("posts", 1, false);
    }
  }, [activeTab, creatorData, loadedTabs, tabLoading, fetchTabVideos]);

  useEffect(() => {
    if (autoOpenSubscribe && !isSubscribed && creatorData && !creatorData.is_owner && Number(creatorData.subscription_price || 0) > 0) {
      const token = localStorage.getItem("token");
      if (!token) {
        promptLogin("subscribe");
      } else {
        setShowSubscribeModal(true);
      }
    }
  }, [autoOpenSubscribe, isSubscribed, creatorData]);

  const handleLoadMoreVideos = () => {
    const curLoading = tabLoading[activeTab];
    const curHasMore = tabHasMore[activeTab];
    if (curLoading || !curHasMore) return;
    const nextPage = (tabPages[activeTab] || 1) + 1;
    fetchTabVideos(activeTab, nextPage, true);
  };

  const handleFollowToggle = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      promptLogin("follow");
      return;
    }

    if (creatorData?.is_owner) {
      showToast("This is your own profile!", "info");
      return;
    }

    setIsFollowLoading(true);
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(creatorUsername)}/follow`, {
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
      setIsFollowing(Boolean(data.following));
      if (typeof data.followers_count === "number") {
        setFollowersCount(data.followers_count);
      }
      showToast(data.following ? `Following @${creatorUsername}` : `Unfollowed @${creatorUsername}`, data.following ? "success" : "error");
      window.dispatchEvent(new CustomEvent("refreshUser"));
    } catch (e) {
      showToast(e.message || "Failed to update follow", "error");
    } finally {
      setIsFollowLoading(false);
    }
  };

  const handleSubscribeToggle = async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      promptLogin("subscribe");
      return;
    }

    if (creatorData?.is_owner) {
      showToast("This is your own profile!", "info");
      return;
    }

    const price = Number(creatorData?.subscription_price || 0);

    // If currently subscribed, confirm cancellation
    if (isSubscribed) {
      const confirmed = window.confirm(`Are you sure you want to cancel your VIP subscription to @${creatorData?.username || creatorUsername}?`);
      if (!confirmed) return;

      setIsSubscribing(true);
      try {
        const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(creatorUsername)}/subscribe`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          }
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to cancel subscription");
        }
        setIsSubscribed(false);
        setSubscribersCount(data.subscribers_count);
        showToast("VIP subscription cancelled", "info");
        if (onSubscriptionUpdated) onSubscriptionUpdated();
        window.dispatchEvent(new CustomEvent("refreshUser"));
      } catch (e) {
        showToast(e.message || "Failed to cancel subscription", "error");
      } finally {
        setIsSubscribing(false);
      }
      return;
    }

    // Launch NOWPayments crypto checkout for paying and joining premium!
    if (price > 0) {
      setShowSubscribeModal(true);
      return;
    }

    // Free VIP tier if price === 0
    setIsSubscribing(true);
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(creatorUsername)}/subscribe`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to update subscription");
      }
      setIsSubscribed(data.subscribed);
      setSubscribersCount(data.subscribers_count);
      showToast("Subscribed to VIP tier!", "success");
      if (onSubscriptionUpdated) onSubscriptionUpdated();
      window.dispatchEvent(new CustomEvent("refreshUser"));
    } catch (e) {
      showToast(e.message || "Failed to update subscription", "error");
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/?creator=${creatorUsername}`;
    if (navigator.share) {
      navigator.share({
        title: `${creatorData?.display_name || creatorUsername} on ${APP_CONFIG.appNamePrefix}`,
        url: shareUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      showToast("Profile link copied to clipboard!", "success");
    }
  };

  const formatStat = (num) => {
    const n = Number(num) || 0;
    return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  };

  const avatar = creatorData?.avatar_url || "/assets/default-avatar.png";
  const price = Number(creatorData?.subscription_price || 0);
  const isMonetizedCreator = Boolean(creatorData?.is_creator) || price > 0;
  const cleanUname = String(creatorData?.username || creatorUsername || "").toLowerCase().replace(/^@/, "").trim();
  const isOwner = Boolean(
    creatorData?.is_owner || 
    (currentUser && (
      (currentUser.username && currentUser.username.toLowerCase().replace(/^@/, "").trim() === cleanUname) ||
      (currentUser.id && creatorData?.id && String(currentUser.id) === String(creatorData.id))
    ))
  );
  const hasUniversalAccess = currentUser?.role === "admin" || (currentUser?.is_premium && cleanUname === "naijahomemade");
  const hasAccess = price <= 0 || isSubscribed || isOwner || hasUniversalAccess;

  const postsCount = creatorData?.stats?.posts || (tabVideos.posts.length > 0 ? tabVideos.posts.length : videos.length) || 0;
  const likesCount = creatorData?.stats?.likes || 0;

  const displayedVideos = tabVideos[activeTab] || [];
  const loadingMoreVideos = Boolean(tabLoading[activeTab]);
  const hasMoreVideos = Boolean(tabHasMore[activeTab]);

  const handleVideoCardClick = (vData, e) => {
    const isPremiumVideo = String(vData.category || "").toLowerCase().trim() === "premium" || Boolean(vData.is_premium);
    const creatorPrice = Number(creatorData?.subscription_price || 0);

    if (isPremiumVideo && !hasAccess) {
      const token = localStorage.getItem("token");
      if (!token) {
        promptLogin("subscribe");
        return;
      }
      setShowSubscribeModal(true);
      return;
    }

    if (onVideoClick) {
      onVideoClick({
        ...vData,
        uploader_handle: creatorData?.username || creatorUsername,
        subscription_price: creatorPrice,
        is_subscribed: hasAccess
      }, e);
    }
  };

  return (
    <div style={containerStyle}>
      {/* Top Navbar */}
      <div style={topNavStyle}>
        <button onClick={onClose} style={navBtnStyle} title="Back">
          <ArrowLeft size={22} color="#d4d4d8" />
        </button>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={topNavNameStyle}>{creatorData?.username || creatorUsername}</span>
          {creatorData?.is_verified && <TwitterVerifiedBadge size={15} style={{ flexShrink: 0 }} />}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          {!creatorData?.is_owner && isMonetizedCreator && creatorData?.allow_tips !== false && (
            <button 
              onClick={() => setShowTipModal(true)} 
              style={navBtnStyle} 
              title="Send Tip"
            >
              <Heart size={20} fill="#f91880" color="#f91880" />
            </button>
          )}
          <button onClick={handleShare} style={navBtnStyle} title="Share Profile">
            <Share2 size={20} color="#d4d4d8" />
          </button>
        </div>
      </div>

      {loading ? (
        <div style={loaderCenterStyle}>
          <Loader2 size={32} className="animate-spin" color="#0095f6" />
          <span style={{ marginTop: "12px", color: "#8e8e93", fontSize: "14px" }}>Loading profile...</span>
        </div>
      ) : error ? (
        <div style={errorCenterStyle}>
          <span style={{ fontSize: "16px", color: "#d4d4d8", fontWeight: "700" }}>Profile Not Found</span>
          <p style={{ color: "#8e8e93", fontSize: "13px", marginTop: "4px" }}>The requested account could not be found.</p>
          <button onClick={onClose} style={errorBackBtnStyle}>Back to Feed</button>
        </div>
      ) : (
        <div style={scrollContentStyle}>
          <div style={profileInnerContainer}>
            
            {/* MOBILE HEADER */}
            {!isDesktop ? (
              <div style={{ padding: "16px 16px 10px 16px" }}>
                {/* Top Row: Details on left; Avatar on right (TikTok style) */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "14px", marginBottom: "14px" }}>
                  <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
                    {/* Line 1: Display Name */}
                    <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
                      <h1 style={{
                        margin: 0,
                        fontFamily: "'TikTok Sans', 'Plus Jakarta Sans', 'Proxima Nova', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                        fontSize: "20px",
                        fontWeight: "800",
                        letterSpacing: "-0.3px",
                        color: "#d4d4d8",
                        lineHeight: "1.25"
                      }}>
                        {creatorData?.display_name || creatorUsername}
                      </h1>
                    </div>

                    {/* Line 2: Bio directly next after display name */}
                    {creatorData?.creator_bio && (
                      <p style={{
                        fontSize: "13px",
                        color: "#c8c8c8",
                        lineHeight: "1.4",
                        margin: "2px 0 0 0",
                        wordBreak: "break-word"
                      }}>
                        {creatorData.creator_bio}
                      </p>
                    )}

                    {/* Line 3: Followers, following, likes count */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "7px",
                      flexWrap: "wrap",
                      fontSize: "12.5px",
                      color: "#8e8e93",
                      marginTop: "5px"
                    }}>
                      <span
                        onClick={() => handleOpenFollowList("followers")}
                        style={{ cursor: "pointer" }}
                        title="View followers"
                      >
                        <strong style={{ color: "#d4d4d8", fontWeight: "700" }}>{formatStat(followersCount)}</strong>{" "}
                        <span>followers</span>
                      </span>
                      <span style={{ color: "rgba(255, 255, 255, 0.25)" }}>·</span>
                      <span
                        onClick={() => handleOpenFollowList("following")}
                        style={{ cursor: "pointer" }}
                        title="View following"
                      >
                        <strong style={{ color: "#d4d4d8", fontWeight: "700" }}>{formatStat(followingCount)}</strong>{" "}
                        <span>following</span>
                      </span>
                      <span style={{ color: "rgba(255, 255, 255, 0.25)" }}>·</span>
                      <span>
                        <strong style={{ color: "#d4d4d8", fontWeight: "700" }}>{formatStat(likesCount)}</strong>{" "}
                        <span>likes</span>
                      </span>
                    </div>
                  </div>

                  {/* Avatar on Right */}
                  <div style={avatarContainerMobile}>
                    <StoryAvatar
                      username={creatorUsername}
                      avatarUrl={avatar}
                      displayName={creatorData?.display_name || creatorUsername}
                      size={84}
                      borderWidth={2.5}
                    />
                  </div>
                </div>

                {/* Action Buttons Row */}
                <div style={mobileActionButtonsRow}>
                  {!creatorData?.is_owner && (
                    <button
                      onClick={handleFollowToggle}
                      disabled={isFollowLoading}
                      style={{
                        ...mobileFollowBtn,
                        backgroundColor: isFollowing ? "rgba(255, 255, 255, 0.08)" : "#e4e4e7",
                        color: isFollowing ? "#a1a1aa" : "#09090b",
                        border: isFollowing ? "1px solid rgba(255, 255, 255, 0.12)" : "none"
                      }}
                    >
                      {isFollowLoading ? "..." : (isFollowing ? "Following" : "Follow")}
                    </button>
                  )}

                  {!creatorData?.is_owner && (price > 0 || isSubscribed) && (
                    <button
                      onClick={handleSubscribeToggle}
                      disabled={isSubscribing}
                      style={{
                        ...mobileSubscribeBtn,
                        backgroundColor: isSubscribed ? "rgba(225, 29, 72, 0.14)" : "#e11d48",
                        color: isSubscribed ? "#f43f5e" : "#f4f4f5",
                        border: isSubscribed ? "1px solid rgba(225, 29, 72, 0.28)" : "none"
                      }}
                    >
                      {isSubscribed ? "Subscribed" : "Subscribe"}
                    </button>
                  )}
                </div>

                {/* Links & Meta */}
                {(creatorData?.website || creatorData?.location) && (
                  <div style={metaRowStyle}>
                    {creatorData?.website && (
                      <a 
                        href={creatorData.website.startsWith("http://") || creatorData.website.startsWith("https://") ? creatorData.website : `https://${creatorData.website}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={websiteLinkStyle}
                      >
                        <Link2 size={13} color="#00aff0" />
                        <span>{creatorData.website.replace(/^https?:\/\//, "")}</span>
                      </a>
                    )}
                    {creatorData?.location && (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <MapPin size={13} color="#8e8e93" />
                        <span>{creatorData.location}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : (
              /* DESKTOP HEADER */
              <div style={{ display: "flex", gap: "36px", alignItems: "flex-start", justifyContent: "space-between", padding: "32px 24px 20px 24px", marginBottom: "16px" }}>
                
                {/* Desktop Details on Left */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Line 1: Display Name */}
                  <div style={{ display: "flex", alignItems: "center", marginBottom: "6px" }}>
                    <h1 style={{
                      fontFamily: "'TikTok Sans', 'Plus Jakarta Sans', 'Proxima Nova', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
                      fontSize: "28px",
                      fontWeight: "800",
                      letterSpacing: "-0.5px",
                      color: "#d4d4d8",
                      margin: 0,
                      lineHeight: "1.15"
                    }}>
                      {creatorData?.display_name || creatorUsername}
                    </h1>
                  </div>

                  {/* Line 2: Bio directly after display name */}
                  {creatorData?.creator_bio && (
                    <p style={{
                      fontSize: "14px",
                      color: "#c8c8c8",
                      lineHeight: "1.45",
                      margin: "4px 0 6px 0",
                      maxWidth: "600px",
                      wordBreak: "break-word"
                    }}>
                      {creatorData.creator_bio}
                    </p>
                  )}

                  {/* Line 3: Followers, following, likes count */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    fontSize: "14px",
                    color: "#8e8e93",
                    marginTop: "6px",
                    marginBottom: "16px"
                  }}>
                    <span
                      onClick={() => handleOpenFollowList("followers")}
                      style={{ cursor: "pointer" }}
                      title="View followers"
                    >
                      <strong style={{ color: "#d4d4d8", fontSize: "16px", fontWeight: "700" }}>{formatStat(followersCount)}</strong>{" "}
                      <span>followers</span>
                    </span>
                    <span style={{ color: "rgba(255, 255, 255, 0.25)" }}>·</span>
                    <span
                      onClick={() => handleOpenFollowList("following")}
                      style={{ cursor: "pointer" }}
                      title="View following"
                    >
                      <strong style={{ color: "#d4d4d8", fontSize: "16px", fontWeight: "700" }}>{formatStat(followingCount)}</strong>{" "}
                      <span>following</span>
                    </span>
                    <span style={{ color: "rgba(255, 255, 255, 0.25)" }}>·</span>
                    <span>
                      <strong style={{ color: "#d4d4d8", fontSize: "16px", fontWeight: "700" }}>{formatStat(likesCount)}</strong>{" "}
                      <span>likes</span>
                    </span>
                  </div>

                  {/* Action Buttons */}
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "18px" }}>
                    {!creatorData?.is_owner && (
                      <button
                        onClick={handleFollowToggle}
                        disabled={isFollowLoading}
                        style={{
                          ...desktopFollowBtn,
                          backgroundColor: isFollowing ? "rgba(255, 255, 255, 0.08)" : "#e4e4e7",
                          color: isFollowing ? "#a1a1aa" : "#09090b",
                          border: isFollowing ? "1px solid rgba(255, 255, 255, 0.12)" : "none"
                        }}
                      >
                        {isFollowLoading ? "..." : (isFollowing ? "Following" : "Follow")}
                      </button>
                    )}

                    {!creatorData?.is_owner && (price > 0 || isSubscribed) && (
                      <button
                        onClick={handleSubscribeToggle}
                        disabled={isSubscribing}
                        style={{
                          ...desktopSubscribeBtn,
                          backgroundColor: isSubscribed ? "rgba(225, 29, 72, 0.14)" : "#e11d48",
                          color: isSubscribed ? "#f43f5e" : "#f4f4f5",
                          border: isSubscribed ? "1px solid rgba(225, 29, 72, 0.28)" : "none"
                        }}
                      >
                        {isSubscribed ? "Subscribed" : "Subscribe"}
                      </button>
                    )}
                  </div>

                  {/* Links & Meta */}
                  {(creatorData?.website || creatorData?.location) && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center", fontSize: "13px", color: "#8e8e93" }}>
                      {creatorData?.website && (
                        <a 
                          href={creatorData.website.startsWith("http://") || creatorData.website.startsWith("https://") ? creatorData.website : `https://${creatorData.website}`} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          style={websiteLinkStyle}
                        >
                          <Link2 size={13} color="#00aff0" />
                          <span>{creatorData.website.replace(/^https?:\/\//, "")}</span>
                        </a>
                      )}
                      {creatorData?.location && (
                        <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <MapPin size={13} color="#8e8e93" />
                          <span>{creatorData.location}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Desktop Avatar on Right */}
                <div style={{ flexShrink: 0, position: "relative" }}>
                  <StoryAvatar
                    username={creatorUsername}
                    avatarUrl={avatar}
                    displayName={creatorData?.display_name || creatorUsername}
                    size={132}
                    borderWidth={3.5}
                  />
                </div>

              </div>
            )}

            {/* 🌟 INSTAGRAM STORY HIGHLIGHTS TRAY */}
            <StoryHighlightsTray
              highlights={highlights}
              creator={creatorData}
              isOwner={Boolean(creatorData?.is_owner)}
              onHighlightCreated={(newHl) => {
                setHighlights((prev) => [newHl, ...prev.filter(h => h.id !== newHl.id && !h.is_auto)]);
              }}
              onHighlightDeleted={(deletedId) => {
                setHighlights((prev) => prev.filter(h => h.id !== deletedId));
              }}
              style={{
                padding: isDesktop ? "0 24px 20px 24px" : "4px 16px 14px 16px"
              }}
            />

            {/* 🌟 INSTAGRAM TABS */}
            <div style={{ 
              ...tabsContainerStyle, 
              justifyContent: isDesktop ? "center" : "space-around",
              gap: isDesktop ? "50px" : "0",
              borderTop: "1px solid #262626"
            }}>
              <button 
                onClick={() => setActiveTab("posts")} 
                style={{ 
                  ...tabBtnStyle, 
                  borderTop: (isDesktop && activeTab === "posts") ? "1px solid #ffffff" : "none",
                  borderBottom: (!isDesktop && activeTab === "posts") ? "2px solid #ffffff" : "none",
                  opacity: activeTab === "posts" ? 1 : 0.4, 
                  color: activeTab === "posts" ? "#d4d4d8" : "#a8a8a8" 
                }}
              >
                <Grid3X3 size={isDesktop ? 16 : 22} />
                {isDesktop && <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "1px" }}>POSTS</span>}
              </button>
              <button 
                onClick={() => setActiveTab("reels")} 
                style={{ 
                  ...tabBtnStyle, 
                  borderTop: (isDesktop && activeTab === "reels") ? "1px solid #ffffff" : "none",
                  borderBottom: (!isDesktop && activeTab === "reels") ? "2px solid #ffffff" : "none",
                  opacity: activeTab === "reels" ? 1 : 0.4, 
                  color: activeTab === "reels" ? "#d4d4d8" : "#a8a8a8" 
                }}
              >
                <Film size={isDesktop ? 16 : 22} />
                {isDesktop && <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "1px" }}>REELS</span>}
              </button>
              {isMonetizedCreator && (
                <button 
                  onClick={() => setActiveTab("premium")} 
                  style={{ 
                    ...tabBtnStyle, 
                    borderTop: (isDesktop && activeTab === "premium") ? "1px solid #ffffff" : "none",
                    borderBottom: (!isDesktop && activeTab === "premium") ? "2px solid #ffffff" : "none",
                    opacity: activeTab === "premium" ? 1 : 0.4, 
                    color: activeTab === "premium" ? "#d4d4d8" : "#a8a8a8" 
                  }}
                >
                  <Lock size={isDesktop ? 16 : 22} />
                  {isDesktop && <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "1px" }}>VIP EXCLUSIVE</span>}
                </button>
              )}
            </div>

            {/* 🌟 3-COLUMN INSTAGRAM SQUARE MEDIA GRID */}
            {activeTab === "premium" && !hasAccess && price > 0 ? (
              <div style={premiumTabContainerStyle}>
                <div style={lockedBannerStyle}>
                  <div style={{ width: "56px", height: "56px", borderRadius: "50%", backgroundColor: "rgba(255, 215, 0, 0.12)", border: "1px solid rgba(255, 215, 0, 0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                    <Lock size={26} color="#FFD700" />
                  </div>
                  <h3 style={{ margin: "0 0 6px 0", fontSize: "18px", fontWeight: "800", color: "#d4d4d8" }}>
                    VIP Exclusive Drops
                  </h3>
                  <p style={{ margin: "0 0 20px 0", color: "#8e8e93", fontSize: "13px", maxWidth: "340px", lineHeight: "1.5" }}>
                    Subscribe to @{creatorData?.username || creatorUsername} to unlock private full-length videos, uncensored drops, and member-only updates.
                  </p>
                  <button 
                    onClick={handleSubscribeToggle}
                    style={unlockNowBtnStyle}
                  >
                    <span>Subscribe</span>
                  </button>
                </div>
              </div>
            ) : (
              loadingMoreVideos && displayedVideos.length === 0 ? (
                <div style={{ ...loaderCenterStyle, padding: "80px 20px" }}>
                  <Loader2 size={32} className="animate-spin" color="#FFD700" />
                  <span style={{ marginTop: "12px", color: "#8e8e93", fontSize: "14px" }}>
                    {activeTab === "premium" ? "Loading VIP exclusive drops..." : "Loading posts..."}
                  </span>
                </div>
              ) : displayedVideos.length === 0 ? (
                <div style={emptyVideosStyle}>
                  <div style={{ width: "56px", height: "56px", borderRadius: "50%", border: "2px solid #333", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "12px" }}>
                    {activeTab === "premium" ? <Lock size={26} color="#FFD700" /> : <Grid3X3 size={26} color="#555" />}
                  </div>
                  <span style={{ color: "#d4d4d8", fontWeight: "700", fontSize: "15px" }}>
                    {activeTab === "premium" ? "No VIP Exclusive Drops Yet" : "No Posts Yet"}
                  </span>
                  <span style={{ marginTop: "4px", color: "#8e8e93", fontSize: "13px" }}>
                    {activeTab === "premium" 
                      ? `When @${creatorUsername} publishes VIP exclusive drops, they will appear here.`
                      : `When @${creatorUsername} uploads posts or reels, they will appear here.`}
                  </span>
                </div>
              ) : (
                <div style={{ 
                  padding: activeTab === "posts" ? (isDesktop ? "16px 0 30px 0" : "0 0 24px 0") : (isDesktop ? "20px 20px 30px 20px" : "14px 12px 24px 12px"),
                  width: "100%",
                  boxSizing: "border-box"
                }}>
                  {activeTab === "posts" ? (
                    <div style={{
                      maxWidth: "600px",
                      margin: "0 auto",
                      width: "100%",
                      borderLeft: isDesktop ? "1px solid var(--border-color, #262626)" : "none",
                      borderRight: isDesktop ? "1px solid var(--border-color, #262626)" : "none",
                      animation: "fadeIn 0.3s ease-out"
                    }}>
                      {displayedVideos.map((v, idx) => (
                        <FeedPost 
                          key={`${v.chat_id || ''}:${v.message_id || v.id || idx}`}
                          video={v}
                          isLast={idx === displayedVideos.length - 1}
                          onVideoClick={(vData) => handleVideoCardClick(vData)}
                          onCommentClick={(vData) => {
                            if (onCommentClick) {
                              onCommentClick(vData);
                            } else {
                              window.dispatchEvent(new CustomEvent("openCommentModal", { detail: { video: vData } }));
                            }
                          }}
                          isAnyModalOpen={isAnyModalOpen}
                          onCreatorClick={(handle, opts) => {
                            if (opts?.autoSubscribe) {
                              setShowSubscribeModal(true);
                            }
                          }}
                          onReportClick={(vData) => setReportedVideo(vData)}
                          onOptionsClick={(vData) => setOptionsVideo(vData)}
                          user={currentUser}
                        />
                      ))}
                    </div>
                  ) : (
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: isDesktop ? "repeat(4, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))",
                      gap: isDesktop ? "16px" : "4px",
                      alignItems: "start",
                      width: "100%",
                      animation: "fadeIn 0.3s ease-out"
                    }}>
                      {displayedVideos.map((v, idx) => (
                        <VideoCard 
                          key={`${v.chat_id}:${v.message_id}`}
                          video={v}
                          priority={idx < 2}
                          onOpen={(vData, e) => handleVideoCardClick(vData, e)}
                          showDetails={false}
                        />
                      ))}
                    </div>
                  )}

                  {hasMoreVideos && (
                    <div style={{ display: "flex", justifyContent: "center", marginTop: "24px", marginBottom: "20px" }}>
                      <button
                        onClick={handleLoadMoreVideos}
                        disabled={loadingMoreVideos}
                        style={{
                          background: "#262626",
                          border: "1px solid #363636",
                          borderRadius: "8px",
                          padding: "8px 20px",
                          color: "#d4d4d8",
                          fontSize: "13px",
                          fontWeight: "600",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px"
                        }}
                      >
                        {loadingMoreVideos && <Loader2 size={16} className="animate-spin" />}
                        <span>{loadingMoreVideos ? "Loading more..." : (activeTab === "premium" ? "Load More VIP Drops" : "Load More Posts")}</span>
                      </button>
                    </div>
                  )}
                </div>
              )
            )}

          </div>
        </div>
      )}

      {/* Tip Modal */}
      {showTipModal && (
        <CreatorTipModal 
          creator={creatorData}
          onClose={() => setShowTipModal(false)}
          onTipSuccess={(amt) => {
            showToast(`🎉 Successfully sent $${amt.toLocaleString()} tip to @${creatorData?.username}!`, "success");
          }}
        />
      )}

      {/* Subscribe Modal (NOWPayments Crypto Flow) */}
      {showSubscribeModal && (
        <CreatorSubscribeModal 
          creator={creatorData}
          onClose={() => setShowSubscribeModal(false)}
          onSubscribeSuccess={() => {
            setIsSubscribed(true);
            setSubscribersCount(prev => prev + 1);
            if (onSubscriptionUpdated) onSubscriptionUpdated();
            window.dispatchEvent(new CustomEvent("refreshUser"));
          }}
        />
      )}

      {/* 🌟 POST OPTIONS MODAL (X-Style Bottom Sheet) */}
      {optionsVideo && (
        <PostOptionsModal
          isOpen={Boolean(optionsVideo)}
          video={optionsVideo}
          currentUser={currentUser}
          isFollowing={isFollowing}
          onClose={() => setOptionsVideo(null)}
          onReport={(v) => {
            setOptionsVideo(null);
            setReportedVideo(v || optionsVideo);
          }}
          onNotInterested={() => setOptionsVideo(null)}
          onFollowToggle={handleFollowToggle}
          onDelete={(id) => {
            setTabVideos(prev => ({
              ...prev,
              posts: (prev.posts || []).filter(item => String(item.message_id || item.id) !== String(id))
            }));
            setOptionsVideo(null);
          }}
        />
      )}

      {/* 🚩 REPORT VIDEO MODAL */}
      {reportedVideo && (
        <ReportModal
          isOpen={Boolean(reportedVideo)}
          video={reportedVideo}
          onClose={() => setReportedVideo(null)}
        />
      )}

      {/* 👥 FOLLOWERS / FOLLOWING LIST MODAL */}
      {followListTab && (
        <FollowListModal
          username={creatorData?.username || creatorUsername}
          displayName={creatorData?.display_name || creatorUsername}
          initialTab={followListTab}
          followersCount={followersCount}
          followingCount={followingCount}
          currentUser={currentUser}
          isOwner={isOwner}
          onClose={handleCloseFollowList}
          onTabChange={handleFollowListTabChange}
          onSelectUser={(uname) => {
            const cleanTarget = String(uname || "").replace(/^@/, "").trim();
            if (!cleanTarget) return;
            if (cleanTarget.toLowerCase() === cleanUname) {
              handleCloseFollowList();
              return;
            }
            followListTabRef.current = null;
            setFollowListTab(null);
            window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: { username: cleanTarget } }));
          }}
          onCountsChange={({ followersDelta = 0, followingDelta = 0 }) => {
            if (followersDelta) setFollowersCount(prev => Math.max(0, prev + followersDelta));
            if (followingDelta) setFollowingCount(prev => Math.max(0, prev + followingDelta));
          }}
        />
      )}

      <style>{`
        @keyframes creatorModalSlideUp {
          from {
            opacity: 0;
            transform: translateY(24px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

// 🖌 Styles (Clean AMOLED Instagram Dark Theme)
const containerStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 1000025,
  backgroundColor: "#09090b",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  animation: "creatorModalSlideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards"
};

const topNavStyle = {
  height: "48px",
  padding: "0 16px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  backgroundColor: "#09090b",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  zIndex: 100,
  flexShrink: 0
};

const navBtnStyle = { background: "none", border: "none", cursor: "pointer", padding: "6px", display: "flex", alignItems: "center" };
const topNavNameStyle = { fontWeight: "700", fontSize: "16px", color: "#d4d4d8" };
const scrollContentStyle = { flex: 1, overflowY: "auto", paddingBottom: "60px" };

const profileInnerContainer = {
  maxWidth: "935px",
  margin: "0 auto",
  width: "100%"
};

// Story Gradient Rings & Avatar
const avatarContainerMobile = {
  position: "relative",
  flexShrink: 0
};

const storyGradientRingMobile = {
  borderRadius: "50%",
  display: "inline-block",
  flexShrink: 0
};

const avatarInnerCircleMobile = {
  width: "84px",
  height: "84px",
  borderRadius: "50%",
  border: "1.5px solid rgba(255, 255, 255, 0.12)",
  overflow: "hidden",
  backgroundColor: "#1c1c1e"
};

const storyGradientRingDesktop = {
  borderRadius: "50%",
  display: "inline-block"
};

const avatarInnerCircleDesktop = {
  width: "132px",
  height: "132px",
  borderRadius: "50%",
  border: "2px solid rgba(255, 255, 255, 0.12)",
  overflow: "hidden",
  backgroundColor: "#1c1c1e"
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

const categoryBadgeStyle = {
  fontSize: "9.5px",
  fontWeight: "600",
  color: "#00aff0",
  background: "rgba(0, 175, 240, 0.12)",
  padding: "1px 6px",
  borderRadius: "6px",
  whiteSpace: "nowrap",
  flexShrink: 0,
  lineHeight: "1.2"
};

// Stat Columns & Rows
const statsContainerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-around",
  padding: "14px 0",
  marginTop: "14px",
  borderTop: "1px solid rgba(255, 255, 255, 0.08)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)"
};

const statDividerStyle = {
  width: "1px",
  height: "24px",
  backgroundColor: "rgba(255, 255, 255, 0.1)"
};

const metaRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "14px",
  alignItems: "center",
  fontSize: "12.5px",
  color: "#8e8e93",
  marginTop: "12px"
};

const statColStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center"
};

const statNumberStyle = {
  fontSize: "17px",
  fontWeight: "700",
  color: "#d4d4d8"
};

const statLabelStyle = {
  fontSize: "13px",
  color: "#a8a8a8",
  marginTop: "1px",
  fontWeight: "400"
};

// Badges and Links
const creatorBadgeTagStyle = {
  fontSize: "9px",
  fontWeight: "800",
  color: "#FFD700",
  backgroundColor: "rgba(255, 215, 0, 0.12)",
  border: "1px solid rgba(255, 215, 0, 0.3)",
  borderRadius: "4px",
  padding: "2px 6px",
  letterSpacing: "0.5px"
};

const websiteLinkStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  color: "#00aff0",
  textDecoration: "none",
  fontSize: "13px",
  fontWeight: "600"
};

// Mobile Action Buttons
const mobileActionButtonsRow = {
  display: "flex",
  gap: "8px",
  marginTop: "14px"
};

const mobileFollowBtn = {
  flex: 1,
  height: "36px",
  borderRadius: "20px",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s ease"
};

const mobileSubscribeBtn = {
  flex: 1,
  height: "36px",
  borderRadius: "20px",
  fontSize: "13px",
  fontWeight: "700",
  border: "none",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const mobileSecondaryBtn = {
  height: "36px",
  padding: "0 16px",
  backgroundColor: "#262626",
  color: "#d4d4d8",
  border: "1px solid #363636",
  borderRadius: "20px",
  fontSize: "13px",
  fontWeight: "600",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  cursor: "pointer"
};

const mobileIconBtn = {
  height: "36px",
  width: "36px",
  backgroundColor: "#262626",
  border: "1px solid #363636",
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  flexShrink: 0
};

// Desktop Action Buttons
const desktopFollowBtn = {
  height: "36px",
  padding: "0 24px",
  borderRadius: "20px",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s ease"
};

const desktopSubscribeBtn = {
  height: "36px",
  padding: "0 24px",
  borderRadius: "20px",
  fontSize: "13px",
  fontWeight: "700",
  border: "none",
  cursor: "pointer"
};

const desktopSecondaryBtn = {
  height: "36px",
  padding: "0 18px",
  backgroundColor: "#262626",
  color: "#d4d4d8",
  border: "1px solid #363636",
  borderRadius: "20px",
  fontSize: "13px",
  fontWeight: "600",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  cursor: "pointer"
};

const desktopIconBtnStyle = {
  background: "#262626",
  border: "1px solid #363636",
  borderRadius: "50%",
  width: "36px",
  height: "36px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer"
};

// Tabs
const tabsContainerStyle = {
  display: "flex",
  position: "sticky",
  top: 0,
  background: "#09090b",
  zIndex: 90
};

const tabBtnStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  background: "none",
  border: "none",
  padding: "14px 0",
  cursor: "pointer",
  flex: 1,
  transition: "all 0.15s ease"
};

// Empty & Locked States
const emptyVideosStyle = {
  padding: "80px 20px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center"
};

const premiumTabContainerStyle = {
  padding: "50px 16px",
  display: "flex",
  justifyContent: "center"
};

const lockedBannerStyle = {
  backgroundColor: "#16181c",
  border: "1px solid #262626",
  borderRadius: "16px",
  padding: "36px 24px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  width: "100%",
  maxWidth: "400px"
};

const unlockNowBtnStyle = {
  background: "#e11d48",
  color: "#d4d4d8",
  border: "none",
  borderRadius: "8px",
  padding: "10px 24px",
  fontWeight: "700",
  fontSize: "14px",
  cursor: "pointer",
  boxShadow: "0 2px 12px rgba(225, 29, 72, 0.25)"
};

const loaderCenterStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "300px"
};

const errorCenterStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "40px",
  textAlign: "center"
};

const errorBackBtnStyle = {
  marginTop: "16px",
  backgroundColor: "#262626",
  color: "#d4d4d8",
  border: "1px solid #363636",
  borderRadius: "8px",
  padding: "8px 18px",
  cursor: "pointer",
  fontSize: "13px",
  fontWeight: "600"
};

