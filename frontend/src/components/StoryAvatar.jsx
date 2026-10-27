import React from "react";
import { useActiveStories } from "../context/StoryContext";
import TwitterVerifiedBadge from "./TwitterVerifiedBadge";

export default function StoryAvatar({
  username,
  avatarUrl = "/assets/default-avatar.png",
  displayName = "",
  size = 40,
  borderWidth = 2.5,
  onClick,
  showVerifiedBadge = false,
  badgeSize = 14,
  style = {},
  imgStyle = {},
  className = ""
}) {
  const { hasActiveStory, isStoryViewed, openStory } = useActiveStories();

  const cleanUsername = String(username || "").replace(/^@/, "").trim();
  const active = hasActiveStory(cleanUsername);
  const viewed = isStoryViewed(cleanUsername);

  // Normalize avatar URL to /avatar.jpg for global Cloudflare Edge HIT caching
  const safeAvatarUrl = React.useMemo(() => {
    if (!avatarUrl || avatarUrl === "null" || avatarUrl === "undefined") {
      return "/assets/default-avatar.png";
    }
    if (avatarUrl.includes("/api/avatar") || avatarUrl.includes("/avatar")) {
      let normalized = avatarUrl
        .replace(/\/api\/avatar(?:\.jpg)?/, "/avatar.jpg")
        .replace(/\/avatar(?!\.jpg)/, "/avatar.jpg");
      return normalized;
    }
    return avatarUrl;
  }, [avatarUrl]);

  const handleClick = (e) => {
    if (active) {
      e.stopPropagation();
      openStory(cleanUsername, {
        username: cleanUsername,
        display_name: displayName || cleanUsername,
        avatar_url: safeAvatarUrl
      });
    } else if (onClick) {
      onClick(e);
    }
  };

  const ringStyle = {
    position: "relative",
    width: `${size}px`,
    height: `${size}px`,
    borderRadius: "50%",
    padding: active ? `${borderWidth}px` : "0px",
    background: active
      ? (viewed
          ? "rgba(255, 255, 255, 0.35)"
          : "linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)")
      : "transparent",
    boxSizing: "border-box",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    cursor: active || onClick ? "pointer" : "default",
    flexShrink: 0,
    transition: "background 0.2s ease",
    ...style
  };

  const finalImgStyle = {
    width: "100%",
    height: "100%",
    borderRadius: "50%",
    objectFit: "cover",
    backgroundColor: "#161616",
    border: active ? "2px solid #000" : "1.5px solid rgba(255, 255, 255, 0.12)",
    display: "block",
    boxSizing: "border-box",
    ...imgStyle
  };

  return (
    <div 
      className={className}
      style={ringStyle} 
      onClick={handleClick} 
      title={active ? (viewed ? `Viewed Story by @${cleanUsername}` : `New Story by @${cleanUsername}`) : displayName || cleanUsername}
    >
      <img
        src={safeAvatarUrl}
        alt={displayName || cleanUsername}
        loading="lazy"
        decoding="async"
        onError={(e) => { e.target.src = "/assets/default-avatar.png"; }}
        style={finalImgStyle}
      />
      {showVerifiedBadge && (
        <div style={{ position: "absolute", bottom: "-2px", right: "-2px", zIndex: 1 }}>
          <TwitterVerifiedBadge size={badgeSize} />
        </div>
      )}
    </div>
  );
}
