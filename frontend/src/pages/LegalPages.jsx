import React, { useState, useEffect, useRef, useCallback } from "react";
import { 
  ArrowLeft, 
  Shield, 
  FileText, 
  Lock, 
  Eye, 
  Globe, 
  UserCheck, 
  Scale, 
  ChevronRight, 
  ChevronLeft,
  CheckCircle2, 
  Copy, 
  Check, 
  Calendar, 
  Clock, 
  ShieldCheck, 
  Share2 
} from "lucide-react";

// 🟢 Import legal content sections
import Terms from "./legal/Terms";
import Compliance2257 from "./legal/Compliance2257";
import AboutUs from "./legal/AboutUs";
import DMCA from "./legal/DMCA";
import Privacy from "./legal/Privacy";
import Cookies from "./legal/Cookies";

// 🟢 Central config
import { APP_CONFIG } from "../config";

const LEGAL_TABS = [
  { 
    id: "about", 
    label: "About Us", 
    shortLabel: "About",
    icon: Globe, 
    badge: "Company & Mission",
    subtitle: "Our story, vision, and creator community",
    readTime: "3 min read"
  },
  { 
    id: "terms", 
    label: "Terms & Conditions", 
    shortLabel: "Terms",
    icon: FileText, 
    badge: "User Agreement",
    subtitle: "Platform usage rules and user obligations",
    readTime: "8 min read"
  },
  { 
    id: "privacy", 
    label: "Privacy Notice", 
    shortLabel: "Privacy",
    icon: Lock, 
    badge: "Data Protection",
    subtitle: "How we collect, protect, and respect your data",
    readTime: "6 min read"
  },
  { 
    id: "cookies", 
    label: "Cookie Notice", 
    shortLabel: "Cookies",
    icon: Eye, 
    badge: "Tracking & Tech",
    subtitle: "Technologies and trackers used on the platform",
    readTime: "4 min read"
  },
  { 
    id: "dmca", 
    label: "DMCA Policy", 
    shortLabel: "DMCA",
    icon: Shield, 
    badge: "Copyright Notice",
    subtitle: "Copyright protection and takedown procedures",
    readTime: "4 min read"
  },
  { 
    id: "2257", 
    label: "18 U.S.C. § 2257", 
    shortLabel: "2257 Notice",
    icon: UserCheck, 
    badge: "Compliance Statement",
    subtitle: "Record-keeping compliance statement",
    readTime: "3 min read"
  }
];

