import React, { useState, useEffect } from "react";
import { Upload, CheckCircle, AlertCircle, Loader2, Video, FileVideo, Twitter, Link } from "lucide-react";

export default function AdminUpload() {
  const [uploadMode, setUploadMode] = useState("local"); 

  const [adminId, setAdminId] = useState(""); 
  const [category, setCategory] = useState("premium");

  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState("idle"); 

  const [twitterUrl, setTwitterUrl] = useState("");
  const [twitterStatus, setTwitterStatus] = useState("idle"); 
  const [pipelineRoute, setPipelineRoute] = useState("direct"); 

  // 🟢 ISOLATED AD ZAPPER: Guarantees zero ads pop up while uploading
  useEffect(() => {
    const styleId = "admin-upload-ad-blocker";
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement("style");
      styleEl.id = styleId;
      styleEl.innerHTML = `
        div[id^="container-"], 
        iframe[src*="adsterra"], 
        iframe[src*="topcreativeformat"],
        .adsterra-social-bar,
        .adsterra-wrapper { 
          display: none !important; 
          opacity: 0 !important; 
          pointer-events: none !important; 
          visibility: hidden !important; 
          z-index: -9999 !important;
        }
      `;
      document.head.appendChild(styleEl);
    }
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) return alert("Please select a video file");
    if (!adminId) return alert("Please enter your Admin Telegram ID");

    setStatus("uploading");

    const formData = new FormData();
    formData.append("video", file);
    formData.append("caption", caption);
    formData.append("uploader_id", adminId); 
    formData.append("category", category);

    try {
      const res = await fetch("https://videos.naijahomemade.com/api/admin/upload-premium", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus("success");
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
    }
  };

  const handleTwitterImport = async (e) => {
    e.preventDefault();
    if (!twitterUrl) return alert("Please enter a Twitter URL");
    if (!adminId) return alert("Please enter your Admin Telegram ID");

    setTwitterStatus("processing");

    const endpoint = pipelineRoute === "direct" 
        ? "https://videos.naijahomemade.com/twitter-api/import-twitter-direct"
        : "https://videos.naijahomemade.com/twitter-api/import-twitter-telethon";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          url: twitterUrl,
          admin_id: adminId,
          category: category 
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setTwitterStatus("success");
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
    }
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle} className="admin-card">
        <div style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: "20px", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}>
            {uploadMode === "local" ? <Video color="#ff3b30" /> : <Twitter color="#1DA1F2" />} 
            Admin Upload
          </h2>
          <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#888" }}>
            Add content to your premium feed
          </p>
        </div>

        <div style={tabsContainerStyle}>
          <button 
            onClick={() => setUploadMode("local")} 
            style={{ ...tabStyle, background: uploadMode === "local" ? "#333" : "transparent", color: uploadMode === "local" ? "#fff" : "#666" }}
          >
            Local File
          </button>
          <button 
            onClick={() => setUploadMode("twitter")} 
            style={{ ...tabStyle, background: uploadMode === "twitter" ? "#1DA1F220" : "transparent", color: uploadMode === "twitter" ? "#1DA1F2" : "#666" }}
          >
            Twitter Import
          </button>
        </div>

        <div style={formStyle}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Your Telegram ID</label>
            <input 
              type="text" placeholder="e.g. 1881815190" value={adminId}
              onChange={(e) => setAdminId(e.target.value)} style={inputStyle} required
            />
          </div>

          <div style={inputGroupStyle}>
            <label style={labelStyle}>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} style={inputStyle}>
              <option value="premium">💎 Premium</option>
              <option value="hotties">🔥 Hotties</option>
              <option value="knacks">🍆 Knacks</option>
              <option value="trends">📈 Trends</option>
            </select>
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #333", margin: "20px 0" }} />

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
                <div style={{ textAlign: "center", color: "#20D5EC" }}>
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
              style={{ ...buttonStyle, background: status === "uploading" ? "#333" : status === "success" ? "#4cd964" : status === "error" ? "#ff3b30" : "#ff3b30" }}
            >
              {status === "uploading" ? <><Loader2 className="spin" size={18} /> Uploading...</> : status === "success" ? <><CheckCircle size={18} /> Complete!</> : status === "error" ? <><AlertCircle size={18} /> Failed.</> : "Upload Video"}
            </button>
          </form>
        )}

        {uploadMode === "twitter" && (
          <form onSubmit={handleTwitterImport} style={formStyle}>
            <div style={inputGroupStyle}>
              <label style={labelStyle}>Routing Pipeline</label>
              <select value={pipelineRoute} onChange={(e) => setPipelineRoute(e.target.value)} style={inputStyle}>
                <option value="direct">⚡ Direct to Cloudflare</option>
                <option value="telethon">🤖 Send to Telegram Bot</option>
              </select>
            </div>

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

        <style>{`
          .spin { animation: spin 1s linear infinite; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
          
          /* Hides the scrollbar inside the card for a cleaner app feel */
          .admin-card::-webkit-scrollbar { display: none; }
          .admin-card { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
      </div>
    </div>
  );
}

// 🎨 DARK THEME STYLES
// 🟢 FIX: position: fixed and zIndex: 999999 perfectly overlays the Home/Profile footer. overflow: hidden prevents page scrolling.
const containerStyle = { position: "fixed", inset: 0, zIndex: 999999, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", color: "#fff", fontFamily: "sans-serif", overflow: "hidden" };
// 🟢 FIX: maxHeight and overflowY: auto ensure the card scrolls internally if the phone screen is very small, without scrolling the main page
const cardStyle = { width: "100%", maxWidth: "400px", maxHeight: "95dvh", overflowY: "auto", margin: "0 auto", background: "#1c1c1e", borderRadius: "16px", padding: "24px", boxShadow: "0 10px 40px rgba(0,0,0,0.5)", border: "1px solid #333" };
const headerStyle = { marginBottom: "20px", textAlign: "center" };
const tabsContainerStyle = { display: "flex", gap: "10px", marginBottom: "24px", background: "#121212", padding: "4px", borderRadius: "10px" };
const tabStyle = { flex: 1, padding: "10px", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", transition: "0.2s" };
const formStyle = { display: "flex", flexDirection: "column", gap: "20px" };
const inputGroupStyle = { display: "flex", flexDirection: "column", gap: "8px" };
const labelStyle = { fontSize: "12px", fontWeight: "700", color: "#888", textTransform: "uppercase" };
const inputStyle = { width: "100%", boxSizing: "border-box", background: "#2c2c2e", border: "1px solid #3a3a3c", color: "#fff", padding: "12px", borderRadius: "8px", fontSize: "14px", outline: "none" };
const fileDropStyle = { position: "relative", height: "120px", border: "2px dashed #444", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: "#121212", transition: "0.2s" };
const buttonStyle = { padding: "14px", borderRadius: "12px", border: "none", color: "#fff", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "15px", transition: "0.2s" };