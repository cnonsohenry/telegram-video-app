export function showRewardedAdDirect({
  minWatchTime = 5000, // 5 seconds minimum
  timeout = 30000      // 30s safety timeout
} = {}) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const startTime = Date.now();

    const finish = (success) => {
      if (resolved) return;
      resolved = true;
      window.removeEventListener("focus", onFocus);
      clearTimeout(timeoutId);
      success ? resolve(true) : reject();
    };

    const onFocus = () => {
      const watchedTime = Date.now() - startTime;
      if (watchedTime >= minWatchTime) {
        finish(true);
      } else {
        finish(false);
      }
    };

    // Open ad
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openLink(
        "https://otieu.com/4/9659492",
        { try_instant_view: false }
      );
    } else {
      window.open("https://otieu.com/4/9659492", "_blank");
    }

    window.addEventListener("focus", onFocus);

    // Safety timeout
    const timeoutId = setTimeout(() => {
      finish(false);
    }, timeout);
  });
}
