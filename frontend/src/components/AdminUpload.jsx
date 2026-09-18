import React, { useState, useEffect, useRef } from "react";
import { 
  ArrowLeft, Upload, CheckCircle, AlertCircle, Loader2, Video, 
  FileVideo, Twitter, Link, X, Send, Instagram, Scissors, Play, Pause, Clock,
  ChevronDown, Check, Plus, Search, Sparkles, Bot, Zap, HardDrive, Droplets
} from "lucide-react";

// 🟢 IMPORT YOUR CENTRAL CONFIG & UTILITIES
import { APP_CONFIG } from "../config";
import { showToast } from "../utils/toast";

// Preset Creators & Channels aligned with forwarder tasks
const PRESET_CREATORS = [
  { username: "naijahomemade", displayName: "Naija Homemade Series", uploaderId: "1881815190", label: "🌟 Official Series (@naijahomemade)" },
  { username: "baddies_distro", displayName: "Baddies Distro", uploaderId: "-1003754790625", label: "🔥 Baddies Distro (@baddies_distro)" },
  { username: "alphaxdash2", displayName: "Alpha Dash", uploaderId: "-1003995508694", label: "💃 Alpha Dash / NH Hotties (@alphaxdash2)" },
  { username: "nh_shorts", displayName: "NH Shorts", uploaderId: "-1003950008310", label: "⚡ NH Shorts (@nh_shorts)" },
  { username: "nh_knacks", displayName: "NH Knacks", uploaderId: "-1003997134224", label: "🍑 NH Knacks (@nh_knacks)" },
];

