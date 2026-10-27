import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  Heart, MessageCircle, Share2, Eye, Play, Loader2, Bookmark, 
  Sparkles, Lock, ChevronLeft, ChevronRight, X, ArrowRight, Users, Film, Plus,
  Home, Compass, Flame, TrendingUp, User, Search, MoreHorizontal, MoreVertical, Grid3X3, ArrowLeft, RefreshCw, Flag
} from "lucide-react";
import { APP_CONFIG } from "../config";
import PullToRefresh from "../components/PullToRefresh";
import AppHeader from "../components/AppHeader"; // 🟢 IMPORT APPHEADER
import DiscoverCreatorsModal from "../components/DiscoverCreatorsModal";
import CreatorUploadModal from "../components/CreatorUploadModal";
import ReportModal from "../components/ReportModal";
import PostOptionsModal from "../components/PostOptionsModal";
import { isUserSubscribedToCreator, getVideoCreatorHandle } from "../utils/subscription";
import { renderClickableCaption } from "../components/ClickableCaption";
import { promptLogin, showToast } from "../utils/toast";
import { formatTwitterDate, getPostDisplayName } from "../utils/date";

import FeedPost from "../components/FeedPost";
import TwitterVerifiedBadge from "../components/TwitterVerifiedBadge";
import StoryAvatar from "../components/StoryAvatar";
import DesktopLeftSidebar from "../components/DesktopLeftSidebar";
import DesktopRightSidebar from "../components/DesktopRightSidebar";
import { InstagramSuggestedCreators } from "../components/DiscoverCreatorsSection";

// 🌟 TWITTER/X STYLE CREATOR SEARCH CARD
const SearchCreatorCard = ({ creator, onCreatorClick, onFollowToggle, isFollowing, isLoadingFollow }) => {
  const uname = creator.username;
  return (
    <div
      onClick={() => onCreatorClick && onCreatorClick(uname)}
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "12px",
        padding: "14px 16px",
        background: "transparent",
        borderBottom: "1px solid var(--border-color, #2f3336)",
        cursor: "pointer",
        transition: "background 0.15s ease",
        boxSizing: "border-box",
        width: "100%"
      }}
      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--hover-bg, rgba(255, 255, 255, 0.03))"; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", minWidth: 0, flex: 1 }}>
        <div style={{ position: "relative", width: "44px", height: "44px", flexShrink: 0 }}>
          <StoryAvatar
            username={uname}
            avatarUrl={creator.avatar_url}
            displayName={creator.display_name || uname}
            size={44}
            borderWidth={2}
            onClick={() => onCreatorClick && onCreatorClick(uname)}
          />
        </div>

        <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Line 1: Name, Verified Badge, Category */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0, maxWidth: "100%", overflow: "hidden" }}>
            <span style={{ 
              fontWeight: "700", 
              fontSize: "14.5px", 
              color: "var(--text-primary, #ffffff)", 
              whiteSpace: "nowrap", 
              overflow: "hidden", 
              textOverflow: "ellipsis",
              minWidth: 0,
              display: "inline-block"
            }}>
              {creator.display_name || uname}
            </span>
            {creator.is_verified && (
              <TwitterVerifiedBadge size={14} style={{ flexShrink: 0 }} />
            )}
            {creator.creator_category && (
              <span style={{
                fontSize: "10px",
                fontWeight: "600",
                color: "#d4d4d8",
                background: "rgba(255, 255, 255, 0.1)",
                padding: "1px 6px",
                borderRadius: "6px",
                flexShrink: 0,
                whiteSpace: "nowrap"
              }}>
                {creator.creator_category}
              </span>
            )}
          </div>

          {/* Line 2: Handle & Stats */}
          <div style={{ 
            display: "flex", 
            alignItems: "center", 
            gap: "6px", 
            marginTop: "2px", 
            fontSize: "12.5px", 
            color: "#71767b",
            minWidth: 0,
            maxWidth: "100%",
            overflow: "hidden",
            whiteSpace: "nowrap"
          }}>
            <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              @{uname}
            </span>
            {creator.followers_count > 0 && (
              <>
                <span style={{ flexShrink: 0 }}>•</span>
                <span style={{ flexShrink: 0 }}>{creator.followers_count.toLocaleString()} followers</span>
              </>
            )}
            {creator.video_count > 0 && (
              <>
                <span style={{ flexShrink: 0 }}>•</span>
                <span style={{ flexShrink: 0 }}>{creator.video_count.toLocaleString()} drops</span>
              </>
            )}
          </div>

          {/* Line 3: Bio */}
          {creator.creator_bio && (
            <p style={{
              margin: "5px 0 0 0",
              fontSize: "12.5px",
              color: "var(--text-secondary, #a0a4a8)",
              lineHeight: "1.4",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              wordBreak: "break-word",
              overflowWrap: "anywhere"
            }}>
              {creator.creator_bio}
            </p>
          )}
        </div>
      </div>

      <div style={{ marginLeft: "12px", flexShrink: 0, alignSelf: "flex-start" }}>
        <button
          type="button"
          onClick={(e) => onFollowToggle(e, creator)}
          disabled={isLoadingFollow}
          style={{
            padding: isFollowing ? "6px 14px" : "6px 16px",
            borderRadius: "20px",
            fontSize: "13px",
            fontWeight: "700",
            cursor: "pointer",
            transition: "all 0.15s ease",
            border: isFollowing ? "1px solid rgba(255, 255, 255, 0.15)" : "none",
            background: isFollowing ? "transparent" : "#e4e4e7",
            color: isFollowing ? "#a1a1aa" : "#09090b",
            whiteSpace: "nowrap",
            minWidth: "82px",
            textAlign: "center"
          }}
          onMouseEnter={(e) => {
            if (isFollowing) {
              e.currentTarget.style.borderColor = "#f4212e";
              e.currentTarget.style.color = "#f4212e";
              e.currentTarget.innerText = "Unfollow";
            }
          }}
          onMouseLeave={(e) => {
            if (isFollowing) {
              e.currentTarget.style.borderColor = "#536471";
              e.currentTarget.style.color = "#eff3f4";
              e.currentTarget.innerText = "Following";
            }
          }}
        >
          {isLoadingFollow ? "..." : (isFollowing ? "Following" : "Follow")}
        </button>
      </div>
    </div>
  );
};

// 🟢 Desktop Left and Right sidebars are imported from ../components/DesktopLeftSidebar and ../components/DesktopRightSidebar for multi-page reusability


// 🟢 Fast in-memory cache for instant featured creators display
let memoryCachedFeatured = null;

