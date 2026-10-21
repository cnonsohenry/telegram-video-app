/**
 * frontend/src/utils/adManager.js
 * Centralized Ad & Smartlink Management System
 * 
 * Features:
 * 1. Reduced Frequency: Triggers on positive multiples of AD_FREQUENCY (default: every 6th video).
 * 2. Delay: First 5 videos are 100% ad-free to hook the user.
 * 3. Cooldown: Enforces a minimum time interval between ad triggers (default: 8 mins).
 * 4. VIP / Member Exemption: Completely skips ads for paying subscribers, creators, and admins.
 * 5. Safe Return Watcher: Resumes playback quickly upon tab return, or after a safe fallback timeout.
 */

import { APP_CONFIG } from "../config";
import { isUserAdExempt } from "./subscription";
import { adReturnWatcher } from "./adReturnWatcher";

const DEFAULT_SMARTLINK_URL = "https://www.effectivegatecpm.com/wmmi5uv2w5?key=23fa23a9f5a389595c81f702d570419b";
export const POST_LOGIN_GRACE_MINUTES = 30;

export function getSmartlinkUrl() {
  return APP_CONFIG?.ads?.smartlinkUrl || DEFAULT_SMARTLINK_URL;
}

export function getAdFrequency() {
  return Number(APP_CONFIG?.ads?.adFrequency) || 6;
}

export function getMinCooldownMs() {
  const minutes = Number(APP_CONFIG?.ads?.minMinutesBetweenAds) || 8;
  return minutes * 60 * 1000;
}

/**
 * Checks whether the user is currently within an ad-free grace window after logging in.
 * Prevents any ads, popunders, or smartlinks from ruining the onboarding/login trust experience.
 */
export function isPostLoginAdGraceActive() {
  try {
    const isFlagged = localStorage.getItem("post_login_ad_free") === "true";
    const lastLogin = parseInt(localStorage.getItem("last_login_timestamp") || "0", 10);
    const graceMs = POST_LOGIN_GRACE_MINUTES * 60 * 1000;
    if (isFlagged || (!isNaN(lastLogin) && lastLogin > 0 && (Date.now() - lastLogin) < graceMs)) {
      return true;
    }
  } catch (e) {}
  return false;
}

/**
 * Close any ad popunder or popup windows that were opened by script earlier in the session.
 * Eliminates the issue where the browser defaults to an ad tab after Google OAuth closes.
 */
export function closeOpenedAdWindows() {
  try {
    if (typeof window !== "undefined" && window.__openedAdWindows && Array.isArray(window.__openedAdWindows)) {
      window.__openedAdWindows.forEach(win => {
        try {
          if (win && !win.closed && typeof win.close === "function") {
            win.close();
          }
        } catch (e) {}
      });
      window.__openedAdWindows = [];
    }
  } catch (e) {}
}

/**
 * Aggressively refocuses the current website window across multiple animation frames.
 * Ensures the website tab regains focus immediately after Google OAuth popup closes.
 */
export function refocusWebsiteWindow() {
  try {
    if (typeof window !== "undefined" && typeof window.focus === "function") {
      window.focus();
    }
  } catch (e) {}
  if (typeof window !== "undefined") {
    [50, 150, 300, 600, 1200].forEach(delay => {
      setTimeout(() => {
        try {
          if (typeof window.focus === "function") {
            window.focus();
          }
        } catch (e) {}
      }, delay);
    });
  }
}

/**
 * Suppress all ads, popunders, and smartlinks immediately upon user authentication.
 * Enforces a post-login immunity window (default 30 mins) and resets ad triggers.
 */
export function suppressAdsPostLogin(durationMinutes = POST_LOGIN_GRACE_MINUTES) {
  try {
    const now = Date.now();
    localStorage.setItem("last_login_timestamp", now.toString());
    localStorage.setItem("post_login_ad_free", "true");
    localStorage.setItem("last_smartlink_timestamp", now.toString());
    localStorage.setItem("last_ad_timestamp", now.toString());
    localStorage.setItem("ad_frequency_counter", "0");
    localStorage.setItem("vip_ad_free", "true");

    // 1. Close any previously opened ad tabs so browser cannot default to them
    closeOpenedAdWindows();

    // 2. Reclaim window focus immediately
    refocusWebsiteWindow();

    // 3. Neutralize in-memory popMagic
    if (window.popMagic) {
      try {
        window.popMagic.config.capping_enabled = true;
        window.popMagic.open_count = 999999;
        window.popMagic.shouldShow = function() { return false; };
      } catch (e) {}
    }
  } catch (e) {
    console.warn("[AD MANAGER] Failed to set post-login ad suppression:", e);
  }
}

/**
 * Check if the user is eligible for an ad and triggers the smartlink if so.
 * Returns true if an ad was displayed, false if skipped.
 */
