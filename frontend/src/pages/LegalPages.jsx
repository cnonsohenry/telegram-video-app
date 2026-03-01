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
// import Privacy from "./legal/Privacy";
// import DMCA from "./legal/DMCA";
// ... import the rest as you create them

const LEGAL_TABS = [
  { id: "about", label: "About Us", icon: <Globe size={18} /> },
  { id: "terms", label: "Terms & Conditions", icon: <FileText size={18} /> },
  { id: "privacy", label: "Privacy Notice", icon: <Lock size={18} /> },
  { id: "cookies", label: "Cookie Notice", icon: <Eye size={18} /> },
  { id: "dmca", label: "DMCA", icon: <Shield size={18} /> },
  { id: "2257", label: "18 U.S.C. 2257", icon: <UserCheck size={18} /> },
  { id: "sitemap", label: "Sitemap", icon: <Globe size={18} /> }
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

  // 🟢 Dynamically render the correct component based on state
  const renderContent = () => {
    switch (activePage) {
      case "terms": return <Terms />;
      case "2257": return <Compliance2257 />;
      case "about": return <AboutUs />;
      case "dmca": return <DMCA />;
      case "privacy": return <Privacy />;
      case "cookies": return <Cookies />;
      case "sitemap": return <HTMLSitemap />;
      // case "privacy": return <Privacy />;
      // case "dmca": return <DMCA />;
      // Add the rest of your cases here as you build the files
      default: 
        return <div style={{ color: "#888" }}>Content being updated. Please check back later.</div>;
    }
  };

  // Get the title for the active tab to display at the top of the text
  const activeTabDetails = LEGAL_TABS.find(tab => tab.id === activePage) || LEGAL_TABS[0];

  return (
    <div style={containerStyle}>
      {/* 🟢 Mobile Header */}
      {!isDesktop && (
        <div style={mobileHeaderStyle}>
          <button onClick={onBack} style={iconBtnStyle}><ArrowLeft size={24} /></button>
          <h2 style={{ fontSize: "18px", margin: 0, fontWeight: "700" }}>Legal & Info</h2>
          <div style={{ width: "24px" }} />
        </div>
      )}

      <div style={{ ...layoutStyle, flexDirection: isDesktop ? "row" : "column" }}>
        
        {/* 🟢 Sidebar Navigation */}
        <aside style={{ ...sidebarStyle, width: isDesktop ? "280px" : "100%", position: isDesktop ? "sticky" : "static", top: "0" }}>
          {isDesktop && (
            <div style={{ display: "flex", alignItems: "center", gap: "15px", marginBottom: "30px", padding: "0 15px" }}>
              <button onClick={onBack} style={iconBtnStyle}><ArrowLeft size={24} /></button>
              <h2 style={{ fontSize: "20px", margin: 0 }}>Legal</h2>
            </div>
          )}
          
          <nav style={navStyle}>
            {LEGAL_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActivePage(tab.id);
                  // Update URL so they can share direct links (e.g., /?legal=dmca)
                  window.history.replaceState({}, document.title, `/?legal=${tab.id}`);
                }}
                style={{
                  ...tabBtnStyle,
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

        {/* 🟢 Main Content Area */}
        <main style={{ flex: 1, padding: isDesktop ? "40px" : "20px", maxWidth: "800px" }}>
          <div style={contentBoxStyle}>
            {/* The Title Header */}
            <h1 style={{ fontSize: "28px", fontWeight: "900", borderBottom: "1px solid #333", paddingBottom: "15px", marginBottom: "25px", color: "#fff", animation: "fadeIn 0.3s ease-in" }}>
              {activeTabDetails.label}
            </h1>
            
            {/* The Injected File Content */}
            <div style={{ animation: "fadeIn 0.4s ease-in" }}>
              {renderContent()}
            </div>
          </div>
        </main>

      </div>
    </div>
  );
}

// 🖌 Styles
const containerStyle = { minHeight: "100vh", background: "var(--bg-color)", color: "#fff", position: "absolute", inset: 0, zIndex: 100000, overflowY: "auto" };
const mobileHeaderStyle = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "15px 20px", borderBottom: "1px solid #222", position: "sticky", top: 0, background: "rgba(10,10,10,0.9)", backdropFilter: "blur(10px)", zIndex: 10 };
const iconBtnStyle = { background: "none", border: "none", color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 };
const layoutStyle = { display: "flex", minHeight: "100vh", maxWidth: "1200px", margin: "0 auto" };
const sidebarStyle = { padding: "30px 0", borderRight: "1px solid #222", height: "100vh", overflowY: "auto" };
const navStyle = { display: "flex", flexDirection: "column", gap: "5px" };
const tabBtnStyle = { display: "flex", alignItems: "center", gap: "12px", width: "100%", padding: "14px 25px", border: "none", background: "none", color: "#fff", fontSize: "15px", cursor: "pointer", textAlign: "left", transition: "all 0.2s" };
const contentBoxStyle = { background: "#111", padding: "40px", borderRadius: "16px", border: "1px solid #222" };