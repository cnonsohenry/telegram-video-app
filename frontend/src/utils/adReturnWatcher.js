/**
 * adReturnWatcher
 * A robust watcher that resolves when the user returns to the app.
 * Uses multiple event listeners to ensure compatibility across iOS/Android.
 */
export function adReturnWatcher() {
  return new Promise((resolve) => {
    const handleReturn = () => {
      // Check if the page is actually visible to avoid false positives
      if (document.visibilityState === "visible") {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      window.removeEventListener("focus", handleReturn);
      window.removeEventListener("pageshow", handleReturn);
      document.removeEventListener("visibilitychange", handleReturn);
    };

    // 1. Most reliable for modern browsers/Android
    document.addEventListener("visibilitychange", handleReturn);
    
    // 2. Best for iOS Safari and returning from background
    window.addEventListener("pageshow", handleReturn);
    
    // 3. Backup for specific WebView environments
    window.addEventListener("focus", handleReturn);

    // Optional: Safety timeout (e.g., if the user never comes back, 
    // don't leave the promise hanging forever)
    // setTimeout(() => { cleanup(); resolve(); }, 60000); 
  });
}