// 🟢 EXPLORE COMPONENT
export default function Explore({ 
  user,
  onProfileClick,
  onNavigateTab,
  setHideFooter,
  onVideoClick, 
  onCommentClick, 
  isAnyModalOpen,
  onCreatorClick,
  onOpenDiscoverCreators
}) {
  // 🟢 TWO TABS: "for_you" (platform content) & "community" (web creator content)
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get("explore_tab");
    if (tabParam === "community") return "community";
    return "for_you";
  });

  const [searchQuery, setSearchQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("q") || "";
  });

  // 🟢 Isolated search term for AppHeader portal modal to prevent overriding Explore For You timeline
  const [headerSearchTerm, setHeaderSearchTerm] = useState("");

  // 🟢 FOR YOU FEED STATE (Twitter/X Algorithm Platform & Curated Drops)
  const [forYouFeed, setForYouFeed] = useState([]);
  const [forYouLoading, setForYouLoading] = useState(true);
  const [forYouLoadingMore, setForYouLoadingMore] = useState(false);
  const [forYouPage, setForYouPage] = useState(1);
  const [hasMoreForYou, setHasMoreForYou] = useState(true);
  const forYouPageRef = useRef(1);
  const isFetchingForYouRef = useRef(false);
  const sessionSeedRef = useRef(Math.floor(Math.random() * 1000000).toString());

  // 🟢 COMMUNITY FEED STATE (Contents posted by web creators only)
  const [communityFeed, setCommunityFeed] = useState([]);
  const [communityLoading, setCommunityLoading] = useState(false);
  const [communityLoadingMore, setCommunityLoadingMore] = useState(false);
  const [communityPage, setCommunityPage] = useState(1);
  const [hasMoreCommunity, setHasMoreCommunity] = useState(true);
  const [communityCount, setCommunityCount] = useState(0);

  // 🟢 SEARCH FEED & CREATOR STATES
  const [searchFeed, setSearchFeed] = useState([]);
  const [searchCreators, setSearchCreators] = useState([]);
  const [searchSubTab, setSearchSubTab] = useState("all"); // "all" | "creators" | "videos"
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchLoadingMore, setSearchLoadingMore] = useState(false);
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreSearch, setHasMoreSearch] = useState(true);
  const [searchFollowingMap, setSearchFollowingMap] = useState({});
  const [searchFollowingLoading, setSearchFollowingLoading] = useState({});

  // 🟢 CREATOR & MODAL STATES
  const [featuredCreators, setFeaturedCreators] = useState(() => {
    if (memoryCachedFeatured && memoryCachedFeatured.length > 0) return memoryCachedFeatured;
    try {
      const saved = sessionStorage.getItem("cached_featured_creators");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          memoryCachedFeatured = parsed;
          return parsed;
        }
      }
    } catch (e) {}
    return [];
  });
  const [suggestedIndex, setSuggestedIndex] = useState(() => Math.floor(Math.random() * 4) + 2);
  const [showDiscoverModal, setShowDiscoverModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [reportedVideo, setReportedVideo] = useState(null);
  const handleOpenReport = useCallback((v) => setReportedVideo(v), []);
  const [optionsVideo, setOptionsVideo] = useState(null);
  const handleOpenOptions = useCallback((v) => setOptionsVideo(v), []);

  const handleNotInterested = useCallback((v) => {
    if (!v) return;
    const videoId = v.message_id || v.id;
    setForYouFeed(prev => prev.filter(item => (item.message_id || item.id) !== videoId));
    setCommunityFeed(prev => prev.filter(item => (item.message_id || item.id) !== videoId));
    setSearchFeed(prev => prev.filter(item => (item.message_id || item.id) !== videoId));
  }, []);

  const handleDeletePost = useCallback(async (v) => {
    if (!v) return;
    const videoId = v.message_id || v.id;
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/video/${encodeURIComponent(videoId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        handleNotInterested(v);
        showToast("Post deleted successfully", "info");
      } else {
        const adminRes = await fetch(`${APP_CONFIG.apiUrl}/api/admin/video/${encodeURIComponent(videoId)}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` }
        });
        if (adminRes.ok) {
          handleNotInterested(v);
          showToast("Post deleted successfully", "info");
        } else {
          showToast("Failed to delete post", "error");
        }
      }
    } catch (e) {
      showToast("Error deleting post", "error");
    }
  }, [handleNotInterested]);

  // 🟢 DESKTOP CATEGORY FILTER & HIGHLIGHTS STATE
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [highlightVideos, setHighlightVideos] = useState([]);
  const [highlightLoading, setHighlightLoading] = useState(false);

  const fetchHighlights = useCallback(async () => {
    try {
      setHighlightLoading(true);
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
          setHighlightVideos(cleanVideos.slice(0, 4));
        }
      }
    } catch (e) {
    } finally {
      setHighlightLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHighlights();
  }, [fetchHighlights]);

  const handleSelectCategory = (catId) => {
    if (selectedCategory === catId) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(catId);
      if (activeTab !== "for_you") setActiveTab("for_you");
    }
    forYouPageRef.current = 1;
    setForYouPage(1);
    setHasMoreForYou(true);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleOpenDiscover = useCallback(() => {
    if (onOpenDiscoverCreators) {
      onOpenDiscoverCreators();
    } else {
      setShowDiscoverModal(true);
    }
  }, [onOpenDiscoverCreators]);

  const fetchFeaturedCreators = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/featured/list`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data?.creators) {
          // Strictly filter out any web users (gmail, yahoo, hotmail)
          const tgOnly = data.creators.filter(c => {
            const email = String(c.email || "").toLowerCase();
            return !email.includes("@gmail.com") && !email.includes("@yahoo.com") && !email.includes("@hotmail.com");
          });
          memoryCachedFeatured = tgOnly;
          try {
            sessionStorage.setItem("cached_featured_creators", JSON.stringify(tgOnly));
          } catch (e) {}
          setFeaturedCreators(tgOnly);
        }
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchFeaturedCreators();
  }, [fetchFeaturedCreators]);

  // Sync explore_tab in URL without page reload
  useEffect(() => {
    const url = new URL(window.location.href);
    if (activeTab === "community") {
      url.searchParams.set("explore_tab", "community");
    } else {
      url.searchParams.delete("explore_tab");
    }
    window.history.replaceState(window.history.state, "", url.toString());
  }, [activeTab]);

  // 🟢 SCROLL UI STATES
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 1024);
  const [isUIHidden, setIsUIHidden] = useState(false);
  
  const scrollContainerRef = useRef(null);
  const scrollPositionRef = useRef(0);
  const lastScrollY = useRef(0);
  const isFirstMount = useRef(true);

  const shouldHideUI = isUIHidden;

  // 🟢 Window Resize Listener
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 1024);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 🟢 Split Footer Broadcast Effects (Hide footer on scroll for both mobile and desktop)
  useEffect(() => {
    if (setHideFooter) setHideFooter(shouldHideUI);
  }, [shouldHideUI, setHideFooter]);

  useEffect(() => {
    return () => {
      if (setHideFooter) setHideFooter(false);
    };
  }, [setHideFooter]);

  // 🟢 Soft Delete Event Listener across all feeds
  useEffect(() => {
    const handleVideoDeleted = (event) => {
      const deletedId = String(event.detail);
      setForYouFeed(prev => prev.filter(v => String(v.id || v.message_id) !== deletedId));
      setCommunityFeed(prev => prev.filter(v => String(v.id || v.message_id) !== deletedId));
      setSearchFeed(prev => prev.filter(v => String(v.id || v.message_id) !== deletedId));
    };

    window.addEventListener('videoDeleted', handleVideoDeleted);
    return () => window.removeEventListener('videoDeleted', handleVideoDeleted);
  }, []);

  // 🟢 Scroll Listener with Persistent Position Tracking
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const currentY = container.scrollTop;

      if (!isAnyModalOpen && currentY > 0) {
        scrollPositionRef.current = currentY;
      }

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
  }, [isAnyModalOpen]);

  // 🟢 Restore scroll position when modals (comments, video, stories) close
  useEffect(() => {
    if (!isAnyModalOpen && scrollContainerRef.current && scrollPositionRef.current > 0) {
      const savedY = scrollPositionRef.current;
      requestAnimationFrame(() => {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTop = savedY;
        }
      });
      setTimeout(() => {
        if (scrollContainerRef.current && Math.abs(scrollContainerRef.current.scrollTop - savedY) > 10) {
          scrollContainerRef.current.scrollTop = savedY;
        }
      }, 60);
    }
  }, [isAnyModalOpen]);

  // 🟢 Restore scroll position when search modal closes
  useEffect(() => {
    const handleRestoreFromSearch = () => {
      if (scrollContainerRef.current && scrollPositionRef.current > 0) {
        const savedY = scrollPositionRef.current;
        requestAnimationFrame(() => {
          if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = savedY;
          }
        });
        setTimeout(() => {
          if (scrollContainerRef.current && Math.abs(scrollContainerRef.current.scrollTop - savedY) > 10) {
            scrollContainerRef.current.scrollTop = savedY;
          }
        }, 60);
      }
    };

    window.addEventListener("searchModalClosed", handleRestoreFromSearch);
    return () => window.removeEventListener("searchModalClosed", handleRestoreFromSearch);
  }, []);

  // 🟢 Wrapped interactions to capture scroll position immediately before opening overlays
  const handleCommentClick = useCallback((video) => {
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop > 0) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }
    if (onCommentClick) onCommentClick(video);
  }, [onCommentClick]);

  const handleFeedVideoClick = useCallback((video, e) => {
    if (scrollContainerRef.current && scrollContainerRef.current.scrollTop > 0) {
      scrollPositionRef.current = scrollContainerRef.current.scrollTop;
    }
    if (onVideoClick) onVideoClick(video, e);
  }, [onVideoClick]);

  // 🟢 LOAD FOR YOU FEED (Purely Random Catalog Shuffling + Deterministic Pagination)
  const loadForYouFeed = useCallback(async (isLoadMore = false, cat = selectedCategory, pageOverride = null) => {
    if (isFetchingForYouRef.current) return;

    const targetPage = pageOverride !== null ? pageOverride : (isLoadMore ? forYouPageRef.current + 1 : 1);

    // On fresh load, pull-to-refresh, or category switch: generate new session exploration seed
    if (!isLoadMore) {
      sessionSeedRef.current = Math.floor(Math.random() * 1000000).toString();
    }

    isFetchingForYouRef.current = true;

    if (isLoadMore) {
      setForYouLoadingMore(true);
    } else {
      setForYouLoading(true);
      setSuggestedIndex(Math.floor(Math.random() * 4) + 2);
      fetchFeaturedCreators();
    }

    try {
      const categoryParam = cat ? `&category=${encodeURIComponent(cat)}` : "";
      const seedParam = `&seed=${sessionSeedRef.current}`;
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/videos?sort=random&page=${targetPage}&limit=12${categoryParam}${seedParam}`);
      if (res.ok) {
        const data = await res.json();
        const fetched = data.videos || [];

        if (data.hasMore !== undefined) {
          setHasMoreForYou(Boolean(data.hasMore));
        } else {
          setHasMoreForYou(fetched.length >= 12);
        }

        forYouPageRef.current = targetPage;
        setForYouPage(targetPage);

        if (isLoadMore) {
          setForYouFeed(prev => {
            const existingIds = new Set(prev.map(v => String(v.message_id || v.id)));
            const unique = fetched.filter(v => !existingIds.has(String(v.message_id || v.id)));
            return [...prev, ...unique];
          });
        } else {
          setForYouFeed(fetched);
        }
      }
    } catch (err) {
      console.error("Failed to load explore for you feed", err);
    } finally {
      isFetchingForYouRef.current = false;
      setForYouLoading(false);
      setForYouLoadingMore(false);
    }
  }, [fetchFeaturedCreators, selectedCategory]);

  useEffect(() => {
    if (activeTab === "for_you") {
      forYouPageRef.current = 1;
      setForYouPage(1);
      setHasMoreForYou(true);
      loadForYouFeed(false, selectedCategory, 1);
    }
  }, [selectedCategory]);

  // 🟢 LOAD COMMUNITY FEED (Exclusively contents posted by web creators)
  const loadCommunityFeed = useCallback(async (pageNum = 1, isLoadMore = false, q = "") => {
    if (isLoadMore) {
      setCommunityLoadingMore(true);
    } else {
      setCommunityLoading(true);
    }

    try {
      const searchParam = q ? `&q=${encodeURIComponent(q)}` : "";
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/community/videos?page=${pageNum}&limit=12${searchParam}`);
      if (res.ok) {
        const data = await res.json();
        const safeVideos = data.videos || [];
        setCommunityCount(Number(data.total || safeVideos.length));
        setHasMoreCommunity(Boolean(data.hasMore));
        setCommunityPage(pageNum);

        if (isLoadMore) {
          setCommunityFeed(prev => {
            const newMap = new Map();
            prev.forEach(v => newMap.set(v.message_id || v.id, v));
            safeVideos.forEach(v => newMap.set(v.message_id || v.id, v));
            return Array.from(newMap.values());
          });
        } else {
          setCommunityFeed(safeVideos);
        }
      }
    } catch (err) {
      console.error("Failed to load community feed", err);
    }

    setCommunityLoading(false);
    setCommunityLoadingMore(false);
  }, []);

  // 🟢 LOAD SEARCH FEED (Creators + Videos)
  const loadSearchFeed = useCallback(async (pageNum = 1, isLoadMore = false, subTab = searchSubTab, queryOverride = null) => {
    const term = (queryOverride !== null ? queryOverride : searchQuery).trim();
    if (!term) return;
    if (isLoadMore) setSearchLoadingMore(true);
    else setSearchLoading(true);

    try {
      const communityParam = activeTab === "community" ? "&community=true" : "";
      const typeParam = subTab === "creators" ? "&type=creators" : subTab === "videos" ? "&type=videos" : "&type=all";
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch(
        `${APP_CONFIG.apiUrl}/api/search?q=${encodeURIComponent(term)}&limit=15&page=${pageNum}${communityParam}${typeParam}`,
        { headers }
      );
      if (res.ok) {
        const data = await res.json();
        const safeVideos = data.videos || [];
        const safeCreators = data.creators || [];

        if (isLoadMore) {
          if (subTab === "creators") {
            setSearchCreators(prev => {
              const ids = new Set(prev.map(c => c.username));
              return [...prev, ...safeCreators.filter(c => !ids.has(c.username))];
            });
          } else {
            setSearchFeed(prev => [...prev, ...safeVideos]);
          }
        } else {
          setSearchFeed(safeVideos);
          setSearchCreators(safeCreators);
          const initialFollows = {};
          safeCreators.forEach(c => {
            if (c.username && c.is_following !== undefined) {
              initialFollows[c.username] = Boolean(c.is_following);
            }
          });
          setSearchFollowingMap(prev => ({ ...initialFollows, ...prev }));
        }
        
        setHasMoreSearch(Boolean(data.hasMore));
        setSearchPage(pageNum);
      }
    } catch (err) {
      console.error("Search failed", err);
    }

    setSearchLoading(false);
    setSearchLoadingMore(false);
  }, [searchQuery, activeTab, searchSubTab]);

  // 🟢 SUBMIT SEARCH & SYNC BROWSER HISTORY
  const handleSearchSubmit = useCallback((term) => {
    const trimmed = (term || "").trim();
    if (!trimmed) {
      handleExitSearch();
      return;
    }

    setSearchQuery(trimmed);
    setSearchSubTab("all");
    setSearchPage(1);
    setHasMoreSearch(true);

    const currentState = window.history.state || {};
    const params = new URLSearchParams(window.location.search);
    params.set("tab", "explore");
    params.set("q", trimmed);
    const targetUrl = `/?${params.toString()}`;

    // If searchOpen was active or already in exploreSearch, replace history entry so back button returns to pre-search Explore
    if (currentState.searchOpen || currentState.inExploreSearch) {
      window.history.replaceState(
        { ...currentState, searchOpen: false, inExploreSearch: true, searchQuery: trimmed },
        document.title,
        targetUrl
      );
    } else {
      window.history.pushState(
        { ...currentState, inExploreSearch: true, searchQuery: trimmed },
        document.title,
        targetUrl
      );
    }

    loadSearchFeed(1, false, "all", trimmed);
  }, [loadSearchFeed]);

  // 🟢 EXIT SEARCH & RESTORE TIMELINE
  const handleExitSearch = useCallback(() => {
    setSearchQuery("");
    setSearchFeed([]);
    setSearchCreators([]);
    setSearchSubTab("all");

    const currentState = window.history.state || {};
    if (currentState.inExploreSearch) {
      window.history.back();
    } else {
      const params = new URLSearchParams(window.location.search);
      params.delete("q");
      const remaining = params.toString();
      const targetUrl = remaining ? `/?${remaining}` : "/?tab=explore";
      window.history.replaceState(
        { ...currentState, inExploreSearch: false, searchQuery: "" },
        document.title,
        targetUrl
      );
    }
  }, []);

  // 🟢 INITIAL LOAD IF Q PARAM EXISTS ON MOUNT
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialQ = params.get("q");
    if (initialQ && initialQ.trim()) {
      loadSearchFeed(1, false, "all", initialQ.trim());
    }
  }, []);

  // 🟢 SYNCHRONIZE BROWSER BACK/FORWARD BUTTONS WITH EXPLORE SEARCH
  useEffect(() => {
    const handleExplorePopState = (event) => {
      const state = event.state || {};
      if (state.creatorProfile || state.storyPlayer || state.videoPlayer || state.commentModal) {
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const urlQuery = params.get("q");

      if (state.inExploreSearch && state.searchQuery) {
        if (state.searchQuery !== searchQuery) {
          setSearchQuery(state.searchQuery);
          loadSearchFeed(1, false, "all", state.searchQuery);
        }
      } else if (urlQuery && urlQuery.trim()) {
        if (urlQuery.trim() !== searchQuery) {
          setSearchQuery(urlQuery.trim());
          loadSearchFeed(1, false, "all", urlQuery.trim());
        }
      } else {
        // Exited search via phone/browser back button!
        if (searchQuery) {
          setSearchQuery("");
          setSearchFeed([]);
          setSearchCreators([]);
          setSearchSubTab("all");
        }
      }
    };

    window.addEventListener("popstate", handleExplorePopState);
    return () => window.removeEventListener("popstate", handleExplorePopState);
  }, [searchQuery, loadSearchFeed]);

  const handleSearchCreatorFollow = async (e, creator) => {
    e.stopPropagation();
    const uname = creator.username;
    const token = localStorage.getItem("token");
    if (!token) return promptLogin("follow");
    if (searchFollowingLoading[uname]) return;

    const isCurrentlyFollowing = searchFollowingMap[uname] !== undefined
      ? searchFollowingMap[uname]
      : Boolean(creator.is_following);
    const nextFollowing = !isCurrentlyFollowing;

    setSearchFollowingMap(prev => ({ ...prev, [uname]: nextFollowing }));
    setSearchFollowingLoading(prev => ({ ...prev, [uname]: true }));

    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/${encodeURIComponent(uname)}/follow`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed to update follow");
      setSearchFollowingMap(prev => ({ ...prev, [uname]: Boolean(data.following) }));
      showToast(data.following ? `Following @${uname}` : `Unfollowed @${uname}`, data.following ? "success" : "error");
      window.dispatchEvent(new CustomEvent("refreshUser"));
    } catch (err) {
      setSearchFollowingMap(prev => ({ ...prev, [uname]: isCurrentlyFollowing }));
      showToast(err.message || "Failed to update follow", "error");
    } finally {
      setSearchFollowingLoading(prev => ({ ...prev, [uname]: false }));
    }
  };

  // 🟢 INITIAL FEED LOADS
  useEffect(() => {
    if (isFirstMount.current) {
      isFirstMount.current = false;
      loadForYouFeed(false);
      loadCommunityFeed(1, false);
      return;
    }
  }, [loadForYouFeed, loadCommunityFeed]);

  // 🟢 AUTO-SEARCH DEBOUNCE
  useEffect(() => {
    if (isFirstMount.current) return;

    if (!searchQuery.trim()) {
      setSearchFeed([]);
      setSearchCreators([]);
      setSearchSubTab("all");
      return;
    }

    const delayDebounceFn = setTimeout(() => {
      setSearchPage(1);
      setHasMoreSearch(true);
      loadSearchFeed(1, false, searchSubTab);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery, searchSubTab]);

  // 🟢 TAB SWITCHING HANDLER
  const handleTabSwitch = (tab) => {
    if (tab === activeTab) {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
      }
      if (tab === "for_you") {
        loadForYouFeed(false, selectedCategory, 1);
      } else if (tab === "community") {
        loadCommunityFeed(1, false);
      }
      return;
    }
    setActiveTab(tab);
    if (tab === "community" && communityFeed.length === 0 && !communityLoading) {
      loadCommunityFeed(1, false);
    }
    if (tab === "for_you") {
      loadForYouFeed(false, selectedCategory, 1);
    }
  };

  // 🟢 Reselecting Explore in bottom navigation scrolls to top and re-randomizes feed
  useEffect(() => {
    const handleReselect = (e) => {
      if (e.detail === "explore") {
        if (scrollContainerRef.current) {
          scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
        }
        if (activeTab === "for_you") {
          loadForYouFeed(false, selectedCategory, 1);
        } else if (activeTab === "community") {
          loadCommunityFeed(1, false);
        }
      }
    };
    window.addEventListener("tabReselected", handleReselect);
    return () => window.removeEventListener("tabReselected", handleReselect);
  }, [activeTab, loadForYouFeed, loadCommunityFeed, selectedCategory]);

  // 🟢 INFINITE SCROLL OBSERVER
  const observer = useRef();
  const lastElementRef = useCallback(node => {
    const isSearching = Boolean(searchQuery.trim());
    if (isSearching) {
      if (searchLoading || searchLoadingMore) return;
    } else if (activeTab === "community") {
      if (communityLoading || communityLoadingMore) return;
    } else {
      if (forYouLoading || forYouLoadingMore || !hasMoreForYou || isFetchingForYouRef.current) return;
    }
    
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        if (isSearching) {
          if (hasMoreSearch) loadSearchFeed(searchPage + 1, true);
        } else if (activeTab === "community") {
          if (hasMoreCommunity) loadCommunityFeed(communityPage + 1, true);
        } else {
          if (hasMoreForYou && !isFetchingForYouRef.current) {
            loadForYouFeed(true, selectedCategory);
          }
        }
      }
    }, {
      rootMargin: "300px"
    });
    if (node) observer.current.observe(node);
  }, [
    searchQuery, searchLoading, searchLoadingMore, hasMoreSearch, searchPage, loadSearchFeed,
    activeTab, communityLoading, communityLoadingMore, hasMoreCommunity, communityPage, loadCommunityFeed,
    forYouLoading, forYouLoadingMore, hasMoreForYou, loadForYouFeed, selectedCategory
  ]);

  // Action for empty community state
  const handleCommunityAction = () => {
    const token = localStorage.getItem("token");
    if (!token) {
      promptLogin("upload");
      return;
    }
    if (user?.is_creator || user?.role === "creator") {
      setShowUploadModal(true);
    } else {
      window.dispatchEvent(new CustomEvent("openCreatorSetup"));
      if (onProfileClick) onProfileClick();
    }
  };

  const isSearching = Boolean(searchQuery.trim());

  // 🟢 COMMON TIMELINE FEED CONTENT (Shared between mobile and desktop feeds)
  const renderTimelineContent = () => {
    // 1. Search Results View
    if (isSearching) {
      if (searchLoading && searchFeed.length === 0) {
        return [...Array(5)].map((_, i) => (
          <div key={i} style={postStyle}>
            <div style={avatarColumnStyle}><div style={skeletonAvatar} /></div>
            <div style={contentColumnStyle}>
              <div style={skeletonTextBase} />
              <div style={{ ...skeletonTextBase, width: "80%", marginTop: "6px", marginBottom: "12px" }} />
              <div style={skeletonVideo} />
            </div>
          </div>
        ));
      }

      const hasCreators = searchCreators.length > 0;
      const hasVideos = searchFeed.length > 0;

      // When subTab is "creators"
      if (searchSubTab === "creators") {
        if (!hasCreators) {
          return (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "#71767b" }}>
              <Users size={40} color="#333" style={{ marginBottom: "12px" }} />
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#ccc" }}>No creators found</p>
              <p style={{ margin: "6px 0 0 0", fontSize: "13px" }}>No creators matched "{searchQuery}". Try searching for another name or handle.</p>
            </div>
          );
        }
        return (
          <div style={{ width: "100%" }}>
            {searchCreators.map(creator => (
              <SearchCreatorCard
                key={creator.username}
                creator={creator}
                onCreatorClick={onCreatorClick}
                onFollowToggle={handleSearchCreatorFollow}
                isFollowing={searchFollowingMap[creator.username] !== undefined ? searchFollowingMap[creator.username] : creator.is_following}
                isLoadingFollow={Boolean(searchFollowingLoading[creator.username])}
              />
            ))}
          </div>
        );
      }

      // When subTab is "videos"
      if (searchSubTab === "videos") {
        if (!hasVideos) {
          return (
            <div style={{ padding: "60px 20px", textAlign: "center", color: "#71767b" }}>
              <Film size={40} color="#333" style={{ marginBottom: "12px" }} />
              <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#ccc" }}>No videos found</p>
              <p style={{ margin: "6px 0 0 0", fontSize: "13px" }}>No videos found for "{searchQuery}". Try a different keyword.</p>
            </div>
          );
        }
        return searchFeed.map((video, idx) => (
          <FeedPost 
            key={`search-${video.message_id || video.id}-${idx}`}
            video={video}
            isLast={searchFeed.length === idx + 1}
            lastElementRef={lastElementRef}
            onVideoClick={handleFeedVideoClick}
            onCommentClick={handleCommentClick} 
            isAnyModalOpen={isAnyModalOpen} 
            onCreatorClick={onCreatorClick}
            onReportClick={handleOpenReport}
            onOptionsClick={handleOpenOptions}
            user={user}
          />
        ));
      }

      // Default subTab: "all"
      if (!hasCreators && !hasVideos) {
        return (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "#71767b" }}>
            <Search size={40} color="#333" style={{ marginBottom: "12px" }} />
            <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#ccc" }}>No results found</p>
            <p style={{ margin: "6px 0 0 0", fontSize: "13px" }}>No creators or videos found for "{searchQuery}". Try a different keyword, handle, or category.</p>
          </div>
        );
      }

      return (
        <div>
          {hasCreators && (
            <div style={{ borderBottom: "1px solid var(--border-color, #2f3336)" }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "space-between", 
                padding: "14px 16px 10px 16px",
                borderBottom: "1px solid var(--border-color, #2f3336)",
                background: "transparent"
              }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "#d4d4d8" }}>
                    Creators
                  </h3>
                </div>
                {searchCreators.length > 3 && (
                  <button
                    onClick={() => {
                      setSearchSubTab("creators");
                      loadSearchFeed(1, false, "creators");
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#d4d4d8",
                      fontSize: "13px",
                      fontWeight: "600",
                      cursor: "pointer",
                      padding: 0
                    }}
                  >
                    View all ({searchCreators.length})
                  </button>
                )}
              </div>

              <div>
                {searchCreators.slice(0, 3).map(creator => (
                  <SearchCreatorCard
                    key={creator.username}
                    creator={creator}
                    onCreatorClick={onCreatorClick}
                    onFollowToggle={handleSearchCreatorFollow}
                    isFollowing={searchFollowingMap[creator.username] !== undefined ? searchFollowingMap[creator.username] : creator.is_following}
                    isLoadingFollow={Boolean(searchFollowingLoading[creator.username])}
                  />
                ))}
              </div>
            </div>
          )}

          {hasVideos && (
            <div>
              {hasCreators && (
                <div style={{ 
                  padding: "12px 16px 8px 16px", 
                  fontSize: "13px", 
                  fontWeight: "700", 
                  color: "#8e8e8e", 
                  textTransform: "uppercase", 
                  letterSpacing: "0.5px" 
                }}>
                  Videos
                </div>
              )}
              {searchFeed.map((video, idx) => (
                <FeedPost 
                  key={`search-${video.message_id || video.id}-${idx}`}
                  video={video}
                  isLast={searchFeed.length === idx + 1}
                  lastElementRef={lastElementRef}
                  onVideoClick={handleFeedVideoClick}
                  onCommentClick={handleCommentClick} 
                  isAnyModalOpen={isAnyModalOpen} 
                  onCreatorClick={onCreatorClick}
                  onReportClick={handleOpenReport}
                  onOptionsClick={handleOpenOptions}
                  user={user}
                />
              ))}
            </div>
          )}
        </div>
      );
    }

    // 2. Community Tab View (Web creator uploads only)
    if (activeTab === "community") {
      if (communityLoading && communityFeed.length === 0) {
        return [...Array(5)].map((_, i) => (
          <div key={i} style={postStyle}>
            <div style={avatarColumnStyle}><div style={skeletonAvatar} /></div>
            <div style={contentColumnStyle}>
              <div style={skeletonTextBase} />
              <div style={{ ...skeletonTextBase, width: "80%", marginTop: "6px", marginBottom: "12px" }} />
              <div style={skeletonVideo} />
            </div>
          </div>
        ));
      }
      if (communityFeed.length === 0) {
        return (
          <div style={communityEmptyWrapper}>
            <div style={communityEmptyIconBox}>
              <Users size={32} color="#d4d4d8" />
            </div>
            <h3 style={communityEmptyTitle}>Creator Community</h3>
            <p style={communityEmptySubtitle}>
              Exclusive videos, drops, and stories posted directly by verified web creators.
            </p>
            <div style={communityNoticeCard}>
              <Sparkles size={20} color="#FFD700" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: "13px", color: "#ccc", lineHeight: "1.4" }}>
                All content published by verified web creators appears exclusively here in the Community tab.
              </span>
            </div>
            <button
              type="button"
              onClick={handleCommunityAction}
              style={communityEmptyActionBtn}
            >
              {user?.is_creator || user?.role === "creator" ? (
                <>
                  <Film size={16} />
                  <span>Publish First Video</span>
                </>
              ) : user ? (
                <>
                  <Sparkles size={16} />
                  <span>Become a Web Creator</span>
                </>
              ) : (
                <span>Log In to Post</span>
              )}
            </button>
          </div>
        );
      }
      return communityFeed.map((video, idx) => (
        <FeedPost 
          key={`comm-${video.message_id || video.id}-${idx}`}
          video={video}
          isLast={communityFeed.length === idx + 1}
          lastElementRef={lastElementRef}
          onVideoClick={handleFeedVideoClick}
          onCommentClick={handleCommentClick} 
          isAnyModalOpen={isAnyModalOpen} 
          onCreatorClick={onCreatorClick}
          onReportClick={handleOpenReport}
          onOptionsClick={handleOpenOptions}
          user={user}
        />
      ));
    }

    // 3. For You Tab View (Platform content & Suggested Creators)
    if (forYouLoading && forYouFeed.length === 0) {
      return [...Array(5)].map((_, i) => (
        <div key={i} style={postStyle}>
          <div style={avatarColumnStyle}><div style={skeletonAvatar} /></div>
          <div style={contentColumnStyle}>
            <div style={skeletonTextBase} />
            <div style={{ ...skeletonTextBase, width: "80%", marginTop: "6px", marginBottom: "12px" }} />
            <div style={skeletonVideo} />
          </div>
        </div>
      ));
    }
    if (forYouFeed.length === 0) {
      return (
        <div style={{ padding: "50px 20px", textAlign: "center", color: "#71767b" }}>
          No videos available in {selectedCategory ? `#${selectedCategory}` : "For You"}.
        </div>
      );
    }
    return forYouFeed.map((video, idx) => {
      const isLast = forYouFeed.length === idx + 1;
      const isFirstSuggestedSpot = featuredCreators.length > 0 && !selectedCategory && (
        (idx === suggestedIndex) ||
        (idx === forYouFeed.length - 1 && forYouFeed.length <= suggestedIndex)
      );
      const isSecondSuggestedSpot = featuredCreators.length > 8 && !selectedCategory && (
        forYouFeed.length > 15 && idx === suggestedIndex + 14
      );

      return (
        <React.Fragment key={`for-you-${video.message_id || video.id}-${idx}`}>
          <FeedPost 
            video={video}
            isLast={isLast}
            lastElementRef={lastElementRef}
            onVideoClick={handleFeedVideoClick}
            onCommentClick={handleCommentClick} 
            isAnyModalOpen={isAnyModalOpen} 
            onCreatorClick={onCreatorClick}
            onReportClick={handleOpenReport}
            onOptionsClick={handleOpenOptions}
            user={user}
          />

          {isFirstSuggestedSpot && (
            <InstagramSuggestedCreators 
              creators={featuredCreators.slice(0, 8)}
              onCreatorClick={onCreatorClick}
              onSeeAll={handleOpenDiscover}
              user={user}
            />
          )}

          {isSecondSuggestedSpot && (
            <InstagramSuggestedCreators 
              creators={featuredCreators.slice(8, 16)}
              onCreatorClick={onCreatorClick}
              onSeeAll={handleOpenDiscover}
              user={user}
            />
          )}
        </React.Fragment>
      );
    });
  };

  return (
    <div style={{ background: "var(--bg-color)", height: "100vh", overflow: "hidden", position: "relative" }}>
      
      {/* 🟢 MOBILE VIEW (< 1024px) */}
      {!isDesktop && (
        <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
          {/* Mobile AppHeader / Active Search Header + Two Tabs Overlay */}
          <div style={{
            position: "absolute",
            top: 0, left: 0, right: 0,
            zIndex: 1000,
            transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease",
            transform: shouldHideUI ? "translateY(-100%)" : "translateY(0)",
            opacity: shouldHideUI ? 0 : 1,
            pointerEvents: shouldHideUI ? "none" : "auto",
            background: "var(--bg-color, #09090b)"
          }}>
            {/* AppHeader is kept in tree for portal search modal */}
            <div style={{ display: isSearching ? "none" : "block" }}>
              <AppHeader 
                tab="explore"
                isDesktop={false} 
                searchTerm={headerSearchTerm} 
                setSearchTerm={setHeaderSearchTerm} 
                user={user} 
                onProfileClick={onProfileClick} 
                onVideoClick={handleFeedVideoClick}
                onCreatorClick={onCreatorClick}
              />
            </div>

            {/* When in Active Search Mode: Show Mobile Active Search Bar Header */}
            {isSearching && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                padding: "8px 14px",
                background: "var(--bg-color, #0a0a0a)",
                borderBottom: "1px solid #262626",
                minHeight: "50px",
                boxSizing: "border-box"
              }}>
                <button
                  type="button"
                  onClick={handleExitSearch}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#d4d4d8",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "6px",
                    borderRadius: "50%",
                    flexShrink: 0
                  }}
                  title="Back to Explore"
                  aria-label="Back to Explore"
                >
                  <ArrowLeft size={22} />
                </button>

                <div
                  onClick={() => window.dispatchEvent(new CustomEvent("openSearchModal"))}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    alignItems: "center",
                    background: "#1c1c1e",
                    borderRadius: "20px",
                    padding: "6px 12px",
                    border: "1px solid #333333",
                    cursor: "pointer",
                    gap: "8px"
                  }}
                >
                  <Search size={16} color="#8e8e8e" style={{ flexShrink: 0 }} />
                  <span style={{
                    color: "#d4d4d8",
                    fontSize: "14px",
                    fontWeight: "600",
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}>
                    {searchQuery}
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleExitSearch();
                    }}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#8e8e8e",
                      cursor: "pointer",
                      padding: "2px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0
                    }}
                    title="Clear search"
                  >
                    <X size={16} />
                  </button>
                </div>

                <button 
                  type="button"
                  onClick={onProfileClick} 
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, flexShrink: 0 }}
                >
                  {user?.id || user?.email ? (
                    <img 
                      src={user.avatar_url || "/assets/default-avatar.png"} 
                      alt="P" 
                      style={{ width: "30px", height: "30px", borderRadius: "50%", border: "2px solid rgba(255, 255, 255, 0.2)", objectFit: "cover" }} 
                    />
                  ) : (
                    <div style={{ background: "#c4c4c8", color: "#09090b", padding: "5px 10px", borderRadius: "18px", fontSize: "11px", fontWeight: "800" }}>
                      LOGIN
                    </div>
                  )}
                </button>
              </div>
            )}

            {/* Mobile Explore Tabs / Search Subtabs */}
            {isSearching ? (
              <div style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 16px",
                background: "var(--bg-color, #0a0a0a)",
                borderBottom: "1px solid #2f3336",
                overflowX: "auto",
                WebkitOverflowScrolling: "touch"
              }}>
                {[
                  { key: "all", label: "Top" },
                  { key: "creators", label: `Creators (${searchCreators.length})` },
                  { key: "videos", label: `Videos (${searchFeed.length})` }
                ].map(tab => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => {
                      setSearchSubTab(tab.key);
                      loadSearchFeed(1, false, tab.key);
                    }}
                    style={{
                      padding: "6px 14px",
                      borderRadius: "18px",
                      fontSize: "12.5px",
                      fontWeight: searchSubTab === tab.key ? "700" : "500",
                      background: searchSubTab === tab.key ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.04)",
                      color: searchSubTab === tab.key ? "#f4f4f5" : "#71767b",
                      border: `1px solid ${searchSubTab === tab.key ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.08)"}`,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      transition: "all 0.15s ease"
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            ) : (
              <div style={exploreTabsNavWrapper}>
                <div style={exploreTabsNavInner}>
                  <button
                    type="button"
                    onClick={() => handleTabSwitch("for_you")}
                    style={exploreTabBtnStyle}
                  >
                    <span style={{
                      fontSize: "14.5px",
                      fontWeight: activeTab === "for_you" ? "700" : "500",
                      color: activeTab === "for_you" ? "#d4d4d8" : "#71767b",
                      letterSpacing: "0.2px",
                      transition: "color 0.2s ease, font-weight 0.15s ease"
                    }}>
                      For You
                    </span>
                    {activeTab === "for_you" && <div style={exploreTabActivePillStyle} />}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTabSwitch("community")}
                    style={exploreTabBtnStyle}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{
                        fontSize: "14.5px",
                        fontWeight: activeTab === "community" ? "700" : "500",
                        color: activeTab === "community" ? "#d4d4d8" : "#71767b",
                        letterSpacing: "0.2px",
                        transition: "color 0.2s ease, font-weight 0.15s ease"
                      }}>
                        Community
                      </span>
                      {communityCount > 0 && (
                        <span style={communityCountPillStyle}>
                          {communityCount}
                        </span>
                      )}
                    </div>
                    {activeTab === "community" && <div style={exploreTabActivePillStyle} />}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Mobile Scrollable Timeline */}
          <div 
            ref={!isDesktop ? scrollContainerRef : null}
            style={{
              flex: 1,
              overflowY: "auto",
              paddingTop: "114px",
              paddingBottom: shouldHideUI ? "0px" : "70px",
              transition: "padding-bottom 0.3s ease, padding-top 0.2s ease"
            }}
          >
            <PullToRefresh 
              scrollRef={scrollContainerRef}
              onRefresh={async () => {
                if (isSearching) {
                  setSearchPage(1);
                  setHasMoreSearch(true);
                  await loadSearchFeed(1, false);
                } else if (activeTab === "community") {
                  setCommunityPage(1);
                  setHasMoreCommunity(true);
                  await loadCommunityFeed(1, false);
                } else {
                  setSuggestedIndex(Math.floor(Math.random() * 4) + 2);
                  fetchFeaturedCreators();
                  await loadForYouFeed(false, selectedCategory, 1);
                }
              }}
            >
              <div style={feedWrapper}>
                {renderTimelineContent()}

                {(isSearching ? searchLoadingMore : (activeTab === "community" ? communityLoadingMore : forYouLoadingMore)) && (
                  <div style={{ padding: "20px", display: "flex", justifyContent: "center", color: "#d4d4d8" }}>
                    <Loader2 className="animate-spin" size={24} />
                  </div>
                )}
              </div>
            </PullToRefresh>
          </div>

          {/* Mobile Community Creator Post FAB */}
          {activeTab === "community" && (user?.is_creator || user?.role === "creator") && (
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              style={communityFabStyle}
              title="Post video to Community"
              aria-label="Post video to Community"
            >
              <Plus size={22} color="#d4d4d8" strokeWidth={2.5} />
              <span style={{ fontSize: "13px", fontWeight: "700", color: "#d4d4d8", marginLeft: "4px" }}>
                Post
              </span>
            </button>
          )}
        </div>
      )}

      {/* 🟢 DESKTOP VIEW (>= 1024px: 3 Columns like X/Twitter) */}
      {isDesktop && (
        <div style={desktopContainerStyle}>
          <div style={desktopInnerWrapperStyle}>
            {/* 1. LEFT SIDEBAR: Menus and Categories */}
            <DesktopLeftSidebar
              user={user}
              activeTab={activeTab}
              onTabSwitch={handleTabSwitch}
              communityCount={communityCount}
              selectedCategory={selectedCategory}
              onSelectCategory={handleSelectCategory}
              onNavigateHome={() => onNavigateTab ? onNavigateTab("home") : (window.location.href = "/")}
              onProfileClick={onProfileClick}
              onOpenDiscover={handleOpenDiscover}
              onPostClick={handleCommunityAction}
            />

            {/* 2. MIDDLE COLUMN: Main Feed */}
            <div 
              ref={isDesktop ? scrollContainerRef : null}
              style={{
                ...desktopCenterRailStyle,
                paddingBottom: "80px"
              }}
              className="custom-scrollbar"
            >
              {/* Desktop Sticky Header */}
              <div style={{
                ...desktopHeaderStickyStyle,
                transform: shouldHideUI ? "translateY(-100%)" : "translateY(0)",
                opacity: shouldHideUI ? 0 : 1,
                pointerEvents: shouldHideUI ? "none" : "auto",
                transition: "transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s ease"
              }}>
                <div style={desktopHeaderTopStyle}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={desktopHeaderTitleStyle}>
                      {selectedCategory ? `Explore · #${selectedCategory.toUpperCase()}` : "Explore"}
                    </span>
                    {selectedCategory && (
                      <button
                        type="button"
                        onClick={() => handleSelectCategory(selectedCategory)}
                        style={categoryFilterTagStyle}
                        title="Clear category filter"
                      >
                        <span>#{selectedCategory}</span>
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={async () => {
                      if (activeTab === "community") {
                        setCommunityPage(1);
                        setHasMoreCommunity(true);
                        await loadCommunityFeed(1, false);
                      } else {
                        await loadForYouFeed(false, selectedCategory, 1);
                      }
                      fetchHighlights();
                    }}
                    style={desktopRefreshBtnStyle}
                    title="Refresh Feed"
                  >
                    <RefreshCw size={16} />
                  </button>
                </div>

                {/* Explore Tabs (For You / Community) */}
                {!isSearching && (
                  <div style={desktopTabsNavInner}>
                    <button
                      type="button"
                      onClick={() => {
                        handleSelectCategory(null);
                        handleTabSwitch("for_you");
                      }}
                      style={desktopTabBtnStyle}
                    >
                      <span style={{
                        fontSize: "15px",
                        fontWeight: activeTab === "for_you" ? "700" : "500",
                        color: activeTab === "for_you" ? "#d4d4d8" : "#71767b",
                        transition: "color 0.2s ease"
                      }}>
                        For You
                      </span>
                      {activeTab === "for_you" && <div style={desktopTabActivePillStyle} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleSelectCategory(null);
                        handleTabSwitch("community");
                      }}
                      style={desktopTabBtnStyle}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{
                          fontSize: "15px",
                          fontWeight: activeTab === "community" ? "700" : "500",
                          color: activeTab === "community" ? "#d4d4d8" : "#71767b",
                          transition: "color 0.2s ease"
                        }}>
                          Community
                        </span>
                        {communityCount > 0 && (
                          <span style={communityCountPillStyle}>
                            {communityCount}
                          </span>
                        )}
                      </div>
                      {activeTab === "community" && <div style={desktopTabActivePillStyle} />}
                    </button>
                  </div>
                )}

                {isSearching && (
                  <div style={{
                    padding: "14px 16px",
                    borderBottom: "1px solid #2f3336",
                    background: "rgba(0, 0, 0, 0.4)",
                    backdropFilter: "blur(10px)"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                      <span style={{ fontSize: "15px", color: "#e7e9ea" }}>
                        Results for "<strong>{searchQuery}</strong>"
                      </span>
                      <button
                        type="button"
                        onClick={handleExitSearch}
                        style={desktopSearchClearBtn}
                      >
                        Clear
                      </button>
                    </div>

                    {/* Sub-tab pills */}
                    <div style={{ display: "flex", gap: "8px" }}>
                      {[
                        { key: "all", label: "Top / All" },
                        { key: "creators", label: `Creators (${searchCreators.length})` },
                        { key: "videos", label: `Videos (${searchFeed.length})` }
                      ].map(tab => (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => {
                            setSearchSubTab(tab.key);
                            loadSearchFeed(1, false, tab.key);
                          }}
                          style={{
                            padding: "6px 14px",
                            borderRadius: "20px",
                            fontSize: "13px",
                            fontWeight: searchSubTab === tab.key ? "700" : "500",
                            background: searchSubTab === tab.key ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.04)",
                            color: searchSubTab === tab.key ? "#f4f4f5" : "#71767b",
                            border: `1px solid ${searchSubTab === tab.key ? "rgba(255, 255, 255, 0.18)" : "rgba(255, 255, 255, 0.08)"}`,
                            cursor: "pointer",
                            transition: "all 0.15s ease"
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Main timeline content */}
              <div style={{ flex: 1 }}>
                {renderTimelineContent()}

                {/* Load More Spinners */}
                {(isSearching ? searchLoadingMore : (activeTab === "community" ? communityLoadingMore : forYouLoadingMore)) && (
                  <div style={{ padding: "24px", display: "flex", justifyContent: "center", color: "#d4d4d8" }}>
                    <Loader2 className="animate-spin" size={26} />
                  </div>
                )}
              </div>
            </div>

            {/* 3. RIGHT SIDEBAR: Highlights & Trends */}
            <DesktopRightSidebar
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSearchSubmit={handleSearchSubmit}
              onClear={handleExitSearch}
              onSelectTopic={(catId) => handleSelectCategory(catId)}
              highlights={highlightVideos}
              highlightsLoading={highlightLoading}
              onRefreshHighlights={fetchHighlights}
              featuredCreators={featuredCreators}
              onCreatorClick={onCreatorClick}
              onVideoClick={onVideoClick}
              onOpenDiscover={handleOpenDiscover}
              user={user}
            />
          </div>
        </div>
      )}

      {/* 🌟 CREATOR CONTENT UPLOAD MODAL */}
      {showUploadModal && (
        <CreatorUploadModal 
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onSuccess={(newVideo) => {
            if (newVideo) {
              setCommunityFeed(prev => [newVideo, ...prev]);
              setCommunityCount(prev => prev + 1);
            }
            setActiveTab("community");
            showToast("Video published to Community!", "success");
            setShowUploadModal(false);
          }}
          defaultCategory="community"
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
            if (onCreatorClick) onCreatorClick(uname);
          }}
        />
      )}

      {/* 🌟 POST OPTIONS MODAL (X-Style Bottom Sheet) */}
      {optionsVideo && (
        <PostOptionsModal
          isOpen={Boolean(optionsVideo)}
          video={optionsVideo}
          currentUser={user}
          isFollowing={Boolean(optionsVideo && (searchFollowingMap[optionsVideo.creator_username || optionsVideo.uploader_name] !== undefined ? searchFollowingMap[optionsVideo.creator_username || optionsVideo.uploader_name] : optionsVideo.is_following))}
          onClose={() => setOptionsVideo(null)}
          onReport={(v) => {
            setOptionsVideo(null);
            setReportedVideo(v);
          }}
          onNotInterested={handleNotInterested}
          onFollowToggle={(uname) => {
            handleSearchCreatorFollow(uname);
          }}
          onDelete={handleDeletePost}
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

      <style>{`
        @keyframes skeleton-loading { 0% { background-color: #222; } 50% { background-color: #333; } 100% { background-color: #222; } }
        .animate-spin { animation: spin 1s linear infinite; }
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 10px; }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.32); }
      `}</style>
    </div>
  );
}

// 🖌 STYLES 
const exploreTabsNavWrapper = {
  width: "100%",
  maxWidth: "600px",
  margin: "0 auto",
  display: "flex",
  borderBottom: "1px solid var(--border-color)",
  background: "var(--bg-color)",
  boxSizing: "border-box"
};

const exploreTabsNavInner = {
  display: "flex",
  width: "100%",
  height: "46px"
};

const exploreTabBtnStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: "0 16px",
  transition: "background 0.2s ease"
};

const exploreTabActivePillStyle = {
  position: "absolute",
  bottom: 0,
  height: "3px",
  width: "56px",
  borderRadius: "3px 3px 0 0",
  backgroundColor: "#e4e4e7"
};

const communityCountPillStyle = {
  background: "rgba(255, 255, 255, 0.12)",
  color: "#d4d4d8",
  fontSize: "11px",
  fontWeight: "700",
  padding: "1px 6px",
  borderRadius: "10px",
  lineHeight: "1.3"
};

const communityEmptyWrapper = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "48px 20px",
  textAlign: "center",
  maxWidth: "420px",
  margin: "0 auto"
};

const communityEmptyIconBox = {
  width: "64px",
  height: "64px",
  borderRadius: "50%",
  background: "rgba(255, 255, 255, 0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "16px"
};

const communityEmptyTitle = {
  fontSize: "19px",
  fontWeight: "800",
  color: "#d4d4d8",
  marginBottom: "8px"
};

const communityEmptySubtitle = {
  fontSize: "14px",
  color: "#71767b",
  lineHeight: "1.5",
  marginBottom: "20px"
};

const communityNoticeCard = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "12px 16px",
  borderRadius: "12px",
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  textAlign: "left",
  marginBottom: "24px",
  width: "100%",
  boxSizing: "border-box"
};

const communityEmptyActionBtn = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "12px 24px",
  borderRadius: "24px",
  background: "#c4c4c8",
  color: "#09090b",
  fontSize: "14px",
  fontWeight: "700",
  border: "none",
  cursor: "pointer",
  boxShadow: "0 2px 10px rgba(255, 255, 255, 0.15)",
  transition: "transform 0.15s ease, opacity 0.2s ease"
};

