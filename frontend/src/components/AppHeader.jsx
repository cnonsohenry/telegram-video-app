import React from "react";
import { Search, X } from "lucide-react";

export default function AppHeader({ 
  isDesktop, searchTerm, setSearchTerm, 
  isMobileSearchVisible, setIsMobileSearchVisible 
}) {
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
          <div style={{ display: "flex", alignItems: "center", background: "#1c1c1e", borderRadius: "20px", padding: "0 15px", width: "400px", border: "1px solid #333" }}>
            <Search size={18} color="#8e8e8e" />
            <input 
              type="text" placeholder="Search suggestions..." value={searchTerm} 
              onChange={(e) => setSearchTerm(e.target.value)} 
              style={{ background: "none", border: "none", color: "#fff", padding: "10px", width: "100%", outline: "none", fontSize: "14px" }} 
            />
            {searchTerm && <X size={16} color="#8e8e8e" style={{ cursor: "pointer" }} onClick={() => setSearchTerm("")} />}
          </div>
        </header>
      )}

      {/* MOBILE SEARCH & BRANDING */}
      {!isDesktop && (
        <div style={{ padding: "15px 15px 10px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#000", minHeight: "50px" }}>
          {isMobileSearchVisible ? (
            <div style={{ display: "flex", alignItems: "center", flex: 1, background: "#1c1c1e", borderRadius: "8px", padding: "0 10px" }}>
              <Search size={16} color="#8e8e8e" />
              <input 
                autoFocus type="text" placeholder="Search grid..." value={searchTerm} 
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
              <Search size={22} color="#fff" onClick={() => setIsMobileSearchVisible(true)} style={{ cursor: "pointer" }} />
            </>
          )}
        </div>
      )}
    </>
  );
}