function CreatorDropdown({ creators, selectedKey, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const selectedCreator = creators.find(c => c.username === selectedKey);
  const filteredCreators = creators.filter(c => 
    !search || 
    (c.displayName && c.displayName.toLowerCase().includes(search.toLowerCase())) || 
    (c.username && c.username.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div ref={dropdownRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: "#1c1c1f",
          border: isOpen ? "1px solid var(--primary-color, #e11d48)" : "1px solid #333338",
          borderRadius: "12px",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          color: "#fff",
          transition: "all 0.2s ease",
          textAlign: "left",
          outline: "none"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, overflow: "hidden" }}>
          <div style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: selectedKey === "custom" 
              ? "rgba(255, 165, 0, 0.2)" 
              : "linear-gradient(135deg, rgba(225,29,72,0.4), rgba(255,255,255,0.05))",
            border: selectedKey === "custom" ? "1px solid #ffa500" : "1px solid rgba(255,255,255,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            fontSize: "14px"
          }}>
            {selectedKey === "custom" ? "⚙️" : (selectedCreator?.displayName?.charAt(0) || "👤")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
            <span style={{ fontSize: "14px", fontWeight: "700", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {selectedKey === "custom" ? "Custom Creator / Channel" : (selectedCreator?.displayName || "Select Creator")}
            </span>
            <span style={{ fontSize: "11px", color: selectedKey === "custom" ? "#ffa500" : "#888", whiteSpace: "nowrap" }}>
              {selectedKey === "custom" ? "Manual Attribution Override" : `@${selectedCreator?.username || "unassigned"}`}
            </span>
          </div>
        </div>
        <ChevronDown 
          size={18} 
          color="#aaa" 
          style={{ 
            transition: "transform 0.2s ease",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            flexShrink: 0,
            marginLeft: "8px"
          }} 
        />
      </button>

      {isOpen && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          right: 0,
          zIndex: 1000,
          background: "#18181b",
          border: "1px solid #33333a",
          borderRadius: "14px",
          boxShadow: "0 16px 36px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.05)",
          backdropFilter: "blur(20px)",
          overflow: "hidden",
          animation: "dropdownFadeIn 0.15s ease-out"
        }}>
          {creators.length > 5 && (
            <div style={{ padding: "8px 10px", borderBottom: "1px solid #28282c" }}>
              <div style={{ position: "relative" }}>
                <Search size={14} color="#777" style={{ position: "absolute", left: "10px", top: "9px" }} />
                <input
                  type="text"
                  placeholder="Search creators..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    background: "#222226",
                    border: "1px solid #333338",
                    borderRadius: "8px",
                    padding: "6px 10px 6px 30px",
                    fontSize: "12px",
                    color: "#fff",
                    outline: "none"
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ maxHeight: "240px", overflowY: "auto", padding: "6px" }}>
            {filteredCreators.map(c => {
              const isSelected = selectedKey === c.username;
              return (
                <div
                  key={c.username}
                  onClick={() => {
                    onSelect(c.username);
                    setIsOpen(false);
                    setSearch("");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    cursor: "pointer",
                    background: isSelected ? "rgba(225, 29, 72, 0.15)" : "transparent",
                    color: isSelected ? "#fff" : "#ccc",
                    transition: "background 0.15s"
                  }}
                  onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#242428"; }}
                  onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                    <div style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "50%",
                      background: isSelected ? "var(--primary-color, #e11d48)" : "#2a2a2e",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "12px",
                      fontWeight: "700",
                      flexShrink: 0
                    }}>
                      {c.displayName?.charAt(0) || "👤"}
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                      <span style={{ fontSize: "13px", fontWeight: isSelected ? "700" : "500", color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.displayName}
                      </span>
                      <span style={{ fontSize: "11px", color: isSelected ? "rgba(255,255,255,0.8)" : "#777" }}>
                        @{c.username}
                      </span>
                    </div>
                  </div>
                  {isSelected && <Check size={16} color="var(--primary-color, #e11d48)" style={{ flexShrink: 0, marginLeft: "8px" }} />}
                </div>
              );
            })}

            <div style={{ height: "1px", background: "#28282c", margin: "4px 0" }} />

            <div
              onClick={() => {
                onSelect("custom");
                setIsOpen(false);
                setSearch("");
              }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "8px 10px",
                borderRadius: "8px",
                cursor: "pointer",
                background: selectedKey === "custom" ? "rgba(255, 165, 0, 0.15)" : "transparent",
                color: selectedKey === "custom" ? "#ffa500" : "#aaa",
                transition: "background 0.15s"
              }}
              onMouseEnter={(e) => { if (selectedKey !== "custom") e.currentTarget.style.background = "#242428"; }}
              onMouseLeave={(e) => { if (selectedKey !== "custom") e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "#2a2a2e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "12px",
                  color: "#ffa500"
                }}>
                  <Plus size={14} />
                </div>
                <div style={{ display: "flex", flexDirection: "column" }}>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#ffa500" }}>
                    Custom Creator / Channel...
                  </span>
                  <span style={{ fontSize: "11px", color: "#777" }}>
                    Enter manual handle & Telegram ID
                  </span>
                </div>
              </div>
              {selectedKey === "custom" && <Check size={16} color="#ffa500" />}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TelegramDestDropdown({ destinations, selectedDestId, onSelect }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  const selectedDest = destinations.find(d => d.id === selectedDestId) || destinations[0];

  return (
    <div ref={dropdownRef} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: "#1c1c1f",
          border: isOpen ? "1px solid #0088cc" : "1px solid #333338",
          borderRadius: "12px",
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          cursor: "pointer",
          color: "#fff",
          transition: "border-color 0.2s",
          outline: "none"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{
            width: "28px",
            height: "28px",
            borderRadius: "50%",
            background: "rgba(0, 136, 204, 0.2)",
            border: "1px solid rgba(0, 136, 204, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0088cc"
          }}>
            <Send size={14} />
          </div>
          <span style={{ fontSize: "13px", fontWeight: "700", color: "#fff" }}>
            {selectedDest?.label || "Select Destination Channel"}
          </span>
        </div>
        <ChevronDown 
          size={18} 
          color="#aaa" 
          style={{ 
            transition: "transform 0.2s ease",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)"
          }} 
        />
      </button>

      {isOpen && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          right: 0,
          zIndex: 1000,
          background: "#18181b",
          border: "1px solid #33333a",
          borderRadius: "14px",
          boxShadow: "0 16px 36px rgba(0,0,0,0.85)",
          backdropFilter: "blur(20px)",
          padding: "6px",
          maxHeight: "220px",
          overflowY: "auto",
          animation: "dropdownFadeIn 0.15s ease-out"
        }}>
          {destinations.map(d => {
            const isSelected = selectedDestId === d.id;
            return (
              <div
                key={d.id}
                onClick={() => {
                  onSelect(d.id);
                  setIsOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  cursor: "pointer",
                  background: isSelected ? "rgba(0, 136, 204, 0.2)" : "transparent",
                  color: isSelected ? "#fff" : "#ccc",
                  transition: "background 0.15s"
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "#242428"; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
              >
                <span style={{ fontSize: "13px", fontWeight: isSelected ? "700" : "500" }}>
                  {d.label}
                </span>
                {isSelected && <Check size={16} color="#0088cc" />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RoutingPipelineControl({ pipelineRoute, setPipelineRoute, telegramDest, setTelegramDest }) {
  return (
    <>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <label style={{ fontSize: "12px", fontWeight: "700", color: "#888", textTransform: "uppercase" }}>
            Routing Pipeline
          </label>
          <span style={{ fontSize: "11px", color: pipelineRoute === "direct" ? "var(--primary-color, #e11d48)" : "#0088cc", fontWeight: "600" }}>
            {pipelineRoute === "direct" ? "Direct Cloudflare" : "Bot Forwarder"}
          </span>
        </div>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "6px",
          background: "#161618",
          border: "1px solid #2c2c30",
          borderRadius: "10px",
          padding: "4px"
        }}>
          <button
            type="button"
            onClick={() => setPipelineRoute("direct")}
            style={{
              padding: "10px 8px",
              borderRadius: "8px",
              border: "none",
              background: pipelineRoute === "direct" ? "var(--primary-color, #e11d48)" : "transparent",
              color: pipelineRoute === "direct" ? "#fff" : "#888",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "all 0.15s ease"
            }}
          >
            <Zap size={14} />
            <span>Direct to CF</span>
          </button>
          <button
            type="button"
            onClick={() => setPipelineRoute("telethon")}
            style={{
              padding: "10px 8px",
              borderRadius: "8px",
              border: "none",
              background: pipelineRoute === "telethon" ? "#0088cc" : "transparent",
              color: pipelineRoute === "telethon" ? "#fff" : "#888",
              fontSize: "12px",
              fontWeight: "700",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              transition: "all 0.15s ease"
            }}
          >
            <Bot size={14} />
            <span>Telegram Bot</span>
          </button>
        </div>
      </div>

      {pipelineRoute === "telethon" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "12px", fontWeight: "700", color: "#888", textTransform: "uppercase" }}>
            Telegram Destination
          </label>
          <TelegramDestDropdown 
            destinations={APP_CONFIG.telegramDestinations}
            selectedDestId={telegramDest}
            onSelect={(id) => setTelegramDest(id)}
          />
        </div>
      )}
    </>
  );
}

export default function AdminUpload({ onClose }) {
  const [uploadMode, setUploadMode] = useState("local"); 

  // Creator Attribution State (Replaced legacy Allowed Users / adminId)
  const [creatorsList, setCreatorsList] = useState(PRESET_CREATORS);
  const [selectedCreatorKey, setSelectedCreatorKey] = useState("naijahomemade");
  const [creatorUsername, setCreatorUsername] = useState("naijahomemade");
  const [creatorDisplayName, setCreatorDisplayName] = useState("Naija Homemade Series");
  const [uploaderId, setUploaderId] = useState("1881815190");
  const [isCustomCreator, setIsCustomCreator] = useState(false);

  const [category, setCategory] = useState("premium");

  // Local State
  const [file, setFile] = useState(null);
  const [caption, setCaption] = useState("");
  const [status, setStatus] = useState("idle"); 
  
  // Storage Target & Watermark State
  const [uploadTarget, setUploadTarget] = useState("r2"); 
  const [applyWatermark, setApplyWatermark] = useState(true); 

  // 🟢 NEW: Video Trimming / Clipping State (Beginning, Center, Ending)
  const [trimMode, setTrimMode] = useState("full"); // "full", "beginning", "center", "ending"
  const [trimDuration, setTrimDuration] = useState(30); // in seconds
  const [customDuration, setCustomDuration] = useState("");
  const [videoDuration, setVideoDuration] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isPlayingPreview, setIsPlayingPreview] = useState(false);
  const previewVideoRef = useRef(null);

  // Twitter State
  const [twitterUrl, setTwitterUrl] = useState("");
  const [twitterStatus, setTwitterStatus] = useState("idle"); 
  const [pipelineRoute, setPipelineRoute] = useState("direct"); 
  
  // Telegram Import State
  const [telegramUrl, setTelegramUrl] = useState("");
  const [telegramStatus, setTelegramStatus] = useState("idle"); 
  const [telegramDest, setTelegramDest] = useState(APP_CONFIG.telegramDestinations[0]?.id || ""); 

  // 🟢 NEW: Instagram Import State
  const [instagramUrl, setInstagramUrl] = useState("");
  const [instagramStatus, setInstagramStatus] = useState("idle"); 

  // 🟢 NEW: TikTok Import State
  const [tiktokUrl, setTiktokUrl] = useState("");
  const [tiktokStatus, setTiktokStatus] = useState("idle"); 

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
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  // Fetch registered creators from backend to populate dropdown dynamically
  useEffect(() => {
    const fetchCreators = async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/creators`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        if (res.ok) {
          const data = await res.json();
          if (data.creators && Array.isArray(data.creators)) {
            const presetUnames = new Set(PRESET_CREATORS.map(p => p.username.toLowerCase()));
            const dbCreators = data.creators
              .filter(c => c.username && !presetUnames.has(c.username.toLowerCase()))
              .map(c => ({
                username: c.username,
                displayName: c.display_name || c.username,
                uploaderId: String(c.telegram_user_id || c.id || ""),
                label: `👤 ${c.display_name || c.username} (@${c.username})`
              }));
            setCreatorsList([...PRESET_CREATORS, ...dbCreators]);
          }
        }
      } catch (e) {
        console.warn("Could not fetch creator list:", e);
      }
    };
    fetchCreators();
  }, []);

  const selectCreatorByUsername = (uname) => {
    const found = creatorsList.find(c => c.username === uname);
    if (found) {
      setSelectedCreatorKey(found.username);
      setIsCustomCreator(false);
      setCreatorUsername(found.username);
      setCreatorDisplayName(found.displayName);
      setUploaderId(found.uploaderId || "1881815190");
    }
  };

  const handleCreatorChange = (valOrEvent) => {
    const val = typeof valOrEvent === "string" ? valOrEvent : valOrEvent?.target?.value;
    setSelectedCreatorKey(val);
    if (val === "custom") {
      setIsCustomCreator(true);
      setCreatorUsername("");
      setCreatorDisplayName("");
      setUploaderId("");
    } else {
      setIsCustomCreator(false);
      const found = creatorsList.find(c => c.username === val);
      if (found) {
        setCreatorUsername(found.username);
        setCreatorDisplayName(found.displayName);
        setUploaderId(found.uploaderId || "1881815190");
      }
    }
  };

  const handleCategoryChange = (newCatOrEvent) => {
    const newCat = typeof newCatOrEvent === "string" ? newCatOrEvent : newCatOrEvent?.target?.value;
    setCategory(newCat);
    if (!isCustomCreator) {
      if (newCat === "premium") selectCreatorByUsername("naijahomemade");
      else if (newCat === "baddies") selectCreatorByUsername("baddies_distro");
      else if (newCat === "hotties") selectCreatorByUsername("alphaxdash2");
      else if (newCat === "shots") selectCreatorByUsername("nh_shorts");
      else if (newCat === "knacks") selectCreatorByUsername("nh_knacks");
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      const newUrl = URL.createObjectURL(selectedFile);
      setPreviewUrl(newUrl);
      setIsPlayingPreview(false);
      setVideoDuration(0);
    }
  };

  // Helper to compute slice start, end, and duration
  const getTrimRange = () => {
    const desiredDuration = customDuration ? parseFloat(customDuration) : parseFloat(trimDuration);
    const clipLen = (!isNaN(desiredDuration) && desiredDuration > 0) ? desiredDuration : 30;

    if (!videoDuration || videoDuration <= 0) {
      return { start: 0, end: clipLen, duration: clipLen };
    }

    const actualLen = Math.min(videoDuration, clipLen);
    let start = 0;

    if (trimMode === "beginning") {
      start = 0;
    } else if (trimMode === "center") {
      start = Math.max(0, (videoDuration - actualLen) / 2);
    } else if (trimMode === "ending") {
      start = Math.max(0, videoDuration - actualLen);
    }

    const end = Math.min(videoDuration, start + actualLen);
    return {
      start: Math.round(start * 10) / 10,
      end: Math.round(end * 10) / 10,
      duration: Math.round(actualLen * 10) / 10
    };
  };

  const formatTime = (secs) => {
    if (isNaN(secs) || secs === null || secs === undefined || secs < 0) return "00:00";
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleTogglePreview = () => {
    const videoEl = previewVideoRef.current;
    if (!videoEl) return;

    if (isPlayingPreview) {
      videoEl.pause();
      setIsPlayingPreview(false);
    } else {
      const { start } = getTrimRange();
      videoEl.currentTime = start;
      videoEl.play().catch(() => {});
      setIsPlayingPreview(true);
    }
  };

  const handlePreviewTimeUpdate = () => {
    const videoEl = previewVideoRef.current;
    if (!videoEl || !isPlayingPreview) return;

    const { start, end } = getTrimRange();
    if (videoEl.currentTime >= end) {
      videoEl.currentTime = start;
    }
  };

  const autoShareToTelegram = async (responseData, customCaption) => {
    // Gatekeeper to protect Premium content
    if (category === "premium") {
      console.log("🔒 Premium content detected. Skipping Telegram auto-share to keep it exclusive.");
      return; 
    }

    // 🟢 THE FIX: Bulletproof Deep Extraction
    // Digs through FastAPI wrappers (callback_response, backend_response, data) to find the ID
    const dataSource = responseData?.backend_response || responseData?.callback_response || responseData?.data || responseData;
    const videoId = dataSource?.video?.message_id 
                 || dataSource?.message_id 
                 || dataSource?.id 
                 || dataSource?.video_id 
                 || dataSource?.video?.id;

    if (!videoId) {
      // Added responseData to the log so you can see exactly what FastAPI returned if it ever fails again
      console.warn("⚠️ Cannot auto-share: No video ID was returned from the backend.", responseData);
      return;
    }

    const publicUrl = `${APP_CONFIG.apiUrl}/v/${videoId}`;
    const linkChannelId = APP_CONFIG.telegramDestinations.find(d => d.label === "Link Channel")?.id || "-1003952752560";

    try {
      await fetch(`${APP_CONFIG.pythonEngineUrl}/api/share-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          video_url: publicUrl,
          caption: customCaption,
          telegram_dest: linkChannelId
        }),
      });
      console.log(`✅ Auto-share triggered successfully: ${publicUrl}`);
    } catch (err) {
      console.error("⚠️ Auto-share silent failure:", err);
    }
  };

  const parseApiResponse = async (res, defaultActionName = "Action") => {
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return await res.json();
    }
    const text = await res.text();
    if (res.status === 524) {
      throw new Error("Server processing timed out on Cloudflare (>100s). For long videos, select a trimmed snippet (e.g. 15s–90s) to process in under 5 seconds, or try disabling the watermark.");
    }
    if (res.status === 502 || res.status === 504) {
      throw new Error(`Gateway Error (${res.status}): The backend is restarting or temporarily busy. Please try again.`);
    }
    throw new Error(text.slice(0, 150) || `${defaultActionName} failed (HTTP ${res.status}).`);
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (processingLock.current) return;
    if (!file) return showToast("Please select a video file", "error");

    const token = localStorage.getItem("token");
    if (!token) return showToast("Authentication required. Please log into the Admin Dashboard first.", "error");

    processingLock.current = true;
    setStatus("uploading");

    const finalUploaderId = uploaderId || "1881815190";
    const finalCreatorUsername = creatorUsername || "naijahomemade";
    const finalCreatorDisplayName = creatorDisplayName || "Naija Homemade Series";

    const formData = new FormData();
    formData.append("video", file);
    formData.append("caption", caption);
    formData.append("uploader_id", finalUploaderId); 
    formData.append("creator_username", finalCreatorUsername);
    formData.append("creator_display_name", finalCreatorDisplayName);
    formData.append("category", category);
    formData.append("upload_target", uploadTarget); 
    formData.append("apply_watermark", applyWatermark); 

    // 🟢 Video Trimming Parameters (Beginning, Center, Ending)
    formData.append("trim_mode", trimMode);
    if (trimMode !== "full") {
      const { start, end, duration: finalDur } = getTrimRange();
      formData.append("trim_duration", finalDur.toString());
      formData.append("trim_start", start.toString());
      formData.append("trim_end", end.toString());
    }

    try {
      const res = await fetch(`${APP_CONFIG.apiUrl}/api/admin/upload-premium`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` },
        body: formData,
      });

      const data = await parseApiResponse(res, "Direct Upload");

      if (res.ok && data.success) {
        setStatus("success");
        showToast("Video uploaded successfully!", "success");
        autoShareToTelegram(data, caption);
        setTimeout(() => {
          setStatus("idle");
          setCaption("");
          setFile(null);
          setTrimMode("full");
          setVideoDuration(0);
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
        }, 3000);
      } else {
        setStatus("error");
        showToast(data.error || data.detail || "Upload failed.", "error");
      }
    } catch (err) {
      setStatus("error");
      console.error("Upload error:", err);
      showToast(err.message || "Network Error: Could not connect to server.", "error");
    } finally {
      processingLock.current = false;
    }
  };

  const handleTwitterImport = async (e) => {
    e.preventDefault();
    if (processingLock.current) return;
    if (!twitterUrl) return showToast("Please enter a Twitter URL", "error");

    const token = localStorage.getItem("token");
    if (!token) return showToast("Authentication required. Please log into the Admin Dashboard first.", "error");

    processingLock.current = true;
    setTwitterStatus("processing");

    const endpoint = pipelineRoute === "direct" 
        ? `${APP_CONFIG.apiUrl}/twitter-api/import-twitter-direct`
        : `${APP_CONFIG.apiUrl}/twitter-api/import-twitter-telethon`;

    const finalUploaderId = uploaderId || "1881815190";
    const finalCreatorUsername = creatorUsername || "naijahomemade";
    const finalCreatorDisplayName = creatorDisplayName || "Naija Homemade Series";

    const { start: tStart, duration: tDur } = getTrimRange();
    const queryParams = new URLSearchParams({
      creator_username: finalCreatorUsername,
      creator_display_name: finalCreatorDisplayName,
      uploader_id: finalUploaderId
    });
    if (trimMode !== "full") {
      queryParams.set("trim_mode", trimMode);
      queryParams.set("trim_duration", tDur.toString());
      queryParams.set("trim_start", tStart.toString());
    }
    if (token) {
      queryParams.set("token", token);
    }
    const callbackUrl = `${APP_CONFIG.apiUrl}/api/admin/upload-premium?${queryParams.toString()}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          url: twitterUrl,
          admin_id: finalUploaderId, 
          creator_username: finalCreatorUsername,
          creator_display_name: finalCreatorDisplayName,
          category: category,
          telegram_dest: telegramDest,
          upload_target: uploadTarget,
          callback_url: callbackUrl,
          apply_watermark: applyWatermark,
          trim_mode: trimMode,
          trim_duration: tDur,
          trim_start: tStart
        }),
      });

      const data = await parseApiResponse(res, "Twitter Import");

      if (res.ok) {
        setTwitterStatus("success");
        showToast("Twitter video imported successfully!", "success");
        autoShareToTelegram(data);
        setTimeout(() => {
          setTwitterStatus("idle");
          setTwitterUrl("");
        }, 3000);
      } else {
        setTwitterStatus("error");
        showToast(data.error || data.detail || data.message || "Import failed. Check the URL.", "error");
      }
    } catch (err) {
      setTwitterStatus("error");
      console.error("Twitter Import error:", err);
      showToast(err.message || "Network Error: Is the FastAPI server running?", "error");
    } finally {
      processingLock.current = false; 
    }
  };

  const handleTelegramImport = async (e) => {
    e.preventDefault();
    if (processingLock.current) return;
    if (!telegramUrl) return showToast("Please enter a Telegram Link", "error");

    const token = localStorage.getItem("token");
    if (!token) return showToast("Authentication required. Please log into the Admin Dashboard first.", "error");

    processingLock.current = true;
    setTelegramStatus("processing");

    const endpoint = pipelineRoute === "direct" 
        ? `${APP_CONFIG.apiUrl}/twitter-api/import-telegram-direct`
        : `${APP_CONFIG.apiUrl}/twitter-api/import-telegram-link`;

    const finalUploaderId = uploaderId || "1881815190";
    const finalCreatorUsername = creatorUsername || "naijahomemade";
    const finalCreatorDisplayName = creatorDisplayName || "Naija Homemade Series";

    const { start: tgStart, duration: tgDur } = getTrimRange();
    const queryParams = new URLSearchParams({
      creator_username: finalCreatorUsername,
      creator_display_name: finalCreatorDisplayName,
      uploader_id: finalUploaderId
    });
    if (trimMode !== "full") {
      queryParams.set("trim_mode", trimMode);
      queryParams.set("trim_duration", tgDur.toString());
      queryParams.set("trim_start", tgStart.toString());
    }
    if (token) {
      queryParams.set("token", token);
    }
    const callbackUrl = `${APP_CONFIG.apiUrl}/api/admin/upload-premium?${queryParams.toString()}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          url: telegramUrl,
          admin_id: finalUploaderId, 
          creator_username: finalCreatorUsername,
          creator_display_name: finalCreatorDisplayName,
          category: category,
          telegram_dest: telegramDest,
          upload_target: uploadTarget,
          callback_url: callbackUrl,
          apply_watermark: applyWatermark,
          trim_mode: trimMode,
          trim_duration: tgDur,
          trim_start: tgStart
        }),
      });

      const data = await parseApiResponse(res, "Telegram Import");

      if (res.ok) {
        setTelegramStatus("success");
        showToast("Telegram video imported successfully!", "success");
        autoShareToTelegram(data, "🔥 Fresh exclusive content just dropped!");
        setTimeout(() => {
          setTelegramStatus("idle");
          setTelegramUrl("");
        }, 3000);
      } else {
        setTelegramStatus("error");
        showToast(data.error || data.detail || data.message || "Import failed. Check the URL.", "error");
      }
    } catch (err) {
      setTelegramStatus("error");
      console.error("Telegram Import error:", err);
      showToast(err.message || "Network Error: Is the FastAPI server running?", "error");
    } finally {
      processingLock.current = false; 
    }
  };

  // 🟢 Instagram Import Handler
  const handleInstagramImport = async (e) => {
    e.preventDefault();
    if (processingLock.current) return;
    if (!instagramUrl) return showToast("Please enter an Instagram URL", "error");

    const token = localStorage.getItem("token");
    if (!token) return showToast("Authentication required. Please log into the Admin Dashboard first.", "error");

    processingLock.current = true;
    setInstagramStatus("processing");

    const endpoint = pipelineRoute === "direct" 
        ? `${APP_CONFIG.apiUrl}/twitter-api/import-instagram-direct`
        : `${APP_CONFIG.apiUrl}/twitter-api/import-instagram-telethon`;

    const finalUploaderId = uploaderId || "1881815190";
    const finalCreatorUsername = creatorUsername || "naijahomemade";
    const finalCreatorDisplayName = creatorDisplayName || "Naija Homemade Series";

    const { start: igStart, duration: igDur } = getTrimRange();
    const queryParams = new URLSearchParams({
      creator_username: finalCreatorUsername,
      creator_display_name: finalCreatorDisplayName,
      uploader_id: finalUploaderId
    });
    if (trimMode !== "full") {
      queryParams.set("trim_mode", trimMode);
      queryParams.set("trim_duration", igDur.toString());
      queryParams.set("trim_start", igStart.toString());
    }
    if (token) {
      queryParams.set("token", token);
    }
    const callbackUrl = `${APP_CONFIG.apiUrl}/api/admin/upload-premium?${queryParams.toString()}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          url: instagramUrl,
          admin_id: finalUploaderId, 
          creator_username: finalCreatorUsername,
          creator_display_name: finalCreatorDisplayName,
          category: category,
          telegram_dest: telegramDest,
          upload_target: uploadTarget,
          callback_url: callbackUrl,
          apply_watermark: applyWatermark,
          trim_mode: trimMode,
          trim_duration: igDur,
          trim_start: igStart
        }),
      });

      const data = await parseApiResponse(res, "Instagram Import");

      if (res.ok) {
        setInstagramStatus("success");
        showToast("Instagram media imported successfully!", "success");
        autoShareToTelegram(data, "📸 Fresh IG exclusive dropped!");
        setTimeout(() => {
          setInstagramStatus("idle");
          setInstagramUrl("");
        }, 3000);
      } else {
        setInstagramStatus("error");
        showToast(data.error || data.detail || data.message || "Import failed. Check the URL or IG might be blocking.", "error");
      }
    } catch (err) {
      setInstagramStatus("error");
      console.error("Instagram Import error:", err);
      showToast(err.message || "Network Error: Is the FastAPI server running?", "error");
    } finally {
      processingLock.current = false; 
    }
  };

  const handleTiktokImport = async (e) => {
    e.preventDefault();
    if (processingLock.current) return;
    if (!tiktokUrl) return showToast("Please enter a TikTok URL", "error");

    const token = localStorage.getItem("token");
    if (!token) return showToast("Authentication required. Please log into the Admin Dashboard first.", "error");

    processingLock.current = true;
    setTiktokStatus("processing");

    const endpoint = pipelineRoute === "direct" 
        ? `${APP_CONFIG.apiUrl}/twitter-api/import-tiktok-direct`
        : `${APP_CONFIG.apiUrl}/twitter-api/import-tiktok-telethon`;

    const finalUploaderId = uploaderId || "1881815190";
    const finalCreatorUsername = creatorUsername || "naijahomemade";
    const finalCreatorDisplayName = creatorDisplayName || "Naija Homemade Series";

    const { start: ttStart, duration: ttDur } = getTrimRange();
    const queryParams = new URLSearchParams({
      creator_username: finalCreatorUsername,
      creator_display_name: finalCreatorDisplayName,
      uploader_id: finalUploaderId
    });
    if (trimMode !== "full") {
      queryParams.set("trim_mode", trimMode);
      queryParams.set("trim_duration", ttDur.toString());
      queryParams.set("trim_start", ttStart.toString());
    }
    if (token) {
      queryParams.set("token", token);
    }
    const callbackUrl = `${APP_CONFIG.apiUrl}/api/admin/upload-premium?${queryParams.toString()}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ 
          url: tiktokUrl,
          admin_id: finalUploaderId, 
          creator_username: finalCreatorUsername,
          creator_display_name: finalCreatorDisplayName,
          category: category,
          telegram_dest: telegramDest,
          upload_target: uploadTarget,
          callback_url: callbackUrl,
          apply_watermark: applyWatermark,
          trim_mode: trimMode,
          trim_duration: ttDur,
          trim_start: ttStart
        }),
      });

      const data = await parseApiResponse(res, "TikTok Import");

      if (res.ok) {
        setTiktokStatus("success");
        showToast("TikTok video imported successfully!", "success");
        autoShareToTelegram(data, "🎵 Fresh TikTok viral drop!");
        setTimeout(() => {
          setTiktokStatus("idle");
          setTiktokUrl("");
        }, 3000);
      } else {
        setTiktokStatus("error");
        showToast(data.error || data.detail || data.message || "Import failed. Check the TikTok URL.", "error");
      }
    } catch (err) {
      setTiktokStatus("error");
      console.error("TikTok Import error:", err);
      showToast(err.message || "Network Error: Is the FastAPI server running?", "error");
    } finally {
      processingLock.current = false; 
    }
  };

  return (
    <div style={fullscreenContainerStyle}>
      {/* Instagram-style Top Navigation Bar */}
      <div style={topNavStyle}>
        <button onClick={onClose} style={navBackBtnStyle} aria-label="Back">
          <ArrowLeft size={24} color="#fff" />
        </button>

        <span style={topNavTitleStyle}>
          Admin Upload
        </span>

        <div style={{ width: "36px" }} />
      </div>

      <div style={scrollAreaStyle}>
        <div style={innerContentStyle}>
          {/* 🟢 5-Way Tabs Container */}
          <div style={tabsContainerStyle}>
            <button 
              onClick={() => setUploadMode("local")} 
              style={{ ...tabStyle, padding: "8px 2px", background: uploadMode === "local" ? "#333" : "transparent", color: uploadMode === "local" ? "#fff" : "#888" }}
            >
              Local
            </button>
            <button 
              onClick={() => setUploadMode("twitter")} 
              style={{ ...tabStyle, padding: "8px 2px", background: uploadMode === "twitter" ? "#1DA1F220" : "transparent", color: uploadMode === "twitter" ? "#1DA1F2" : "#888" }}
            >
              Twitter
            </button>
            <button 
              onClick={() => setUploadMode("instagram")} 
              style={{ ...tabStyle, padding: "8px 2px", background: uploadMode === "instagram" ? "#E1306C20" : "transparent", color: uploadMode === "instagram" ? "#E1306C" : "#888" }}
            >
              Instagram
            </button>
            <button 
              onClick={() => setUploadMode("tiktok")} 
              style={{ ...tabStyle, padding: "8px 2px", background: uploadMode === "tiktok" ? "#ff005020" : "transparent", color: uploadMode === "tiktok" ? "#ff0050" : "#888" }}
            >
              TikTok
            </button>
            <button 
              onClick={() => setUploadMode("telegram")} 
              style={{ ...tabStyle, padding: "8px 2px", background: uploadMode === "telegram" ? "#0088cc20" : "transparent", color: uploadMode === "telegram" ? "#0088cc" : "#888" }}
            >
              Telegram
            </button>
          </div>

        {/* 🟢 SHARED INPUTS */}
        <div style={formStyle}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Assign Creator / Channel</label>
            <CreatorDropdown 
              creators={creatorsList}
              selectedKey={selectedCreatorKey}
              onSelect={handleCreatorChange}
            />
          </div>

          {isCustomCreator && (
            <div style={{
              background: "#1c1c1e",
              border: "1px solid #3a3a3c",
              borderRadius: "10px",
              padding: "14px",
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }}>
              <div style={{ fontSize: "13px", fontWeight: "600", color: "#ffa500" }}>
                ⚙️ Custom Creator / Channel Attribution
              </div>
              <div style={inputGroupStyle}>
                <label style={{ ...labelStyle, fontSize: "11px" }}>Creator Username / Handle</label>
                <input 
                  type="text" 
                  value={creatorUsername} 
                  onChange={(e) => setCreatorUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                  placeholder="e.g. naijahomemade or channel_name"
                  style={inputStyle}
                  required
                />
              </div>
              <div style={inputGroupStyle}>
                <label style={{ ...labelStyle, fontSize: "11px" }}>Display Name</label>
                <input 
                  type="text" 
                  value={creatorDisplayName} 
                  onChange={(e) => setCreatorDisplayName(e.target.value)}
                  placeholder="e.g. Naija Homemade Series"
                  style={inputStyle}
                  required
                />
              </div>
              <div style={inputGroupStyle}>
                <label style={{ ...labelStyle, fontSize: "11px" }}>Telegram Channel ID / Uploader ID</label>
                <input 
                  type="text" 
                  value={uploaderId} 
                  onChange={(e) => setUploaderId(e.target.value)}
                  placeholder="e.g. -1003754790625 or 1881815190"
                  style={inputStyle}
                />
              </div>
            </div>
          )}

          <div style={inputGroupStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={labelStyle}>Category</label>
              <span style={{ fontSize: "11px", color: category === "premium" ? "#ffd700" : "var(--primary-color, #e11d48)", fontWeight: "700", textTransform: "uppercase" }}>
                Active: {category}
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
              {[
                { id: "premium", label: "Premium", icon: "💎", isVip: true },
                { id: "shots", label: "Shots", icon: "⚡" },
                ...APP_CONFIG.categories
                  .filter(cat => cat !== "premium" && cat !== "shots")
                  .map(cat => ({
                    id: cat,
                    label: cat.charAt(0).toUpperCase() + cat.slice(1),
                    icon: cat === "baddies" ? "🔥" : cat === "hotties" ? "💃" : cat === "knacks" ? "🍑" : cat === "trends" ? "📈" : "🎬",
                    isVip: false
                  }))
              ].map(cat => {
                const isSelected = category === cat.id;
                const isVip = cat.isVip;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleCategoryChange(cat.id)}
                    style={{
                      padding: "10px 6px",
                      borderRadius: "10px",
                      border: isSelected
                        ? (isVip ? "1.5px solid #ffd700" : "1.5px solid var(--primary-color, #e11d48)")
                        : "1px solid #333338",
                      background: isSelected
                        ? (isVip ? "rgba(255, 215, 0, 0.16)" : "rgba(225, 29, 72, 0.18)")
                        : "#1c1c1f",
                      color: isSelected ? (isVip ? "#ffd700" : "#fff") : "#999",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      fontSize: "12px",
                      fontWeight: isSelected ? "700" : "600",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                      boxShadow: isSelected ? (isVip ? "0 0 10px rgba(255, 215, 0, 0.25)" : "0 0 10px rgba(225, 29, 72, 0.25)") : "none"
                    }}
                  >
                    <span>{cat.icon}</span>
                    <span>{cat.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={inputGroupStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={labelStyle}>Storage Destination</label>
              <span style={{ fontSize: "11px", color: "#888" }}>
                {uploadTarget === "r2" ? "Zero egress fees" : "Instant fast streaming"}
              </span>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px",
              background: "#161618",
              border: "1px solid #2c2c30",
              borderRadius: "10px",
              padding: "4px"
            }}>
              <button
                type="button"
                onClick={() => setUploadTarget("r2")}
                style={{
                  padding: "9px 8px",
                  borderRadius: "8px",
                  border: "none",
                  background: uploadTarget === "r2" ? "var(--primary-color, #e11d48)" : "transparent",
                  color: uploadTarget === "r2" ? "#fff" : "#888",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.15s ease"
                }}
              >
                <HardDrive size={15} />
                <span>Cloudflare R2</span>
              </button>
              <button
                type="button"
                onClick={() => setUploadTarget("stream")}
                style={{
                  padding: "9px 8px",
                  borderRadius: "8px",
                  border: "none",
                  background: uploadTarget === "stream" ? "var(--primary-color, #e11d48)" : "transparent",
                  color: uploadTarget === "stream" ? "#fff" : "#888",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.15s ease"
                }}
              >
                <Zap size={15} />
                <span>CF Stream</span>
              </button>
            </div>
          </div>

          <div style={inputGroupStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <label style={labelStyle}>Brand Watermark</label>
              <span style={{ fontSize: "11px", color: applyWatermark ? "var(--primary-color, #e11d48)" : "#888", fontWeight: "600" }}>
                {applyWatermark ? "Watermarked" : "Raw Source"}
              </span>
            </div>
            <div style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "6px",
              background: "#161618",
              border: "1px solid #2c2c30",
              borderRadius: "10px",
              padding: "4px"
            }}>
              <button
                type="button"
                onClick={() => setApplyWatermark(true)}
                style={{
                  padding: "9px 8px",
                  borderRadius: "8px",
                  border: "none",
                  background: applyWatermark ? "var(--primary-color, #e11d48)" : "transparent",
                  color: applyWatermark ? "#fff" : "#888",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.15s ease"
                }}
              >
                <Droplets size={15} />
                <span>Stamp Watermark</span>
              </button>
              <button
                type="button"
                onClick={() => setApplyWatermark(false)}
                style={{
                  padding: "9px 8px",
                  borderRadius: "8px",
                  border: "none",
                  background: !applyWatermark ? "#333338" : "transparent",
                  color: !applyWatermark ? "#fff" : "#888",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  transition: "all 0.15s ease"
                }}
              >
                <Zap size={15} />
                <span>Keep Raw</span>
              </button>
            </div>
          </div>

          {/* 🟢 VIDEO LENGTH & SECTION TRIMMING */}
          <div style={{
            background: "#1c1c1e",
            border: "1px solid #2c2c2e",
            borderRadius: "14px",
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            marginTop: "6px"
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Scissors size={18} color="var(--primary-color, #e11d48)" />
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#fff", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                  Video Section & Length
                </span>
              </div>
              {videoDuration > 0 && (
                <span style={{ fontSize: "12px", color: "#aaa", fontWeight: "600" }}>
                  Total: {formatTime(videoDuration)}
                </span>
              )}
            </div>

            {/* Segmented Selector for Section: Full Video, Beginning, Center, Ending */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
              {[
                { id: "full", label: "Full Video" },
                { id: "beginning", label: "Beginning" },
                { id: "center", label: "Center" },
                { id: "ending", label: "Ending" }
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setTrimMode(m.id);
                    setIsPlayingPreview(false);
                  }}
                  style={{
                    padding: "9px 4px",
                    borderRadius: "8px",
                    border: trimMode === m.id ? "1px solid var(--primary-color, #e11d48)" : "1px solid #333",
                    background: trimMode === m.id ? "rgba(225, 29, 72, 0.2)" : "#262628",
                    color: trimMode === m.id ? "#fff" : "#999",
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

            {/* When not 'full', show duration chips and custom input */}
            {trimMode !== "full" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "2px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "12px", color: "#aaa", fontWeight: "600" }}>
                    Clip Duration:
                  </span>
                  <span style={{ fontSize: "12px", color: "var(--primary-color, #e11d48)", fontWeight: "700" }}>
                    {trimDuration === "custom" ? `${customDuration || 0}s` : `${trimDuration}s`} ({trimMode})
                  </span>
                </div>

                {/* Preset Chips */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {[15, 30, 45, 60, 90].map(sec => (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => {
                        setTrimDuration(sec);
                        setCustomDuration("");
                        setIsPlayingPreview(false);
                      }}
                      style={{
                        flex: 1,
                        minWidth: "48px",
                        padding: "8px 6px",
                        borderRadius: "8px",
                        border: (trimDuration === sec && !customDuration) ? "1px solid var(--primary-color, #e11d48)" : "1px solid #333",
                        background: (trimDuration === sec && !customDuration) ? "var(--primary-color, #e11d48)" : "#262628",
                        color: (trimDuration === sec && !customDuration) ? "#fff" : "#bbb",
                        fontSize: "12px",
                        fontWeight: "700",
                        cursor: "pointer"
                      }}
                    >
                      {sec}s
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setTrimDuration("custom");
                      if (!customDuration) setCustomDuration("30");
                      setIsPlayingPreview(false);
                    }}
                    style={{
                      flex: 1,
                      minWidth: "56px",
                      padding: "8px 6px",
                      borderRadius: "8px",
                      border: trimDuration === "custom" ? "1px solid var(--primary-color, #e11d48)" : "1px solid #333",
                      background: trimDuration === "custom" ? "var(--primary-color, #e11d48)" : "#262628",
                      color: trimDuration === "custom" ? "#fff" : "#bbb",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                  >
                    Custom
                  </button>
                </div>

                {trimDuration === "custom" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                    <input
                      type="number"
                      min="3"
                      max={videoDuration ? Math.floor(videoDuration) : 600}
                      value={customDuration}
                      onChange={(e) => {
                        setCustomDuration(e.target.value);
                        setIsPlayingPreview(false);
                      }}
                      placeholder="Seconds (e.g. 25)"
                      style={{
                        flex: 1,
                        background: "#2c2c2e",
                        border: "1px solid #3a3a3c",
                        color: "#fff",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        fontSize: "13px",
                        outline: "none"
                      }}
                    />
                    <span style={{ fontSize: "13px", color: "#888" }}>seconds</span>
                  </div>
                )}

                {/* Visual Timeline Slice Indicator (when duration is available) */}
                {videoDuration > 0 && (
                  <div style={{ marginTop: "6px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{
                      position: "relative",
                      width: "100%",
                      height: "10px",
                      backgroundColor: "#2c2c2e",
                      borderRadius: "5px",
                      overflow: "hidden"
                    }}>
                      {(() => {
                        const { start, end } = getTrimRange();
                        const leftPct = (start / videoDuration) * 100;
                        const widthPct = Math.max(2, ((end - start) / videoDuration) * 100);
                        return (
                          <div style={{
                            position: "absolute",
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            top: 0,
                            bottom: 0,
                            backgroundColor: "var(--primary-color, #e11d48)",
                            borderRadius: "5px",
                            boxShadow: "0 0 10px rgba(225, 29, 72, 0.6)"
                          }} />
                        );
                      })()}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "#888" }}>
                      <span>00:00</span>
                      {(() => {
                        const { start, end, duration } = getTrimRange();
                        return (
                          <span style={{ color: "#fff", fontWeight: "700" }}>
                            ✂️ {formatTime(start)} ➔ {formatTime(end)} ({duration}s from {trimMode})
                          </span>
                        );
                      })()}
                      <span>{formatTime(videoDuration)}</span>
                    </div>
                  </div>
                )}

                {/* Interactive Snippet Preview Player (for Local Upload) */}
                {previewUrl && (
                  <div style={{
                    marginTop: "8px",
                    background: "#121212",
                    borderRadius: "10px",
                    overflow: "hidden",
                    border: "1px solid #2a2a2c",
                    position: "relative"
                  }}>
                    <video
                      ref={previewVideoRef}
                      src={previewUrl}
                      playsInline
                      muted
                      onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
                      onTimeUpdate={handlePreviewTimeUpdate}
                      style={{ width: "100%", maxHeight: "180px", objectFit: "contain", display: "block", background: "#000" }}
                    />

                    <div style={{
                      padding: "8px 12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      background: "rgba(20, 20, 20, 0.95)"
                    }}>
                      <button
                        type="button"
                        onClick={handleTogglePreview}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          padding: "6px 12px",
                          borderRadius: "6px",
                          border: "none",
                          background: isPlayingPreview ? "#444" : "var(--primary-color, #e11d48)",
                          color: "#fff",
                          fontSize: "12px",
                          fontWeight: "700",
                          cursor: "pointer"
                        }}
                      >
                        {isPlayingPreview ? <Pause size={14} /> : <Play size={14} />}
                        {isPlayingPreview ? "Pause Preview" : "Play Snippet"}
                      </button>

                      <span style={{ fontSize: "11px", color: "#888" }}>
                        {isPlayingPreview ? "Looping snippet preview" : "Preview snippet before uploading"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Hidden video element to detect duration if preview player is not mounted */}
            {previewUrl && trimMode === "full" && (
              <video
                src={previewUrl}
                onLoadedMetadata={(e) => setVideoDuration(e.target.duration)}
                style={{ display: "none" }}
              />
            )}
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
            <RoutingPipelineControl 
              pipelineRoute={pipelineRoute} 
              setPipelineRoute={setPipelineRoute} 
              telegramDest={telegramDest} 
              setTelegramDest={setTelegramDest} 
            />

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

        {/* 🟢 INSTAGRAM IMPORT */}
        {uploadMode === "instagram" && (
          <form onSubmit={handleInstagramImport} style={formStyle}>
            <RoutingPipelineControl 
              pipelineRoute={pipelineRoute} 
              setPipelineRoute={setPipelineRoute} 
              telegramDest={telegramDest} 
              setTelegramDest={setTelegramDest} 
            />

            <div style={inputGroupStyle}>
              <label style={labelStyle}>Instagram Link</label>
              <div style={{ position: "relative" }}>
                <Link size={18} color="#888" style={{ position: "absolute", left: "12px", top: "12px" }} />
                <input 
                  type="url" 
                  placeholder="https://instagram.com/p/..." 
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: "40px" }}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" disabled={instagramStatus === "processing"}
              style={{ ...buttonStyle, background: instagramStatus === "processing" ? "#333" : instagramStatus === "success" ? "#4cd964" : instagramStatus === "error" ? "#ff3b30" : "#E1306C" }}
            >
              {instagramStatus === "processing" ? <><Loader2 className="spin" size={18} /> Extracting & Uploading...</> : instagramStatus === "success" ? <><CheckCircle size={18} /> Successfully Imported!</> : instagramStatus === "error" ? <><AlertCircle size={18} /> Import Failed.</> : "Import Reel / Post"}
            </button>
          </form>
        )}

        {/* 🟢 TIKTOK IMPORT */}
        {uploadMode === "tiktok" && (
          <form onSubmit={handleTiktokImport} style={formStyle}>
            <RoutingPipelineControl 
              pipelineRoute={pipelineRoute} 
              setPipelineRoute={setPipelineRoute} 
              telegramDest={telegramDest} 
              setTelegramDest={setTelegramDest} 
            />

            <div style={inputGroupStyle}>
              <label style={labelStyle}>TikTok Link</label>
              <div style={{ position: "relative" }}>
                <Link size={18} color="#888" style={{ position: "absolute", left: "12px", top: "12px" }} />
                <input 
                  type="url" 
                  placeholder="https://www.tiktok.com/@user/video/... or https://vm.tiktok.com/..." 
                  value={tiktokUrl}
                  onChange={(e) => setTiktokUrl(e.target.value)}
                  style={{ ...inputStyle, paddingLeft: "40px" }}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" disabled={tiktokStatus === "processing"}
              style={{ ...buttonStyle, background: tiktokStatus === "processing" ? "#333" : tiktokStatus === "success" ? "#4cd964" : tiktokStatus === "error" ? "#ff3b30" : "#ff0050" }}
            >
              {tiktokStatus === "processing" ? <><Loader2 className="spin" size={18} /> Extracting & Uploading...</> : tiktokStatus === "success" ? <><CheckCircle size={18} /> Successfully Imported!</> : tiktokStatus === "error" ? <><AlertCircle size={18} /> Import Failed.</> : "Import TikTok Video"}
            </button>
          </form>
        )}

        {/* 🟢 TELEGRAM IMPORT */}
        {uploadMode === "telegram" && (
          <form onSubmit={handleTelegramImport} style={formStyle}>
            <RoutingPipelineControl 
              pipelineRoute={pipelineRoute} 
              setPipelineRoute={setPipelineRoute} 
              telegramDest={telegramDest} 
              setTelegramDest={setTelegramDest} 
            />

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
          @keyframes dropdownFadeIn {
            from { opacity: 0; transform: translateY(-6px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}</style>
        </div>
      </div>
    </div>
  );
}

// 🎨 DARK THEME STYLES
const fullscreenContainerStyle = {
  position: "fixed",
  inset: 0,
  zIndex: 99999,
  backgroundColor: "#000000",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  animation: "fadeIn 0.2s ease-out"
};

const topNavStyle = {
  height: "50px",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 16px",
  borderBottom: "1px solid #1a1a1a",
  backgroundColor: "#000000",
  position: "sticky",
  top: 0,
  zIndex: 50,
  flexShrink: 0
};

const navBackBtnStyle = {
  background: "none",
  border: "none",
  color: "#fff",
  cursor: "pointer",
  padding: "6px",
  display: "flex",
  alignItems: "center"
};

const topNavTitleStyle = {
  fontSize: "16px",
  fontWeight: "700",
  color: "#fff",
  letterSpacing: "0.2px"
};

const scrollAreaStyle = {
  flex: 1,
  overflowY: "auto",
  WebkitOverflowScrolling: "touch",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  padding: "20px 16px 60px",
  boxSizing: "border-box"
};

const innerContentStyle = {
  width: "100%",
  maxWidth: "500px",
  display: "flex",
  flexDirection: "column"
};
const tabsContainerStyle = { display: "flex", gap: "6px", marginBottom: "24px", background: "#121212", padding: "4px", borderRadius: "10px" };
const tabStyle = { flex: 1, padding: "8px 4px", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", transition: "0.2s" };
const formStyle = { display: "flex", flexDirection: "column", gap: "20px" };
const inputGroupStyle = { display: "flex", flexDirection: "column", gap: "8px" };
const labelStyle = { fontSize: "12px", fontWeight: "700", color: "#888", textTransform: "uppercase" };
const inputStyle = { width: "100%", boxSizing: "border-box", background: "#2c2c2e", border: "1px solid #3a3a3c", color: "#fff", padding: "12px", borderRadius: "8px", fontSize: "14px", outline: "none" };
const fileDropStyle = { position: "relative", height: "120px", border: "2px dashed #444", borderRadius: "12px", display: "flex", alignItems: "center", justifyContent: "center", background: "#121212", transition: "0.2s" };
const buttonStyle = { padding: "14px", borderRadius: "12px", border: "none", color: "#fff", fontWeight: "700", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px", fontSize: "15px", transition: "0.2s" };