const communityFabStyle = {
  position: "fixed",
  bottom: "84px",
  right: "20px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 18px",
  borderRadius: "24px",
  background: "#c4c4c8",
  color: "#09090b",
  border: "none",
  boxShadow: "0 6px 20px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(255, 255, 255, 0.2)",
  cursor: "pointer",
  zIndex: 990,
  transition: "transform 0.15s ease, box-shadow 0.2s ease"
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
  width: "100%",
  maxWidth: "1420px",
  height: "100vh",
  position: "relative"
};

const desktopLeftRailStyle = {
  width: "260px",
  height: "100vh",
  overflowY: "auto",
  position: "sticky",
  top: 0,
  flexShrink: 0,
  borderRight: "1px solid var(--border-color)",
  padding: "16px 14px 20px 14px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  boxSizing: "border-box"
};

const desktopBrandHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "8px 12px",
  cursor: "pointer",
  borderRadius: "9999px",
  transition: "background 0.2s ease",
  userSelect: "none"
};

const desktopBrandLogoCircle = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  background: "linear-gradient(135deg, #FF6B00 0%, #FF0055 100%)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 2px 10px rgba(255, 107, 0, 0.4)",
  flexShrink: 0
};

const desktopNavBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  padding: "12px 16px",
  width: "100%",
  border: "none",
  background: "transparent",
  borderRadius: "9999px",
  cursor: "pointer",
  transition: "background 0.2s ease",
  textAlign: "left",
  boxSizing: "border-box"
};

