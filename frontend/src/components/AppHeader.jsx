import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Search, X, ArrowLeft, Flame, TrendingUp, Play, Clock } from "lucide-react";

const SUGGESTED_KEYWORDS = ["Knacks", "Trending", "Lagos Baddies", "Exclusive"];

export default function AppHeader({ 
  isDesktop, searchTerm, setSearchTerm, 
  user, onProfileClick, 
  suggestions = [],
  onVideoClick
}) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const isLoggedIn = user && (user.id || user.email);

  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  
  // 🟢 NEW: State to track if the user has explicitly hit "Search"
  const [hasSubmittedSearch, setHasSubmittedSearch] = useState(false);
  
  const [searchPage, setSearchPage] = useState(1);
  const [hasMoreResults, setHasMoreResults] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const saved = localStorage.getItem("recent_searches");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    if (isSearchOpen) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => document.body.style.overflow = "";
  }, [isSearchOpen]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      setHasMoreResults(false);
      setHasSubmittedSearch(false); // Reset submitted state when empty
      return;
    }

    setIsSearching(true);
    setSearchPage(1); 

    const delayDebounceFn = setTimeout(async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/search?q=${encodeURIComponent(searchTerm)}&page=1&limit=15`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.videos || []);
          setHasMoreResults(data.hasMore);
        }
      } catch (err) {
        console.error("Search fetch failed", err);
      } finally {
        setIsSearching(false);
      }
    }, 400); 

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const loadMoreResults = async () => {
    if (isLoadingMore || !hasMoreResults) return;
    
    setIsLoadingMore(true);
    const nextPage = searchPage + 1;
    
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/search?q=${encodeURIComponent(searchTerm)}&page=${nextPage}&limit=15`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(prev => {
          const combined = [...prev, ...(data.videos || [])];
          const uniqueMap = new Map();
          combined.forEach(v => uniqueMap.set(v.message_id, v));
          return Array.from(uniqueMap.values());
        });
        setHasMoreResults(data.hasMore);
        setSearchPage(nextPage);
      }
    } catch (err) {
      console.error("Load more search failed", err);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleKeywordClick = (keyword) => {
    setSearchTerm(keyword);
    setHasSubmittedSearch(true); // Treat clicking a keyword pill as a submitted search
    saveSearchHistory(keyword);
  };

  // 🟢 Helper to save search history
  const saveSearchHistory = (term) => {
    if (!term.trim()) return;
    const currentTerm = term.trim();
    const updatedSearches = [currentTerm, ...recentSearches.filter(s => s !== currentTerm)].slice(0, 5);
    setRecentSearches(updatedSearches);
    localStorage.setItem("recent_searches", JSON.stringify(updatedSearches));
  };

  // 🟢 Handle explicit search submission (Enter key or Search button)
  const handleSearchSubmit = () => {
    if (searchTerm.trim()) {
      setHasSubmittedSearch(true);
      saveSearchHistory(searchTerm);
    } else {
      setIsSearchOpen(false);
    }
  };

  const handleExecuteSearch = (video, e) => {
    saveSearchHistory(searchTerm);
    setIsSearchOpen(false);
    onVideoClick(video, e);
  };

  const removeRecentSearch = (termToRemove, e) => {
    e.stopPropagation(); 
    const updated = recentSearches.filter(s => s !== termToRemove);
    setRecentSearches(updated);
    localStorage.setItem("recent_searches", JSON.stringify(updated));
  };

  return (
    <>
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
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHasSubmittedSearch(false); // 🟢 Revert to suggestions when user resumes typing
                }} 
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchSubmit(); // 🟢 Trigger submit on Enter
                }}
                style={inputStyle} 
              />
              {searchTerm && <X size={16} color="#8e8e8e" style={{ cursor: "pointer" }} onClick={() => setSearchTerm("")} />}
            </div>
            {/* 🟢 Trigger submit on button click */}
            <button onClick={handleSearchSubmit} style={searchActionBtnStyle}>Search</button>
          </div>

          <div style={overlayContentStyle}>
            
            {!searchTerm.trim() ? (
              <>
                {recentSearches.length > 0 && (
                  <div style={sectionStyle}>
                    <h3 style={sectionTitleStyle}>Recent Searches</h3>
                    <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                      {recentSearches.map(term => (
                        <div key={term} onClick={() => handleKeywordClick(term)} style={recentSearchItemStyle}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <Clock size={16} color="#8e8e8e" />
                            <span style={{ color: "#ddd", fontSize: "15px" }}>{term}</span>
                          </div>
                          <button onClick={(e) => removeRecentSearch(term, e)} style={iconBtnStyle}>
                            <X size={16} color="#8e8e8e" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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
                    <div style={suggestedContentGrid(isDesktop)}>
                      {suggestions.slice(0, 6).map(v => (
                        <div key={v.message_id} onClick={(e) => handleExecuteSearch(v, e)} style={suggestedVideoItem(isDesktop)}>
                          <div style={suggestedThumbWrapper(isDesktop)}>
                            <img src={v.thumbnail_url} style={suggestedThumb} alt="" />
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
                              {!isDesktop && <span style={{ color: "#555" }}> • {Number(v.views).toLocaleString()} views</span>}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={sectionStyle}>
                <h3 style={sectionTitleStyle}>
                  {isSearching && searchPage === 1 ? "Searching..." : `Results for "${searchTerm}"`}
                </h3>

                {searchResults.length === 0 && !isSearching ? (
                  <div style={{ textAlign: "center", padding: "40px 20px", color: "#888" }}>
                    <Search size={40} color="#333" style={{ marginBottom: "15px" }} />
                    <p style={{ margin: 0, fontSize: "16px", fontWeight: "600", color: "#ccc" }}>No results found</p>
                    <p style={{ margin: "5px 0 0 0", fontSize: "13px" }}>Try searching for a different keyword or uploader.</p>
                  </div>
                ) : (
                  <>
                    {/* 🟢 DYNAMIC RENDER: List if typing, Grid if submitted */}
                    {!hasSubmittedSearch ? (
                      <div style={suggestedContentGrid(isDesktop)}>
                        {searchResults.slice(0, 8).map(v => (
                          <div key={`live-${v.message_id}`} onClick={(e) => handleExecuteSearch(v, e)} style={suggestedVideoItem(isDesktop)}>
                            <div style={suggestedThumbWrapper(isDesktop)}>
                              <img src={v.thumbnail_url} style={suggestedThumb} alt="" />
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
                                {!isDesktop && <span style={{ color: "#555" }}> • {Number(v.views).toLocaleString()} views</span>}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      // 🟢 SUBMITTED GRID VIEW (2 on mobile, 5 on desktop)
                      <div style={submittedContentGrid(isDesktop)}>
                        {searchResults.map(v => (
                          <div key={`grid-${v.message_id}`} onClick={(e) => handleExecuteSearch(v, e)} style={submittedVideoItem}>
                            <div style={submittedThumbWrapper}>
                              <img src={v.thumbnail_url} style={suggestedThumb} alt="" />
                              <div style={viewsOverlay}>
                                <Play size={10} fill="#fff" strokeWidth={0} />
                                {Number(v.views).toLocaleString()}
                              </div>
                            </div>
                            <div style={submittedVideoInfo}>
                              <p style={suggestedCaption}>{v.caption || "View trending shot..."}</p>
                              <span style={suggestedUploader}>@{v.uploader_name}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {hasMoreResults && !isSearching && hasSubmittedSearch && (
                      <button 
                        onClick={loadMoreResults} 
                        style={showMoreButtonStyle}
                        disabled={isLoadingMore}
                      >
                        {isLoadingMore ? "Loading..." : "See More"}
                      </button>
                    )}
                  </>
                )}
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
const mobileHeaderStyle = { position: "sticky", top: 0, zIndex: 100, padding: "12px 15px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#0a0a0a", borderBottom: "1px solid #262626" };

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
const recentSearchItemStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0", cursor: "pointer", borderBottom: "1px solid #1c1c1e" };
const showMoreButtonStyle = { display: "block", margin: "30px auto", background: "#1c1c1e", color: "#fff", padding: "12px 30px", borderRadius: "35px", border: "1px solid #333", fontWeight: "800", cursor: "pointer" };

// Live Suggestion Styles (List view)
const suggestedContentGrid = (isDesktop) => ({ display: isDesktop ? "grid" : "flex", flexDirection: isDesktop ? "row" : "column", gridTemplateColumns: isDesktop ? "repeat(auto-fill, minmax(150px, 1fr))" : "none", gap: isDesktop ? "15px" : "0" });
const suggestedVideoItem = (isDesktop) => ({ display: "flex", flexDirection: isDesktop ? "column" : "row-reverse", gap: isDesktop ? "8px" : "12px", alignItems: "center", cursor: "pointer", width: "100%", borderBottom: isDesktop ? "none" : "1px solid #1c1c1e", padding: isDesktop ? "0" : "12px 0" });
const suggestedThumbWrapper = (isDesktop) => ({ width: isDesktop ? "100%" : "56px", height: isDesktop ? "auto" : "80px", aspectRatio: isDesktop ? "9/16" : "auto", background: "#111", borderRadius: isDesktop ? "8px" : "6px", position: "relative", overflow: "hidden", flexShrink: 0 });
const suggestedVideoInfo = (isDesktop) => ({ display: "flex", flexDirection: "column", justifyContent: "center", flex: 1, minWidth: 0 });
const suggestedThumb = { width: "100%", height: "100%", objectFit: "cover" };
const viewsOverlay = { position: "absolute", bottom: "6px", left: "6px", background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", padding: "4px 8px", borderRadius: "4px", color: "#fff", fontSize: "10px", fontWeight: "800", display: "flex", alignItems: "center", gap: "4px" };
const suggestedCaption = { color: "#fff", fontSize: "14px", fontWeight: "600", margin: "0 0 6px 0", display: "-webkit-box", WebkitLineClamp: "2", WebkitBoxOrient: "vertical", overflow: "hidden", lineHeight: "1.4" };
const suggestedUploader = { color: "#8e8e8e", fontSize: "12px", fontWeight: "500" };

// 🟢 NEW: Submitted Grid Styles (Like Home.jsx)
const submittedContentGrid = (isDesktop) => ({ display: "grid", gridTemplateColumns: isDesktop ? "repeat(5, 1fr)" : "repeat(2, 1fr)", gap: isDesktop ? "20px" : "10px", animation: "fadeIn 0.3s ease-out" });
const submittedVideoItem = { display: "flex", flexDirection: "column", gap: "8px", cursor: "pointer", width: "100%" };
const submittedThumbWrapper = { width: "100%", aspectRatio: "9/16", background: "#111", borderRadius: "12px", position: "relative", overflow: "hidden" };
const submittedVideoInfo = { display: "flex", flexDirection: "column" };