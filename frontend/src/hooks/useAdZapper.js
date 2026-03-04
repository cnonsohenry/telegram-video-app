import { useEffect, useRef } from "react";

/**
 * 🛡️ useAdZapper (Upgraded: The Respawner)
 * Memorizes Adsterra scripts, destroys the ads on protected pages, 
 * and re-injects them dynamically when returning to ad-supported pages.
 */
export const useAdZapper = (shouldZap = true) => {
  // 🟢 1. Memory Bank to store Adsterra script URLs
  const adScriptsRef = useRef([]);

  useEffect(() => {
    if (shouldZap) {
      document.body.classList.add("ad-free-mode");

      // 🟢 2. CATCH & MEMORIZE
      // Find Adsterra scripts currently running on the page
      const scripts = document.querySelectorAll('script[src]');
      const foundScripts = [];
      
      scripts.forEach(script => {
        // Adsterra uses specific domain patterns like "topcreativeformat" or random "pl123456.com"
        if (
          script.src.includes('adsterra') || 
          script.src.includes('topcreativeformat') || 
          script.src.match(/\/\/pl\d+\./)
        ) {
          foundScripts.push(script.src);
          script.remove(); // Delete the script tag so we can force a fresh execution later
        }
      });

      // Save unique script URLs to our memory bank
      if (foundScripts.length > 0) {
        adScriptsRef.current = [...new Set([...adScriptsRef.current, ...foundScripts])];
      }

      // 🟢 3. ASSASSINATE
      // Physically destroy the active Ad containers instead of just hiding them
      const zapAds = () => {
        const adElements = document.querySelectorAll(
          'iframe[id^="container-"], div[id^="container-"], [id*="effectivegatecpm"], .social-bar-container, .adsterra-wrapper'
        );
        adElements.forEach(el => el.remove()); 
      };

      zapAds(); // Initial sweep

      // Keep watching just in case Adsterra tries to sneak a late pop-up in
      const observer = new MutationObserver(() => zapAds());
      observer.observe(document.body, { childList: true, subtree: true });

      return () => {
        observer.disconnect();
      };
      
    } else {
      
      // 🟢 4. THE RESPAWN (Back on the Home Page)
      document.body.classList.remove("ad-free-mode");

      // Inject the memorized scripts back into the DOM so they trigger fresh ads!
      if (adScriptsRef.current.length > 0) {
        adScriptsRef.current.forEach(src => {
          // Only inject if it isn't already there to prevent infinite looping
          if (!document.querySelector(`script[src="${src}"]`)) {
            const newScript = document.createElement("script");
            newScript.src = src;
            newScript.async = true;
            document.body.appendChild(newScript);
          }
        });
      }

      // Failsafe: If any leftover hidden containers survived the wipe, clear their inline styles
      const leftoverAds = document.querySelectorAll(
        'iframe[id^="container-"], div[id^="container-"], [id*="effectivegatecpm"], .social-bar-container'
      );
      leftoverAds.forEach(el => {
        el.style.display = '';
        el.style.visibility = '';
      });
    }
  }, [shouldZap]); 
};