const desktopNavIconBox = {
  width: "26px",
  height: "26px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0
};

const desktopNavLabelStyle = {
  fontSize: "17px",
  fontWeight: "600",
  color: "#d4d4d8",
  letterSpacing: "0.2px"
};

const desktopNavDividerStyle = {
  height: "1px",
  background: "var(--border-color)",
  margin: "14px 8px 12px 8px"
};

const desktopSectionHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 14px 8px 14px",
  fontSize: "11px",
  fontWeight: "800",
  color: "#71767b",
  letterSpacing: "0.8px"
};

const desktopClearCategoryBtn = {
  background: "none",
  border: "none",
  color: "#71767b",
  fontSize: "11px",
  fontWeight: "700",
  cursor: "pointer",
  padding: 0
};

const desktopCategoryBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "9px 14px",
  width: "100%",
  border: "none",
  background: "transparent",
  borderRadius: "10px",
  cursor: "pointer",
  transition: "all 0.15s ease",
  textAlign: "left",
  boxSizing: "border-box"
};

const desktopPostBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  width: "100%",
  height: "48px",
  borderRadius: "9999px",
  background: "#c4c4c8",
  color: "#09090b",
  border: "none",
  fontSize: "16px",
  fontWeight: "800",
  cursor: "pointer",
  marginTop: "18px",
  boxShadow: "0 2px 10px rgba(255, 255, 255, 0.15)",
  transition: "opacity 0.2s ease, transform 0.15s ease",
  boxSizing: "border-box"
};

const desktopUserPillStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "10px 12px",
  borderRadius: "9999px",
  cursor: "pointer",
  transition: "background 0.2s ease",
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(255, 255, 255, 0.04)"
};

const desktopUserPillAvatar = {
  width: "38px",
  height: "38px",
  borderRadius: "50%",
  objectFit: "cover",
  flexShrink: 0,
  border: "1px solid rgba(255, 255, 255, 0.12)"
};

const desktopUserPillName = {
  fontSize: "14px",
  fontWeight: "700",
  color: "#d4d4d8",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis"
};

const desktopUserPillHandle = {
  fontSize: "12px",
  color: "#71767b",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "block"
};

const desktopLoginPillBtn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  width: "100%",
  padding: "12px 16px",
  borderRadius: "9999px",
  background: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  color: "#d4d4d8",
  fontSize: "14px",
  fontWeight: "700",
  cursor: "pointer",
  transition: "background 0.2s ease"
};

const desktopCenterRailStyle = {
  flex: 1,
  maxWidth: "620px",
  width: "100%",
  minWidth: 0,
  height: "100vh",
  overflowY: "auto",
  borderLeft: "1px solid var(--border-color)",
  borderRight: "1px solid var(--border-color)",
  display: "flex",
  flexDirection: "column",
  boxSizing: "border-box"
};

