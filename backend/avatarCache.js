/**
 * Centralized Avatar Caching & Invalidation Layer
 * Provides high-speed in-memory buffer and URL caches for avatars across services.
 */

export const avatarUrlCache = new Map(); // identifier -> { targetUrl, expiresAt }
export const avatarBufferCache = new Map(); // identifier -> { buffer, contentType, expiresAt }

/**
 * Purges memory caches for a list of user/creator identifiers (IDs, handles, channel IDs).
 * Ensures instant update visibility without server restarts or stale edge reads.
 */
export const purgeAvatarCache = (identifiers = []) => {
  for (const raw of identifiers) {
    if (!raw) continue;
    const clean = String(raw).toLowerCase().trim().replace(/^@/, "");
    if (!clean) continue;

    avatarUrlCache.delete(clean);
    avatarBufferCache.delete(clean);

    for (const key of avatarUrlCache.keys()) {
      if (key === clean || key.startsWith(`${clean}_`) || key.includes(clean)) {
        avatarUrlCache.delete(key);
      }
    }
    for (const key of avatarBufferCache.keys()) {
      if (key === clean || key.startsWith(`${clean}_`) || key.includes(clean)) {
        avatarBufferCache.delete(key);
      }
    }
  }
};
