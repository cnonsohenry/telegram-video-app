import React, { useState, useEffect } from "react";
import { LayoutDashboard, Users, CreditCard, LogOut, TrendingUp, ShieldCheck, Clock, RefreshCw, UploadCloud } from "lucide-react";
import AdminUpload from "./AdminUpload"; // 🟢 IMPORT UPLOAD COMPONENT

export default function AdminDashboard({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  // 🟢 NEW: State to trigger the Upload Modal
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Data States
  const [stats, setStats] = useState({ total_users: 0, premium_users: 0, total_revenue_usd: 0, pending_crypto_orders: 0 });
  const [usersList, setUsersList] = useState([]);
  const [transactions, setTransactions] = useState([]);

  // Fetch Data based on Active Tab
  const fetchData = async () => {
    setLoading(true);
    setError("");
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem("token")}` };
      const baseUrl = import.meta.env.VITE_API_URL;

      if (activeTab === "overview") {
        const res = await fetch(`${baseUrl}/api/admin/stats`, { headers });
        if (!res.ok) throw new Error("Not authorized or server error");
        const data = await res.json();
        setStats(data);
      } else if (activeTab === "users") {
        const res = await fetch(`${baseUrl}/api/admin/users`, { headers });
        if (!res.ok) throw new Error("Failed to fetch users");
        setUsersList(await res.json());
      } else if (activeTab === "transactions") {
        const res = await fetch(`${baseUrl}/api/admin/transactions`, { headers });
        if (!res.ok) throw new Error("Failed to fetch transactions");
        setTransactions(await res.json());
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  // Security Check
  if (!user || user.role !== 'admin') {
    return (
      <div style={errorScreenStyle}>
        <ShieldCheck size={64} color="#ff3b30" style={{ marginBottom: "20px" }} />
        <h2>Access Denied</h2>
        <p>You do not have administrative privileges.</p>
        <button onClick={onLogout} style={logoutBtnStyle}>Go Back</button>
      </div>
    );
  }

  // 🟢 RENDER UPLOAD MODAL OVER EVERYTHING
  if (showUploadModal) {
    return <AdminUpload onClose={() => setShowUploadModal(false)} />;
  }

  return (
    <div style={dashboardContainerStyle}>
      {/* 🟢 SIDEBAR */}
      <div style={sidebarStyle}>
        <div>
          <h2 style={logoStyle}>NAIJA<span style={{ color: "var(--primary-color)" }}>ADMIN</span></h2>
          <div style={{ marginTop: "40px", display: "flex", flexDirection: "column", gap: "10px" }}>
            <SidebarBtn active={activeTab === "overview"} onClick={() => setActiveTab("overview")} icon={<LayoutDashboard size={20} />} label="Overview" />
            <SidebarBtn active={activeTab === "users"} onClick={() => setActiveTab("users")} icon={<Users size={20} />} label="Users" />
            <SidebarBtn active={activeTab === "transactions"} onClick={() => setActiveTab("transactions")} icon={<CreditCard size={20} />} label="Transactions" />
          </div>
        </div>
        <button onClick={onLogout} style={logoutBtnStyle}>
          <LogOut size={20} /> Exit Admin
        </button>
      </div>

      {/* 🟢 MAIN CONTENT */}
      <div style={mainContentStyle}>
        <div style={topBarStyle}>
          <h1 style={{ margin: 0, fontSize: "24px" }}>
            {activeTab === 'overview' && 'Dashboard Overview'}
            {activeTab === 'users' && 'User Management'}
            {activeTab === 'transactions' && 'Transaction History'}
          </h1>
          
          {/* 🟢 TOP ACTIONS BAR */}
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => setShowUploadModal(true)} style={uploadBtnStyle}>
              <UploadCloud size={18} />
              Upload Video
            </button>
            <button onClick={fetchData} style={refreshBtnStyle} disabled={loading}>
              <RefreshCw size={18} style={{ animation: loading ? "spin 1s linear infinite" : "none" }} />
              Refresh
            </button>
          </div>
        </div>

        {error && <div style={errorBannerStyle}>{error}</div>}

        <div style={contentAreaStyle}>
          {loading ? (
            <div style={centerFlex}>
              <RefreshCw size={40} color="var(--primary-color)" style={{ animation: "spin 1s linear infinite" }} />
              <p style={{ color: "#8e8e93", marginTop: "15px" }}>Loading data...</p>
            </div>
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

              {/* TAB 2: USERS TABLE */}
              {activeTab === "users" && (
                <div style={tableContainerStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th>Username</th>
                        <th>Email</th>
                        <th>Status</th>
                        <th>Role</th>
                        <th>Joined Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.map(u => (
                        <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <td style={{ fontWeight: "600", color: "#fff" }}>{u.username}</td>
                          <td style={{ color: "#8e8e93" }}>{u.email}</td>
                          <td>
                            {u.is_premium ? (
                              <span style={{...badgeStyle, background: "rgba(247,147,26,0.1)", color: "var(--primary-color)"}}>Premium</span>
                            ) : (
                              <span style={{...badgeStyle, background: "rgba(255,255,255,0.05)", color: "#8e8e93"}}>Free</span>
                            )}
                          </td>
                          <td style={{ textTransform: "capitalize" }}>{u.role}</td>
                          <td style={{ color: "#8e8e93" }}>{new Date(u.created_at).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* TAB 3: TRANSACTIONS TABLE */}
              {activeTab === "transactions" && (
                <div style={tableContainerStyle}>
                  <table style={tableStyle}>
                    <thead>
                      <tr>
                        <th>User</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map(tx => (
                        <tr key={tx.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                          <td style={{ fontWeight: "600", color: "#fff" }}>{tx.username || tx.email || "Unknown"}</td>
                          <td style={{ fontWeight: "700" }}>
                             ${tx.amount_usd} <span style={{ fontSize: "12px", color: "#8e8e93" }}>({tx.crypto_amount} {tx.crypto_currency.toUpperCase()})</span>
                          </td>
                          <td>{tx.payment_method?.toUpperCase() || 'TRANSFER'}</td>
                          <td>
                            {tx.status === 'APPROVED' && <span style={{...badgeStyle, background: "rgba(52,199,89,0.1)", color: "#34C759"}}>Approved</span>}
                            {tx.status === 'WAITING' && <span style={{...badgeStyle, background: "rgba(243,186,47,0.1)", color: "#F3BA2F"}}>Waiting</span>}
                            {tx.status === 'FAILED' && <span style={{...badgeStyle, background: "rgba(255,59,48,0.1)", color: "#ff3b30"}}>Failed</span>}
                          </td>
                          <td style={{ color: "#8e8e93", fontSize: "13px" }}>{new Date(tx.created_at).toLocaleString()}</td>
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
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        th { text-align: left; padding: 15px; color: #8e8e93; font-size: 13px; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid rgba(255,255,255,0.1); }
        td { padding: 15px; font-size: 14px; }
      `}</style>
    </div>
  );
}

