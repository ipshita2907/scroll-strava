// Scroll Strava — shareable card renderer
// Draws a Strava-style workout card onto a canvas, featuring an "elevation
// ladder": a log-scale climb comparing your scroll distance to real landmarks.

const METERS_PER_PIXEL = 0.0254 / 96;
const KCAL_PER_PIXEL = 0.000012;

// --- Formatting (shared with popup) ---------------------------------------
const metersFrom = (px) => px * METERS_PER_PIXEL;

function formatDistance(px) {
  const m = metersFrom(px);
  if (m >= 1000) return { value: (m / 1000).toFixed(2), unit: "km" };
  if (m >= 1) return { value: m.toFixed(1), unit: "m" };
  return { value: (m * 100).toFixed(0), unit: "cm" };
}
function formatMeters(px) {
  const m = metersFrom(px);
  if (m >= 1000) return (m / 1000).toFixed(1) + " km";
  if (m >= 1) return m.toFixed(0) + " m";
  return (m * 100).toFixed(0) + " cm";
}
function formatTime(ms) {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}
function formatPace(px, ms) {
  const km = metersFrom(px) / 1000;
  if (km <= 0 || ms <= 0) return "–";
  const minPerKm = ms / 1000 / 60 / km;
  if (!isFinite(minPerKm) || minPerKm > 9999) return "–";
  const m = Math.floor(minPerKm);
  const s = Math.round((minPerKm - m) * 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// --- Landmark ladder data --------------------------------------------------
// height in metres, short label, emoji glyph
const LADDER = [
  { h: 0.16, label: "Dollar bill", emoji: "💵", img: "assets/landmarks/dollar-bill.png" },
  { h: 1.7, label: "A person", emoji: "🧍", img: "assets/landmarks/person.png" },
  { h: 18, label: "Brachiosaurus", emoji: "🦕", img: "assets/landmarks/brachiosaurus.png" },
  { h: 93, label: "Statue of Liberty", emoji: "🗽", img: "assets/landmarks/statue-of-liberty.png" },
  { h: 330, label: "Eiffel Tower", emoji: "🗼", img: "assets/landmarks/eiffel-tower.png" },
  { h: 828, label: "Burj Khalifa", emoji: "🏙️", img: "assets/landmarks/burj-khalifa.png" },
  { h: 8848, label: "Mt. Everest", emoji: "🏔️", img: "assets/landmarks/everest.png" },
];

// Optional custom artwork. If a PNG exists at the path above it replaces the
// emoji automatically; otherwise the emoji is used as a fallback.
const assetCache = {};
function loadAsset(key, src) {
  const im = new Image();
  im.onload = () => render();
  im.onerror = () => {};
  im.src = src;
  assetCache[key] = im;
}
LADDER.forEach((l) => l.img && loadAsset(l.label, l.img));
const logoImg = new Image();
logoImg.onload = () => render();
logoImg.src = "assets/logo.png";
function assetReady(im) {
  return im && im.complete && im.naturalWidth > 0;
}
// Draw an image scaled to fit within boxW x boxH, centered on (cx, cy).
function drawFit(ctx, im, cx, cy, boxW, boxH) {
  const s = Math.min(boxW / im.naturalWidth, boxH / im.naturalHeight);
  const w = im.naturalWidth * s;
  const h = im.naturalHeight * s;
  ctx.drawImage(im, cx - w / 2, cy - h / 2, w, h);
}

function captionFor(px) {
  const m = metersFrom(px);
  if (m < 0.16) return "Just getting warmed up.";
  if (m >= 8848) return "You out-scrolled Everest. Seek help. 🏔️";
  let passed = LADDER[0];
  for (const l of LADDER) if (m >= l.h) passed = l;
  return `Taller than the ${passed.label}.`;
}

// --- Canvas drawing helpers ------------------------------------------------
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Log-scale mapping from metres -> y pixel within [yTop, yBottom].
function makeScale(yTop, yBottom) {
  const logMin = Math.log10(0.1);
  const logMax = Math.log10(11000);
  return (h) => {
    const clamped = Math.min(Math.max(h, 0.1), 11000);
    const t = (Math.log10(clamped) - logMin) / (logMax - logMin);
    return yBottom - t * (yBottom - yTop);
  };
}

function drawCard(ctx, W, H, stats, meta) {
  const px = stats.pixels || 0;
  const dist = formatDistance(px);

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#14161a");
  bg.addColorStop(1, "#0a0b0d");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // Soft orange glow behind the ladder base
  const glow = ctx.createRadialGradient(W * 0.32, H * 0.72, 0, W * 0.32, H * 0.72, W * 0.7);
  glow.addColorStop(0, "rgba(252,82,0,0.20)");
  glow.addColorStop(1, "rgba(252,82,0,0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  const pad = Math.round(W * 0.075);
  let y = pad;

  // --- Header ---
  const logoSize = Math.round(W * 0.052);
  if (assetReady(logoImg)) {
    drawFit(ctx, logoImg, pad + logoSize / 2, y + logoSize / 2, logoSize, logoSize);
  } else {
    ctx.fillStyle = "#fc5200";
    roundRect(ctx, pad, y, logoSize, logoSize, logoSize * 0.28);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `700 ${Math.round(logoSize * 0.72)}px -apple-system, sans-serif`;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText("≣", pad + logoSize / 2, y + logoSize / 2 + 1);
  }

  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "#f5f6f7";
  ctx.font = `800 ${Math.round(W * 0.036)}px -apple-system, sans-serif`;
  ctx.fillText("SCROLL STRAVA", pad + logoSize + Math.round(W * 0.03), y + logoSize / 2);

  ctx.textAlign = "right";
  ctx.fillStyle = "#9aa0a6";
  ctx.font = `600 ${Math.round(W * 0.028)}px -apple-system, sans-serif`;
  ctx.fillText(meta.dateLabel, W - pad, y + logoSize / 2);

  y += logoSize + Math.round(W * 0.07);

  // --- Hero distance ---
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "#9aa0a6";
  ctx.font = `700 ${Math.round(W * 0.03)}px -apple-system, sans-serif`;
  ctx.fillText(meta.rangeLabel.toUpperCase() + " · DISTANCE SCROLLED", pad, y);
  y += Math.round(W * 0.15);

  ctx.fillStyle = "#ffffff";
  const heroSize = Math.round(W * 0.165);
  ctx.font = `800 ${heroSize}px -apple-system, sans-serif`;
  ctx.fillText(dist.value, pad, y);
  const heroW = ctx.measureText(dist.value).width;
  ctx.fillStyle = "#fc5200";
  ctx.font = `800 ${Math.round(heroSize * 0.42)}px -apple-system, sans-serif`;
  ctx.fillText(dist.unit, pad + heroW + Math.round(W * 0.02), y);

  y += Math.round(W * 0.078);
  ctx.fillStyle = "#ff8b5e";
  ctx.font = `600 ${Math.round(W * 0.034)}px -apple-system, sans-serif`;
  ctx.fillText(captionFor(px), pad, y);

  // --- Single landmark comparison ---
  const statsTop = H - Math.round(H * 0.185);
  const regionTop = y + Math.round(H * 0.04);
  const regionBottom = statsTop - Math.round(H * 0.05);
  const regionH = regionBottom - regionTop;
  const cx = W / 2;

  // Pick the tallest landmark you've surpassed (or the smallest if under it).
  const curM = metersFrom(px);
  let mark = LADDER[0];
  for (const l of LADDER) if (curM >= l.h) mark = l;
  const mult = curM / mark.h;
  const multStr = mult >= 10 ? Math.round(mult).toString() : mult.toFixed(1);

  // Size the artwork + multiplier as one vertical group centered in the region.
  // The landmark is the hero: large and central, with the multiplier beneath.
  const multFont = Math.min(Math.round(W * 0.11), Math.round(regionH * 0.22));
  const multCap = Math.round(multFont * 0.72);
  const artBox = Math.min(Math.round(W * 0.54), Math.round(regionH * 0.74));
  const groupGap = Math.round(W * 0.03);
  const groupH = artBox + groupGap + multCap;
  const groupTop = regionTop + (regionH - groupH) / 2;
  const artCenterY = groupTop + artBox / 2;
  const multCenterY = groupTop + artBox + groupGap + multCap / 2;

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const artImg = assetCache[mark.label];
  if (assetReady(artImg)) {
    drawFit(ctx, artImg, cx, artCenterY, artBox, artBox);
  } else {
    ctx.fillStyle = "#fff";
    ctx.font = `${Math.round(artBox * 0.8)}px -apple-system, "Apple Color Emoji", sans-serif`;
    ctx.fillText(mark.emoji, cx, artCenterY);
  }

  ctx.fillStyle = "#fc5200";
  ctx.font = `800 ${multFont}px -apple-system, sans-serif`;
  ctx.fillText(multStr + "×", cx, multCenterY);

  // --- Stats row ---
  const cells = [
    { label: "MOVING TIME", value: formatTime(stats.activeMs || 0) },
    { label: "PACE", value: formatPace(px, stats.activeMs || 0) + " /km" },
    { label: "THUMB CAL", value: (px * KCAL_PER_PIXEL >= 10 ? (px * KCAL_PER_PIXEL).toFixed(0) : (px * KCAL_PER_PIXEL).toFixed(1)) + " kcal" },
    { label: "FLICKS", value: (stats.flicks || 0).toLocaleString() },
  ];
  const gap = Math.round(W * 0.03);
  const cellW = (W - pad * 2 - gap * 3) / 4;
  ctx.strokeStyle = "rgba(255,255,255,0.10)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad, statsTop - Math.round(H * 0.02));
  ctx.lineTo(W - pad, statsTop - Math.round(H * 0.02));
  ctx.stroke();

  for (let i = 0; i < cells.length; i++) {
    const cx = pad + i * (cellW + gap);
    ctx.textAlign = "left";
    ctx.fillStyle = "#9aa0a6";
    ctx.font = `700 ${Math.round(W * 0.023)}px -apple-system, sans-serif`;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(cells[i].label, cx, statsTop + Math.round(H * 0.025));
    ctx.fillStyle = "#ffffff";
    ctx.font = `800 ${Math.round(W * 0.038)}px -apple-system, sans-serif`;
    ctx.fillText(cells[i].value, cx, statsTop + Math.round(H * 0.075));
  }

}

// --- App wiring ------------------------------------------------------------
const canvas = document.getElementById("card");
const ctx = canvas.getContext("2d");

let state = null;
let today = null;
let range = new URLSearchParams(location.search).get("range") || "today";
let format = "story";

function statsForRange() {
  if (!state) return { pixels: 0, activeMs: 0, flicks: 0 };
  if (range === "lifetime") return state.lifetime;
  return state.daily[today] || { pixels: 0, activeMs: 0, flicks: 0 };
}

function render() {
  const W = 1080;
  const H = format === "story" ? 1920 : 1080;
  canvas.width = W;
  canvas.height = H;

  const meta = {
    rangeLabel: range === "lifetime" ? "All-time" : "Today",
    dateLabel:
      range === "lifetime"
        ? "All-time"
        : new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }),
  };
  drawCard(ctx, W, H, statsForRange(), meta);
}

function load() {
  chrome.runtime.sendMessage({ type: "GET_STATE" }, (resp) => {
    if (chrome.runtime.lastError || !resp) return;
    state = resp.state;
    today = resp.today;
    // sync active range button to the query param
    document.querySelectorAll("#range-seg .seg-btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.range === range);
    });
    render();
  });
}

// Range toggle
document.querySelectorAll("#range-seg .seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#range-seg .seg-btn").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    range = btn.dataset.range;
    render();
  });
});
// Format toggle
document.querySelectorAll("#format-seg .seg-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll("#format-seg .seg-btn").forEach((b) => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    format = btn.dataset.format;
    render();
  });
});

// Download
document.getElementById("download").addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `scroll-strava-${range}-${(today || "card")}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
});

// Copy to clipboard
document.getElementById("copy").addEventListener("click", async () => {
  const hint = document.getElementById("hint");
  try {
    const blob = await new Promise((res) => canvas.toBlob(res, "image/png"));
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    hint.textContent = "Copied! Paste it anywhere.";
  } catch (e) {
    hint.textContent = "Copy not supported here — use Download instead.";
  }
  setTimeout(() => (hint.textContent = "Drop it straight into your Instagram story."), 2500);
});

// Fonts (esp. emoji) may load after first paint; re-render once ready.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(render);
}

load();
