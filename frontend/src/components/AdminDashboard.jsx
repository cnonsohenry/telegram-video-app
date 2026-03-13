import React, { useState, useEffect } from "react";
import { Search, Filter, Edit3, Trash2, X, Play, ShieldCheck, User, Video, ChevronDown, Check, AlertTriangle, LogOut } from "lucide-react";

export default function AdminDashboard({ user, onLogout }) {
  const [activeView, setActiveView] = useState("videos"); // 'videos' or 'users'
  const [searchQuery, setSearchQuery] = useState("");
  
  // Data States
  const [videos, setVideos] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  // Modal States
  const [editingVideo, setEditingVideo] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [deleteWarning, setDeleteWarning] = useState(null);

  // 🟢 1. FETCH DATA ON LOAD
  const fetchData = async () => {
    setLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${localStorage.getItem("token")}` };
      const endpoint = activeView === 'videos' ? '/api/admin/all-videos' : '/api/admin/users';
      const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, { headers });
      const data = await res.json();
      
      if (activeView === 'videos') setVideos(data);
      else setUsers(data);
    } catch (err) {
      console.error("Failed to fetch:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [activeView]);

  // 🟢 2. INSTANT SEARCH FILTER
  const filteredVideos = videos.filter(v => 
    v.caption?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    v.category?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredUsers = users.filter(u => 
    u.username?.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 🟢 3. UPDATE VIDEO API CALL
  const handleUpdateVideo = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/admin/video/${editingVideo.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ caption: editingVideo.caption, category: editingVideo.category })
      });

      if (res.ok) {
        // Update the UI instantly without refreshing the page
        setVideos(videos.map(v => v.id === editingVideo.id ? editingVideo : v));
        setEditingVideo(null); // Close the modal
      } else {
        alert("Failed to update video.");
      }
    } catch (err) {
      console.error("Update error:", err);
    }
  };

  // 🟢 4. DELETE ITEM API CALL
  const handleDeleteItem = async () => {
    try {
      const endpoint = deleteWarning.type === 'video' 
        ? `/api/admin/video/${deleteWarning.id}` 
        : `/api/admin/user/${deleteWarning.id}`;

      const res = await fetch(`${import.meta.env.VITE_API_URL}${endpoint}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem("token")}` }
      });

      if (res.ok) {
        // Remove it from the UI instantly
        if (deleteWarning.type === 'video') {
          setVideos(videos.filter(v => v.id !== deleteWarning.id));
        } else {
          setUsers(users.filter(u => u.id !== deleteWarning.id));
        }
        setDeleteWarning(null); // Close the modal
      } else {
        alert("Failed to delete item.");
      }
    } catch (err) {
      console.error("Delete error:", err);
    }
  };

  return (
    <div style={containerStyle}>
      
      {/* 🎬 TOP NAV */}
      <div style={topNavStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "30px" }}>
          <h1 style={logoStyle}>STUDIO<span style={{color: "var(--primary-color)"}}>CTRL</span></h1>
          <div style={tabContainerStyle}>
            <button onClick={() => setActiveView("videos")} style={activeView === "videos" ? activeTabStyle : inactiveTabStyle}>
              <Video size={18} /> Content Library
            </button>
            <button onClick={() => setActiveView("users")} style={activeView === "users" ? activeTabStyle : inactiveTabStyle}>
              <User size={18} /> Audience
            </button>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <div style={searchBarStyle}>
            <Search size={18} color="#8e8e93" />
            <input 
              type="text" 
              placeholder={`Search ${activeView}...`} 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={searchInputStyle}
            />
          </div>
          <button onClick={onLogout} style={exitBtnStyle}>
            <LogOut size={18} /> Exit
          </button>
        </div>
      </div>

      <div style={contentAreaStyle}>
        
        {loading && <div style={{textAlign: "center", color: "#8e8e93", marginTop: "50px"}}>Loading data...</div>}

        {/* 🎬 VIDEO GRID (Content Library) */}
        {!loading && activeView === "videos" && (
          <div style={videoGridStyle}>
            {filteredVideos.map(video => (
              <div key={video.id} style={videoCardStyle} className="video-card">
                <img src={video.thumbnail_url || '/assets/default-avatar.png'} alt="thumb" style={videoThumbStyle} />
                <div className="video-overlay" style={videoOverlayStyle}>
                  <h3 style={{ margin: "0 0 5px 0", fontSize: "14px", fontWeight: "700" }}>{video.caption || "Untitled"}</h3>
                  <p style={{ margin: "0 0 15px 0", fontSize: "12px", color: "#ccc" }}>{video.views} views • {video.category}</p>
                  
                  <div style={{ display: "flex", gap: "10px" }}>
                    <button onClick={() => setEditingVideo(video)} style={actionBtnStyle}><Edit3 size={16} /> Edit</button>
                    <button onClick={() => setDeleteWarning({ type: 'video', id: video.id, name: video.caption })} style={{...actionBtnStyle, background: "rgba(255, 59, 48, 0.2)", color: "#ff3b30"}}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 👤 USER DATA TABLE (Audience) */}
        {!loading && activeView === "users" && (
          <div style={tableWrapperStyle}>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Tier</th>
                  <th>Role</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                    <td style={{ display: "flex", alignItems: "center", gap: "10px", padding: "15px" }}>
                      <img src={u.avatar_url} alt="" style={{ width: "32px", height: "32px", borderRadius: "50%" }} />
                      <span style={{ fontWeight: "600", color: "#fff" }}>{u.username}</span>
                    </td>
                    <td style={{ padding: "15px", color: "#ccc" }}>{u.email}</td>
                    <td style={{ padding: "15px" }}>
                      {u.is_premium ? <span style={premiumBadge}>Premium</span> : <span style={freeBadge}>Free</span>}
                    </td>
                    <td style={{ padding: "15px", textTransform: "capitalize", color: u.role === 'admin' ? '#ff453a' : '#8e8e93' }}>{u.role}</td>
                    <td style={{ padding: "15px", display: "flex", gap: "10px" }}>
                       <button onClick={() => setDeleteWarning({ type: 'user', id: u.id, name: u.username })} style={{...iconBtnStyle, color: "#ff3b30"}}><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🔴 EDIT VIDEO MODAL */}
      {editingVideo && (
        <div style={modalOverlayStyle}>
          <form onSubmit={handleUpdateVideo} style={modalBoxStyle}>
            <div style={modalHeaderStyle}>
              <h2 style={{margin: 0}}>Edit Content</h2>
              <X size={24} cursor="pointer" color="#8e8e93" onClick={() => setEditingVideo(null)} />
            </div>
            <div style={inputGroupStyle}>
              <label style={{fontSize: "12px", color: "#8e8e93"}}>CAPTION / TITLE</label>
              <input type="text" value={editingVideo.caption} onChange={e => setEditingVideo({...editingVideo, caption: e.target.value})} style={formInputStyle} />
            </div>
            <div style={inputGroupStyle}>
              <label style={{fontSize: "12px", color: "#8e8e93"}}>CATEGORY</label>
              <select value={editingVideo.category} onChange={e => setEditingVideo({...editingVideo, category: e.target.value})} style={formInputStyle}>
                <option value="hotties">Hotties</option>
                <option value="baddies">Baddies</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <button type="submit" style={saveBtnStyle}>Save Changes</button>
          </form>
        </div>
      )}

      {/* 🔴 DANGER MODAL (DELETE CONFIRMATION) */}
      {deleteWarning && (
        <div style={modalOverlayStyle}>
          <div style={{...modalBoxStyle, textAlign: "center", maxWidth: "350px"}}>
            <AlertTriangle size={48} color="#ff3b30" style={{ margin: "0 auto 15px auto" }} />
            <h2 style={{ margin: "0 0 10px 0" }}>Delete {deleteWarning.type}?</h2>
            <p style={{ color: "#8e8e93", fontSize: "14px", marginBottom: "20px" }}>
              Are you sure you want to permanently delete <strong>{deleteWarning.name}</strong>? This cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setDeleteWarning(null)} style={{ flex: 1, padding: "12px", background: "#333", border: "none", color: "#fff", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Cancel</button>
              <button onClick={handleDeleteItem} style={{ flex: 1, padding: "12px", background: "#ff3b30", border: "none", color: "#fff", borderRadius: "8px", cursor: "pointer", fontWeight: "600" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* 🔴 GLOBAL CSS FOR HOVER EFFECTS */}
      <style>{`
        .video-card { position: relative; overflow: hidden; border-radius: 8px; transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; background: #1a1a1a; aspect-ratio: 9/16; }
        .video-card:hover { transform: scale(1.05); z-index: 10; box-shadow: 0 20px 40px rgba(0,0,0,0.8); border: 2px solid var(--primary-color); }
        .video-overlay { position: absolute; inset: 0; background: linear-gradient(to top, rgba(0,0,0,0.9) 0%, rgba(0,0,0,0.4) 50%, transparent 100%); display: flex; flexDirection: column; justify-content: flex-end; padding: 15px; opacity: 0; transition: opacity 0.3s; }
        .video-card:hover .video-overlay { opacity: 1; }
        th { text-align: left; padding: 15px; color: #8e8e93; font-size: 13px; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
}

// 🖌 UI STYLES
const containerStyle = { minHeight: "100dvh", width: "100vw", background: "#141414", color: "#fff", display: "flex", flexDirection: "column", position: "absolute", zIndex: 999999, top: 0, left: 0 };
const topNavStyle = { position: "sticky", top: 0, zIndex: 100, background: "rgba(20,20,20,0.9)", backdropFilter: "blur(20px)", padding: "20px 40px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(255,255,255,0.05)" };
const logoStyle = { margin: 0, fontSize: "24px", fontWeight: "900", letterSpacing: "-1px" };
const tabContainerStyle = { display: "flex", gap: "20px" };
const inactiveTabStyle = { background: "transparent", border: "none", color: "#e5e5e5", fontSize: "16px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px", cursor: "pointer", opacity: 0.6, transition: "opacity 0.2s" };
const activeTabStyle = { ...inactiveTabStyle, opacity: 1, textShadow: "0 0 10px rgba(255,255,255,0.3)" };
const searchBarStyle = { display: "flex", alignItems: "center", gap: "10px", background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.2)", padding: "8px 16px", borderRadius: "30px", width: "300px" };
const searchInputStyle = { background: "transparent", border: "none", color: "#fff", outline: "none", width: "100%", fontSize: "14px" };
const exitBtnStyle = { display: "flex", alignItems: "center", gap: "8px", background: "rgba(255,255,255,0.05)", border: "none", color: "#fff", padding: "10px 16px", borderRadius: "30px", cursor: "pointer", fontSize: "14px", fontWeight: "600" };
const contentAreaStyle = { padding: "40px", flex: 1, overflowY: "auto" };
const videoGridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "20px" };
const videoThumbStyle = { width: "100%", height: "100%", objectFit: "cover" };
const videoOverlayStyle = { position: "absolute", bottom: 0, left: 0, right: 0, padding: "15px", display: "flex", flexDirection: "column" };
const actionBtnStyle = { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "8px", background: "rgba(255,255,255,0.2)", backdropFilter: "blur(5px)", border: "none", color: "#fff", borderRadius: "6px", cursor: "pointer", fontWeight: "600", fontSize: "13px" };
const tableWrapperStyle = { background: "#1a1a1a", borderRadius: "12px", overflow: "hidden", border: "1px solid rgba(255,255,255,0.05)" };
const tableStyle = { width: "100%", borderCollapse: "collapse" };
const premiumBadge = { background: "rgba(247,147,26,0.1)", color: "var(--primary-color)", padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "700" };
const freeBadge = { background: "rgba(255,255,255,0.05)", color: "#8e8e93", padding: "4px 10px", borderRadius: "20px", fontSize: "12px", fontWeight: "700" };
const iconBtnStyle = { background: "rgba(255,255,255,0.05)", border: "none", color: "#fff", padding: "8px", borderRadius: "8px", cursor: "pointer" };
const videoCardStyle = { position: "relative", overflow: "hidden", borderRadius: "8px", background: "#1a1a1a", aspectRatio: "9/16", cursor: "pointer" };

// Modal Styles
const modalOverlayStyle = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999999 };
const modalBoxStyle = { background: "#141414", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "16px", padding: "30px", width: "100%", maxWidth: "450px" };
const modalHeaderStyle = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "25px" };
const inputGroupStyle = { display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" };
const formInputStyle = { background: "rgba(0,0,0,0.5)", border: "1px solid rgba(255,255,255,0.1)", padding: "12px", borderRadius: "8px", color: "#fff", fontSize: "15px", outline: "none" };
const saveBtnStyle = { width: "100%", background: "var(--primary-color)", color: "#fff", border: "none", padding: "14px", borderRadius: "8px", fontWeight: "700", fontSize: "16px", cursor: "pointer", marginTop: "10px" };