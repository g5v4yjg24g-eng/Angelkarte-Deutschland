// Bildschirmaufnahme für den Split-Screen-Clip „Pause“ (HyperFrames-Projekt marketing/videos/clips-app):
// echte Live-App, laufende Session mit Beispieldaten → „Pause“ tippen → 15 Minuten später → „Weiter angeln“.
// Technik wie tools/record-app.mjs (Aufnahme in Zeitlupe, danach beschleunigt), aber mit scharfen Einzelbildern.
// Ergebnis: clips-app/assets/app-pause.mp4 und assets/app-pause.json (Zeitpunkte in Sekunden).
// Aufruf (Repo-Root): node marketing/tools/record-pause.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from '../../node_modules/.pnpm/node_modules/playwright/index.mjs';
import { BASE, HOME, WATER, demoData, seed, waitApp } from './demo.mjs';

const root = new URL('../', import.meta.url).pathname;
const build = `${root}videos/_build/pause/`;
const assets = `${root}videos/clips-app/assets/`;
mkdirSync(assets, { recursive: true });
rmSync(build, { recursive: true, force: true });
mkdirSync(`${build}frames`, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--lang=de-DE'],
  env: { ...process.env, LANG: 'de_DE.UTF-8', LANGUAGE: 'de' },
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'de-DE', timezoneId: 'Europe/Berlin',
  geolocation: HOME, permissions: ['geolocation'], colorScheme: 'light', serviceWorkers: 'block',
});
const page = await ctx.newPage();
// Uhrzeit: 8:17 Uhr am Aufnahmetag; window.__fpJump(min) stellt die Uhr vor (für „15 Minuten später“)
await page.addInitScript(() => {
  let offset = Date.parse('2026-10-24T08:17:00+02:00') - Date.now();
  const RealDate = Date;
  class ShiftedDate extends RealDate {
    constructor(...a) {
      super(...(a.length ? a : [RealDate.now() + offset]));
    }
    static now() {
      return RealDate.now() + offset;
    }
  }
  globalThis.Date = ShiftedDate;
  const st = setTimeout;
  const si = setInterval;
  const intervals = new Set();
  globalThis.setTimeout = (fn, ms = 0, ...a) => st(fn, ms * (globalThis.__fpSlow ?? 1), ...a);
  globalThis.setInterval = (fn, ms = 0, ...a) => {
    intervals.add(fn);
    return si(fn, ms * (globalThis.__fpSlow ?? 1), ...a);
  };
  // Uhr vorstellen und laufende Dauern sofort neu berechnen (useNow tickt sonst nur alle 30 s)
  globalThis.__fpJump = (min) => {
    offset += min * 60000;
    for (const fn of intervals) if (typeof fn === 'function') fn();
  };
});
const go = async (path) => {
  await page.goto(new URL(path, BASE).href);
  await waitApp(page);
};

// Beispieldaten + laufende Session seit 7:05 Uhr mit zwei Einträgen
const data = demoData();
const meta = { createdAt: '2026-10-24T05:05:00+00:00', updatedAt: '2026-10-24T05:05:00+00:00', rev: 0 };
data.sessions.push({ id: 'demo-run', ...meta, startAt: '2026-10-24T05:05:00+00:00', tz: 'Europe/Berlin', ...WATER, title: 'Morgens am Steg' });
data.catches.push(
  { id: 'demo-run-1', ...meta, outcome: 'caught', at: '2026-10-24T05:31:00+00:00', tz: 'Europe/Berlin', sessionId: 'demo-run', stateCode: 'NW',
    position: { lat: 51.4838, lng: 8.1185, source: 'map-tap' }, ...WATER, method: 'dropshot', speciesId: 'perch', lengthCm: 27, lengthMethod: 'measured', released: 'released',
    bait: { name: 'Dropshot-Shad 7 cm', type: 'softbait', color: 'Natur' } },
  { id: 'demo-run-2', ...meta, outcome: 'missed_bite', at: '2026-10-24T05:58:00+00:00', tz: 'Europe/Berlin', sessionId: 'demo-run', stateCode: 'NW',
    position: { lat: 51.4839, lng: 8.1187, source: 'map-tap' }, ...WATER, method: 'dropshot',
    bait: { name: 'Dropshot-Shad 7 cm', type: 'softbait', color: 'Natur' } },
);
await go('./fangbuch');
await seed(page, data);
await page.evaluate(async () => {
  localStorage.setItem('fangpunkt.locHintSeen', '1');
  const req = indexedDB.open('fangpunkt');
  const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
  await new Promise((res) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key: 'weatherEnabled', value: false });
    tx.oncomplete = res;
  });
  db.close();
});
await go('./fangbuch/sessions/demo-run');
await page.getByRole('button', { name: 'Pause', exact: true }).waitFor();
await page.waitForTimeout(1500);

