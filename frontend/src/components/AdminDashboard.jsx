import React, { useState, useEffect, useMemo, useRef } from "react";
import { 
  LayoutDashboard, Users, CreditCard, LogOut, TrendingUp, ShieldCheck, 
  Clock, RefreshCw, UploadCloud, Video, Search, Edit3, Trash2, ChevronUp, ChevronDown, X, AlertTriangle, Menu,
  PlayCircle, Eye, PieChart, Activity, Star, Percent, Sparkles, CheckCircle, Heart, ExternalLink, DollarSign,
  Flag, ShieldAlert, BarChart3, Database, Layers, ArrowUpRight, Check,
  Radio, Music, Calendar, Play, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, ArrowRightLeft
} from "lucide-react";
import AdminUpload from "./AdminUpload"; 
import TwitterVerifiedBadge from "./TwitterVerifiedBadge"; 
import { APP_CONFIG } from "../config";
import { showToast } from "../utils/toast";

export default function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  // Sorting & Pagination
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 25;
  
  // UI Overlays
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null); 
  const [editingCreator, setEditingCreator] = useState(null);
  const [updatingCreatorId, setUpdatingCreatorId] = useState(null);
  const [deleteWarning, setDeleteWarning] = useState(null); 
  const [actioningReportId, setActioningReportId] = useState(null);

  // Analytics & Stats State
  const [statsData, setStatsData] = useState(null);
  const [chartTimeframe, setChartTimeframe] = useState("30"); // "7", "14", "30"
  const [chartMetric, setChartMetric] = useState("signups"); // "signups", "uploads", "stories", "revenue"
  const [selectedCategoryDetail, setSelectedCategoryDetail] = useState(null);

  // Story Intelligence State
  const [storyAnalytics, setStoryAnalytics] = useState(null);
  const [storySubTab, setStorySubTab] = useState("creators"); // "creators" | "catalog" | "feed"
  const [storyFilter, setStoryFilter] = useState("all"); // "all" | "active" | "expired"
  const [storyCreatorFilter, setStoryCreatorFilter] = useState("all");
  const [storySearchTerm, setStorySearchTerm] = useState("");
  const [storiesPage, setStoriesPage] = useState(1);
  const [storiesLimit, setStoriesLimit] = useState(15);
  const [storiesData, setStoriesData] = useState({ stories: [], total: 0, total_pages: 1 });
  const [storiesLoading, setStoriesLoading] = useState(false);
  const [viewersModalData, setViewersModalData] = useState(null); // { type: 'story'|'creator', item, viewers: [], loading: boolean }
  const [storyPreviewModal, setStoryPreviewModal] = useState(null); // story to preview
  const [viewerSearchFilter, setViewerSearchFilter] = useState("");
  const [creatorStorySearch, setCreatorStorySearch] = useState("");
  const [creatorStorySort, setCreatorStorySort] = useState("views_24h"); // "views_24h" | "views_7d" | "views_30d" | "total_views" | "unique_viewers"
  const [creatorStoryPage, setCreatorStoryPage] = useState(1);
  const [creatorStoryLimit, setCreatorStoryLimit] = useState(10);
  const [storyFeedPage, setStoryFeedPage] = useState(1);
  const [storyFeedLimit, setStoryFeedLimit] = useState(10);
  const [viewersModalPage, setViewersModalPage] = useState(1);
  const [viewersModalLimit, setViewersModalLimit] = useState(10);

  // Lists & Server-side Paginated Data
  const [usersData, setUsersData] = useState({ users: [], total: 0, total_pages: 1 });
  const [creatorsList, setCreatorsList] = useState([]);
  const [creatorStats, setCreatorStats] = useState(null);
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [creatorCategoryFilter, setCreatorCategoryFilter] = useState("all");
  const [syncingTelegram, setSyncingTelegram] = useState(false);
  const [syncingSingleCreator, setSyncingSingleCreator] = useState(false);

  const [txData, setTxData] = useState({ transactions: [], total: 0, total_pages: 1 });
  const [txCurrencyFilter, setTxCurrencyFilter] = useState("all"); // "all", "USD", "NGN"
  const [txStatusFilter, setTxStatusFilter] = useState("all");

  const [videosData, setVideosData] = useState({ videos: [], total: 0, total_views: 0, total_pages: 1 });
  const [videoCategoryFilter, setVideoCategoryFilter] = useState("all");
  const [videoSearchTerm, setVideoSearchTerm] = useState("");

  const [reportsList, setReportsList] = useState([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Debounced Global Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setGlobalSearchResults(null);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/search?q=${encodeURIComponent(searchQuery)}`, {
          headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
        });
        if (res.ok) {
          setGlobalSearchResults(await res.json());
        }
      } catch (err) {
        console.error("Global search error:", err);
      } finally {
        setIsSearching(false);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Main Data Fetcher
  const fetchData = async () => {
    if (searchQuery) return;
    setLoading(true);
    setError("");
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem("token")}` };
      const baseUrl = APP_CONFIG.apiUrl;

      if (activeTab === "overview") {
        const res = await fetch(`${baseUrl}/api/admin/stats`, { headers });
        if (!res.ok) throw new Error("Failed to load dashboard statistics");
        const data = await res.json();
        setStatsData(data);
      } else if (activeTab === "stories") {
        setStoriesLoading(true);
        const [analyticsRes, storiesRes] = await Promise.all([
          fetch(`${baseUrl}/api/admin/story-analytics`, { headers }),
          fetch(`${baseUrl}/api/admin/stories?page=${storiesPage}&limit=${storiesLimit}&status=${storyFilter}${storyCreatorFilter !== 'all' ? `&creator=${encodeURIComponent(storyCreatorFilter)}` : ''}${storySearchTerm ? `&search=${encodeURIComponent(storySearchTerm)}` : ''}`, { headers })
        ]);
        if (analyticsRes.ok) {
          setStoryAnalytics(await analyticsRes.json());
        }
        if (storiesRes.ok) {
          setStoriesData(await storiesRes.json());
        }
        setStoriesLoading(false);
      } else if (activeTab === "creators") {
        const res = await fetch(`${baseUrl}/api/admin/creators`, { headers });
        if (res.ok) {
          const data = await res.json();
          setCreatorsList(data.creators || []);
          setCreatorStats(data.stats || null);
        }
      } else if (activeTab === "videos") {
        const catParam = videoCategoryFilter !== "all" ? `&category=${encodeURIComponent(videoCategoryFilter)}` : "";
        const searchParam = videoSearchTerm.trim() ? `&search=${encodeURIComponent(videoSearchTerm.trim())}` : "";
        const res = await fetch(`${baseUrl}/api/admin/all-videos?page=${currentPage}&limit=${ITEMS_PER_PAGE}${catParam}${searchParam}`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setVideosData({ videos: data, total: data.length, total_views: 0, total_pages: 1 });
          } else {
            setVideosData({
              videos: data.videos || [],
              total: data.total || 0,
              total_views: data.total_views || 0,
              total_pages: data.total_pages || 1
            });
          }
        }
      } else if (activeTab === "users") {
        const res = await fetch(`${baseUrl}/api/admin/users?page=${currentPage}&limit=${ITEMS_PER_PAGE}`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setUsersData({ users: data, total: data.length, total_pages: 1 });
          } else {
            setUsersData({
              users: data.users || [],
              total: data.total || 0,
              total_pages: data.total_pages || 1
            });
          }
        }
      } else if (activeTab === "transactions") {
        const currParam = txCurrencyFilter !== "all" ? `&currency=${txCurrencyFilter}` : "";
        const statParam = txStatusFilter !== "all" ? `&status=${txStatusFilter}` : "";
        const res = await fetch(`${baseUrl}/api/admin/transactions?page=${currentPage}&limit=${ITEMS_PER_PAGE}${currParam}${statParam}`, { headers });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) {
            setTxData({ transactions: data, total: data.length, total_pages: 1 });
          } else {
            setTxData({
              transactions: data.transactions || [],
              total: data.total || 0,
              total_pages: data.total_pages || 1
            });
          }
        }
      } else if (activeTab === "moderation") {
        setReportsLoading(true);
        const res = await fetch(`${baseUrl}/api/admin/reports`, { headers });
        if (res.ok) {
          const data = await res.json();
          setReportsList(data.reports || []);
        }
        setReportsLoading(false);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    setSearchQuery(""); 
    setCurrentPage(1);
    fetchData(); 
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "videos" || activeTab === "users" || activeTab === "transactions") {
      fetchData();
    }
  }, [currentPage, videoCategoryFilter, txCurrencyFilter, txStatusFilter]);

  // Story catalog page/filter reload
  const fetchStoriesCatalogOnly = async () => {
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem("token")}` };
      const statusParam = storyFilter !== "all" ? `&status=${storyFilter}` : "";
      const creatorParam = storyCreatorFilter !== "all" ? `&creator=${encodeURIComponent(storyCreatorFilter)}` : "";
      const searchParam = storySearchTerm.trim() ? `&search=${encodeURIComponent(storySearchTerm.trim())}` : "";
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/stories?page=${storiesPage}&limit=${storiesLimit}${statusParam}${creatorParam}${searchParam}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setStoriesData({
          stories: data.stories || [],
          total: data.total || 0,
          total_pages: data.total_pages || 1
        });
      }
    } catch (err) {
      console.error("Failed to load stories catalog:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "stories") {
      fetchStoriesCatalogOnly();
    }
  }, [storiesPage, storiesLimit, storyFilter, storyCreatorFilter]);

  // Viewers Modal Openers
  const handleOpenStoryViewers = async (story) => {
    setViewersModalData({ type: 'story', item: story, viewers: [], loading: true });
    setViewerSearchFilter("");
    setViewersModalPage(1);
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/stories/${story.id}/viewers`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setViewersModalData({ type: 'story', item: data.story || story, viewers: data.viewers || [], loading: false });
      } else {
        showToast("Failed to fetch story viewers", "error");
        setViewersModalData(null);
      }
    } catch (err) {
      showToast("Error loading viewers: " + err.message, "error");
      setViewersModalData(null);
    }
  };

  const handleOpenCreatorStoryViewers = async (creator) => {
    const uname = creator.creator_username || creator.username;
    setViewersModalData({ type: 'creator', item: creator, viewers: [], loading: true });
    setViewerSearchFilter("");
    setViewersModalPage(1);
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/creators/${uname}/story-viewers`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        const data = await res.json();
        setViewersModalData({ type: 'creator', item: creator, viewers: data.viewers || [], loading: false });
      } else {
        showToast("Failed to fetch creator viewers", "error");
        setViewersModalData(null);
      }
    } catch (err) {
      showToast("Error loading creator viewers: " + err.message, "error");
      setViewersModalData(null);
    }
  };

  // Sorting helper
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortData = (data) => {
    if (!sortConfig.key || !Array.isArray(data)) return data;
    return [...data].sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];
      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ChevronDown size={14} color="#71717a" style={{ marginLeft: "4px" }} />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={14} color="#f43f5e" style={{ marginLeft: "4px" }} />
      : <ChevronDown size={14} color="#f43f5e" style={{ marginLeft: "4px" }} />;
  };

  // Creators filtering
  const filteredCreators = useMemo(() => {
    return creatorsList.filter(c => {
      if (creatorFilter === "verified" && !c.is_verified) return false;
      if (creatorFilter === "unverified" && c.is_verified) return false;
      if (creatorFilter === "paid" && Number(c.subscription_price || 0) === 0) return false;
      if (creatorFilter === "free" && Number(c.subscription_price || 0) > 0) return false;
      if (creatorFilter === "telegram" && !c.is_managed) return false;
      if (creatorFilter === "web" && c.is_managed) return false;
      if (creatorCategoryFilter !== "all" && c.creator_category !== creatorCategoryFilter) return false;
      return true;
    });
  }, [creatorsList, creatorFilter, creatorCategoryFilter]);

  const processedCreators = useMemo(() => sortData(filteredCreators), [filteredCreators, sortConfig]);
  const paginatedCreators = processedCreators.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalCreatorPages = Math.max(1, Math.ceil(processedCreators.length / ITEMS_PER_PAGE));

  const creatorAnalytics = useMemo(() => {
    const total = creatorStats?.total_creators || creatorsList.length;
    const verified = creatorStats?.verified_creators || creatorsList.filter(c => c.is_verified).length;
    const managed = creatorStats?.managed_creators ?? creatorsList.filter(c => c.is_managed).length;
    const totalSubs = creatorStats?.total_active_subscriptions || creatorsList.reduce((sum, c) => sum + (Number(c.subscribers_count) || 0), 0);
    const totalSubRev = (creatorStats?.total_sub_revenue_usd || creatorsList.reduce((sum, c) => sum + (Number(c.subscription_revenue_usd) || 0), 0)).toFixed(2);
    const totalTips = creatorStats?.total_tips_ngn || creatorsList.reduce((sum, c) => sum + (Number(c.tips_total) || 0), 0);
    return { total, verified, managed, totalSubs, totalSubRev, totalTips };
  }, [creatorsList, creatorStats]);

  // Sorted & Filtered Story Creators
  const filteredStoryCreators = useMemo(() => {
    if (!storyAnalytics?.creators) return [];
    let list = storyAnalytics.creators.filter(c => {
      if (!creatorStorySearch.trim()) return true;
      const q = creatorStorySearch.toLowerCase();
      return (c.creator_username || "").toLowerCase().includes(q) || (c.display_name || "").toLowerCase().includes(q) || (c.creator_category || "").toLowerCase().includes(q);
    });

    return list.sort((a, b) => {
      if (creatorStorySort === "views_24h") return (b.views_24h || 0) - (a.views_24h || 0);
      if (creatorStorySort === "views_7d") return (b.views_7d || 0) - (a.views_7d || 0);
      if (creatorStorySort === "views_30d") return (b.views_30d || 0) - (a.views_30d || 0);
      if (creatorStorySort === "total_views") return (b.total_views || 0) - (a.total_views || 0);
      if (creatorStorySort === "unique_viewers") return (b.unique_viewers || 0) - (a.unique_viewers || 0);
      if (creatorStorySort === "active_stories") return (b.active_stories || 0) - (a.active_stories || 0);
      return 0;
    });
  }, [storyAnalytics, creatorStorySearch, creatorStorySort]);

  // Story Creators Pagination
  const totalCreatorStoryPages = Math.max(1, Math.ceil(filteredStoryCreators.length / creatorStoryLimit));
  const paginatedStoryCreators = useMemo(() => {
    const start = (creatorStoryPage - 1) * creatorStoryLimit;
    return filteredStoryCreators.slice(start, start + creatorStoryLimit);
  }, [filteredStoryCreators, creatorStoryPage, creatorStoryLimit]);

  useEffect(() => {
    setCreatorStoryPage(1);
  }, [creatorStorySearch, creatorStorySort, creatorStoryLimit]);

  // Story Feed Pagination
  const recentStoryViews = storyAnalytics?.recent_views || [];
  const totalFeedPages = Math.max(1, Math.ceil(recentStoryViews.length / storyFeedLimit));
  const paginatedRecentViews = useMemo(() => {
    const start = (storyFeedPage - 1) * storyFeedLimit;
    return recentStoryViews.slice(start, start + storyFeedLimit);
  }, [recentStoryViews, storyFeedPage, storyFeedLimit]);

  // Viewers Modal Pagination & Filtering
  const filteredModalViewers = useMemo(() => {
    if (!viewersModalData?.viewers) return [];
    if (!viewerSearchFilter.trim()) return viewersModalData.viewers;
    const q = viewerSearchFilter.toLowerCase();
    return viewersModalData.viewers.filter(v => 
      (v.username || "").toLowerCase().includes(q) ||
      (v.display_name || "").toLowerCase().includes(q) ||
      (v.email || "").toLowerCase().includes(q)
    );
  }, [viewersModalData, viewerSearchFilter]);

  const totalModalViewersPages = Math.max(1, Math.ceil(filteredModalViewers.length / viewersModalLimit));
  const paginatedModalViewers = useMemo(() => {
    const start = (viewersModalPage - 1) * viewersModalLimit;
    return filteredModalViewers.slice(start, start + viewersModalLimit);
  }, [filteredModalViewers, viewersModalPage, viewersModalLimit]);

  useEffect(() => {
    setViewersModalPage(1);
  }, [viewerSearchFilter, viewersModalLimit]);

  // Smooth Horizontal Scrolling Support on Tables (Shift + Wheel)
  const handleTableWheel = (e) => {
    // Only scroll table horizontally if user explicitly holds Shift
    if (e.shiftKey && Math.abs(e.deltaY) > 0) {
      e.currentTarget.scrollLeft += e.deltaY;
      e.preventDefault();
    }
    // Never hijack standard vertical wheel (e.deltaY) so the dashboard page can scroll freely and smoothly!
  };

  const scrollTable = (containerId, direction) => {
    const el = document.getElementById(containerId);
    if (el) {
      el.scrollBy({ left: direction === 'left' ? -350 : 350, behavior: 'smooth' });
    }
  };

  const renderTableScrollControls = (tableContainerId, totalCols = 10) => (
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <span style={{ fontSize: "11px", color: "#71717a", fontWeight: "600", display: "inline-flex", alignItems: "center", gap: "4px" }}>
        <ArrowRightLeft size={12} color="#71717a" />
        <span className="hide-on-mobile">{totalCols} cols • Scroll</span>
      </span>
      <button
        type="button"
        onClick={() => scrollTable(tableContainerId, 'left')}
        style={tableNavBtnStyle}
        title="Scroll table left"
      >
        <ChevronLeft size={14} />
      </button>
      <button
        type="button"
        onClick={() => scrollTable(tableContainerId, 'right')}
        style={tableNavBtnStyle}
        title="Scroll table right"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );

  // Executive Reusable Pagination Component
  const renderPagination = ({
    currentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    onPageChange,
    onLimitChange,
    limitOptions = [10, 20, 50],
    itemLabel = "items"
  }) => {
    if (totalItems === 0) return null;

    const startItem = Math.min((currentPage - 1) * itemsPerPage + 1, totalItems);
    const endItem = Math.min(currentPage * itemsPerPage, totalItems);

    const getPageNumbers = () => {
      if (totalPages <= 5) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
      }
      if (currentPage <= 3) {
        return [1, 2, 3, 4, '...', totalPages];
      }
      if (currentPage >= totalPages - 2) {
        return [1, '...', totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
      }
      return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
    };

    const pageNumbers = getPageNumbers();

    return (
      <div style={paginationStyle}>
        {/* Left: Range text & Limit selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
          <span style={pageTextStyle}>
            Showing <strong style={{ color: "#f4f4f5" }}>{startItem.toLocaleString()}</strong> to <strong style={{ color: "#f4f4f5" }}>{endItem.toLocaleString()}</strong> of <strong style={{ color: "#f4f4f5" }}>{totalItems.toLocaleString()}</strong> {itemLabel}
          </span>

          {onLimitChange && (
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ fontSize: "11px", color: "#71717a" }}>Per page:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  onLimitChange(Number(e.target.value));
                  onPageChange(1);
                }}
                style={{
                  background: "#27272a",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: "6px",
                  color: "#f4f4f5",
                  padding: "3px 8px",
                  fontSize: "11px",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                {limitOptions.map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <button
            disabled={currentPage === 1}
            onClick={() => onPageChange(1)}
            style={currentPage === 1 ? pageBtnDisabledStyle : pageBtnStyle}
            title="First page"
          >
            <ChevronsLeft size={13} />
          </button>
          <button
            disabled={currentPage === 1}
            onClick={() => onPageChange(currentPage - 1)}
            style={currentPage === 1 ? pageBtnDisabledStyle : pageBtnStyle}
            title="Previous page"
          >
            <ChevronLeft size={13} />
          </button>

          {pageNumbers.map((p, idx) => (
            p === '...' ? (
              <span key={`ellipsis-${idx}`} style={{ color: "#71717a", padding: "0 4px", fontSize: "12px" }}>…</span>
            ) : (
              <button
                key={`page-${p}`}
                onClick={() => onPageChange(p)}
                style={{
                  ...pageBtnStyle,
                  background: currentPage === p ? "#f43f5e" : "#27272a",
                  color: currentPage === p ? "#d4d4d8" : "#a1a1aa",
                  fontWeight: currentPage === p ? "700" : "500",
                  padding: "4px 10px",
                  minWidth: "28px"
                }}
              >
                {p}
              </button>
            )
          ))}

          <button
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(currentPage + 1)}
            style={currentPage >= totalPages ? pageBtnDisabledStyle : pageBtnStyle}
            title="Next page"
          >
            <ChevronRight size={13} />
          </button>
          <button
            disabled={currentPage >= totalPages}
            onClick={() => onPageChange(totalPages)}
            style={currentPage >= totalPages ? pageBtnDisabledStyle : pageBtnStyle}
            title="Last page"
          >
            <ChevronsRight size={13} />
          </button>
        </div>
      </div>
    );
  };

  // Creator Actions
  const handleToggleVerify = async (creator) => {
    const nextState = !creator.is_verified;
    setUpdatingCreatorId(creator.id);
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/creator/${creator.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ is_verified: nextState })
      });
      const data = await res.json();
      if (data.success) {
        setCreatorsList(prev => prev.map(c => c.id === creator.id ? { ...c, is_verified: nextState } : c));
        showToast(`Creator verification updated`, "success");
      }
    } catch (err) {
      showToast("Failed to update verification", "error");
    } finally {
      setUpdatingCreatorId(null);
    }
  };

  const handleToggleCreatorStatus = async (creator) => {
    const nextState = !creator.is_creator;
    setUpdatingCreatorId(creator.id);
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/creator/${creator.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ is_creator: nextState })
      });
      const data = await res.json();
      if (data.success) {
        setCreatorsList(prev => prev.map(c => c.id === creator.id ? { ...c, is_creator: nextState } : c));
        showToast(`Creator status updated`, "success");
      }
    } catch (err) {
      showToast("Failed to update creator status", "error");
    } finally {
      setUpdatingCreatorId(null);
    }
  };

  const handleSaveCreatorEdit = async (e) => {
    e.preventDefault();
    if (!editingCreator) return;
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/creator/${editingCreator.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({
          display_name: editingCreator.display_name,
          username: editingCreator.username,
          source_channel: editingCreator.source_channel,
          telegram_user_id: editingCreator.telegram_user_id,
          creator_category: editingCreator.creator_category,
          subscription_price: Number(editingCreator.subscription_price),
          creator_bio: editingCreator.creator_bio,
          is_verified: editingCreator.is_verified,
          is_creator: editingCreator.is_creator,
          is_managed: editingCreator.is_managed,
          avatar_url: editingCreator.avatar_url,
          banner_url: editingCreator.banner_url
        })
      });
      const data = await res.json();
      if (data.success) {
        setCreatorsList(prev => prev.map(c => c.id === editingCreator.id ? { ...c, ...data.creator } : c));
        setEditingCreator(null);
        showToast("Creator updated successfully!", "success");
      } else {
        showToast(data.error || "Failed to update creator", "error");
      }
    } catch (err) {
      showToast("Failed to update creator: " + err.message, "error");
    }
  };

  const handleFetchTelegramProfile = async () => {
    if (!editingCreator || !editingCreator.id) return;
    const channelInput = (editingCreator.source_channel || "").trim();
    if (!channelInput && !editingCreator.telegram_user_id) {
      showToast("Please enter a Telegram channel handle first.", "error");
      return;
    }

    setSyncingSingleCreator(true);
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/creator/${editingCreator.id}/sync-telegram`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ source_channel: channelInput })
      });
      const data = await res.json();
      if (data.success && data.creator) {
        setEditingCreator(prev => ({ ...prev, ...data.creator }));
        setCreatorsList(prev => prev.map(c => c.id === editingCreator.id ? { ...c, ...data.creator } : c));
        showToast("Fetched creator profile from Telegram!", "success");
      } else {
        showToast(data.error || "Failed to fetch from Telegram", "error");
      }
    } catch (err) {
      showToast("Error syncing from Telegram: " + err.message, "error");
    } finally {
      setSyncingSingleCreator(false);
    }
  };

  const handleSyncTelegramCreators = async () => {
    setSyncingTelegram(true);
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/creators/sync-telegram`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Successfully synced ${data.count} Telegram creator(s)!`, "success");
        fetchData();
      } else {
        showToast(data.error || "Failed to sync Telegram creators", "error");
      }
    } catch (err) {
      showToast("Failed to sync Telegram creators: " + err.message, "error");
    } finally {
      setSyncingTelegram(false);
    }
  };

  // Video / User Edit & Delete Handlers
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = editingItem.type === 'video' ? `/api/admin/video/${editingItem.data.id}` : `/api/admin/user/${editingItem.data.id}`;
      const payload = editingItem.type === 'video' 
        ? { caption: editingItem.data.caption, category: editingItem.data.category }
        : { role: editingItem.data.role, is_premium: editingItem.data.is_premium, is_banned: editingItem.data.is_banned, ban_reason: editingItem.data.ban_reason };

      const res = await fetch(`${APP_CONFIG.apiUrl}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        if (editingItem.type === 'video') {
          setVideosData(prev => ({
            ...prev,
            videos: prev.videos.map(v => v.id === editingItem.data.id ? { ...v, ...editingItem.data } : v)
          }));
        } else {
          setUsersData(prev => ({
            ...prev,
            users: prev.users.map(u => u.id === editingItem.data.id ? { ...u, ...editingItem.data } : u)
          }));
        }
        setEditingItem(null);
        showToast("Changes saved successfully!", "success");
      } else {
        showToast("Failed to save changes.", "error");
      }
    } catch (err) { 
      showToast("Error saving changes.", "error"); 
    }
  };

  const handleDelete = async () => {
    try {
      const endpoint = deleteWarning.type === 'video' ? `/api/admin/video/${deleteWarning.id}` : `/api/admin/user/${deleteWarning.id}`;
      const res = await fetch(`${APP_CONFIG.apiUrl}${endpoint}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
      });

      if (res.ok) {
        if (deleteWarning.type === 'video') {
          setVideosData(prev => ({
            ...prev,
            videos: prev.videos.filter(v => v.id !== deleteWarning.id),
            total: Math.max(0, prev.total - 1)
          }));
        } else {
          setUsersData(prev => ({
            ...prev,
            users: prev.users.filter(u => u.id !== deleteWarning.id),
            total: Math.max(0, prev.total - 1)
          }));
        }
        setDeleteWarning(null);
        showToast("Item deleted successfully!", "info");
      } else {
        showToast("Failed to delete item.", "error");
      }
    } catch (err) { 
      showToast("Error deleting item.", "error"); 
    }
  };

  // Moderation Actions
  const handleDismissReport = async (reportId) => {
    setActioningReportId(reportId);
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/reports/${reportId}/dismiss`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        setReportsList(prev => prev.filter(r => r.id !== reportId));
        showToast("Report dismissed.", "info");
      }
    } catch (err) {
      showToast("Failed to dismiss report", "error");
    } finally {
      setActioningReportId(null);
    }
  };

  const handleDeleteReportedVideo = async (reportId) => {
    setActioningReportId(reportId);
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/reports/${reportId}/delete-video`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        setReportsList(prev => prev.filter(r => r.id !== reportId));
        showToast("Video deleted and report resolved.", "success");
      }
    } catch (err) {
      showToast("Failed to delete video", "error");
    } finally {
      setActioningReportId(null);
    }
  };

  const handleBanCreatorReport = async (reportId) => {
    setActioningReportId(reportId);
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/reports/${reportId}/ban-creator`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      if (res.ok) {
        setReportsList(prev => prev.filter(r => r.id !== reportId));
        showToast("Creator banned and video removed.", "success");
      }
    } catch (err) {
      showToast("Failed to ban creator", "error");
    } finally {
      setActioningReportId(null);
    }
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false); 
  };

  if (!user || user.role !== 'admin') {
    return (
      <div style={errorScreenStyle}>
        <ShieldCheck size={56} color="#f43f5e" style={{ marginBottom: "18px" }} />
        <h2 style={{ margin: "0 0 8px 0", color: "#f4f4f5", fontSize: "24px", fontWeight: "800" }}>Access Denied</h2>
        <p style={{ color: "#a1a1aa", marginBottom: "26px", fontSize: "14px" }}>You need administrator privileges to view this portal.</p>
        <button onClick={onLogout} style={goBackBtnStyle}>Return to Home</button>
      </div>
    );
  }

  if (showUploadModal) return <AdminUpload onClose={() => setShowUploadModal(false)} />;

  const overview = statsData?.overview || {};
  const financials = statsData?.financials || {};
  const categories = statsData?.categories || [];
  const storage = statsData?.storage || {};
  const timeSeries = statsData?.time_series || [];
  const topCreators = statsData?.top_creators || [];

  return (
    <div style={dashboardContainerStyle} className="admin-dashboard-root">
      <style>{`
        .admin-dashboard-root {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100vw !important;
          height: 100% !important;
          height: 100dvh !important;
          max-height: 100dvh !important;
          overflow: hidden !important;
          z-index: 999999 !important;
          touch-action: pan-y !important;
        }

        .admin-main-content {
          flex: 1 1 0% !important;
          display: flex !important;
          flex-direction: column !important;
          height: 100% !important;
          max-height: 100% !important;
          min-height: 0 !important;
          min-width: 0 !important;
          width: 100% !important;
          position: relative !important;
          overflow: hidden !important;
        }

        .content-area {
          flex: 1 1 0% !important;
          height: 100% !important;
          max-height: 100% !important;
          min-height: 0 !important;
          min-width: 0 !important;
          width: 100% !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          -webkit-overflow-scrolling: touch !important;
          touch-action: pan-y !important;
          overscroll-behavior-y: contain !important;
        }

        .hamburger-btn, .mobile-close-btn { display: none; background: transparent; border: none; color: #f4f4f5; cursor: pointer; padding: 0; }
        .mobile-overlay { display: none; pointer-events: none; }
        
        /* Custom visible horizontal & vertical scrollbars for Admin Dashboard */
        .admin-dashboard-root ::-webkit-scrollbar {
          display: block !important;
          width: 8px !important;
          height: 10px !important;
        }

        .admin-dashboard-root ::-webkit-scrollbar-track {
          background: #18181b !important;
          border-radius: 6px !important;
        }

        .admin-dashboard-root ::-webkit-scrollbar-thumb {
          background: #3f3f46 !important;
          border-radius: 6px !important;
          border: 2px solid #18181b !important;
        }

        .admin-dashboard-root ::-webkit-scrollbar-thumb:hover {
          background: #71717a !important;
        }

        .admin-table-scroll {
          overflow-x: auto !important;
          overflow-y: visible !important;
          width: 100% !important;
          scrollbar-width: thin !important;
          scrollbar-color: #52525b #121214 !important;
          touch-action: pan-x pan-y !important;
        }

        .admin-table-scroll::-webkit-scrollbar {
          display: block !important;
          height: 11px !important;
        }

        .admin-table-scroll::-webkit-scrollbar-track {
          background: #121214 !important;
          border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
          border-radius: 0 0 14px 14px !important;
        }

        .admin-table-scroll::-webkit-scrollbar-thumb {
          background: #52525b !important;
          border-radius: 6px !important;
          border: 2px solid #121214 !important;
        }

        .admin-table-scroll::-webkit-scrollbar-thumb:hover {
          background: #a1a1aa !important;
        }

        @media (max-width: 900px) {
          .admin-sidebar { position: fixed !important; left: -100%; transition: left 0.28s cubic-bezier(0.4, 0, 0.2, 1); z-index: 999999; height: 100dvh; box-shadow: 10px 0 40px rgba(0,0,0,0.8); }
          .admin-sidebar.open { left: 0; }
          .hamburger-btn { display: block; }
          .mobile-close-btn { display: block; }
          .mobile-overlay.open { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.75); backdrop-filter: blur(5px); z-index: 999998; pointer-events: auto; }
          .top-bar-container { flex-direction: column !important; align-items: flex-start !important; gap: 14px; padding: 18px 20px !important; }
          .header-title-group { width: 100%; }
          .search-container { width: 100% !important; margin-top: 8px; }
          .top-bar-actions { width: 100%; display: flex; gap: 10px; }
          .top-bar-actions button { flex: 1; justify-content: center; }
          .content-area { padding: 20px !important; }
          .hide-on-mobile { display: none; }
        }
      `}</style>

      {/* Mobile Drawer Overlay */}
      <div className={`mobile-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* Executive Sidebar */}
      <div className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`} style={sidebarStyle}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: "24px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div>
              <div style={logoStyle}>
                {APP_CONFIG.appNamePrefix || "NAIJA"}
                <span style={{ color: "#f43f5e", marginLeft: "2px" }}>ADMIN</span>
              </div>
              <div style={{ fontSize: "11px", color: "#71717a", fontWeight: "600", marginTop: "2px", letterSpacing: "0.5px" }}>COMMAND CENTER</div>
            </div>
            <button className="mobile-close-btn" onClick={() => setSidebarOpen(false)}><X size={22} /></button>
          </div>
          
          <div style={{ marginTop: "24px", display: "flex", flexDirection: "column", gap: "6px" }}>
            <SidebarBtn active={activeTab === "overview" && !searchQuery} onClick={() => handleTabSwitch("overview")} icon={<LayoutDashboard size={18} />} label="Overview & Charts" />
            <SidebarBtn 
              active={activeTab === "stories" && !searchQuery} 
              onClick={() => handleTabSwitch("stories")} 
              icon={<Radio size={18} />} 
              label="Story Intelligence" 
              badge={overview.active_stories > 0 ? `${overview.active_stories} Live` : null} 
            />
            <SidebarBtn active={activeTab === "creators" && !searchQuery} onClick={() => handleTabSwitch("creators")} icon={<Sparkles size={18} />} label="Creators & Funnels" />
            <SidebarBtn active={activeTab === "videos" && !searchQuery} onClick={() => handleTabSwitch("videos")} icon={<Video size={18} />} label="Content Library" count={overview.total_videos} />
            <SidebarBtn active={activeTab === "users" && !searchQuery} onClick={() => handleTabSwitch("users")} icon={<Users size={18} />} label="User Accounts" count={overview.total_users} />
            <SidebarBtn active={activeTab === "transactions" && !searchQuery} onClick={() => handleTabSwitch("transactions")} icon={<CreditCard size={18} />} label="Financials & Orders" />
            <SidebarBtn 
              active={activeTab === "moderation" && !searchQuery} 
              onClick={() => handleTabSwitch("moderation")} 
              icon={<Flag size={18} />} 
              label="Moderation Queue" 
              badge={overview.pending_reports > 0 ? overview.pending_reports : null} 
            />
          </div>
        </div>

        <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "18px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px", padding: "0 4px" }}>
            <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: "#27272a", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "700", color: "#f43f5e", fontSize: "13px" }}>
              {user.username ? user.username.charAt(0).toUpperCase() : "A"}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#f4f4f5", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                @{user.username}
              </div>
              <div style={{ fontSize: "11px", color: "#71717a" }}>System Administrator</div>
            </div>
          </div>
          <button onClick={onLogout} style={logoutBtnStyle}><LogOut size={16} /> Exit Admin</button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="admin-main-content" style={mainContentStyle}>
        {/* Top Action Bar */}
        <div className="top-bar-container" style={topBarStyle}>
          <div className="header-title-group" style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap", flex: 1 }}>
            <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={24} />
            </button>
            <div>
              <h1 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#f4f4f5", letterSpacing: "-0.5px", textTransform: "capitalize" }}>
                {searchQuery ? "Global Database Search" : activeTab === "overview" ? "Executive Dashboard" : activeTab === "stories" ? "Story Views & Status Intelligence" : activeTab}
              </h1>
            </div>
            
            {/* Global Search Bar */}
            <div className="search-container" style={searchBarStyle}>
              <Search size={15} color="#71717a" />
              <input 
                type="text" 
                placeholder="Search entire database (users, videos, creators)..." 
                value={searchQuery} 
                onChange={(e) => setSearchQuery(e.target.value)} 
                style={searchInputStyle} 
              />
              {searchQuery && <X size={14} color="#71717a" style={{ cursor: "pointer" }} onClick={() => setSearchQuery("")} />}
            </div>
          </div>
          
          <div className="top-bar-actions" style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => setShowUploadModal(true)} style={uploadBtnStyle}>
              <UploadCloud size={16} /> <span className="hide-on-mobile">Direct Ingest</span>
            </button>
            <button onClick={fetchData} style={refreshBtnStyle} disabled={loading || !!searchQuery}>
              <RefreshCw size={15} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> 
              <span className="hide-on-mobile">Sync</span>
            </button>
          </div>
        </div>

        {/* Content Viewport */}
        <div className="content-area" style={contentAreaStyle}>
          {/* Global Search Results Override */}
          {searchQuery.trim() ? (
            isSearching ? (
              <div style={centerFlex}><RefreshCw size={36} color="#f43f5e" style={{ animation: "spin 1s linear infinite" }} /></div>
            ) : globalSearchResults ? (
              <div>
                <div style={{ color: "#a1a1aa", fontSize: "14px", marginBottom: "20px" }}>
                  Search results for <strong>"{searchQuery}"</strong>
                </div>

                {/* Users Found */}
                <h3 style={{ color: "#f4f4f5", fontSize: "15px", fontWeight: "700", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Users size={16} color="#a1a1aa" /> Users ({globalSearchResults.users?.length || 0})
                </h3>
                {globalSearchResults.users?.length > 0 && (
                  <div style={{ ...tableContainerStyle, marginBottom: "30px" }}>
                    <div className="admin-table-scroll" onWheel={handleTableWheel} style={{ overflowX: "auto", width: "100%", WebkitOverflowScrolling: "touch" }}>
                      <table style={{ ...tableStyle, minWidth: "850px" }}>
                        <thead>
                          <tr>
                            <th style={thStyle}>Username</th>
                            <th style={thStyle}>Email</th>
                            <th style={thStyle}>Tier</th>
                            <th style={thStyle}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {globalSearchResults.users.map(u => (
                            <tr key={u.id} style={trStyle}>
                              <td style={{ ...tdStyle, fontWeight: "600" }}>{u.username}</td>
                              <td style={{ ...tdStyle, color: "#a1a1aa" }}>{u.email}</td>
                              <td style={tdStyle}>{u.is_premium ? <span style={premiumBadge}>Premium</span> : <span style={freeBadge}>Free</span>}</td>
                              <td style={tdStyle}>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button onClick={() => setEditingItem({ type: 'user', data: u })} style={iconBtnStyle} title="Edit User"><Edit3 size={15} /></button>
                                  <button onClick={() => setDeleteWarning({ type: 'user', id: u.id, name: u.username })} style={{ ...iconBtnStyle, color: "#f43f5e" }} title="Delete"><Trash2 size={15} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Videos Found */}
                <h3 style={{ color: "#f4f4f5", fontSize: "15px", fontWeight: "700", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <Video size={16} color="#a1a1aa" /> Videos ({globalSearchResults.videos?.length || 0})
                </h3>
                {globalSearchResults.videos?.length > 0 && (
                  <div style={{ ...tableContainerStyle, marginBottom: "30px" }}>
                    <div className="admin-table-scroll" onWheel={handleTableWheel} style={{ overflowX: "auto", width: "100%", WebkitOverflowScrolling: "touch" }}>
                      <table style={{ ...tableStyle, minWidth: "850px" }}>
                        <thead>
                          <tr>
                            <th style={thStyle}>Preview</th>
                            <th style={thStyle}>Caption</th>
                            <th style={thStyle}>Category</th>
                            <th style={thStyle}>Views</th>
                            <th style={thStyle}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {globalSearchResults.videos.map(v => (
                            <tr key={v.id} style={trStyle}>
                              <td style={tdStyle}>
                                <img src={v.thumbnail_url || '/assets/default-avatar.png'} alt="" style={{ width: "42px", height: "42px", objectFit: "cover", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.08)" }} />
                              </td>
                              <td style={{ ...tdStyle, fontWeight: "600", maxWidth: "300px" }}>{v.caption || "Untitled"}</td>
                              <td style={{ ...tdStyle, textTransform: "capitalize" }}>{v.category}</td>
                              <td style={tdStyle}>{(v.views || 0).toLocaleString()}</td>
                              <td style={tdStyle}>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button onClick={() => setEditingItem({ type: 'video', data: v })} style={iconBtnStyle} title="Edit"><Edit3 size={15} /></button>
                                  <button onClick={() => setDeleteWarning({ type: 'video', id: v.id, name: v.caption })} style={{ ...iconBtnStyle, color: "#f43f5e" }} title="Delete"><Trash2 size={15} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Creators Found */}
                {globalSearchResults.creators?.length > 0 && (
                  <>
                    <h3 style={{ color: "#f4f4f5", fontSize: "15px", fontWeight: "700", marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Sparkles size={16} color="#a1a1aa" /> Creators ({globalSearchResults.creators.length})
                    </h3>
                    <div style={{ ...tableContainerStyle, marginBottom: "30px" }}>
                      <div className="admin-table-scroll" onWheel={handleTableWheel} style={{ overflowX: "auto", width: "100%", WebkitOverflowScrolling: "touch" }}>
                        <table style={{ ...tableStyle, minWidth: "850px" }}>
                          <thead>
                            <tr>
                              <th style={thStyle}>Creator</th>
                              <th style={thStyle}>Category</th>
                              <th style={thStyle}>Monthly Rate</th>
                              <th style={thStyle}>Verified</th>
                              <th style={thStyle}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {globalSearchResults.creators.map(c => (
                              <tr key={c.id} style={trStyle}>
                                <td style={tdStyle}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <img src={c.avatar_url || '/assets/default-avatar.png'} alt="" style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,0.08)" }} />
                                    <div>
                                      <div style={{ fontWeight: "700", color: "#f4f4f5", fontSize: "13px" }}>{c.display_name || c.username}</div>
                                      <div style={{ fontSize: "11px", color: "#71717a" }}>@{c.username}</div>
                                    </div>
                                  </div>
                                </td>
                                <td style={tdStyle}>{c.creator_category || "Creator"}</td>
                                <td style={{ ...tdStyle, color: "#f43f5e", fontWeight: "700" }}>
                                  {Number(c.subscription_price) > 0 ? `$${Number(c.subscription_price).toLocaleString()}/mo` : "Free"}
                                </td>
                                <td style={tdStyle}>
                                  {c.is_verified ? <TwitterVerifiedBadge size={14} /> : <span style={{ color: "#71717a", fontSize: "12px" }}>No</span>}
                                </td>
                                <td style={tdStyle}>
                                  <button onClick={() => window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: c.username }))} style={{ ...iconBtnStyle, color: "#38bdf8" }}>
                                    <ExternalLink size={15} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : <div style={centerFlex}><p style={{ color: "#71717a" }}>No results found.</p></div>
          ) : loading && !statsData && !storyAnalytics ? (
            <div style={centerFlex}><RefreshCw size={36} color="#f43f5e" style={{ animation: "spin 1s linear infinite" }} /></div>
          ) : (
            <>
              {/* 🟢 OVERVIEW TAB: EXECUTIVE INTELLIGENCE & INTERACTIVE CHARTS */}
              {activeTab === "overview" && statsData && (
                <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
                  
                  {/* Row 1: Primary Executive KPIs */}
                  <div style={gridStatsStyle}>
                    <StatCard 
                      title="Total Catalog Videos" 
                      value={(overview.total_videos || 0).toLocaleString()} 
                      subtitle={`${(overview.total_views || 0).toLocaleString()} catalog views`}
                      icon={<Video size={20} color="#f43f5e" />} 
                      bg="rgba(225, 29, 72, 0.12)" 
                    />
                    <StatCard 
                      title="Registered User Base" 
                      value={(overview.total_users || 0).toLocaleString()} 
                      subtitle={`${overview.premium_users || 0} active premium VIPs`}
                      icon={<Users size={20} color="#38bdf8" />} 
                      bg="rgba(56, 189, 248, 0.12)" 
                    />
                    <StatCard 
                      title="Approved USD Crypto" 
                      value={`$${(financials.approved_usd || 0).toFixed(2)}`} 
                      subtitle={`${financials.approved_usd_count || 0} orders • $${(financials.pending_crypto_usd || 0).toLocaleString()} pending`}
                      icon={<TrendingUp size={20} color="#34d399" />} 
                      bg="rgba(52, 211, 153, 0.12)" 
                    />
                    <StatCard 
                      title="Approved NGN Bank" 
                      value={`₦${(financials.approved_ngn || 0).toLocaleString()}`} 
                      subtitle={`${financials.approved_ngn_count || 0} transfers • ₦${(financials.pending_bank_ngn || 0).toLocaleString()} pending`}
                      icon={<CreditCard size={20} color="#fbbf24" />} 
                      bg="rgba(251, 191, 36, 0.12)" 
                    />
                  </div>

                  {/* Row 2: Interactive Platform Growth Chart */}
                  <div style={cardContainerStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px", flexWrap: "wrap", gap: "12px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <BarChart3 size={18} color="#f43f5e" />
                          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#f4f4f5" }}>
                            Platform Trajectory & Growth Curves
                          </h2>
                        </div>
                        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#71717a" }}>
                          Continuous rolling time-series telemetry across key operational vectors.
                        </p>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                        {/* Metric Selector */}
                        <div style={{ display: "flex", background: "#27272a", borderRadius: "8px", padding: "3px", border: "1px solid rgba(255,255,255,0.06)" }}>
                          {[
                            { id: "signups", label: "Signups", color: "#f43f5e" },
                            { id: "uploads", label: "Uploads", color: "#38bdf8" },
                            { id: "stories", label: "24h Stories", color: "#34d399" },
                            { id: "revenue", label: "USD Revenue", color: "#fbbf24" }
                          ].map(m => (
                            <button
                              key={m.id}
                              onClick={() => setChartMetric(m.id)}
                              style={{
                                border: "none",
                                background: chartMetric === m.id ? m.color : "transparent",
                                color: chartMetric === m.id ? (m.id === "revenue" ? "#09090b" : "#d4d4d8") : "#a1a1aa",
                                padding: "5px 12px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: "700",
                                cursor: "pointer",
                                transition: "all 0.15s ease"
                              }}
                            >
                              {m.label}
                            </button>
                          ))}
                        </div>

                        {/* Timeframe Selector */}
                        <div style={{ display: "flex", background: "#27272a", borderRadius: "8px", padding: "3px", border: "1px solid rgba(255,255,255,0.06)" }}>
                          {[
                            { id: "7", label: "7D" },
                            { id: "14", label: "14D" },
                            { id: "30", label: "30D" }
                          ].map(tf => (
                            <button
                              key={tf.id}
                              onClick={() => setChartTimeframe(tf.id)}
                              style={{
                                border: "none",
                                background: chartTimeframe === tf.id ? "rgba(255,255,255,0.12)" : "transparent",
                                color: chartTimeframe === tf.id ? "#f4f4f5" : "#71717a",
                                padding: "5px 10px",
                                borderRadius: "6px",
                                fontSize: "11px",
                                fontWeight: "700",
                                cursor: "pointer"
                              }}
                            >
                              {tf.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* SVG Interactive Chart Component */}
                    <InteractiveTimeSeriesChart 
                      data={timeSeries.slice(-parseInt(chartTimeframe))} 
                      metric={chartMetric} 
                    />
                  </div>

                  {/* Row 3: Category Distribution & Storage Architecture */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
                    
                    {/* Category Breakdown */}
                    <div style={cardContainerStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <PieChart size={18} color="#38bdf8" />
                          <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#f4f4f5" }}>
                            Content Category Distribution
                          </h3>
                        </div>
                        <span style={{ fontSize: "12px", color: "#71717a" }}>{(overview.total_videos || 0).toLocaleString()} Videos</span>
                      </div>

                      {/* Stacked Proportional Bar */}
                      <CategoryDistributionBar 
                        categories={categories} 
                        totalVideos={overview.total_videos || 1} 
                        onSelectCategory={(cat) => setSelectedCategoryDetail(cat)}
                        selectedCategory={selectedCategoryDetail}
                      />

                      {/* Category Grid Pills */}
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "8px", marginTop: "16px" }}>
                        {categories.slice(0, 8).map(c => {
                          const pct = (((c.count || 0) / (overview.total_videos || 1)) * 100).toFixed(1);
                          return (
                            <div 
                              key={c.category}
                              onClick={() => {
                                setVideoCategoryFilter(c.category);
                                setActiveTab("videos");
                              }}
                              style={{
                                background: "#27272a",
                                border: "1px solid rgba(255,255,255,0.06)",
                                borderRadius: "8px",
                                padding: "8px 10px",
                                cursor: "pointer",
                                transition: "border-color 0.15s"
                              }}
                              title="Click to view videos in this category"
                            >
                              <div style={{ fontSize: "12px", fontWeight: "700", color: "#f4f4f5", textTransform: "capitalize", display: "flex", justifyContent: "space-between" }}>
                                <span>{c.category}</span>
                                <span style={{ color: "#71717a", fontSize: "11px" }}>{pct}%</span>
                              </div>
                              <div style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "2px" }}>
                                {c.count.toLocaleString()} vids • {(c.views || 0).toLocaleString()} views
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Infrastructure & Engagement Health */}
                    <div style={cardContainerStyle}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "16px" }}>
                        <Database size={18} color="#34d399" />
                        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#f4f4f5" }}>
                          Infrastructure & Community Velocity
                        </h3>
                      </div>

                      {/* Storage Distribution */}
                      <div style={{ marginBottom: "20px" }}>
                        <div style={{ fontSize: "12px", color: "#71717a", fontWeight: "700", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Storage Pipeline Architecture
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                          <StorageRow 
                            name="Cloudflare R2 Storage (Direct CDN)" 
                            count={storage.r2 || 0} 
                            total={overview.total_videos || 1} 
                            color="#f43f5e" 
                          />
                          <StorageRow 
                            name="Cloudflare Stream HLS Nodes" 
                            count={storage.stream || 0} 
                            total={overview.total_videos || 1} 
                            color="#38bdf8" 
                          />
                          <StorageRow 
                            name="Telegram Fast CDN Fallback" 
                            count={storage.telegram || 0} 
                            total={overview.total_videos || 1} 
                            color="#a1a1aa" 
                          />
                        </div>
                      </div>

                      {/* Engagement Ratios */}
                      <div>
                        <div style={{ fontSize: "12px", color: "#71717a", fontWeight: "700", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Platform Engagement Metrics
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px" }}>
                          <EngagementCard title="Video Likes" count={overview.total_likes || 0} icon={<Heart size={14} color="#f43f5e" />} />
                          <EngagementCard title="Comments" count={overview.total_comments || 0} icon={<Activity size={14} color="#38bdf8" />} />
                          <EngagementCard title="Bookmark Saves" count={overview.total_saves || 0} icon={<Star size={14} color="#fbbf24" />} />
                          <EngagementCard title="Creator Follows" count={overview.total_follows || 0} icon={<Users size={14} color="#34d399" />} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Row 4: Top Creators Performance Leaderboard */}
                  <div style={cardContainerStyle}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <Sparkles size={18} color="#fbbf24" />
                        <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#f4f4f5" }}>
                          Top Content Producers & Audience Engines
                        </h3>
                      </div>
                      <button 
                        onClick={() => handleTabSwitch("creators")} 
                        style={{ border: "none", background: "transparent", color: "#f43f5e", fontSize: "12px", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", gap: "4px" }}
                      >
                        Manage All {overview.total_creators || 0} Creators <ArrowUpRight size={14} />
                      </button>
                    </div>

                    <div className="admin-table-scroll" onWheel={handleTableWheel} style={{ overflowX: "auto", width: "100%", WebkitOverflowScrolling: "touch" }}>
                      <table style={{ ...tableStyle, minWidth: "850px" }}>
                        <thead>
                          <tr>
                            <th style={thStyle}>Rank & Creator</th>
                            <th style={thStyle}>Type</th>
                            <th style={thStyle}>Category</th>
                            <th style={thStyle}>Total Catalog Views</th>
                            <th style={thStyle}>Videos</th>
                            <th style={thStyle}>Active Subscribers</th>
                            <th style={thStyle}>Followers</th>
                            <th style={thStyle}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {topCreators.map((c, idx) => (
                            <tr key={c.id} style={trStyle}>
                              <td style={tdStyle}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  <span style={{ fontSize: "12px", fontWeight: "800", color: idx === 0 ? "#fbbf24" : idx === 1 ? "#e4e4e7" : idx === 2 ? "#cd7f32" : "#71717a", width: "16px" }}>
                                    #{idx + 1}
                                  </span>
                                  <img 
                                    src={c.avatar_url || '/assets/default-avatar.png'} 
                                    alt="" 
                                    style={{ width: "34px", height: "34px", borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,0.08)" }} 
                                    onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                                  />
                                  <div>
                                    <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                      <span style={{ fontWeight: "700", color: "#f4f4f5", fontSize: "13px" }}>{c.display_name || c.username}</span>
                                      {c.is_verified && <TwitterVerifiedBadge size={13} />}
                                    </div>
                                    <span style={{ fontSize: "11px", color: "#71717a" }}>@{c.username}</span>
                                  </div>
                                </div>
                              </td>
                              <td style={tdStyle}>
                                {c.is_managed ? (
                                  <span style={{ background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "6px", padding: "1px 6px", fontSize: "10px", fontWeight: "800" }}>
                                    TELEGRAM
                                  </span>
                                ) : (
                                  <span style={{ background: "rgba(244, 63, 94, 0.12)", color: "#f43f5e", border: "1px solid rgba(244, 63, 94, 0.25)", borderRadius: "6px", padding: "1px 6px", fontSize: "10px", fontWeight: "800" }}>
                                    WEB
                                  </span>
                                )}
                              </td>
                              <td style={tdStyle}>
                                <span style={{ color: "#a1a1aa", fontSize: "12px", textTransform: "capitalize" }}>{c.creator_category || "Creator"}</span>
                              </td>
                              <td style={{ ...tdStyle, fontWeight: "700", color: "#f4f4f5" }}>
                                {Number(c.total_views || 0).toLocaleString()}
                              </td>
                              <td style={{ ...tdStyle, color: "#a1a1aa" }}>{c.total_posts || 0}</td>
                              <td style={{ ...tdStyle, fontWeight: "700", color: Number(c.active_subs) > 0 ? "#34d399" : "#71717a" }}>
                                {c.active_subs || 0} VIP
                              </td>
                              <td style={{ ...tdStyle, color: "#a1a1aa" }}>{c.followers_count || 0}</td>
                              <td style={tdStyle}>
                                <button 
                                  onClick={() => window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: c.username }))}
                                  style={{ ...iconBtnStyle, color: "#38bdf8" }} 
                                  title="View Public Profile"
                                >
                                  <ExternalLink size={14} />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                </div>
              )}

              {/* 🟢 STORY VIEWS & STATUS INTELLIGENCE TAB */}
              {activeTab === "stories" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                  {/* Row 1: Story Pulse KPIs */}
                  <div style={gridStatsStyle}>
                    <StatCard 
                      title="Total Story Views" 
                      value={(storyAnalytics?.summary?.total_views || 0).toLocaleString()} 
                      subtitle={`${(storyAnalytics?.summary?.views_30d || 0).toLocaleString()} in rolling 30 days`}
                      icon={<Eye size={20} color="#f43f5e" />} 
                      bg="rgba(225, 29, 72, 0.12)" 
                    />
                    <StatCard 
                      title="Today's Views (24h)" 
                      value={(storyAnalytics?.summary?.views_24h || 0).toLocaleString()} 
                      subtitle={`${storyAnalytics?.summary?.unique_viewers_24h || 0} unique viewers active today`}
                      icon={<TrendingUp size={20} color="#34d399" />} 
                      bg="rgba(52, 211, 153, 0.12)" 
                    />
                    <StatCard 
                      title="Weekly Views (7d)" 
                      value={(storyAnalytics?.summary?.views_7d || 0).toLocaleString()} 
                      subtitle={`7-day rolling story engagement`}
                      icon={<Calendar size={20} color="#38bdf8" />} 
                      bg="rgba(56, 189, 248, 0.12)" 
                    />
                    <StatCard 
                      title="Live Active Stories" 
                      value={`${storyAnalytics?.summary?.active_stories_count || 0} Stories`} 
                      subtitle={`Across ${storyAnalytics?.summary?.active_creators_count || 0} creators (Avg ${storyAnalytics?.summary?.avg_views_per_story || 0} views/story)`}
                      icon={<Radio size={20} color="#fbbf24" />} 
                      bg="rgba(251, 191, 36, 0.12)" 
                    />
                  </div>

                  {/* Subtab Navigator */}
                  <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid rgba(255,255,255,0.06)", paddingBottom: "12px", flexWrap: "wrap" }}>
                    {[
                      { id: "creators", label: "Creator Performance (Day / Week / Month)", icon: <Users size={15} /> },
                      { id: "catalog", label: `Story Catalog & Real-Time Status (${storiesData.total || 0})`, icon: <PlayCircle size={15} /> },
                      { id: "feed", label: `Live Viewers Telemetry Feed (${storyAnalytics?.recent_views?.length || 0})`, icon: <Activity size={15} /> }
                    ].map(st => (
                      <button
                        key={st.id}
                        onClick={() => setStorySubTab(st.id)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "8px 16px",
                          borderRadius: "8px",
                          fontSize: "13px",
                          fontWeight: "700",
                          border: "1px solid",
                          borderColor: storySubTab === st.id ? "rgba(244, 63, 94, 0.4)" : "rgba(255,255,255,0.08)",
                          background: storySubTab === st.id ? "rgba(244, 63, 94, 0.12)" : "#18181b",
                          color: storySubTab === st.id ? "#f43f5e" : "#a1a1aa",
                          cursor: "pointer",
                          transition: "all 0.15s ease"
                        }}
                      >
                        {st.icon} {st.label}
                      </button>
                    ))}
                  </div>

                  {/* SUBTAB 1: CREATOR STORY VIEWS (DAY / WEEK / MONTH) */}
                  {storySubTab === "creators" && (
                    <div>
                      {/* Search & Sort Bar */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#18181b", border: "1px solid rgba(255,255,255,0.08)", padding: "7px 12px", borderRadius: "8px", width: "260px" }}>
                            <Search size={14} color="#71717a" />
                            <input 
                              type="text" 
                              placeholder="Filter creators by handle or name..." 
                              value={creatorStorySearch} 
                              onChange={(e) => setCreatorStorySearch(e.target.value)} 
                              style={{ background: "transparent", border: "none", color: "#f4f4f5", outline: "none", width: "100%", fontSize: "12px" }}
                            />
                            {creatorStorySearch && <X size={12} color="#71717a" style={{ cursor: "pointer" }} onClick={() => setCreatorStorySearch("")} />}
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "12px", color: "#71717a", fontWeight: "600" }}>Sort Primary:</span>
                            <select
                              value={creatorStorySort}
                              onChange={(e) => setCreatorStorySort(e.target.value)}
                              style={{
                                background: "#18181b",
                                border: "1px solid rgba(255,255,255,0.08)",
                                borderRadius: "8px",
                                color: "#f4f4f5",
                                padding: "6px 12px",
                                fontSize: "12px",
                                outline: "none"
                              }}
                            >
                              <option value="views_24h">Today's Views (24h)</option>
                              <option value="views_7d">This Week's Views (7d)</option>
                              <option value="views_30d">This Month's Views (30d)</option>
                              <option value="total_views">All-Time Story Views</option>
                              <option value="unique_viewers">Unique Viewers Base</option>
                              <option value="active_stories">Active Stories Live</option>
                            </select>
                          </div>
                        </div>

                        {/* Horizontal Table Scroll Controls */}
                        {renderTableScrollControls("creator-story-table-container", 10)}
                      </div>

                      {/* Creators Story Analytics Table */}
                      <div style={tableContainerStyle}>
                        <div 
                          id="creator-story-table-container"
                          className="admin-table-scroll" 
                          onWheel={handleTableWheel}
                          style={{ overflowX: "auto", width: "100%", WebkitOverflowScrolling: "touch" }}
                        >
                          <table style={{ ...tableStyle, minWidth: "1100px" }}>
                            <thead>
                              <tr>
                                <th style={thStyle}>Creator Profile</th>
                                <th style={thStyle}>Category</th>
                                <th style={thStyle}>Stories Status</th>
                                <th style={{ ...thStyle, color: "#34d399" }}>Today (24h)</th>
                                <th style={{ ...thStyle, color: "#38bdf8" }}>Week (7d)</th>
                                <th style={{ ...thStyle, color: "#fbbf24" }}>Month (30d)</th>
                                <th style={thStyle}>Total Views</th>
                                <th style={thStyle}>Unique Viewers</th>
                                <th style={thStyle}>Last Story</th>
                                <th style={thStyle}>Viewers List</th>
                              </tr>
                            </thead>
                            <tbody>
                              {paginatedStoryCreators.length === 0 ? (
                                <tr>
                                  <td colSpan={10} style={{ ...tdStyle, textAlign: "center", padding: "40px", color: "#71717a" }}>
                                    No creator matches found.
                                  </td>
                                </tr>
                              ) : (
                                paginatedStoryCreators.map((c, i) => (
                                  <tr key={c.creator_username || i} style={trStyle}>
                                    <td style={tdStyle}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                        <img 
                                          src={c.avatar_url || '/assets/default-avatar.png'} 
                                          alt="" 
                                          style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,0.08)" }}
                                          onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                                        />
                                        <div>
                                          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                            <span style={{ fontWeight: "700", color: "#f4f4f5", fontSize: "13px" }}>{c.display_name || c.creator_username}</span>
                                            {c.is_verified && <TwitterVerifiedBadge size={13} />}
                                          </div>
                                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                                            <span style={{ fontSize: "11px", color: "#71717a" }}>@{c.creator_username}</span>
                                            {c.is_managed ? (
                                              <span style={{ background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "4px", padding: "1px 5px", fontSize: "9px", fontWeight: "800" }}>
                                                TELEGRAM
                                              </span>
                                            ) : (
                                              <span style={{ background: "rgba(244, 63, 94, 0.12)", color: "#f43f5e", border: "1px solid rgba(244, 63, 94, 0.25)", borderRadius: "4px", padding: "1px 5px", fontSize: "9px", fontWeight: "800" }}>
                                                WEB
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={tdStyle}>
                                      <span style={{ background: "#27272a", color: "#a1a1aa", borderRadius: "6px", padding: "2px 8px", fontSize: "11px", fontWeight: "700" }}>
                                        {c.creator_category || "Creator"}
                                      </span>
                                    </td>
                                    <td style={tdStyle}>
                                      <div style={{ fontSize: "12px", color: "#f4f4f5", fontWeight: "600" }}>
                                        {c.total_stories_posted || 0} total
                                      </div>
                                      <div style={{ fontSize: "11px", marginTop: "2px" }}>
                                        {c.active_stories > 0 ? (
                                          <span style={{ color: "#34d399", fontWeight: "700" }}>● {c.active_stories} Active Live</span>
                                        ) : (
                                          <span style={{ color: "#71717a" }}>0 active</span>
                                        )}
                                      </div>
                                    </td>
                                    <td style={tdStyle}>
                                      <span style={{ background: "rgba(52, 211, 153, 0.12)", color: "#34d399", border: "1px solid rgba(52, 211, 153, 0.25)", borderRadius: "6px", padding: "3px 8px", fontSize: "12px", fontWeight: "800" }}>
                                        {(c.views_24h || 0).toLocaleString()}
                                      </span>
                                    </td>
                                    <td style={{ ...tdStyle, fontWeight: "700", color: "#38bdf8" }}>
                                      {(c.views_7d || 0).toLocaleString()}
                                    </td>
                                    <td style={{ ...tdStyle, fontWeight: "700", color: "#fbbf24" }}>
                                      {(c.views_30d || 0).toLocaleString()}
                                    </td>
                                    <td style={{ ...tdStyle, fontWeight: "800", color: "#f4f4f5" }}>
                                      {(c.total_views || 0).toLocaleString()}
                                    </td>
                                    <td style={{ ...tdStyle, color: "#a1a1aa", fontWeight: "600" }}>
                                      {(c.unique_viewers || 0).toLocaleString()} users
                                    </td>
                                    <td style={{ ...tdStyle, color: "#71717a", fontSize: "11px", whiteSpace: "nowrap" }}>
                                      {formatRelativeTime(c.last_story_at)}
                                    </td>
                                    <td style={tdStyle}>
                                      <button
                                        onClick={() => handleOpenCreatorStoryViewers(c)}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "6px",
                                          background: "#27272a",
                                          border: "1px solid rgba(255,255,255,0.08)",
                                          color: "#f4f4f5",
                                          padding: "5px 10px",
                                          borderRadius: "6px",
                                          fontSize: "11px",
                                          fontWeight: "700",
                                          cursor: "pointer"
                                        }}
                                        title="View list of all users who watched this creator's stories"
                                      >
                                        <Users size={13} color="#f43f5e" /> Viewers
                                      </button>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Pagination Bar */}
                        {renderPagination({
                          currentPage: creatorStoryPage,
                          totalPages: totalCreatorStoryPages,
                          totalItems: filteredStoryCreators.length,
                          itemsPerPage: creatorStoryLimit,
                          onPageChange: setCreatorStoryPage,
                          onLimitChange: setCreatorStoryLimit,
                          limitOptions: [10, 20, 50],
                          itemLabel: "creators"
                        })}
                      </div>
                    </div>
                  )}

                  {/* SUBTAB 2: STORY CATALOG & REAL-TIME STATUS */}
                  {storySubTab === "catalog" && (
                    <div>
                      {/* Filter Bar */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                          {/* Status Filter */}
                          <div style={{ display: "flex", background: "#18181b", borderRadius: "8px", padding: "3px", border: "1px solid rgba(255,255,255,0.08)" }}>
                            {[
                              { id: "all", label: "All Stories" },
                              { id: "active", label: `Active Only (${storyAnalytics?.summary?.active_stories_count || 0})` },
                              { id: "expired", label: "Expired" }
                            ].map(sf => (
                              <button
                                key={sf.id}
                                onClick={() => { setStoryFilter(sf.id); setStoriesPage(1); }}
                                style={{
                                  border: "none",
                                  background: storyFilter === sf.id ? "rgba(244, 63, 94, 0.15)" : "transparent",
                                  color: storyFilter === sf.id ? "#f43f5e" : "#a1a1aa",
                                  padding: "5px 12px",
                                  borderRadius: "6px",
                                  fontSize: "12px",
                                  fontWeight: "700",
                                  cursor: "pointer"
                                }}
                              >
                                {sf.label}
                              </button>
                            ))}
                          </div>

                          {/* Creator Filter Dropdown */}
                          <select
                            value={storyCreatorFilter}
                            onChange={(e) => { setStoryCreatorFilter(e.target.value); setStoriesPage(1); }}
                            style={{
                              background: "#18181b",
                              border: "1px solid rgba(255,255,255,0.08)",
                              borderRadius: "8px",
                              color: "#f4f4f5",
                              padding: "6px 12px",
                              fontSize: "12px",
                              outline: "none"
                            }}
                          >
                            <option value="all">All Creators</option>
                            {(storyAnalytics?.creators || []).map(c => (
                              <option key={c.creator_username} value={c.creator_username}>
                                @{c.creator_username} ({c.active_stories || 0} active)
                              </option>
                            ))}
                          </select>

                          {/* Search Input */}
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#18181b", padding: "5px 10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                            <Search size={14} color="#71717a" />
                            <input
                              type="text"
                              placeholder="Search track anthem or handle..."
                              value={storySearchTerm}
                              onChange={(e) => setStorySearchTerm(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') { setStoriesPage(1); fetchStoriesCatalogOnly(); } }}
                              style={{ background: "transparent", border: "none", color: "#f4f4f5", fontSize: "12px", outline: "none", width: "180px" }}
                            />
                            {storySearchTerm && <X size={12} color="#71717a" style={{ cursor: "pointer" }} onClick={() => { setStorySearchTerm(""); setStoriesPage(1); }} />}
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
                          <div style={{ fontSize: "12px", color: "#71717a" }}>
                            Total: <strong style={{ color: "#f4f4f5" }}>{storiesData.total.toLocaleString()}</strong> stories
                          </div>
                          {renderTableScrollControls("catalog-story-table-container", 9)}
                        </div>
                      </div>

                      {/* Stories Catalog Table */}
                      <div style={tableContainerStyle}>
                        <div 
                          id="catalog-story-table-container"
                          className="admin-table-scroll" 
                          onWheel={handleTableWheel}
                          style={{ overflowX: "auto", width: "100%", WebkitOverflowScrolling: "touch" }}
                        >
                          <table style={{ ...tableStyle, minWidth: "1150px" }}>
                            <thead>
                              <tr>
                                <th style={thStyle}>Story Preview</th>
                                <th style={thStyle}>Creator</th>
                                <th style={thStyle}>Real-Time Status & Lifecycle</th>
                                <th style={thStyle}>Music Anthem</th>
                                <th style={thStyle}>Duration</th>
                                <th style={thStyle}>Views</th>
                                <th style={thStyle}>Unique Viewers</th>
                                <th style={thStyle}>Created At</th>
                                <th style={thStyle}>Viewers Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(storiesData.stories || []).map(s => {
                                const isActive = s.is_currently_active;
                                return (
                                  <tr key={s.id} style={trStyle}>
                                    <td style={tdStyle}>
                                      <div 
                                        onClick={() => setStoryPreviewModal(s)}
                                        style={{ 
                                          width: "48px", 
                                          height: "64px", 
                                          borderRadius: "6px", 
                                          background: "#27272a", 
                                          position: "relative", 
                                          overflow: "hidden", 
                                          cursor: "pointer",
                                          border: isActive ? "1.5px solid #34d399" : "1px solid rgba(255,255,255,0.08)"
                                        }}
                                        title="Click to preview vertical reel video"
                                      >
                                        <img 
                                          src={s.thumbnail_url || '/assets/default-avatar.png'} 
                                          alt="" 
                                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                          onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                                        />
                                        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                                          <Play size={16} color="#d4d4d8" fill="#d4d4d8" />
                                        </div>
                                      </div>
                                    </td>
                                    <td style={tdStyle}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                        <img 
                                          src={s.avatar_url || '/assets/default-avatar.png'} 
                                          alt="" 
                                          style={{ width: "30px", height: "30px", borderRadius: "50%", objectFit: "cover" }}
                                          onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                                        />
                                        <div>
                                          <div style={{ fontWeight: "700", color: "#f4f4f5", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                                            {s.display_name || s.username}
                                            {s.is_verified && <TwitterVerifiedBadge size={12} />}
                                          </div>
                                          <div style={{ fontSize: "11px", color: "#71717a" }}>@{s.username}</div>
                                        </div>
                                      </div>
                                    </td>
                                    <td style={tdStyle}>
                                      {isActive ? (
                                        <div>
                                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "rgba(52, 211, 153, 0.12)", color: "#34d399", border: "1px solid rgba(52, 211, 153, 0.25)", borderRadius: "6px", padding: "2px 8px", fontSize: "11px", fontWeight: "800" }}>
                                            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#34d399", display: "inline-block" }} />
                                            ACTIVE
                                          </span>
                                          <div style={{ fontSize: "11px", color: "#34d399", marginTop: "3px", fontWeight: "600" }}>
                                            {formatTimeRemaining(s.seconds_remaining)}
                                          </div>
                                        </div>
                                      ) : (
                                        <div>
                                          <span style={{ display: "inline-flex", alignItems: "center", gap: "5px", background: "#27272a", color: "#71717a", borderRadius: "6px", padding: "2px 8px", fontSize: "11px", fontWeight: "700" }}>
                                            EXPIRED
                                          </span>
                                          <div style={{ fontSize: "11px", color: "#71717a", marginTop: "3px" }}>
                                            {new Date(s.expires_at).toLocaleDateString()}
                                          </div>
                                        </div>
                                      )}
                                    </td>
                                    <td style={{ ...tdStyle, maxWidth: "220px" }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <Music size={13} color="#f43f5e" style={{ flexShrink: 0 }} />
                                        <span style={{ fontSize: "12px", color: "#f4f4f5", fontWeight: "600", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                          {s.sound_title || "Original Audio"}
                                        </span>
                                      </div>
                                    </td>
                                    <td style={{ ...tdStyle, color: "#a1a1aa", fontSize: "12px" }}>
                                      {s.duration || 0}s
                                    </td>
                                    <td style={tdStyle}>
                                      <div style={{ fontWeight: "800", color: "#f4f4f5", fontSize: "13px" }}>
                                        {(s.view_count || 0).toLocaleString()} views
                                      </div>
                                      {s.views_24h > 0 && (
                                        <div style={{ fontSize: "11px", color: "#34d399", fontWeight: "600" }}>
                                          +{s.views_24h} today
                                        </div>
                                      )}
                                    </td>
                                    <td style={{ ...tdStyle, color: "#a1a1aa", fontWeight: "600" }}>
                                      {(s.unique_viewers || 0).toLocaleString()} users
                                    </td>
                                    <td style={{ ...tdStyle, color: "#71717a", fontSize: "11px", whiteSpace: "nowrap" }}>
                                      {new Date(s.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td style={tdStyle}>
                                      <button
                                        onClick={() => handleOpenStoryViewers(s)}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "6px",
                                          background: "#27272a",
                                          border: "1px solid rgba(255,255,255,0.08)",
                                          color: "#f4f4f5",
                                          padding: "5px 10px",
                                          borderRadius: "6px",
                                          fontSize: "11px",
                                          fontWeight: "700",
                                          cursor: "pointer"
                                        }}
                                        title="Inspect list of users who watched this story"
                                      >
                                        <Eye size={13} color="#38bdf8" /> Viewers ({s.view_count || 0})
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {/* Rich Pagination Bar */}
                        {renderPagination({
                          currentPage: storiesPage,
                          totalPages: storiesData.total_pages,
                          totalItems: storiesData.total,
                          itemsPerPage: storiesLimit,
                          onPageChange: setStoriesPage,
                          onLimitChange: setStoriesLimit,
                          limitOptions: [10, 15, 25, 50],
                          itemLabel: "stories"
                        })}
                      </div>
                    </div>
                  )}

                  {/* SUBTAB 3: LIVE VIEWERS TELEMETRY FEED */}
                  {storySubTab === "feed" && (
                    <div style={cardContainerStyle}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <Activity size={18} color="#34d399" />
                            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#f4f4f5" }}>
                              Real-Time Platform Story Views Feed
                            </h3>
                          </div>
                          <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#71717a" }}>
                            Live stream of registered member watch events across all creator status reels.
                          </p>
                        </div>

                        {/* Horizontal Table Scroll Controls */}
                        {renderTableScrollControls("feed-story-table-container", 7)}
                      </div>

                      <div 
                        id="feed-story-table-container"
                        className="admin-table-scroll" 
                        onWheel={handleTableWheel}
                        style={{ overflowX: "auto", width: "100%", WebkitOverflowScrolling: "touch" }}
                      >
                        <table style={{ ...tableStyle, minWidth: "1000px" }}>
                          <thead>
                            <tr>
                              <th style={thStyle}>Viewer Member</th>
                              <th style={thStyle}>Tier</th>
                              <th style={thStyle}>Story Creator</th>
                              <th style={thStyle}>Soundtrack Anthem</th>
                              <th style={thStyle}>Story State</th>
                              <th style={thStyle}>Time Watched</th>
                              <th style={thStyle}>Story Link</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedRecentViews.length === 0 ? (
                              <tr>
                                <td colSpan={7} style={{ ...tdStyle, textAlign: "center", padding: "40px", color: "#71717a" }}>
                                  No live story view telemetry recorded yet.
                                </td>
                              </tr>
                            ) : (
                              paginatedRecentViews.map(rv => (
                              <tr key={rv.view_id} style={trStyle}>
                                <td style={tdStyle}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <img 
                                      src={rv.viewer_avatar_url || '/assets/default-avatar.png'} 
                                      alt="" 
                                      style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }}
                                      onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                                    />
                                    <div>
                                      <div style={{ fontWeight: "700", color: "#f4f4f5", fontSize: "13px" }}>
                                        {rv.viewer_display_name || rv.viewer_username || "Registered User"}
                                      </div>
                                      <div style={{ fontSize: "11px", color: "#71717a" }}>
                                        {rv.viewer_email || `@${rv.viewer_username}`}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td style={tdStyle}>
                                  {rv.viewer_is_premium ? (
                                    <span style={premiumBadge}>VIP Member</span>
                                  ) : (
                                    <span style={freeBadge}>Standard</span>
                                  )}
                                </td>
                                <td style={tdStyle}>
                                  <span style={{ fontWeight: "700", color: "#f4f4f5" }}>
                                    @{rv.creator_username}
                                  </span>
                                </td>
                                <td style={{ ...tdStyle, maxWidth: "200px" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                    <Music size={12} color="#f43f5e" style={{ flexShrink: 0 }} />
                                    <span style={{ fontSize: "12px", color: "#a1a1aa", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      {rv.sound_title || "Audio"}
                                    </span>
                                  </div>
                                </td>
                                <td style={tdStyle}>
                                  {rv.is_currently_active ? (
                                    <span style={{ background: "rgba(52, 211, 153, 0.12)", color: "#34d399", border: "1px solid rgba(52, 211, 153, 0.25)", borderRadius: "4px", padding: "1px 6px", fontSize: "10px", fontWeight: "800" }}>
                                      ACTIVE
                                    </span>
                                  ) : (
                                    <span style={{ background: "#27272a", color: "#71717a", borderRadius: "4px", padding: "1px 6px", fontSize: "10px", fontWeight: "700" }}>
                                      EXPIRED
                                    </span>
                                  )}
                                </td>
                                <td style={{ ...tdStyle, color: "#f4f4f5", fontSize: "12px", whiteSpace: "nowrap" }}>
                                  <div style={{ fontWeight: "600" }}>{formatRelativeTime(rv.viewed_at)}</div>
                                  <div style={{ fontSize: "10px", color: "#71717a" }}>
                                    {new Date(rv.viewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                  </div>
                                </td>
                                <td style={tdStyle}>
                                  <button
                                    onClick={() => setStoryPreviewModal({
                                      video_url: rv.video_url,
                                      sound_title: rv.sound_title,
                                      username: rv.creator_username,
                                      display_name: rv.creator_display_name
                                    })}
                                    style={{ ...iconBtnStyle, color: "#38bdf8" }}
                                    title="Preview Story Video"
                                  >
                                    <Play size={13} fill="#38bdf8" />
                                  </button>
                                </td>
                              </tr>
                            )))}
                          </tbody>
                        </table>
                      </div>

                      {/* Pagination Bar */}
                      {renderPagination({
                        currentPage: storyFeedPage,
                        totalPages: totalFeedPages,
                        totalItems: recentStoryViews.length,
                        itemsPerPage: storyFeedLimit,
                        onPageChange: setStoryFeedPage,
                        onLimitChange: setStoryFeedLimit,
                        limitOptions: [10, 20, 30],
                        itemLabel: "views"
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 🟢 MODERATION & REPORTS QUEUE TAB */}
              {activeTab === "moderation" && (
                <div>
                  <div style={{ ...cardContainerStyle, marginBottom: "24px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <ShieldAlert size={20} color="#f43f5e" />
                          <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#f4f4f5" }}>
                            Content Moderation & Incident Queue
                          </h2>
                        </div>
                        <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#71717a" }}>
                          Review flagged community submissions, copyright claims, and inappropriate content reports.
                        </p>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "12px", background: "rgba(244, 63, 94, 0.12)", color: "#f43f5e", border: "1px solid rgba(244, 63, 94, 0.25)", padding: "4px 10px", borderRadius: "8px", fontWeight: "700" }}>
                          {reportsList.length} Pending Actions
                        </span>
                      </div>
                    </div>
                  </div>

                  {reportsLoading ? (
                    <div style={centerFlex}><RefreshCw size={36} color="#f43f5e" style={{ animation: "spin 1s linear infinite" }} /></div>
                  ) : reportsList.length === 0 ? (
                    <div style={{ ...cardContainerStyle, textAlign: "center", padding: "60px 20px" }}>
                      <CheckCircle size={44} color="#34d399" style={{ margin: "0 auto 12px auto" }} />
                      <h3 style={{ margin: "0 0 6px 0", color: "#f4f4f5", fontSize: "16px" }}>Clean Moderation Queue</h3>
                      <p style={{ color: "#71717a", fontSize: "13px", margin: 0 }}>All reported items have been reviewed and resolved.</p>
                    </div>
                  ) : (
                    <div style={tableContainerStyle}>
                      <div className="admin-table-scroll" onWheel={handleTableWheel} style={{ overflowX: "auto", width: "100%", WebkitOverflowScrolling: "touch" }}>
                        <table style={{ ...tableStyle, minWidth: "1000px" }}>
                          <thead>
                            <tr>
                              <th style={thStyle}>Reported Item</th>
                              <th style={thStyle}>Uploader</th>
                              <th style={thStyle}>Report Reason</th>
                              <th style={thStyle}>Reported By</th>
                              <th style={thStyle}>Date Flagged</th>
                              <th style={thStyle}>Resolution Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportsList.map(r => (
                              <tr key={r.id} style={trStyle}>
                                <td style={tdStyle}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <div style={{ width: "50px", height: "50px", borderRadius: "6px", background: "#27272a", overflow: "hidden", flexShrink: 0, position: "relative" }}>
                                      {r.cloudflare_id && r.cloudflare_id !== "none" && !r.cloudflare_id.startsWith("r2:") ? (
                                        <img src={`https://videodelivery.net/${r.cloudflare_id.split('?')[0]}/thumbnails/thumbnail.jpg?time=1s&height=200`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                      ) : (
                                        <img src={`${APP_CONFIG.apiUrl}/api/thumbnail?chat_id=${r.chat_id}&message_id=${r.message_id}`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={(e) => { e.target.src = "/assets/default-avatar.png"; }} />
                                      )}
                                    </div>
                                    <div style={{ maxWidth: "260px" }}>
                                      <div style={{ fontWeight: "700", color: "#f4f4f5", fontSize: "13px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {r.caption || "Untitled clip"}
                                      </div>
                                      <div style={{ display: "flex", gap: "6px", marginTop: "3px" }}>
                                        <span style={{ fontSize: "10px", background: "rgba(255,255,255,0.06)", color: "#a1a1aa", padding: "1px 6px", borderRadius: "4px", textTransform: "capitalize" }}>
                                          {r.category || "video"}
                                        </span>
                                        <span style={{ fontSize: "10px", color: "#71717a" }}>
                                          {r.views || 0} views
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td style={tdStyle}>
                                  <div style={{ fontWeight: "600", color: "#f4f4f5", fontSize: "13px" }}>
                                    {r.uploader_display_name || r.uploader_username || "Unknown"}
                                  </div>
                                  {r.uploader_username && <div style={{ fontSize: "11px", color: "#71717a" }}>@{r.uploader_username}</div>}
                                </td>
                                <td style={tdStyle}>
                                  <span style={{ background: "rgba(244, 63, 94, 0.12)", color: "#f43f5e", border: "1px solid rgba(244, 63, 94, 0.25)", padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" }}>
                                    {r.reason || "Inappropriate Content"}
                                  </span>
                                  {r.details && <div style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "4px" }}>{r.details}</div>}
                                </td>
                                <td style={tdStyle}>
                                  <div style={{ fontSize: "12px", color: "#f4f4f5" }}>{r.reporter_username || "Anonymous"}</div>
                                  <div style={{ fontSize: "10px", color: "#71717a" }}>{r.reporter_email || "N/A"}</div>
                                </td>
                                <td style={{ ...tdStyle, color: "#71717a", fontSize: "12px", whiteSpace: "nowrap" }}>
                                  {new Date(r.created_at).toLocaleDateString()}
                                </td>
                                <td style={tdStyle}>
                                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                                    <button
                                      disabled={actioningReportId === r.id}
                                      onClick={() => handleDismissReport(r.id)}
                                      style={{ ...reportActionBtn, background: "rgba(255,255,255,0.06)", color: "#a1a1aa", borderColor: "rgba(255,255,255,0.12)" }}
                                      title="Ignore and dismiss this report"
                                    >
                                      Dismiss
                                    </button>
                                    <button
                                      disabled={actioningReportId === r.id}
                                      onClick={() => handleDeleteReportedVideo(r.id)}
                                      style={{ ...reportActionBtn, background: "rgba(245, 158, 11, 0.12)", color: "#fbbf24", borderColor: "rgba(245, 158, 11, 0.25)" }}
                                      title="Remove video from catalog"
                                    >
                                      Delete Video
                                    </button>
                                    <button
                                      disabled={actioningReportId === r.id}
                                      onClick={() => handleBanCreatorReport(r.id)}
                                      style={{ ...reportActionBtn, background: "rgba(244, 63, 94, 0.15)", color: "#f43f5e", borderColor: "rgba(244, 63, 94, 0.3)" }}
                                      title="Ban creator account & delete video"
                                    >
                                      Ban Creator
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 🟢 CREATORS TAB */}
              {activeTab === "creators" && (
                <>
                  <div style={{ ...gridStatsStyle, marginBottom: "24px" }}>
                    <StatCard 
                      title="Total Creators" 
                      value={creatorAnalytics.total} 
                      subtitle={`${creatorAnalytics.managed} Telegram + ${creatorAnalytics.total - creatorAnalytics.managed} Web`}
                      icon={<Sparkles size={20} color="#38bdf8" />} 
                      bg="rgba(56, 189, 248, 0.12)" 
                    />
                    <StatCard 
                      title="Verified Badges" 
                      value={creatorAnalytics.verified} 
                      subtitle={`${Math.round((creatorAnalytics.verified / (creatorAnalytics.total || 1)) * 100)}% verification rate`}
                      icon={<CheckCircle size={20} color="#34d399" />} 
                      bg="rgba(52, 211, 153, 0.12)" 
                    />
                    <StatCard 
                      title="Active VIP Subscribers" 
                      value={creatorAnalytics.totalSubs} 
                      subtitle={`Recurring fan memberships`}
                      icon={<Users size={20} color="#fbbf24" />} 
                      bg="rgba(251, 191, 36, 0.12)" 
                    />
                    <StatCard 
                      title="Total Tips Volume" 
                      value={`$${Number(creatorAnalytics.totalTips).toLocaleString()}`} 
                      subtitle="Direct creator tips received"
                      icon={<Heart size={20} color="#f43f5e" />} 
                      bg="rgba(225, 29, 72, 0.12)" 
                    />
                  </div>

                  {/* Filter Toolbar */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {[
                        { id: "all", label: "All Creators" },
                        { id: "telegram", label: "Telegram Funnels" },
                        { id: "web", label: "Web Creators" },
                        { id: "verified", label: "Verified Only" },
                        { id: "unverified", label: "Unverified" },
                        { id: "paid", label: "Paid Subscriptions" },
                        { id: "free", label: "Free Follow" }
                      ].map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => { setCreatorFilter(f.id); setCurrentPage(1); }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                            border: "1px solid",
                            borderColor: creatorFilter === f.id ? "rgba(244, 63, 94, 0.4)" : "rgba(255,255,255,0.08)",
                            background: creatorFilter === f.id ? "rgba(244, 63, 94, 0.12)" : "#18181b",
                            color: creatorFilter === f.id ? "#f43f5e" : "#a1a1aa"
                          }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={handleSyncTelegramCreators}
                        disabled={syncingTelegram}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 14px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: "700",
                          background: "#27272a",
                          color: "#38bdf8",
                          border: "1px solid rgba(56, 189, 248, 0.3)",
                          cursor: syncingTelegram ? "not-allowed" : "pointer"
                        }}
                        title="Scan Telegram uploaders and sync into managed creators"
                      >
                        <RefreshCw size={13} style={{ animation: syncingTelegram ? "spin 1s linear infinite" : "none" }} />
                        {syncingTelegram ? "Syncing..." : "Sync Telegram Channels"}
                      </button>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <select
                          value={creatorCategoryFilter}
                          onChange={(e) => { setCreatorCategoryFilter(e.target.value); setCurrentPage(1); }}
                          style={{
                            background: "#27272a",
                            border: "1px solid rgba(255,255,255,0.08)",
                            borderRadius: "8px",
                            color: "#f4f4f5",
                            padding: "6px 12px",
                            fontSize: "12px",
                            outline: "none"
                          }}
                        >
                          <option value="all">All Categories</option>
                          <option value="Creator">General Creator</option>
                          <option value="Model">Model</option>
                          <option value="Influencer">Influencer</option>
                          <option value="Dancer">Dancer</option>
                          <option value="Fitness">Fitness</option>
                          <option value="Blogger">Blogger</option>
                          <option value="Musician">Musician</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Creators Table */}
                  <div style={tableContainerStyle}>
                    <div className="admin-table-scroll" onWheel={handleTableWheel} style={{ overflowX: "auto", width: "100%", WebkitOverflowScrolling: "touch" }}>
                      <table style={{ ...tableStyle, minWidth: "1050px" }}>
                        <thead>
                          <tr>
                            <th onClick={() => handleSort('display_name')} style={{ ...thStyle, cursor: "pointer" }}>
                              Creator <SortIcon columnKey="display_name" />
                            </th>
                            <th onClick={() => handleSort('creator_category')} style={{ ...thStyle, cursor: "pointer" }}>
                              Category <SortIcon columnKey="creator_category" />
                            </th>
                            <th onClick={() => handleSort('subscription_price')} style={{ ...thStyle, cursor: "pointer" }}>
                              Monthly Rate <SortIcon columnKey="subscription_price" />
                            </th>
                            <th onClick={() => handleSort('subscribers_count')} style={{ ...thStyle, cursor: "pointer" }}>
                              VIP Fans <SortIcon columnKey="subscribers_count" />
                            </th>
                            <th onClick={() => handleSort('tips_total')} style={{ ...thStyle, cursor: "pointer" }}>
                              Tips Received <SortIcon columnKey="tips_total" />
                            </th>
                            <th onClick={() => handleSort('posts_count')} style={{ ...thStyle, cursor: "pointer" }}>
                              Posts / Views <SortIcon columnKey="posts_count" />
                            </th>
                            <th style={thStyle}>Verify Badge</th>
                            <th style={thStyle}>Status</th>
                            <th style={thStyle}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedCreators.length === 0 ? (
                            <tr>
                              <td colSpan={9} style={{ ...tdStyle, textAlign: "center", padding: "40px 16px", color: "#71717a" }}>
                                No creators matching this filter.
                              </td>
                            </tr>
                          ) : (
                            paginatedCreators.map(c => (
                              <tr key={c.id} style={trStyle}>
                                <td style={tdStyle}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                    <img 
                                      src={c.avatar_url || '/assets/default-avatar.png'} 
                                      alt="" 
                                      style={{ width: "36px", height: "36px", borderRadius: "50%", objectFit: "cover", border: "1px solid rgba(255,255,255,0.08)" }}
                                      onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                                    />
                                    <div>
                                      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                                        <span style={{ fontWeight: "700", color: "#f4f4f5", fontSize: "13px" }}>{c.display_name || c.username}</span>
                                        {c.is_verified && <TwitterVerifiedBadge size={13} />}
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                                        <span style={{ fontSize: "11px", color: "#71717a" }}>@{c.username}</span>
                                        {c.is_managed ? (
                                          <span style={{ background: "rgba(56, 189, 248, 0.12)", color: "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.25)", borderRadius: "4px", padding: "1px 5px", fontSize: "9px", fontWeight: "800" }}>
                                            TELEGRAM
                                          </span>
                                        ) : (
                                          <span style={{ background: "rgba(244, 63, 94, 0.12)", color: "#f43f5e", border: "1px solid rgba(244, 63, 94, 0.25)", borderRadius: "4px", padding: "1px 5px", fontSize: "9px", fontWeight: "800" }}>
                                            WEB
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td style={tdStyle}>
                                  <span style={{ background: "#27272a", color: "#a1a1aa", borderRadius: "6px", padding: "3px 8px", fontSize: "11px", fontWeight: "700" }}>
                                    {c.creator_category || "Creator"}
                                  </span>
                                </td>
                                <td style={{ ...tdStyle, fontWeight: "700" }}>
                                  {Number(c.subscription_price) > 0 ? (
                                    <span style={{ color: "#f43f5e" }}>${Number(c.subscription_price).toLocaleString()}/mo</span>
                                  ) : (
                                    <span style={{ color: "#71717a" }}>Free</span>
                                  )}
                                </td>
                                <td style={{ ...tdStyle, fontWeight: "700", color: "#f4f4f5" }}>
                                  {c.subscribers_count || 0}
                                </td>
                                <td style={tdStyle}>
                                  <span style={{ fontWeight: "700", color: "#f4f4f5" }}>${(c.tips_total || 0).toLocaleString()}</span>
                                  <span style={{ display: "block", fontSize: "10px", color: "#71717a" }}>{c.tips_count || 0} tips</span>
                                </td>
                                <td style={tdStyle}>
                                  <span style={{ fontWeight: "700", color: "#f4f4f5" }}>{c.posts_count || 0} posts</span>
                                  <span style={{ display: "block", fontSize: "10px", color: "#71717a" }}>{(c.total_views || 0).toLocaleString()} views</span>
                                </td>
                                <td style={tdStyle}>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleVerify(c)}
                                    disabled={updatingCreatorId === c.id}
                                    style={{
                                      background: c.is_verified ? "rgba(56, 189, 248, 0.12)" : "#27272a",
                                      border: `1px solid ${c.is_verified ? "rgba(56, 189, 248, 0.3)" : "rgba(255,255,255,0.08)"}`,
                                      borderRadius: "8px",
                                      padding: "4px 8px",
                                      color: c.is_verified ? "#38bdf8" : "#71717a",
                                      fontSize: "11px",
                                      fontWeight: "700",
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px"
                                    }}
                                  >
                                    {c.is_verified ? <TwitterVerifiedBadge size={12} /> : <CheckCircle size={12} color="#71717a" />}
                                    <span>{c.is_verified ? "Verified" : "Unverified"}</span>
                                  </button>
                                </td>
                                <td style={tdStyle}>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCreatorStatus(c)}
                                    disabled={updatingCreatorId === c.id}
                                    style={{
                                      background: c.is_creator ? "rgba(52, 211, 153, 0.12)" : "rgba(244, 63, 94, 0.12)",
                                      border: `1px solid ${c.is_creator ? "rgba(52, 211, 153, 0.3)" : "rgba(244, 63, 94, 0.3)"}`,
                                      borderRadius: "8px",
                                      padding: "4px 8px",
                                      color: c.is_creator ? "#34d399" : "#f43f5e",
                                      fontSize: "11px",
                                      fontWeight: "700",
                                      cursor: "pointer"
                                    }}
                                  >
                                    {c.is_creator ? "Active" : "Disabled"}
                                  </button>
                                </td>
                                <td style={tdStyle}>
                                  <div style={{ display: "flex", gap: "6px" }}>
                                    <button 
                                      type="button"
                                      onClick={() => setEditingCreator(c)} 
                                      style={iconBtnStyle} 
                                      title="Edit Creator"
                                    >
                                      <Edit3 size={15} />
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: c.username }))} 
                                      style={{ ...iconBtnStyle, color: "#38bdf8" }} 
                                      title="Preview Public Profile"
                                    >
                                      <ExternalLink size={15} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {renderPagination({
                      currentPage,
                      totalPages: totalCreatorPages,
                      totalItems: processedCreators.length,
                      itemsPerPage: ITEMS_PER_PAGE,
                      onPageChange: setCurrentPage,
                      itemLabel: "creators"
                    })}
                  </div>
                </>
              )}

              {/* 🟢 VIDEOS TAB */}
              {activeTab === "videos" && (
                <>
                  <div style={{ ...gridStatsStyle, marginBottom: "24px" }}>
                    <StatCard title="Total Video Library" value={(videosData.total || 0).toLocaleString()} subtitle="Indexed video records" icon={<PlayCircle size={20} color="#f43f5e" />} bg="rgba(225, 29, 72, 0.12)" />
                    <StatCard title="Total Catalog Views" value={(videosData.total_views || overview.total_views || 0).toLocaleString()} subtitle="Aggregate platform plays" icon={<Eye size={20} color="#38bdf8" />} bg="rgba(56, 189, 248, 0.12)" />
                    <StatCard title="Active 24h Stories" value={overview.active_stories || 0} subtitle={`${overview.active_story_creators || 0} creators publishing`} icon={<Activity size={20} color="#34d399" />} bg="rgba(52, 211, 153, 0.12)" />
                    <StatCard title="Cloudflare R2 Ratio" value={`${Math.round(((storage.r2 || 0) / (overview.total_videos || 1)) * 100)}%`} subtitle={`${(storage.r2 || 0).toLocaleString()} clips in R2`} icon={<Database size={20} color="#fbbf24" />} bg="rgba(251, 191, 36, 0.12)" />
                  </div>

                  {/* Filter & Search Bar */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
                      <select
                        value={videoCategoryFilter}
                        onChange={(e) => { setVideoCategoryFilter(e.target.value); setCurrentPage(1); }}
                        style={{
                          background: "#27272a",
                          border: "1px solid rgba(255,255,255,0.08)",
                          borderRadius: "8px",
                          color: "#f4f4f5",
                          padding: "6px 12px",
                          fontSize: "12px",
                          outline: "none"
                        }}
                      >
                        <option value="all">All Categories ({videosData.total.toLocaleString()})</option>
                        {categories.map(c => (
                          <option key={c.category} value={c.category}>{c.category.charAt(0).toUpperCase() + c.category.slice(1)} ({c.count})</option>
                        ))}
                      </select>

                      <div style={{ display: "flex", alignItems: "center", gap: "6px", background: "#27272a", padding: "5px 10px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <Search size={14} color="#71717a" />
                        <input
                          type="text"
                          placeholder="Search captions..."
                          value={videoSearchTerm}
                          onChange={(e) => setVideoSearchTerm(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') { setCurrentPage(1); fetchData(); } }}
                          style={{ background: "transparent", border: "none", color: "#f4f4f5", fontSize: "12px", outline: "none", width: "160px" }}
                        />
                        {videoSearchTerm && <X size={12} color="#71717a" style={{ cursor: "pointer" }} onClick={() => { setVideoSearchTerm(""); setCurrentPage(1); }} />}
                      </div>
                    </div>

                    <div style={{ fontSize: "12px", color: "#71717a" }}>
                      Showing {(videosData.videos || []).length} of {videosData.total.toLocaleString()} clips
                    </div>
                  </div>

                  <div style={tableContainerStyle}>
                    <div className="admin-table-scroll" onWheel={handleTableWheel} style={{ overflowX: "auto", width: "100%", WebkitOverflowScrolling: "touch" }}>
                      <table style={{ ...tableStyle, minWidth: "1050px" }}>
                        <thead>
                          <tr>
                            <th style={thStyle}>Preview</th>
                            <th onClick={() => handleSort('caption')} style={{ ...thStyle, cursor: "pointer" }}>Caption <SortIcon columnKey="caption" /></th>
                            <th onClick={() => handleSort('category')} style={{ ...thStyle, cursor: "pointer" }}>Category <SortIcon columnKey="category" /></th>
                            <th onClick={() => handleSort('views')} style={{ ...thStyle, cursor: "pointer" }}>Views <SortIcon columnKey="views" /></th>
                            <th onClick={() => handleSort('created_at')} style={{ ...thStyle, cursor: "pointer" }}>Uploaded <SortIcon columnKey="created_at" /></th>
                            <th style={thStyle}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(videosData.videos || []).map(v => (
                            <tr key={v.id} style={trStyle}>
                              <td style={tdStyle}>
                                <img src={v.thumbnail_url || '/assets/default-avatar.png'} alt="" style={{ width: "44px", height: "44px", objectFit: "cover", borderRadius: "6px", border: "1px solid rgba(255,255,255,0.08)" }} onError={(e) => { e.target.src = "/assets/default-avatar.png"; }} />
                              </td>
                              <td style={{ ...tdStyle, fontWeight: "600", minWidth: "220px", maxWidth: "340px" }}>{v.caption || "Untitled"}</td>
                              <td style={{ ...tdStyle, textTransform: "capitalize" }}>
                                <span style={{ background: "#27272a", color: "#a1a1aa", borderRadius: "6px", padding: "2px 8px", fontSize: "11px", fontWeight: "700" }}>
                                  {v.category}
                                </span>
                              </td>
                              <td style={{ ...tdStyle, fontWeight: "700" }}>{(v.views || 0).toLocaleString()}</td>
                              <td style={{ ...tdStyle, color: "#71717a", minWidth: "110px", fontSize: "12px" }}>{new Date(v.created_at).toLocaleDateString()}</td>
                              <td style={tdStyle}>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button onClick={() => setEditingItem({ type: 'video', data: v })} style={iconBtnStyle} title="Edit Caption/Category"><Edit3 size={15} /></button>
                                  <button onClick={() => setDeleteWarning({ type: 'video', id: v.id, name: v.caption })} style={{ ...iconBtnStyle, color: "#f43f5e" }} title="Delete Clip"><Trash2 size={15} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {renderPagination({
                      currentPage,
                      totalPages: videosData.total_pages,
                      totalItems: videosData.total,
                      itemsPerPage: ITEMS_PER_PAGE,
                      onPageChange: setCurrentPage,
                      itemLabel: "clips"
                    })}
                  </div>
                </>
              )}

              {/* 🟢 USERS TAB */}
              {activeTab === "users" && (
                <>
                  <div style={{ ...gridStatsStyle, marginBottom: "24px" }}>
                    <StatCard title="Total Registered" value={(usersData.total || 0).toLocaleString()} subtitle="Registered platform accounts" icon={<Users size={20} color="#38bdf8" />} bg="rgba(56, 189, 248, 0.12)" />
                    <StatCard title="Premium VIP Tier" value={overview.premium_users || 0} subtitle={`${Math.round(((overview.premium_users || 0) / (usersData.total || 1)) * 100)}% conversion rate`} icon={<Star size={20} color="#fbbf24" />} bg="rgba(251, 191, 36, 0.12)" />
                    <StatCard title="Active Subscriptions" value={financials.active_subscriptions || 0} subtitle="Direct creator fan passes" icon={<Sparkles size={20} color="#34d399" />} bg="rgba(52, 211, 153, 0.12)" />
                    <StatCard title="Admin Accounts" value="1" subtitle="Privileged access" icon={<ShieldCheck size={20} color="#f43f5e" />} bg="rgba(225, 29, 72, 0.12)" />
                  </div>

                  <div style={tableContainerStyle}>
                    <div className="admin-table-scroll" onWheel={handleTableWheel} style={{ overflowX: "auto", width: "100%", WebkitOverflowScrolling: "touch" }}>
                      <table style={{ ...tableStyle, minWidth: "1050px" }}>
                        <thead>
                          <tr>
                            <th onClick={() => handleSort('username')} style={{ ...thStyle, cursor: "pointer" }}>Username <SortIcon columnKey="username" /></th>
                            <th onClick={() => handleSort('email')} style={{ ...thStyle, cursor: "pointer" }}>Email <SortIcon columnKey="email" /></th>
                            <th onClick={() => handleSort('is_premium')} style={{ ...thStyle, cursor: "pointer" }}>Tier <SortIcon columnKey="is_premium" /></th>
                            <th onClick={() => handleSort('role')} style={{ ...thStyle, cursor: "pointer" }}>Role <SortIcon columnKey="role" /></th>
                            <th onClick={() => handleSort('created_at')} style={{ ...thStyle, cursor: "pointer" }}>Joined <SortIcon columnKey="created_at" /></th>
                            <th style={thStyle}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(usersData.users || []).map(u => (
                            <tr key={u.id} style={trStyle}>
                              <td style={{ ...tdStyle, fontWeight: "600" }}>{u.username}</td>
                              <td style={{ ...tdStyle, color: "#a1a1aa" }}>{u.email}</td>
                              <td style={tdStyle}>{u.is_premium ? <span style={premiumBadge}>Premium</span> : <span style={freeBadge}>Free</span>}</td>
                              <td style={{ ...tdStyle, textTransform: "capitalize", color: u.role === 'admin' ? '#f43f5e' : '#a1a1aa' }}>{u.role}</td>
                              <td style={{ ...tdStyle, color: "#71717a", minWidth: "110px", fontSize: "12px" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                              <td style={tdStyle}>
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <button onClick={() => setEditingItem({ type: 'user', data: u })} style={iconBtnStyle} title="Edit User Tier/Role"><Edit3 size={15} /></button>
                                  <button onClick={() => setDeleteWarning({ type: 'user', id: u.id, name: u.username })} style={{ ...iconBtnStyle, color: "#f43f5e" }} title="Delete Account"><Trash2 size={15} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {renderPagination({
                      currentPage,
                      totalPages: usersData.total_pages,
                      totalItems: usersData.total,
                      itemsPerPage: ITEMS_PER_PAGE,
                      onPageChange: setCurrentPage,
                      itemLabel: "users"
                    })}
                  </div>
                </>
              )}

              {/* 🟢 TRANSACTIONS TAB */}
              {activeTab === "transactions" && (
                <>
                  <div style={{ ...gridStatsStyle, marginBottom: "24px" }}>
                    <StatCard 
                      title="Approved USD Crypto" 
                      value={`$${(financials.approved_usd || 0).toFixed(2)}`} 
                      subtitle={`${financials.approved_usd_count || 0} completed orders`} 
                      icon={<TrendingUp size={20} color="#34d399" />} 
                      bg="rgba(52, 211, 153, 0.12)" 
                    />
                    <StatCard 
                      title="Pending USD Crypto" 
                      value={`$${(financials.pending_crypto_usd || 0).toLocaleString()}`} 
                      subtitle={`${financials.pending_crypto_count || 0} orders awaiting block confirmation`} 
                      icon={<Clock size={20} color="#fbbf24" />} 
                      bg="rgba(251, 191, 36, 0.12)" 
                    />
                    <StatCard 
                      title="Approved NGN Bank" 
                      value={`₦${(financials.approved_ngn || 0).toLocaleString()}`} 
                      subtitle={`${financials.approved_ngn_count || 0} approved bank transfers`} 
                      icon={<CreditCard size={20} color="#38bdf8" />} 
                      bg="rgba(56, 189, 248, 0.12)" 
                    />
                    <StatCard 
                      title="Pending NGN Bank" 
                      value={`₦${(financials.pending_bank_ngn || 0).toLocaleString()}`} 
                      subtitle={`${financials.pending_bank_count || 0} transfers awaiting bank proof`} 
                      icon={<Clock size={20} color="#f43f5e" />} 
                      bg="rgba(225, 29, 72, 0.12)" 
                    />
                  </div>

                  {/* Currency & Status Filter */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {[
                        { id: "all", label: "All Currencies" },
                        { id: "USD", label: "USD Crypto (< ₦1k)" },
                        { id: "NGN", label: "NGN Bank (≥ ₦1k)" }
                      ].map(c => (
                        <button
                          key={c.id}
                          onClick={() => { setTxCurrencyFilter(c.id); setCurrentPage(1); }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                            border: "1px solid",
                            borderColor: txCurrencyFilter === c.id ? "rgba(244, 63, 94, 0.4)" : "rgba(255,255,255,0.08)",
                            background: txCurrencyFilter === c.id ? "rgba(244, 63, 94, 0.12)" : "#18181b",
                            color: txCurrencyFilter === c.id ? "#f43f5e" : "#a1a1aa"
                          }}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>

                    <div style={{ display: "flex", gap: "6px" }}>
                      {[
                        { id: "all", label: "All Statuses" },
                        { id: "APPROVED", label: "Approved Only" },
                        { id: "PENDING", label: "Pending Review" }
                      ].map(s => (
                        <button
                          key={s.id}
                          onClick={() => { setTxStatusFilter(s.id); setCurrentPage(1); }}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                            border: "1px solid",
                            borderColor: txStatusFilter === s.id ? "rgba(52, 211, 153, 0.4)" : "rgba(255,255,255,0.08)",
                            background: txStatusFilter === s.id ? "rgba(52, 211, 153, 0.12)" : "#18181b",
                            color: txStatusFilter === s.id ? "#34d399" : "#a1a1aa"
                          }}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div style={tableContainerStyle}>
                    <div className="admin-table-scroll" onWheel={handleTableWheel} style={{ overflowX: "auto", width: "100%", WebkitOverflowScrolling: "touch" }}>
                      <table style={{ ...tableStyle, minWidth: "1050px" }}>
                        <thead>
                          <tr>
                            <th onClick={() => handleSort('username')} style={{ ...thStyle, cursor: "pointer" }}>User <SortIcon columnKey="username" /></th>
                            <th onClick={() => handleSort('amount')} style={{ ...thStyle, cursor: "pointer" }}>Amount <SortIcon columnKey="amount" /></th>
                            <th onClick={() => handleSort('payment_method')} style={{ ...thStyle, cursor: "pointer" }}>Method / Rail <SortIcon columnKey="payment_method" /></th>
                            <th onClick={() => handleSort('status')} style={{ ...thStyle, cursor: "pointer" }}>Status <SortIcon columnKey="status" /></th>
                            <th onClick={() => handleSort('created_at')} style={{ ...thStyle, cursor: "pointer" }}>Timestamp <SortIcon columnKey="created_at" /></th>
                          </tr>
                        </thead>
                        <tbody>
                          {(txData.transactions || []).map(tx => {
                            const isNgn = Number(tx.amount) >= 1000;
                            return (
                              <tr key={tx.id} style={trStyle}>
                                <td style={{ ...tdStyle, fontWeight: "600" }}>{tx.username || tx.email || "Unknown User"}</td>
                                <td style={{ ...tdStyle, fontWeight: "700", minWidth: "140px" }}>
                                  {isNgn ? `₦${Number(tx.amount).toLocaleString()}` : `$${Number(tx.amount).toFixed(2)}`}
                                  {tx.crypto_currency && (
                                    <div style={{ fontSize: "11px", color: "#71717a", fontWeight: "400" }}>
                                      {tx.crypto_amount} {tx.crypto_currency?.toUpperCase()}
                                    </div>
                                  )}
                                </td>
                                <td style={tdStyle}>
                                  <span style={{ background: "#27272a", color: "#a1a1aa", borderRadius: "6px", padding: "2px 8px", fontSize: "11px", fontWeight: "700" }}>
                                    {isNgn ? "BANK TRANSFER" : `${(tx.crypto_currency || 'CRYPTO').toUpperCase()}`}
                                  </span>
                                </td>
                                <td style={tdStyle}>
                                  {tx.status === 'APPROVED' && <span style={approvedBadge}>Approved</span>}
                                  {tx.status === 'WAITING' && <span style={waitingBadge}>Awaiting</span>}
                                  {(tx.status === 'FAILED' || tx.status === 'PENDING') && <span style={pendingBadgeStyle}>Pending</span>}
                                </td>
                                <td style={{ ...tdStyle, color: "#71717a", minWidth: "150px", fontSize: "12px" }}>
                                  {new Date(tx.created_at).toLocaleString()}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {renderPagination({
                      currentPage,
                      totalPages: txData.total_pages,
                      totalItems: txData.total,
                      itemsPerPage: ITEMS_PER_PAGE,
                      onPageChange: setCurrentPage,
                      itemLabel: "orders"
                    })}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* STORY VIEWERS INSPECTOR MODAL */}
      {viewersModalData && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalBoxStyle, maxWidth: "560px", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
            <div style={modalHeaderStyle}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Users size={18} color="#f43f5e" />
                  <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#f4f4f5" }}>
                    {viewersModalData.type === 'story' ? `Story Viewers Log (#${viewersModalData.item.id})` : `All Story Viewers (@${viewersModalData.item.creator_username || viewersModalData.item.username})`}
                  </h2>
                </div>
                {viewersModalData.type === 'story' && viewersModalData.item.sound_title && (
                  <div style={{ fontSize: "12px", color: "#a1a1aa", marginTop: "3px", display: "flex", alignItems: "center", gap: "5px" }}>
                    <Music size={12} color="#f43f5e" /> {viewersModalData.item.sound_title}
                  </div>
                )}
              </div>
              <X size={20} cursor="pointer" onClick={() => setViewersModalData(null)} color="#71717a" />
            </div>

            {/* Quick Metrics Bar */}
            <div style={{ display: "flex", gap: "12px", background: "#27272a", borderRadius: "8px", padding: "10px 14px", marginBottom: "14px" }}>
              <div>
                <div style={{ fontSize: "10px", color: "#71717a", textTransform: "uppercase", fontWeight: "700" }}>Total Views</div>
                <div style={{ fontSize: "16px", fontWeight: "800", color: "#f4f4f5" }}>
                  {(viewersModalData.viewers || []).length}
                </div>
              </div>
              <div>
                <div style={{ fontSize: "10px", color: "#71717a", textTransform: "uppercase", fontWeight: "700" }}>Unique Viewers</div>
                <div style={{ fontSize: "16px", fontWeight: "800", color: "#34d399" }}>
                  {new Set((viewersModalData.viewers || []).map(v => v.user_id)).size} users
                </div>
              </div>
              {viewersModalData.type === 'story' && viewersModalData.item.expires_at && (
                <div>
                  <div style={{ fontSize: "10px", color: "#71717a", textTransform: "uppercase", fontWeight: "700" }}>Status</div>
                  <div style={{ fontSize: "12px", fontWeight: "700", marginTop: "2px", color: viewersModalData.item.is_currently_active ? "#34d399" : "#71717a" }}>
                    {viewersModalData.item.is_currently_active ? "● ACTIVE LIVE" : "● EXPIRED"}
                  </div>
                </div>
              )}
            </div>

            {/* Filter Search */}
            <div style={{ marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px", background: "#27272a", padding: "7px 12px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.08)" }}>
              <Search size={14} color="#71717a" />
              <input
                type="text"
                placeholder="Search viewers by name, @handle or email..."
                value={viewerSearchFilter}
                onChange={(e) => setViewerSearchFilter(e.target.value)}
                style={{ background: "transparent", border: "none", color: "#f4f4f5", outline: "none", width: "100%", fontSize: "12px" }}
              />
              {viewerSearchFilter && <X size={12} color="#71717a" style={{ cursor: "pointer" }} onClick={() => setViewerSearchFilter("")} />}
            </div>

            {/* Viewers List */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
              {viewersModalData.loading ? (
                <div style={{ padding: "40px", textAlign: "center" }}><RefreshCw size={28} color="#f43f5e" style={{ animation: "spin 1s linear infinite" }} /></div>
              ) : filteredModalViewers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 20px", color: "#71717a", fontSize: "13px" }}>
                  {viewerSearchFilter ? "No matching viewers found." : "No views recorded yet for this story."}
                </div>
              ) : (
                paginatedModalViewers.map(v => (
                  <div 
                    key={v.view_id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "#27272a",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      border: "1px solid rgba(255,255,255,0.04)"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <img 
                        src={v.avatar_url || '/assets/default-avatar.png'} 
                        alt="" 
                        style={{ width: "34px", height: "34px", borderRadius: "50%", objectFit: "cover" }}
                        onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                      />
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontWeight: "700", color: "#f4f4f5", fontSize: "13px" }}>
                            {v.display_name || v.username || "Anonymous"}
                          </span>
                          {v.is_premium ? (
                            <span style={{ ...premiumBadge, fontSize: "9px", padding: "1px 5px" }}>VIP</span>
                          ) : (
                            <span style={{ ...freeBadge, fontSize: "9px", padding: "1px 5px" }}>FREE</span>
                          )}
                        </div>
                        <div style={{ fontSize: "11px", color: "#71717a" }}>
                          {v.email || `@${v.username}`}
                        </div>
                        {v.sound_title && (
                          <div style={{ fontSize: "10px", color: "#a1a1aa", marginTop: "2px" }}>
                            Story: {v.sound_title}
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "11px", fontWeight: "700", color: "#f4f4f5" }}>
                        {formatRelativeTime(v.viewed_at)}
                      </div>
                      <div style={{ fontSize: "10px", color: "#71717a", marginTop: "1px" }}>
                        {new Date(v.viewed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Pagination */}
            {filteredModalViewers.length > viewersModalLimit && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: "12px", marginTop: "10px" }}>
                <span style={{ fontSize: "11px", color: "#71717a" }}>
                  Showing {Math.min((viewersModalPage - 1) * viewersModalLimit + 1, filteredModalViewers.length)} - {Math.min(viewersModalPage * viewersModalLimit, filteredModalViewers.length)} of {filteredModalViewers.length} viewers
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <button
                    disabled={viewersModalPage === 1}
                    onClick={() => setViewersModalPage(p => p - 1)}
                    style={viewersModalPage === 1 ? pageBtnDisabledStyle : pageBtnStyle}
                    title="Previous"
                  >
                    <ChevronLeft size={13} />
                  </button>
                  <span style={{ fontSize: "11px", color: "#f4f4f5", fontWeight: "700", padding: "0 4px" }}>
                    {viewersModalPage} / {totalModalViewersPages}
                  </span>
                  <button
                    disabled={viewersModalPage >= totalModalViewersPages}
                    onClick={() => setViewersModalPage(p => p + 1)}
                    style={viewersModalPage >= totalModalViewersPages ? pageBtnDisabledStyle : pageBtnStyle}
                    title="Next"
                  >
                    <ChevronRight size={13} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* STORY VIDEO PLAYER PREVIEW MODAL */}
      {storyPreviewModal && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalBoxStyle, maxWidth: "400px", padding: "16px", background: "#09090b" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div>
                <div style={{ fontWeight: "800", color: "#f4f4f5", fontSize: "14px" }}>
                  @{storyPreviewModal.username} Story Reel
                </div>
                {storyPreviewModal.sound_title && (
                  <div style={{ fontSize: "11px", color: "#a1a1aa", display: "flex", alignItems: "center", gap: "4px" }}>
                    <Music size={11} color="#f43f5e" /> {storyPreviewModal.sound_title}
                  </div>
                )}
              </div>
              <X size={20} cursor="pointer" onClick={() => setStoryPreviewModal(null)} color="#71717a" />
            </div>

            <div style={{ width: "100%", maxHeight: "72vh", borderRadius: "10px", overflow: "hidden", background: "#000", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <video 
                src={storyPreviewModal.video_url} 
                controls 
                autoPlay 
                playsInline
                style={{ width: "100%", maxHeight: "72vh", objectFit: "contain" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Item Edit Modal */}
      {editingItem && (
        <div style={modalOverlayStyle}>
          <form onSubmit={handleSaveEdit} style={modalBoxStyle}>
            <div style={modalHeaderStyle}>
              <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#f4f4f5" }}>
                Edit {editingItem.type === 'video' ? 'Video Metadata' : 'User Privileges'}
              </h2>
              <X size={20} cursor="pointer" onClick={() => setEditingItem(null)} color="#71717a"/>
            </div>

            {editingItem.type === 'video' ? (
              <>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Caption</label>
                  <input type="text" value={editingItem.data.caption || ""} onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, caption: e.target.value}})} style={formInputStyle} />
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Category</label>
                  <select value={editingItem.data.category || ""} onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, category: e.target.value}})} style={formInputStyle}>
                    {APP_CONFIG.categories?.map((cat) => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                    <option value="premium">Premium</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>User Role</label>
                  <select value={editingItem.data.role || "user"} onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, role: e.target.value}})} style={formInputStyle}>
                    <option value="user">Standard User</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Premium Membership Tier</label>
                  <select value={editingItem.data.is_premium ? "true" : "false"} onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, is_premium: e.target.value === "true"}})} style={formInputStyle}>
                    <option value="false">Free Tier</option>
                    <option value="true">Premium VIP Tier</option>
                  </select>
                </div>
                <div style={inputGroupStyle}>
                  <label style={labelStyle}>Account Moderation Status</label>
                  <select value={editingItem.data.is_banned ? "true" : "false"} onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, is_banned: e.target.value === "true"}})} style={formInputStyle}>
                    <option value="false">Active / Normal</option>
                    <option value="true">Banned / Suspended</option>
                  </select>
                </div>
              </>
            )}
            <button type="submit" style={saveBtnStyle}>Save Changes</button>
          </form>
        </div>
      )}

      {/* Creator Edit Modal */}
      {editingCreator && (
        <div style={modalOverlayStyle}>
          <form onSubmit={handleSaveCreatorEdit} style={{ ...modalBoxStyle, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={modalHeaderStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={18} color="#f43f5e" />
                <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#f4f4f5" }}>
                  Edit Creator @{editingCreator.username}
                </h2>
              </div>
              <X size={20} cursor="pointer" onClick={() => setEditingCreator(null)} color="#71717a"/>
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Display Name</label>
              <input 
                type="text" 
                value={editingCreator.display_name || ""} 
                onChange={e => setEditingCreator({ ...editingCreator, display_name: e.target.value })} 
                style={formInputStyle} 
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Username (@handle)</label>
              <input 
                type="text" 
                value={editingCreator.username || ""} 
                onChange={e => setEditingCreator({ ...editingCreator, username: e.target.value })} 
                style={formInputStyle} 
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Creator Origin</label>
              <select 
                value={editingCreator.is_managed ? "true" : "false"} 
                onChange={e => setEditingCreator({ ...editingCreator, is_managed: e.target.value === "true" })} 
                style={formInputStyle}
              >
                <option value="true">Telegram Funnel / Managed Creator</option>
                <option value="false">Registered Web Creator</option>
              </select>
            </div>

            <div style={inputGroupStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label style={labelStyle}>Telegram Channel / Handle</label>
                <button
                  type="button"
                  disabled={syncingSingleCreator}
                  onClick={handleFetchTelegramProfile}
                  style={{
                    background: "#27272a",
                    border: "1px solid rgba(56, 189, 248, 0.3)",
                    color: "#38bdf8",
                    borderRadius: "6px",
                    padding: "3px 8px",
                    fontSize: "11px",
                    fontWeight: "600",
                    cursor: syncingSingleCreator ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <RefreshCw size={11} className={syncingSingleCreator ? "animate-spin" : ""} />
                  {syncingSingleCreator ? "Fetching..." : "Fetch Telegram Profile"}
                </button>
              </div>
              <input 
                type="text" 
                value={editingCreator.source_channel || ""} 
                onChange={e => setEditingCreator({ ...editingCreator, source_channel: e.target.value })} 
                placeholder="@channel_name or https://t.me/channel_name"
                style={formInputStyle} 
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Category</label>
              <select 
                value={editingCreator.creator_category || "Creator"} 
                onChange={e => setEditingCreator({ ...editingCreator, creator_category: e.target.value })} 
                style={formInputStyle}
              >
                <option value="Creator">General Creator</option>
                <option value="Model">Model</option>
                <option value="Influencer">Influencer</option>
                <option value="Dancer">Dancer</option>
                <option value="Fitness">Fitness</option>
                <option value="Blogger">Blogger</option>
                <option value="Musician">Musician</option>
              </select>
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Monthly Subscription Price ($ USD)</label>
              <input 
                type="number" 
                min={0}
                step={1}
                value={editingCreator.subscription_price || 0} 
                onChange={e => setEditingCreator({ ...editingCreator, subscription_price: e.target.value })} 
                style={formInputStyle} 
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Official Verified Badge</label>
              <select 
                value={editingCreator.is_verified ? "true" : "false"} 
                onChange={e => setEditingCreator({ ...editingCreator, is_verified: e.target.value === "true" })} 
                style={formInputStyle}
              >
                <option value="true">Verified Checkmark</option>
                <option value="false">Unverified</option>
              </select>
            </div>

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Bio / Description</label>
              <textarea 
                rows={3} 
                value={editingCreator.creator_bio || ""} 
                onChange={e => setEditingCreator({ ...editingCreator, creator_bio: e.target.value })} 
                style={{ ...formInputStyle, resize: "none" }} 
              />
            </div>

            <button type="submit" style={saveBtnStyle}>Save Creator Profile</button>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteWarning && (
        <div style={modalOverlayStyle}>
          <div style={{ ...modalBoxStyle, textAlign: "center", maxWidth: "340px" }}>
            <AlertTriangle size={40} color="#f43f5e" style={{ margin: "0 auto 12px auto" }} />
            <h2 style={{ margin: "0 0 8px 0", color: "#f4f4f5", fontSize: "16px", fontWeight: "800" }}>Confirm Deletion</h2>
            <p style={{ color: "#a1a1aa", fontSize: "13px", marginBottom: "20px" }}>
              Permanently delete <strong>"{deleteWarning.name}"</strong>? This action cannot be reversed.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteWarning(null)} style={{ flex: 1, padding: "10px", background: "#27272a", border: "none", color: "#f4f4f5", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" }}>
                Cancel
              </button>
              <button onClick={handleDelete} style={{ flex: 1, padding: "10px", background: "#f43f5e", border: "none", color: "#d4d4d8", borderRadius: "8px", cursor: "pointer", fontWeight: "700", fontSize: "13px" }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Interactive SVG Time-Series Chart Component
// -------------------------------------------------------------
function InteractiveTimeSeriesChart({ data = [], metric = "signups" }) {
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const containerRef = useRef(null);

  if (!data || data.length === 0) {
    return (
      <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center", color: "#71717a", fontSize: "13px" }}>
        No historical telemetry available for this timeframe.
      </div>
    );
  }

  // Metric configuration
  const config = {
    signups: { label: "User Registrations", color: "#f43f5e", fillGradient: "signupsGrad" },
    uploads: { label: "Catalog Video Uploads", color: "#38bdf8", fillGradient: "uploadsGrad" },
    stories: { label: "24h Stories Published", color: "#34d399", fillGradient: "storiesGrad" },
    revenue: { label: "USD Crypto Revenue", color: "#fbbf24", fillGradient: "revenueGrad" }
  }[metric] || { label: "Metric", color: "#f43f5e", fillGradient: "signupsGrad" };

  const values = data.map(d => {
    if (metric === "revenue") return Number(d.usd_rev || 0);
    return Number(d[metric] || 0);
  });

  const total = values.reduce((sum, v) => sum + v, 0);
  const avg = Math.round(total / values.length);
  const maxVal = Math.max(...values, 5);
  const peakDayIdx = values.indexOf(Math.max(...values));
  const peakDate = data[peakDayIdx]?.label || "N/A";
  const peakVal = values[peakDayIdx] || 0;

  // Chart coordinates
  const width = 800;
  const height = 220;
  const paddingX = 40;
  const paddingTop = 20;
  const paddingBottom = 30;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingTop - paddingBottom;

  const points = data.map((d, i) => {
    const x = paddingX + (i / Math.max(1, data.length - 1)) * chartW;
    const y = paddingTop + chartH - (values[i] / maxVal) * chartH;
    return { x, y, value: values[i], date: d.label || d.date, rawDate: d.date };
  });

  // Construct smooth SVG path
  let pathD = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i];
    const p1 = points[i + 1];
    const cpX1 = p0.x + (p1.x - p0.x) / 2;
    const cpY1 = p0.y;
    const cpX2 = p0.x + (p1.x - p0.x) / 2;
    const cpY2 = p1.y;
    pathD += ` C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${p1.x} ${p1.y}`;
  }

  const areaD = `${pathD} L ${points[points.length - 1].x} ${paddingTop + chartH} L ${points[0].x} ${paddingTop + chartH} Z`;

  // Mouse move handler for crosshair
  const handleMouseMove = (e) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const svgX = (mouseX / rect.width) * width;

    let closest = points[0];
    let minDist = Math.abs(points[0].x - svgX);
    for (let p of points) {
      const dist = Math.abs(p.x - svgX);
      if (dist < minDist) {
        minDist = dist;
        closest = p;
      }
    }
    setHoveredPoint(closest);
  };

  return (
    <div>
      {/* Mini KPI summary bar */}
      <div style={{ display: "flex", gap: "24px", marginBottom: "16px", flexWrap: "wrap" }}>
        <div>
          <span style={{ fontSize: "11px", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.5px" }}>Range Aggregate:</span>
          <div style={{ fontSize: "16px", fontWeight: "800", color: "#f4f4f5" }}>
            {metric === "revenue" ? `$${total.toFixed(2)}` : total.toLocaleString()}
          </div>
        </div>
        <div>
          <span style={{ fontSize: "11px", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.5px" }}>Daily Velocity:</span>
          <div style={{ fontSize: "16px", fontWeight: "800", color: "#f4f4f5" }}>
            {metric === "revenue" ? `$${avg}/day` : `${avg}/day`}
          </div>
        </div>
        <div>
          <span style={{ fontSize: "11px", color: "#71717a", textTransform: "uppercase", letterSpacing: "0.5px" }}>Peak Day:</span>
          <div style={{ fontSize: "16px", fontWeight: "800", color: config.color }}>
            {metric === "revenue" ? `$${peakVal.toFixed(2)}` : peakVal.toLocaleString()} <span style={{ fontSize: "12px", color: "#71717a", fontWeight: "500" }}>({peakDate})</span>
          </div>
        </div>
      </div>

      {/* Responsive SVG Container */}
      <div 
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoveredPoint(null)}
        style={{ position: "relative", width: "100%", height: "220px", cursor: "crosshair" }}
      >
        <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" style={{ width: "100%", height: "100%", overflow: "visible" }}>
          <defs>
            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={config.color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={config.color} stopOpacity="0.01" />
            </linearGradient>
          </defs>

          {/* Grid lines */}
          {[0, 0.5, 1].map((ratio, i) => {
            const y = paddingTop + chartH * (1 - ratio);
            return (
              <g key={i}>
                <line x1={paddingX} y1={y} x2={width - paddingX} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="3 3" />
                <text x={paddingX - 8} y={y + 3} fill="#71717a" fontSize="10" textAnchor="end" fontFamily="sans-serif">
                  {metric === "revenue" ? `$${Math.round(maxVal * ratio)}` : Math.round(maxVal * ratio)}
                </text>
              </g>
            );
          })}

          {/* Area Fill */}
          <path d={areaD} fill="url(#chartGradient)" />

          {/* Line Stroke */}
          <path d={pathD} fill="none" stroke={config.color} strokeWidth="2.5" strokeLinecap="round" />

          {/* X-axis date labels */}
          {points.filter((_, i) => i % Math.ceil(points.length / 6) === 0 || i === points.length - 1).map((p, i) => (
            <text key={i} x={p.x} y={height - 8} fill="#71717a" fontSize="10" textAnchor="middle" fontFamily="sans-serif">
              {p.date}
            </text>
          ))}

          {/* Hover Crosshair & Dot */}
          {hoveredPoint && (
            <g>
              <line x1={hoveredPoint.x} y1={paddingTop} x2={hoveredPoint.x} y2={paddingTop + chartH} stroke="rgba(255,255,255,0.25)" strokeDasharray="2 2" />
              <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="5" fill={config.color} stroke="#09090b" strokeWidth="2" />
              <circle cx={hoveredPoint.x} cy={hoveredPoint.y} r="9" fill={config.color} opacity="0.3" />
            </g>
          )}
        </svg>

        {/* Floating Tooltip */}
        {hoveredPoint && (
          <div 
            style={{
              position: "absolute",
              left: `${(hoveredPoint.x / width) * 100}%`,
              top: `${Math.max(10, ((hoveredPoint.y - 45) / height) * 100)}%`,
              transform: "translate(-50%, -50%)",
              background: "#18181b",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "8px",
              padding: "6px 10px",
              pointerEvents: "none",
              boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
              whiteSpace: "nowrap",
              zIndex: 10
            }}
          >
            <div style={{ fontSize: "10px", color: "#71717a", fontWeight: "600" }}>{hoveredPoint.date}</div>
            <div style={{ fontSize: "13px", fontWeight: "800", color: config.color, marginTop: "1px" }}>
              {metric === "revenue" ? `$${hoveredPoint.value.toFixed(2)}` : hoveredPoint.value.toLocaleString()} {config.label.split(" ")[0]}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// Proportional Category Distribution Bar
// -------------------------------------------------------------
function CategoryDistributionBar({ categories = [], totalVideos = 1, onSelectCategory, selectedCategory }) {
  const palette = ["#f43f5e", "#38bdf8", "#fbbf24", "#34d399", "#818cf8", "#a78bfa", "#f472b6", "#94a3b8"];

  return (
    <div>
      <div style={{ display: "flex", height: "12px", borderRadius: "6px", overflow: "hidden", background: "#27272a", gap: "1px" }}>
        {categories.map((c, i) => {
          const pct = Math.max(0.5, ((c.count || 0) / totalVideos) * 100);
          const color = palette[i % palette.length];
          const isSelected = selectedCategory?.category === c.category;
          return (
            <div
              key={c.category}
              onClick={() => onSelectCategory(c)}
              style={{
                width: `${pct}%`,
                background: color,
                opacity: selectedCategory ? (isSelected ? 1 : 0.35) : 0.85,
                cursor: "pointer",
                transition: "opacity 0.2s"
              }}
              title={`${c.category}: ${c.count.toLocaleString()} videos (${pct.toFixed(1)}%)`}
            />
          );
        })}
      </div>

      {selectedCategory && (
        <div style={{ marginTop: "10px", background: "#27272a", borderRadius: "8px", padding: "8px 12px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#f4f4f5", textTransform: "capitalize" }}>
              {selectedCategory.category}
            </span>
            <span style={{ fontSize: "11px", color: "#a1a1aa", marginLeft: "8px" }}>
              {selectedCategory.count.toLocaleString()} videos ({(((selectedCategory.count || 0) / totalVideos) * 100).toFixed(1)}%) • {(selectedCategory.views || 0).toLocaleString()} views
            </span>
          </div>
          <button onClick={() => onSelectCategory(null)} style={{ border: "none", background: "transparent", color: "#71717a", cursor: "pointer", padding: "2px" }}>
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// Helper Formatters
// -------------------------------------------------------------
function formatTimeRemaining(seconds) {
  if (!seconds || seconds <= 0) return "Expired";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m left`;
  return `${mins}m left`;
}

function formatRelativeTime(dateString) {
  if (!dateString) return "";
  const now = new Date();
  const past = new Date(dateString);
  const diffSec = Math.floor((now - past) / 1000);
  if (diffSec < 60) return "Just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  const days = Math.floor(diffSec / 86400);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return past.toLocaleDateString();
}

// -------------------------------------------------------------
// Sub-Components & Rows
// -------------------------------------------------------------
const SidebarBtn = ({ active, onClick, icon, label, count, badge }) => (
  <button 
    onClick={onClick} 
    style={{ 
      display: "flex", 
      alignItems: "center", 
      justifyContent: "space-between",
      width: "100%", 
      padding: "10px 14px", 
      borderRadius: "8px", 
      border: "none", 
      cursor: "pointer", 
      fontSize: "14px", 
      fontWeight: "600", 
      transition: "all 0.15s ease", 
      background: active ? "rgba(244, 63, 94, 0.12)" : "transparent", 
      color: active ? "#f43f5e" : "#a1a1aa" 
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
      {icon} <span>{label}</span>
    </div>
    {badge ? (
      <span style={{ background: "#f43f5e", color: "#d4d4d8", fontSize: "10px", fontWeight: "800", padding: "1px 6px", borderRadius: "10px" }}>
        {badge}
      </span>
    ) : count !== undefined ? (
      <span style={{ color: "#71717a", fontSize: "11px" }}>
        {Number(count).toLocaleString()}
      </span>
    ) : null}
  </button>
);

const StatCard = ({ title, value, subtitle, icon, bg }) => (
  <div style={{ background: "#18181b", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "20px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
    <div>
      <div style={{ color: "#71717a", fontSize: "12px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>{title}</div>
      <div style={{ color: "#f4f4f5", fontSize: "26px", fontWeight: "800", letterSpacing: "-0.5px" }}>{value}</div>
      {subtitle && <div style={{ color: "#a1a1aa", fontSize: "12px", marginTop: "4px" }}>{subtitle}</div>}
    </div>
    <div style={{ background: bg, padding: "10px", borderRadius: "10px", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
  </div>
);

const StorageRow = ({ name, count, total, color }) => {
  const pct = Math.max(1, ((count / total) * 100).toFixed(1));
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "3px" }}>
        <span style={{ color: "#f4f4f5", fontWeight: "600" }}>{name}</span>
        <span style={{ color: "#71717a" }}>{count.toLocaleString()} ({pct}%)</span>
      </div>
      <div style={{ height: "6px", background: "#27272a", borderRadius: "3px", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: "3px" }} />
      </div>
    </div>
  );
};

const EngagementCard = ({ title, count, icon }) => (
  <div style={{ background: "#27272a", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "8px", padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
    <div>
      <div style={{ fontSize: "11px", color: "#71717a" }}>{title}</div>
      <div style={{ fontSize: "14px", fontWeight: "700", color: "#f4f4f5", marginTop: "2px" }}>{count.toLocaleString()}</div>
    </div>
    {icon}
  </div>
);

// -------------------------------------------------------------
// Executive Calm Dark Styles
// -------------------------------------------------------------
const dashboardContainerStyle = { display: "flex", height: "100%", maxHeight: "100%", width: "100vw", background: "#09090b", color: "#f4f4f5", position: "fixed", zIndex: 999999, top: 0, left: 0, right: 0, bottom: 0, overflow: "hidden", fontFamily: "system-ui, -apple-system, sans-serif" };
const sidebarStyle = { width: "260px", height: "100%", background: "#09090b", borderRight: "1px solid rgba(255,255,255,0.06)", padding: "24px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between", flexShrink: 0, overflowY: "auto" };
const logoStyle = { margin: 0, fontSize: "18px", fontWeight: "900", letterSpacing: "-0.5px", color: "#f4f4f5" };
const mainContentStyle = { flex: 1, display: "flex", flexDirection: "column", height: "100%", maxHeight: "100%", minHeight: 0, minWidth: 0, width: "100%", position: "relative", overflow: "hidden" };
const topBarStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 30px", borderBottom: "1px solid rgba(255,255,255,0.06)", background: "#09090b", minWidth: 0, flexShrink: 0 };
const contentAreaStyle = { flex: 1, height: "100%", minHeight: 0, minWidth: 0, width: "100%", overflowY: "auto", overflowX: "hidden", WebkitOverflowScrolling: "touch", overscrollBehaviorY: "contain", touchAction: "pan-y", padding: "30px", background: "#09090b" };
const gridStatsStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" };
const cardContainerStyle = { background: "#18181b", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", padding: "22px" };
const tableContainerStyle = { background: "#18181b", border: "1px solid rgba(255,255,255,0.06)", borderRadius: "14px", overflow: "hidden", position: "relative" };
const tableNavBtnStyle = { background: "#27272a", border: "1px solid rgba(255,255,255,0.08)", color: "#f4f4f5", padding: "5px 8px", borderRadius: "6px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s ease" };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { textAlign: "left", padding: "14px 18px", color: "#71717a", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "1px solid rgba(255,255,255,0.06)", userSelect: "none", whiteSpace: "nowrap" };
const trStyle = { borderBottom: "1px solid rgba(255,255,255,0.04)" };
const tdStyle = { padding: "12px 18px", fontSize: "13px", color: "#f4f4f5" };
const badgeStyle = { padding: "2px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: "700" };
const premiumBadge = { ...badgeStyle, background: "rgba(244, 63, 94, 0.12)", color: "#f43f5e" };
const freeBadge = { ...badgeStyle, background: "#27272a", color: "#a1a1aa" };
const approvedBadge = { ...badgeStyle, background: "rgba(52, 211, 153, 0.12)", color: "#34d399" };
const waitingBadge = { ...badgeStyle, background: "rgba(251, 191, 36, 0.12)", color: "#fbbf24" };
const pendingBadgeStyle = { ...badgeStyle, background: "#27272a", color: "#a1a1aa" };
const iconBtnStyle = { background: "#27272a", border: "none", color: "#f4f4f5", padding: "6px", borderRadius: "6px", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" };
const reportActionBtn = { border: "1px solid", borderRadius: "6px", padding: "4px 8px", fontSize: "11px", fontWeight: "700", cursor: "pointer" };
const searchBarStyle = { display: "flex", alignItems: "center", gap: "8px", background: "#18181b", border: "1px solid rgba(255,255,255,0.08)", padding: "7px 12px", borderRadius: "8px", width: "300px" };
const searchInputStyle = { background: "transparent", border: "none", color: "#f4f4f5", outline: "none", width: "100%", fontSize: "13px" };
const logoutBtnStyle = { display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", background: "#18181b", color: "#a1a1aa", border: "1px solid rgba(255,255,255,0.06)", padding: "10px", borderRadius: "8px", fontWeight: "600", fontSize: "13px", cursor: "pointer", width: "100%" };
const refreshBtnStyle = { display: "flex", alignItems: "center", gap: "6px", background: "#18181b", border: "1px solid rgba(255,255,255,0.08)", color: "#f4f4f5", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "600" };
const uploadBtnStyle = { display: "flex", alignItems: "center", gap: "6px", background: "#f43f5e", color: "#d4d4d8", border: "none", padding: "8px 14px", borderRadius: "8px", cursor: "pointer", fontSize: "13px", fontWeight: "700" };
const centerFlex = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "300px" };
const errorScreenStyle = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100dvh", width: "100vw", background: "#09090b", color: "#f43f5e", position: "absolute", zIndex: 999999, top: 0, left: 0 };
const goBackBtnStyle = { background: "#f4f4f5", color: "#09090b", padding: "10px 24px", borderRadius: "8px", border: "none", fontWeight: "700", cursor: "pointer", fontSize: "14px" };
const modalOverlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", backdropFilter: "blur(6px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999999 };
const modalBoxStyle = { background: "#18181b", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "14px", padding: "22px", width: "100%", maxWidth: "420px", margin: "0 15px", boxShadow: "0 10px 40px rgba(0,0,0,0.9)" };
const modalHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px" };
const inputGroupStyle = { display: "flex", flexDirection: "column", gap: "5px", marginBottom: "14px" };
const labelStyle = { fontSize: "11px", color: "#a1a1aa", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px" };
const formInputStyle = { background: "#27272a", border: "1px solid rgba(255,255,255,0.08)", padding: "10px", borderRadius: "8px", color: "#f4f4f5", fontSize: "13px", outline: "none" };
const saveBtnStyle = { width: "100%", background: "#f43f5e", color: "#d4d4d8", border: "none", padding: "11px", borderRadius: "8px", fontWeight: "700", fontSize: "14px", cursor: "pointer", marginTop: "8px" };
const paginationStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 18px", background: "#18181b", borderTop: "1px solid rgba(255,255,255,0.06)" };
const pageBtnStyle = { background: "#27272a", border: "none", color: "#f4f4f5", padding: "5px 14px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontWeight: "600" };
const pageBtnDisabledStyle = { ...pageBtnStyle, opacity: 0.3, cursor: "not-allowed" };
const pageTextStyle = { fontSize: "12px", color: "#71717a", fontWeight: "600" };
