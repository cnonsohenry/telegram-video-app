/**
 * frontend/src/utils/subscription.js
 * Centralized utility for creator subscription verification and video access gating.
 */

/**
 * Check if the user has access to play a video.
 * Public videos: Accessible to all.
 * Premium videos: Requires active subscription to the video's creator, or being the creator, or admin.
 */
export const isUserSubscribedToCreator = (user, video) => {
  if (!video) return false;

  const isPremium = video.category === "premium" || video.is_premium === true;
  if (!isPremium) {
    return true;
  }

  // If already flagged as subscribed or granted access
  if (video.is_subscribed || video.has_access) {
    return true;
  }

  const creatorHandle = getVideoCreatorHandle(video).toLowerCase();
  const isOfficial = creatorHandle === "naijahomemade";

  // If creator did not set any subscription fee (subscription_price <= 0), access is granted freely!
  if (!isOfficial && video.subscription_price !== undefined && Number(video.subscription_price || 0) <= 0) {
    return true;
  }

  // If user is not logged in, they cannot have an active subscription to a paid video
  if (!user) {
    return false;
  }

  // Admin access
  if (user.role === "admin") {
    return true;
  }

  const uploaderId = video.uploader_id ? String(video.uploader_id) : null;

  // Owner check
  if (user.username && user.username.toLowerCase().replace(/^@/, "").trim() === creatorHandle) {
    return true;
  }
  if (uploaderId && (String(user.id) === uploaderId || (user.telegram_user_id && String(user.telegram_user_id) === uploaderId))) {
    return true;
  }

  // Subscriptions array check
  if (Array.isArray(user.subscriptions) && user.subscriptions.length > 0) {
    const isSubscribed = user.subscriptions.some(sub => {
      // Check creator username
      if (sub.creator_username) {
        const subHandle = sub.creator_username.toLowerCase().replace(/^@/, "").trim();
        if (subHandle === creatorHandle) return true;
        if (creatorHandle === "naijahomemade" && subHandle.includes("naijahomemade")) return true;
      }
      // Check IDs
      if (uploaderId) {
        if (String(sub.creator_id) === uploaderId) return true;
        if (sub.telegram_user_id && String(sub.telegram_user_id) === uploaderId) return true;
      }
      // If legacy VIP creator @naijahomemade
      if (creatorHandle === "naijahomemade" && (String(sub.creator_id) === "458" || String(sub.creator_id) === "1881815190")) {
        return true;
      }
      return false;
    });

    if (isSubscribed) return true;
  }

  // Fallback for migrated VIP users viewing @naijahomemade videos
  if (user.is_premium && creatorHandle === "naijahomemade") {
    return true;
  }

  return false;
};

/**
 * Returns the resolved creator username/handle for a video
 */
export const getVideoCreatorHandle = (video) => {
  if (!video) return "naijahomemade";
  let handle = video.uploader_handle || video.uploader_name || "naijahomemade";
  handle = String(handle).replace(/^@/, "").trim();
  if (!handle || handle.toLowerCase() === "member" || handle.toLowerCase() === "creator") {
    handle = "naijahomemade";
  }
  return handle;
};

/**
 * Check if the user is following a creator (general free follow)
 */
export const isUserFollowingCreator = (user, videoOrCreator) => {
  if (!user || !videoOrCreator) return false;
  const creatorHandle = (typeof videoOrCreator === "string" ? videoOrCreator : getVideoCreatorHandle(videoOrCreator)).toLowerCase().replace(/^@/, "").trim();
  const creatorId = videoOrCreator?.uploader_id ? String(videoOrCreator.uploader_id) : (videoOrCreator?.id ? String(videoOrCreator.id) : null);

  // Owner check
  if (user.username && user.username.toLowerCase().replace(/^@/, "").trim() === creatorHandle) {
    return true;
  }
  if (creatorId && (String(user.id) === creatorId || (user.telegram_user_id && String(user.telegram_user_id) === creatorId))) {
    return true;
  }

  // Follows array check
  if (Array.isArray(user.follows) && user.follows.length > 0) {
    return user.follows.some(f => {
      if (f.creator_username && f.creator_username.toLowerCase().replace(/^@/, "").trim() === creatorHandle) return true;
      if (creatorId && (String(f.creator_id) === creatorId || (f.telegram_user_id && String(f.telegram_user_id) === creatorId))) return true;
      return false;
    });
  }

  return false;
};

/**
 * Check if the user is exempt from all ads (VIP subscriber, creator, admin, or active memberships)
 */
export const isUserAdExempt = (user) => {
  if (!user) return false;
  if (user.role === "admin") return true;
  if (user.is_premium) return true;
  if (user.is_creator) return true;
  if (Array.isArray(user.subscriptions) && user.subscriptions.length > 0) return true;
  return false;
};

