import { useEffect } from "react";

/**
 * 🛡️ useAdZapper
 * Uses both CSS class toggling and MutationObserver to keep 
 * specific views clean from Adsterra intrusive elements.
 */
export const useAdZapper = (shouldZap = true) => {
  useEffect(() => {
    // 🟢 1. CSS Toggle (Instant)
    // This activates the rules we just added to index.css
    if (shouldZap) {
      document.body.classList.add("ad-free-mode");
    } else {
      document.body.classList.remove("ad-free-mode");
      return; // If we aren't zapping, stop here
    }

    // 🟢 2. JS Cleanup Crew (For dynamic elements)
    const zapAds = () => {
      const adElements = document.querySelectorAll(
        'iframe[id^="container-"], div[id^="container-"], [id*="effectivegatecpm"], .social-bar-container'
      );
      adElements.forEach(el => {
        // Double-check visibility just in case CSS is bypassed
        if (el.style.display !== 'none') {
          el.style.display = 'none';
          el.style.visibility = 'hidden';
        }
      });
    };

    // Initial zap
    zapAds();

    // Observe changes to catch ads that load late
    const observer = new MutationObserver(() => zapAds());
    observer.observe(document.body, { childList: true, subtree: true });

    // 🟢 3. Cleanup
    return () => {
      observer.disconnect();
      document.body.classList.remove("ad-free-mode");
    };
  }, [shouldZap]); 
};