const desktopHeaderStickyStyle = {
  position: "sticky",
  top: 0,
  zIndex: 100,
  background: "rgba(0, 0, 0, 0.8)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  borderBottom: "1px solid var(--border-color)",
  boxSizing: "border-box"
};

const desktopHeaderTopStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  height: "54px",
  padding: "0 16px",
  boxSizing: "border-box"
};

const desktopHeaderTitleStyle = {
  fontSize: "20px",
  fontWeight: "800",
  color: "#d4d4d8",
  letterSpacing: "-0.3px"
};

const categoryFilterTagStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  padding: "3px 10px",
  borderRadius: "12px",
  background: "rgba(255, 255, 255, 0.12)",
  color: "#d4d4d8",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  fontSize: "12px",
  fontWeight: "700",
  cursor: "pointer"
};

const desktopRefreshBtnStyle = {
  width: "36px",
  height: "36px",
  borderRadius: "50%",
  background: "none",
  border: "none",
  color: "#71767b",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  transition: "color 0.2s ease, background 0.2s ease"
};

const desktopTabsNavInner = {
  display: "flex",
  width: "100%",
  height: "48px",
  borderTop: "1px solid rgba(255, 255, 255, 0.05)"
};

const desktopTabBtnStyle = {
  flex: 1,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  background: "none",
  border: "none",
  cursor: "pointer",
  transition: "background 0.2s ease"
};

