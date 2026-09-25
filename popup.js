// Scroll Strava — popup logic

// --- Conversions -----------------------------------------------------------
// 96 CSS pixels = 1 inch = 0.0254 m, so 1px of on-screen scroll travel:
const METERS_PER_PIXEL = 0.0254 / 96; // ≈ 0.0002646 m
// Playful "thumb calorie" model: heavy day (~500k px) ≈ 6 kcal.
const KCAL_PER_PIXEL = 0.000012;

let currentRange = "today";
let cachedData = null;

function metersFrom(pixels) {
  return pixels * METERS_PER_PIXEL;
}

function formatDistance(pixels) {
  const m = metersFrom(pixels);
  if (m >= 1000) return { value: (m / 1000).toFixed(2), unit: "km" };
  if (m >= 1) return { value: m.toFixed(1), unit: "m" };
  return { value: (m * 100).toFixed(0), unit: "cm" };
}

function formatTime(ms) {
  const totalSec = Math.round(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function formatPace(pixels, activeMs) {
  const km = metersFrom(pixels) / 1000;
  if (km <= 0 || activeMs <= 0) return "–";
  const minPerKm = activeMs / 1000 / 60 / km;
  if (!isFinite(minPerKm) || minPerKm > 9999) return "–";
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function avgSpeed(pixels, activeMs) {
  if (activeMs <= 0) return 0;
  return Math.round(pixels / (activeMs / 1000));
}

// Balanced whimsy: contextual landmark comparisons for the distance.
const LANDMARKS = [
  { m: 0.3, text: "About one dollar bill. Just getting started." },
  { m: 1.8, text: "Taller than you. Respectable warm-up." },
  { m: 8, text: "A giraffe's worth of scroll." },
  { m: 30, text: "The Statue of Liberty's torch, reached." },
  { m: 93, text: "You've out-scrolled the Statue of Liberty." },
  { m: 300, text: "Eiffel Tower: conquered by thumb." },
  { m: 828, text: "Burj Khalifa height. Take a breath." },
  { m: 1600, text: "A full mile of feed. Elite doomscroller." },
  { m: 8848, text: "You just scrolled Mount Everest. Seek help (or a medal)." },
];

function landmarkFor(pixels) {
  const m = metersFrom(pixels);
  if (m < 0.3) return "Warming up your thumb…";
  let best = LANDMARKS[0];
  for (const l of LANDMARKS) {
    if (m >= l.m) best = l;
  }
  return best.text;
}

function statsForRange(data) {
  if (currentRange === "lifetime") return data.state.lifetime;
  return data.state.daily[data.today] || { pixels: 0, activeMs: 0, flicks: 0 };
}

function render() {
  if (!cachedData) return;
  const s = statsForRange(cachedData);

  const dist = formatDistance(s.pixels);
  document.getElementById("distance").textContent = dist.value;
  document.getElementById("distance-unit").textContent = dist.unit;
  document.getElementById("landmark").textContent = landmarkFor(s.pixels);

  document.getElementById("time").textContent = formatTime(s.activeMs);

  const pace = formatPace(s.pixels, s.activeMs);
  document.getElementById("pace").innerHTML =
    pace === "–" ? '–<span class="stat-unit">/km</span>' : `${pace}<span class="stat-unit">/km</span>`;

  const kcal = s.pixels * KCAL_PER_PIXEL;
  const kcalStr = kcal >= 10 ? kcal.toFixed(0) : kcal.toFixed(1);
  document.getElementById("calories").innerHTML = `${kcalStr}<span class="stat-unit">kcal</span>`;

  document.getElementById("speed").textContent = avgSpeed(s.pixels, s.activeMs).toLocaleString();
  document.getElementById("flicks").textContent = (s.flicks || 0).toLocaleString();

  // Footer note
  const since = document.getElementById("since");
  if (currentRange === "lifetime" && cachedData.state.installedAt) {
    const d = new Date(cachedData.state.installedAt);
    since.textContent = `Since ${d.toLocaleDateString()}`;
  } else {
    since.textContent = "";
  }
}

function load() {
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (resp) => {
    if (chrome.runtime.lastError || !resp) return;
    cachedData = resp;
    render();
  });
}

// Tabs
document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.remove("is-active"));
    tab.classList.add("is-active");
    currentRange = tab.dataset.range;
    render();
  });
});

// Share card — open the full-res share page for the current range
document.getElementById("share").addEventListener("click", () => {
  const url = chrome.runtime.getURL(`share.html?range=${currentRange}`);
  chrome.tabs.create({ url });
});

// Reset today
document.getElementById("reset").addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "RESET_TODAY" }, () => load());
});

// Live-ish refresh while popup is open.
load();
setInterval(load, 1500);
