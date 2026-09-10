import React, { useState, useEffect, useMemo } from "react";
import { 
  LayoutDashboard, Users, CreditCard, LogOut, TrendingUp, ShieldCheck, 
  Clock, RefreshCw, UploadCloud, Video, Search, Edit3, Trash2, ChevronUp, ChevronDown, X, AlertTriangle, Menu,
  PlayCircle, Eye, PieChart, Activity, Star, Percent, Sparkles, CheckCircle, CheckCircle2, Heart, ExternalLink, DollarSign
} from "lucide-react";
import AdminUpload from "./AdminUpload"; 

import { APP_CONFIG } from "../config";

export default function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [searchQuery, setSearchQuery] = useState("");
  const [globalSearchResults, setGlobalSearchResults] = useState(null);
  const [isSearching, setIsSearching] = useState(false);

  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 20;
  
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null); 
  const [editingCreator, setEditingCreator] = useState(null);
  const [updatingCreatorId, setUpdatingCreatorId] = useState(null);
  const [deleteWarning, setDeleteWarning] = useState(null); 

  const [stats, setStats] = useState({ total_users: 0, premium_users: 0, total_revenue_usd: 0, pending_crypto_orders: 0 });
  const [usersList, setUsersList] = useState([]);
  const [creatorsList, setCreatorsList] = useState([]);
  const [creatorStats, setCreatorStats] = useState(null);
  const [creatorFilter, setCreatorFilter] = useState("all");
  const [creatorCategoryFilter, setCreatorCategoryFilter] = useState("all");
  const [syncingTelegram, setSyncingTelegram] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [videosList, setVideosList] = useState([]);

  // 🟢 DEBOUNCED GLOBAL SEARCH TO BACKEND
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
    }, 500); // 500ms delay prevents database spam while typing

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const fetchData = async () => {
    if (searchQuery) return; // Prevent fetching background tabs if actively searching
    
    setLoading(true);
    setError("");
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem("token")}` };
      const baseUrl = APP_CONFIG.apiUrl;

      if (activeTab === "overview") {
        const res = await fetch(`${baseUrl}/api/admin/stats`, { headers });
        if (!res.ok) throw new Error("Not authorized");
        setStats(await res.json());
      } else if (activeTab === "users") {
        const res = await fetch(`${baseUrl}/api/admin/users`, { headers });
        setUsersList(await res.json());
      } else if (activeTab === "transactions") {
        const res = await fetch(`${baseUrl}/api/admin/transactions`, { headers });
        setTransactions(await res.json());
      } else if (activeTab === "videos") {
        const res = await fetch(`${baseUrl}/api/admin/all-videos`, { headers });
        setVideosList(await res.json());
      } else if (activeTab === "creators") {
        const res = await fetch(`${baseUrl}/api/admin/creators`, { headers });
        if (res.ok) {
          const data = await res.json();
          setCreatorsList(data.creators || []);
          setCreatorStats(data.stats || null);
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    setSearchQuery(""); 
    fetchData(); 
  }, [activeTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, sortConfig]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') direction = 'desc';
    setSortConfig({ key, direction });
  };

  const sortData = (data) => {
    if (!sortConfig.key) return data;
    return [...data].sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) return sortConfig.direction === 'asc' ? -1 : 1;
      if (a[sortConfig.key] > b[sortConfig.key]) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const SortIcon = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <ChevronDown size={14} color="#555" style={{marginLeft: "5px"}} />;
    return sortConfig.direction === 'asc' 
      ? <ChevronUp size={14} color="var(--primary-color)" style={{marginLeft: "5px"}} />
      : <ChevronDown size={14} color="var(--primary-color)" style={{marginLeft: "5px"}} />;
  };

  const processedUsers = useMemo(() => sortData(usersList), [usersList, sortConfig]);
  const processedVideos = useMemo(() => sortData(videosList), [videosList, sortConfig]);
  const processedTx = useMemo(() => sortData(transactions), [transactions, sortConfig]);

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
  const totalCreatorPages = Math.ceil(processedCreators.length / ITEMS_PER_PAGE);

  const creatorAnalytics = useMemo(() => {
    const total = creatorStats?.total_creators || creatorsList.length;
    const verified = creatorStats?.verified_creators || creatorsList.filter(c => c.is_verified).length;
    const managed = creatorStats?.managed_creators ?? creatorsList.filter(c => c.is_managed).length;
    const totalSubs = creatorStats?.total_active_subscriptions || creatorsList.reduce((sum, c) => sum + (Number(c.subscribers_count) || 0), 0);
    const totalSubRev = (creatorStats?.total_sub_revenue_usd || creatorsList.reduce((sum, c) => sum + (Number(c.subscription_revenue_usd) || 0), 0)).toFixed(2);
    const totalTips = creatorStats?.total_tips_ngn || creatorsList.reduce((sum, c) => sum + (Number(c.tips_total) || 0), 0);
    return { total, verified, managed, totalSubs, totalSubRev, totalTips };
  }, [creatorsList, creatorStats]);

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
      }
    } catch (err) {
      console.error("Failed to toggle verify:", err);
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
      }
    } catch (err) {
      console.error("Failed to toggle creator status:", err);
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
      } else {
        alert(data.error || "Failed to update creator");
      }
    } catch (err) {
      alert("Failed to update creator: " + err.message);
    }
  };

  const handleSyncTelegramCreators = async () => {
    setSyncingTelegram(true);
    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/creators/sync-telegram`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      });
      const data = await res.json();
      if (data.success) {
        alert(`Successfully synced ${data.count} Telegram creator(s)!`);
        // Refresh creators list
        const refreshRes = await fetch(`${APP_CONFIG.apiUrl}/api/admin/creators`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        const refreshData = await refreshRes.json();
        if (refreshData.creators) {
          setCreatorsList(refreshData.creators);
          setCreatorStats(refreshData.stats);
        }
      } else {
        alert(data.error || "Failed to sync Telegram creators");
      }
    } catch (err) {
      alert("Failed to sync Telegram creators: " + err.message);
    } finally {
      setSyncingTelegram(false);
    }
  };

  const videoAnalytics = useMemo(() => {
    const total = videosList.length;
    const views = videosList.reduce((sum, v) => sum + (Number(v.views) || 0), 0);
    const avgViews = total > 0 ? Math.round(views / total) : 0;
    const catCounts = {};
    videosList.forEach(v => { catCounts[v.category] = (catCounts[v.category] || 0) + 1; });
    const topCat = Object.keys(catCounts).sort((a,b) => catCounts[b] - catCounts[a])[0] || 'N/A';
    return { total, views, avgViews, topCat };
  }, [videosList]);

  const userAnalytics = useMemo(() => {
    const total = usersList.length;
    const premium = usersList.filter(u => u.is_premium).length;
    const admins = usersList.filter(u => u.role === 'admin').length;
    const ratio = total > 0 ? Math.round((premium / total) * 100) : 0;
    return { total, premium, admins, ratio };
  }, [usersList]);

  const txAnalytics = useMemo(() => {
    const total = transactions.length;
    const approved = transactions.filter(t => t.status === 'APPROVED');
    const revenue = approved.reduce((sum, t) => sum + Number(t.amount || 0), 0).toFixed(2);
    const pending = transactions.filter(t => t.status === 'PENDING' || t.status === 'WAITING');
    const pendingRev = pending.reduce((sum, t) => sum + Number(t.amount || 0), 0).toFixed(2);
    const approvalRate = total > 0 ? Math.round((approved.length / total) * 100) : 0;
    return { total, revenue, pendingRev, approvalRate };
  }, [transactions]);

  const paginatedVideos = processedVideos.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalVideoPages = Math.ceil(processedVideos.length / ITEMS_PER_PAGE);

  const paginatedUsers = processedUsers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalUserPages = Math.ceil(processedUsers.length / ITEMS_PER_PAGE);

  const paginatedTx = processedTx.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);
  const totalTxPages = Math.ceil(processedTx.length / ITEMS_PER_PAGE);

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = editingItem.type === 'video' ? `/api/admin/video/${editingItem.data.id}` : `/api/admin/user/${editingItem.data.id}`;
      const payload = editingItem.type === 'video' 
        ? { caption: editingItem.data.caption, category: editingItem.data.category }
        : { role: editingItem.data.role, is_premium: editingItem.data.is_premium };

      const res = await fetch(`${APP_CONFIG.apiUrl}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        if (searchQuery) {
          // Force search refresh to show updated data instantly
          setSearchQuery(searchQuery + " ");
          setTimeout(() => setSearchQuery(searchQuery.trim()), 100);
        } else {
          if (editingItem.type === 'video') setVideosList(videosList.map(v => v.id === editingItem.data.id ? editingItem.data : v));
          else setUsersList(usersList.map(u => u.id === editingItem.data.id ? editingItem.data : u));
        }
        setEditingItem(null);
      } else alert("Failed to save changes.");
    } catch (err) { console.error(err); }
  };

  const handleDelete = async () => {
    try {
      const endpoint = deleteWarning.type === 'video' ? `/api/admin/video/${deleteWarning.id}` : `/api/admin/user/${deleteWarning.id}`;
      const res = await fetch(`${APP_CONFIG.apiUrl}${endpoint}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
      });

      if (res.ok) {
        if (searchQuery) {
           setGlobalSearchResults(prev => ({
             ...prev,
             [deleteWarning.type === 'video' ? 'videos' : 'users']: prev[deleteWarning.type === 'video' ? 'videos' : 'users'].filter(item => item.id !== deleteWarning.id)
           }));
        } else {
          if (deleteWarning.type === 'video') setVideosList(videosList.filter(v => v.id !== deleteWarning.id));
          else setUsersList(usersList.filter(u => u.id !== deleteWarning.id));
        }
        setDeleteWarning(null);
      } else alert("Failed to delete item.");
    } catch (err) { console.error(err); }
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false); 
  };

  if (!user || user.role !== 'admin') {
    return (
      <div style={errorScreenStyle}>
        <ShieldCheck size={64} color="#ff3b30" style={{ marginBottom: "20px" }} />
        <h2 style={{ margin: "0 0 10px 0", color: "#fff", fontSize: "28px" }}>Access Denied</h2>
        <p style={{ color: "#8e8e93", marginBottom: "30px", fontSize: "16px" }}>You need administrator privileges to view this portal.</p>
        <button onClick={onLogout} style={goBackBtnStyle}>Return to Home</button>
      </div>
    );
  }

  if (showUploadModal) return <AdminUpload onClose={() => setShowUploadModal(false)} />;

  return (
    <div style={dashboardContainerStyle}>
      <style>{`
        .hamburger-btn, .mobile-close-btn { display: none; background: transparent; border: none; color: white; cursor: pointer; padding: 0; }
        .mobile-overlay { display: none; }
        
        @media (max-width: 768px) {
          .admin-sidebar { position: fixed !important; left: -100%; transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1); z-index: 999999; height: 100dvh; box-shadow: 10px 0 30px rgba(0,0,0,0.5); }
          .admin-sidebar.open { left: 0; }
          .hamburger-btn { display: block; }
          .mobile-close-btn { display: block; }
          .mobile-overlay.open { display: block; position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 999998; }
          .top-bar-container { flex-direction: column !important; align-items: flex-start !important; gap: 15px; padding: 20px !important; }
          .header-title-group { width: 100%; }
          .search-container { width: 100% !important; margin-top: 10px; }
          .top-bar-actions { width: 100%; display: flex; gap: 10px; }
          .top-bar-actions button { flex: 1; justify-content: center; }
          .content-area { padding: 20px !important; }
          .hide-on-mobile { display: none; }
        }
      `}</style>

      <div className={`mobile-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      <div className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`} style={sidebarStyle}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={logoStyle}>
              {APP_CONFIG.appNamePrefix}
              <span style={{ color: "var(--primary-color)" }}>ADMIN</span>
            </h2>
            <button className="mobile-close-btn" onClick={() => setSidebarOpen(false)}><X size={24} /></button>
          </div>
          
          <div style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <SidebarBtn active={activeTab === "overview" && !searchQuery} onClick={() => handleTabSwitch("overview")} icon={<LayoutDashboard size={20} />} label="Overview" />
            <SidebarBtn active={activeTab === "creators" && !searchQuery} onClick={() => handleTabSwitch("creators")} icon={<Sparkles size={20} />} label="Creators" />
            <SidebarBtn active={activeTab === "videos" && !searchQuery} onClick={() => handleTabSwitch("videos")} icon={<Video size={20} />} label="Videos" />
            <SidebarBtn active={activeTab === "users" && !searchQuery} onClick={() => handleTabSwitch("users")} icon={<Users size={20} />} label="Users" />
            <SidebarBtn active={activeTab === "transactions" && !searchQuery} onClick={() => handleTabSwitch("transactions")} icon={<CreditCard size={20} />} label="Transactions" />
          </div>
        </div>
        <button onClick={onLogout} style={logoutBtnStyle}><LogOut size={20} /> Exit Admin</button>
      </div>

      <div style={mainContentStyle}>
        <div className="top-bar-container" style={topBarStyle}>
          
          <div className="header-title-group" style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap", flex: 1 }}>
            <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={26} />
            </button>
            <h1 style={{ margin: 0, fontSize: "24px", textTransform: "capitalize" }}>
              {searchQuery ? "Global Search" : activeTab}
            </h1>
            
            {/* 🟢 Search is now permanently visible in the top bar */}
            <div className="search-container" style={searchBarStyle}>
              <Search size={16} color="#8e8e93" />
              <input type="text" placeholder="Search entire database..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={searchInputStyle} />
              {searchQuery && <X size={14} color="#8e8e93" style={{cursor:"pointer"}} onClick={() => setSearchQuery("")} />}
            </div>
          </div>
          
          <div className="top-bar-actions" style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => setShowUploadModal(true)} style={uploadBtnStyle}>
              <UploadCloud size={18} /> <span className="hide-on-mobile">Upload Video</span>
            </button>
            <button onClick={fetchData} style={refreshBtnStyle} disabled={loading || !!searchQuery}>
              <RefreshCw size={18} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> <span className="hide-on-mobile">Refresh</span>
            </button>
          </div>
        </div>

        <div className="content-area" style={contentAreaStyle}>
          {/* 🟢 GLOBAL SEARCH RESULTS OVERRIDE */}
          {searchQuery.trim() ? (
            isSearching ? (
               <div style={centerFlex}><RefreshCw size={40} color="var(--primary-color)" style={{ animation: "spin 1s linear infinite" }} /></div>
            ) : globalSearchResults ? (
               <div>
                  <h3 style={{ color: "#8e8e93", marginBottom: "20px" }}>Found {globalSearchResults.users.length} Users</h3>
                  {globalSearchResults.users.length > 0 && (
                    <div style={{ ...tableContainerStyle, marginBottom: "40px" }}>
                      <div style={{ overflowX: "auto" }}>
                        <table style={tableStyle}>
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
                                <td style={{...tdStyle, fontWeight: "600"}}>{u.username}</td>
                                <td style={{...tdStyle, color: "#8e8e93"}}>{u.email}</td>
                                <td style={tdStyle}>{u.is_premium ? <span style={premiumBadge}>Premium</span> : <span style={freeBadge}>Free</span>}</td>
                                <td style={tdStyle}>
                                  <div style={{ display: "flex" }}>
                                    <button onClick={() => setEditingItem({type: 'user', data: u})} style={iconBtnStyle}><Edit3 size={16} /></button>
                                    <button onClick={() => setDeleteWarning({type: 'user', id: u.id, name: u.username})} style={{...iconBtnStyle, color: "#ff3b30"}}><Trash2 size={16} /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <h3 style={{ color: "#8e8e93", marginBottom: "20px" }}>Found {globalSearchResults.videos.length} Videos</h3>
                  {globalSearchResults.videos.length > 0 && (
                    <div style={{ ...tableContainerStyle, marginBottom: "40px" }}>
                      <div style={{ overflowX: "auto" }}>
                        <table style={tableStyle}>
                          <thead>
                            <tr>
                              <th style={thStyle}>Caption</th>
                              <th style={thStyle}>Category</th>
                              <th style={thStyle}>Views</th>
                              <th style={thStyle}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {globalSearchResults.videos.map(v => (
                              <tr key={v.id} style={trStyle}>
                                <td style={{...tdStyle, fontWeight:"600"}}>{v.caption || "Untitled"}</td>
                                <td style={{...tdStyle, textTransform:"capitalize"}}>{v.category}</td>
                                <td style={tdStyle}>{v.views}</td>
                                <td style={tdStyle}>
                                  <div style={{ display: "flex" }}>
                                    <button onClick={() => setEditingItem({type: 'video', data: v})} style={iconBtnStyle}><Edit3 size={16} /></button>
                                    <button onClick={() => setDeleteWarning({type: 'video', id: v.id, name: v.caption})} style={{...iconBtnStyle, color: "#ff3b30"}}><Trash2 size={16} /></button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {globalSearchResults.creators && globalSearchResults.creators.length > 0 && (
                    <>
                      <h3 style={{ color: "#8e8e93", marginBottom: "20px" }}>Found {globalSearchResults.creators.length} Creators</h3>
                      <div style={{ ...tableContainerStyle, marginBottom: "40px" }}>
                        <div style={{ overflowX: "auto" }}>
                          <table style={tableStyle}>
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
                                      <img src={c.avatar_url || '/assets/default-avatar.png'} alt="" style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }} />
                                      <div>
                                        <div style={{ fontWeight: "700", color: "#fff", fontSize: "13px" }}>{c.display_name || c.username}</div>
                                        <div style={{ fontSize: "11px", color: "#8e8e93" }}>@{c.username}</div>
                                      </div>
                                    </div>
                                  </td>
                                  <td style={tdStyle}>{c.creator_category || "Creator"}</td>
                                  <td style={{ ...tdStyle, color: "#00d084", fontWeight: "700" }}>
                                    {Number(c.subscription_price) > 0 ? `₦${Number(c.subscription_price).toLocaleString()}/mo` : "Free"}
                                  </td>
                                  <td style={tdStyle}>
                                    {c.is_verified ? <CheckCircle size={15} color="#00aff0" fill="#00aff0" /> : <span style={{ color: "#8e8e93", fontSize: "12px" }}>No</span>}
                                  </td>
                                  <td style={tdStyle}>
                                    <button onClick={() => window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: c.username }))} style={{ ...iconBtnStyle, color: "#00aff0" }}>
                                      <ExternalLink size={16} />
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
            ) : <div style={centerFlex}><p>No results found.</p></div>
          ) : loading ? (
            <div style={centerFlex}><RefreshCw size={40} color="var(--primary-color)" style={{ animation: "spin 1s linear infinite" }} /></div>
          ) : (
            <>
              {/* 🟢 STANDARD TABS RENDERING */}
              {activeTab === "overview" && (
                <div style={gridStatsStyle}>
                  <StatCard title="Total Revenue" value={`$${stats.total_revenue_usd}`} icon={<TrendingUp size={24} color="#34C759" />} bg="rgba(52, 199, 89, 0.1)" />
                  <StatCard title="Total Users" value={stats.total_users} icon={<Users size={24} color="#0098EA" />} bg="rgba(0, 152, 234, 0.1)" />
                  <StatCard title="Premium Members" value={stats.premium_users} icon={<ShieldCheck size={24} color="var(--primary-color)" />} bg="rgba(247, 147, 26, 0.1)" />
                  <StatCard title="Pending Crypto" value={stats.pending_crypto_orders} icon={<Clock size={24} color="#F3BA2F" />} bg="rgba(243, 186, 47, 0.1)" />
                </div>
              )}

              {/* 🟢 CREATOR MANAGEMENT TAB */}
              {activeTab === "creators" && (
                <>
                  <div style={{ ...gridStatsStyle, marginBottom: "30px" }}>
                    <StatCard 
                      title="Total Creators" 
                      value={creatorAnalytics.total} 
                      icon={<Sparkles size={24} color="#00aff0" />} 
                      bg="rgba(0, 175, 240, 0.1)" 
                    />
                    <StatCard 
                      title="Telegram Funnels" 
                      value={creatorAnalytics.managed} 
                      icon={<RefreshCw size={24} color="#29b6f6" />} 
                      bg="rgba(41, 182, 246, 0.1)" 
                    />
                    <StatCard 
                      title="Verified Badges" 
                      value={creatorAnalytics.verified} 
                      icon={<CheckCircle size={24} color="#00d084" />} 
                      bg="rgba(0, 208, 132, 0.1)" 
                    />
                    <StatCard 
                      title="Active VIP Subscribers" 
                      value={creatorAnalytics.totalSubs} 
                      icon={<Users size={24} color="#F3BA2F" />} 
                      bg="rgba(243, 186, 47, 0.1)" 
                    />
                    <StatCard 
                      title="Total Tips Volume" 
                      value={`₦${Number(creatorAnalytics.totalTips).toLocaleString()}`} 
                      icon={<Heart size={24} color="#f91880" />} 
                      bg="rgba(249, 24, 128, 0.1)" 
                    />
                  </div>

                  {/* Filter bar */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      {[
                        { id: "all", label: "All Creators" },
                        { id: "telegram", label: "🤖 Telegram Funnels" },
                        { id: "web", label: "🌐 Web Creators" },
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
                            padding: "6px 14px",
                            borderRadius: "20px",
                            fontSize: "12px",
                            fontWeight: "700",
                            cursor: "pointer",
                            border: "1px solid",
                            borderColor: creatorFilter === f.id ? "var(--primary-color)" : "rgba(255,255,255,0.12)",
                            background: creatorFilter === f.id ? "rgba(247, 147, 26, 0.15)" : "transparent",
                            color: creatorFilter === f.id ? "#fff" : "#8e8e93"
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
                          borderRadius: "10px",
                          fontSize: "12px",
                          fontWeight: "700",
                          background: "rgba(0, 136, 204, 0.15)",
                          color: "#29b6f6",
                          border: "1px solid rgba(41, 182, 246, 0.35)",
                          cursor: syncingTelegram ? "not-allowed" : "pointer"
                        }}
                        title="Scan Telegram uploaders and sync into managed creators"
                      >
                        <RefreshCw size={13} style={{ animation: syncingTelegram ? "spin 1s linear infinite" : "none" }} />
                        {syncingTelegram ? "Syncing..." : "Sync Telegram"}
                      </button>

                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "12px", color: "#8e8e93" }}>Category:</span>
                        <select
                          value={creatorCategoryFilter}
                          onChange={(e) => { setCreatorCategoryFilter(e.target.value); setCurrentPage(1); }}
                          style={{
                            background: "#18181b",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: "10px",
                            color: "#fff",
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

                  <div style={tableContainerStyle}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={tableStyle}>
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
                              <td colSpan={9} style={{ ...tdStyle, textAlign: "center", padding: "40px 16px", color: "#8e8e93" }}>
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
                                      style={{ width: "38px", height: "38px", borderRadius: "50%", objectFit: "cover", border: c.is_verified ? "1.5px solid #00aff0" : "1px solid #333" }}
                                      onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                                    />
                                    <div>
                                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                        <span style={{ fontWeight: "700", color: "#fff", fontSize: "13px" }}>{c.display_name || c.username}</span>
                                        {c.is_verified && <CheckCircle size={13} color="#00aff0" fill="#00aff0" />}
                                      </div>
                                      <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                                        <span style={{ fontSize: "11px", color: "#8e8e93" }}>@{c.username}</span>
                                        {c.is_managed ? (
                                          <span style={{
                                            background: "rgba(0, 136, 204, 0.18)",
                                            color: "#29b6f6",
                                            border: "1px solid rgba(41, 182, 246, 0.35)",
                                            borderRadius: "6px",
                                            padding: "1px 5px",
                                            fontSize: "9px",
                                            fontWeight: "800",
                                            letterSpacing: "0.5px"
                                          }}>
                                            🤖 TELEGRAM
                                          </span>
                                        ) : (
                                          <span style={{
                                            background: "rgba(0, 208, 132, 0.12)",
                                            color: "#00d084",
                                            border: "1px solid rgba(0, 208, 132, 0.3)",
                                            borderRadius: "6px",
                                            padding: "1px 5px",
                                            fontSize: "9px",
                                            fontWeight: "800",
                                            letterSpacing: "0.5px"
                                          }}>
                                            🌐 WEB
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td style={tdStyle}>
                                  <span style={{
                                    background: "rgba(0, 175, 240, 0.12)",
                                    color: "#00aff0",
                                    borderRadius: "8px",
                                    padding: "3px 8px",
                                    fontSize: "11px",
                                    fontWeight: "700"
                                  }}>
                                    {c.creator_category || "Creator"}
                                  </span>
                                </td>
                                <td style={{ ...tdStyle, fontWeight: "700" }}>
                                  {Number(c.subscription_price) > 0 ? (
                                    <span style={{ color: "#00d084" }}>₦{Number(c.subscription_price).toLocaleString()}/mo</span>
                                  ) : (
                                    <span style={{ color: "#8e8e93" }}>Free</span>
                                  )}
                                </td>
                                <td style={{ ...tdStyle, fontWeight: "700", color: "#fff" }}>
                                  {c.subscribers_count}
                                </td>
                                <td style={tdStyle}>
                                  <span style={{ fontWeight: "700", color: "#f91880" }}>₦{(c.tips_total || 0).toLocaleString()}</span>
                                  <span style={{ display: "block", fontSize: "10px", color: "#8e8e93" }}>{c.tips_count || 0} tips</span>
                                </td>
                                <td style={tdStyle}>
                                  <span style={{ fontWeight: "700", color: "#fff" }}>{c.posts_count} posts</span>
                                  <span style={{ display: "block", fontSize: "10px", color: "#8e8e93" }}>{(c.total_views || 0).toLocaleString()} views</span>
                                </td>
                                <td style={tdStyle}>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleVerify(c)}
                                    disabled={updatingCreatorId === c.id}
                                    style={{
                                      background: c.is_verified ? "rgba(0, 175, 240, 0.15)" : "rgba(255,255,255,0.06)",
                                      border: `1px solid ${c.is_verified ? "#00aff0" : "rgba(255,255,255,0.15)"}`,
                                      borderRadius: "14px",
                                      padding: "4px 10px",
                                      color: c.is_verified ? "#00aff0" : "#8e8e93",
                                      fontSize: "11px",
                                      fontWeight: "700",
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px"
                                    }}
                                  >
                                    <CheckCircle size={12} color={c.is_verified ? "#00aff0" : "#666"} />
                                    <span>{c.is_verified ? "Verified" : "Unverified"}</span>
                                  </button>
                                </td>
                                <td style={tdStyle}>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleCreatorStatus(c)}
                                    disabled={updatingCreatorId === c.id}
                                    style={{
                                      background: c.is_creator ? "rgba(0, 208, 132, 0.12)" : "rgba(255, 59, 48, 0.12)",
                                      border: `1px solid ${c.is_creator ? "rgba(0, 208, 132, 0.3)" : "rgba(255, 59, 48, 0.3)"}`,
                                      borderRadius: "14px",
                                      padding: "4px 10px",
                                      color: c.is_creator ? "#00d084" : "#ff3b30",
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
                                      <Edit3 size={16} />
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: c.username }))} 
                                      style={{ ...iconBtnStyle, color: "#00aff0" }} 
                                      title="Preview Public Profile"
                                    >
                                      <ExternalLink size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                    {totalCreatorPages > 1 && (
                      <div style={paginationStyle}>
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={currentPage === 1 ? pageBtnDisabledStyle : pageBtnStyle}>Prev</button>
                        <span style={pageTextStyle}>Page {currentPage} of {totalCreatorPages}</span>
                        <button disabled={currentPage === totalCreatorPages} onClick={() => setCurrentPage(p => p + 1)} style={currentPage === totalCreatorPages ? pageBtnDisabledStyle : pageBtnStyle}>Next</button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === "videos" && (
                <>
                  <div style={{ ...gridStatsStyle, marginBottom: "30px" }}>
                    <StatCard title="Total Videos" value={videoAnalytics.total} icon={<PlayCircle size={24} color="#ff3b30" />} bg="rgba(255, 59, 48, 0.1)" />
                    <StatCard title="Total Views" value={videoAnalytics.views.toLocaleString()} icon={<Eye size={24} color="#0098EA" />} bg="rgba(0, 152, 234, 0.1)" />
                    <StatCard title="Avg Views/Video" value={videoAnalytics.avgViews.toLocaleString()} icon={<Activity size={24} color="#34C759" />} bg="rgba(52, 199, 89, 0.1)" />
                    <StatCard title="Top Category" value={<span style={{textTransform:'capitalize'}}>{videoAnalytics.topCat}</span>} icon={<PieChart size={24} color="#F3BA2F" />} bg="rgba(243, 186, 47, 0.1)" />
                  </div>

                  <div style={tableContainerStyle}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={tableStyle}>
                        <thead>
                          <tr>
                            <th style={thStyle}>Thumb</th>
                            <th onClick={() => handleSort('caption')} style={{...thStyle, cursor:"pointer"}}>Caption <SortIcon columnKey="caption" /></th>
                            <th onClick={() => handleSort('category')} style={{...thStyle, cursor:"pointer"}}>Category <SortIcon columnKey="category" /></th>
                            <th onClick={() => handleSort('views')} style={{...thStyle, cursor:"pointer"}}>Views <SortIcon columnKey="views" /></th>
                            <th onClick={() => handleSort('created_at')} style={{...thStyle, cursor:"pointer"}}>Uploaded <SortIcon columnKey="created_at" /></th>
                            <th style={thStyle}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedVideos.map(v => (
                            <tr key={v.id} style={trStyle}>
                              <td style={tdStyle}><img src={v.thumbnail_url || '/assets/default-avatar.png'} alt="" style={{width:"50px", height:"50px", objectFit:"cover", borderRadius:"6px"}}/></td>
                              <td style={{...tdStyle, fontWeight:"600", minWidth: "200px"}}>{v.caption || "Untitled"}</td>
                              <td style={{...tdStyle, textTransform:"capitalize"}}>{v.category}</td>
                              <td style={tdStyle}>{v.views}</td>
                              <td style={{...tdStyle, color:"#8e8e93", minWidth: "120px"}}>{new Date(v.created_at).toLocaleDateString()}</td>
                              <td style={tdStyle}>
                                <div style={{ display: "flex" }}>
                                  <button onClick={() => setEditingItem({type: 'video', data: v})} style={iconBtnStyle}><Edit3 size={16} /></button>
                                  <button onClick={() => setDeleteWarning({type: 'video', id: v.id, name: v.caption})} style={{...iconBtnStyle, color: "#ff3b30"}}><Trash2 size={16} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalVideoPages > 1 && (
                      <div style={paginationStyle}>
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={currentPage === 1 ? pageBtnDisabledStyle : pageBtnStyle}>Prev</button>
                        <span style={pageTextStyle}>Page {currentPage} of {totalVideoPages}</span>
                        <button disabled={currentPage === totalVideoPages} onClick={() => setCurrentPage(p => p + 1)} style={currentPage === totalVideoPages ? pageBtnDisabledStyle : pageBtnStyle}>Next</button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === "users" && (
                <>
                  <div style={{ ...gridStatsStyle, marginBottom: "30px" }}>
                    <StatCard title="Total Registered" value={userAnalytics.total} icon={<Users size={24} color="#0098EA" />} bg="rgba(0, 152, 234, 0.1)" />
                    <StatCard title="Premium Users" value={userAnalytics.premium} icon={<Star size={24} color="#F3BA2F" />} bg="rgba(243, 186, 47, 0.1)" />
                    <StatCard title="Premium Ratio" value={`${userAnalytics.ratio}%`} icon={<Percent size={24} color="#34C759" />} bg="rgba(52, 199, 89, 0.1)" />
                    <StatCard title="Admin Staff" value={userAnalytics.admins} icon={<ShieldCheck size={24} color="#ff3b30" />} bg="rgba(255, 59, 48, 0.1)" />
                  </div>

                  <div style={tableContainerStyle}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={tableStyle}>
                        <thead>
                          <tr>
                            <th onClick={() => handleSort('username')} style={{...thStyle, cursor:"pointer"}}>Username <SortIcon columnKey="username" /></th>
                            <th onClick={() => handleSort('email')} style={{...thStyle, cursor:"pointer"}}>Email <SortIcon columnKey="email" /></th>
                            <th onClick={() => handleSort('is_premium')} style={{...thStyle, cursor:"pointer"}}>Tier <SortIcon columnKey="is_premium" /></th>
                            <th onClick={() => handleSort('role')} style={{...thStyle, cursor:"pointer"}}>Role <SortIcon columnKey="role" /></th>
                            <th onClick={() => handleSort('created_at')} style={{...thStyle, cursor:"pointer"}}>Joined <SortIcon columnKey="created_at" /></th>
                            <th style={thStyle}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedUsers.map(u => (
                            <tr key={u.id} style={trStyle}>
                              <td style={{...tdStyle, fontWeight: "600"}}>{u.username}</td>
                              <td style={{...tdStyle, color: "#8e8e93"}}>{u.email}</td>
                              <td style={tdStyle}>{u.is_premium ? <span style={premiumBadge}>Premium</span> : <span style={freeBadge}>Free</span>}</td>
                              <td style={{...tdStyle, textTransform: "capitalize", color: u.role==='admin' ? '#ff3b30' : '#8e8e93'}}>{u.role}</td>
                              <td style={{...tdStyle, color: "#8e8e93", minWidth: "120px"}}>{new Date(u.created_at).toLocaleDateString()}</td>
                              <td style={tdStyle}>
                                <div style={{ display: "flex" }}>
                                  <button onClick={() => setEditingItem({type: 'user', data: u})} style={iconBtnStyle}><Edit3 size={16} /></button>
                                  <button onClick={() => setDeleteWarning({type: 'user', id: u.id, name: u.username})} style={{...iconBtnStyle, color: "#ff3b30"}}><Trash2 size={16} /></button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalUserPages > 1 && (
                      <div style={paginationStyle}>
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={currentPage === 1 ? pageBtnDisabledStyle : pageBtnStyle}>Prev</button>
                        <span style={pageTextStyle}>Page {currentPage} of {totalUserPages}</span>
                        <button disabled={currentPage === totalUserPages} onClick={() => setCurrentPage(p => p + 1)} style={currentPage === totalUserPages ? pageBtnDisabledStyle : pageBtnStyle}>Next</button>
                      </div>
                    )}
                  </div>
                </>
              )}

              {activeTab === "transactions" && (
                <>
                  <div style={{ ...gridStatsStyle, marginBottom: "30px" }}>
                    <StatCard title="Gross Revenue" value={`$${txAnalytics.revenue}`} icon={<TrendingUp size={24} color="#34C759" />} bg="rgba(52, 199, 89, 0.1)" />
                    <StatCard title="Pending Review" value={`$${txAnalytics.pendingRev}`} icon={<Clock size={24} color="#F3BA2F" />} bg="rgba(243, 186, 47, 0.1)" />
                    <StatCard title="Total Volume" value={txAnalytics.total} icon={<CreditCard size={24} color="#0098EA" />} bg="rgba(0, 152, 234, 0.1)" />
                    <StatCard title="Approval Rate" value={`${txAnalytics.approvalRate}%`} icon={<ShieldCheck size={24} color="#ff3b30" />} bg="rgba(255, 59, 48, 0.1)" />
                  </div>

                  <div style={tableContainerStyle}>
                    <div style={{ overflowX: "auto" }}>
                      <table style={tableStyle}>
                        <thead>
                          <tr>
                            <th onClick={() => handleSort('username')} style={{...thStyle, cursor:"pointer"}}>User <SortIcon columnKey="username" /></th>
                            <th onClick={() => handleSort('amount')} style={{...thStyle, cursor:"pointer"}}>Amount <SortIcon columnKey="amount" /></th>
                            <th onClick={() => handleSort('payment_method')} style={{...thStyle, cursor:"pointer"}}>Method <SortIcon columnKey="payment_method" /></th>
                            <th onClick={() => handleSort('status')} style={{...thStyle, cursor:"pointer"}}>Status <SortIcon columnKey="status" /></th>
                            <th onClick={() => handleSort('created_at')} style={{...thStyle, cursor:"pointer"}}>Date <SortIcon columnKey="created_at" /></th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedTx.map(tx => (
                            <tr key={tx.id} style={trStyle}>
                              <td style={{...tdStyle, fontWeight: "600"}}>{tx.username || tx.email || "Unknown"}</td>
                              <td style={{...tdStyle, fontWeight: "700", minWidth: "140px"}}>${tx.amount} <br/><span style={{fontSize:"12px", color:"#8e8e93"}}>({tx.crypto_amount || 0} {tx.crypto_currency?.toUpperCase()})</span></td>
                              <td style={tdStyle}>{tx.payment_method?.toUpperCase() || 'TRANSFER'}</td>
                              <td style={tdStyle}>
                                {tx.status === 'APPROVED' && <span style={premiumBadge}>Approved</span>}
                                {tx.status === 'WAITING' && <span style={{...premiumBadge, color:"#F3BA2F", background:"rgba(243,186,47,0.1)"}}>Waiting</span>}
                                {(tx.status === 'FAILED' || tx.status === 'PENDING') && <span style={{...freeBadge}}>Pending</span>}
                              </td>
                              <td style={{...tdStyle, color: "#8e8e93", minWidth: "180px"}}>{new Date(tx.created_at).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {totalTxPages > 1 && (
                      <div style={paginationStyle}>
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)} style={currentPage === 1 ? pageBtnDisabledStyle : pageBtnStyle}>Prev</button>
                        <span style={pageTextStyle}>Page {currentPage} of {totalTxPages}</span>
                        <button disabled={currentPage === totalTxPages} onClick={() => setCurrentPage(p => p + 1)} style={currentPage === totalTxPages ? pageBtnDisabledStyle : pageBtnStyle}>Next</button>
                      </div>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {editingItem && (
        <div style={modalOverlayStyle}>
          <form onSubmit={handleSaveEdit} style={modalBoxStyle}>
            <div style={modalHeaderStyle}>
              <h2 style={{margin:0}}>Edit {editingItem.type === 'video' ? 'Video' : 'User'}</h2>
              <X size={20} cursor="pointer" onClick={() => setEditingItem(null)} color="#8e8e93"/>
            </div>

            {editingItem.type === 'video' ? (
              <>
                <div style={inputGroupStyle}>
                  <label>Caption</label>
                  <input type="text" value={editingItem.data.caption} onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, caption: e.target.value}})} style={formInputStyle} />
                </div>
                <div style={inputGroupStyle}>
                  <label>Category</label>
                  <select value={editingItem.data.category} onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, category: e.target.value}})} style={formInputStyle}>
                    {APP_CONFIG.categories.map((cat) => (
                      <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                    ))}
                    <option value="premium">Premium</option>
                  </select>
                </div>
              </>
            ) : (
              <>
                <div style={inputGroupStyle}>
                  <label>Role</label>
                  <select value={editingItem.data.role} onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, role: e.target.value}})} style={formInputStyle}>
                    <option value="user">Standard User</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div style={inputGroupStyle}>
                  <label>Premium Access</label>
                  <select value={editingItem.data.is_premium ? "true" : "false"} onChange={e => setEditingItem({...editingItem, data: {...editingItem.data, is_premium: e.target.value === "true"}})} style={formInputStyle}>
                    <option value="false">Free Tier</option>
                    <option value="true">Premium Tier</option>
                  </select>
                </div>
              </>
            )}
            <button type="submit" style={saveBtnStyle}>Save Changes</button>
          </form>
        </div>
      )}

      {editingCreator && (
        <div style={modalOverlayStyle}>
          <form onSubmit={handleSaveCreatorEdit} style={modalBoxStyle}>
            <div style={modalHeaderStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Sparkles size={18} color="#FFD700" />
                <h2 style={{ margin: 0, fontSize: "17px", color: "#fff" }}>
                  Edit Creator @{editingCreator.username}
                </h2>
              </div>
              <X size={20} cursor="pointer" onClick={() => setEditingCreator(null)} color="#8e8e93"/>
            </div>

            <div style={inputGroupStyle}>
              <label style={{ fontSize: "12px", color: "#aaa", fontWeight: "700" }}>Display Name</label>
              <input 
                type="text" 
                value={editingCreator.display_name || ""} 
                onChange={e => setEditingCreator({ ...editingCreator, display_name: e.target.value })} 
                style={formInputStyle} 
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={{ fontSize: "12px", color: "#aaa", fontWeight: "700" }}>Username (@handle)</label>
              <input 
                type="text" 
                value={editingCreator.username || ""} 
                onChange={e => setEditingCreator({ ...editingCreator, username: e.target.value })} 
                style={formInputStyle} 
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={{ fontSize: "12px", color: "#aaa", fontWeight: "700" }}>Creator Type / Origin</label>
              <select 
                value={editingCreator.is_managed ? "true" : "false"} 
                onChange={e => setEditingCreator({ ...editingCreator, is_managed: e.target.value === "true" })} 
                style={formInputStyle}
              >
                <option value="true">🤖 Telegram Funnel / Managed Creator</option>
                <option value="false">🌐 Registered Web Creator</option>
              </select>
            </div>

            <div style={inputGroupStyle}>
              <label style={{ fontSize: "12px", color: "#aaa", fontWeight: "700" }}>Category</label>
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
              <label style={{ fontSize: "12px", color: "#aaa", fontWeight: "700" }}>Monthly Subscription Price (₦ NGN)</label>
              <input 
                type="number" 
                min={0}
                step={500}
                value={editingCreator.subscription_price || 0} 
                onChange={e => setEditingCreator({ ...editingCreator, subscription_price: e.target.value })} 
                style={formInputStyle} 
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={{ fontSize: "12px", color: "#aaa", fontWeight: "700" }}>Verified Badge</label>
              <select 
                value={editingCreator.is_verified ? "true" : "false"} 
                onChange={e => setEditingCreator({ ...editingCreator, is_verified: e.target.value === "true" })} 
                style={formInputStyle}
              >
                <option value="true">Verified ✓ (Official Blue Checkmark)</option>
                <option value="false">Unverified</option>
              </select>
            </div>

            <div style={inputGroupStyle}>
              <label style={{ fontSize: "12px", color: "#aaa", fontWeight: "700" }}>Creator Channel Status</label>
              <select 
                value={editingCreator.is_creator ? "true" : "false"} 
                onChange={e => setEditingCreator({ ...editingCreator, is_creator: e.target.value === "true" })} 
                style={formInputStyle}
              >
                <option value="true">Active Creator</option>
                <option value="false">Disabled / Revoked</option>
              </select>
            </div>

            <div style={inputGroupStyle}>
              <label style={{ fontSize: "12px", color: "#aaa", fontWeight: "700" }}>Avatar Image URL</label>
              <input 
                type="text" 
                value={editingCreator.avatar_url || ""} 
                onChange={e => setEditingCreator({ ...editingCreator, avatar_url: e.target.value })} 
                placeholder="https://... or /api/avatar?user_id=..."
                style={formInputStyle} 
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={{ fontSize: "12px", color: "#aaa", fontWeight: "700" }}>Banner Image URL</label>
              <input 
                type="text" 
                value={editingCreator.banner_url || ""} 
                onChange={e => setEditingCreator({ ...editingCreator, banner_url: e.target.value })} 
                placeholder="https://images.unsplash.com/..."
                style={formInputStyle} 
              />
            </div>

            <div style={inputGroupStyle}>
              <label style={{ fontSize: "12px", color: "#aaa", fontWeight: "700" }}>Bio / Summary</label>
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

      {deleteWarning && (
        <div style={modalOverlayStyle}>
          <div style={{...modalBoxStyle, textAlign: "center", maxWidth: "350px", margin: "0 20px"}}>
            <AlertTriangle size={48} color="#ff3b30" style={{ margin: "0 auto 15px auto" }} />
            <h2 style={{ margin: "0 0 10px 0" }}>Confirm Deletion</h2>
            <p style={{ color: "#8e8e93", fontSize: "14px", marginBottom: "20px" }}>Permanently delete <strong>{deleteWarning.name}</strong>? This cannot be undone.</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteWarning(null)} style={{ flex: 1, padding: "12px", background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", borderRadius: "8px", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDelete} style={{ flex: 1, padding: "12px", background: "#ff3b30", border: "none", color: "#fff", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const SidebarBtn = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "12px 16px", borderRadius: "10px", border: "none", cursor: "pointer", fontSize: "15px", fontWeight: "600", transition: "all 0.2s", background: active ? "rgba(247, 147, 26, 0.1)" : "transparent", color: active ? "var(--primary-color)" : "#8e8e93" }}>
    {icon} {label}
  </button>
);

const StatCard = ({ title, value, icon, bg }) => (
  <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", padding: "24px", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
    <div>
      <div style={{ color: "#8e8e93", fontSize: "14px", fontWeight: "600", marginBottom: "8px" }}>{title}</div>
      <div style={{ color: "#fff", fontSize: "32px", fontWeight: "900" }}>{value}</div>
    </div>
    <div style={{ background: bg, padding: "12px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</div>
  </div>
);

// 🖌 UI STYLES
const dashboardContainerStyle = { display: "flex", height: "100dvh", width: "100vw", background: "#050505", color: "#fff", position: "absolute", zIndex: 999999, top: 0, left: 0 };
const sidebarStyle = { width: "260px", background: "#0a0a0a", borderRight: "1px solid rgba(255,255,255,0.05)", padding: "30px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" };
const logoStyle = { margin: 0, fontSize: "20px", fontWeight: "900", letterSpacing: "-1px", color: "#fff" };
const mainContentStyle = { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" };
const topBarStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "30px 40px", borderBottom: "1px solid rgba(255,255,255,0.05)" };
const contentAreaStyle = { flex: 1, overflowY: "auto", padding: "40px" };
const gridStatsStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" };
const tableContainerStyle = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", overflow: "hidden" };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { textAlign: "left", padding: "18px 20px", color: "#8e8e93", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "1px solid rgba(255,255,255,0.1)", userSelect: "none", whiteSpace: "nowrap" };
const trStyle = { borderBottom: "1px solid rgba(255,255,255,0.05)" };
const tdStyle = { padding: "15px 20px", fontSize: "14px" };
const badgeStyle = { padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "700" };
const premiumBadge = { ...badgeStyle, background: "rgba(52, 199, 89, 0.1)", color: "#34C759" };
const freeBadge = { ...badgeStyle, background: "rgba(255,255,255,0.05)", color: "#8e8e93" };
const iconBtnStyle = { background: "rgba(255,255,255,0.05)", border: "none", color: "#fff", padding: "8px", borderRadius: "8px", cursor: "pointer", marginLeft: "5px" };
const searchBarStyle = { display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.05)", padding: "10px 16px", borderRadius: "8px", width: "250px" };
const searchInputStyle = { background: "transparent", border: "none", color: "#fff", outline: "none", width: "100%", fontSize: "14px" };
const logoutBtnStyle = { display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "rgba(255,255,255,0.05)", color: "#fff", border: "none", padding: "14px", borderRadius: "10px", fontWeight: "600", cursor: "pointer" };
const refreshBtnStyle = { display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600" };
const uploadBtnStyle = { display: "flex", alignItems: "center", gap: "8px", background: "var(--primary-color)", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "700" };
const centerFlex = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" };
const errorScreenStyle = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100dvh", width: "100vw", background: "#050505", color: "#ff3b30", position: "absolute", zIndex: 999999, top: 0, left: 0 };
const goBackBtnStyle = { background: "#fff", color: "#000", padding: "12px 30px", borderRadius: "30px", border: "none", fontWeight: "700", cursor: "pointer", fontSize: "15px", transition: "transform 0.2s" };
const modalOverlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999999 };
const modalBoxStyle = { background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "25px", width: "100%", maxWidth: "400px", margin: "0 15px" };
const modalHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" };
const inputGroupStyle = { display: "flex", flexDirection: "column", gap: "6px", marginBottom: "15px" };
const formInputStyle = { background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", padding: "12px", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none" };
const saveBtnStyle = { width: "100%", background: "var(--primary-color)", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: "700", fontSize: "15px", cursor: "pointer", marginTop: "10px" };
const paginationStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "15px 20px", background: "rgba(255,255,255,0.02)", borderTop: "1px solid rgba(255,255,255,0.05)" };
const pageBtnStyle = { background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "6px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: "600", transition: "0.2s" };
const pageBtnDisabledStyle = { ...pageBtnStyle, opacity: 0.3, cursor: "not-allowed" };
const pageTextStyle = { fontSize: "13px", color: "#8e8e93", fontWeight: "600" };