// Tipp-Anzeige (nur in der Aufnahme)
await page.addStyleTag({
  content: `.fp-tap{position:fixed;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:50%;background:rgba(242,153,74,.45);
  border:3px solid #F2994A;pointer-events:none;z-index:99999;animation:fp-tap .7s ease-out forwards}
  @keyframes fp-tap{from{transform:scale(.4);opacity:1}to{transform:scale(1.4);opacity:0}}`,
});
await page.evaluate(() =>
  document.addEventListener('pointerdown', (e) => {
    const d = document.createElement('div');
    d.className = 'fp-tap';
    d.style.left = `${e.clientX}px`;
    d.style.top = `${e.clientY}px`;
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 800);
  }, true),
);

const SLOW = 5;
const cdp = await ctx.newCDPSession(page);
await cdp.send('Animation.enable');
await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 / SLOW });
await page.evaluate((k) => (window.__fpSlow = k), SLOW);
// Einzelbilder per captureScreenshot in Gerätepixeln (780 × 1688); der Screencast liefert headless nur 390 px Breite
const frames = [];
let recording = true;
const t0 = Date.now();
const grab = (async () => {
  while (recording) {
    const t = (Date.now() - t0) / 1000 / SLOW;
    const { data: img } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 390, height: 844, scale: 2 } });
    const file = `${build}frames/${String(frames.length).padStart(5, '0')}.jpg`;
    writeFileSync(file, Buffer.from(img, 'base64'));
    frames.push({ file, t });
  }
})();
const startWall = t0;
const mark = {};
const stamp = (k) => (mark[k] = (Date.now() - startWall) / 1000 / SLOW);
const pause = (ms) => page.waitForTimeout(ms * SLOW);

await pause(1500);
stamp('pause');
await page.getByRole('button', { name: 'Pause', exact: true }).click();
await pause(2600);
stamp('jump');
await page.evaluate(() => window.__fpJump(15));
await pause(1200);
stamp('resume');
await page.getByRole('button', { name: 'Weiter angeln' }).click();
await pause(2400);
stamp('end');
recording = false;
await grab;
await ctx.close();
await browser.close();
if (frames.length < 20) throw new Error(`Zu wenige Bilder aufgenommen (${frames.length})`);
const recLen = Math.max(mark.end, frames.at(-1).t + 0.2);
let list = 'ffconcat version 1.0\n';
frames.forEach((f, i) => {
  const next = i + 1 < frames.length ? frames[i + 1].t : recLen;
  list += `file '${f.file}'\nduration ${Math.max(next - f.t, 0.001).toFixed(3)}\n`;
});
list += `file '${frames.at(-1).file}'\n`;
writeFileSync(`${build}frames.txt`, list);
console.log(`Aufnahme: ${frames.length} Bilder, ${recLen.toFixed(1)} s`, mark);
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${build}frames.txt`,
  '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-movflags', '+faststart',
  `${assets}app-pause.mp4`], { stdio: 'inherit' });
writeFileSync(`${assets}app-pause.json`, JSON.stringify(Object.fromEntries(Object.entries({ ...mark, duration: recLen }).map(([k, v]) => [k, +v.toFixed(2)])), null, 2) + '\n');
console.log(`${assets}app-pause.mp4`);
