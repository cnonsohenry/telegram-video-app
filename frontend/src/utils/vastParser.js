/**
 * frontend/src/utils/vastParser.js
 * Lightweight, native VAST (2.0 - 4.x) XML parser and tracker.
 * 
 * Supports:
 * - Direct InLine ads and multi-depth Wrapper ads (e.g., ExoClick VAST Wrappers).
 * - MP4 MediaFile selection.
 * - ClickThrough & ClickTracking navigation.
 * - IAB Video Tracking Beacons (impression, start, quartiles, complete, skip, errors).
 * - Safe timeouts & fast zero-latency fallbacks.
 */

/**
 * Parse time string (e.g., "00:00:05", "00:00:15.500", or "5s") into seconds.
 */
export function parseVastTime(timeStr, fallback = 5) {
  if (!timeStr) return fallback;
  const str = String(timeStr).trim();
  if (str.includes(":")) {
    const parts = str.split(":").map(Number);
    if (parts.length === 3) {
      return (parts[0] * 3600) + (parts[1] * 60) + Math.floor(parts[2]);
    }
  }
  const parsed = parseFloat(str);
  return isNaN(parsed) || parsed < 0 ? fallback : Math.floor(parsed);
}

/**
 * Send a tracking beacon safely without blocking UI or throwing unhandled errors.
 */
export function sendVastBeacon(url, macros = {}) {
  if (!url || typeof url !== "string") return;

  let targetUrl = url.trim();
  if (!targetUrl) return;

  // Replace standard VAST macros
  targetUrl = targetUrl
    .replace(/\[TIMESTAMP\]/g, Date.now().toString())
    .replace(/\[CACHEBUSTING\]/g, Math.floor(Math.random() * 100000000).toString())
    .replace(/%%CACHEBUSTER%%/g, Math.floor(Math.random() * 100000000).toString());

  if (macros.errorCode) {
    targetUrl = targetUrl.replace(/\[ERRORCODE\]/g, String(macros.errorCode));
  } else {
    targetUrl = targetUrl.replace(/\[ERRORCODE\]/g, "0");
  }

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const sent = navigator.sendBeacon(targetUrl);
      if (sent) return;
    }
    fetch(targetUrl, { mode: "no-cors", keepalive: true, cache: "no-store" }).catch(() => {});
  } catch (e) {
    try {
      const img = new Image();
      img.src = targetUrl;
    } catch (_) {}
  }
}

/**
 * Send multiple tracking beacons.
 */
export function sendVastBeacons(urls, macros = {}) {
  if (!Array.isArray(urls)) return;
  urls.forEach(url => sendVastBeacon(url, macros));
}

/**
 * Recursively fetch and parse a VAST XML tag, unwrapping any <Wrapper> elements.
 */