const desktopTabActivePillStyle = {
  position: "absolute",
  bottom: 0,
  height: "4px",
  width: "56px",
  borderRadius: "4px 4px 0 0",
  backgroundColor: "#d4d4d8"
};

const desktopSearchActiveBanner = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "10px 16px",
  background: "rgba(255, 255, 255, 0.06)",
  borderTop: "1px solid rgba(255, 255, 255, 0.12)"
};

const desktopSearchClearBtn = {
  background: "none",
  border: "none",
  color: "#d4d4d8",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer"
};

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

const desktopSideCreatorRow = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
  padding: "12px 16px",
  cursor: "pointer",
  transition: "background 0.15s ease",
  borderBottom: "1px solid rgba(255, 255, 255, 0.03)"
};

const desktopSideCreatorAvatarRing = {
  width: "42px",
  height: "42px",
  borderRadius: "50%",
  padding: "2px",
  background: "rgba(255, 255, 255, 0.12)",
  flexShrink: 0
};

const desktopSideCreatorAvatarImg = {
  width: "100%",
  height: "100%",
  borderRadius: "50%",
  objectFit: "cover",
  display: "block",
  background: "#222"
};

const desktopSideCreatorInfo = {
  flex: 1,
  minWidth: 0
};

const desktopSideCreatorName = {
  fontSize: "14px",
  fontWeight: "700",
  color: "#d4d4d8",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "block"
};

