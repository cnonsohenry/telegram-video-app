/**
 * Dynamic Initial Avatar Generator (Telegram / TikTok Style)
 * 
 * Provides deterministic gradient avatars based on user display name/username and ID.
 * Generates lightweight, zero-latency vector SVGs encoded as Data URIs.
 */

export const AVATAR_GRADIENTS = [
  { name: "Sunset Coral",   start: "#FF5E62", end: "#FF9966" },
  { name: "Neon Violet",    start: "#8A2387", end: "#E94057" },
  { name: "Electric Blue",  start: "#2563EB", end: "#60A5FA" },
  { name: "Emerald Mint",   start: "#059669", end: "#34D399" },
  { name: "Vibrant Amber",  start: "#D97706", end: "#FBBF24" },
  { name: "Royal Violet",   start: "#7C3AED", end: "#A78BFA" },
  { name: "Aqua Cyan",      start: "#0891B2", end: "#22D3EE" },
  { name: "Rose Crimson",   start: "#E11D48", end: "#FB7185" },
  { name: "Indigo Dusk",    start: "#4F46E5", end: "#818CF8" },
  { name: "Warm Tangerine", start: "#EA580C", end: "#FB923C" },
];

/**
 * Extracts the single best display initial from a user object or string.
 * Handles Unicode graphemes, leading symbols (@, #), emojis, and international scripts.
 */
export function getAvatarInitial(nameOrUser) {
  if (!nameOrUser) return "";

  let raw = "";
  if (typeof nameOrUser === "object") {
    raw = nameOrUser.display_name || 
          nameOrUser.displayName || 
          nameOrUser.name || 
          nameOrUser.username || 
          nameOrUser.uploader_name || 
          "";
  } else {
    raw = String(nameOrUser);
  }

  const clean = raw.replace(/^[@#\s"'`]+/, "").trim();
  if (!clean) return "";

  // Prioritize first letter or digit across all Unicode alphabets
  const match = clean.match(/[\p{L}\p{N}]/u);
  if (match) {
    return match[0].toUpperCase();
  }

  // Fallback to first grapheme / emoji
  const graphemes = Array.from(clean);
  return graphemes.length > 0 ? graphemes[0] : "";
}

/**
 * Deterministically computes a stable color palette index from an identifier.
 */
export function getAvatarGradient(identifier) {
  if (identifier === null || identifier === undefined) {
    return AVATAR_GRADIENTS[0];
  }

  let index = 0;
  if (typeof identifier === "number" && !isNaN(identifier)) {
    index = Math.abs(identifier) % AVATAR_GRADIENTS.length;
  } else {
    const str = String(identifier).trim().toLowerCase();
    if (/^-?\d+$/.test(str)) {
      index = Math.abs(parseInt(str, 10)) % AVATAR_GRADIENTS.length;
    } else {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
      }
      index = Math.abs(hash) % AVATAR_GRADIENTS.length;
    }
  }

  return AVATAR_GRADIENTS[index] || AVATAR_GRADIENTS[0];
}

/**
 * Generates an SVG vector string with gradient background and centered typography.
 */
export function generateAvatarSvg(initial, gradient, uniqueId = "") {
  const gradId = `avg_${(gradient.name || "grad").replace(/\s+/g, "_")}_${uniqueId || "0"}`;
  const isSilhouette = !initial || initial === "?";

  const content = isSilhouette
    ? `<path d="M50 48a14 14 0 1 0 0-28 14 14 0 0 0 0 28zm0 7c-13.3 0-26 7.4-26 19v4h52v-4c0-11.6-12.7-19-26-19z" fill="#ffffff" fill-opacity="0.95"/>`
    : `<text x="50%" y="53%" font-family="-apple-system, BlinkMacSystemFont, &apos;Segoe UI&apos;, Roboto, Helvetica, Arial, sans-serif" font-size="44" font-weight="700" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${initial}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${gradient.start}"/>
      <stop offset="100%" stop-color="${gradient.end}"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="50" fill="url(#${gradId})"/>
  ${content}
</svg>`;
}

/**
 * Returns a self-contained SVG Data URI for an avatar.
 */
export function getDynamicAvatar(nameOrUser, identifier) {
  const initial = getAvatarInitial(nameOrUser);
  const targetId = identifier || 
    (typeof nameOrUser === "object" ? (nameOrUser.id || nameOrUser.user_id || nameOrUser.username) : nameOrUser) || 
    "user";
  const gradient = getAvatarGradient(targetId);
  const cleanId = String(targetId).replace(/[^a-zA-Z0-9]/g, "").slice(0, 8);
  const svg = generateAvatarSvg(initial, gradient, cleanId);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Normalizes avatar URLs to same-origin proxies where necessary
 * (e.g. converting bucket.naijahomemade.com/avatars/ to /avatars/).
 */
export function normalizeAvatarUrl(url) {
  if (!url || typeof url !== "string") return "";
  let clean = url.trim();
  if (clean.includes("bucket.naijahomemade.com/avatars/")) {
    clean = clean.replace("https://bucket.naijahomemade.com/avatars/", "https://naijahomemade.com/avatars/");
  }
  // Canonical normalization for official VIP creator @naijaxxx (ID: 458)
  if (clean.includes("user_id=naijaxxx") || clean.includes("username=naijaxxx") || clean.includes("user_id=458") || clean.includes("user_id=%40naijaxxx") || clean.includes("user_id=@naijaxxx")) {
    clean = clean.replace(/user_id=[^&]+/, "user_id=-1004344719694").replace(/username=[^&]+/, "user_id=-1004344719694");
  }
  return clean;
}

/**
 * Checks if an avatar URL is an authentic custom user photo.
 */
export function isCustomAvatar(url) {
  if (!url || typeof url !== "string") return false;
  const clean = normalizeAvatarUrl(url);
  const trimmed = clean.trim().toLowerCase();
  if (trimmed === "" || trimmed === "null" || trimmed === "undefined") return false;
  if (trimmed.includes("default-avatar")) return false;
  if (trimmed.includes("ui-avatars.com")) return false;
  if (trimmed.startsWith("data:image/svg+xml")) return false;
  return true;
}

/**
 * Smart avatar resolver: Returns the custom avatar URL if available,
 * or gracefully returns the Telegram/TikTok style dynamic initial SVG Data URI.
 */
export function resolveAvatar(avatarUrl, nameOrUser, identifier) {
  const targetId = identifier || 
    (typeof nameOrUser === "object" ? (nameOrUser.id || nameOrUser.user_id || nameOrUser.username) : nameOrUser) || 
    "user";
  const idStr = String(targetId).toLowerCase().replace(/^@/, "").trim();
  if (idStr === "naijaxxx" || idStr === "458" || idStr === "-1004344719694") {
    return "/avatar.jpg?user_id=-1004344719694";
  }

  const cleanUrl = normalizeAvatarUrl(avatarUrl);
  if (isCustomAvatar(cleanUrl)) {
    return cleanUrl;
  }
  return getDynamicAvatar(nameOrUser, identifier);
}

/**
 * onError handler for <img> elements: replaces broken custom avatars
 * with the deterministic dynamic initial avatar without infinite loops.
 */
export function handleAvatarError(e, nameOrUser, identifier) {
  if (e && e.currentTarget) {
    e.currentTarget.onerror = null;
    const current = String(e.currentTarget.src || "");
    if (!current.startsWith("data:image/svg+xml")) {
      e.currentTarget.src = getDynamicAvatar(nameOrUser, identifier);
    }
  }
}