// 🎨 SUB-COMPONENTS
const SidebarBtn = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "12px 16px", borderRadius: "10px", border: "none", cursor: "pointer", fontSize: "15px", fontWeight: "600", transition: "all 0.2s",
    background: active ? "rgba(247, 147, 26, 0.1)" : "transparent",
    color: active ? "var(--primary-color)" : "#8e8e93"
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
    <div style={{ background: bg, padding: "12px", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center" }}>
      {icon}
    </div>
  </div>
);

// 🖌 UI STYLES
const dashboardContainerStyle = { display: "flex", height: "100dvh", width: "100vw", background: "#050505", color: "#fff", position: "absolute", zIndex: 999999, top: 0, left: 0 };
const sidebarStyle = { width: "260px", background: "#0a0a0a", borderRight: "1px solid rgba(255,255,255,0.05)", padding: "30px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between" };
const logoStyle = { margin: 0, fontSize: "20px", fontWeight: "900", letterSpacing: "-1px", color: "#fff" };
const mainContentStyle = { flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" };
const topBarStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "30px 40px", borderBottom: "1px solid rgba(255,255,255,0.05)" };
const contentAreaStyle = { flex: 1, overflowY: "auto", padding: "40px" };
const gridStatsStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px" };
const tableContainerStyle = { background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: "16px", overflow: "hidden" };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const badgeStyle = { padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "700" };
const logoutBtnStyle = { display: "flex", alignItems: "center", justifyContent: "center", gap: "10px", background: "rgba(255,255,255,0.05)", color: "#fff", border: "none", padding: "14px", borderRadius: "10px", fontWeight: "600", cursor: "pointer" };
const refreshBtnStyle = { display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "600" };
const uploadBtnStyle = { display: "flex", alignItems: "center", gap: "8px", background: "var(--primary-color)", color: "#fff", border: "none", padding: "10px 16px", borderRadius: "8px", cursor: "pointer", fontSize: "14px", fontWeight: "700" };
const errorScreenStyle = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100dvh", width: "100vw", background: "#050505", color: "#fff", position: "absolute", zIndex: 999999, top: 0, left: 0 };
const errorBannerStyle = { background: "rgba(255, 59, 48, 0.1)", color: "#ff3b30", padding: "15px 40px", borderBottom: "1px solid rgba(255, 59, 48, 0.2)" };
const centerFlex = { display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" };