export default function LegalPages({ onBack, initialPage = "terms" }) {
  const [activePage, setActivePage] = useState(initialPage);
  const [isDesktop, setIsDesktop] = useState(typeof window !== "undefined" ? window.innerWidth > 768 : true);
  const [copied, setCopied] = useState(false);

  // Refs for scroll and auto-centering
  const containerRef = useRef(null);
  const mobileNavRef = useRef(null);
  const tabRefs = useRef({});

  // Brand name format
  const brandName = (APP_CONFIG.appNamePrefix || "Naija").charAt(0).toUpperCase() + 
                    (APP_CONFIG.appNamePrefix || "Naija").slice(1).toLowerCase() + 
                    (APP_CONFIG.appNameSuffix || "Homemade").toLowerCase();

  // Sync with initialPage prop
  useEffect(() => {
    if (initialPage && initialPage !== activePage) {
      setActivePage(initialPage);
    }
  }, [initialPage]);

  // Window resize handler
  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth > 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // 🟢 Smoothly center the active tab in mobile horizontal scroll view
  const centerActiveTab = useCallback((pageId, smooth = true) => {
    const tabEl = tabRefs.current[pageId];
    const navEl = mobileNavRef.current;
    if (!tabEl || !navEl) return;

    const navWidth = navEl.clientWidth;
    const tabOffsetLeft = tabEl.offsetLeft;
    const tabWidth = tabEl.clientWidth;
    const targetScroll = tabOffsetLeft - (navWidth / 2) + (tabWidth / 2);

    navEl.scrollTo({
      left: Math.max(0, targetScroll),
      behavior: smooth ? "smooth" : "auto"
    });
  }, []);

  // Whenever active page changes: align mobile tab & scroll document container to top
  useEffect(() => {
    const timer = setTimeout(() => {
      centerActiveTab(activePage, true);
    }, 40);

    if (containerRef.current) {
      containerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }

    return () => clearTimeout(timer);
  }, [activePage, centerActiveTab]);

  const handleTabSelect = (tabId) => {
    setActivePage(tabId);
    window.history.replaceState(
      { ...(window.history.state || {}), legal: tabId }, 
      document.title, 
      `/?legal=${encodeURIComponent(tabId)}`
    );
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/?legal=${encodeURIComponent(activePage)}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  // Find active tab and adjacent tabs for bottom pagination
  const activeTabIndex = LEGAL_TABS.findIndex(t => t.id === activePage);
  const activeTabDetails = LEGAL_TABS[activeTabIndex] || LEGAL_TABS[0];
  const prevTab = activeTabIndex > 0 ? LEGAL_TABS[activeTabIndex - 1] : null;
  const nextTab = activeTabIndex < LEGAL_TABS.length - 1 ? LEGAL_TABS[activeTabIndex + 1] : null;

  const renderContent = () => {
    switch (activePage) {
      case "terms": return <Terms />;
      case "2257": return <Compliance2257 />;
      case "about": return <AboutUs />;
      case "dmca": return <DMCA />;
      case "privacy": return <Privacy />;
      case "cookies": return <Cookies />;
      default: 
        return (
          <div style={{ color: "#8e8e93", textAlign: "center", padding: "60px 0" }}>
            Content is being updated. Please check back shortly.
          </div>
        );
    }
  };

  const IconComponent = activeTabDetails.icon;

  return (
    <div ref={containerRef} className="legal-shell hide-scrollbar" style={containerStyle}>
      
      {/* 🟢 TOP BAR (Mobile) */}
      {!isDesktop && (
        <header style={mobileHeaderStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <button 
              onClick={onBack} 
              aria-label="Back" 
              style={mobileBackBtnStyle}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div style={{ fontSize: "11px", fontWeight: "700", letterSpacing: "0.08em", color: "var(--primary-color)", textTransform: "uppercase" }}>
                Legal Center
              </div>
              <h2 style={{ fontSize: "15px", margin: 0, fontWeight: "700", color: "#fff", lineHeight: "1.2" }}>
                {activeTabDetails.shortLabel}
              </h2>
            </div>
          </div>

          <button 
            onClick={handleCopyLink} 
            title="Share or copy policy link"
            style={headerActionBtnStyle}
          >
            {copied ? <Check size={16} color="#22c55e" /> : <Share2 size={16} />}
          </button>
        </header>
      )}

      {/* 🟢 MOBILE HORIZONTAL TABS (Auto-centered & sticky under header) */}
      {!isDesktop && (
        <div style={mobileNavWrapperStyle}>
          <nav 
            ref={mobileNavRef} 
            className="hide-scrollbar" 
            style={mobileNavStyle}
          >
            {LEGAL_TABS.map((tab) => {
              const TabIcon = tab.icon;
              const isActive = activePage === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={(el) => (tabRefs.current[tab.id] = el)}
                  onClick={() => handleTabSelect(tab.id)}
                  style={{
                    ...mobileTabItemStyle,
                    background: isActive 
                      ? "linear-gradient(135deg, var(--primary-color) 0%, #e02424 100%)" 
                      : "rgba(255, 255, 255, 0.05)",
                    color: isActive ? "#ffffff" : "#a1a1aa",
                    borderColor: isActive ? "rgba(255, 255, 255, 0.25)" : "rgba(255, 255, 255, 0.08)",
                    boxShadow: isActive ? "0 4px 16px var(--primary-glow)" : "none",
                    fontWeight: isActive ? "700" : "500",
                    transform: isActive ? "scale(1.02)" : "scale(1)"
                  }}
                >
                  <TabIcon size={14} strokeWidth={isActive ? 2.4 : 1.8} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      )}

      {/* 🟢 MAIN SPLIT LAYOUT */}
      <div style={{ ...layoutStyle, flexDirection: isDesktop ? "row" : "column" }}>
        
        {/* 🟢 DESKTOP SIDEBAR */}
        {isDesktop && (
          <aside style={sidebarStyle}>
            {/* Back Button */}
            <button 
              onClick={onBack} 
              style={desktopBackBtnStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.1)";
                e.currentTarget.style.transform = "translateX(-3px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255, 255, 255, 0.05)";
                e.currentTarget.style.transform = "translateX(0)";
              }}
            >
              <ArrowLeft size={16} />
              <span>Back to Website</span>
            </button>

            {/* Sidebar Title */}
            <div style={{ marginBottom: "24px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "var(--primary-color)", boxShadow: "0 0 8px var(--primary-color)" }} />
                <span style={{ fontSize: "11px", fontWeight: "800", letterSpacing: "0.12em", color: "#a1a1aa", textTransform: "uppercase" }}>
                  Policies & Legal
                </span>
              </div>
              <h2 style={{ fontSize: "22px", margin: 0, fontWeight: "900", color: "#ffffff", letterSpacing: "-0.02em" }}>
                Legal Center
              </h2>
            </div>

            {/* Desktop Tabs List */}
            <nav style={{ display: "flex", flexDirection: "column", gap: "6px", flex: 1 }}>
              {LEGAL_TABS.map((tab) => {
                const TabIcon = tab.icon;
                const isActive = activePage === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabSelect(tab.id)}
                    style={{
                      ...desktopTabItemStyle,
                      background: isActive 
                        ? "linear-gradient(90deg, rgba(255, 59, 48, 0.12) 0%, rgba(255, 255, 255, 0.03) 100%)" 
                        : "transparent",
                      borderColor: isActive ? "rgba(255, 59, 48, 0.35)" : "transparent",
                      boxShadow: isActive ? "0 4px 20px rgba(0, 0, 0, 0.25)" : "none",
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                        e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                        e.currentTarget.style.transform = "translateX(3px)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = "transparent";
                        e.currentTarget.style.borderColor = "transparent";
                        e.currentTarget.style.transform = "translateX(0)";
                      }
                    }}
                  >
                    {/* Icon container */}
                    <div style={{
                      ...tabIconBoxStyle,
                      background: isActive ? "var(--primary-color)" : "rgba(255, 255, 255, 0.06)",
                      color: isActive ? "#ffffff" : "#a1a1aa",
                      boxShadow: isActive ? "0 2px 10px var(--primary-glow)" : "none"
                    }}>
                      <TabIcon size={16} strokeWidth={isActive ? 2.5 : 2} />
                    </div>

                    {/* Label & Subtitle */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ 
                        fontSize: "14px", 
                        fontWeight: isActive ? "700" : "500", 
                        color: isActive ? "#ffffff" : "#d4d4d8",
                        lineHeight: "1.3"
                      }}>
                        {tab.label}
                      </div>
                      <div style={{ 
                        fontSize: "11px", 
                        color: isActive ? "rgba(255, 255, 255, 0.7)" : "#71717a", 
                        whiteSpace: "nowrap", 
                        overflow: "hidden", 
                        textOverflow: "ellipsis",
                        marginTop: "2px"
                      }}>
                        {tab.badge}
                      </div>
                    </div>

                    {/* Active chevron */}
                    {isActive && (
                      <ChevronRight size={16} color="var(--primary-color)" style={{ opacity: 0.9 }} />
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Sidebar Footer Card */}
            <div style={sidebarFooterBadgeStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
                <ShieldCheck size={18} color="#22c55e" />
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#ffffff" }}>
                  Verified & Compliant
                </span>
              </div>
              <p style={{ fontSize: "11px", color: "#a1a1aa", margin: 0, lineHeight: "1.5" }}>
                {brandName} complies with federal record-keeping, DMCA protection, and GDPR data privacy standards.
              </p>
            </div>
          </aside>
        )}

        {/* 🟢 MAIN DOCUMENT VIEW */}
        <main style={{ 
          flex: 1, 
          padding: isDesktop ? "44px 50px 80px" : "20px 16px 60px", 
          maxWidth: isDesktop ? "960px" : "100%",
          minWidth: 0
        }}>
          {/* Document Hero Header */}
          <div style={docHeroContainerStyle}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
              <div style={docTagStyle}>
                <IconComponent size={13} color="var(--primary-color)" />
                <span>{activeTabDetails.badge.toUpperCase()}</span>
              </div>

              {isDesktop && (
                <button 
                  onClick={handleCopyLink} 
                  style={copyLinkPillStyle}
                  title="Copy permanent link to this policy"
                >
                  {copied ? (
                    <>
                      <Check size={14} color="#22c55e" />
                      <span style={{ color: "#22c55e" }}>Link Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy Policy Link</span>
                    </>
                  )}
                </button>
              )}
            </div>

            <h1 style={docTitleStyle}>
              {activeTabDetails.label}
            </h1>

            <p style={docSubtitleStyle}>
              {activeTabDetails.subtitle}
            </p>

            {/* Metadata Pills */}
            <div style={metaPillsRowStyle}>
              <div style={metaPillStyle}>
                <Calendar size={13} color="#9ca3af" />
                <span>Updated Feb 2026</span>
              </div>
              <div style={metaPillStyle}>
                <Clock size={13} color="#9ca3af" />
                <span>{activeTabDetails.readTime}</span>
              </div>
              <div style={{ ...metaPillStyle, background: "rgba(34, 197, 94, 0.1)", color: "#4ade80", borderColor: "rgba(34, 197, 94, 0.2)" }}>
                <CheckCircle2 size={13} />
                <span>Legally Binding</span>
              </div>
            </div>

            {/* Decorative Divider */}
            <div style={heroDividerStyle} />
          </div>

          {/* Document Content Card */}
          <div style={{
            ...contentCardStyle,
            background: isDesktop ? "rgba(18, 18, 22, 0.75)" : "rgba(18, 18, 22, 0.4)",
            border: isDesktop ? "1px solid rgba(255, 255, 255, 0.08)" : "1px solid rgba(255, 255, 255, 0.05)",
            padding: isDesktop ? "44px 48px" : "22px 18px",
            boxShadow: isDesktop ? "0 24px 60px rgba(0, 0, 0, 0.45)" : "none"
          }}>
            <div className="legal-article-content selectable-text">
              {renderContent()}
            </div>
          </div>

          {/* 🟢 BOTTOM PAGINATION NAVIGATOR */}
          <div style={paginationRowStyle}>
            {prevTab ? (
              <button 
                onClick={() => handleTabSelect(prevTab.id)} 
                style={paginationCardStyle}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#a1a1aa", fontSize: "12px", fontWeight: "600" }}>
                  <ChevronLeft size={16} />
                  <span>Previous</span>
                </div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "#ffffff", marginTop: "4px" }}>
                  {prevTab.label}
                </div>
              </button>
            ) : <div style={{ flex: 1 }} />}

            {nextTab && (
              <button 
                onClick={() => handleTabSelect(nextTab.id)} 
                style={{ ...paginationCardStyle, textAlign: "right" }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.2)";
                  e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "rgba(255, 255, 255, 0.08)";
                  e.currentTarget.style.transform = "translateY(0)";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px", color: "#a1a1aa", fontSize: "12px", fontWeight: "600" }}>
                  <span>Next</span>
                  <ChevronRight size={16} />
                </div>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "#ffffff", marginTop: "4px" }}>
                  {nextTab.label}
                </div>
              </button>
            )}
          </div>

          {/* Legal Support Note */}
          <div style={footerSupportBoxStyle}>
            <Scale size={18} color="#a1a1aa" />
            <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa", lineHeight: "1.6" }}>
              Have questions or legal inquiries regarding our policies? Contact our legal & compliance team at{" "}
              <a href="mailto:legal@naijahomemade.com" style={{ color: "var(--primary-color)", textDecoration: "none", fontWeight: "600" }}>
                legal@naijahomemade.com
              </a>
            </p>
          </div>
        </main>
      </div>

      {/* 🟢 Sleek Scoped Styles */}
      <style>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

        .legal-shell {
          scroll-behavior: smooth;
        }

        .selectable-text {
          user-select: text !important;
          -webkit-user-select: text !important;
        }

        /* Scoped normalization for nested legal components */
        .legal-article-content > div {
          padding: 0 !important;
          margin: 0 !important;
          max-width: 100% !important;
          background: transparent !important;
        }

        .legal-article-content h1 {
          display: none; /* Hero header already provides crisp title */
        }

        .legal-article-content h2 {
          color: #ffffff !important;
          font-size: 19px !important;
          font-weight: 700 !important;
          letter-spacing: -0.01em !important;
          margin-top: 36px !important;
          margin-bottom: 14px !important;
          padding-bottom: 8px !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .legal-article-content h3 {
          color: #f4f4f5 !important;
          font-size: 16px !important;
          font-weight: 600 !important;
          margin-top: 24px !important;
          margin-bottom: 10px !important;
        }

        .legal-article-content p {
          color: #d4d4d8 !important;
          line-height: 1.75 !important;
          font-size: 14.5px !important;
          margin-bottom: 16px !important;
        }

        .legal-article-content strong {
          color: #ffffff !important;
          font-weight: 600 !important;
        }

        .legal-article-content ul, .legal-article-content ol {
          color: #d4d4d8 !important;
          padding-left: 20px !important;
          margin-bottom: 20px !important;
          line-height: 1.7 !important;
          font-size: 14.5px !important;
        }

        .legal-article-content li {
          margin-bottom: 8px !important;
        }

        .legal-article-content hr {
          border: 0 !important;
          border-top: 1px solid rgba(255, 255, 255, 0.08) !important;
          margin: 32px 0 !important;
        }

        /* Sleek card highlight boxes */
        .legal-article-content div[style*="background: rgb(26, 26, 26)"],
        .legal-article-content div[style*="background: #1a1a1a"] {
          background: rgba(255, 255, 255, 0.03) !important;
          border: 1px solid rgba(255, 255, 255, 0.09) !important;
          border-radius: 14px !important;
          padding: 22px !important;
          margin: 24px 0 !important;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2) !important;
        }

        /* Sleek tables (like Cookies.jsx) */
        .legal-article-content table {
          width: 100% !important;
          border-collapse: separate !important;
          border-spacing: 0 !important;
          border-radius: 12px !important;
          overflow: hidden !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          margin: 20px 0 !important;
          font-size: 13.5px !important;
        }

        .legal-article-content th {
          background: rgba(255, 255, 255, 0.05) !important;
          color: #ffffff !important;
          font-weight: 700 !important;
          padding: 14px 16px !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
        }

        .legal-article-content td {
          padding: 12px 16px !important;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04) !important;
          color: #d4d4d8 !important;
        }

        .legal-article-content tr:last-child td {
          border-bottom: none !important;
        }

        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .legal-article-content {
          animation: fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
      `}</style>
    </div>
  );
}

// 🖌 Centralized Styles
const containerStyle = { 
  minHeight: "100vh", 
  background: "var(--bg-color, #0a0a0c)", 
  color: "#ffffff", 
  position: "fixed", 
  inset: 0, 
  zIndex: 100000, 
  overflowY: "auto",
  overscrollBehaviorY: "contain"
};

const mobileHeaderStyle = { 
  display: "flex", 
  alignItems: "center", 
  justifyContent: "space-between", 
  padding: "12px 16px", 
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)", 
  position: "sticky", 
  top: 0, 
  background: "rgba(10, 10, 14, 0.88)", 
  backdropFilter: "blur(20px) saturate(180%)", 
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  zIndex: 40 
};

const mobileBackBtnStyle = { 
  background: "rgba(255, 255, 255, 0.06)", 
  border: "1px solid rgba(255, 255, 255, 0.1)", 
  borderRadius: "50%", 
  color: "#ffffff", 
  cursor: "pointer", 
  display: "flex", 
  alignItems: "center", 
  justifyContent: "center", 
  width: "34px", 
  height: "34px", 
  padding: 0 
};

const headerActionBtnStyle = {
  background: "rgba(255, 255, 255, 0.06)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  borderRadius: "50%",
  color: "#d4d4d8",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "34px",
  height: "34px",
  padding: 0
};

const mobileNavWrapperStyle = {
  position: "sticky",
  top: "58px",
  zIndex: 30,
  background: "rgba(12, 12, 16, 0.92)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
  boxShadow: "0 4px 20px rgba(0, 0, 0, 0.3)"
};

const mobileNavStyle = { 
  display: "flex", 
  overflowX: "auto", 
  padding: "10px 16px", 
  gap: "8px", 
  whiteSpace: "nowrap",
  scrollBehavior: "smooth"
};

const mobileTabItemStyle = { 
  display: "inline-flex", 
  alignItems: "center", 
  gap: "7px", 
  padding: "7px 15px", 
  borderRadius: "9999px", 
  border: "1px solid", 
  fontSize: "13px", 
  cursor: "pointer", 
  transition: "all 0.22s cubic-bezier(0.16, 1, 0.3, 1)", 
  flexShrink: 0 
};

const layoutStyle = { 
  display: "flex", 
  minHeight: "100vh", 
  maxWidth: "1340px", 
  margin: "0 auto" 
};

const sidebarStyle = { 
  width: "320px", 
  position: "sticky", 
  top: 0, 
  height: "100vh", 
  overflowY: "auto", 
  padding: "32px 20px 32px 28px", 
  borderRight: "1px solid rgba(255, 255, 255, 0.07)",
  display: "flex",
  flexDirection: "column",
  flexShrink: 0
};

const desktopBackBtnStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "8px 16px",
  borderRadius: "9999px",
  background: "rgba(255, 255, 255, 0.05)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  color: "#d4d4d8",
  fontSize: "13px",
  fontWeight: "600",
  cursor: "pointer",
  marginBottom: "28px",
  alignSelf: "flex-start",
  transition: "all 0.2s ease"
};

const desktopTabItemStyle = { 
  display: "flex", 
  alignItems: "center", 
  gap: "12px", 
  width: "100%", 
  padding: "11px 14px", 
  borderRadius: "12px", 
  border: "1px solid", 
  color: "#ffffff", 
  cursor: "pointer", 
  textAlign: "left", 
  transition: "all 0.22s cubic-bezier(0.16, 1, 0.3, 1)" 
};

const tabIconBoxStyle = {
  width: "34px",
  height: "34px",
  borderRadius: "10px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
  transition: "all 0.2s ease"
};

const sidebarFooterBadgeStyle = {
  marginTop: "24px",
  padding: "16px",
  borderRadius: "14px",
  background: "rgba(255, 255, 255, 0.02)",
  border: "1px solid rgba(255, 255, 255, 0.06)"
};

const docHeroContainerStyle = {
  marginBottom: "28px"
};

const docTagStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "4px 10px",
  borderRadius: "9999px",
  background: "rgba(255, 59, 48, 0.12)",
  border: "1px solid rgba(255, 59, 48, 0.25)",
  fontSize: "11px",
  fontWeight: "800",
  letterSpacing: "0.08em",
  color: "#ffffff"
};

const copyLinkPillStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "6px 14px",
  borderRadius: "9999px",
  background: "rgba(255, 255, 255, 0.05)",
  border: "1px solid rgba(255, 255, 255, 0.1)",
  color: "#d4d4d8",
  fontSize: "12px",
  fontWeight: "600",
  cursor: "pointer",
  transition: "all 0.2s"
};

const docTitleStyle = { 
  fontSize: "clamp(26px, 4vw, 36px)", 
  fontWeight: "900", 
  margin: "0 0 10px 0", 
  letterSpacing: "-0.03em",
  lineHeight: "1.15",
  background: "linear-gradient(135deg, #ffffff 40%, #a1a1aa 100%)",
  WebkitBackgroundClip: "text",
  WebkitTextFillColor: "transparent"
};

const docSubtitleStyle = {
  fontSize: "15px",
  color: "#a1a1aa",
  margin: "0 0 18px 0",
  lineHeight: "1.5"
};

const metaPillsRowStyle = {
  display: "flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "8px",
  marginBottom: "20px"
};

const metaPillStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  padding: "4px 10px",
  borderRadius: "8px",
  background: "rgba(255, 255, 255, 0.04)",
  border: "1px solid rgba(255, 255, 255, 0.07)",
  fontSize: "12px",
  fontWeight: "500",
  color: "#d4d4d8"
};

const heroDividerStyle = {
  height: "1px",
  background: "linear-gradient(90deg, var(--primary-color) 0%, rgba(255, 255, 255, 0.12) 35%, transparent 100%)",
  marginTop: "16px"
};

const contentCardStyle = { 
  borderRadius: "20px",
  backdropFilter: "blur(16px)",
  WebkitBackdropFilter: "blur(16px)"
};

const paginationRowStyle = {
  display: "flex",
  alignItems: "stretch",
  justifyContent: "space-between",
  gap: "16px",
  marginTop: "32px",
  flexWrap: "wrap"
};

const paginationCardStyle = {
  flex: "1 1 200px",
  padding: "16px 20px",
  borderRadius: "14px",
  background: "rgba(255, 255, 255, 0.03)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  cursor: "pointer",
  textAlign: "left",
  transition: "all 0.22s ease"
};

const footerSupportBoxStyle = {
  marginTop: "32px",
  padding: "18px 22px",
  borderRadius: "14px",
  background: "rgba(255, 255, 255, 0.02)",
  border: "1px solid rgba(255, 255, 255, 0.06)",
  display: "flex",
  alignItems: "center",
  gap: "14px"
};