import React, { useState, useEffect, useCallback, useRef } from "react";
import { 
  Settings, Grid3X3, Heart, Lock, CheckCircle, Share2, ArrowLeft, 
  Camera, Sparkles, Edit3, MapPin, Globe, Award, ExternalLink, ShieldCheck, Eye 
} from "lucide-react"; 
import VideoCard from "../components/VideoCard"; 
import SettingsView from "../components/SettingsView"; 
import CreatorSetupModal from "../components/CreatorSetupModal";
import EditProfileModal from "../components/EditProfileModal";
import CreatorProfileModal from "../components/CreatorProfileModal";
import CreatorStudioModal from "../components/CreatorStudioModal";
import { useVideos } from "../hooks/useVideos";

// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../config";

export default function Profile({ 
  user, 
  onLogout, 
  setHideFooter, 
  setActiveVideo, 
  setShowPaywall, 
  onUpdateUser 
}) {
  const [activeTab, setActiveTab] = useState("videos");
  const [currentView, setCurrentView] = useState("profile");
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);
  
  const [activeGroup, setActiveGroup] = useState(null);
  const [deletedVideoIds, setDeletedVideoIds] = useState(new Set());
  const [showStudioModal, setShowStudioModal] = useState(false);
  
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

  const { videos: shots, loading: shotsLoading, loadMore: loadMoreShots } = useVideos("shots", fetchLimit);
  const { videos: premium, loading: premiumLoading, loadMore: loadMorePremium } = useVideos("premium", fetchLimit);
  const { videos: liked, loading: likedLoading, loadMore: loadMoreLiked } = useVideos("likes", fetchLimit);

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

  let rawVideosToDisplay = shots || [];
  let loading = shotsLoading;
  let loadMore = loadMoreShots;

  if (user?.is_creator && activeTab === "videos") {
    rawVideosToDisplay = creatorPosts;
    loading = creatorPostsLoading;
    loadMore = () => {
      if (!creatorPostsLoading && hasMoreCreatorPosts) {
        fetchCreatorPosts(creatorPostsPage, false);
      }
    };
  } else if (activeTab === "premium") {
    rawVideosToDisplay = premium || [];
    loading = premiumLoading;
    loadMore = loadMorePremium;
  } else if (activeTab === "likes") {
    rawVideosToDisplay = liked || [];
    loading = likedLoading;
    loadMore = loadMoreLiked;
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

  const videosToDisplay = activeGroup ? activeGroup.videos : filteredRawVideos;

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
        
        const groupData = {
          title: video.caption || "Collection",
          videos: groupVideos
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

    if (video.category === "premium" || activeTab === "premium") {
      if (!user || !user.is_premium) {
        setShowPaywall(true);
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

  const coverBanner = user?.banner_url || "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200&q=80";

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
            <div style={{ width: "40px" }} />
            <div style={centerTitleContainer}>
              <h2 style={usernameStyle}>{user?.display_name || user?.username || APP_CONFIG.defaultUploader}</h2>
              {(user?.is_creator || user?.is_verified) && (
                <CheckCircle size={15} color="#00aff0" fill="#00aff0" style={{ marginLeft: "4px" }} />
              )}
            </div>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", flex: 1, alignItems: "center" }}>
              <button onClick={handleShareProfile} style={headerIconButton}>
                <Share2 size={18} color="#fff" />
              </button>
              <button onClick={handleOpenSettings} style={headerIconButton}>
                <Settings size={20} color="#fff" />
              </button>
            </div>
          </div>
        )}

        {/* 🌟 ONLYFANS HERO COVER BANNER */}
        <div style={{
          position: "relative",
          width: "100%",
          height: isDesktop ? "260px" : "165px",
          backgroundColor: "#16181c",
          backgroundImage: `url(${coverBanner})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          borderBottom: "1px solid rgba(255,255,255,0.06)"
        }}>
          <div style={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to bottom, rgba(0,0,0,0.2) 0%, rgba(0,0,0,0.65) 100%)"
          }} />

          {/* Edit Cover Overlay Button */}
          <button 
            onClick={() => setShowEditModal(true)}
            style={coverEditButtonStyle}
            title="Edit Banner & Profile"
          >
            <Camera size={14} />
            <span>Change Cover</span>
          </button>
        </div>

        {/* 🌟 AVATAR + IDENTITY + ACTIONS SECTION */}
        <div style={{ padding: isDesktop ? "0 30px" : "0 16px", position: "relative" }}>
          
          {/* Row 1: Avatar overlapping banner + Action Buttons */}
          <div style={{
            display: "flex", 
            justifyContent: "space-between", 
            alignItems: "flex-end", 
            marginTop: isDesktop ? "-65px" : "-45px", 
            marginBottom: "16px"
          }}>
            {/* Avatar Container with Online Dot */}
            <div style={{ position: "relative", zIndex: 10 }}>
              <div style={{
                width: isDesktop ? "130px" : "90px",
                height: isDesktop ? "130px" : "90px",
                borderRadius: "50%",
                border: "4px solid var(--bg-color)",
                overflow: "hidden",
                backgroundColor: "#202020",
                boxShadow: "0 6px 20px rgba(0,0,0,0.6)"
              }}>
                <img
                  src={user?.avatar_url || "/assets/default-avatar.png"}
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  alt="Avatar"
                  onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                />
              </div>

              {/* Green online badge */}
              <span style={{
                position: "absolute",
                bottom: "6px",
                right: "6px",
                width: "14px",
                height: "14px",
                borderRadius: "50%",
                backgroundColor: "#00ba7c",
                border: "2px solid var(--bg-color)"
              }} />
            </div>

            {/* Top Action Buttons (Edit, Preview, Creator Setup, Settings) */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {user?.is_creator ? (
                <>
                  <button 
                    onClick={() => setShowStudioModal(true)}
                    style={{ 
                      ...actionPillBtnStyle, 
                      background: "linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(249, 24, 128, 0.2))", 
                      border: "1px solid rgba(255, 215, 0, 0.4)",
                      color: "#FFD700",
                      fontWeight: "700"
                    }}
                  >
                    <Sparkles size={14} color="#FFD700" />
                    <span>Studio</span>
                  </button>
                  <button 
                    onClick={() => setShowEditModal(true)}
                    style={actionPillBtnStyle}
                  >
                    <Edit3 size={14} />
                    <span>Edit Profile</span>
                  </button>
                  <button 
                    onClick={() => setShowPreviewModal(true)}
                    style={{ ...actionPillBtnStyle, background: "rgba(0, 175, 240, 0.12)", color: "#00aff0", border: "1px solid rgba(0, 175, 240, 0.3)" }}
                  >
                    <Eye size={14} />
                    <span>Fan View</span>
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={() => setShowSetupModal(true)}
                    style={becomeCreatorHighlightBtnStyle}
                  >
                    <Sparkles size={14} />
                    <span>Become Creator</span>
                  </button>
                  <button 
                    onClick={() => setShowEditModal(true)}
                    style={actionPillBtnStyle}
                  >
                    <Edit3 size={14} />
                    <span>Edit</span>
                  </button>
                </>
              )}

              {isDesktop && (
                <>
                  <button onClick={handleShareProfile} style={desktopIconBtnStyle} title="Share Profile">
                    <Share2 size={16} color="#fff" />
                  </button>
                  <button onClick={handleOpenSettings} style={desktopIconBtnStyle} title="Settings">
                    <Settings size={16} color="#fff" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Row 2: Display Name, Username, Badges, Bio */}
          <div style={{ marginBottom: "18px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <h1 style={{ fontSize: isDesktop ? "24px" : "19px", fontWeight: "800", color: "#fff", margin: 0 }}>
                {user?.display_name || user?.username || "Member"}
              </h1>
              {(user?.is_creator || user?.is_verified) && (
                <CheckCircle size={18} color="#00aff0" fill="#00aff0" />
              )}
              {user?.is_creator && (
                <span style={creatorBadgeStyle}>
                  CREATOR
                </span>
              )}
              {user?.is_premium && (
                <span style={vipBadgeStyle}>
                  VIP
                </span>
              )}
            </div>

            <div style={{ fontSize: "14px", color: "#8e8e93", marginTop: "2px", fontWeight: "500" }}>
              @{user?.username || "user"}
            </div>

            {/* Category Tag if Creator */}
            {user?.is_creator && user?.creator_category && (
              <div style={{ marginTop: "6px" }}>
                <span style={categoryPillStyle}>
                  {user.creator_category}
                </span>
              </div>
            )}

            {/* Bio Text */}
            <p style={{
              fontSize: "14px",
              color: "#e1e1e1",
              lineHeight: "1.5",
              margin: "12px 0 8px 0",
              whiteSpace: "pre-wrap"
            }}>
              {user?.creator_bio || user?.bio || APP_CONFIG.profileBioSubtitle}
            </p>

            {/* Location & Website */}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "16px", fontSize: "13px", color: "#8e8e93", marginTop: "8px" }}>
              {user?.location && (
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <MapPin size={14} color="#71767b" />
                  <span>{user.location}</span>
                </span>
              )}
              {user?.website && (
                <a 
                  href={user.website.startsWith("http") ? user.website : `https://${user.website}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ display: "flex", alignItems: "center", gap: "4px", color: "#00aff0", textDecoration: "none" }}
                >
                  <Globe size={14} />
                  <span>{user.website.replace(/^https?:\/\//, "")}</span>
                </a>
              )}
            </div>

            {/* Social Handles Chips */}
            {(user?.social_links?.twitter || user?.social_links?.instagram || user?.social_links?.telegram) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "12px" }}>
                {user.social_links.twitter && (
                  <a href={`https://twitter.com/${user.social_links.twitter.replace("@", "")}`} target="_blank" rel="noreferrer" style={socialChipStyle}>
                    𝕏 @{user.social_links.twitter.replace("@", "")}
                  </a>
                )}
                {user.social_links.instagram && (
                  <a href={`https://instagram.com/${user.social_links.instagram.replace("@", "")}`} target="_blank" rel="noreferrer" style={socialChipStyle}>
                    📸 @{user.social_links.instagram.replace("@", "")}
                  </a>
                )}
                {user.social_links.telegram && (
                  <a href={`https://t.me/${user.social_links.telegram.replace("@", "")}`} target="_blank" rel="noreferrer" style={socialChipStyle}>
                    ✈️ @{user.social_links.telegram.replace("@", "")}
                  </a>
                )}
              </div>
            )}
          </div>

          {/* 🌟 ONLYFANS STATS BAR */}
          <div style={statsContainerStyle}>
            <div style={statItemStyle}>
              <span style={statNumberStyle}>{creatorStats.posts || rawVideosToDisplay.length || 0}</span>
              <span style={statLabelStyle}>POSTS</span>
            </div>
            <div style={statDividerStyle} />
            <div style={statItemStyle}>
              <span style={statNumberStyle}>{creatorStats.subscribers || 0}</span>
              <span style={statLabelStyle}>FANS</span>
            </div>
            <div style={statDividerStyle} />
            <div style={statItemStyle}>
              <span style={statNumberStyle}>{creatorStats.likes || 0}</span>
              <span style={statLabelStyle}>LIKES</span>
            </div>
            <div style={statDividerStyle} />
            <div style={statItemStyle}>
              <span style={statNumberStyle}>{creatorStats.views || 0}</span>
              <span style={statLabelStyle}>VIEWS</span>
            </div>
          </div>

          {/* 🌟 BECOME CREATOR CARD (If user has not upgraded yet) */}
          {!user?.is_creator && (
            <div style={becomeCreatorBannerStyle}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                <div style={sparkleIconBoxStyle}>
                  <Sparkles size={24} color="#FFD700" />
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "700", color: "#fff" }}>
                    Join as an Official Creator
                  </h3>
                  <p style={{ margin: "0 0 12px 0", fontSize: "13px", color: "#a0a0a0", lineHeight: "1.4" }}>
                    Start earning like OnlyFans. Set your monthly subscription price, receive fan tips, and build your VIP community.
                  </p>
                  <button 
                    onClick={() => setShowSetupModal(true)} 
                    style={becomeCreatorBtnStyle}
                  >
                    🚀 Set Up Creator Profile
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 🌟 CREATOR VIP PRICING BADGE (If user is already a creator) */}
          {user?.is_creator && (
            <div style={pricingCardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "#8e8e93", fontWeight: "700" }}>
                    Monthly Fan Subscription
                  </span>
                  <div style={{ fontSize: "17px", fontWeight: "800", color: "#fff", marginTop: "2px" }}>
                    {Number(user?.subscription_price) > 0 
                      ? `₦${Number(user.subscription_price).toLocaleString()} / month` 
                      : "Free Subscription"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button 
                    onClick={() => setShowStudioModal(true)}
                    style={{ 
                      background: "linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(249, 24, 128, 0.2))", 
                      border: "1px solid rgba(255, 215, 0, 0.4)", 
                      borderRadius: "16px", 
                      padding: "6px 14px", 
                      color: "#FFD700", 
                      fontSize: "12px", 
                      fontWeight: "700",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px"
                    }}
                  >
                    <Sparkles size={14} color="#FFD700" />
                    <span>Creator Studio</span>
                  </button>
                  <button 
                    onClick={() => setShowEditModal(true)}
                    style={{ 
                      background: "rgba(255,255,255,0.06)", 
                      border: "1px solid rgba(255,255,255,0.15)", 
                      borderRadius: "16px", 
                      padding: "6px 14px", 
                      color: "#fff", 
                      fontSize: "12px", 
                      fontWeight: "600",
                      cursor: "pointer" 
                    }}
                  >
                    Edit Profile
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 🌟 PROFILE TABS */}
        <div style={{ 
          ...tabsContainerStyle, 
          justifyContent: isDesktop ? "center" : "space-around",
          gap: isDesktop ? "60px" : "0",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          top: isDesktop ? "0" : (shouldHideUI ? "0px" : "48px"),
          transition: "top 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
        }}>
          <TabButton 
            isDesktop={isDesktop} 
            active={activeTab === "videos"} 
            onClick={() => setActiveTab("videos")} 
            icon={<Grid3X3 size={isDesktop ? 18 : 22} />} 
            label={APP_CONFIG.profileTabs.posts} 
          />
          <TabButton 
            isDesktop={isDesktop} 
            active={activeTab === "premium"} 
            onClick={() => setActiveTab("premium")} 
            icon={<Lock size={isDesktop ? 18 : 22} />} 
            label={APP_CONFIG.profileTabs.premium} 
          />
          <TabButton 
            isDesktop={isDesktop} 
            active={activeTab === "likes"} 
            onClick={() => setActiveTab("likes")} 
            icon={<Heart size={isDesktop ? 18 : 22} />} 
            label={APP_CONFIG.profileTabs.liked} 
          />
        </div>

        {/* 🌟 VIDEO GRID */}
        <div style={{ padding: isDesktop ? "30px 25px" : "15px" }}>
          
          {activeGroup && (
            <div style={groupHeaderStyle}>
              <button onClick={handleCloseGroup} style={backButtonStyle}>
                <ArrowLeft size={20} />
                <span>Back</span>
              </button>
              <span style={groupTitleStyle}>{activeGroup.videos.length} clips in collection</span>
            </div>
          )}

          <div style={{ 
            ...gridStyle, 
            gridTemplateColumns: isDesktop ? "repeat(5, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))",
            gap: isDesktop ? "20px" : "10px"
          }}>
            {videosToDisplay.map(v => (
              <VideoCard 
                key={`${v.chat_id}:${v.message_id}`} 
                video={v} 
                onOpen={(vData, e) => handleOpenVideo(vData, e)} 
                showDetails={true} 
              />
            ))}
          </div>
          
          {loading && !activeGroup && <div style={loaderStyle}>Refreshing shots...</div>}
          
          {!loading && !activeGroup && filteredRawVideos.length === 0 && (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "#888" }}>
              {activeTab === "likes" 
                ? "No liked videos yet." 
                : (user?.is_creator 
                    ? "You haven't uploaded any posts yet. Start sharing exclusive content to grow your subscriber base!" 
                    : "No videos found.")}
            </div>
          )}

          {!loading && !activeGroup && filteredRawVideos.length > 0 && (
            <div ref={loaderRef} style={{ height: "10px", width: "100%" }} />
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
    </div>
  );
}

