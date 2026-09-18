import React from "react";

/**
 * Parses caption text and renders @creator mentions as clickable links
 * that navigate directly to the creator's profile.
 * 
 * Example: "Check out @alphaxdash2's new drop!" 
 * -> "@alphaxdash2" is rendered as a clickable link that opens the creator profile.
 */
export const renderClickableCaption = (text, onCreatorClick, customMentionStyle = {}) => {
  if (!text) return null;
  const str = String(text);

  // Matches @username where username starts with alphanumeric/underscore,
  // supports inner dots/hyphens, and is preceded by start-of-string or non-word character.
  // Trailing punctuation like '.', ',', '!', '?', or possessive "'s" is excluded.
  const regex = /(^|[^a-zA-Z0-9_])@([a-zA-Z0-9_]+(?:[.-][a-zA-Z0-9_]+)*)/g;

  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(str)) !== null) {
    const prefix = match[1];
    const rawHandle = match[2];
    const matchIndex = match.index + prefix.length;

    // Push preceding text including the prefix
    if (matchIndex > lastIndex) {
      elements.push(str.slice(lastIndex, matchIndex));
    }

    const cleanHandle = rawHandle.replace(/^@/, "").trim();

    // Push clickable @handle
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
          color: "#00aff0",
          fontWeight: "700",
          cursor: "pointer",
          display: "inline",
          textDecoration: "none",
          transition: "opacity 0.15s ease, text-decoration 0.15s ease",
          ...customMentionStyle
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = "0.8";
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

    lastIndex = matchIndex + 1 + rawHandle.length;
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