export async function triggerSmartlinkIfEligible(user) {
  // 1. VIP / Subscriber / Creator / Admin Exemption
  if (isUserAdExempt(user)) {
    return false;
  }

  // 2. Post-Login Ad Immunity (Never fire an ad right after signing in with Google or Email!)
  if (isPostLoginAdGraceActive()) {
    return false;
  }

  // 3. Increment global video watch count
  const rawCount = parseInt(localStorage.getItem("ad_frequency_counter") || "0", 10);
  const currentCount = isNaN(rawCount) ? 0 : rawCount;
  const nextCount = currentCount + 1;
  localStorage.setItem("ad_frequency_counter", nextCount.toString());

  // 4. Frequency check (e.g. video #6, #12, #18)
  const frequency = getAdFrequency();
  if (nextCount < frequency || nextCount % frequency !== 0) {
    return false;
  }

  // 5. Cooldown time check (prevents rapid-fire popups if browsing quickly)
  const lastSmartlinkTime = parseInt(localStorage.getItem("last_smartlink_timestamp") || "0", 10);
  const lastGlobalAdTime = parseInt(localStorage.getItem("last_ad_timestamp") || "0", 10);
  const lastAdTime = Math.max(lastSmartlinkTime, lastGlobalAdTime);
  const now = Date.now();
  const cooldownMs = getMinCooldownMs();
  if (!isNaN(lastAdTime) && lastAdTime > 0 && (now - lastAdTime) < cooldownMs) {
    return false;
  }

  // 6. Eligible! Record timestamp, mark mutual exclusion flag, and open smartlink
  localStorage.setItem("last_smartlink_timestamp", now.toString());
  localStorage.setItem("last_ad_timestamp", now.toString());
  sessionStorage.setItem("just_saw_smartlink", "true");

  try {
    openSmartlink();
    await adReturnWatcher();
    return true;
  } catch (err) {
    console.warn("[AD MANAGER] Error during ad display:", err);
    return false;
  }
}

/**
 * Checks if the current user and session are eligible to play a VAST video pre-roll ad.
 * Ensures strict mutual exclusion with Smartlink (never both on the same video play).
 */
export function shouldPlayVastAd(user) {
  // 1. VIP / Subscriber / Creator / Admin Exemption
  if (isUserAdExempt(user)) {
    return false;
  }

  // 2. Post-Login Ad Immunity
  if (isPostLoginAdGraceActive()) {
    return false;
  }

  // 3. Strict Mutual Exclusion: If a Smartlink just opened on this video click, skip VAST!
  if (sessionStorage.getItem("just_saw_smartlink") === "true") {
    sessionStorage.removeItem("just_saw_smartlink");
    return false;
  }

  // 4. Grace period check: hook users with initial free videos
  const rawCount = parseInt(localStorage.getItem("ad_frequency_counter") || "0", 10);
  const currentCount = isNaN(rawCount) ? 0 : rawCount;
  const initialFree = Number(APP_CONFIG?.ads?.initialFreeVideos) || 2;
  if (currentCount <= initialFree) {
    return false;
  }

  // 4. Shared Cooldown check: enforce minimum interval between ANY ad
  const lastAdTime = parseInt(localStorage.getItem("last_ad_timestamp") || "0", 10);
  const now = Date.now();
  const cooldownMs = getMinCooldownMs();
  if (!isNaN(lastAdTime) && lastAdTime > 0 && (now - lastAdTime) < cooldownMs) {
    return false;
  }

  // 5. VAST Frequency check (e.g. every 3rd video)
  const vastFrequency = Number(APP_CONFIG?.ads?.vastFrequency) || 3;
  if (currentCount % vastFrequency !== 0) {
    return false;
  }

  return true;
}

/**
 * Record that a VAST ad was displayed to enforce shared cooldown
 */
export function recordVastAdPlayed() {
  const now = Date.now().toString();
  localStorage.setItem("last_ad_timestamp", now);
  localStorage.setItem("last_vast_timestamp", now);
}

/**
 * Get VAST Tag URL and skip duration configuration
 */
export function getVastConfig() {
  return {
    vastTag: APP_CONFIG?.ads?.vastTag || "https://s.magsrv.com/v1/vast.php?idzone=5880122",
    skipSeconds: Number(APP_CONFIG?.ads?.vastSkipSeconds) || 5
  };
}

/**
 * Directly opens the smartlink in a new tab or via Telegram WebApp
 */
export function openSmartlink() {
  if (isPostLoginAdGraceActive()) {
    console.log("[AD MANAGER] Suppressed openSmartlink during post-login grace");
    return;
  }
  const adUrl = getSmartlinkUrl();

  if (window.Telegram?.WebApp?.openLink) {
    window.Telegram.WebApp.openLink(adUrl, {
      try_instant_view: false,
    });
  } else {
    try {
      const win = window.open(adUrl, "_blank");
      if (win) {
        window.__openedAdWindows = window.__openedAdWindows || [];
        window.__openedAdWindows.push(win);
      }
    } catch (e) {}
  }
}

/**
 * Backward compatibility alias
 */
export const openRewardedAd = openSmartlink;

/**
 * Syncs user VIP ad-free state to localStorage and coordinates with ExoClick popMagic
 */
export function syncVipAdFreeState(user) {
  const isExempt = isUserAdExempt(user);
  const isGraceActive = isPostLoginAdGraceActive();
  
  if (isExempt || isGraceActive) {
    localStorage.setItem("vip_ad_free", "true");
    if (window.popMagic) {
      try {
        window.popMagic.config.capping_enabled = true;
        window.popMagic.open_count = 999999;
      } catch (e) {}
    }
  } else {
    localStorage.removeItem("vip_ad_free");
  }
  return isExempt || isGraceActive;
}