// 🎨 COMPONENT UI PIECES
const TabButton = ({ active, onClick, icon, label, isDesktop }) => (
  <button onClick={onClick} style={{ 
    display: "flex", 
    flexDirection: isDesktop ? "row" : "column", 
    alignItems: "center", 
    gap: isDesktop ? "8px" : "6px",
    background: "none", border: "none", 
    padding: isDesktop ? "15px 0" : "12px 0",
    borderTop: (isDesktop && active) ? "2px solid #00aff0" : "none",
    borderBottom: (!isDesktop && active) ? "2px solid #00aff0" : (!isDesktop ? "1px solid rgba(255,255,255,0.05)" : "none"),
    opacity: active ? 1 : 0.45, 
    color: active ? "#fff" : "#8e8e93", 
    cursor: "pointer",
    marginTop: isDesktop ? "-1px" : "0",
    flex: 1
  }}>
    {icon}
    <span style={{ fontSize: isDesktop ? "13px" : "11px", fontWeight: "700", letterSpacing: isDesktop ? "0.5px" : "0" }}>{label}</span>
  </button>
);

// 🖌 STYLES
const containerStyle = { 
  minHeight: "100%", 
  background: "var(--bg-color)", 
  color: "#fff", 
  position: "relative", 
  overflowX: "hidden" 
};

