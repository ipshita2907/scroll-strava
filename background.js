// Scroll Strava — background service worker
// Receives scroll deltas from content scripts and maintains lifetime + daily
// totals in chrome.storage.local. All writes are serialized through a single
// promise chain so concurrent messages can't clobber each other.

const DEFAULT_STATE = {
  lifetime: { pixels: 0, activeMs: 0, flicks: 0 },
  daily: {}, // 'YYYY-MM-DD' -> { pixels, activeMs, flicks }
  installedAt: null,
};

const METERS_PER_PIXEL = 0.0254 / 96;

function todayKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

async function getState() {
  const stored = await chrome.storage.local.get("state");
  return stored.state || { ...DEFAULT_STATE, installedAt: Date.now() };
}

async function setState(state) {
  await chrome.storage.local.set({ state });
}

// --- Serialized write queue ------------------------------------------------
// Ensures read-modify-write mutations run one at a time.
let queue = Promise.resolve();
function enqueue(mutator) {
  const run = queue.then(async () => {
    const state = await getState();
    const result = await mutator(state);
    await setState(state);
    return result;
  });
  // Keep the chain alive even if a mutation throws.
  queue = run.catch(() => {});
  return run;
}

// --- Live badge ------------------------------------------------------------
function distanceLabel(pixels) {
  const m = pixels * METERS_PER_PIXEL;
  if (m >= 1000) return (m / 1000).toFixed(1) + "k"; // km
  if (m >= 1) return Math.round(m) + "m";
  return ""; // too small to bother
}

async function updateBadge(state) {
  try {
    const today = state.daily[todayKey()] || { pixels: 0 };
    await chrome.action.setBadgeBackgroundColor({ color: "#FC5200" });
    await chrome.action.setBadgeText({ text: distanceLabel(today.pixels) });
  } catch (_) {
    // action APIs may be unavailable during startup; ignore.
  }
}

chrome.runtime.onInstalled.addListener(() => {
  enqueue((state) => {
    if (!state.installedAt) state.installedAt = Date.now();
  }).then(getState).then(updateBadge);
});

chrome.runtime.onStartup.addListener(() => {
  getState().then(updateBadge);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (!msg) return;

  if (msg.type === "SCROLL_DELTA") {
    const px = Math.max(0, Number(msg.pixels) || 0);
    const ms = Math.max(0, Number(msg.activeMs) || 0);
    const fl = Math.max(0, Number(msg.flicks) || 0);

    enqueue((state) => {
      const key = todayKey();
      if (!state.daily[key]) state.daily[key] = { pixels: 0, activeMs: 0, flicks: 0 };

      state.lifetime.pixels += px;
      state.lifetime.activeMs += ms;
      state.lifetime.flicks += fl;

      state.daily[key].pixels += px;
      state.daily[key].activeMs += ms;
      state.daily[key].flicks += fl;

      // Keep only the last ~60 days of daily history.
      const days = Object.keys(state.daily).sort();
      while (days.length > 60) delete state.daily[days.shift()];
    }).then(getState).then(updateBadge);

    return false; // no response needed
  }

  if (msg.type === "GET_STATE") {
    getState().then((state) => sendResponse({ state, today: todayKey() }));
    return true; // async response
  }

  if (msg.type === "RESET_TODAY") {
    enqueue((state) => {
      const key = todayKey();
      const removed = state.daily[key] || { pixels: 0, activeMs: 0, flicks: 0 };
      state.lifetime.pixels = Math.max(0, state.lifetime.pixels - removed.pixels);
      state.lifetime.activeMs = Math.max(0, state.lifetime.activeMs - removed.activeMs);
      state.lifetime.flicks = Math.max(0, state.lifetime.flicks - removed.flicks);
      state.daily[key] = { pixels: 0, activeMs: 0, flicks: 0 };
    }).then(getState).then((state) => {
      updateBadge(state);
      sendResponse({ ok: true });
    });
    return true;
  }
});
