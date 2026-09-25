# Scroll Strava 🧡

Track your scrolling like a workout. Distance, moving time, pace, and (joke)
thumb calories — your daily doomscroll, quantified in a Strava-style card.

Works on **every site, including Instagram web**, since it measures real scroll
movement in the page rather than relying on any platform API.

## Download & install

This extension isn't on the Chrome Web Store — you install it directly (takes ~30 seconds):

1. **Download it:**
   - **Easiest:** grab the ZIP from the [latest release](https://github.com/ipshita2907/scroll-strava/releases/latest) and unzip it, **or**
   - Click the green **Code ▾** button on the repo → **Download ZIP**, then unzip, **or**
   - `git clone https://github.com/ipshita2907/scroll-strava.git`
2. Open Chrome and go to `chrome://extensions`.
3. Turn on **Developer mode** (toggle, top-right).
4. Click **Load unpacked** and select the unzipped `scroll-strava` folder.
5. Pin the icon, then scroll any page and click it to see your stats.

> Chrome shows unpacked extensions with a "Developer mode" note — that's normal for extensions installed outside the Web Store. Everything runs **locally**; no data leaves your machine.

## Metrics

- **Distance scrolled** — total on-screen scroll travel converted to real-world
  distance (96px = 1 inch), with landmark comparisons ("You've out-scrolled the
  Statue of Liberty").
- **Moving time** — time spent actively scrolling.
- **Pace** — Strava-style minutes per km of scroll.
- **Thumb calories** — a playful calorie estimate based on scroll volume.
- Plus average scroll speed (px/s) and total "flicks".

Toggle between **Today** and **All-time** in the popup. "Reset today" clears the
current day.

## Share card 📤

Click **Share card** in the popup to open a full-resolution, Strava-style
workout card you can **Download** as a PNG or **Copy** to the clipboard and drop
straight into an Instagram story.

The centerpiece is a single **landmark comparison**: your scroll distance shown
as a big emoji plus a multiplier — e.g. 🗽 **1.1×** the Statue of Liberty. It
automatically picks the tallest landmark you've surpassed (dollar bill → a
person → Brachiosaurus → Statue of Liberty → Eiffel Tower → Burj Khalifa →
Mt. Everest).

- Two export sizes: **Story 9:16** (1080×1920) and **Square 1:1** (1080×1080).
- Edit the `LADDER` array in `share.js` to add your own landmarks.

### Custom landmark artwork

Drop a PNG at the path listed in `share.js` (e.g.
`assets/landmarks/statue-of-liberty.png`) and it replaces the emoji
automatically; if it's missing, the emoji is used as a fallback. Also
`assets/logo.png` for the card header.

Recommended style: **single-weight line-art / vector illustration** (like a
Strava route map). Because the card background is near-black, strokes must be
**white (#FFFFFF) or brand orange (#FC5200)** — black line art will be
invisible. Export at 512×512 PNG with a transparent background, subject
centered, and keep a consistent stroke weight across all seven so they read as
a set.

## How it works

- `content.js` runs on every page, measures actual scroll deltas (window +
  inner scroll containers, keyboard, wheel, touch), and batches them to the
  background worker every couple of seconds.
- `background.js` (service worker) keeps lifetime + daily totals in
  `chrome.storage.local`.
- `popup.html/.css/.js` render the stat card and do all the fun conversions.

Everything is stored **locally on your machine** — no accounts, no network calls.

## Tuning the whimsy

Open `popup.js` and tweak:

- `KCAL_PER_PIXEL` — how generous the thumb-calorie math is.
- `LANDMARKS` — the distance comparison lines.
- `METERS_PER_PIXEL` — the distance model (default is physically accurate).

## License

[MIT](LICENSE) — free to use, modify, and share.