export async function fetchVastAd(vastUrl, options = {}) {
  const maxDepth = options.maxDepth || 4;
  const timeoutMs = options.timeoutMs || 4000;

  const accumulated = {
    mediaUrl: "",
    clickThroughUrl: "",
    skipOffsetSeconds: 5,
    durationSeconds: 30,
    impressionUrls: [],
    clickTrackingUrls: [],
    errorUrls: [],
    trackingEvents: {
      start: [],
      firstQuartile: [],
      midpoint: [],
      thirdQuartile: [],
      complete: [],
      skip: [],
      progress: []
    }
  };

  let currentUrl = vastUrl;
  let currentDepth = 0;

  while (currentUrl && currentDepth < maxDepth) {
    currentDepth++;
    let xmlText = "";

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(currentUrl, {
        signal: controller.signal,
        credentials: "omit",
        headers: {
          "Accept": "application/xml, text/xml, */*"
        }
      });
      clearTimeout(timer);

      if (!response.ok) {
        console.warn(`[VAST] HTTP error ${response.status} fetching ${currentUrl}`);
        break;
      }

      xmlText = await response.text();
    } catch (fetchErr) {
      console.warn("[VAST] Network or timeout error fetching VAST:", fetchErr.message);
      break;
    }

    if (!xmlText || !xmlText.trim()) {
      break;
    }

    let xmlDoc;
    try {
      const parser = new DOMParser();
      xmlDoc = parser.parseFromString(xmlText, "text/xml");
      if (xmlDoc.querySelector("parsererror")) {
        console.warn("[VAST] XML parsing error");
        break;
      }
    } catch (parseErr) {
      console.warn("[VAST] Failed to parse XML:", parseErr);
      break;
    }

    // 1. Collect top-level Impression beacons
    const impressions = xmlDoc.querySelectorAll("Impression");
    impressions.forEach(el => {
      const u = el.textContent?.trim();
      if (u && !accumulated.impressionUrls.includes(u)) {
        accumulated.impressionUrls.push(u);
      }
    });

    // 2. Collect Error beacons
    const errors = xmlDoc.querySelectorAll("Error");
    errors.forEach(el => {
      const u = el.textContent?.trim();
      if (u && !accumulated.errorUrls.includes(u)) {
        accumulated.errorUrls.push(u);
      }
    });

    // 3. Collect TrackingEvents
    const trackings = xmlDoc.querySelectorAll("Tracking");
    trackings.forEach(el => {
      const eventName = el.getAttribute("event");
      const u = el.textContent?.trim();
      if (eventName && u) {
        if (!accumulated.trackingEvents[eventName]) {
          accumulated.trackingEvents[eventName] = [];
        }
        if (!accumulated.trackingEvents[eventName].includes(u)) {
          accumulated.trackingEvents[eventName].push(u);
        }
      }
    });

    // 4. Collect ClickTracking
    const clickTrackings = xmlDoc.querySelectorAll("ClickTracking");
    clickTrackings.forEach(el => {
      const u = el.textContent?.trim();
      if (u && !accumulated.clickTrackingUrls.includes(u)) {
        accumulated.clickTrackingUrls.push(u);
      }
    });

    // 5. Check for Wrapper vs InLine
    const wrapperUriEl = xmlDoc.querySelector("VASTAdTagURI");
    if (wrapperUriEl && wrapperUriEl.textContent) {
      // It's a Wrapper! Move to next URL
      currentUrl = wrapperUriEl.textContent.trim();
      continue;
    }

    // 6. Check for InLine details
    const linearEl = xmlDoc.querySelector("Linear");
    if (linearEl) {
      // Skip offset
      const skipAttr = linearEl.getAttribute("skipoffset");
      if (skipAttr) {
        accumulated.skipOffsetSeconds = parseVastTime(skipAttr, 5);
      }

      // Duration
      const durationEl = linearEl.querySelector("Duration");
      if (durationEl && durationEl.textContent) {
        accumulated.durationSeconds = parseVastTime(durationEl.textContent, 30);
      }

      // ClickThrough
      const clickThroughEl = linearEl.querySelector("ClickThrough");
      if (clickThroughEl && clickThroughEl.textContent) {
        accumulated.clickThroughUrl = clickThroughEl.textContent.trim();
      }

      // MediaFiles
      const mediaFiles = linearEl.querySelectorAll("MediaFile");
      let selectedMediaUrl = "";
      let bestScore = -1;

      mediaFiles.forEach(mf => {
        const url = mf.textContent?.trim();
        if (!url) return;
        const type = (mf.getAttribute("type") || "").toLowerCase();
        const width = parseInt(mf.getAttribute("width") || "0", 10);
        let score = 0;

        if (type.includes("mp4")) score += 10;
        if (url.toLowerCase().endsWith(".mp4")) score += 5;
        if (width >= 480 && width <= 1080) score += 5;

        if (score > bestScore) {
          bestScore = score;
          selectedMediaUrl = url;
        }
      });

      if (selectedMediaUrl) {
        accumulated.mediaUrl = selectedMediaUrl;
      }
    }

    // Done resolving chain
    break;
  }

  if (!accumulated.mediaUrl) {
    return null;
  }

  return accumulated;
}
