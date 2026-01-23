// utils/rewardedAd.js
export function openRewardedAd() {
  const adUrl = "https://www.effectivegatecpm.com/wmmi5uv2w5?key=23fa23a9f5a389595c81f702d570419b";

  if (window.Telegram?.WebApp) {
    // MUST be sync inside user click
    window.Telegram.WebApp.openLink(adUrl, {
      try_instant_view: false,
    });
  } else {
    window.open(adUrl, "_blank");
  }
}
