import React, { useState, useEffect } from "react";
import { ArrowLeft, Shield, FileText, Lock, AlertTriangle, Eye, Globe, UserCheck, Scale } from "lucide-react";

// 🟢 Import your separate text files here
import Terms from "./legal/Terms";
import Compliance2257 from "./legal/Compliance2257";
import AboutUs from "./legal/AboutUs";
import DMCA from "./legal/DMCA";
import Privacy from "./legal/Privacy";
import Cookies from "./legal/Cookies";
import HTMLSitemap from "./legal/HTMLSitemap";

const LEGAL_TABS = [
  { id: "about", label: "About Us", icon: <Globe size={16} /> },
  { id: "terms", label: "Terms & Conditions", icon: <FileText size={16} /> },
  { id: "privacy", label: "Privacy Notice", icon: <Lock size={16} /> },
  { id: "cookies", label: "Cookie Notice", icon: <Eye size={16} /> },
  { id: "dmca", label: "DMCA", icon: <Shield size={16} /> },
  { id: "2257", label: "18 U.S.C. 2257", icon: <UserCheck size={16} /> },
  { id: "sitemap", label: "Sitemap", icon: <Globe size={16} /> }
];

export default function LegalPages({ onBack, initialPage = "terms" }) {
  const [activePage, setActivePage] = useState(initialPage);
  const [isDesktop, setIsDesktop] = useState(window.innerWidth > 768);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener("resize", handleResize);
    window.scrollTo(0, 0);
    return () => window.removeEventListener("resize", handleResize);
  }, [activePage]);

  const renderContent = () => {
    switch (activePage) {
      case "terms": return <Terms />;
      case "2257": return <Compliance2257 />;
      case "about": return <AboutUs />;
      case "dmca": return <DMCA />;
      case "privacy": return <Privacy />;
      case "cookies": return <Cookies />;
      case "sitemap": return <HTMLSitemap />;
      default: 
        return <div style={{ color: "#888", textAlign: "center", padding: "40px 0" }}>Content being updated. Please check back later.</div>;
    }
  };

  const activeTabDetails = LEGAL_TABS.find(tab => tab.id === activePage) || LEGAL_TABS[0];

  return (
    <div style={containerStyle}>
      {/* 🟢 Mobile Header (Sticks to top) */}
      {!isDesktop && (
        <div style={mobileHeaderStyle}>
          <button onClick={onBack} style={iconBtnStyle}><ArrowLeft size={24} /></button>
          <h2 style={{ fontSize: "18px", margin: 0, fontWeight: "700" }}>Legal & Info</h2>
          <div style={{ width: "24px" }} />
        </div>
      )}

      {/* 🟢 Mobile Horizontal Scrollable Nav (Sticks right under header) */}
      {!isDesktop && (
        <nav className="hide-scrollbar" style={mobileNavContainerStyle}>
          {LEGAL_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActivePage(tab.id);
                window.history.replaceState({}, document.title, `/?legal=${tab.id}`);
              }}
              style={{
                ...mobileTabStyle,
                background: activePage === tab.id ? "var(--primary-color)" : "#1a1a1a",
                color: activePage === tab.id ? "#fff" : "#aaa",
              }}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      )}

      <div style={{ ...layoutStyle, flexDirection: isDesktop ? "row" : "column" }}>
        
        {/* 🟢 Desktop Sidebar (Hidden on mobile) */}
        {isDesktop && (
          <aside style={{ ...sidebarStyle, width: "280px", position: "sticky", top: "0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "30px", padding: "0 15px" }}>
              <button onClick={onBack} style={iconBtnStyle}><ArrowLeft size={24} /></button>
              <h2 style={{ fontSize: "20px", margin: 0 }}>Legal</h2>
            </div>
            
            <nav style={navStyle}>
              {LEGAL_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActivePage(tab.id);
                    window.history.replaceState({}, document.title, `/?legal=${tab.id}`);
                  }}
                  style={{
                    ...desktopTabBtnStyle,
                    background: activePage === tab.id ? "rgba(255,255,255,0.1)" : "transparent",
                    color: activePage === tab.id ? "var(--primary-color)" : "#ccc",
                    borderLeft: activePage === tab.id ? "3px solid var(--primary-color)" : "3px solid transparent"
                  }}
                >
                  {tab.icon}
                  <span style={{ fontWeight: activePage === tab.id ? "700" : "500" }}>{tab.label}</span>
                </button>
              ))}
            </nav>
          </aside>
        )}

        {/* 🟢 Main Content Area */}
        <main style={{ flex: 1, padding: isDesktop ? "40px" : "20px 15px", maxWidth: "800px" }}>
          <div style={{
            ...contentBoxStyle, 
            background: isDesktop ? "#111" : "transparent", 
            padding: isDesktop ? "40px" : "10px 0",
            border: isDesktop ? "1px solid #222" : "none"
          }}>
            <h1 style={{ 
              fontSize: isDesktop ? "28px" : "24px", 
              fontWeight: "900", 
              borderBottom: "1px solid #333", 
              paddingBottom: "15px", 
              marginBottom: "25px", 
              color: "#fff", 
              animation: "fadeIn 0.3s ease-in" 
            }}>
              {activeTabDetails.label}
            </h1>
            
            <div style={{ animation: "fadeIn 0.4s ease-in", lineHeight: "1.6", color: "#ccc" }}>
              {renderContent()}
            </div>
          </div>
        </main>
      </div>

      {/* 🟢 CSS to hide the ugly scrollbar on the mobile swipe menu */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

// 🖌 Styles
const containerStyle = { minHeight: "100vh", background: "var(--bg-color)", color: "#fff", position: "absolute", inset: 0, zIndex: 100000, overflowY: "auto" };
const mobileHeaderStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 20px", borderBottom: "1px solid #222", position: "sticky", top: 0, background: "rgba(10,10,10,0.95)", backdropFilter: "blur(10px)", zIndex: 10 };

// 🟢 Mobile Specific Nav Styles
const mobileNavContainerStyle = { display: "flex", overflowX: "auto", padding: "12px 15px", gap: "10px", background: "rgba(10,10,10,0.95)", backdropFilter: "blur(10px)", position: "sticky", top: "54px", zIndex: 9, borderBottom: "1px solid #222", whiteSpace: "nowrap" };
const mobileTabStyle = { display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderRadius: "20px", border: "none", fontSize: "14px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s ease", flexShrink: 0 };

const iconBtnStyle = { background: "none", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 };
const layoutStyle = { display: "flex", minHeight: "100vh", maxWidth: "1200px", margin: "0 auto" };
const sidebarStyle = { padding: "30px 0", borderRight: "1px solid #222", height: "100vh", overflowY: "auto" };
const navStyle = { display: "flex", flexDirection: "column", gap: "5px" };
const desktopTabBtnStyle = { display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "14px 25px", border: "none", background: "none", color: "#fff", fontSize: "15px", cursor: "pointer", textAlign: "left", transition: "all 0.2s" };
const contentBoxStyle = { borderRadius: "16px" };