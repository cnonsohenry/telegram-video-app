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
 * Check if the user is eligible for an ad and triggers the smartlink if so.
 * Returns true if an ad was displayed, false if skipped.
 */
export async function triggerSmartlinkIfEligible(user) {
  // 1. VIP / Subscriber / Creator / Admin Exemption
  if (isUserAdExempt(user)) {
    return false;
  }

  // 2. Increment global video watch count
  const rawCount = parseInt(localStorage.getItem("ad_frequency_counter") || "0", 10);
  const currentCount = isNaN(rawCount) ? 0 : rawCount;
  const nextCount = currentCount + 1;
  localStorage.setItem("ad_frequency_counter", nextCount.toString());

  // 3. Frequency check (e.g. video #6, #12, #18)
  const frequency = getAdFrequency();
  if (nextCount < frequency || nextCount % frequency !== 0) {
    return false;
  }

  // 4. Cooldown time check (prevents rapid-fire popups if browsing quickly)
  const lastAdTime = parseInt(localStorage.getItem("last_smartlink_timestamp") || "0", 10);
  const now = Date.now();
  const cooldownMs = getMinCooldownMs();
  if (!isNaN(lastAdTime) && lastAdTime > 0 && (now - lastAdTime) < cooldownMs) {
    return false;
  }

  // 5. Eligible! Record timestamp and open smartlink
  localStorage.setItem("last_smartlink_timestamp", now.toString());

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
 * Directly opens the smartlink in a new tab or via Telegram WebApp
 */
export function openSmartlink() {
  const adUrl = getSmartlinkUrl();

  if (window.Telegram?.WebApp?.openLink) {
    window.Telegram.WebApp.openLink(adUrl, {
      try_instant_view: false,
    });
  } else {
    window.open(adUrl, "_blank");
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
  if (isExempt) {
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
  return isExempt;
}
