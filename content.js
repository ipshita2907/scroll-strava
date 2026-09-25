// Scroll Strava — content script
// Measures actual scroll movement on the page (works for window scroll,
// inner scroll containers, keyboard, wheel, and touch) and reports pixel
// deltas + active-scrolling time up to the background service worker.

(() => {
  "use strict";

  // Accumulators flushed to the background periodically.
  let pixels = 0; // total absolute scroll movement (px) since last flush
  let activeMs = 0; // time spent actively scrolling since last flush
  let flicks = 0; // number of distinct scroll bursts

  // Tracks the last known scroll position of each scroller we've seen so we
  // can compute deltas. Keyed by the scrolling element (window uses a token).
  const WINDOW_KEY = "__window__";
  const lastPos = new Map();

  // Active-time bookkeeping.
  let lastScrollTime = 0;
  const ACTIVE_GAP_MS = 1000; // scrolls within this window count as one burst

  function positionOf(target) {
    if (target === document || target === window || target === document.documentElement || target === document.body) {
      return { key: WINDOW_KEY, top: window.scrollY || document.documentElement.scrollTop || 0 };
    }
    // An inner scroll container (div with overflow, etc.)
    return { key: target, top: target.scrollTop || 0 };
  }

  function onScroll(e) {
    const target = e.target;
    const { key, top } = positionOf(target);

    const prev = lastPos.has(key) ? lastPos.get(key) : top;
    const delta = Math.abs(top - prev);
    lastPos.set(key, top);

    // Ignore absurd jumps (e.g. programmatic anchor jumps) to keep numbers honest.
    if (delta > 0 && delta < 20000) {
      pixels += delta;

      const now = performance.now();
      if (now - lastScrollTime > ACTIVE_GAP_MS) {
        flicks += 1;
      } else {
        activeMs += now - lastScrollTime;
      }
      lastScrollTime = now;
    }
  }

  // Capture phase so we catch scroll events from any nested scroller.
  window.addEventListener("scroll", onScroll, { capture: true, passive: true });

  function flush(reason) {
    if (pixels <= 0 && activeMs <= 0 && flicks <= 0) return;

    const payload = {
      type: "SCROLL_DELTA",
      pixels,
      activeMs: Math.round(activeMs),
      flicks,
      host: location.hostname,
    };

    pixels = 0;
    activeMs = 0;
    flicks = 0;

    try {
      chrome.runtime.sendMessage(payload, () => void chrome.runtime.lastError);
      if (window.__SCROLL_STRAVA_DEBUG) {
        console.debug("[Scroll Strava] flushed", payload.pixels, "px", `(${reason})`);
      }
    } catch (_) {
      // Extension context may be invalidated on reload; ignore.
    }
  }

  // Flush on a timer and when the tab is hidden or closing.
  setInterval(() => flush("interval"), 1000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush("hidden");
  });
  window.addEventListener("pagehide", () => flush("pagehide"));
})();
