import React, { useState, useEffect, useRef } from "react";
import { Upload, CheckCircle, AlertCircle, Loader2, Video, FileVideo, Twitter, Link, X, Send } from "lucide-react";

// 🟢 IMPORT YOUR CENTRAL CONFIG
import { APP_CONFIG } from "../config";

export default function AdminUpload({ onClose }) {
  const [uploadMode, setUploadMode] = useState("local"); 

  const [adminId, setAdminId] = useState(APP_CONFIG.adminUsers[0]?.id || ""); 
  const [category, setCategory] = useState("premium");

  // Local State
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState("idle"); 
  
  // Storage Target & Watermark State
  const [uploadTarget, setUploadTarget] = useState("r2"); 
  const [applyWatermark, setApplyWatermark] = useState(true); 

  // Twitter State
  const [twitterUrl, setTwitterUrl] = useState("");
  const [twitterStatus, setTwitterStatus] = useState("idle"); 
  const [pipelineRoute, setPipelineRoute] = useState("direct"); 
  
  // Telegram Import State
  const [telegramUrl, setTelegramUrl] = useState("");
  const [telegramStatus, setTelegramStatus] = useState("idle"); 
  const [telegramDest, setTelegramDest] = useState(APP_CONFIG.telegramDestinations[0]?.id || ""); 

  const processingLock = useRef(false);

  useEffect(() => {
    const scrollY = window.scrollY;
    
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = "100%";

    return () => {
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
    };
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

// 🟢 NEW: Automated Background Share Function
  const autoShareToTelegram = async (responseData, customCaption) => {
    // Gatekeeper to protect Premium content
    if (category === "premium") {
      console.log("🔒 Premium content detected. Skipping Telegram auto-share to keep it exclusive.");
      return; 
    }

    // 🟢 THE FIX: Check if data came through Python (backend_response) or directly from Local Upload
    const dataSource = responseData?.backend_response || responseData;
    
    // Extract the exact ID
    const videoId = dataSource?.video?.message_id || dataSource?.message_id || dataSource?.id;

    // 🟢 THE FIX: Abort entirely if no ID is found (prevents sharing just the homepage)
    if (!videoId) {
      console.warn("⚠️ Cannot auto-share: No video ID was returned from the backend.");
      return;
    }

    const publicUrl = `${APP_CONFIG.apiUrl}/v/${videoId}`;
    const mainChannelId = APP_CONFIG.telegramDestinations.find(d => d.label === "Main Channel")?.id || "-1001539197699";

    try {
      await fetch(`${APP_CONFIG.pythonEngineUrl}/api/share-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: publicUrl,
          caption: customCaption || "🔥 New drop! Catch it now.",
          telegram_dest: mainChannelId
        }),
      });
      console.log(`✅ Auto-share triggered successfully: ${publicUrl}`);
    } catch (err) {
      console.error("⚠️ Auto-share silent failure:", err);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (processingLock.current) return;
    if (!file) return alert("Please select a video file");
    if (!adminId) return alert("Please select your Admin Telegram ID");

    processingLock.current = true;
    setStatus("uploading");

    const formData = new FormData();
    formData.append("video", file);
    formData.append("caption", caption);
    formData.append("uploader_id", adminId); 
    formData.append("category", category);
    formData.append("upload_target", uploadTarget); 
    formData.append("apply_watermark", applyWatermark); 

    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/upload-premium`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus("success");
        
        autoShareToTelegram(data, caption);

        setTimeout(() => {
          setStatus("idle");
          setCaption("");
          setFile(null);
        }, 3000);
      } else {
        setStatus("error");
        alert(data.error || "Upload failed. Check your Admin ID.");
      }
    } catch (err) {
      setStatus("error");
      console.error("Upload error:", err);
      alert("Network Error: Could not connect to server.");
    } finally {
      processingLock.current = false;
    }
  };

  const handleTwitterImport = async (e) => {
    e.preventDefault();
    if (processingLock.current) return;
    if (!twitterUrl) return alert("Please enter a Twitter URL");

    processingLock.current = true;
    setTwitterStatus("processing");

    const endpoint = pipelineRoute === "direct" 
        ? `${APP_CONFIG.apiUrl}/twitter-api/import-twitter-direct`
        : `${APP_CONFIG.apiUrl}/twitter-api/import-twitter-telethon`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url: twitterUrl,
          admin_id: adminId, 
          category: category,
          telegram_dest: telegramDest,
          upload_target: uploadTarget,
          callback_url: `${APP_CONFIG.apiUrl}/api/admin/upload-premium`,
          apply_watermark: applyWatermark 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setTwitterStatus("success");

        autoShareToTelegram(data, "🔥 Hot new trend imported!");

        setTimeout(() => {
          setTwitterStatus("idle");
          setTwitterUrl("");
        }, 3000);
      } else {
        setTwitterStatus("error");
        alert(data.detail || "Import failed. Check the URL.");
      }
    } catch (err) {
      setTwitterStatus("error");
      console.error("Twitter Import error:", err);
      alert("Network Error: Is the FastAPI server running?");
    } finally {
      processingLock.current = false; 
    }
  };

  const handleTelegramImport = async (e) => {
    e.preventDefault();
    if (processingLock.current) return;
    if (!telegramUrl) return alert("Please enter a Telegram Link");

    processingLock.current = true;
    setTelegramStatus("processing");

    const endpoint = pipelineRoute === "direct" 
        ? `${APP_CONFIG.apiUrl}/twitter-api/import-telegram-direct`
        : `${APP_CONFIG.apiUrl}/twitter-api/import-telegram-link`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url: telegramUrl,
          admin_id: adminId, 
          category: category,
          telegram_dest: telegramDest,
          upload_target: uploadTarget,
          callback_url: `${APP_CONFIG.apiUrl}/api/admin/upload-premium`,
          apply_watermark: applyWatermark 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setTelegramStatus("success");

        autoShareToTelegram(data, "🔥 Fresh exclusive content just dropped!");

        setTimeout(() => {
          setTelegramStatus("idle");
          setTelegramUrl("");
        }, 3000);
      } else {
        setTelegramStatus("error");
        alert(data.detail || "Import failed. Check the URL.");
      }
    } catch (err) {
      setTelegramStatus("error");
      console.error("Telegram Import error:", err);
      alert("Network Error: Is the FastAPI server running?");
    } finally {
      processingLock.current = false;
    }
  };

  return (
    <div style={containerStyle}>
      <button onClick={onClose} style={closeButtonStyle}>
        <X size={28} />
      </button>

      <div style={cardStyle} className="admin-card">
        <div style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
            {uploadMode === "local" ? <Video color="#ff3b30" /> : uploadMode === "twitter" ? <Twitter color="#1DA1F2" /> : <Send color="#0088cc" />} 
            Admin Upload
          </h2>
          <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#888" }}>
            Add content to your premium feed
          </p>
        </div>

        <div style={tabsContainerStyle}>
          <button 
            onClick={() => setUploadMode("local")} 
            style={{ ...tabStyle, padding: "8px", background: uploadMode === "local" ? "#333" : "transparent", color: uploadMode === "local" ? "#fff" : "#666" }}
          >
            Local
          </button>
          <button 
            onClick={() => setUploadMode("twitter")} 
            style={{ ...tabStyle, padding: "8px", background: uploadMode === "twitter" ? "#1DA1F220" : "transparent", color: uploadMode === "twitter" ? "#1DA1F2" : "#666" }}
          >
            Twitter
          </button>
          <button 
            onClick={() => setUploadMode("telegram")} 
            style={{ ...tabStyle, padding: "8px", background: uploadMode === "telegram" ? "#0088cc20" : "transparent", color: uploadMode === "telegram" ? "#0088cc" : "#666" }}
          >
            Telegram
          </button>
        </div>

        {/* 🟢 SHARED INPUTS */}
        <div style={formStyle}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Your Admin ID</label>
            <select value={adminId} onChange={(e) => setAdminId(e.target.value)} style={inputStyle} required>
              <option value="" disabled>Select your Admin ID</option>
              {APP_CONFIG.adminUsers.map(admin => (
                <option key={admin.id} value={admin.id}>{admin.label} ({admin.id})</option>
              ))}
            </select>
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
              <option value="premium">Premium</option>
              <option value="shots">Shots</option>
              {APP_CONFIG.categories.map(cat => (
                <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
              ))}
            </select>
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Storage Destination</label>
            <select value={uploadTarget} onChange={(e) => setUploadTarget(e.target.value)} style={inputStyle}>
              <option value="r2">Cloudflare R2 (Budget-Friendly Storage)</option>
              <option value="stream">Cloudflare Stream (Fast Encoding)</option>
            </select>
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Apply Brand Watermark?</label>
            <div style={{ display: "flex", gap: "16px", marginTop: "4px" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#fff", cursor: "pointer" }}>
                <input 
                  type="radio" 
                  name="watermark" 
                  checked={applyWatermark === true} 
                  onChange={() => setApplyWatermark(true)} 
                  style={{ accentColor: "var(--primary-color)", width: "16px", height: "16px" }}
                />
                Yes (Stamp it)
              </label>
              <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "14px", color: "#fff", cursor: "pointer" }}>
                <input 
                  type="radio" 
                  name="watermark" 
                  checked={applyWatermark === false} 
                  onChange={() => setApplyWatermark(false)} 
                  style={{ accentColor: "var(--primary-color)", width: "16px", height: "16px" }}
                />
                No (Keep it raw)
              </label>
            </div>
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #333", margin: "20px 0" }} />

        {/* 🟢 LOCAL UPLOAD */}
        {uploadMode === "local" && (
          <form onSubmit={handleUpload} style={formStyle}>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Caption</label>
              <input 
                type="text" placeholder="Video description..." value={caption}
                onChange={(e) => setCaption(e.target.value)} style={inputStyle}
              />
            </div>

            <div style={fileDropStyle}>
              <input type="file" accept="video/*" onChange={handleFileChange} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
              {file ? (
                <div style={{ textAlign: "center", color: "var(--primary-color)" }}>
                  <FileVideo size={32} style={{ marginBottom: "8px" }} />
                  <div style={{ fontSize: "14px", fontWeight: "600" }}>{file.name}</div>
                </div>
              ) : (
                <div style={{ textAlign: "center", color: "#666" }}>
                  <Upload size={32} style={{ marginBottom: "8px" }} />
                  <div style={{ fontSize: "14px" }}>Tap to select video</div>
                </div>
              )}
            </div>

            <button 
              type="submit" disabled={status === "uploading"}
              style={{ ...buttonStyle, background: status === "uploading" ? "#333" : status === "success" ? "#4cd964" : status === "error" ? "#ff3b30" : "var(--primary-color)" }}
            >
              {status === "uploading" ? <><Loader2 className="spin" size={18} /> Uploading...</> : status === "success" ? <><CheckCircle size={18} /> Complete!</> : status === "error" ? <><AlertCircle size={18} /> Failed.</> : "Upload Video"}
            </button>
          </form>
        )}

        {/* 🟢 TWITTER IMPORT */}
        {uploadMode === "twitter" && (
          <form onSubmit={handleTwitterImport} style={formStyle}>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Routing Pipeline</label>
              <select value={pipelineRoute} onChange={(e) => setPipelineRoute(e.target.value)} style={inputStyle}>
                <option value="direct">⚡ Direct to Cloudflare</option>
                <option value="telethon">🤖 Send to Telegram Bot</option>
              </select>
            </div>

            {pipelineRoute === "telethon" && (
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Telegram Destination</label>
                <select value={telegramDest} onChange={(e) => setTelegramDest(e.target.value)} style={inputStyle}>
                  {APP_CONFIG.telegramDestinations.map(dest => (
                    <option key={dest.id} value={dest.id}>{dest.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Twitter / X Link</label>
              <div style={{ position: "relative" }}>
                <Link size={18} color="#888" style={{ position: "absolute", left: "12px", top: "12px" }} />
                <input 
                  type="url" 
                  placeholder="https://x.com/username/status/..." 
                  value={twitterUrl}
                  onChange={(e) => setTwitterUrl(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: "40px" }}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" disabled={twitterStatus === "processing"}
              style={{ ...buttonStyle, background: twitterStatus === "processing" ? "#333" : twitterStatus === "success" ? "#4cd964" : twitterStatus === "error" ? "#ff3b30" : "#1DA1F2" }}
            >
              {twitterStatus === "processing" ? <><Loader2 className="spin" size={18} /> Extracting & Uploading...</> : twitterStatus === "success" ? <><CheckCircle size={18} /> Successfully Imported!</> : twitterStatus === "error" ? <><AlertCircle size={18} /> Import Failed.</> : "Import Video"}
            </button>
          </form>
        )}

        {/* 🟢 TELEGRAM IMPORT */}
        {uploadMode === "telegram" && (
          <form onSubmit={handleTelegramImport} style={formStyle}>
            
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Routing Pipeline</label>
              <select value={pipelineRoute} onChange={(e) => setPipelineRoute(e.target.value)} style={inputStyle}>
                <option value="direct">⚡ Direct to Cloudflare</option>
                <option value="telethon">🤖 Send to Telegram Bot</option>
              </select>
            </div>

            {pipelineRoute === "telethon" && (
              <div style={inputGroupStyle}>
                <label style={labelStyle}>Telegram Destination</label>
                <select value={telegramDest} onChange={(e) => setTelegramDest(e.target.value)} style={inputStyle}>
                  {APP_CONFIG.telegramDestinations.map(dest => (
                    <option key={dest.id} value={dest.id}>{dest.label}</option>
                  ))}
                </select>
              </div>
            )}

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Telegram Post Link</label>
              <div style={{ position: "relative" }}>
                <Send size={18} color="#888" style={{ position: "absolute", left: "12px", top: "12px" }} />
                <input 
                  type="url" 
                  placeholder="https://t.me/channelname/123" 
                  value={telegramUrl}
                  onChange={(e) => setTelegramUrl(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: "40px" }}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" disabled={telegramStatus === "processing"}
              style={{ ...buttonStyle, background: telegramStatus === "processing" ? "#333" : telegramStatus === "success" ? "#4cd964" : telegramStatus === "error" ? "#ff3b30" : "#0088cc" }}
            >
              {telegramStatus === "processing" ? <><Loader2 className="spin" size={18} /> Downloading & Forwarding...</> : telegramStatus === "success" ? <><CheckCircle size={18} /> Successfully Forwarded!</> : telegramStatus === "error" ? <><AlertCircle size={18} /> Import Failed.</> : "Forward Video"}
            </button>
          </form>
        )}

        <style>{`
          .spin { animation: spin 1s linear infinite; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          .admin-card::-webkit-scrollbar { display: none; }
          .admin-card { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
      </div>
    </div>
  );
}

// 🎨 DARK THEME STYLES
const containerStyle = { position: "fixed", inset: 0, zIndex: 99999, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", color: "#fff", fontFamily: "sans-serif", touchAction: "none" };
const closeButtonStyle = { position: "absolute", top: "max(20px, env(safe-area-inset-top))", right: "20px", background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "8px", borderRadius: "50%", cursor: "pointer", zIndex: 100000, display: "flex", alignItems: "center", justifyContent: "center" };
const cardStyle = { width: "100%", maxWidth: "400px", maxHeight: "90dvh", overflowY: "auto", margin: "0 auto", background: "#1c1c1e", borderRadius: "16px", padding: "24px", boxShadow: "0 10px 40px rgba(0,0,0,0.5)", border: "1px solid #333", position: "relative" };
const headerStyle = { marginBottom: "20px", textAlign: "center" };
const tabsContainerStyle = { display: "flex", gap: "10px", marginBottom: "24px", background: "#121212", padding: "4px", borderRadius: "10px" };
const tabStyle = { flex: 1, padding: "8px", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", transition: "0.2s" };
const formStyle = { display: "flex", flexDirection: "column", gap: "20px" };
const inputGroupStyle = { display: "flex", flexDirection: "column", gap: "8px" };
const labelStyle = { fontSize: "12px", fontWeight: "700", color: "#888", textTransform: "uppercase" };
const inputStyle = { width: "100%", boxSizing: "border-box", background: "#2c2c2e", border: "1px solid #3a3a3c", color: "#fff", padding: "12px", borderRadius: "8px", fontSize: "14px", outline: "none" };
const fileDropStyle = { position: "relative", height: "120px", border: "2px dashed #444", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: "#121212", transition: "0.2s" };
const buttonStyle = { padding: "14px", borderRadius: "12px", border: "none", color: "#fff", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "15px", transition: "0.2s" };