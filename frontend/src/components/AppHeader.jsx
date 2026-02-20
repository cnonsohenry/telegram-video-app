import React from "react";
import { Search, X } from "lucide-react";

export default function AppHeader({ 
  isDesktop, searchTerm, setSearchTerm, 
  isMobileSearchVisible, setIsMobileSearchVisible,
  user, onProfileClick 
}) {
  // 🟢 FIXED: Declare variables HERE, before the return
  const isLoggedIn = user && (user.id || user.email);

  return (
    <>
      {/* DESKTOP HEADER */}
      {isDesktop && (
        <header style={desktopHeaderStyle}>
          <div style={{ userSelect: "none" }}>
            <h1 style={logoStyle}>NAIJA<span style={{ color: "var(--primary-color)" }}>HOMEMADE</span></h1>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "25px" }}>
            <div style={searchBarStyle}>
              <Search size={18} color="#8e8e8e" />
              <input 
                type="text" placeholder="Search shots..." value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                style={inputStyle} 
              />
              {searchTerm && <X size={16} color="#8e8e8e" style={{ cursor: "pointer" }} onClick={() => setSearchTerm("")} />}
            </div>
            
            {/* PROFILE TRIGGER */}
            <button onClick={onProfileClick} style={profileBtnStyle}>
              {isLoggedIn ? (
                <img 
                  src={user.avatar_url || "/assets/default-avatar.png"} 
                  alt="Profile"
                  style={avatarStyle(isDesktop)} 
                />
              ) : (
                <div style={loginBadgeStyle}>LOGIN</div>
              )}
            </button>
          </div>
        </header>
      )}

      {/* MOBILE HEADER */}
      {!isDesktop && (
        <div style={mobileHeaderStyle}>
          {isMobileSearchVisible ? (
            <div style={mobileSearchContainer}>
              <Search size={16} color="#8e8e8e" />
              <input 
                autoFocus type="text" placeholder="Search..." value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                style={inputStyle} 
              />
              <X size={18} color="#8e8e8e" onClick={() => { setIsMobileSearchVisible(false); setSearchTerm(""); }} />
            </div>
          ) : (
            <>
              <h1 style={{ color: "#fff", fontSize: "18px", fontWeight: "900", margin: 0 }}>
                NAIJA<span style={{ color: "var(--primary-color)" }}>HOMEMADE</span>
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                <Search size={22} color="#fff" onClick={() => setIsMobileSearchVisible(true)} />
                <button onClick={onProfileClick} style={profileBtnStyle}>
                  {isLoggedIn ? (
                    <img src={user.avatar_url || "/assets/default-avatar.png"} alt="P" style={avatarStyle(false)} />
                  ) : (
                    <div style={loginBadgeStyle}>LOGIN</div>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

// 🎨 Styles
const desktopHeaderStyle = { position: "sticky", top: 0, zIndex: 100, height: "70px", background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid #262626", padding: "0 40px", display: "flex", alignItems: "center", justifyContent: "space-between" };
const logoStyle = { color: "#fff", fontSize: "24px", fontWeight: "900", letterSpacing: "-1px", margin: 0 };
const searchBarStyle = { display: "flex", alignItems: "center", background: "#1c1c1e", borderRadius: "20px", padding: "0 15px", width: "400px", border: "1px solid #333" };
const inputStyle = { background: "none", border: "none", color: "#fff", padding: "10px", width: "100%", outline: "none", fontSize: "14px" };
const profileBtnStyle = { background: "none", border: "none", cursor: "pointer", padding: 0 };
const avatarStyle = (isDesktop) => ({ width: isDesktop ? "36px" : "30px", height: isDesktop ? "36px" : "30px", borderRadius: "50%", border: "2px solid var(--primary-color)", objectFit: "cover" });
const loginBadgeStyle = { background: "var(--primary-color)", color: "#fff", padding: "6px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "800" };
const mobileHeaderStyle = { position: "sticky", top: 0, zIndex: 1000, padding: "12px 15px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-color)", borderBottom: "1px solid #111" };
const mobileSearchContainer = { display: "flex", alignItems: "center", flex: 1, background: "#1c1c1e", borderRadius: "8px", padding: "0 10px" };