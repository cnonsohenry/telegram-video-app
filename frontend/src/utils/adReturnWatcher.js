/**
 * adReturnWatcher
 * Watches for the user returning to the page after leaving (ad, external link, etc.)
 * Resolves a Promise once the page gains focus again.
 *
 * Usage:
 *   await adReturnWatcher();
 */
export function adReturnWatcher() {
  return new Promise((resolve) => {
    const onFocus = () => {
      window.removeEventListener("focus", onFocus);
      resolve();
    };
    window.addEventListener("focus", onFocus);
  });
}
