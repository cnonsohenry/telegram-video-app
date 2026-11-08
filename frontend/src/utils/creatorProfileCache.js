/**
 * Global LRU Creator Profile Cache & Universal Social State Sync
 *
 * Provides 0ms instant back/forward navigation between creator profiles and
 * Suggested Creators cards across the application.
 *
 * Preserves:
 * 1. Profile metadata (creator info, stats, bio, verified, ownership)
 * 2. Active video tab (Posts, Reels, Premium)
 * 3. Loaded tab videos, pagination pages, hasMore flags
 * 4. Story highlights
 * 5. Vertical scroll position of the profile page
 * 6. Suggested Creators card expanded/collapsed toggle & horizontal carousel scroll
 * 7. Unified real-time follow/subscribe states with cross-component event broadcasting
 */

const MAX_CACHE_SIZE = 50;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache validity

// username -> cached creator snapshot
const profileCache = new Map();

// username -> { isFollowing: boolean, followersCountDelta: number }
const globalFollowState = new Map();

// username -> vertical scroll position
const scrollPositionCache = new Map();

// sectionKey -> horizontal scrollLeft for Suggested Creators track
const trackScrollCache = new Map();

export const normalizeUsername = (uname) => {
  return String(uname || "").toLowerCase().replace(/^@/, "").trim();
};

/**
 * Retrieve cached creator profile snapshot
 */
export const getCachedCreator = (username) => {
  const key = normalizeUsername(username);
  if (!key) return null;
  const entry = profileCache.get(key);
  if (!entry) return null;

  // Apply any global follow overrides
  if (globalFollowState.has(key)) {
    entry.isFollowing = globalFollowState.get(key);
  }

  // LRU bump: delete and re-insert at end
  profileCache.delete(key);
  profileCache.set(key, entry);

  return entry;
};

/**
 * Store a new or updated creator profile snapshot
 */
export const setCachedCreator = (username, data) => {
  const key = normalizeUsername(username);
  if (!key) return null;

  // LRU eviction if cache limit reached
  if (profileCache.size >= MAX_CACHE_SIZE && !profileCache.has(key)) {
    const oldestKey = profileCache.keys().next().value;
    profileCache.delete(oldestKey);
  }

  const existing = profileCache.get(key) || {};
  const merged = {
    ...existing,
    ...data,
    username: key,
    timestamp: Date.now()
  };

  profileCache.set(key, merged);
  return merged;
};

/**
 * Partially update an existing cached creator entry
 */
export const updateCachedCreator = (username, updates) => {
  const key = normalizeUsername(username);
  if (!key) return null;
  const existing = profileCache.get(key);
  if (!existing) return null;

  const updated = {
    ...existing,
    ...updates,
    timestamp: Date.now()
  };
  profileCache.set(key, updated);
  return updated;
};

/**
 * Save vertical scroll position for a creator profile
 */
export const saveCreatorScroll = (username, scrollY) => {
  const key = normalizeUsername(username);
  if (!key) return;
  const safeY = Math.max(0, Math.round(scrollY || 0));
  scrollPositionCache.set(key, safeY);
  const existing = profileCache.get(key);
  if (existing) {
    existing.scrollPosition = safeY;
  }
};

/**
 * Retrieve saved vertical scroll position
 */
export const getCreatorScroll = (username) => {
  const key = normalizeUsername(username);
  if (!key) return 0;
  return scrollPositionCache.get(key) || 0;
};

/**
 * Save horizontal scrollLeft for Suggested Creators track
 */
export const saveSuggestedScroll = (key, scrollLeft) => {
  const cleanKey = normalizeUsername(key) || "default";
  trackScrollCache.set(cleanKey, Math.max(0, Math.round(scrollLeft || 0)));
};

/**
 * Retrieve horizontal scrollLeft for Suggested Creators track
 */
export const getSuggestedScroll = (key) => {
  const cleanKey = normalizeUsername(key) || "default";
  return trackScrollCache.get(cleanKey) || 0;
};

/**
 * Retrieve global follow state for any creator
 */
export const getGlobalFollow = (username, fallback = false) => {
  const key = normalizeUsername(username);
  if (globalFollowState.has(key)) {
    return globalFollowState.get(key);
  }
  return Boolean(fallback);
};

/**
 * Update global follow state and broadcast to all listening components
 */
export const setGlobalFollow = (username, isFollowing) => {
  const key = normalizeUsername(username);
  if (!key) return;
  const nextVal = Boolean(isFollowing);
  globalFollowState.set(key, nextVal);

  // Update profile cache if cached
  const cached = profileCache.get(key);
  if (cached) {
    cached.isFollowing = nextVal;
    if (nextVal) {
      cached.followersCount = (cached.followersCount || 0) + 1;
    } else {
      cached.followersCount = Math.max(0, (cached.followersCount || 1) - 1);
    }
  }

  // Broadcast event across components (DiscoverCreatorsSection, Modals, Feed, Profile)
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("creatorFollowChanged", {
      detail: { username: key, isFollowing: nextVal }
    }));
  }
};

/**
 * Clear the entire cache (useful on logout)
 */
export const clearCreatorCache = () => {
  profileCache.clear();
  scrollPositionCache.clear();
  globalFollowState.clear();
  trackScrollCache.clear();
};
