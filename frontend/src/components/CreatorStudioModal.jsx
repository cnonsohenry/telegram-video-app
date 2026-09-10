import React, { useState, useEffect, useCallback } from "react";
import { 
  X, Sparkles, Users, DollarSign, Heart, Eye, ThumbsUp, 
  MessageCircle, Settings, Calendar, Lock, CheckCircle, 
  CheckCircle2, Clock, TrendingUp, Edit3, Save, ExternalLink, 
  Loader2, AlertCircle, ShieldCheck, Plus, UploadCloud, Trash2
} from "lucide-react";
import { APP_CONFIG } from "../config";
import CreatorUploadModal from "./CreatorUploadModal";

export default function CreatorStudioModal({ isOpen, onClose, user, onUpdateUser }) {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  // Upload modal state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDefaultCategory, setUploadDefaultCategory] = useState("hotties");
  const [deletingMessageId, setDeletingMessageId] = useState(null);

  // Settings form state
  const [editPrice, setEditPrice] = useState(0);
  const [editDisplayName, setEditDisplayName] = useState("");
  const [editCategory, setEditCategory] = useState("Creator");
  const [editBio, setEditBio] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState(false);

  const fetchStudioInsights = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      if (!token) throw new Error("Authentication required");

      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/studio/insights`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to load studio data");
      }

      const json = await res.json();
      setData(json);

      if (json.creator) {
        setEditPrice(json.creator.subscription_price || 0);
        setEditDisplayName(json.creator.display_name || "");
        setEditCategory(json.creator.creator_category || "Creator");
        setEditBio(json.creator.creator_bio || "");
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = "hidden";
    fetchStudioInsights();

    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, fetchStudioInsights]);

  const handleDeleteVideo = async (messageId) => {
    if (!window.confirm("Are you sure you want to delete this video? This cannot be undone.")) return;
    setDeletingMessageId(messageId);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/videos/${encodeURIComponent(messageId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to delete video");
      }
      setData(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          top_videos: prev.top_videos.filter(v => v.message_id !== messageId),
          stats: {
            ...prev.stats,
            posts_count: Math.max(0, (prev.stats?.posts_count || 1) - 1)
          }
        };
      });
      window.dispatchEvent(new CustomEvent("videoDeleted", { detail: messageId }));
    } catch (err) {
      alert(err.message || "Failed to delete video");
    } finally {
      setDeletingMessageId(null);
    }
  };

  if (!isOpen) return null;

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsSuccess(false);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/creator/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          display_name: editDisplayName,
          creator_category: editCategory,
          subscription_price: Number(editPrice),
          creator_bio: editBio
        })
      });

      const updated = await res.json();
      if (!res.ok || !updated.success) {
        throw new Error(updated.error || "Failed to update settings");
      }

      setSettingsSuccess(true);
      if (onUpdateUser) {
        onUpdateUser(updated.user);
      }
      setTimeout(() => setSettingsSuccess(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingSettings(false);
    }
  };

  const stats = data?.stats || {};
  const creator = data?.creator || user || {};

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={modalBoxStyle} onClick={(e) => e.stopPropagation()}>
        
        {/* Top Navbar */}
        <div style={topNavStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={studioLogoBadgeStyle}>
              <Sparkles size={18} color="#FFD700" />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <h2 style={studioTitleStyle}>{creator.display_name || creator.username} Studio</h2>
                {creator.is_verified && <CheckCircle size={15} color="#00aff0" fill="#00aff0" />}
              </div>
              <span style={studioSubtitleStyle}>Creator Monetization & Fan Intelligence</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button 
              onClick={() => {
                setUploadDefaultCategory("hotties");
                setShowUploadModal(true);
              }} 
              style={{
                ...previewBtnStyle,
                background: "linear-gradient(135deg, #00aff0, #0088cc)",
                borderColor: "transparent",
                color: "#fff",
                fontWeight: "700"
              }}
              title="Upload video"
            >
              <Plus size={15} />
              <span>Upload Video</span>
            </button>
            <button 
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent("openCreatorProfile", { detail: creator.username }));
              }} 
              style={previewBtnStyle}
              title="Preview public profile"
            >
              <ExternalLink size={15} />
              <span className="hide-on-mobile">Public Profile</span>
            </button>
            <button onClick={onClose} style={closeBtnStyle}>
              <X size={20} color="#888" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div style={tabsBarStyle}>
          <button 
            onClick={() => setActiveTab("overview")} 
            style={{ ...tabBtnStyle, borderBottomColor: activeTab === "overview" ? "var(--primary-color)" : "transparent", color: activeTab === "overview" ? "#fff" : "#8e8e93" }}
          >
            <TrendingUp size={16} />
            <span>Overview</span>
          </button>
          <button 
            onClick={() => setActiveTab("subscribers")} 
            style={{ ...tabBtnStyle, borderBottomColor: activeTab === "subscribers" ? "var(--primary-color)" : "transparent", color: activeTab === "subscribers" ? "#fff" : "#8e8e93" }}
          >
            <Users size={16} />
            <span>VIP Fans ({stats.active_subscribers || 0})</span>
          </button>
          <button 
            onClick={() => setActiveTab("tips")} 
            style={{ ...tabBtnStyle, borderBottomColor: activeTab === "tips" ? "var(--primary-color)" : "transparent", color: activeTab === "tips" ? "#fff" : "#8e8e93" }}
          >
            <Heart size={16} />
            <span>Tips ({stats.tips_count || 0})</span>
          </button>
          <button 
            onClick={() => setActiveTab("videos")} 
            style={{ ...tabBtnStyle, borderBottomColor: activeTab === "videos" ? "var(--primary-color)" : "transparent", color: activeTab === "videos" ? "#fff" : "#8e8e93" }}
          >
            <Eye size={16} />
            <span>Content ({stats.posts_count || 0})</span>
          </button>
          <button 
            onClick={() => setActiveTab("settings")} 
            style={{ ...tabBtnStyle, borderBottomColor: activeTab === "settings" ? "var(--primary-color)" : "transparent", color: activeTab === "settings" ? "#fff" : "#8e8e93" }}
          >
            <Settings size={16} />
            <span>Pricing & Rates</span>
          </button>
        </div>

        {/* Body Content */}
        <div style={contentAreaStyle}>
          {loading ? (
            <div style={loaderCenterStyle}>
              <Loader2 size={36} className="animate-spin" color="var(--primary-color)" />
              <span style={{ marginTop: "14px", color: "#8e8e93", fontSize: "14px" }}>Loading studio insights...</span>
            </div>
          ) : error ? (
            <div style={errorCenterStyle}>
              <AlertCircle size={36} color="#ff3b30" />
              <p style={{ color: "#fff", marginTop: "10px", fontSize: "14px" }}>{error}</p>
            </div>
          ) : (
            <>
              {/* TAB 1: OVERVIEW */}
              {activeTab === "overview" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
                  {/* KPI Cards Grid */}
                  <div style={kpiGridStyle}>
                    <div style={kpiCardStyle}>
                      <div style={kpiIconBox("rgba(0, 208, 132, 0.15)", "#00d084")}>
                        <DollarSign size={22} />
                      </div>
                      <span style={kpiLabelStyle}>Active Sub Revenue</span>
                      <div style={kpiValueStyle}>
                        ${(stats.subscription_revenue_usd || 0).toFixed(2)}{" "}
                        <span style={{ fontSize: "12px", color: "#8e8e93", fontWeight: "500" }}>USD</span>
                      </div>
                      <span style={kpiSubtextStyle}>From crypto-confirmed subscriptions</span>
                    </div>

                    <div style={kpiCardStyle}>
                      <div style={kpiIconBox("rgba(249, 24, 128, 0.15)", "#f91880")}>
                        <Heart size={22} />
                      </div>
                      <span style={kpiLabelStyle}>Fan Tips Received</span>
                      <div style={kpiValueStyle}>
                        ₦{(stats.tips_total_ngn || 0).toLocaleString()}
                      </div>
                      <span style={kpiSubtextStyle}>{stats.tips_count || 0} supporters tipped</span>
                    </div>

                    <div style={kpiCardStyle}>
                      <div style={kpiIconBox("rgba(0, 175, 240, 0.15)", "#00aff0")}>
                        <Users size={22} />
                      </div>
                      <span style={kpiLabelStyle}>Active VIP Subscribers</span>
                      <div style={kpiValueStyle}>{stats.active_subscribers || 0}</div>
                      <span style={kpiSubtextStyle}>
                        Monthly Rate: ₦{Number(creator.subscription_price || 0).toLocaleString()}
                      </span>
                    </div>

                    <div style={kpiCardStyle}>
                      <div style={kpiIconBox("rgba(243, 186, 47, 0.15)", "#F3BA2F")}>
                        <Eye size={22} />
                      </div>
                      <span style={kpiLabelStyle}>Channel Views</span>
                      <div style={kpiValueStyle}>
                        {(stats.total_views || 0).toLocaleString()}
                      </div>
                      <span style={kpiSubtextStyle}>{stats.total_likes || 0} total likes</span>
                    </div>
                  </div>

                  {/* Monthly Run Rate Banner */}
                  <div style={runRateCardStyle}>
                    <div>
                      <span style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "1px", color: "#8e8e93", fontWeight: "700" }}>
                        Projected Monthly Recurring Revenue (MRR)
                      </span>
                      <div style={{ fontSize: "24px", fontWeight: "900", color: "#00d084", marginTop: "4px" }}>
                        ₦{(stats.estimated_mrr_ngn || 0).toLocaleString()} / month
                      </div>
                      <span style={{ fontSize: "12px", color: "#8e8e93", marginTop: "2px", display: "block" }}>
                        Based on {stats.active_subscribers || 0} active fans at ₦{Number(creator.subscription_price || 0).toLocaleString()}/mo
                      </span>
                    </div>
                    <button 
                      onClick={() => setActiveTab("settings")} 
                      style={adjustRatesBtnStyle}
                    >
                      <Edit3 size={15} />
                      <span>Adjust Pricing</span>
                    </button>
                  </div>

                  {/* Recent Tips & Subscribers Split View */}
                  <div style={splitViewGridStyle}>
                    {/* Recent Tips */}
                    <div style={subBoxStyle}>
                      <div style={subBoxHeaderStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Heart size={16} color="#f91880" />
                          <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#fff" }}>Recent Fan Tips</h4>
                        </div>
                        <button onClick={() => setActiveTab("tips")} style={seeAllBtnStyle}>See All</button>
                      </div>

                      {(data?.tips || []).length === 0 ? (
                        <div style={emptyBoxStyle}>
                          <Heart size={28} color="#444" />
                          <span style={{ fontSize: "12px", color: "#777", marginTop: "8px" }}>No tips received yet.</span>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {data.tips.slice(0, 4).map((t) => (
                            <div key={t.id} style={tipRowStyle}>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <img 
                                  src={t.sender_avatar || "/assets/default-avatar.png"} 
                                  alt="" 
                                  style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }}
                                  onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                                />
                                <div>
                                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#fff" }}>
                                    @{t.sender_username || "Anonymous Fan"}
                                  </div>
                                  {t.message && (
                                    <div style={{ fontSize: "11px", color: "#aaa", fontStyle: "italic", maxWidth: "220px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                      "{t.message}"
                                    </div>
                                  )}
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <span style={{ fontSize: "13px", fontWeight: "800", color: "#00d084" }}>
                                  +₦{Number(t.amount || 0).toLocaleString()}
                                </span>
                                <span style={{ fontSize: "10px", color: "#777", display: "block" }}>
                                  {new Date(t.created_at).toLocaleDateString()}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Active Subscribers */}
                    <div style={subBoxStyle}>
                      <div style={subBoxHeaderStyle}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <Users size={16} color="#00aff0" />
                          <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#fff" }}>Active VIP Subscribers</h4>
                        </div>
                        <button onClick={() => setActiveTab("subscribers")} style={seeAllBtnStyle}>See All</button>
                      </div>

                      {(data?.subscribers || []).length === 0 ? (
                        <div style={emptyBoxStyle}>
                          <Users size={28} color="#444" />
                          <span style={{ fontSize: "12px", color: "#777", marginTop: "8px" }}>No subscribers yet. Share your profile to get fans!</span>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                          {data.subscribers.slice(0, 4).map((s) => (
                            <div key={s.id} style={tipRowStyle}>
                              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                <img 
                                  src={s.subscriber_avatar || "/assets/default-avatar.png"} 
                                  alt="" 
                                  style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }}
                                  onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                                />
                                <div>
                                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#fff" }}>
                                    @{s.subscriber_username}
                                  </div>
                                  <div style={{ fontSize: "11px", color: "#8e8e93" }}>
                                    Subscribed {new Date(s.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                              <span style={activeBadgeStyle}>Active</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: VIP SUBSCRIBERS */}
              {activeTab === "subscribers" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#fff" }}>
                        All VIP Subscribers ({data?.subscribers?.length || 0})
                      </h3>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#8e8e93" }}>
                        Fans with active passes to your exclusive drops
                      </p>
                    </div>
                  </div>

                  {(data?.subscribers || []).length === 0 ? (
                    <div style={emptyBoxStyle}>
                      <Users size={36} color="#555" />
                      <h4 style={{ margin: "10px 0 4px 0", color: "#fff" }}>No Subscribers Yet</h4>
                      <p style={{ margin: 0, fontSize: "12px", color: "#8e8e93" }}>
                        When users pay the subscription fee with crypto, they will be listed here automatically.
                      </p>
                    </div>
                  ) : (
                    <div style={tableContainerStyle}>
                      <table style={tableStyle}>
                        <thead>
                          <tr>
                            <th style={thStyle}>Subscriber</th>
                            <th style={thStyle}>Joined Date</th>
                            <th style={thStyle}>Pass Expiry</th>
                            <th style={thStyle}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.subscribers.map((sub) => (
                            <tr key={sub.id} style={trStyle}>
                              <td style={tdStyle}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  <img 
                                    src={sub.subscriber_avatar || "/assets/default-avatar.png"} 
                                    alt="" 
                                    style={{ width: "32px", height: "32px", borderRadius: "50%", objectFit: "cover" }}
                                    onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                                  />
                                  <div>
                                    <div style={{ fontWeight: "700", color: "#fff", fontSize: "13px" }}>
                                      {sub.subscriber_display_name || sub.subscriber_username}
                                    </div>
                                    <div style={{ fontSize: "11px", color: "#8e8e93" }}>
                                      @{sub.subscriber_username}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ ...tdStyle, color: "#8e8e93", fontSize: "12px" }}>
                                {new Date(sub.created_at).toLocaleDateString()}
                              </td>
                              <td style={{ ...tdStyle, color: "#8e8e93", fontSize: "12px" }}>
                                {sub.expires_at ? new Date(sub.expires_at).toLocaleDateString() : "Never (Lifetime)"}
                              </td>
                              <td style={tdStyle}>
                                <span style={activeBadgeStyle}>Active</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 3: FAN TIPS */}
              {activeTab === "tips" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#fff" }}>
                      Tip History & Support Messages
                    </h3>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#8e8e93" }}>
                      All tips sent by your audience via NOWPayments crypto or direct balance
                    </p>
                  </div>

                  {(data?.tips || []).length === 0 ? (
                    <div style={emptyBoxStyle}>
                      <Heart size={36} color="#555" />
                      <h4 style={{ margin: "10px 0 4px 0", color: "#fff" }}>No Tips Received Yet</h4>
                      <p style={{ margin: 0, fontSize: "12px", color: "#8e8e93" }}>
                        Encourage fans to send you tips by dropping exclusive preview clips.
                      </p>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      {data.tips.map((t) => (
                        <div key={t.id} style={tipCardDetailedStyle}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              <img 
                                src={t.sender_avatar || "/assets/default-avatar.png"} 
                                alt="" 
                                style={{ width: "38px", height: "38px", borderRadius: "50%", objectFit: "cover" }}
                                onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
                              />
                              <div>
                                <span style={{ fontWeight: "700", color: "#fff", fontSize: "14px" }}>
                                  @{t.sender_username || "Anonymous Fan"}
                                </span>
                                <span style={{ display: "block", fontSize: "11px", color: "#8e8e93" }}>
                                  {new Date(t.created_at).toLocaleString()}
                                </span>
                              </div>
                            </div>
                            <div style={{ fontSize: "16px", fontWeight: "900", color: "#00d084" }}>
                              +₦{Number(t.amount).toLocaleString()}
                            </div>
                          </div>
                          {t.message && (
                            <div style={tipMessageBubbleStyle}>
                              "{t.message}"
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 4: VIDEOS PERFORMANCE */}
              {activeTab === "videos" && (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#fff" }}>
                        Video Performance Analytics
                      </h3>
                      <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#8e8e93" }}>
                        Posts ordered by engagement & view count
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        setUploadDefaultCategory("hotties");
                        setShowUploadModal(true);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "linear-gradient(135deg, #00aff0, #0088cc)",
                        color: "#fff",
                        border: "none",
                        padding: "8px 14px",
                        borderRadius: "10px",
                        fontSize: "13px",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      <Plus size={15} />
                      <span>Upload New Video</span>
                    </button>
                  </div>

                  {(data?.top_videos || []).length === 0 ? (
                    <div style={emptyBoxStyle}>
                      <Eye size={36} color="#555" />
                      <h4 style={{ margin: "10px 0 4px 0", color: "#fff" }}>No Uploaded Content Yet</h4>
                      <p style={{ margin: "0 0 14px 0", fontSize: "12px", color: "#8e8e93", maxWidth: "340px", textAlign: "center" }}>
                        Upload videos directly from your browser to your public feed or VIP exclusive channel.
                      </p>
                      <button
                        onClick={() => {
                          setUploadDefaultCategory("hotties");
                          setShowUploadModal(true);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          background: "linear-gradient(135deg, #00aff0, #0088cc)",
                          color: "#fff",
                          border: "none",
                          padding: "10px 20px",
                          borderRadius: "10px",
                          fontSize: "13.5px",
                          fontWeight: "700",
                          cursor: "pointer"
                        }}
                      >
                        <Plus size={15} />
                        <span>Upload First Video</span>
                      </button>
                    </div>
                  ) : (
                    <div style={tableContainerStyle}>
                      <table style={tableStyle}>
                        <thead>
                          <tr>
                            <th style={thStyle}>Post</th>
                            <th style={thStyle}>Category</th>
                            <th style={thStyle}>Views</th>
                            <th style={thStyle}>Likes</th>
                            <th style={thStyle}>Uploaded</th>
                            <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {data.top_videos.map((vid) => (
                            <tr key={vid.id} style={trStyle}>
                              <td style={tdStyle}>
                                <div style={{ fontSize: "13px", fontWeight: "600", color: "#fff", maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  {vid.caption || "Untitled Post"}
                                </div>
                              </td>
                              <td style={tdStyle}>
                                <span style={{
                                  ...categoryBadgeStyle,
                                  backgroundColor: vid.category === "premium" ? "rgba(255, 215, 0, 0.15)" : categoryBadgeStyle.backgroundColor,
                                  color: vid.category === "premium" ? "#FFD700" : categoryBadgeStyle.color,
                                  borderColor: vid.category === "premium" ? "rgba(255, 215, 0, 0.4)" : "transparent"
                                }}>
                                  {vid.category === "premium" ? "VIP Exclusive" : (vid.category || "General")}
                                </span>
                              </td>
                              <td style={{ ...tdStyle, fontWeight: "700", color: "#00aff0" }}>
                                {(vid.views || 0).toLocaleString()}
                              </td>
                              <td style={{ ...tdStyle, color: "#f91880", fontWeight: "700" }}>
                                {(vid.likes_count || 0).toLocaleString()}
                              </td>
                              <td style={{ ...tdStyle, color: "#8e8e93", fontSize: "12px" }}>
                                {new Date(vid.created_at).toLocaleDateString()}
                              </td>
                              <td style={{ ...tdStyle, textAlign: "right" }}>
                                <button
                                  onClick={() => handleDeleteVideo(vid.message_id)}
                                  disabled={deletingMessageId === vid.message_id}
                                  style={{
                                    background: "none",
                                    border: "none",
                                    color: "#ff3b30",
                                    cursor: "pointer",
                                    padding: "4px 8px",
                                    borderRadius: "6px",
                                    opacity: deletingMessageId === vid.message_id ? 0.5 : 1
                                  }}
                                  title="Delete video"
                                >
                                  {deletingMessageId === vid.message_id ? (
                                    <Loader2 size={14} className="animate-spin" />
                                  ) : (
                                    <Trash2 size={14} />
                                  )}
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: PRICING & SETTINGS */}
              {activeTab === "settings" && (
                <form onSubmit={handleSaveSettings} style={settingsFormStyle}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#fff" }}>
                      Monetization & Creator Profile Settings
                    </h3>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#8e8e93" }}>
                      Control your monthly fan subscription price and profile identity
                    </p>
                  </div>

                  {settingsSuccess && (
                    <div style={successBannerStyle}>
                      <CheckCircle2 size={16} />
                      <span>Settings updated successfully!</span>
                    </div>
                  )}

                  {error && <div style={errorBannerStyle}>{error}</div>}

                  <div style={formRowStyle}>
                    <label style={fieldLabelStyle}>Monthly VIP Subscription Price (₦ NGN)</label>
                    <div style={{ position: "relative" }}>
                      <span style={priceSymbolStyle}>₦</span>
                      <input 
                        type="number"
                        min={0}
                        step={500}
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value)}
                        style={{ ...inputStyle, paddingLeft: "36px" }}
                        placeholder="0 for free subscription"
                      />
                    </div>
                    <span style={fieldHintStyle}>
                      Set to 0 for free followers. Set an amount (e.g. ₦15,000) to require crypto checkout.
                    </span>
                  </div>

                  <div style={formRowStyle}>
                    <label style={fieldLabelStyle}>Display Name</label>
                    <input 
                      type="text"
                      maxLength={60}
                      value={editDisplayName}
                      onChange={(e) => setEditDisplayName(e.target.value)}
                      style={inputStyle}
                      placeholder="e.g. Bella Gold"
                    />
                  </div>

                  <div style={formRowStyle}>
                    <label style={fieldLabelStyle}>Creator Category</label>
                    <select 
                      value={editCategory} 
                      onChange={(e) => setEditCategory(e.target.value)}
                      style={inputStyle}
                    >
                      <option value="Creator">General Creator</option>
                      <option value="Model">Model & Visuals</option>
                      <option value="Influencer">Influencer</option>
                      <option value="Dancer">Dancer</option>
                      <option value="Fitness">Fitness & Wellness</option>
                      <option value="Blogger">Blogger / Vlogger</option>
                      <option value="Musician">Musician / Artist</option>
                    </select>
                  </div>

                  <div style={formRowStyle}>
                    <label style={fieldLabelStyle}>Bio / Channel Description</label>
                    <textarea 
                      rows={3}
                      maxLength={300}
                      value={editBio}
                      onChange={(e) => setEditBio(e.target.value)}
                      style={textareaStyle}
                      placeholder="Tell fans what exclusive drops they get by subscribing..."
                    />
                  </div>

                  <button 
                    type="submit" 
                    disabled={savingSettings}
                    style={saveBtnStyle}
                  >
                    {savingSettings ? (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                        <Loader2 size={16} className="animate-spin" />
                        <span>Saving...</span>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
                        <Save size={16} />
                        <span>Save Studio Settings</span>
                      </div>
                    )}
                  </button>
                </form>
              )}
            </>
          )}
        </div>

      </div>

      {/* Creator Video Upload Modal */}
      {showUploadModal && (
        <CreatorUploadModal 
          isOpen={showUploadModal}
          onClose={() => setShowUploadModal(false)}
          onSuccess={(newVideo) => {
            fetchStudioInsights();
            if (newVideo) {
              window.dispatchEvent(new CustomEvent("creatorVideoUploaded", { detail: newVideo }));
            }
          }}
          defaultCategory={uploadDefaultCategory}
          user={user}
        />
      )}
    </div>
  );
}

// 🖌 Styles
const overlayStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 100003,
  backgroundColor: "rgba(0, 0, 0, 0.88)",
  backdropFilter: "blur(10px)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px"
};

const modalBoxStyle = {
  backgroundColor: "#111113",
  border: "1px solid rgba(255, 255, 255, 0.12)",
  borderRadius: "24px",
  width: "100%",
  maxWidth: "860px",
  height: "88vh",
  boxShadow: "0 25px 70px rgba(0, 0, 0, 0.95)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden"
};

const topNavStyle = {
  padding: "16px 24px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  background: "#161619"
};

const studioLogoBadgeStyle = {
  width: "38px",
  height: "38px",
  borderRadius: "12px",
  background: "linear-gradient(135deg, rgba(255, 215, 0, 0.2), rgba(249, 24, 128, 0.2))",
  border: "1px solid rgba(255, 215, 0, 0.3)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

const studioTitleStyle = { margin: 0, fontSize: "16px", fontWeight: "800", color: "#fff" };
const studioSubtitleStyle = { fontSize: "11px", color: "#8e8e93", display: "block" };

const previewBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  background: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.15)",
  borderRadius: "14px",
  padding: "6px 12px",
  color: "#fff",
  fontSize: "12px",
  fontWeight: "600",
  cursor: "pointer"
};

const closeBtnStyle = { background: "none", border: "none", cursor: "pointer", padding: "6px" };

const tabsBarStyle = {
  display: "flex",
  overflowX: "auto",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  padding: "0 16px",
  gap: "10px",
  background: "#131316",
  flexShrink: 0
};

const tabBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "14px 12px",
  background: "none",
  border: "none",
  borderBottom: "2px solid transparent",
  fontSize: "13px",
  fontWeight: "700",
  cursor: "pointer",
  whiteSpace: "nowrap"
};

const contentAreaStyle = {
  flex: 1,
  overflowY: "auto",
  padding: "24px"
};

const loaderCenterStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "260px"
};

const errorCenterStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  minHeight: "220px",
  textAlign: "center"
};

const kpiGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "14px"
};

const kpiCardStyle = {
  background: "#18181c",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "16px",
  padding: "16px",
  display: "flex",
  flexDirection: "column"
};

const kpiIconBox = (bg, color) => ({
  width: "40px",
  height: "40px",
  borderRadius: "12px",
  background: bg,
  color: color,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  marginBottom: "12px"
});

const kpiLabelStyle = { fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", color: "#8e8e93", fontWeight: "700" };
const kpiValueStyle = { fontSize: "22px", fontWeight: "900", color: "#fff", marginTop: "4px" };
const kpiSubtextStyle = { fontSize: "11px", color: "#71717a", marginTop: "4px" };

const runRateCardStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "linear-gradient(135deg, rgba(0, 208, 132, 0.08), rgba(0, 175, 240, 0.08))",
  border: "1px solid rgba(0, 208, 132, 0.2)",
  borderRadius: "16px",
  padding: "20px 24px",
  flexWrap: "wrap",
  gap: "14px"
};

const adjustRatesBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  background: "#00d084",
  color: "#000",
  border: "none",
  borderRadius: "14px",
  padding: "10px 18px",
  fontSize: "13px",
  fontWeight: "800",
  cursor: "pointer"
};

const splitViewGridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: "16px"
};

const subBoxStyle = {
  background: "#18181c",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "16px",
  padding: "16px"
};

const subBoxHeaderStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  marginBottom: "14px"
};

const seeAllBtnStyle = {
  background: "none",
  border: "none",
  color: "#00aff0",
  fontSize: "12px",
  fontWeight: "700",
  cursor: "pointer"
};

const emptyBoxStyle = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "36px 16px",
  textAlign: "center"
};

const tipRowStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "8px 10px",
  background: "#131316",
  borderRadius: "12px"
};

const activeBadgeStyle = {
  background: "rgba(0, 208, 132, 0.15)",
  color: "#00d084",
  border: "1px solid rgba(0, 208, 132, 0.3)",
  borderRadius: "10px",
  padding: "3px 10px",
  fontSize: "11px",
  fontWeight: "800"
};

const tableContainerStyle = {
  background: "#18181c",
  borderRadius: "16px",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  overflowX: "auto"
};

const tableStyle = {
  width: "100%",
  borderCollapse: "collapse",
  textAlign: "left"
};

const thStyle = {
  padding: "12px 16px",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  fontSize: "11px",
  color: "#8e8e93",
  textTransform: "uppercase",
  letterSpacing: "0.5px"
};

const trStyle = {
  borderBottom: "1px solid rgba(255, 255, 255, 0.04)"
};

const tdStyle = {
  padding: "12px 16px",
  fontSize: "13px"
};

const tipCardDetailedStyle = {
  background: "#18181c",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  borderRadius: "14px",
  padding: "14px 16px",
  display: "flex",
  flexDirection: "column",
  gap: "8px"
};

const tipMessageBubbleStyle = {
  background: "#121214",
  borderRadius: "10px",
  padding: "8px 12px",
  fontSize: "12px",
  color: "#ddd",
  fontStyle: "italic",
  borderLeft: "3px solid #f91880"
};

const categoryBadgeStyle = {
  background: "rgba(0, 175, 240, 0.1)",
  color: "#00aff0",
  borderRadius: "8px",
  padding: "2px 8px",
  fontSize: "11px",
  fontWeight: "700"
};

const settingsFormStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "18px",
  maxWidth: "520px"
};

const formRowStyle = {
  display: "flex",
  flexDirection: "column",
  gap: "6px"
};

const fieldLabelStyle = {
  fontSize: "13px",
  fontWeight: "800",
  color: "#fff"
};

const fieldHintStyle = {
  fontSize: "11px",
  color: "#8e8e93"
};

const priceSymbolStyle = {
  position: "absolute",
  left: "14px",
  top: "50%",
  transform: "translateY(-50%)",
  color: "#888",
  fontWeight: "700"
};

const inputStyle = {
  width: "100%",
  background: "#1c1c1f",
  border: "1px solid #333",
  borderRadius: "12px",
  padding: "12px 14px",
  color: "#fff",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box"
};

const textareaStyle = {
  width: "100%",
  background: "#1c1c1f",
  border: "1px solid #333",
  borderRadius: "12px",
  padding: "12px 14px",
  color: "#fff",
  fontSize: "13px",
  outline: "none",
  boxSizing: "border-box",
  resize: "none"
};

const saveBtnStyle = {
  background: "linear-gradient(135deg, #00aff0, #0088cc)",
  color: "#fff",
  border: "none",
  borderRadius: "14px",
  padding: "14px",
  fontWeight: "800",
  fontSize: "14px",
  cursor: "pointer",
  boxShadow: "0 6px 18px rgba(0, 175, 240, 0.35)",
  marginTop: "10px"
};

const successBannerStyle = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 14px",
  background: "rgba(0, 208, 132, 0.15)",
  border: "1px solid rgba(0, 208, 132, 0.3)",
  borderRadius: "12px",
  color: "#00d084",
  fontSize: "13px"
};

const errorBannerStyle = {
  padding: "10px 14px",
  background: "rgba(255, 59, 48, 0.15)",
  border: "1px solid rgba(255, 59, 48, 0.3)",
  borderRadius: "12px",
  color: "#ff3b30",
  fontSize: "13px"
};