const desktopInnerWrapper = { maxWidth: "935px", margin: "0 auto", width: "100%" };
const navGridStyle = { display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.08)", position: "sticky", top: 0, background: "var(--bg-color)", zIndex: 100, backdropFilter: "blur(15px)" };
const centerTitleContainer = { display: "flex", alignItems: "center" };
const usernameStyle = { fontSize: "16px", fontWeight: "700", margin: 0 };
const tabsContainerStyle = { display: "flex", position: "sticky", background: "var(--bg-color)", zIndex: 90 };
const gridStyle = { display: "grid" };
const loaderStyle = { padding: "40px", textAlign: "center", color: "#666", fontSize: "14px" };

const groupHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px", background: "var(--bg-color)", borderBottom: "1px solid rgba(255,255,255,0.05)" };
const backButtonStyle = { display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", color: "#fff", fontSize: "15px", fontWeight: "600", cursor: "pointer", padding: "0" };
const groupTitleStyle = { fontSize: "13px", color: "#8e8e8e", fontWeight: "500" };

const headerIconButton = { background: "none", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", padding: "4px" };
const desktopIconBtnStyle = { background: "#1f1f23", border: "1px solid #333", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" };

const coverEditButtonStyle = { 
  position: "absolute", 
  right: "16px", 
  bottom: "16px", 
  background: "rgba(0,0,0,0.65)", 
  backdropFilter: "blur(10px)", 
  border: "1px solid rgba(255,255,255,0.2)", 
  borderRadius: "20px", 
  padding: "6px 14px", 
  color: "#fff", 
  fontSize: "12px", 
  fontWeight: "600", 
  display: "flex", 
  alignItems: "center", 
  gap: "6px", 
  cursor: "pointer", 
  zIndex: 2 
};

const actionPillBtnStyle = {
  background: "#1f1f23",
  color: "#fff",
  border: "1px solid #3a3a40",
  borderRadius: "20px",
  padding: "7px 16px",
  fontSize: "13px",
  fontWeight: "600",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  cursor: "pointer"
};

const becomeCreatorHighlightBtnStyle = {
  background: "linear-gradient(135deg, #FF6B00 0%, #FF007A 100%)",
  color: "#fff",
  border: "none",
  borderRadius: "20px",
  padding: "7px 16px",
  fontSize: "13px",
  fontWeight: "700",
  display: "flex",
  alignItems: "center",
  gap: "6px",
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(255, 107, 0, 0.35)"
};

const creatorBadgeStyle = {
  fontSize: "10px",
  fontWeight: "800",
  color: "#FFD700",
  backgroundColor: "rgba(255, 215, 0, 0.12)",
  border: "1px solid rgba(255, 215, 0, 0.3)",
  borderRadius: "10px",
  padding: "2px 8px",
  letterSpacing: "0.5px"
};

const vipBadgeStyle = {
  fontSize: "10px",
  fontWeight: "800",
  color: "var(--primary-color)",
  backgroundColor: "rgba(229, 9, 20, 0.12)",
  border: "1px solid rgba(229, 9, 20, 0.3)",
  borderRadius: "10px",
  padding: "2px 8px",
  letterSpacing: "0.5px"
};

const categoryPillStyle = {
  fontSize: "12px",
  color: "#00aff0",
  backgroundColor: "rgba(0, 175, 240, 0.1)",
  padding: "3px 10px",
  borderRadius: "12px",
  fontWeight: "600",
  display: "inline-block"
};

const socialChipStyle = {
  fontSize: "12px",
  color: "#e1e1e1",
  backgroundColor: "#16181c",
  border: "1px solid rgba(255,255,255,0.1)",
  padding: "4px 10px",
  borderRadius: "14px",
  textDecoration: "none",
  display: "inline-flex",
  alignItems: "center"
};

const statsContainerStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-around",
  backgroundColor: "#121417",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "14px",
  padding: "14px 10px",
  margin: "18px 0 16px 0"
};

const statItemStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  flex: 1
};

const statNumberStyle = {
  fontSize: "16px",
  fontWeight: "800",
  color: "#fff"
};

const statLabelStyle = {
  fontSize: "11px",
  color: "#8e8e93",
  fontWeight: "600",
  marginTop: "2px",
  letterSpacing: "0.5px"
};

const statDividerStyle = {
  width: "1px",
  height: "26px",
  backgroundColor: "rgba(255,255,255,0.08)"
};

const becomeCreatorBannerStyle = {
  background: "linear-gradient(135deg, rgba(255, 107, 0, 0.12) 0%, rgba(255, 0, 122, 0.12) 100%)",
  border: "1px solid rgba(255, 107, 0, 0.3)",
  borderRadius: "16px",
  padding: "16px",
  margin: "16px 0",
  boxShadow: "0 4px 20px rgba(0,0,0,0.3)"
};

const sparkleIconBoxStyle = {
  width: "44px",
  height: "44px",
  borderRadius: "12px",
  backgroundColor: "rgba(255, 215, 0, 0.15)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0
};

const becomeCreatorBtnStyle = {
  background: "linear-gradient(135deg, #FF6B00 0%, #FF007A 100%)",
  color: "#fff",
  border: "none",
  borderRadius: "20px",
  padding: "9px 20px",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
  boxShadow: "0 4px 14px rgba(255, 107, 0, 0.35)"
};

const pricingCardStyle = {
  background: "#16181c",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: "14px",
  padding: "14px 18px",
  margin: "16px 0"
};