const desktopSideCreatorHandle = {
  fontSize: "12px",
  color: "#71767b",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "block"
};

const desktopSideFollowBtn = {
  padding: "6px 16px",
  borderRadius: "9999px",
  background: "#c4c4c8",
  color: "#09090b",
  border: "none",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
  flexShrink: 0,
  transition: "background 0.2s ease"
};

const desktopSideFollowingBtn = {
  padding: "6px 16px",
  borderRadius: "9999px",
  background: "transparent",
  color: "#a1a1aa",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
  flexShrink: 0
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

const feedWrapper = { maxWidth: "600px", margin: "0 auto", width: "100%", borderLeft: window.innerWidth > 600 ? "1px solid var(--border-color)" : "none", borderRight: window.innerWidth > 600 ? "1px solid var(--border-color)" : "none", minHeight: "100vh" };
const postStyle = { padding: "16px", borderBottom: "1px solid var(--border-color)", display: "flex", flexDirection: "row", animation: "fadeIn 0.3s ease-out" };
const avatarColumnStyle = { marginRight: "12px", flexShrink: 0 };
const contentColumnStyle = { flex: 1, display: "flex", flexDirection: "column", minWidth: 0 };
const postHeaderStyle = { display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" };
const avatarStyle = { width: "40px", height: "40px", borderRadius: "50%", objectFit: "cover", backgroundColor: "#222" };
const usernameStyle = { fontSize: "15px", fontWeight: "700", color: "#d4d4d8" };
const timeStyle = { fontSize: "13px", color: "#71767b", textTransform: "capitalize", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" };
const captionStyle = { fontSize: "15px", lineHeight: "1.5", color: "#e7e9ea", margin: "0 0 12px 0", wordWrap: "break-word" };

// 🟢 FIX: Removed hardcoded width (now handled inline by state). Removed aspectRatio.
const videoContainerStyle = { position: "relative", borderRadius: "16px", overflow: "hidden", background: "#111", border: "1px solid #333", cursor: "pointer", maxHeight: "600px" };

// 🟢 FIX: Let media scale naturally up to 600px tall
const thumbnailImgStyle = { width: "100%", height: "100%", maxHeight: "560px", objectFit: "cover", display: "block" };
const playOverlayStyle = { position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: "48px", height: "48px", borderRadius: "50%", background: "rgba(0, 0, 0, 0.6)", color: "#d4d4d8", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 16px rgba(0,0,0,0.5)", border: "1.5px solid rgba(255,255,255,0.25)", backdropFilter: "blur(4px)" };
const groupBadgeStyle = { position: "absolute", top: "12px", right: "12px", background: "rgba(0,0,0,0.6)", color: "#d4d4d8", fontSize: "11px", fontWeight: "700", padding: "3px 8px", borderRadius: "12px", border: "1px solid rgba(255, 255, 255, 0.15)", zIndex: 11 };
const actionBarStyle = { display: "flex", justifyContent: "space-between", marginTop: "12px", maxWidth: "425px" };
const actionItemStyle = { display: "flex", alignItems: "center", gap: "6px", color: "#71767b", fontSize: "13px", cursor: "pointer", transition: "color 0.2s ease" };
const skeletonAvatar = { width: "40px", height: "40px", borderRadius: "50%", animation: "skeleton-loading 1.5s infinite" };
const skeletonTextBase = { width: "150px", height: "20px", borderRadius: "4px", marginTop: "4px", animation: "skeleton-loading 1.5s infinite" };
const skeletonVideo = { width: "100%", maxWidth: "380px", aspectRatio: "4 / 5", minHeight: "260px", borderRadius: "16px", animation: "skeleton-loading 1.5s infinite" };

const vipLockedOverlayStyle = {
  position: "absolute",
  inset: 0,
  zIndex: 10,
  background: "rgba(0, 0, 0, 0.45)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "20px",
  textAlign: "center",
  borderRadius: "inherit"
};

const vipBadgePillStyle = {
  position: "absolute",
  top: "12px",
  left: "12px",
  background: "rgba(0, 0, 0, 0.55)",
  color: "#d4d4d8",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  padding: "3px 8px",
  borderRadius: "6px",
  fontSize: "10px",
  fontWeight: "800",
  letterSpacing: "0.5px",
  display: "flex",
  alignItems: "center",
  zIndex: 11,
  boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
};

const vipLockCenterStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "10px",
  maxWidth: "240px"
};

const vipLockCircleStyle = {
  width: "52px",
  height: "52px",
  borderRadius: "50%",
  background: "rgba(0, 0, 0, 0.5)",
  border: "1px solid rgba(255, 215, 0, 0.4)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)"
};

const vipSubscribeButtonStyle = {
  background: "#e11d48",
  color: "#d4d4d8",
  border: "none",
  borderRadius: "100px",
  padding: "10px 18px",
  fontSize: "12.5px",
  fontWeight: "700",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  cursor: "pointer",
  boxShadow: "0 2px 12px rgba(225, 29, 72, 0.25)",
  transition: "transform 0.15s ease",
  marginTop: "4px"
};

const vipUnlockedBadgeStyle = {
  position: "absolute",
  top: "12px",
  left: "12px",
  background: "rgba(0, 0, 0, 0.55)",
  color: "#d4d4d8",
  border: "1px solid rgba(255, 255, 255, 0.18)",
  padding: "3px 8px",
  borderRadius: "6px",
  fontSize: "10px",
  fontWeight: "800",
  letterSpacing: "0.5px",
  display: "flex",
  alignItems: "center",
  zIndex: 11,
  boxShadow: "0 2px 8px rgba(0,0,0,0.3)"
};

const albumWrapperStyle = {
  position: "relative",
  width: "100%",
  margin: "4px 0 8px 0"
};

const albumRowTrackStyle = {
  display: "flex",
  flexDirection: "row",
  gap: "12px",
  overflowX: "auto",
  overflowY: "hidden",
  scrollSnapType: "x mandatory",
  WebkitOverflowScrolling: "touch",
  scrollbarWidth: "none",
  msOverflowStyle: "none",
  padding: "4px 2px 8px 2px",
  width: "100%"
};

const albumVideoCardStyle = {
  flex: "0 0 min(260px, 80%)",
  width: "min(260px, 80%)",
  height: "360px",
  borderRadius: "16px",
  overflow: "hidden",
  position: "relative",
  background: "#0e0e0e",
  border: "1.5px solid rgba(255, 255, 255, 0.16)",
  boxShadow: "0 4px 16px rgba(0, 0, 0, 0.45)",
  scrollSnapAlign: "start",
  scrollSnapStop: "normal",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0
};

const albumCardCounterStyle = {
  position: "absolute",
  top: "10px",
  right: "10px",
  background: "rgba(0, 0, 0, 0.65)",
  color: "#d4d4d8",
  fontSize: "10.5px",
  fontWeight: "700",
  padding: "3px 8px",
  borderRadius: "10px",
  letterSpacing: "0.5px",
  zIndex: 11,
  pointerEvents: "none",
  border: "1px solid rgba(255, 255, 255, 0.16)"
};

const albumLockedCardOverlayStyle = {
  position: "absolute",
  inset: 0,
  background: "rgba(0, 0, 0, 0.38)",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 10,
  pointerEvents: "none"
};

const albumLockCircleStyle = {
  width: "46px",
  height: "46px",
  borderRadius: "50%",
  background: "rgba(0, 0, 0, 0.65)",
  border: "1.5px solid rgba(255, 215, 0, 0.45)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 4px 14px rgba(0, 0, 0, 0.5)"
};

const albumSubscribeBarBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  width: "100%",
  marginTop: "10px",
  padding: "10px 16px",
  borderRadius: "24px",
  background: "#e11d48",
  border: "none",
  color: "#d4d4d8",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
  boxShadow: "0 2px 12px rgba(225, 29, 72, 0.22)",
  transition: "all 0.18s ease"
};

const albumDotsContainerStyle = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  gap: "6px",
  marginTop: "8px"
};

const carouselNavBtnStyle = {
  position: "absolute",
  top: "50%",
  transform: "translateY(-50%)",
  width: "32px",
  height: "32px",
  borderRadius: "50%",
  background: "rgba(0, 0, 0, 0.75)",
  border: "1px solid rgba(255, 255, 255, 0.25)",
  color: "#d4d4d8",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  zIndex: 15,
  boxShadow: "0 2px 8px rgba(0,0,0,0.5)"
};