import React from "react";
import { 
  Home, 
  Compass, 
  Users, 
  Sparkles, 
  User, 
  MoreHorizontal 
} from "lucide-react";
import TwitterVerifiedBadge from "./TwitterVerifiedBadge";
import { APP_CONFIG } from "../config";

/**
 * Reusable Desktop Left Sidebar (Twitter/X style navigation rail)
 * Used across Explore, Profile, and Creator Profile views.
 */
export default function DesktopLeftSidebar({
  user = null,
  activeNav = "explore", // "home" | "explore" | "community" | "creators" | "profile"
  activeTab = "for_you", // for_you | community
  onTabSwitch = null,
  communityCount = 0,
  selectedCategory = null,
  onSelectCategory = null,
  onNavigateHome = null,
  onProfileClick = null,
  onOpenDiscover = null,
  onPostClick = null,
  style = {}
}) {
  const categories = [
    { id: "trends", label: "Trends" },
    { id: "knacks", label: "Knacks" },
    { id: "hotties", label: "Hotties" },
    { id: "baddies", label: "Baddies" },
    { id: "amateurs", label: "Amateurs" },
    { id: "college", label: "College" },
    { id: "premium", label: "VIP Club", badge: "VIP" }
  ];

  const isLoggedIn = Boolean(user && (user.id || user.email));

  const handleHome = () => {
    if (onNavigateHome) {
      onNavigateHome();
    } else {
      window.location.href = "/";
    }
  };

  const handleExplore = () => {
    if (onSelectCategory) onSelectCategory(null);
    if (onTabSwitch) onTabSwitch("for_you");
    if (!onTabSwitch && !onSelectCategory) {
      window.location.href = "/?tab=explore";
    }
  };

  const handleCommunity = () => {
    if (onTabSwitch) {
      onTabSwitch("community");
    } else {
      window.location.href = "/?tab=explore&explore_tab=community";
    }
  };

  const isExploreActive = activeNav === "explore" && !selectedCategory && activeTab === "for_you";
  const isCommunityActive = (activeNav === "explore" && activeTab === "community") || activeNav === "community";
  const isProfileActive = activeNav === "profile";
  const isHomeActive = activeNav === "home";
  const isCreatorsActive = activeNav === "creators";

  return (
    <aside style={{ ...desktopLeftRailStyle, ...style }} className="custom-scrollbar">
      {/* Top Section: Logo + Navigation Menus + Categories */}
      <div style={{ display: "flex", flexDirection: "column" }}>
        
        {/* Brand / Logo */}
        <div 
          onClick={handleHome}
          style={desktopBrandHeaderStyle}
          title="NaijaHomemade"
        >
          <div style={{ display: "flex", alignItems: "center", gap: "2px" }}>
            <span style={{ fontSize: "20px", fontWeight: "900", color: "#d4d4d8", letterSpacing: "-0.4px" }}>
              Naija
            </span>
            <span style={{ fontSize: "20px", fontWeight: "900", color: "var(--primary-color, #f43f5e)", letterSpacing: "-0.4px" }}>
              homemade
            </span>
          </div>
        </div>

        {/* Primary Menus */}
        <nav style={{ display: "flex", flexDirection: "column", gap: "3px", marginTop: "14px" }}>
          {/* Home */}
          <button
            type="button"
            onClick={handleHome}
            style={{
              ...desktopNavBtnStyle,
              background: isHomeActive ? "rgba(255, 255, 255, 0.1)" : "transparent"
            }}
            onMouseEnter={(e) => {
              if (!isHomeActive) e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            }}
            onMouseLeave={(e) => {
              if (!isHomeActive) e.currentTarget.style.background = "transparent";
            }}
          >
            <div style={desktopNavIconBox}>
              <Home size={20} color="#a1a1aa" strokeWidth={isHomeActive ? 2.2 : 1.8} />
            </div>
            <span style={{
              ...desktopNavLabelStyle,
              fontWeight: isHomeActive ? "800" : "600",
              color: isHomeActive ? "#f4f4f5" : "#d4d4d8"
            }}>
              Home
            </span>
          </button>

          {/* Explore */}
          <button
            type="button"
            onClick={handleExplore}
            style={{
              ...desktopNavBtnStyle,
              background: isExploreActive ? "rgba(255, 255, 255, 0.1)" : "transparent"
            }}
            onMouseEnter={(e) => {
              if (!isExploreActive) e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            }}
            onMouseLeave={(e) => {
              if (!isExploreActive) e.currentTarget.style.background = "transparent";
            }}
          >
            <div style={desktopNavIconBox}>
              <Compass size={20} color="#a1a1aa" strokeWidth={isExploreActive ? 2.2 : 1.8} />
            </div>
            <span style={{
              ...desktopNavLabelStyle,
              fontWeight: isExploreActive ? "800" : "600",
              color: isExploreActive ? "#f4f4f5" : "#d4d4d8"
            }}>
              Explore
            </span>
          </button>

          {/* Community */}
          <button
            type="button"
            onClick={handleCommunity}
            style={{
              ...desktopNavBtnStyle,
              background: isCommunityActive ? "rgba(255, 255, 255, 0.1)" : "transparent"
            }}
            onMouseEnter={(e) => {
              if (!isCommunityActive) e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            }}
            onMouseLeave={(e) => {
              if (!isCommunityActive) e.currentTarget.style.background = "transparent";
            }}
          >
            <div style={desktopNavIconBox}>
              <Users size={20} color="#a1a1aa" strokeWidth={isCommunityActive ? 2.2 : 1.8} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
              <span style={{
                ...desktopNavLabelStyle,
                fontWeight: isCommunityActive ? "800" : "600",
                color: isCommunityActive ? "#f4f4f5" : "#d4d4d8"
              }}>
                Community
              </span>
              {communityCount > 0 && (
                <span style={communityCountPillStyle}>
                  {communityCount}
                </span>
              )}
            </div>
          </button>

          {/* Creators */}
          <button
            type="button"
            onClick={() => onOpenDiscover && onOpenDiscover()}
            style={{
              ...desktopNavBtnStyle,
              background: isCreatorsActive ? "rgba(255, 255, 255, 0.1)" : "transparent"
            }}
            onMouseEnter={(e) => {
              if (!isCreatorsActive) e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            }}
            onMouseLeave={(e) => {
              if (!isCreatorsActive) e.currentTarget.style.background = "transparent";
            }}
          >
            <div style={desktopNavIconBox}>
              <Sparkles size={20} color="#a1a1aa" strokeWidth={isCreatorsActive ? 2.2 : 1.8} />
            </div>
            <span style={{
              ...desktopNavLabelStyle,
              fontWeight: isCreatorsActive ? "800" : "600",
              color: isCreatorsActive ? "#f4f4f5" : "#d4d4d8"
            }}>
              Creators
            </span>
          </button>

          {/* Profile / Studio */}
          <button
            type="button"
            onClick={() => onProfileClick && onProfileClick()}
            style={{
              ...desktopNavBtnStyle,
              background: isProfileActive ? "rgba(255, 255, 255, 0.1)" : "transparent"
            }}
            onMouseEnter={(e) => {
              if (!isProfileActive) e.currentTarget.style.background = "rgba(255, 255, 255, 0.08)";
            }}
            onMouseLeave={(e) => {
              if (!isProfileActive) e.currentTarget.style.background = "transparent";
            }}
          >
            <div style={desktopNavIconBox}>
              <User size={20} color="#a1a1aa" strokeWidth={isProfileActive ? 2.2 : 1.8} />
            </div>
            <span style={{
              ...desktopNavLabelStyle,
              fontWeight: isProfileActive ? "800" : "600",
              color: isProfileActive ? "#f4f4f5" : "#d4d4d8"
            }}>
              {user ? (user.is_creator || user.role === "creator" ? "Creator Studio" : "Profile") : "Sign In"}
            </span>
          </button>
        </nav>

        {/* Divider */}
        <div style={desktopNavDividerStyle} />

        {/* Categories Section */}
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={desktopSectionHeaderStyle}>
            <span>CATEGORIES</span>
            {selectedCategory && onSelectCategory && (
              <button
                type="button"
                onClick={() => onSelectCategory(null)}
                style={desktopClearCategoryBtn}
              >
                Reset
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            {categories.map((cat) => {
              const isSelected = selectedCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    if (onSelectCategory) {
                      onSelectCategory(cat.id);
                    } else {
                      window.location.href = `/?tab=explore&category=${cat.id}`;
                    }
                  }}
                  style={{
                    ...desktopCategoryBtnStyle,
                    background: isSelected ? "rgba(255, 255, 255, 0.08)" : "transparent",
                    color: isSelected ? "#d4d4d8" : "#8e8e93",
                    borderLeft: isSelected ? "3px solid #d4d4d8" : "3px solid transparent"
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "rgba(255, 255, 255, 0.04)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{ fontSize: "14px", fontWeight: isSelected ? "700" : "500" }}>
                    {cat.label}
                  </span>

                  {cat.badge && (
                    <span style={{
                      fontSize: "10px",
                      fontWeight: "800",
                      padding: "2px 6px",
                      borderRadius: "6px",
                      background: "rgba(255, 215, 0, 0.15)",
                      color: "#FFD700"
                    }}>
                      {cat.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Twitter-style Large "Post" Button */}
        <button
          type="button"
          onClick={() => onPostClick && onPostClick()}
          style={desktopPostBtnStyle}
          title="Post a new video"
        >
          <span>Post</span>
        </button>
      </div>

      {/* Bottom User Profile Section */}
      <div style={{ marginTop: "24px" }}>
        {isLoggedIn ? (
          <div 
            onClick={() => onProfileClick && onProfileClick()}
            style={desktopUserPillStyle}
            title={`Logged in as ${user.display_name || user.username || "Creator"}`}
          >
            <img 
              src={user.avatar_url || (user.id ? `${APP_CONFIG.apiUrl}/avatar.jpg?user_id=${user.id}` : "/assets/default-avatar.png")} 
              alt="User Avatar"
              loading="lazy"
              decoding="async"
              onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
              style={desktopUserPillAvatar}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                <span style={desktopUserPillName}>
                  {user.display_name || user.username || "Member"}
                </span>
                {(user.is_creator || user.role === "creator") && (
                  <TwitterVerifiedBadge size={14} style={{ flexShrink: 0 }} />
                )}
              </div>
              <span style={desktopUserPillHandle}>
                @{user.username || "user"}
              </span>
            </div>
            <MoreHorizontal size={18} color="#71767b" />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onProfileClick && onProfileClick()}
            style={desktopLoginPillBtn}
          >
            <User size={16} />
            <span>Log In / Sign Up</span>
          </button>
        )}
      </div>
    </aside>
  );
}

// 🟢 STYLES
const desktopLeftRailStyle = {
  width: "260px",
  height: "100vh",
  overflowY: "auto",
  position: "sticky",
  top: 0,
  flexShrink: 0,
  borderRight: "1px solid var(--border-color)",
  padding: "16px 14px 20px 14px",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  boxSizing: "border-box"
};

const desktopBrandHeaderStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "8px 12px",
  cursor: "pointer",
  borderRadius: "9999px",
  transition: "background 0.2s ease",
  userSelect: "none"
};

const desktopNavBtnStyle = {
  display: "flex",
  alignItems: "center",
  gap: "16px",
  padding: "12px 16px",
  width: "100%",
  border: "none",
  background: "transparent",
  borderRadius: "9999px",
  cursor: "pointer",
  transition: "background 0.2s ease",
  textAlign: "left",
  boxSizing: "border-box"
};

const desktopNavIconBox = {
  width: "26px",
  height: "26px",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0
};

const desktopNavLabelStyle = {
  fontSize: "17px",
  fontWeight: "600",
  color: "#d4d4d8",
  letterSpacing: "0.2px"
};

const desktopNavDividerStyle = {
  height: "1px",
  background: "var(--border-color)",
  margin: "14px 8px 12px 8px"
};

const desktopSectionHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 14px 8px 14px",
  fontSize: "11px",
  fontWeight: "800",
  color: "#71767b",
  letterSpacing: "0.8px"
};

const desktopClearCategoryBtn = {
  background: "none",
  border: "none",
  color: "#71767b",
  fontSize: "11px",
  fontWeight: "700",
  cursor: "pointer",
  padding: 0
};

const desktopCategoryBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "9px 14px",
  width: "100%",
  border: "none",
  background: "transparent",
  borderRadius: "10px",
  cursor: "pointer",
  transition: "all 0.15s ease",
  textAlign: "left",
  boxSizing: "border-box"
};

const desktopPostBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "10px",
  width: "100%",
  height: "48px",
  borderRadius: "9999px",
  background: "#c4c4c8",
  color: "#09090b",
  border: "none",
  fontSize: "16px",
  fontWeight: "800",
  cursor: "pointer",
  marginTop: "18px",
  boxShadow: "0 2px 10px rgba(255, 255, 255, 0.15)",
  transition: "opacity 0.2s ease, transform 0.15s ease",
  boxSizing: "border-box"
};

const desktopUserPillStyle = {
  display: "flex",
  alignItems: "center",
  gap: "10px",
  padding: "10px 12px",
  borderRadius: "9999px",
  cursor: "pointer",
  transition: "background 0.2s ease",
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(255, 255, 255, 0.04)"
};

const desktopUserPillAvatar = {
  width: "38px",
  height: "38px",
  borderRadius: "50%",
  objectFit: "cover",
  flexShrink: 0,
  border: "1px solid rgba(255, 255, 255, 0.12)"
};

const desktopUserPillName = {
  fontSize: "14px",
  fontWeight: "700",
  color: "#d4d4d8",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis"
};

const desktopUserPillHandle = {
  fontSize: "12px",
  color: "#71767b",
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "block"
};

const desktopLoginPillBtn = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  width: "100%",
  padding: "12px 16px",
  borderRadius: "9999px",
  background: "rgba(255, 255, 255, 0.08)",
  border: "1px solid rgba(255, 255, 255, 0.2)",
  color: "#d4d4d8",
  fontSize: "14px",
  fontWeight: "700",
  cursor: "pointer",
  transition: "background 0.2s ease"
};

const communityCountPillStyle = {
  background: "rgba(255, 255, 255, 0.12)",
  color: "#d4d4d8",
  fontSize: "11px",
  fontWeight: "700",
  padding: "1px 6px",
  borderRadius: "10px",
  lineHeight: "1.3"
};
