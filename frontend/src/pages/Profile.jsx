import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { 
  Settings, Grid3X3, Heart, Lock, Share2, ArrowLeft, 
  Camera, Sparkles, Edit3, MapPin, Globe, Award, ExternalLink, ShieldCheck, Eye,
  Film, Play, Plus, ChevronRight, TrendingUp, Link2, ChevronDown, Bookmark, Copy, MessageCircle, UserPlus
} from "lucide-react"; 
import TwitterVerifiedBadge from "../components/TwitterVerifiedBadge"; 
import VideoCard from "../components/VideoCard"; 
import SettingsView from "../components/SettingsView"; 
import CreatorSetupModal from "../components/CreatorSetupModal";
import EditProfileModal from "../components/EditProfileModal";
import CreatorProfileModal from "../components/CreatorProfileModal";
import CreatorStudioModal from "../components/CreatorStudioModal";
import CreatorUploadModal from "../components/CreatorUploadModal";
import DiscoverCreatorsSection from "../components/DiscoverCreatorsSection";
import DiscoverCreatorsModal from "../components/DiscoverCreatorsModal";
import StoryAvatar from "../components/StoryAvatar";
import StoryHighlightsTray from "../components/StoryHighlightsTray";
import FeedPost from "../components/FeedPost";
import PostOptionsModal from "../components/PostOptionsModal";
import ReportModal from "../components/ReportModal";
import FollowListModal from "../components/FollowListModal";
import DesktopLeftSidebar from "../components/DesktopLeftSidebar";
import DesktopRightSidebar from "../components/DesktopRightSidebar";
import { useVideos } from "../hooks/useVideos";

// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../config";
import { isUserSubscribedToCreator, getVideoCreatorHandle } from "../utils/subscription";
import { showToast, promptLogin } from "../utils/toast";

