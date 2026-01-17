import createAdHandler from "monetag-tg-sdk";

const ZONE_ID = "Y10479652";

let adHandler = null;

export function initRewardedAd() {
  if (!adHandler) {
    adHandler = createAdHandler(ZONE_ID);
  }
  return adHandler;
}

export function preloadRewardedAd(ymid) {
  const handler = initRewardedAd();
  return handler({ type: "preload", ymid });
}

export function showRewardedAd(ymid) {
  const handler = initRewardedAd();
  return handler({ ymid });
}
