import React, { useState } from "react";
import { Upload, CheckCircle, AlertCircle, Loader2, Video, FileVideo } from "lucide-react";

export default function AdminUpload() {
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [adminId, setAdminId] = useState(""); // 🟢 Required for backend security check
  const [category, setCategory] = useState("premium");
  const [status, setStatus] = useState("idle"); // idle, uploading, success, error

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
    formData.append("uploader_id", adminId); // 🟢 Must match ALLOWED_USERS in backend
    formData.append("category", category);

    try {
      const res = await fetch("https://videos.naijahomemade.com/api/admin/upload-premium", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus("success");
        // Reset form after 2 seconds
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

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <div style={headerStyle}>
          <h2 style={{ margin: 0, fontSize: "20px", display: "flex", alignItems: "center", gap: "10px" }}>
            <Video color="#ff3b30" /> Admin Upload
          </h2>
          <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#888" }}>
            Direct upload to Cloudflare Stream (No Size Limit)
          </p>
        </div>

        <form onSubmit={handleUpload} style={formStyle}>
          
          {/* 🟢 1. ADMIN ID INPUT */}
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Your Telegram ID</label>
            <input 
              type="text" 
              placeholder="e.g. 1881815190"
              value={adminId}
              onChange={(e) => setAdminId(e.target.value)}
              style={inputStyle}
              required
            />
            <span style={{ fontSize: "10px", color: "#555" }}>Must match ALLOWED_USERS in backend</span>
          </div>

          {/* 🟢 2. CAPTION INPUT */}
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Caption</label>
            <input 
              type="text" 
              placeholder="Video description..." 
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* 🟢 3. CATEGORY SELECT */}
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Category</label>
            <select 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              style={inputStyle}
            >
              <option value="premium">💎 Premium</option>
              <option value="hotties">🔥 Hotties</option>
              <option value="knacks">🍆 Knacks</option>
              <option value="trends">📈 Trends</option>
            </select>
          </div>

          {/* 🟢 4. FILE DROP AREA */}
          <div style={fileDropStyle}>
            <input 
              type="file" 
              accept="video/*" 
              onChange={handleFileChange} 
              style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} 
            />
            {file ? (
              <div style={{ textAlign: "center", color: "#20D5EC" }}>
                <FileVideo size={32} style={{ marginBottom: "8px" }} />
                <div style={{ fontSize: "14px", fontWeight: "600" }}>{file.name}</div>
                <div style={{ fontSize: "12px", color: "#666" }}>{(file.size / 1024 / 1024).toFixed(2)} MB</div>
              </div>
            ) : (
              <div style={{ textAlign: "center", color: "#666" }}>
                <Upload size={32} style={{ marginBottom: "8px" }} />
                <div style={{ fontSize: "14px" }}>Tap to select video</div>
              </div>
            )}
          </div>

          {/* 🟢 5. SUBMIT BUTTON */}
          <button 
            type="submit" 
            disabled={status === "uploading"}
            style={{
              ...buttonStyle,
              background: status === "uploading" ? "#333" : 
                          status === "success" ? "#4cd964" : 
                          status === "error" ? "#ff3b30" : "#ff3b30"
            }}
          >
            {status === "uploading" ? (
              <><Loader2 className="spin" size={18} /> Uploading to Cloudflare...</>
            ) : status === "success" ? (
              <><CheckCircle size={18} /> Upload Complete!</>
            ) : status === "error" ? (
              <><AlertCircle size={18} /> Failed. Try Again.</>
            ) : (
              "Upload Video"
            )}
          </button>
        </form>

        <style>{`
          .spin { animation: spin 1s linear infinite; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    </div>
  );
}

// 🎨 DARK THEME STYLES
const containerStyle = {
  minHeight: "100vh", background: "#000", display: "flex", 
  alignItems: "center", justifyItems: "center", padding: "20px",
  color: "#fff", fontFamily: "sans-serif"
};
const cardStyle = {
  width: "100%", maxWidth: "400px", margin: "0 auto",
  background: "#1c1c1e", borderRadius: "16px", padding: "24px",
  boxShadow: "0 10px 40px rgba(0,0,0,0.5)", border: "1px solid #333"
};
const headerStyle = { marginBottom: "24px", textAlign: "center" };
const formStyle = { display: "flex", flexDirection: "column", gap: "20px" };
const inputGroupStyle = { display: "flex", flexDirection: "column", gap: "8px" };
const labelStyle = { fontSize: "12px", fontWeight: "700", color: "#888", textTransform: "uppercase" };
const inputStyle = {
  background: "#2c2c2e", border: "1px solid #3a3a3c", color: "#fff",
  padding: "12px", borderRadius: "8px", fontSize: "14px", outline: "none"
};
const fileDropStyle = {
  position: "relative", height: "120px", border: "2px dashed #444",
  borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center",
  background: "#121212", transition: "0.2s"
};
const buttonStyle = {
  padding: "14px", borderRadius: "12px", border: "none", color: "#fff",
  fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", 
  justifyContent: "center", gap: "8px", fontSize: "15px", transition: "0.2s"
};