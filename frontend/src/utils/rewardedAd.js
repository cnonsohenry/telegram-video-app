// utils/rewardedAd.js
export function openRewardedAd() {
  const adUrl = "https://otieu.com/4/9659492";

  if (window.Telegram?.WebApp) {
    // MUST be sync inside user click
    window.Telegram.WebApp.openLink(adUrl, {
      try_instant_view: false,
    });
  } else {
    window.open(adUrl, "_blank");
  }
}
