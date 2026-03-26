import React, { useState, useEffect, useMemo } from "react";
import { 
  LayoutDashboard, Users, CreditCard, LogOut, TrendingUp, ShieldCheck, 
  Clock, RefreshCw, UploadCloud, Video, Search, Edit3, Trash2, ChevronUp, ChevronDown, X, AlertTriangle, Menu 
} from "lucide-react";
import AdminUpload from "./AdminUpload"; 

export default function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  
  // Mobile Navigation State
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Modals
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null); 
  const [deleteWarning, setDeleteWarning] = useState(null); 

  // Data States
  const [stats, setStats] = useState({ total_users: 0, premium_users: 0, total_revenue_usd: 0, pending_crypto_orders: 0 });
  const [usersList, setUsersList] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [videosList, setVideosList] = useState([]);

  // 🟢 FETCH DATA
  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem("token")}` };
      const baseUrl = import.meta.env.VITE_API_URL;

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

  // 🟢 SORTING LOGIC
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

  // 🟢 FILTERING & PREPPING DATA
  const processedUsers = useMemo(() => sortData(usersList.filter(u => 
    u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  )), [usersList, searchQuery, sortConfig]);

  const processedVideos = useMemo(() => sortData(videosList.filter(v => 
    v.caption?.toLowerCase().includes(searchQuery.toLowerCase()) || v.category?.toLowerCase().includes(searchQuery.toLowerCase())
  )), [videosList, searchQuery, sortConfig]);

  const processedTx = useMemo(() => sortData(transactions.filter(t => 
    t.username?.toLowerCase().includes(searchQuery.toLowerCase()) || t.payment_method?.toLowerCase().includes(searchQuery.toLowerCase())
  )), [transactions, searchQuery, sortConfig]);

  // 🟢 ACTION HANDLERS (API Calls)
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = editingItem.type === 'video' ? `/api/admin/video/${editingItem.data.id}` : `/api/admin/user/${editingItem.data.id}`;
      const payload = editingItem.type === 'video' 
        ? { caption: editingItem.data.caption, category: editingItem.data.category }
        : { role: editingItem.data.role, is_premium: editingItem.data.is_premium };

      const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        if (editingItem.type === 'video') setVideosList(videosList.map(v => v.id === editingItem.data.id ? editingItem.data : v));
        else setUsersList(usersList.map(u => u.id === editingItem.data.id ? editingItem.data : u));
        setEditingItem(null);
      } else alert("Failed to save changes.");
    } catch (err) { console.error(err); }
  };

  const handleDelete = async () => {
    try {
      const endpoint = deleteWarning.type === 'video' ? `/api/admin/video/${deleteWarning.id}` : `/api/admin/user/${deleteWarning.id}`;
      const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
      });

      if (res.ok) {
        if (deleteWarning.type === 'video') setVideosList(videosList.filter(v => v.id !== deleteWarning.id));
        else setUsersList(usersList.filter(u => u.id !== deleteWarning.id));
        setDeleteWarning(null);
      } else alert("Failed to delete item.");
    } catch (err) { console.error(err); }
  };

  const handleTabSwitch = (tab) => {
    setActiveTab(tab);
    setSidebarOpen(false); // Auto-close sidebar on mobile
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
      
      {/* 🟢 MOBILE RESPONSIVE CSS INJECTION */}
      <style>{`
        .hamburger-btn, .mobile-close-btn { display: none; background: transparent; border: none; color: white; cursor: pointer; padding: 0; }
        .mobile-overlay { display: none; }
        
        @media (max-width: 768px) {
          .admin-sidebar {
            position: fixed !important;
            left: -100%;
            transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            z-index: 999999;
            height: 100dvh;
            box-shadow: 10px 0 30px rgba(0,0,0,0.5);
          }
          .admin-sidebar.open { left: 0; }
          .hamburger-btn { display: block; }
          .mobile-close-btn { display: block; }
          
          /* Show overlay when sidebar is open */
          .mobile-overlay.open {
            display: block;
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.7);
            backdrop-filter: blur(4px);
            z-index: 999998;
          }

          .top-bar-container {
            flex-direction: column !important;
            align-items: flex-start !important;
            gap: 15px;
            padding: 20px !important;
          }
          
          .header-title-group { width: 100%; }
          .search-container { width: 100% !important; margin-top: 10px; }
          .top-bar-actions { width: 100%; display: flex; gap: 10px; }
          .top-bar-actions button { flex: 1; justify-content: center; }
          
          .content-area { padding: 20px !important; }
          .hide-on-mobile { display: none; }
        }
      `}</style>

      {/* 🔴 MOBILE OVERLAY */}
      <div className={`mobile-overlay ${sidebarOpen ? 'open' : ''}`} onClick={() => setSidebarOpen(false)} />

      {/* 🟢 SIDEBAR */}
      <div className={`admin-sidebar ${sidebarOpen ? 'open' : ''}`} style={sidebarStyle}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={logoStyle}>NAIJA<span style={{ color: "var(--primary-color)" }}>ADMIN</span></h2>
            <button className="mobile-close-btn" onClick={() => setSidebarOpen(false)}><X size={24} /></button>
          </div>
          
          <div style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <SidebarBtn active={activeTab === "overview"} onClick={() => handleTabSwitch("overview")} icon={<LayoutDashboard size={20} />} label="Overview" />
            <SidebarBtn active={activeTab === "videos"} onClick={() => handleTabSwitch("videos")} icon={<Video size={20} />} label="Videos" />
            <SidebarBtn active={activeTab === "users"} onClick={() => handleTabSwitch("users")} icon={<Users size={20} />} label="Users" />
            <SidebarBtn active={activeTab === "transactions"} onClick={() => handleTabSwitch("transactions")} icon={<CreditCard size={20} />} label="Transactions" />
          </div>
        </div>
        <button onClick={onLogout} style={logoutBtnStyle}><LogOut size={20} /> Exit Admin</button>
      </div>

      {/* 🟢 MAIN CONTENT */}
      <div style={mainContentStyle}>
        <div className="top-bar-container" style={topBarStyle}>
          
          <div className="header-title-group" style={{ display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap", flex: 1 }}>
            <button className="hamburger-btn" onClick={() => setSidebarOpen(true)}>
              <Menu size={26} />
            </button>
            <h1 style={{ margin: 0, fontSize: "24px", textTransform: "capitalize" }}>{activeTab}</h1>
            
            {activeTab !== 'overview' && (
              <div className="search-container" style={searchBarStyle}>
                <Search size={16} color="#8e8e93" />
                <input type="text" placeholder={`Search ${activeTab}...`} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={searchInputStyle} />
              </div>
            )}
          </div>
          
          <div className="top-bar-actions" style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => setShowUploadModal(true)} style={uploadBtnStyle}>
              <UploadCloud size={18} /> <span className="hide-on-mobile">Upload Video</span>
            </button>
            <button onClick={fetchData} style={refreshBtnStyle} disabled={loading}>
              <RefreshCw size={18} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} /> <span className="hide-on-mobile">Refresh</span>
            </button>
          </div>

        </div>

        <div className="content-area" style={contentAreaStyle}>
          {loading ? (
            <div style={centerFlex}><RefreshCw size={40} color="var(--primary-color)" style={{ animation: "spin 1s linear infinite" }} /></div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div style={gridStatsStyle}>
                  <StatCard title="Total Revenue" value={`$${stats.total_revenue_usd}`} icon={<TrendingUp size={24} color="#34C759" />} bg="rgba(52, 199, 89, 0.1)" />
                  <StatCard title="Total Users" value={stats.total_users} icon={<Users size={24} color="#0098EA" />} bg="rgba(0, 152, 234, 0.1)" />
                  <StatCard title="Premium Members" value={stats.premium_users} icon={<ShieldCheck size={24} color="var(--primary-color)" />} bg="rgba(247, 147, 26, 0.1)" />
                  <StatCard title="Pending Crypto" value={stats.pending_crypto_orders} icon={<Clock size={24} color="#F3BA2F" />} bg="rgba(243, 186, 47, 0.1)" />
                </div>
              )}

              {/* TAB 2: VIDEOS TABLE */}
              {activeTab === "videos" && (
                <div style={tableContainerStyle}>
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
                      {processedVideos.map(v => (
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
              )}

              {/* TAB 3: USERS TABLE */}
              {activeTab === "users" && (
                <div style={tableContainerStyle}>
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
                      {processedUsers.map(u => (
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
              )}

              {/* TAB 4: TRANSACTIONS TABLE */}
              {activeTab === "transactions" && (
                <div style={tableContainerStyle}>
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
                      {processedTx.map(tx => (
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
              )}
            </>
          )}
        </div>
      </div>

      {/* 🔴 EDIT MODAL */}
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
                    <option value="hotties">Hotties</option>
                    <option value="baddies">Baddies</option>
                    <option value="knacks">Knacks</option>
                    <option value="shots">Shots</option>
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

      {/* 🔴 DELETE MODAL */}
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

// 🎨 SUB-COMPONENTS
const SidebarBtn = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "12px 16px", borderRadius: "10px", border: "none", cursor: "pointer", fontSize: "15px", fontWeight: "600", transition: "all 0.2s",
    background: active ? "rgba(247, 147, 26, 0.1)" : "transparent", color: active ? "var(--primary-color)" : "#8e8e93"
  }}>
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

// Table Styles
const tableContainerStyle = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", overflow: "hidden", overflowX: "auto" };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const thStyle = { textAlign: "left", padding: "18px 20px", color: "#8e8e93", fontSize: "12px", textTransform: "uppercase", letterSpacing: "1px", borderBottom: "1px solid rgba(255,255,255,0.1)", userSelect: "none", whiteSpace: "nowrap" };
const trStyle = { borderBottom: "1px solid rgba(255,255,255,0.05)" };
const tdStyle = { padding: "15px 20px", fontSize: "14px" };
const badgeStyle = { padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "700" };
const premiumBadge = { ...badgeStyle, background: "rgba(52, 199, 89, 0.1)", color: "#34C759" };
const freeBadge = { ...badgeStyle, background: "rgba(255,255,255,0.05)", color: "#8e8e93" };
const iconBtnStyle = { background: "rgba(255,255,255,0.05)", border: "none", color: "#fff", padding: "8px", borderRadius: "8px", cursor: "pointer", marginLeft: "5px" };

// Header Actions
const searchBarStyle = { display: "flex", alignItems: "center", gap: "10px", background: "rgba(255,255,255,0.05)", padding: "10px 16px", borderRadius: "8px", width: "250px" };
const searchInputStyle = { background: "transparent", border: "none", color: "#fff", outline: "none", width: "100%", fontSize: "14px" };
const logoutBtnStyle = { display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "rgba(255,255,255,0.05)", color: "#fff", border: "none", padding: "14px", borderRadius: "10px", fontWeight: "600", cursor: "pointer" };
const refreshBtnStyle = { display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600" };
const uploadBtnStyle = { display: "flex", alignItems: "center", gap: "8px", background: "var(--primary-color)", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "700" };
const centerFlex = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" };

// Error Screen Styles
const errorScreenStyle = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100dvh", width: "100vw", background: "#050505", color: "#ff3b30", position: "absolute", zIndex: 999999, top: 0, left: 0 };
const goBackBtnStyle = { background: "#fff", color: "#000", padding: "12px 30px", borderRadius: "30px", border: "none", fontWeight: "700", cursor: "pointer", fontSize: "15px", transition: "transform 0.2s" };

// Modal Styles
const modalOverlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(5px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999999 };
const modalBoxStyle = { background: "#111", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "25px", width: "100%", maxWidth: "400px", margin: "0 15px" };
const modalHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" };
const inputGroupStyle = { display: "flex", flexDirection: "column", gap: "6px", marginBottom: "15px" };
const formInputStyle = { background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", padding: "12px", borderRadius: "8px", color: "#fff", fontSize: "14px", outline: "none" };
const saveBtnStyle = { width: "100%", background: "var(--primary-color)", color: "#fff", border: "none", padding: "12px", borderRadius: "8px", fontWeight: "700", fontSize: "15px", cursor: "pointer", marginTop: "10px" };