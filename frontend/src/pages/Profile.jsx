import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { 
  Settings, Grid3X3, Heart, Lock, CheckCircle, Share2, ArrowLeft, 
  Camera, Sparkles, Edit3, MapPin, Globe, Award, ExternalLink, ShieldCheck, Eye,
  Film, Play, Plus, ChevronRight, TrendingUp, Link2, ChevronDown, Bookmark, Copy, MessageCircle
} from "lucide-react"; 
import VideoCard from "../components/VideoCard"; 
import SettingsView from "../components/SettingsView"; 
import CreatorSetupModal from "../components/CreatorSetupModal";
import EditProfileModal from "../components/EditProfileModal";
import CreatorProfileModal from "../components/CreatorProfileModal";
import CreatorStudioModal from "../components/CreatorStudioModal";
import CreatorUploadModal from "../components/CreatorUploadModal";
import { useVideos } from "../hooks/useVideos";

// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../config";
import { isUserSubscribedToCreator, getVideoCreatorHandle } from "../utils/subscription";

export default function Profile({ 
  user, 
  onLogout, 
  setHideFooter, 
  setActiveVideo, 
  setShowPaywall, 
  onUpdateUser 
}) {
  const [activeTab, setActiveTab] = useState(user?.is_creator ? "videos" : "likes");
  const [currentView, setCurrentView] = useState("profile");
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);

  useEffect(() => {
    if (!user?.is_creator && (activeTab === "videos" || activeTab === "reels" || activeTab === "premium")) {
      setActiveTab("likes");
    }
  }, [user?.is_creator]);
  
  const [activeGroup, setActiveGroup] = useState(null);
  const [deletedVideoIds, setDeletedVideoIds] = useState(new Set());
  const [showStudioModal, setShowStudioModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDefaultCategory, setUploadDefaultCategory] = useState("hotties");
  
  // Creator Modals
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  
  // Live creator stats
  const [creatorStats, setCreatorStats] = useState({
    posts: 0,
    subscribers: 0,
    likes: 0,
    views: 0
  });

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

  // Fetch live stats for creator profile from DB
  useEffect(() => {
    if (!user?.username) return;
    let isMounted = true;

    fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(user.username)}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (isMounted && data?.creator?.stats) {
          setCreatorStats(data.creator.stats);
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

  // Creator's own posts state
  const [creatorPosts, setCreatorPosts] = useState([]);
  const [creatorPostsLoading, setCreatorPostsLoading] = useState(false);
  const [creatorPostsPage, setCreatorPostsPage] = useState(1);
  const [hasMoreCreatorPosts, setHasMoreCreatorPosts] = useState(true);

  const fetchCreatorPosts = useCallback(async (targetPage, isNew) => {
    if (!user?.username || !user?.is_creator) return;
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
      console.error("Failed to load creator profile posts", e);
    } finally {
      setCreatorPostsLoading(false);
    }
  }, [user?.username, user?.is_creator, fetchLimit]);

  useEffect(() => {
    if (user?.is_creator && user?.username) {
      setCreatorPostsPage(1);
      fetchCreatorPosts(1, true);
    }
  }, [user?.is_creator, user?.username, fetchCreatorPosts]);

  const handleUploadSuccess = (newVideo) => {
    if (!newVideo) return;
    setCreatorPosts(prev => [newVideo, ...prev]);
    setCreatorStats(prev => ({
      ...prev,
      posts: (prev.posts || 0) + 1
    }));
    if (!user?.is_creator && onUpdateUser) {
      onUpdateUser({ ...user, is_creator: true, role: "creator" });
    }
  };

  let rawVideosToDisplay = [];
  let loading = false;
  let loadMore = () => {};

  if (user?.is_creator) {
    if (activeTab === "videos" || activeTab === "reels") {
      rawVideosToDisplay = creatorPosts;
      loading = creatorPostsLoading;
      loadMore = () => {
        if (!creatorPostsLoading && hasMoreCreatorPosts) {
          fetchCreatorPosts(creatorPostsPage, false);
        }
      };
    } else if (activeTab === "premium") {
      // Creator sees their own VIP Exclusive / Premium uploaded content
      rawVideosToDisplay = creatorPosts.filter(v => v.category === "premium");
      loading = creatorPostsLoading;
      loadMore = () => {
        if (!creatorPostsLoading && hasMoreCreatorPosts) {
          fetchCreatorPosts(creatorPostsPage, false);
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
  } else {
    // Non-creator viewer profile: strictly user-centric interactions (Liked, Saved)
    // Creators' uploaded content NEVER shows on regular user profiles
    if (activeTab === "likes") {
      rawVideosToDisplay = liked || [];
      loading = likedLoading;
      loadMore = loadMoreLiked;
    } else if (activeTab === "saved") {
      rawVideosToDisplay = saved || [];
      loading = savedLoading;
      loadMore = loadMoreSaved;
    }
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
        alert("🚨 Failed to load album contents.");
      }
      return;
    }

    if (video.category === "premium" || activeTab === "premium" || video.is_premium) {
      const hasAccess = isUserSubscribedToCreator(user, video);
      if (!hasAccess) {
        const creatorHandle = getVideoCreatorHandle(video);
        window.dispatchEvent(new CustomEvent("openCreatorProfile", { 
          detail: { username: creatorHandle, autoSubscribe: true } 
        }));
        return;
      }
    }

    try {
      setActiveVideo({ ...video, video_url: null }); 
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/video?chat_id=${video.chat_id}&message_id=${video.message_id}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      if (data.video_url) setActiveVideo(prev => ({ ...prev, video_url: data.video_url }));
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
      alert("Profile link copied to clipboard!");
    }
  };

  const handleUpdateSuccess = (updatedUser) => {
    if (onUpdateUser) {
      onUpdateUser(updatedUser);
    }
  };

  if (currentView === "settings") {
    return <SettingsView onBack={handleCloseSettings} onLogout={onLogout} />;
  }

  const formatStat = (num) => {
    const n = Number(num) || 0;
    return Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  };

  const postsCount = user?.is_creator ? (creatorStats.posts || creatorPosts.length || 0) : 0;
  const followersCount = user?.is_creator ? (creatorStats.subscribers || 0) : 0;
  const followingCount = user?.is_creator 
    ? (creatorStats.views || creatorStats.likes || 0) 
    : (user?.subscriptions?.length || 0);

  return (
    <div
      ref={scrollContainerRef} 
      style={{ 
        ...containerStyle, 
        paddingTop: "0", 
        paddingLeft: "0",
        paddingRight: "0",
        paddingBottom: isDesktop ? "40px" : (shouldHideUI ? "0px" : "75px"),
        transition: "padding-bottom 0.3s ease",
        overflowY: "auto",  
        height: "100vh"     
      }}
    >
      <div style={isDesktop ? desktopInnerWrapper : {}}>
        
        {/* TOP NAV BAR (Mobile) */}
        {!isDesktop && (
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
                  <ArrowLeft size={22} color="#fff" />
                </button>
              )}
            </div>
            <div style={centerTitleContainer}>
              <h2 style={usernameStyle}>{user?.username || APP_CONFIG.defaultUploader}</h2>
              {(user?.is_creator || user?.is_verified) && (
                <CheckCircle size={15} color="#0095f6" fill="#0095f6" style={{ marginLeft: "4px" }} />
              )}
              <ChevronDown size={14} color="#a8a8a8" style={{ marginLeft: "2px" }} />
            </div>
            <div style={{ display: "flex", gap: "14px", justifyContent: "flex-end", flex: 1, alignItems: "center" }}>
              <button onClick={handleShareProfile} style={headerIconButton} title="Share Profile">
                <Share2 size={20} color="#fff" />
              </button>
              <button onClick={handleOpenSettings} style={headerIconButton} title="Settings">
                <Settings size={21} color="#fff" />
              </button>
            </div>
          </div>
        )}

        {/* 🌟 MATURED INSTAGRAM PROFILE HEADER */}
        <div style={{ padding: isDesktop ? "36px 20px 10px 20px" : "14px 16px 8px 16px" }}>
          
          {/* MOBILE HEADER LAYOUT */}
          {!isDesktop ? (
            <div>
              {/* Row 1: Avatar + 3 Stat Columns */}
              <div style={{ display: "flex", alignItems: "center", marginBottom: "14px" }}>
                
                {/* Instagram Story Gradient Ring Avatar */}
                <div style={{ position: "relative", flexShrink: 0 }}>
                  <div style={storyGradientRingMobile}>
                    <div style={avatarInnerCircleMobile}>
                      <img
                        src={user?.avatar_url || "/assets/default-avatar.png"}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        alt="Avatar"
                        onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                      />
                    </div>
                  </div>
                  
                  {/* Camera / Edit shortcut badge */}
                  <button 
                    onClick={() => setShowEditModal(true)} 
                    style={mobileAvatarEditBadge}
                    title="Change Profile Photo"
                  >
                    <Plus size={13} color="#fff" strokeWidth={3} />
                  </button>
                </div>

                {/* 3 Stats: Posts, Followers, Following */}
                <div style={{ display: "flex", flex: 1, justifyContent: "space-around", alignItems: "center", marginLeft: "12px" }}>
                  <div style={statColStyle}>
                    <span style={statNumberStyle}>{formatStat(postsCount)}</span>
                    <span style={statLabelStyle}>posts</span>
                  </div>
                  <div style={statColStyle}>
                    <span style={statNumberStyle}>{formatStat(followersCount)}</span>
                    <span style={statLabelStyle}>followers</span>
                  </div>
                  <div style={statColStyle}>
                    <span style={statNumberStyle}>{formatStat(followingCount)}</span>
                    <span style={statLabelStyle}>following</span>
                  </div>
                </div>
              </div>

              {/* Row 2: Display Name, Category, Bio, Link */}
              <div style={{ marginBottom: "14px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "14.5px", fontWeight: "700", color: "#fff" }}>
                    {user?.display_name || user?.username || "Member"}
                  </span>
                  {(user?.is_creator || user?.is_verified) && (
                    <CheckCircle size={15} color="#0095f6" fill="#0095f6" />
                  )}
                  {user?.is_creator && (
                    <span style={creatorBadgeTagStyle}>CREATOR</span>
                  )}
                </div>

                {/* Creator Category in subtle Instagram gray */}
                <div style={{ fontSize: "12.5px", color: "#8e8e93", marginTop: "2px", fontWeight: "500" }}>
                  {user?.creator_category || (user?.is_creator ? "Digital Creator" : "Member")}
                </div>

                {/* Bio text */}
                <p style={{
                  fontSize: "13.5px",
                  color: "#f5f5f5",
                  lineHeight: "1.42",
                  margin: "8px 0 6px 0",
                  whiteSpace: "pre-wrap"
                }}>
                  {user?.creator_bio || user?.bio || (user?.is_creator ? APP_CONFIG.profileBioSubtitle : "Welcome to my profile.")}
                </p>

                {/* Website Link with link icon */}
                {user?.website && (
                  <div style={{ marginTop: "4px" }}>
                    <a 
                      href={user.website.startsWith("http") ? user.website : `https://${user.website}`} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      style={websiteLinkStyle}
                    >
                      <Link2 size={13} color="#0095f6" />
                      <span>{user.website.replace(/^https?:\/\//, "")}</span>
                    </a>
                  </div>
                )}

                {/* Location */}
                {user?.location && (
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12.5px", color: "#8e8e93", marginTop: "4px" }}>
                    <MapPin size={13} color="#8e8e93" />
                    <span>{user.location}</span>
                  </div>
                )}

                {/* VIP Pricing Badge if creator */}
                {user?.is_creator && (
                  <div style={{ marginTop: "8px" }}>
                    <span style={vipPricingBadgeStyle}>
                      <Sparkles size={12} color="#FFD700" />
                      <span>VIP Channel: {Number(user.subscription_price) > 0 ? `₦${Number(user.subscription_price).toLocaleString()} / mo` : "Free Access"}</span>
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* DESKTOP HEADER LAYOUT */
            <div style={{ display: "flex", gap: "60px", alignItems: "flex-start", marginBottom: "28px" }}>
              
              {/* Desktop Avatar (Left column 150px) */}
              <div style={{ flexShrink: 0, position: "relative", paddingLeft: "15px" }}>
                <div style={storyGradientRingDesktop}>
                  <div style={avatarInnerCircleDesktop}>
                    <img
                      src={user?.avatar_url || "/assets/default-avatar.png"}
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      alt="Avatar"
                      onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                    />
                  </div>
                </div>
                <button 
                  onClick={() => setShowEditModal(true)} 
                  style={desktopAvatarEditBadge}
                  title="Change Profile Photo"
                >
                  <Camera size={14} color="#fff" />
                </button>
              </div>

              {/* Desktop Details (Right column) */}
              <div style={{ flex: 1 }}>
                
                {/* Row 1: Username + Actions + Settings */}
                <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", marginBottom: "18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <h2 style={{ fontSize: "20px", fontWeight: "400", color: "#fff", margin: 0 }}>
                      {user?.username || APP_CONFIG.defaultUploader}
                    </h2>
                    {(user?.is_creator || user?.is_verified) && (
                      <CheckCircle size={18} color="#0095f6" fill="#0095f6" />
                    )}
                    {user?.is_creator && (
                      <span style={creatorBadgeTagStyle}>CREATOR</span>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <button onClick={() => setShowEditModal(true)} style={desktopActionButton}>
                      Edit profile
                    </button>
                    <button onClick={handleShareProfile} style={desktopActionButton}>
                      Share profile
                    </button>
                    {user?.is_creator ? (
                      <>
                        <button 
                          onClick={() => {
                            setUploadDefaultCategory(activeTab === "premium" ? "premium" : "hotties");
                            setShowUploadModal(true);
                          }}
                          style={{ 
                            ...desktopActionButton, 
                            background: "linear-gradient(135deg, #00aff0, #0088cc)", 
                            color: "#fff", 
                            border: "none", 
                            fontWeight: "700",
                            boxShadow: "0 2px 10px rgba(0, 175, 240, 0.3)"
                          }}
                        >
                          <Plus size={15} color="#fff" />
                          <span>Upload Video</span>
                        </button>
                        <button 
                          onClick={() => setShowStudioModal(true)} 
                          style={{ ...desktopActionButton, background: "rgba(255, 215, 0, 0.15)", border: "1px solid rgba(255, 215, 0, 0.4)", color: "#FFD700", fontWeight: "700" }}
                        >
                          <Sparkles size={14} color="#FFD700" />
                          <span>Creator Studio</span>
                        </button>
                        <button 
                          onClick={() => setShowPreviewModal(true)} 
                          style={{ ...desktopActionButton, color: "#00aff0" }}
                        >
                          <Eye size={14} />
                          <span>Fan View</span>
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => setShowSetupModal(true)} 
                        style={{ ...desktopActionButton, background: "#0095f6", color: "#fff", border: "none" }}
                      >
                        <Sparkles size={14} color="#fff" />
                        <span>Become Creator</span>
                      </button>
                    )}
                    <button onClick={handleOpenSettings} style={desktopIconBtnStyle} title="Settings">
                      <Settings size={18} color="#fff" />
                    </button>
                  </div>
                </div>

                {/* Row 2: Stats (Posts, Followers, Following) */}
                <div style={{ display: "flex", gap: "40px", marginBottom: "18px", fontSize: "15px" }}>
                  <div>
                    <strong style={{ color: "#fff" }}>{formatStat(postsCount)}</strong>{" "}
                    <span style={{ color: "#8e8e93" }}>posts</span>
                  </div>
                  <div>
                    <strong style={{ color: "#fff" }}>{formatStat(followersCount)}</strong>{" "}
                    <span style={{ color: "#8e8e93" }}>followers</span>
                  </div>
                  <div>
                    <strong style={{ color: "#fff" }}>{formatStat(followingCount)}</strong>{" "}
                    <span style={{ color: "#8e8e93" }}>following</span>
                  </div>
                </div>

                {/* Row 3: Name, Category, Bio, Links */}
                <div>
                  <div style={{ fontSize: "15px", fontWeight: "700", color: "#fff" }}>
                    {user?.display_name || user?.username || "Member"}
                  </div>

                  <div style={{ fontSize: "13px", color: "#8e8e93", marginTop: "2px" }}>
                    {user?.creator_category || (user?.is_creator ? "Digital Creator" : "Member")}
                  </div>

                  <p style={{
                    fontSize: "14px",
                    color: "#f5f5f5",
                    lineHeight: "1.45",
                    margin: "8px 0 8px 0",
                    whiteSpace: "pre-wrap",
                    maxWidth: "540px"
                  }}>
                    {user?.creator_bio || user?.bio || (user?.is_creator ? APP_CONFIG.profileBioSubtitle : "Welcome to my profile.")}
                  </p>

                  <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap", fontSize: "13.5px" }}>
                    {user?.website && (
                      <a 
                        href={user.website.startsWith("http") ? user.website : `https://${user.website}`} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        style={websiteLinkStyle}
                      >
                        <Link2 size={14} color="#0095f6" />
                        <span>{user.website.replace(/^https?:\/\//, "")}</span>
                      </a>
                    )}
                    {user?.location && (
                      <span style={{ display: "flex", alignItems: "center", gap: "4px", color: "#8e8e93" }}>
                        <MapPin size={14} color="#8e8e93" />
                        <span>{user.location}</span>
                      </span>
                    )}
                    {user?.is_creator && (
                      <span style={vipPricingBadgeStyle}>
                        <Sparkles size={12} color="#FFD700" />
                        <span>VIP: {Number(user.subscription_price) > 0 ? `₦${Number(user.subscription_price).toLocaleString()}/mo` : "Free"}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 🌟 INSTAGRAM PROFESSIONAL DASHBOARD CARD */}
          {user?.is_creator ? (
            <div 
              onClick={() => setShowStudioModal(true)} 
              style={professionalCardStyle}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={professionalIconStyle}>
                  <TrendingUp size={18} color="#0095f6" />
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "13.5px", fontWeight: "700", color: "#fff" }}>
                    Professional dashboard
                  </div>
                  <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px" }}>
                    {creatorStats.subscribers > 0 
                      ? `${creatorStats.subscribers} VIP fans · ₦${(creatorStats.subscribers * (Number(user.subscription_price) || 0)).toLocaleString()} projected MRR` 
                      : "Insights, fan subscriptions & creator monetization tools"}
                  </div>
                </div>
              </div>
              <ChevronRight size={18} color="#737373" />
            </div>
          ) : (
            <div 
              onClick={() => setShowSetupModal(true)} 
              style={professionalCardStyle}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ ...professionalIconStyle, background: "rgba(255, 215, 0, 0.12)" }}>
                  <Sparkles size={18} color="#FFD700" />
                </div>
                <div style={{ textAlign: "left" }}>
                  <div style={{ fontSize: "13.5px", fontWeight: "700", color: "#fff" }}>
                    Professional tools
                  </div>
                  <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px" }}>
                    Turn on creator mode to monetize with VIP subscriptions and fan tips
                  </div>
                </div>
              </div>
              <ChevronRight size={18} color="#737373" />
            </div>
          )}

          {/* 🌟 MOBILE ACTION BUTTONS ROW */}
          {!isDesktop && (
            <div style={mobileActionButtonsRow}>
              <button onClick={() => setShowEditModal(true)} style={mobileActionButton}>
                Edit profile
              </button>
              <button onClick={handleShareProfile} style={mobileActionButton}>
                Share profile
              </button>
              {user?.is_creator ? (
                <>
                  <button 
                    onClick={() => {
                      setUploadDefaultCategory(activeTab === "premium" ? "premium" : "hotties");
                      setShowUploadModal(true);
                    }}
                    style={{ 
                      ...mobileActionButton, 
                      background: "linear-gradient(135deg, #00aff0, #0088cc)", 
                      color: "#fff", 
                      border: "none", 
                      fontWeight: "700",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "4px",
                      padding: "0 12px",
                      flex: "0 0 auto"
                    }}
                  >
                    <Plus size={15} color="#fff" />
                    <span>Upload</span>
                  </button>
                  <button 
                    onClick={() => setShowStudioModal(true)} 
                    style={{ ...mobileActionButton, flex: "0 0 auto", padding: "0 12px", color: "#FFD700", background: "rgba(255, 215, 0, 0.12)", border: "1px solid rgba(255, 215, 0, 0.3)" }}
                    title="Studio"
                  >
                    <Sparkles size={14} color="#FFD700" />
                  </button>
                  <button 
                    onClick={() => setShowPreviewModal(true)} 
                    style={{ ...mobileActionButton, flex: "0 0 auto", padding: "0 12px" }}
                    title="Fan View"
                  >
                    <Eye size={15} color="#fff" />
                  </button>
                </>
              ) : (
                <button 
                  onClick={() => setShowSetupModal(true)} 
                  style={{ ...mobileActionButton, background: "#0095f6", color: "#fff", border: "none", flex: "0 0 auto", padding: "0 14px" }}
                >
                  <Sparkles size={13} color="#fff" />
                  <span>Upgrade</span>
                </button>
              )}
            </div>
          )}

        </div>

        {/* 🌟 INSTAGRAM PROFILE TABS NAVIGATION */}
        <div style={{ 
          ...tabsContainerStyle, 
          justifyContent: isDesktop ? "center" : "space-around",
          gap: isDesktop ? "50px" : "0",
          borderTop: "1px solid #262626",
          top: isDesktop ? "0" : (shouldHideUI ? "0px" : "48px"),
          transition: "top 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        }}>
          {user?.is_creator ? (
            <>
              <TabButton 
                isDesktop={isDesktop} 
                active={activeTab === "videos"} 
                onClick={() => setActiveTab("videos")} 
                icon={<Grid3X3 size={isDesktop ? 16 : 22} />} 
                label="POSTS" 
              />
              <TabButton 
                isDesktop={isDesktop} 
                active={activeTab === "premium"} 
                onClick={() => setActiveTab("premium")} 
                icon={<Lock size={isDesktop ? 16 : 22} />} 
                label="VIP EXCLUSIVE" 
              />
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
            </>
          ) : (
            <>
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
              <TabButton 
                isDesktop={isDesktop} 
                active={activeTab === "subscriptions"} 
                onClick={() => setActiveTab("subscriptions")} 
                icon={<Sparkles size={isDesktop ? 16 : 22} />} 
                label="VIP PASSES" 
              />
            </>
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
                  <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#fff", margin: "0 0 6px 0" }}>
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
                            src={`/api/avatar?user_id=${sub.creator_id}`}
                            onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                            alt=""
                            style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                          />
                        </div>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ fontSize: "14px", fontWeight: "700", color: "#fff" }}>
                              {sub.creator_display_name || sub.creator_username || "Creator"}
                            </span>
                            <CheckCircle size={14} color="#0095f6" fill="#0095f6" />
                          </div>
                          <div style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px" }}>
                            @{sub.creator_username || "creator"} · <span style={{ color: "#00d084", fontWeight: "600" }}>Active VIP Pass</span>
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
              <div style={{ 
                display: "grid", 
                gridTemplateColumns: isDesktop ? "repeat(5, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))", 
                gap: isDesktop ? "20px" : "10px",
                alignItems: "start",
                animation: "fadeIn 0.3s ease-out",
                width: "100%"
              }}>
                {videosToDisplay.map((v) => (
                  <VideoCard 
                    key={`${v.chat_id}:${v.message_id}`} 
                    video={v} 
                    onOpen={(vData, e) => handleOpenVideo(vData, e)} 
                  />
                ))}
              </div>
              
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
                  <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#fff", margin: "0 0 6px 0" }}>
                    {activeTab === "likes" 
                      ? "No Liked Videos Yet" 
                      : activeTab === "saved"
                      ? "No Saved Videos Yet"
                      : activeTab === "premium"
                      ? "No VIP Exclusive Posts"
                      : "No Posts Yet"}
                  </h3>
                  <p style={{ fontSize: "13px", color: "#8e8e93", maxWidth: "300px", margin: "0 auto", lineHeight: "1.4" }}>
                    {activeTab === "likes" 
                      ? "Videos you like will appear here." 
                      : activeTab === "saved"
                      ? "Videos you bookmark will appear here for easy access."
                      : activeTab === "premium"
                      ? "Exclusive paywalled content for your subscribers will be displayed here."
                      : (user?.is_creator 
                          ? "Share high quality videos and reels to engage your audience." 
                          : "No posts to display.")}
                  </p>
                  {user?.is_creator && (activeTab === "videos" || activeTab === "premium") && (
                    <button
                      onClick={() => {
                        setUploadDefaultCategory(activeTab === "premium" ? "premium" : "hotties");
                        setShowUploadModal(true);
                      }}
                      style={{
                        marginTop: "16px",
                        padding: "10px 20px",
                        borderRadius: "10px",
                        background: activeTab === "premium" ? "linear-gradient(135deg, #FFD700, #ffae00)" : "linear-gradient(135deg, #00aff0, #0088cc)",
                        color: activeTab === "premium" ? "#000" : "#fff",
                        border: "none",
                        fontSize: "13.5px",
                        fontWeight: "700",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "8px",
                        boxShadow: "0 4px 14px rgba(0, 0, 0, 0.4)"
                      }}
                    >
                      <Plus size={16} />
                      <span>Upload {activeTab === "premium" ? "VIP Exclusive Post" : "First Video"}</span>
                    </button>
                  )}
                </div>
              )}

              {!loading && !activeGroup && filteredRawVideos.length > 0 && (
                <div ref={loaderRef} style={{ height: "10px", width: "100%" }} />
              )}
            </>
          )}

        </div>
      </div>

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

      {/* 🌟 PROFILE EDIT MODAL */}
      {showEditModal && (
        <EditProfileModal 
          user={user}
          onClose={() => setShowEditModal(false)}
          onUpdateSuccess={(updatedUser) => {
            handleUpdateSuccess(updatedUser);
            setShowEditModal(false);
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
    </div>
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
    borderTop: (isDesktop && active) ? "1px solid #ffffff" : "none",
    borderBottom: (!isDesktop && active) ? "2px solid #ffffff" : "none",
    opacity: active ? 1 : 0.4, 
    color: active ? "#ffffff" : "#a8a8a8", 
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

// 🖌 STYLES (Clean AMOLED Instagram Dark Theme)
const containerStyle = { 
  minHeight: "100%", 
  background: "#000000", 
  color: "#f5f5f5", 
  position: "relative", 
  overflowX: "hidden" 
};

const desktopInnerWrapper = { maxWidth: "935px", margin: "0 auto", width: "100%" };
const navGridStyle = { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #1c1c1e", position: "sticky", top: 0, background: "#000000", zIndex: 100, backdropFilter: "blur(20px)" };
const centerTitleContainer = { display: "flex", alignItems: "center", cursor: "pointer" };
const usernameStyle = { fontSize: "16px", fontWeight: "700", margin: 0, color: "#fff" };
const tabsContainerStyle = { display: "flex", position: "sticky", background: "#000000", zIndex: 90 };
const loaderStyle = { padding: "40px", textAlign: "center", color: "#737373", fontSize: "14px" };

const groupHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#121214", borderBottom: "1px solid #262626" };
const backButtonStyle = { display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#fff", fontSize: "14px", fontWeight: "600", cursor: "pointer", padding: "0" };
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

// Instagram Story Gradient Rings
const storyGradientRingMobile = {
  padding: "2.5px",
  borderRadius: "50%",
  background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
  display: "inline-block"
};

const avatarInnerCircleMobile = {
  width: "78px",
  height: "78px",
  borderRadius: "50%",
  border: "2.5px solid #000000",
  overflow: "hidden",
  backgroundColor: "#1c1c1e"
};

const storyGradientRingDesktop = {
  padding: "3.5px",
  borderRadius: "50%",
  background: "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)",
  display: "inline-block"
};

const avatarInnerCircleDesktop = {
  width: "142px",
  height: "142px",
  borderRadius: "50%",
  border: "3.5px solid #000000",
  overflow: "hidden",
  backgroundColor: "#1c1c1e"
};

const mobileAvatarEditBadge = {
  position: "absolute",
  bottom: "2px",
  right: "2px",
  width: "24px",
  height: "24px",
  borderRadius: "50%",
  backgroundColor: "#0095f6",
  border: "2px solid #000000",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  boxShadow: "0 2px 6px rgba(0,0,0,0.5)"
};

const desktopAvatarEditBadge = {
  position: "absolute",
  bottom: "8px",
  right: "8px",
  width: "32px",
  height: "32px",
  borderRadius: "50%",
  backgroundColor: "#262626",
  border: "2px solid #000000",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer"
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
  color: "#ffffff"
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
  color: "#0095f6",
  textDecoration: "none",
  fontSize: "13.5px",
  fontWeight: "600"
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
  marginBottom: "16px"
};

const mobileActionButton = {
  flex: 1,
  height: "34px",
  backgroundColor: "#262626",
  color: "#ffffff",
  border: "1px solid #363636",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: "600",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  cursor: "pointer"
};

const desktopActionButton = {
  height: "34px",
  padding: "0 16px",
  backgroundColor: "#262626",
  color: "#ffffff",
  border: "1px solid #363636",
  borderRadius: "8px",
  fontSize: "13px",
  fontWeight: "600",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  cursor: "pointer"
};

