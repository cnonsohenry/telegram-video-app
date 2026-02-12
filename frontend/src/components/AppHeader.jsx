import React from "react";
import { Search, X, User } from "lucide-react";

export default function AppHeader({ 
  isDesktop, searchTerm, setSearchTerm, 
  isMobileSearchVisible, setIsMobileSearchVisible,
  user, onProfileClick // 🟢 Added these props
}) {

  // 🟢 Helper to render the Profile/Login trigger
  const ProfileTrigger = () => (

    // 🟢 Logic: Only show logged in state if user AND user.id exist
  const isLoggedIn = user && (user.id || user.email);
  
    <button 
      onClick={onProfileClick} 
      style={{ 
        background: "none", border: "none", cursor: "pointer", 
        display: "flex", alignItems: "center", padding: "4px" 
      }}
    >
      {user ? (
        <div style={{ position: "relative" }}>
          <img 
            src={user.avatar_url || "/assets/default-avatar.png"} 
            alt="Profile"
            onError={(e) => { e.target.onerror = null; e.target.src = "/assets/default-avatar.png"; }}
            style={{ 
              width: isDesktop ? "36px" : "32px", 
              height: isDesktop ? "36px" : "32px", 
              borderRadius: "50%", border: "2px solid #ff0000", objectFit: "cover" 
            }} 
          />
          {/* Active indicator */}
          <div style={{ position: "absolute", bottom: 0, right: 0, width: "10px", height: "10px", background: "#34c759", border: "2px solid #000", borderRadius: "50%" }} />
        </div>
      ) : (
        <div style={{ 
          background: "#ff0000", color: "#fff", padding: "6px 14px", 
          borderRadius: "20px", fontSize: "12px", fontWeight: "800",
          boxShadow: "0 4px 10px rgba(255,0,0,0.3)" 
        }}>
          LOGIN
        </div>
      )}
    </button>
  );

  return (
    <>
      {/* DESKTOP HEADER */}
      {isDesktop && (
        <header style={{ 
          position: "sticky", top: 0, zIndex: 100, height: "70px",
          background: "rgba(0,0,0,0.85)", backdropFilter: "blur(20px)", 
          borderBottom: "1px solid #262626", padding: "0 40px",
          display: "flex", alignItems: "center", justifyContent: "space-between" 
        }}>
          <div style={{ userSelect: "none" }}>
            <h1 style={{ color: "#fff", fontSize: "24px", fontWeight: "900", letterSpacing: "-1px", margin: 0 }}>
              NAIJA<span style={{ color: "#ff0000" }}>HOMEMADE</span>
            </h1>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "25px" }}>
            <div style={{ display: "flex", alignItems: "center", background: "#1c1c1e", borderRadius: "20px", padding: "0 15px", width: "400px", border: "1px solid #333" }}>
              <Search size={18} color="#8e8e8e" />
              <input 
                type="text" placeholder="Search shots..." value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                style={{ background: "none", border: "none", color: "#fff", padding: "10px", width: "100%", outline: "none", fontSize: "14px" }} 
              />
              {searchTerm && <X size={16} color="#8e8e8e" style={{ cursor: "pointer" }} onClick={() => setSearchTerm("")} />}
            </div>
            
            {/* 🟢 Desktop Login/Profile */}
            <ProfileTrigger />
          </div>
        </header>
      )}

      {/* MOBILE SEARCH & BRANDING */}
      {!isDesktop && (
        <div style={{ 
          position: "sticky", top: 0, zIndex: 100,
          padding: "15px 15px 10px", display: "flex", alignItems: "center", 
          justifyContent: "space-between", background: "#000", minHeight: "50px",
          borderBottom: "1px solid #111"
        }}>
          {isMobileSearchVisible ? (
            <div style={{ display: "flex", alignItems: "center", flex: 1, background: "#1c1c1e", borderRadius: "8px", padding: "0 10px" }}>
              <Search size={16} color="#8e8e8e" />
              <input 
                autoFocus type="text" placeholder="Search..." value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
                style={{ background: "none", border: "none", color: "#fff", padding: "10px", width: "100%", outline: "none", fontSize: "14px" }} 
              />
              <X size={18} color="#8e8e8e" onClick={() => { setIsMobileSearchVisible(false); setSearchTerm(""); }} />
            </div>
          ) : (
            <>
              <h1 style={{ color: "#fff", fontSize: "18px", fontWeight: "900", margin: 0 }}>
                NAIJA<span style={{ color: "#ff0000" }}>HOMEMADE</span>
              </h1>
              <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                <Search size={22} color="#fff" onClick={() => setIsMobileSearchVisible(true)} style={{ cursor: "pointer" }} />
                
                {/* 🟢 Mobile Login/Profile */}
                <ProfileTrigger />
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}