import React from "react";

/**
 * Parses caption text and renders @creator mentions and #hashtags as clickable links
 * styled authentically like X / Twitter with smooth, precise typography.
 * 
 * - @creator -> navigates directly to the creator's profile.
 * - #hashtag -> opens search for that specific hashtag topic.
 */
export const renderClickableCaption = (text, onCreatorClick, customMentionStyle = {}) => {
  if (!text) return null;
  const str = String(text);

  // Matches either:
  // 1. @mention: (^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]+(?:[.-][a-zA-Z0-9_]+)*)
  // 2. #hashtag: (^|[^a-zA-Z0-9_])#([a-zA-Z0-9_\u00c0-\u024f]+)
  const regex = /(^|[^a-zA-Z0-9_])(@[a-zA-Z0-9_]+(?:[.-][a-zA-Z0-9_]+)*|#[a-zA-Z0-9_\u00c0-\u024f]+)/g;

  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(str)) !== null) {
    const prefix = match[1];
    const token = match[2];
    const matchIndex = match.index + prefix.length;

    // Push preceding text including the prefix
    if (matchIndex > lastIndex) {
      elements.push(str.slice(lastIndex, matchIndex));
    }

    if (token.startsWith("@")) {
      const cleanHandle = token.slice(1).trim();
      elements.push(
        <span
          key={`mention-${matchIndex}-${cleanHandle}`}
          onClick={(e) => {
            if (e) {
              e.preventDefault();
              e.stopPropagation();
            }
            if (onCreatorClick && typeof onCreatorClick === "function") {
              onCreatorClick(cleanHandle);
            } else {
              window.dispatchEvent(
                new CustomEvent("openCreatorProfile", { detail: cleanHandle })
              );
            }
          }}
          role="button"
          tabIndex={0}
          style={{
            color: "#1d9bf0", // X signature sky blue
            fontWeight: "500",
            cursor: "pointer",
            display: "inline",
            textDecoration: "none",
            transition: "opacity 0.15s ease",
            ...customMentionStyle
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.85";
            e.currentTarget.style.textDecoration = "underline";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.textDecoration = "none";
          }}
          title={`View @${cleanHandle}'s profile`}
        >
          @{cleanHandle}
        </span>
      );
    } else if (token.startsWith("#")) {
      const hashtag = token.slice(1).trim();
      elements.push(
        <span
          key={`tag-${matchIndex}-${hashtag}`}
          onClick={(e) => {
            if (e) {
              e.preventDefault();
              e.stopPropagation();
            }
            window.dispatchEvent(
              new CustomEvent("openSearchModal", { detail: { query: `#${hashtag}` } })
            );
          }}
          role="button"
          tabIndex={0}
          style={{
            color: "#1d9bf0", // X signature sky blue
            fontWeight: "500",
            cursor: "pointer",
            display: "inline",
            textDecoration: "none",
            transition: "opacity 0.15s ease",
            ...customMentionStyle
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "0.85";
            e.currentTarget.style.textDecoration = "underline";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.textDecoration = "none";
          }}
          title={`Search #${hashtag}`}
        >
          #{hashtag}
        </span>
      );
    }

    lastIndex = matchIndex + token.length;
  }

  if (lastIndex < str.length) {
    elements.push(str.slice(lastIndex));
  }

  return elements.length > 0 ? elements : str;
};

export default function ClickableCaption({ 
  text, 
  onCreatorClick, 
  style = {}, 
  className = "",
  mentionStyle = {},
  as: Component = "span" 
}) {
  return (
    <Component style={style} className={className}>
      {renderClickableCaption(text, onCreatorClick, mentionStyle)}
    </Component>
  );
}
