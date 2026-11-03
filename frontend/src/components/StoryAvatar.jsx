import React from "react";
import { useActiveStories } from "../context/StoryContext";
import TwitterVerifiedBadge from "./TwitterVerifiedBadge";
import { resolveAvatar, handleAvatarError, normalizeAvatarUrl } from "../utils/avatar";

export default function StoryAvatar({
  username,
  avatarUrl = "",
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

  // Normalize avatar URL to /avatar.jpg or fallback to dynamic Telegram/TikTok initial avatar
  const safeAvatarUrl = React.useMemo(() => {
    let url = normalizeAvatarUrl(avatarUrl);
    if (!url && cleanUsername) {
      url = `/avatar.jpg?username=${encodeURIComponent(cleanUsername)}&v=2`;
    } else if (url && typeof url === "string") {
      // 🟢 Fix: Only rewrite legacy endpoint paths like /api/avatar or /avatar? - NEVER touch /avatars/ storage paths!
      if (!url.includes("/avatars/")) {
        url = url.replace(/(?:\/api)?\/avatar(?:\.jpg)?(?=\?|$)/, "/avatar.jpg");
      }
    }
    return resolveAvatar(url, displayName || cleanUsername, cleanUsername);
  }, [avatarUrl, displayName, cleanUsername]);

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
        key={safeAvatarUrl}
        src={safeAvatarUrl}
        alt={displayName || cleanUsername}
        loading="lazy"
        decoding="async"
        crossOrigin="anonymous"
        referrerPolicy="no-referrer-when-downgrade"
        onError={(e) => handleAvatarError(e, displayName || cleanUsername, cleanUsername)}
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
