import { useEffect, useState, useCallback } from "react";
import { preloadRewardedAd, showRewardedAd } from "../ads/rewardedAd";

export function useRewardedAd(ymidBase = "default") {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    preloadRewardedAd(ymidBase)
      .then(() => setReady(true))
      .catch(() => setReady(false));
  }, [ymidBase]);

  const showAd = useCallback(
    (ymidSuffix = "") => {
      return showRewardedAd(`${ymidBase}:${ymidSuffix}`);
    },
    [ymidBase]
  );

  return {
    ready,
    showAd,
  };
}
