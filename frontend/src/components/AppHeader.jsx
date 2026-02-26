import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, X, ArrowLeft, Flame, TrendingUp, Play } from "lucide-react";

const SUGGESTED_KEYWORDS = ["Knacks", "Trending", "Lagos Baddies", "Exclusive", ];

export default function AppHeader({ 
  isDesktop, searchTerm, setSearchTerm, 
  user, onProfileClick, 
  suggestions = [],
  onVideoClick
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const isLoggedIn = user && (user.id || user.email);

  useEffect(() => {
    if (isSearchOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => document.body.style.overflow = "";
  }, [isSearchOpen]);

  const handleKeywordClick = (keyword) => {
    setSearchTerm(keyword);
    setIsSearchOpen(false); 
  };

  return (
    <>
      {/* 🟢 TIKTOK-STYLE FULLSCREEN SEARCH OVERLAY */}
      {isSearchOpen && createPortal(
        <div style={searchOverlayStyle}>
          <div style={overlayHeaderStyle}>
            <button onClick={() => setIsSearchOpen(false)} style={iconBtnStyle}>
              <ArrowLeft size={24} color="#fff" />
            </button>
            <div style={activeSearchBarStyle}>
              <Search size={16} color="#8e8e8e" />
              <input 
                autoFocus 
                type="text" 
                placeholder="Search shots..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                style={inputStyle} 
              />
              {searchTerm && <X size={16} color="#8e8e8e" style={{ cursor: "pointer" }} onClick={() => setSearchTerm("")} />}
            </div>
            <button onClick={() => setIsSearchOpen(false)} style={searchActionBtnStyle}>Search</button>
          </div>

          <div style={overlayContentStyle}>
            
            <div style={sectionStyle}>

              <div style={keywordGridStyle}>
                {SUGGESTED_KEYWORDS.map(kw => (
                  <button key={kw} onClick={() => handleKeywordClick(kw)} style={keywordPillStyle}>
                    <TrendingUp size={14} color="#8e8e8e" />
                    {kw}
                  </button>
                ))}
              </div>
            </div>

            {suggestions.length > 0 && (
              <div style={sectionStyle}>
                <h3 style={sectionTitleStyle}>
                <Flame size={16} color="#ff3b30" fill="#ff3b30" /> 
                You may like
                </h3>
                {/* 🟢 Passed isDesktop to dynamically toggle grid vs list */}
                <div style={suggestedContentGrid(isDesktop)}>
                  {suggestions.slice(0, 6).map(v => (
                    <div 
                      key={v.message_id} 
                      onClick={(e) => { setIsSearchOpen(false); onVideoClick(v, e); }}
                      style={suggestedVideoItem(isDesktop)}
                    >
                      <div style={suggestedThumbWrapper(isDesktop)}>
                        <img src={v.thumbnail_url} style={suggestedThumb} alt="" />
                        {/* Hide overlay on mobile so it doesn't block the small thumb */}
                        {isDesktop && (
                          <div style={viewsOverlay}>
                            <Play size={10} fill="#fff" strokeWidth={0} />
                            {Number(v.views).toLocaleString()}
                          </div>
                        )}
                      </div>
                      <div style={suggestedVideoInfo(isDesktop)}>
                        <p style={suggestedCaption}>{v.caption || "View trending shot..."}</p>
                        <span style={suggestedUploader}>
                          @{v.uploader_name} 
                          {/* Add views inline for mobile view */}
                          {!isDesktop && <span style={{ color: "#555" }}> • {Number(v.views).toLocaleString()} views</span>}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body 
      )}

      {/* 🟢 DEFAULT DESKTOP HEADER */}
      {isDesktop && (
        <header style={desktopHeaderStyle}>
          <div style={{ userSelect: "none" }}>
            <h1 style={logoStyle}>NAIJA<span style={{ color: "var(--primary-color)" }}>HOMEMADE</span></h1>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "25px" }}>
            <div style={searchBarStyle} onClick={() => setIsSearchOpen(true)}>
              <Search size={18} color="#8e8e8e" />
              <div style={{ ...inputStyle, color: searchTerm ? "#fff" : "#8e8e8e", cursor: "text" }}>
                {searchTerm || "Search shots..."}
              </div>
            </div>
            
            <button onClick={onProfileClick} style={profileBtnStyle}>
              {isLoggedIn ? (
                <img src={user.avatar_url || "/assets/default-avatar.png"} alt="Profile" style={avatarStyle(isDesktop)} />
              ) : (
                <div style={loginBadgeStyle}>LOGIN</div>
              )}
            </button>
          </div>
        </header>
      )}

      {/* 🟢 DEFAULT MOBILE HEADER */}
      {!isDesktop && (
        <div style={mobileHeaderStyle}>
          <h1 style={{ color: "#fff", fontSize: "18px", fontWeight: "900", margin: 0 }}>
            NAIJA<span style={{ color: "var(--primary-color)" }}>HOMEMADE</span>
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
            <Search size={22} color="#fff" onClick={() => setIsSearchOpen(true)} />
            <button onClick={onProfileClick} style={profileBtnStyle}>
              {isLoggedIn ? (
                <img src={user.avatar_url || "/assets/default-avatar.png"} alt="P" style={avatarStyle(false)} />
              ) : (
                <div style={loginBadgeStyle}>LOGIN</div>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// 🎨 Styles
const desktopHeaderStyle = { position: "sticky", top: 0, zIndex: 100, height: "70px", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)", borderBottom: "1px solid #262626", padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between" };
const logoStyle = { color: "#fff", fontSize: "24px", fontWeight: "900", letterSpacing: "-1px", margin: 0 };
const searchBarStyle = { display: "flex", alignItems: "center", background: "#1c1c1e", borderRadius: "20px", padding: "0 15px", width: "400px", border: "1px solid #333", cursor: "text" };
const inputStyle = { background: "none", border: "none", color: "#fff", padding: "10px", width: "100%", outline: "none", fontSize: "14px" };
const profileBtnStyle = { background: "none", border: "none", cursor: "pointer", padding: 0 };
const avatarStyle = (isDesktop) => ({ width: isDesktop ? "36px" : "30px", height: isDesktop ? "36px" : "30px", borderRadius: "50%", border: "2px solid var(--primary-color)", objectFit: "cover" });
const loginBadgeStyle = { background: "var(--primary-color)", color: "#fff", padding: "6px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "800" };
const mobileHeaderStyle = { position: "sticky", top: 0, zIndex: 100, padding: "12px 15px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)", borderBottom: "1px solid #262626" };

const searchOverlayStyle = { position: "fixed", inset: 0, zIndex: 999999, background: "var(--bg-color)", display: "flex", flexDirection: "column", animation: "fadeIn 0.2s ease-out" };
const overlayHeaderStyle = { display: "flex", alignItems: "center", gap: "12px", padding: "15px", borderBottom: "1px solid #222" };
const iconBtnStyle = { background: "none", border: "none", padding: 0, cursor: "pointer", display: "flex" };
const activeSearchBarStyle = { display: "flex", alignItems: "center", background: "#1c1c1e", borderRadius: "8px", padding: "0 10px", flex: 1, height: "40px" };
const searchActionBtnStyle = { background: "none", border: "none", color: "var(--primary-color)", fontWeight: "700", fontSize: "14px", cursor: "pointer" };
const overlayContentStyle = { flex: 1, overflowY: "auto", padding: "20px" };
const sectionStyle = { marginBottom: "20px" };
const sectionTitleStyle = { display: "flex", alignItems: "center", gap: "8px", color: "#fff", fontSize: "16px", fontWeight: "800", margin: "0 0 15px 0" };
const keywordGridStyle = { display: "flex", flexWrap: "wrap", gap: "10px" };
const keywordPillStyle = { display: "flex", alignItems: "center", gap: "6px", background: "#1c1c1e", color: "#ddd", border: "none", padding: "10px 16px", borderRadius: "8px", fontSize: "14px", fontWeight: "600", cursor: "pointer", transition: "0.2s" };

// 🟢 Dynamic Layout Styles
const suggestedContentGrid = (isDesktop) => ({ 
  display: isDesktop ? "grid" : "flex", 
  flexDirection: isDesktop ? "row" : "column",
  gridTemplateColumns: isDesktop ? "repeat(auto-fill, minmax(150px, 1fr))" : "none", 
  gap: isDesktop ? "15px" : "0" // 🟢 FIX: Removed the double-gap on mobile
});

const suggestedVideoItem = (isDesktop) => ({ 
  display: "flex", 
  flexDirection: isDesktop ? "column" : "row-reverse", 
  gap: isDesktop ? "8px" : "12px", 
  alignItems: "center", // 🟢 FIX: Vertically center the text with the thumbnail
  cursor: "pointer",
  width: "100%",
  borderBottom: isDesktop ? "none" : "1px solid #1c1c1e",
  padding: isDesktop ? "0" : "12px 0" // 🟢 FIX: Tighter, balanced padding
});

const suggestedThumbWrapper = (isDesktop) => ({ 
  width: isDesktop ? "100%" : "56px", // 🟢 FIX: Slimmer width
  height: isDesktop ? "auto" : "80px", // 🟢 FIX: Shorter height for a compact row
  aspectRatio: isDesktop ? "9/16" : "auto", 
  background: "#111", 
  borderRadius: isDesktop ? "8px" : "6px", // Slightly sharper corners on small mobile thumbs
  position: "relative", 
  overflow: "hidden",
  flexShrink: 0
});

const suggestedVideoInfo = (isDesktop) => ({ 
  display: "flex", 
  flexDirection: "column",
  justifyContent: "center",
  flex: 1,
  minWidth: 0
});

const suggestedThumb = { width: "100%", height: "100%", objectFit: "cover" };
const viewsOverlay = { position: "absolute", bottom: "6px", left: "6px", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", padding: "4px 8px", borderRadius: "4px", color: "#fff", fontSize: "10px", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" };
const suggestedCaption = { color: "#fff", fontSize: "14px", fontWeight: "600", margin: "0 0 6px 0", display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: "1.4" };
const suggestedUploader = { color: "#8e8e8e", fontSize: "12px", fontWeight: "500" };