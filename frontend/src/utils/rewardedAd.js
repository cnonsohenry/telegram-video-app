export function showRewardedAdDirect() {
  return new Promise((resolve) => {
    const adUrl = "https://otieu.com/4/9659492";

    if (window.Telegram?.WebApp?.platform === "ios") {
      // iOS: use window.open (less Telegram prompt issues)
      const win = window.open(adUrl, "_blank");

      const onFocus = () => {
        window.removeEventListener("focus", onFocus);
        resolve(true);
      };

      window.addEventListener("focus", onFocus);
      return;
    }

    // Android / Desktop
    window.Telegram.WebApp.openLink(adUrl);

    const onFocus = () => {
      window.removeEventListener("focus", onFocus);
      resolve(true);
    };

    window.addEventListener("focus", onFocus);
  });
}
