export function showRewardedAdDirect() {
  return new Promise((resolve) => {
    if (!window.Telegram?.WebApp) {
      window.open("https://otieu.com/4/9659492", "_blank");
      resolve();
      return;
    }

    window.Telegram.WebApp.openLink(
      "https://otieu.com/4/9659492",
      { try_instant_view: false }
    );

    // Reward when user returns
    const onFocus = () => {
      window.removeEventListener("focus", onFocus);
      resolve(true);
    };

    window.addEventListener("focus", onFocus);
  });
}