export default function Profile({ 
  user, 
  onLogout, 
  setHideFooter, 
  setActiveVideo, 
  setShowPaywall, 
  onUpdateUser,
  onCreatorClick,
  onOpenDiscoverCreators,
  onCommentClick
}) {
  const [activeTab, setActiveTab] = useState("videos");
  const [currentView, setCurrentView] = useState("profile");
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);

  const handleOpenDiscover = useCallback(() => {
    if (onOpenDiscoverCreators) {
      onOpenDiscoverCreators();
    } else {
      setShowDiscoverModal(true);
    }
  }, [onOpenDiscoverCreators]);

  useEffect(() => {
    if (!user?.is_creator && activeTab === "premium") {
      setActiveTab("videos");
    }
  }, [user?.is_creator, activeTab]);
  
  const [activeGroup, setActiveGroup] = useState(null);
  const [deletedVideoIds, setDeletedVideoIds] = useState(new Set());
  const [showStudioModal, setShowStudioModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDiscoverCreators, setShowDiscoverCreators] = useState(false);
  const [uploadDefaultCategory, setUploadDefaultCategory] = useState("community");
  
  // Creator & Social Modals
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [followListTab, setFollowListTab] = useState(null); // "followers" | "following" | null
  const [optionsVideo, setOptionsVideo] = useState(null);
  const [reportedVideo, setReportedVideo] = useState(null);

  const isAnyModalOpen = Boolean(
    showSetupModal || 
    showEditModal || 
    showPreviewModal || 
    showStudioModal || 
    showUploadModal || 
    showDiscoverModal || 
    followListTab ||
    optionsVideo || 
    reportedVideo || 
    currentView !== "profile"
  );
  
  // Live profile stats
  const [creatorStats, setCreatorStats] = useState({
    posts: 0,
    followers: 0,
    following: 0,
    subscribers: 0,
    likes: 0,
    views: 0
  });
  const [highlights, setHighlights] = useState([]);

  // 🟢 NEW: Scroll Tracking State
  const [isUIHidden, setIsUIHidden] = useState(false);
  
  const loaderRef = useRef(null);
  const scrollContainerRef = useRef(null); 
  const scrollPositionRef = useRef(0);     
  const lastScrollY = useRef(0);

  const shouldHideUI = isUIHidden && !isDesktop; // Mobile only

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleOpenStudio = () => setShowStudioModal(true);
    window.addEventListener("openCreatorStudio", handleOpenStudio);
    return () => window.removeEventListener("openCreatorStudio", handleOpenStudio);
  }, []);

  // Fetch live stats & highlights for user/creator profile from DB
  useEffect(() => {
    if (!user?.username) return;
    let isMounted = true;

    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(user.username)}`, { headers })
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (isMounted && data?.creator) {
          if (data.creator.stats) {
            setCreatorStats(data.creator.stats);
          }
          if (Array.isArray(data.creator.highlights)) {
            setHighlights(data.creator.highlights);
          }
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [user?.username]);

  const currentViewRef = useRef(currentView);
  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  const activeGroupRef = useRef(activeGroup);
  useEffect(() => {
    activeGroupRef.current = activeGroup;
  }, [activeGroup]);

  const followListTabRef = useRef(followListTab);
  useEffect(() => {
    followListTabRef.current = followListTab;
  }, [followListTab]);

  const handleOpenFollowList = useCallback((tab) => {
    followListTabRef.current = tab;
    setFollowListTab(tab);
    const currentState = window.history.state || {};
    if (!currentState.profileFollowList) {
      window.history.pushState(
        { ...currentState, profileFollowList: tab },
        document.title,
        window.location.href
      );
    } else if (currentState.profileFollowList !== tab) {
      window.history.replaceState(
        { ...currentState, profileFollowList: tab },
        document.title,
        window.location.href
      );
    }
  }, []);

  const handleFollowListTabChange = useCallback((newTab) => {
    followListTabRef.current = newTab;
    setFollowListTab(newTab);
    const currentState = window.history.state || {};
    if (currentState.profileFollowList && currentState.profileFollowList !== newTab) {
      window.history.replaceState(
        { ...currentState, profileFollowList: newTab },
        document.title,
        window.location.href
      );
    }
  }, []);

  const handleCloseFollowList = useCallback(() => {
    followListTabRef.current = null;
    setFollowListTab(null);
    if (window.history.state?.profileFollowList) {
      window.history.back();
    }
  }, []);

  const handleOpenSettings = () => {
    setCurrentView("settings");
    currentViewRef.current = "settings";
    if (!window.history.state?.settingsOpen) {
      window.history.pushState(
        { ...(window.history.state || {}), settingsOpen: true },
        document.title,
        window.location.href
      );
    }
  };

  const handleCloseSettings = () => {
    currentViewRef.current = "profile";
    setCurrentView("profile");
    if (window.history.state?.settingsOpen) {
      window.history.back();
    }
  };

  const handleCloseGroup = useCallback(() => {
    activeGroupRef.current = null;
    setActiveGroup(null);
    if (window.history.state?.albumOpen) {
      window.history.back();
    }
  }, []);

  useEffect(() => {
    const handleProfilePopState = (event) => {
      const state = event.state || {};

      // Restore or close Profile FollowListModal based on history state
      if (state.profileFollowList && !state.creatorProfile && !state.videoPlayer && !state.storyPlayer) {
        if (followListTabRef.current !== state.profileFollowList) {
          followListTabRef.current = state.profileFollowList;
          setFollowListTab(state.profileFollowList);
        }
        return;
      }
      if (followListTabRef.current && (!state.profileFollowList || state.creatorProfile)) {
        followListTabRef.current = null;
        setFollowListTab(null);
        if (!state.creatorProfile) return;
      }

      // Restore or close SettingsView based on history state
      if (state.settingsOpen && !state.creatorProfile && !state.videoPlayer && currentViewRef.current !== "settings") {
        currentViewRef.current = "settings";
        setCurrentView("settings");
        return;
      }
      if (currentViewRef.current === "settings" && !state.settingsOpen) {
        currentViewRef.current = "profile";
        setCurrentView("profile");
        return;
      }

      if (activeGroupRef.current && !state.albumOpen) {
        activeGroupRef.current = null;
        setActiveGroup(null);
        return;
      }
    };
    window.addEventListener("popstate", handleProfilePopState);
    return () => window.removeEventListener("popstate", handleProfilePopState);
  }, []);

  // 🟢 Footer broadcast logic
  useEffect(() => {
    if (currentView === "settings") {
      setHideFooter(true);
    } else {
      setHideFooter(shouldHideUI);
    }
    return () => setHideFooter(false);
  }, [currentView, shouldHideUI, setHideFooter]);

  useEffect(() => {
    setActiveGroup(null);
  }, [activeTab]);

  const fetchLimit = isDesktop ? 15 : 12;

  const { videos: liked, loading: likedLoading, loadMore: loadMoreLiked } = useVideos("likes", fetchLimit);
  const { videos: saved, loading: savedLoading, loadMore: loadMoreSaved } = useVideos("saved", fetchLimit);

  // User/Creator's own posts state
  const [creatorPosts, setCreatorPosts] = useState([]);
  const [creatorPostsLoading, setCreatorPostsLoading] = useState(false);
  const [creatorPostsPage, setCreatorPostsPage] = useState(1);
  const [hasMoreCreatorPosts, setHasMoreCreatorPosts] = useState(true);

  // Creator's VIP Exclusive posts state
  const [creatorPremiumPosts, setCreatorPremiumPosts] = useState([]);
  const [creatorPremiumLoading, setCreatorPremiumLoading] = useState(false);
  const [creatorPremiumPage, setCreatorPremiumPage] = useState(1);
  const [hasMoreCreatorPremiumPosts, setHasMoreCreatorPremiumPosts] = useState(true);
  const [hasLoadedPremiumOnce, setHasLoadedPremiumOnce] = useState(false);

  const fetchCreatorPosts = useCallback(async (targetPage, isNew) => {
    if (!user?.username) return;
    setCreatorPostsLoading(true);
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(user.username)}/videos?page=${targetPage}&limit=${fetchLimit}`);
      const data = await res.json();
      if (data?.videos) {
        setCreatorPosts(prev => {
          const combined = isNew ? data.videos : [...prev, ...data.videos];
          const map = new Map();
          combined.forEach(v => map.set(`${v.chat_id}:${v.message_id}`, v));
          return Array.from(map.values());
        });
        setHasMoreCreatorPosts(Boolean(data.hasMore));
        setCreatorPostsPage(targetPage + 1);
      }
    } catch (e) {
      console.error("Failed to load profile posts", e);
    } finally {
      setCreatorPostsLoading(false);
    }
  }, [user?.username, fetchLimit]);

  const fetchCreatorPremiumPosts = useCallback(async (targetPage, isNew) => {
    if (!user?.username || !user?.is_creator) return;
    setCreatorPremiumLoading(true);
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(user.username)}/videos?tab=premium&page=${targetPage}&limit=${fetchLimit}`);
      const data = await res.json();
      if (data?.videos) {
        setCreatorPremiumPosts(prev => {
          const combined = isNew ? data.videos : [...prev, ...data.videos];
          const map = new Map();
          combined.forEach(v => map.set(`${v.chat_id}:${v.message_id}`, v));
          return Array.from(map.values());
        });
        setHasMoreCreatorPremiumPosts(Boolean(data.hasMore));
        setCreatorPremiumPage(targetPage + 1);
        setHasLoadedPremiumOnce(true);
      }
    } catch (e) {
      console.error("Failed to load creator VIP posts", e);
    } finally {
      setCreatorPremiumLoading(false);
    }
  }, [user?.username, user?.is_creator, fetchLimit]);

  useEffect(() => {
    if (user?.username) {
      setCreatorPostsPage(1);
      fetchCreatorPosts(1, true);
    }
  }, [user?.username, fetchCreatorPosts]);

  useEffect(() => {
    if (user?.is_creator && user?.username && activeTab === "premium" && !hasLoadedPremiumOnce && !creatorPremiumLoading) {
      setCreatorPremiumPage(1);
      fetchCreatorPremiumPosts(1, true);
    }
  }, [user?.is_creator, user?.username, activeTab, hasLoadedPremiumOnce, creatorPremiumLoading, fetchCreatorPremiumPosts]);

  const handleUploadSuccess = (newVideo) => {
    if (!newVideo) return;
    setCreatorPosts(prev => [newVideo, ...prev]);
    const isVip = String(newVideo.category || "").toLowerCase().trim() === "premium" || Boolean(newVideo.is_premium);
    if (isVip) {
      setCreatorPremiumPosts(prev => [newVideo, ...prev]);
    }
    setCreatorStats(prev => ({
      ...prev,
      posts: (prev.posts || 0) + 1
    }));
  };

  let rawVideosToDisplay = [];
  let loading = false;
  let loadMore = () => {};

  if (activeTab === "videos" || activeTab === "reels") {
    rawVideosToDisplay = creatorPosts;
    loading = creatorPostsLoading;
    loadMore = () => {
      if (!creatorPostsLoading && hasMoreCreatorPosts) {
        fetchCreatorPosts(creatorPostsPage, false);
      }
    };
  } else if (activeTab === "premium" && user?.is_creator) {
    rawVideosToDisplay = creatorPremiumPosts;
    loading = creatorPremiumLoading;
    loadMore = () => {
      if (!creatorPremiumLoading && hasMoreCreatorPremiumPosts) {
        fetchCreatorPremiumPosts(creatorPremiumPage, false);
      }
    };
  } else if (activeTab === "likes") {
    rawVideosToDisplay = liked || [];
    loading = likedLoading;
    loadMore = loadMoreLiked;
  } else if (activeTab === "saved") {
    rawVideosToDisplay = saved || [];
    loading = savedLoading;
    loadMore = loadMoreSaved;
  }

  useEffect(() => {
    const handleVideoDeleted = (event) => {
      const deletedId = String(event.detail); 
      setDeletedVideoIds(prev => new Set(prev).add(deletedId));
      setActiveGroup(prevGroup => {
        if (!prevGroup) return null;
        return {
          ...prevGroup,
          videos: prevGroup.videos.filter(v => String(v.id || v.message_id) !== deletedId)
        };
      });
    };

    window.addEventListener("videoDeleted", handleVideoDeleted);
    return () => window.removeEventListener("videoDeleted", handleVideoDeleted);
  }, []);

  const filteredRawVideos = rawVideosToDisplay.filter(v => 
    !deletedVideoIds.has(String(v.id || v.message_id))
  );

  const videosToDisplay = useMemo(() => {
    if (activeGroup) {
      return (activeGroup.videos || []).map(v => ({
        ...v,
        is_group: false,
        group_count: 1
      }));
    }
    return filteredRawVideos;
  }, [activeGroup, filteredRawVideos]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target.isIntersecting && !loading && !activeGroup) {
          loadMore();
        }
      },
      { root: null, rootMargin: "200px", threshold: 0.1 }
    );

    if (loaderRef.current) observer.observe(loaderRef.current);
    return () => observer.disconnect();
  }, [loading, loadMore, activeGroup]);

  // 🟢 Scroll Listener
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentY = container.scrollTop;

      if (currentY < 50) {
        setIsUIHidden(false);
      } else if (currentY > lastScrollY.current + 15) {
        setIsUIHidden(true);
      } else if (currentY < lastScrollY.current - 15) {
        setIsUIHidden(false);
      }

      lastScrollY.current = currentY;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const handleOpenVideo = useCallback(async (video, e) => {
    if (e && typeof e.preventDefault === "function") {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!video) return;

    if (video.is_group && !activeGroup) {
      if (scrollContainerRef.current) {
        scrollPositionRef.current = scrollContainerRef.current.scrollTop;
      }

      try {
        const res = await fetch(`${APP_CONFIG.apiUrl}/api/group?media_group_id=${video.media_group_id}`);
        const groupVideos = await res.json();
        
        const cleanGroupVideos = Array.isArray(groupVideos)
          ? groupVideos.map(v => ({ ...v, is_group: false, group_count: 1 }))
          : [];

        const groupData = {
          title: video.caption || "Collection",
          videos: cleanGroupVideos
        };
        setActiveGroup(groupData);
        activeGroupRef.current = groupData;

        window.history.pushState(
          { ...(window.history.state || {}), albumOpen: true },
          document.title,
          window.location.href
        );
        
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = 0;
        }
      } catch (err) {
        showToast("🚨 Failed to load album contents.", "error");
      }
      return;
    }

    const isPremium = String(video.category || "").toLowerCase().trim() === "premium" || activeTab === "premium" || Boolean(video.is_premium);
    if (isPremium) {
      const hasAccess = isUserSubscribedToCreator(user, video);
      if (!hasAccess) {
        const token = localStorage.getItem("token");
        if (!token) {
          promptLogin("subscribe");
          return;
        }
        const creatorHandle = getVideoCreatorHandle(video);
        window.dispatchEvent(new CustomEvent("openCreatorProfile", { 
          detail: { username: creatorHandle, autoSubscribe: true } 
        }));
        return;
      }
    }

    try {
      // Pause any existing feed videos to release HTTP range-request socket locks
      try {
        document.querySelectorAll('video').forEach(el => el.pause());
      } catch (_) {}

      const ts = Date.now();
      if (video.video_url) {
        const separator = video.video_url.includes('?') ? '&' : '?';
        const freshUrl = `${video.video_url}${separator}cb=${ts}`;
        setActiveVideo({ ...video, video_url: freshUrl });
        return;
      }

      setActiveVideo({ ...video, video_url: null }); 
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`, { headers });
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      if (data.video_url) {
        const separator = data.video_url.includes('?') ? '&' : '?';
        const freshUrl = `${data.video_url}${separator}cb=${ts}`;
        setActiveVideo(prev => ({ ...prev, video_url: freshUrl }));
      }
    } catch (err) {
      console.error("Profile Video Load Error:", err);
      setActiveVideo(null);
    }
  }, [user, activeTab, setActiveVideo, activeGroup, isDesktop]); 

  useEffect(() => {
    if (!activeGroup && scrollContainerRef.current) {
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = scrollPositionRef.current;
        }
      });
    }
  }, [activeGroup]);

  const handleShareProfile = () => {
    const shareUrl = `${window.location.origin}/?creator=${user?.username}`;
    if (navigator.share) {
      navigator.share({
        title: `${user?.display_name || user?.username} on ${APP_CONFIG.appNamePrefix}`,
        url: shareUrl
      }).catch(() => {});
    } else {
      navigator.clipboard.writeText(shareUrl);
      showToast("Profile link copied to clipboard!", "success");
    }
  };

  const handleUpdateSuccess = (updatedUser) => {
    if (onUpdateUser) {
      onUpdateUser(updatedUser);
    }
  };

  if (currentView === "settings") {
    return (
      <>
        <SettingsView 
          user={user}
          creatorStats={creatorStats}
          onBack={handleCloseSettings} 
          onLogout={onLogout}
          onOpenEditProfile={() => setShowEditModal(true)}
          onOpenCreatorStudio={() => setShowStudioModal(true)}
          onOpenFanView={() => {
            if (user?.username) {
              window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: user.username }));
            }
          }}
          onOpenBecomeCreator={() => setShowSetupModal(true)}
          onOpenUpload={() => {
            setUploadDefaultCategory(activeTab === "premium" ? "premium" : "community");
            setShowUploadModal(true);
          }}
          onShareProfile={handleShareProfile}
          onUpdateUser={handleUpdateSuccess}
        />

        {/* 🌟 MODALS ACCESSIBLE DIRECTLY FROM SETTINGS */}
        {showEditModal && (
          <EditProfileModal 
            user={user}
            onClose={() => setShowEditModal(false)}
            onOpenCreatorSetup={() => setShowSetupModal(true)}
            onUpdateSuccess={(updatedUser) => {
              handleUpdateSuccess(updatedUser);
              setShowEditModal(false);
            }}
          />
        )}

        {showSetupModal && (
          <CreatorSetupModal 
            user={user}
            onClose={() => setShowSetupModal(false)}
            onSetupSuccess={(updatedUser) => {
              handleUpdateSuccess(updatedUser);
              setShowSetupModal(false);
            }}
          />
        )}

        {showPreviewModal && user?.username && (
          <CreatorProfileModal 
            creatorUsername={user.username}
            currentUser={user}
            onClose={() => setShowPreviewModal(false)}
            onVideoClick={handleOpenVideo}
            setShowPaywall={setShowPaywall}
          />
        )}

        {showStudioModal && (
          <CreatorStudioModal 
            isOpen={showStudioModal}
            onClose={() => setShowStudioModal(false)}
            user={user}
            onUpdateUser={(updated) => {
              handleUpdateSuccess(updated);
            }}
          />
        )}

        {showUploadModal && (
          <CreatorUploadModal 
            isOpen={showUploadModal}
            onClose={() => setShowUploadModal(false)}
            onSuccess={handleUploadSuccess}
            defaultCategory={uploadDefaultCategory}
            user={user}
          />
        )}
      </>
    );
  }

  const formatStat = (num) => {
    const n = Number(num) || 0;
    return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  };

  const postsCount = creatorStats.posts !== undefined ? Math.max(creatorStats.posts, creatorPosts.length) : creatorPosts.length;
  const followersCount = creatorStats.followers !== undefined ? creatorStats.followers : (user?.followers_count || 0);
  const followingCount = creatorStats.following !== undefined ? creatorStats.following : (user?.following_count !== undefined ? user.following_count : (user?.follows?.length || 0));
  const likesCount = creatorStats.likes || (liked?.length || 0);

  const renderProfileBody = () => (
    <>
      {/* 🌟 INSTAGRAM / CREATOR STYLE PROFILE HEADER */}
      <div style={{ padding: isDesktop ? "28px 20px 10px 20px" : "16px 16px 8px 16px" }}>
          
          {/* MOBILE HEADER LAYOUT */}
          {!isDesktop ? (
            <div>
              {/* Top Row: Details on left; Avatar on right */}
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "14px", marginBottom: "14px" }}>
                
                {/* Display Name, Bio, Inline Stats */}
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
                      {user?.display_name || user?.username || "Member"}
                    </h1>
                  </div>

                  {/* Line 2: Bio directly next under display name */}
                  {(user?.creator_bio || user?.bio || user?.is_creator) && (
                    <p style={{
                      fontSize: "13px",
                      color: "#c8c8c8",
                      lineHeight: "1.4",
                      margin: "2px 0 0 0",
                      wordBreak: "break-word"
                    }}>
                      {user?.creator_bio || user?.bio || APP_CONFIG.profileBioSubtitle}
                    </p>
                  )}

                  {/* Line 3: Followers, following, likes count */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                    fontSize: "12.5px",
                    color: "#8e8e93",
                    marginTop: "6px"
                  }}>
                    <span
                      onClick={() => handleOpenFollowList("followers")}
                      style={{ cursor: "pointer" }}
                    >
                      <strong style={{ color: "#d4d4d8", fontWeight: "700" }}>{formatStat(followersCount)}</strong>{" "}
                      <span>followers</span>
                    </span>
                    <span style={{ color: "rgba(255, 255, 255, 0.25)" }}>·</span>
                    <span
                      onClick={() => handleOpenFollowList("following")}
                      style={{ cursor: "pointer" }}
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

                {/* Avatar on Right (Story ring if active) + Camera Edit Badge */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <StoryAvatar
                    username={user?.username}
                    avatarUrl={user?.avatar_url}
                    displayName={user?.display_name || user?.username}
                    size={84}
                    borderWidth={3}
                    onClick={() => setShowEditModal(true)}
                  />
                  
                  {/* Camera / Edit shortcut badge */}
                  <button 
                    onClick={() => setShowEditModal(true)} 
                    style={mobileAvatarEditBadge}
                    title="Change Profile Photo"
                  >
                    <Camera size={13} color="#d4d4d8" />
                  </button>
                </div>

              </div>

              {/* Action Buttons Row */}
              <div style={mobileActionButtonsRow}>
                <button 
                  onClick={() => setShowEditModal(true)} 
                  style={{
                    ...mobileActionButton,
                    backgroundColor: "#e4e4e7",
                    color: "#09090b",
                    fontWeight: "700"
                  }}
                >
                  Edit profile
                </button>
                <button 
                  onClick={() => {
                    setUploadDefaultCategory(activeTab === "premium" && user?.is_creator ? "premium" : "community");
                    setShowUploadModal(true);
                  }} 
                  style={{
                    ...mobileActionButton,
                    backgroundColor: "#27272a",
                    color: "#f4f4f5",
                    border: "1px solid rgba(255,255,255,0.08)",
                    fontWeight: "700"
                  }}
                >
                  <Plus size={16} color="#f4f4f5" />
                  <span>Upload</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDiscoverCreators(prev => !prev)}
                  style={{
                    height: "36px",
                    width: "36px",
                    minWidth: "36px",
                    borderRadius: "20px",
                    backgroundColor: showDiscoverCreators ? "rgba(255, 255, 255, 0.18)" : "#27272a",
                    border: showDiscoverCreators ? "1px solid rgba(255, 255, 255, 0.28)" : "1px solid rgba(255, 255, 255, 0.08)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "all 0.2s ease"
                  }}
                  title="Discover creators"
                  aria-label="Discover creators"
                >
                  <UserPlus size={17} color={showDiscoverCreators ? "#f4f4f5" : "#d4d4d8"} />
                </button>
              </div>

              {/* Website Link & Location */}
              {(user?.website || user?.location) && (
                <div style={metaRowStyle}>
                  {user?.website && (
                    <a 
                      href={user.website.startsWith("http") ? user.website : `https://${user.website}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={websiteLinkStyle}
                    >
                      <Link2 size={13} color="#00aff0" />
                      <span>{user.website.replace(/^https?:\/\//, "")}</span>
                    </a>
                  )}
                  {user?.location && (
                    <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12.5px", color: "#8e8e93" }}>
                      <MapPin size={13} color="#8e8e93" />
                      <span>{user.location}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* DESKTOP HEADER LAYOUT */
            <div style={{ display: "flex", gap: "36px", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "24px" }}>
              
              {/* Desktop Details (Left column) */}
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
                    {user?.display_name || user?.username || "Member"}
                  </h1>
                </div>

                {/* Line 2: Bio directly under display name */}
                {(user?.creator_bio || user?.bio || user?.is_creator) && (
                  <p style={{
                    fontSize: "14px",
                    color: "#c8c8c8",
                    lineHeight: "1.45",
                    margin: "4px 0 6px 0",
                    maxWidth: "600px",
                    wordBreak: "break-word"
                  }}>
                    {user?.creator_bio || user?.bio || APP_CONFIG.profileBioSubtitle}
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
                  >
                    <strong style={{ color: "#d4d4d8", fontSize: "16px", fontWeight: "700" }}>{formatStat(followersCount)}</strong>{" "}
                    <span>followers</span>
                  </span>
                  <span style={{ color: "rgba(255, 255, 255, 0.25)" }}>·</span>
                  <span
                    onClick={() => handleOpenFollowList("following")}
                    style={{ cursor: "pointer" }}
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
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                  <button 
                    onClick={() => setShowEditModal(true)} 
                    style={{
                      ...desktopActionButton,
                      backgroundColor: "#e4e4e7",
                      color: "#09090b",
                      fontWeight: "700"
                    }}
                  >
                    Edit profile
                  </button>
                  <button 
                    onClick={() => {
                      setUploadDefaultCategory(activeTab === "premium" && user?.is_creator ? "premium" : "community");
                      setShowUploadModal(true);
                    }} 
                    style={{
                      ...desktopActionButton,
                      backgroundColor: "#27272a",
                      color: "#f4f4f5",
                      border: "1px solid rgba(255,255,255,0.08)",
                      fontWeight: "700"
                    }}
                  >
                    <Plus size={16} color="#f4f4f5" />
                    <span>Upload Video</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDiscoverCreators(prev => !prev)}
                    style={{
                      height: "36px",
                      width: "36px",
                      minWidth: "36px",
                      borderRadius: "20px",
                      backgroundColor: showDiscoverCreators ? "rgba(255, 255, 255, 0.18)" : "#27272a",
                      border: showDiscoverCreators ? "1px solid rgba(255, 255, 255, 0.28)" : "1px solid rgba(255, 255, 255, 0.08)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      flexShrink: 0,
                      transition: "all 0.2s ease"
                    }}
                    title="Discover creators"
                    aria-label="Discover creators"
                  >
                    <UserPlus size={18} color={showDiscoverCreators ? "#f4f4f5" : "#d4d4d8"} />
                  </button>
                  <button onClick={handleOpenSettings} style={desktopIconBtnStyle} title="Settings">
                    <Settings size={18} color="#d4d4d8" />
                  </button>
                </div>

                {/* Links & Meta */}
                {(user?.website || user?.location) && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center", fontSize: "13px", color: "#8e8e93" }}>
                    {user?.website && (
                      <a 
                        href={user.website.startsWith("http") ? user.website : `https://${user.website}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={websiteLinkStyle}
                      >
                        <Link2 size={14} color="#00aff0" />
                        <span>{user.website.replace(/^https?:\/\//, "")}</span>
                      </a>
                    )}
                    {user?.location && (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                        <MapPin size={14} color="#8e8e93" />
                        <span>{user.location}</span>
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Desktop Avatar (Right column 132px, Story ring if active) */}
              <div style={{ flexShrink: 0, position: "relative" }}>
                <StoryAvatar
                  username={user?.username}
                  avatarUrl={user?.avatar_url}
                  displayName={user?.display_name || user?.username}
                  size={132}
                  borderWidth={3.5}
                  onClick={() => setShowEditModal(true)}
                />
                <button 
                  onClick={() => setShowEditModal(true)} 
                  style={desktopAvatarEditBadge}
                  title="Change Profile Photo"
                >
                  <Camera size={15} color="#d4d4d8" />
                </button>
              </div>

            </div>
          )}

        </div>

        {/* 🌟 DISCOVER CREATORS (TOGGLED VIA INSTAGRAM USERPLUS BUTTON) */}
        {showDiscoverCreators && (
          <div style={{ 
            width: "100%", 
            maxWidth: isDesktop ? "935px" : "100%",
            margin: isDesktop ? "0 auto 8px auto" : "0 0 4px 0",
            boxSizing: "border-box"
          }}>
            <DiscoverCreatorsSection 
              user={user}
              excludeUsername={user?.username}
              onCreatorClick={(uname) => {
                if (onCreatorClick) {
                  onCreatorClick(uname);
                } else {
                  window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: uname }));
                }
              }}
              onSeeAll={handleOpenDiscover}
              title="Discover Creators"
              style={{
                margin: 0,
                background: "transparent",
                borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                borderBottom: "none",
                padding: isDesktop ? "16px 0" : "14px 12px"
              }}
            />
          </div>
        )}

        {/* 🌟 INSTAGRAM STORY HIGHLIGHTS TRAY */}
        <StoryHighlightsTray
          highlights={highlights}
          creator={user}
          isOwner={true}
          onHighlightCreated={(newHl) => {
            setHighlights((prev) => [newHl, ...prev.filter(h => h.id !== newHl.id && !h.is_auto)]);
          }}
          onHighlightDeleted={(deletedId) => {
            setHighlights((prev) => prev.filter(h => h.id !== deletedId));
          }}
          style={{
            padding: isDesktop ? "0 0 18px 0" : "4px 12px 14px 12px"
          }}
        />

        {/* 🌟 INSTAGRAM PROFILE TABS NAVIGATION */}
        <div style={{ 
          ...tabsContainerStyle, 
          justifyContent: isDesktop ? "center" : "space-around",
          gap: isDesktop ? "50px" : "0",
          borderTop: "1px solid #262626",
          top: isDesktop ? "0" : (shouldHideUI ? "0px" : "48px"),
          transition: "top 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        }}>
          <TabButton 
            isDesktop={isDesktop} 
            active={activeTab === "videos"} 
            onClick={() => setActiveTab("videos")} 
            icon={<Grid3X3 size={isDesktop ? 16 : 22} />} 
            label="POSTS" 
          />
          {user?.is_creator && (
            <TabButton 
              isDesktop={isDesktop} 
              active={activeTab === "premium"} 
              onClick={() => setActiveTab("premium")} 
              icon={<Lock size={isDesktop ? 16 : 22} />} 
              label="VIP EXCLUSIVE" 
            />
          )}
          <TabButton 
            isDesktop={isDesktop} 
            active={activeTab === "likes"} 
            onClick={() => setActiveTab("likes")} 
            icon={<Heart size={isDesktop ? 16 : 22} />} 
            label="LIKED" 
          />
          <TabButton 
            isDesktop={isDesktop} 
            active={activeTab === "saved"} 
            onClick={() => setActiveTab("saved")} 
            icon={<Bookmark size={isDesktop ? 16 : 22} />} 
            label="SAVED" 
          />
          {!user?.is_creator && (
            <TabButton 
              isDesktop={isDesktop} 
              active={activeTab === "subscriptions"} 
              onClick={() => setActiveTab("subscriptions")} 
              icon={<Sparkles size={isDesktop ? 16 : 22} />} 
              label="VIP PASSES" 
            />
          )}
        </div>

        {/* 🌟 VIDEO FEED GRID / SUBSCRIPTIONS */}
        <div style={{ 
          paddingTop: isDesktop ? "20px" : "14px",
          paddingBottom: "30px",
          width: "100%",
          boxSizing: "border-box"
        }}>
          
          {activeGroup && (
            <div style={groupHeaderStyle}>
              <button onClick={handleCloseGroup} style={backButtonStyle}>
                <ArrowLeft size={20} />
                <span>Back to profile</span>
              </button>
              <span 
                style={groupTitleStyle} 
                title={activeGroup.title || "Collection"}
              >
                {(activeGroup.title || "Collection").slice(0, 32)} ({activeGroup.videos.length} clips)
              </span>
            </div>
          )}

          {activeTab === "subscriptions" ? (
            <div style={{ maxWidth: "600px", margin: "0 auto", padding: "10px 0" }}>
              {(!user?.subscriptions || user.subscriptions.length === 0) ? (
                <div style={{ padding: "60px 20px", textAlign: "center", color: "#8e8e93" }}>
                  <div style={{ width: "60px", height: "60px", borderRadius: "50%", border: "2px solid #333", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto" }}>
                    <Sparkles size={28} color="#FFD700" />
                  </div>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#d4d4d8", margin: "0 0 6px 0" }}>
                    No Active VIP Passes
                  </h3>
                  <p style={{ fontSize: "13px", color: "#8e8e93", maxWidth: "320px", margin: "0 auto 20px auto", lineHeight: "1.4" }}>
                    Subscribe to your favorite creators to unlock their private releases and VIP exclusive content.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {user.subscriptions.map((sub, idx) => (
                    <div key={idx} style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "#161616",
                      border: "1px solid #262626",
                      borderRadius: "14px",
                      padding: "14px 16px"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                        <div style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "50%",
                          background: "linear-gradient(135deg, #FFD700, #ff8c00)",
                          padding: "2px",
                          flexShrink: 0
                        }}>
                          <img 
                            src={`/avatar.jpg?user_id=${sub.creator_id}`}
                            onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                          />
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "14px", fontWeight: "700", color: "#d4d4d8" }}>
                              {sub.creator_display_name || sub.creator_username || "Creator"}
                            </span>
                            <TwitterVerifiedBadge size={14} style={{ flexShrink: 0 }} />
                          </div>
                          <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px" }}>
                            @{sub.creator_username || "creator"} · <span style={{ color: "#f43f5e", fontWeight: "600" }}>Active VIP Pass</span>
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent("openCreatorProfile", {
                            detail: { username: sub.creator_username }
                          }));
                        }}
                        style={{
                          padding: "8px 16px",
                          borderRadius: "100px",
                          background: "rgba(255, 215, 0, 0.15)",
                          border: "1px solid rgba(255, 215, 0, 0.4)",
                          color: "#FFD700",
                          fontSize: "12px",
                          fontWeight: "700",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <span>View Channel</span>
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              {activeTab === "videos" && !activeGroup ? (
                <div style={{ 
                  maxWidth: "600px", 
                  margin: "0 auto", 
                  width: "100%",
                  borderLeft: isDesktop ? "1px solid var(--border-color, #262626)" : "none",
                  borderRight: isDesktop ? "1px solid var(--border-color, #262626)" : "none",
                  animation: "fadeIn 0.3s ease-out"
                }}>
                  {videosToDisplay.map((v, idx) => (
                    <FeedPost 
                      key={`${v.chat_id || ''}:${v.message_id || v.id || idx}`} 
                      video={v} 
                      isLast={idx === videosToDisplay.length - 1} 
                      onVideoClick={(vData) => handleOpenVideo(vData)} 
                      onCommentClick={(vData) => {
                        if (onCommentClick) {
                          onCommentClick(vData);
                        } else {
                          window.dispatchEvent(new CustomEvent("openCommentModal", { detail: { video: vData } }));
                        }
                      }} 
                      isAnyModalOpen={isAnyModalOpen} 
                      onCreatorClick={onCreatorClick} 
                      onReportClick={(vData) => setReportedVideo(vData)} 
                      onOptionsClick={(vData) => setOptionsVideo(vData)} 
                      user={user} 
                    />
                  ))}
                </div>
              ) : (
                <div style={{ 
                  display: "grid", 
                  gridTemplateColumns: isDesktop ? "repeat(4, minmax(0, 1fr))" : "repeat(3, minmax(0, 1fr))", 
                  gap: isDesktop ? "16px" : "4px",
                  alignItems: "start",
                  animation: "fadeIn 0.3s ease-out",
                  width: "100%"
                }}>
                  {videosToDisplay.map((v, idx) => (
                    <VideoCard 
                      key={`${v.chat_id}:${v.message_id}`} 
                      video={v} 
                      priority={idx < 2}
                      onOpen={(vData, e) => handleOpenVideo(vData, e)} 
                      showDetails={false}
                    />
                  ))}
                </div>
              )}
              
              {loading && !activeGroup && (
                <div style={loaderStyle}>Loading posts...</div>
              )}
              
              {!loading && !activeGroup && filteredRawVideos.length === 0 && (
                <div style={{ padding: "80px 20px", textAlign: "center", color: "#8e8e93" }}>
                  <div style={{ width: "60px", height: "60px", borderRadius: "50%", border: "2px solid #333", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto" }}>
                    {activeTab === "likes" ? (
                      <Heart size={28} color="#555" />
                    ) : activeTab === "saved" ? (
                      <Bookmark size={28} color="#555" />
                    ) : activeTab === "premium" ? (
                      <Lock size={28} color="#555" />
                    ) : (
                      <Grid3X3 size={28} color="#555" />
                    )}
                  </div>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#d4d4d8", margin: "0 0 6px 0" }}>
                    {activeTab === "likes" 
                      ? "No Liked Videos Yet" 
                      : activeTab === "saved"
                      ? "No Saved Videos Yet"
                      : activeTab === "premium"
                      ? "No VIP Exclusive Posts"
                      : "Share Your First Video"}
                  </h3>
                  <p style={{ fontSize: "13px", color: "#8e8e93", maxWidth: "300px", margin: "0 auto", lineHeight: "1.4" }}>
                    {activeTab === "likes" 
                      ? "Videos you like will appear here." 
                      : activeTab === "saved"
                      ? "Videos you bookmark will appear here for easy access."
                      : activeTab === "premium"
                      ? "Exclusive paywalled content for your subscribers will be displayed here."
                      : "Upload videos and reels to your profile. Want to set a subscription price and monetize? Complete Email & Identity KYC."}
                  </p>
                  {(activeTab === "videos" || activeTab === "premium") && (
                    <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap", marginTop: "16px" }}>
                      <button
                        onClick={() => {
                          setUploadDefaultCategory(activeTab === "premium" && user?.is_creator ? "premium" : "community");
                          setShowUploadModal(true);
                        }}
                        style={{
                          padding: "10px 20px",
                          borderRadius: "10px",
                          background: "#e4e4e7",
                          color: "#09090b",
                          border: "none",
                          fontSize: "13.5px",
                          fontWeight: "700",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px"
                        }}
                      >
                        <Plus size={16} />
                        <span>Upload {activeTab === "premium" ? "VIP Exclusive Post" : "First Video"}</span>
                      </button>
                      {!user?.is_creator && (
                        <button
                          onClick={() => setShowSetupModal(true)}
                          style={{
                            padding: "10px 18px",
                            borderRadius: "10px",
                            background: "rgba(225, 29, 72, 0.14)",
                            color: "#f43f5e",
                            border: "1px solid rgba(225, 29, 72, 0.28)",
                            fontSize: "13.5px",
                            fontWeight: "700",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "6px"
                          }}
                        >
                          <ShieldCheck size={16} />
                          <span>Verify & Monetize</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {!loading && !activeGroup && filteredRawVideos.length > 0 && (
                <div ref={loaderRef} style={{ height: "10px", width: "100%" }} />
              )}
            </>
          )}

        </div>
    </>
  );

  return (
    <>
      {isDesktop ? (
        <div style={desktopContainerStyle}>
          <div style={desktopInnerWrapperStyle}>
            {/* 1. LEFT SIDEBAR: Navigation Rail */}
            <DesktopLeftSidebar
              user={user}
              activeNav="profile"
              onNavigateHome={() => window.location.href = "/"}
              onProfileClick={() => {}}
              onOpenDiscover={handleOpenDiscover}
              onPostClick={() => {
                setUploadDefaultCategory(activeTab === "premium" && user?.is_creator ? "premium" : "community");
                setShowUploadModal(true);
              }}
              onSelectCategory={(catId) => { window.location.href = `/?tab=explore&category=${catId}`; }}
              onTabSwitch={(tab) => {
                if (tab === "community") window.location.href = "/?tab=explore&sub=community";
                else window.location.href = "/?tab=explore";
              }}
            />

            {/* 2. MIDDLE COLUMN: Profile View */}
            <div
              ref={scrollContainerRef}
              className="custom-scrollbar"
              style={desktopCenterProfileRailStyle}
            >
              {/* Desktop Sticky Header */}
              <div style={desktopProfileStickyHeaderStyle}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={desktopProfileHeaderTitleStyle}>
                    {user?.display_name || user?.username || "Profile"}
                  </span>
                  {(user?.is_creator || user?.is_verified) && (
                    <TwitterVerifiedBadge size={16} />
                  )}
                </div>
                <button 
                  onClick={handleOpenSettings} 
                  style={desktopHeaderIconBtnStyle} 
                  title="Settings"
                >
                  <Settings size={18} color="#d4d4d8" />
                </button>
              </div>

              {/* Profile Body */}
              {renderProfileBody()}
            </div>

            {/* 3. RIGHT SIDEBAR: Highlights & Trends */}
            <DesktopRightSidebar
              user={user}
              onCreatorClick={onCreatorClick}
              onVideoClick={setActiveVideo}
              onOpenDiscover={handleOpenDiscover}
              onSelectTopic={(catId) => { window.location.href = `/?tab=explore&category=${catId}`; }}
              onSearchSubmit={(q) => { window.location.href = `/?tab=explore&q=${encodeURIComponent(q)}`; }}
            />
          </div>
        </div>
      ) : (
        <div
          ref={scrollContainerRef} 
          style={{ 
            ...containerStyle, 
            paddingTop: "0", 
            paddingLeft: "0",
            paddingRight: "0",
            paddingBottom: shouldHideUI ? "0px" : "75px",
            transition: "padding-bottom 0.3s ease",
            overflowY: "auto",  
            height: "100vh"     
          }}
        >
          {/* TOP NAV BAR (Mobile) */}
          <div style={{
            ...navGridStyle,
            transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease",
            transform: shouldHideUI ? "translateY(-100%)" : "translateY(0)",
            opacity: shouldHideUI ? 0 : 1,
            pointerEvents: shouldHideUI ? "none" : "auto"
          }}>
            <div style={{ width: "36px" }}>
              {activeGroup && (
                <button onClick={handleCloseGroup} style={headerIconButton}>
                  <ArrowLeft size={22} color="#d4d4d8" />
                </button>
              )}
            </div>
            <div style={centerTitleContainer}>
              <h2 style={usernameStyle}>{user?.username || APP_CONFIG.defaultUploader}</h2>
              {(user?.is_creator || user?.is_verified) && (
                <TwitterVerifiedBadge size={15} style={{ marginLeft: "4px" }} />
              )}
              <ChevronDown size={14} color="#a8a8a8" style={{ marginLeft: "2px" }} />
            </div>
            <div style={{ display: "flex", gap: "14px", justifyContent: "flex-end", flex: 1, alignItems: "center" }}>
              <button onClick={handleOpenSettings} style={headerIconButton} title="Settings">
                <Settings size={21} color="#d4d4d8" />
              </button>
            </div>
          </div>

          {/* Profile Body */}
          {renderProfileBody()}
        </div>
      )}

      {/* 🌟 FOLLOWERS / FOLLOWING LIST MODAL */}
      {followListTab && user?.username && (
        <FollowListModal
          username={user.username}
          displayName={user.display_name || user.username}
          initialTab={followListTab}
          followersCount={followersCount}
          followingCount={followingCount}
          isOwner={true}
          currentUser={user}
          onClose={handleCloseFollowList}
          onTabChange={handleFollowListTabChange}
          onSelectUser={(uname) => {
            const cleanTarget = String(uname || "").replace(/^@/, "").trim();
            if (!cleanTarget) return;
            if (user?.username && cleanTarget.toLowerCase() === user.username.toLowerCase()) {
              handleCloseFollowList();
              return;
            }
            followListTabRef.current = null;
            setFollowListTab(null);
            if (onCreatorClick) {
              onCreatorClick(cleanTarget);
            } else {
              window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: cleanTarget }));
            }
          }}
          onCountsChange={({ followersDelta = 0, followingDelta = 0 }) => {
            setCreatorStats(prev => ({
              ...prev,
              followers: Math.max(0, (prev.followers || 0) + followersDelta),
              following: Math.max(0, (prev.following || 0) + followingDelta)
            }));
          }}
        />
      )}

      {/* 🌟 PROFILE EDIT MODAL */}
      {showEditModal && (
        <EditProfileModal 
          user={user}
          onClose={() => setShowEditModal(false)}
          onOpenCreatorSetup={() => setShowSetupModal(true)}
          onUpdateSuccess={(updatedUser) => {
            handleUpdateSuccess(updatedUser);
            setShowEditModal(false);
          }}
        />
      )}

      {/* 🌟 CREATOR ONBOARDING MODAL */}
      {showSetupModal && (
        <CreatorSetupModal 
          user={user}
          onClose={() => setShowSetupModal(false)}
          onSetupSuccess={(updatedUser) => {
            handleUpdateSuccess(updatedUser);
            setShowSetupModal(false);
          }}
        />
      )}

      {/* 🌟 CREATOR FAN PREVIEW MODAL */}
      {showPreviewModal && user?.username && (
        <CreatorProfileModal 
          creatorUsername={user.username}
          currentUser={user}
          onClose={() => setShowPreviewModal(false)}
          onVideoClick={handleOpenVideo}
          setShowPaywall={setShowPaywall}
        />
      )}

      {/* 🌟 CREATOR STUDIO MODAL */}
      {showStudioModal && (
        <CreatorStudioModal 
          isOpen={showStudioModal}
          onClose={() => setShowStudioModal(false)}
          user={user}
          onUpdateUser={(updated) => {
            handleUpdateSuccess(updated);
          }}
        />
      )}

      {/* 🌟 CREATOR CONTENT UPLOAD MODAL */}
      {showUploadModal && (
        <CreatorUploadModal 
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onSuccess={handleUploadSuccess}
          defaultCategory={uploadDefaultCategory}
          user={user}
        />
      )}

      {/* 🌟 DISCOVER CREATORS MODAL */}
      {showDiscoverModal && (
        <DiscoverCreatorsModal 
          isOpen={showDiscoverModal}
          currentUser={user}
          onClose={() => setShowDiscoverModal(false)}
          onCreatorClick={(uname) => {
            setShowDiscoverModal(false);
            if (onCreatorClick) {
              onCreatorClick(uname);
            } else {
              window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: uname }));
            }
          }}
        />
      )}

      {/* 🌟 POST OPTIONS MODAL (X-Style Bottom Sheet) */}
      {optionsVideo && (
        <PostOptionsModal
          isOpen={Boolean(optionsVideo)}
          video={optionsVideo}
          currentUser={user}
          isFollowing={false}
          onClose={() => setOptionsVideo(null)}
          onReport={(v) => {
            setOptionsVideo(null);
            setReportedVideo(v || optionsVideo);
          }}
          onNotInterested={() => setOptionsVideo(null)}
          onDelete={(id) => {
            if (id) {
              setDeletedVideoIds(prev => new Set([...prev, String(id)]));
            }
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
    </>
  );
}

// 🎨 COMPONENT UI PIECES
const TabButton = ({ active, onClick, icon, label, isDesktop }) => (
  <button onClick={onClick} style={{ 
    display: "flex", 
    flexDirection: isDesktop ? "row" : "column", 
    alignItems: "center", 
    justifyContent: "center",
    gap: isDesktop ? "8px" : "6px",
    background: "none", 
    border: "none", 
    padding: isDesktop ? "16px 0" : "12px 0",
    borderTop: (isDesktop && active) ? "1px solid #e4e4e7" : "none",
    borderBottom: (!isDesktop && active) ? "2px solid #e4e4e7" : "none",
    opacity: active ? 1 : 0.45, 
    color: active ? "#f4f4f5" : "#71717a", 
    cursor: "pointer",
    marginTop: isDesktop ? "-1px" : "0",
    flex: 1,
    transition: "all 0.15s ease"
  }}>
    {icon}
    {isDesktop && (
      <span style={{ fontSize: "12px", fontWeight: "700", letterSpacing: "1px" }}>{label}</span>
    )}
  </button>
);

// 🖌 STYLES (Clean Calm Black Instagram Dark Theme)
const containerStyle = { 
  minHeight: "100%", 
  background: "var(--bg-color)", 
  color: "#f5f5f5", 
  position: "relative", 
  overflowX: "hidden" 
};

// 🌟 DESKTOP 3-COLUMN LAYOUT STYLES (Twitter/X Inspired)
const desktopContainerStyle = {
  display: "flex",
  justifyContent: "center",
  width: "100%",
  height: "100vh",
  overflow: "hidden",
  background: "var(--bg-color)"
};

const desktopInnerWrapperStyle = {
  display: "flex",
  justifyContent: "center",
  width: "100%",
  maxWidth: "1420px",
  height: "100vh",
  position: "relative"
};

const desktopCenterProfileRailStyle = {
  flex: 1,
  maxWidth: "680px",
  width: "100%",
  minWidth: 0,
  height: "100vh",
  overflowY: "auto",
  borderLeft: "1px solid var(--border-color)",
  borderRight: "1px solid var(--border-color)",
  display: "flex",
  flexDirection: "column",
  position: "relative",
  background: "var(--bg-color)"
};

const desktopProfileStickyHeaderStyle = {
  position: "sticky",
  top: 0,
  zIndex: 95,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 20px",
  backgroundColor: "rgba(9, 9, 11, 0.82)",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)",
  borderBottom: "1px solid var(--border-color)",
  minHeight: "53px",
  boxSizing: "border-box"
};

const desktopProfileHeaderTitleStyle = {
  fontSize: "18px",
  fontWeight: "800",
  color: "#f4f4f5",
  letterSpacing: "-0.3px",
  margin: 0
};

const desktopHeaderIconBtnStyle = {
  background: "rgba(255, 255, 255, 0.06)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "50%",
  width: "36px",
  height: "36px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "all 0.15s ease"
};

const desktopInnerWrapper = { maxWidth: "935px", margin: "0 auto", width: "100%" };
const navGridStyle = { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid rgba(255, 255, 255, 0.08)", position: "sticky", top: 0, background: "#09090b", zIndex: 100, backdropFilter: "blur(20px)" };
const centerTitleContainer = { display: "flex", alignItems: "center", cursor: "pointer" };
const usernameStyle = { fontSize: "16px", fontWeight: "700", margin: 0, color: "#d4d4d8" };
const tabsContainerStyle = { display: "flex", position: "sticky", background: "#09090b", zIndex: 90 };
const loaderStyle = { padding: "40px", textAlign: "center", color: "#737373", fontSize: "14px" };

const groupHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#121214", borderBottom: "1px solid #262626" };
const backButtonStyle = { display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#d4d4d8", fontSize: "14px", fontWeight: "600", cursor: "pointer", padding: "0" };
const groupTitleStyle = { 
  fontSize: "13px", 
  color: "#8e8e8e", 
  fontWeight: "500",
  maxWidth: "50%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap"
};

const headerIconButton = { background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: "4px" };
const desktopIconBtnStyle = { background: "#262626", border: "1px solid #363636", borderRadius: "8px", width: "36px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };

// TikTok / Creator Avatars (Clean, no story blue outline)
const storyGradientRingMobile = {
  borderRadius: "50%",
  display: "inline-block"
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

const mobileAvatarEditBadge = {
  position: "absolute",
  bottom: "2px",
  right: "2px",
  width: "26px",
  height: "26px",
  borderRadius: "50%",
  backgroundColor: "#00aff0",
  border: "2px solid #000000",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(0,0,0,0.5)"
};

const desktopAvatarEditBadge = {
  position: "absolute",
  bottom: "6px",
  right: "6px",
  width: "34px",
  height: "34px",
  borderRadius: "50%",
  backgroundColor: "#00aff0",
  border: "2.5px solid #000000",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 2px 8px rgba(0,0,0,0.6)"
};

// 3 Stat Columns
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
  fontSize: "13.5px",
  fontWeight: "600"
};

const metaRowStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: "14px",
  alignItems: "center",
  fontSize: "12.5px",
  color: "#8e8e93",
  marginTop: "10px"
};

const vipPricingBadgeStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  backgroundColor: "rgba(255, 215, 0, 0.08)",
  border: "1px solid rgba(255, 215, 0, 0.25)",
  borderRadius: "6px",
  padding: "3px 8px",
  fontSize: "12px",
  fontWeight: "700",
  color: "#FFD700"
};

// Professional Dashboard Box
const professionalCardStyle = {
  backgroundColor: "#16181c",
  border: "1px solid #262626",
  borderRadius: "10px",
  padding: "12px 14px",
  margin: "12px 0 14px 0",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  cursor: "pointer",
  transition: "background-color 0.15s ease"
};

const professionalIconStyle = {
  width: "36px",
  height: "36px",
  borderRadius: "8px",
  backgroundColor: "rgba(0, 149, 246, 0.12)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0
};

// Action Buttons
const mobileActionButtonsRow = {
  display: "flex",
  gap: "8px",
  marginTop: "12px",
  marginBottom: "8px"
};

const mobileActionButton = {
  flex: 1,
  height: "36px",
  backgroundColor: "#262626",
  color: "#d4d4d8",
  border: "1px solid #363636",
  borderRadius: "20px",
  fontSize: "13px",
  fontWeight: "700",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  cursor: "pointer",
  transition: "all 0.2s ease"
};

const desktopActionButton = {
  height: "36px",
  padding: "0 20px",
  backgroundColor: "#262626",
  color: "#d4d4d8",
  border: "1px solid #363636",
  borderRadius: "20px",
  fontSize: "13px",
  fontWeight: "700",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  cursor: "pointer",
  transition: "all 0.2s ease"
};

