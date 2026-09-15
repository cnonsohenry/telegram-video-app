/**
 * adReturnWatcher
 * A robust watcher that resolves when the user returns to the app.
 * Uses multiple event listeners to ensure compatibility across iOS/Android,
 * with a 4.5s safety fallback timeout so video playback never hangs.
 */
export function adReturnWatcher() {
  return new Promise((resolve) => {
    let fallbackTimer = null;

    const cleanup = () => {
      if (fallbackTimer) {
        clearTimeout(fallbackTimer);
        fallbackTimer = null;
      }
      window.removeEventListener("focus", handleReturn);
      window.removeEventListener("pageshow", handleReturn);
      document.removeEventListener("visibilitychange", handleReturn);
    };

    const handleReturn = () => {
      // Check if the page is actually visible to avoid false positives
      if (document.visibilityState === "visible") {
        cleanup();
        resolve();
      }
    };

    // 1. Most reliable for modern browsers/Android
    document.addEventListener("visibilitychange", handleReturn);
    
    // 2. Best for iOS Safari and returning from background
    window.addEventListener("pageshow", handleReturn);
    
    // 3. Backup for specific WebView environments
    window.addEventListener("focus", handleReturn);

    // 4. Safety timeout: If user never switches back or popup was blocked, resolve after 4.5s
    fallbackTimer = setTimeout(() => {
      cleanup();
      resolve();
    }, 4500);
  });
}