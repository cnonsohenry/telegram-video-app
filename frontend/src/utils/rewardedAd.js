// src/utils/rewardedAd.js

export function showRewardedAdDirect() {
  return new Promise((resolve) => {
    const adUrl = "https://otieu.com/4/9659492";

    // Open ad in new tab / Telegram in-app browser
    window.open(adUrl, "_blank");

    // ⏳ Simple reward confirmation
    // User usually returns within a few seconds
    setTimeout(() => {
      resolve(true);
    }, 4000); // adjust if needed
  });
}
