// Echte App-Bildschirme für das Video aufnehmen: veröffentlichte App (video.config.json → targetUrl),
// Handy-Ansicht 393 × 798 CSS-px bei 3-facher Pixeldichte (iPhone-Größe ohne Statusleiste),
// Beispieldaten aus demo-data.mjs über den normalen Import der App.
// Aufruf: pnpm screenshots   (optional: --only=name1,name2)
// Bewegte Aufnahmen (flight) entstehen Bild für Bild mit angehaltener Seitenuhr, siehe record().
import { chromium } from '@playwright/test';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildBackup, buildDemoData } from './demo-data.mjs';

const root = new URL('..', import.meta.url);
const { targetUrl } = JSON.parse(readFileSync(new URL('video.config.json', root), 'utf8'));
const out = new URL('assets/screenshots/', root).pathname;
mkdirSync(out, { recursive: true });
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const theme = process.argv.find((a) => a.startsWith('--theme='))?.slice(8) ?? 'light';

const LAKE = { lat: 53.4401, lng: 10.1076 };
const demoFile = join(tmpdir(), 'fangpunkt-demo-backup.json');
writeFileSync(demoFile, JSON.stringify(buildBackup(buildDemoData())));

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--lang=de-DE'],
  env: { ...process.env, LANG: 'de_DE.UTF-8' } });
const ctx = await browser.newContext({
  viewport: { width: 393, height: 798 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
  colorScheme: theme,
  serviceWorkers: 'block',
  geolocation: { latitude: 53.4415, longitude: 10.1052, accuracy: 8 },
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
});
// Bildgenaue Aufnahme: Die Uhr der Seite (performance.now, rAF) wird während einer Aufnahme angehalten
// und pro Videobild um genau 1/30 s weitergestellt. So laufen Kartenflug und Animationen im Video
// flüssig mit 30 fps, egal wie langsam der Software-Renderer in der Cloud-Umgebung zeichnet.
await ctx.addInitScript(() => {
  const realNow = performance.now.bind(performance);
  let frozen = null;
  let offset = 0;
  const now = () => frozen ?? realNow() - offset;
  window.__clock = {
    freeze() { frozen = now(); },
    advance(ms) { frozen += ms; },
    release() { offset = realNow() - frozen; frozen = null; },
  };
  performance.now = now;
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = (cb) => raf(() => cb(now()));
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.warn('Seitenfehler:', e.message));

const ready = () =>
  page.waitForFunction(() => document.documentElement.dataset.intro === 'done', null, { timeout: 30_000 });
async function dismissReminder() {
  const later = page.getByRole('button', { name: 'Später' });
  if (await later.isVisible().catch(() => false)) await later.click();
}
async function open(path, wait = 2500) {
  await page.goto(targetUrl + path);
  await ready();
  await page.waitForTimeout(wait);
  await dismissReminder();
  await page.waitForTimeout(400);
}
async function openMap(view, wait = 7000) {
  await page.evaluate((v) => localStorage.setItem('fangpunkt.mapView', JSON.stringify(v)), view);
  await open('', wait);
}
const shot = async (name) => {
  await page.screenshot({ path: join(out, `${theme}-${name}.png`) });
  console.log('✓', `${theme}-${name}.png`);
};
// Bildschirmpunkt (CSS-px) eines Längen-/Breitengrads bei bekannter Kartenmitte/Zoom (Web-Mercator, 512er-Kacheln)
async function pointOf(view, ll) {
  const box = await page.locator('.maplibregl-canvas').boundingBox();
  const scale = 512 * 2 ** view.zoom;
  const x = (lng) => ((lng + 180) / 360) * scale;
  const y = (lat) => ((1 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / Math.PI) / 2) * scale;
  return {
    x: box.x + box.width / 2 + x(ll.lng) - x(view.lng),
    y: box.y + box.height / 2 + y(ll.lat) - y(view.lat),
  };
}

// Bildschirmaufnahme Bild für Bild → MP4 mit 30 fps. timeline: [{ at: Sekunden, run: async () => … }]
const FPS = 30;
const REC_DPR = 2; // 786 × 1596 px – mehr als die Handy-Anzeige im Video braucht, halb so viel Rechenlast wie 3×
async function record(name, timeline, durationS) {
  const dir = join(out, `${theme}-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Animation.enable');
  const actions = [...timeline].sort((x, y) => x.at - y.at);
  let next = 0;
  let realPerFrame = 200;
  await page.evaluate(() => window.__clock.freeze());
  const frames = Math.round(durationS * FPS);
  for (let f = 0; f < frames; f++) {
    const t = f / FPS;
    while (next < actions.length && actions[next].at <= t) await actions[next++].run();
    const started = Date.now();
    // CSS-Animationen (z. B. Blätter) laufen in Echtzeit: Tempo an die Aufnahmedauer pro Bild anpassen
    await cdp.send('Animation.setPlaybackRate', { playbackRate: Math.min(1, 1000 / FPS / realPerFrame) });
    // Uhr eine Bildlänge vor, dann warten, bis zwei Bilder gezeichnet sind (das erste enthält den neuen Stand)
    await page.evaluate(
      (ms) => new Promise((r) => { window.__clock.advance(ms); requestAnimationFrame(() => requestAnimationFrame(r)); }),
      1000 / FPS,
    );
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: 393, height: 798, scale: REC_DPR },
    });
    writeFileSync(join(dir, `f${String(f).padStart(4, '0')}.jpg`), Buffer.from(data, 'base64'));
    realPerFrame = 0.8 * realPerFrame + 0.2 * (Date.now() - started);
  }
  await page.evaluate(() => window.__clock.release());
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
  await cdp.detach();
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', join(dir, 'f%04d.jpg'),
    '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-c:v', 'libx264', '-crf', '18', join(out, `${theme}-${name}.mp4`)]);
  rmSync(dir, { recursive: true, force: true });
  console.log('✓', `${theme}-${name}.mp4`, `(${frames} Bilder, ${FPS} fps)`);
}

/** Pixeldichte der Seite umstellen (für Aufnahmen 2×, für Standbilder 3×). */
async function setDpr(dpr) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: 393, height: 798, deviceScaleFactor: dpr, mobile: true });
  await cdp.detach();
}

const steps = {
  async import() {
    await open('mehr/daten', 1000);
    await page.locator('input[type="file"]').setInputFiles(demoFile);
    await page.getByRole('button', { name: /Datensätze importieren/ }).click();
    await page.getByText(/Datensätze importiert/).waitFor();
    // Standort beim Kartenstart aus, damit die Karte nicht selbst springt
    await open('mehr/einstellungen', 800);
    const loc = page.getByRole('checkbox', { name: /Standort beim Start/ });
    if (await loc.isChecked().catch(() => false)) await loc.uncheck();
  },
  async flight() {
    // Suche „Hohendeicher See“ → Tipp auf den Treffer → die Karte fliegt hin (echte App-Animation)
    await setDpr(REC_DPR);
    await openMap({ lng: 10.4, lat: 51.2, zoom: 5.2 }, 6000);
    const sheet = page.getByRole('dialog', { name: 'Suchen' });
    const word = 'Hohendeicher';
    await record(
      'flight',
      [
        { at: 0.8, run: () => page.getByRole('button', { name: 'Gewässer oder Ort suchen' }).click() },
        { at: 1.4, run: () => sheet.getByLabel('Gewässer oder Ort').focus() },
        ...[...word].map((ch, i) => ({ at: 1.5 + i * 0.1, run: () => page.keyboard.type(ch) })),
        { at: 2.9, run: () => sheet.getByRole('listitem').first().waitFor() },
        { at: 3.5, run: () => sheet.getByRole('listitem').first().getByRole('button').click() },
      ],
      9.5,
    );
    await setDpr(3);
  },
  async waterProfile() {
    const v = { lng: 10.1076, lat: 53.4395, zoom: 14.6 };
    await openMap(v);
    const p = await pointOf(v, { lat: 53.44004, lng: 10.10625 }); // freie Wasserfläche beim Namen
    await page.mouse.click(p.x, p.y);
    await page.getByRole('dialog').first().waitFor({ timeout: 8000 });
    await page.waitForTimeout(900);
    await shot('water-profile');
  },
  async newPlace() {
    const v = { lng: 10.1076, lat: 53.4395, zoom: 14.6 };
    await openMap(v);
    const p = await pointOf(v, { lat: 53.4385, lng: 10.1035 }); // am Südwestufer
    await page.mouse.click(p.x, p.y);
    await page.getByRole('dialog', { name: 'Neu an dieser Stelle' }).waitFor({ timeout: 8000 });
    await page.waitForTimeout(900);
    await shot('new-place');
  },
  async catchForm() {
    const v = { lng: 10.1076, lat: 53.4395, zoom: 14.6 };
    await openMap(v);
    await page.getByRole('button', { name: 'Fang erfassen' }).click();
    const p = await pointOf(v, { lat: 53.4392, lng: 10.1062 });
    await page.mouse.click(p.x, p.y);
    const form = page.getByRole('dialog', { name: 'Fang oder Kontakt erfassen' });
    await form.waitFor();
    await form.getByRole('button', { name: 'Hecht' }).click().catch(() => {});
    await page.waitForTimeout(800);
    await shot('catch-form');
  },
  async catches() {
    await open('fangbuch', 2500);
    await page.getByText(/^\d+ Einträge$/).scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, 420);
    await page.waitForTimeout(800);
    await shot('catches');
    await page.getByRole('link', { name: /Fang · Hecht/ }).first().click();
    await page.waitForTimeout(3500); // Wetter am Fang wird nachgeladen (Open-Meteo)
    await shot('catch-detail');
  },
  async weather() {
    await open('wetter', 1500);
    const sel = page.getByLabel('Ort', { exact: true });
    const value = await sel.evaluate((el) => [...el.options].find((o) => /Hohendeicher/.test(o.text))?.value);
    if (value) await sel.selectOption(value);
    await page.waitForTimeout(4000);
    await shot('weather');
    await page.mouse.wheel(0, 700);
    await page.waitForTimeout(800);
    await shot('weather-2');
  },
  async stats() {
    await open('statistik', 2000);
    await shot('stats');
    await page.mouse.wheel(0, 650);
    await page.waitForTimeout(800);
    await shot('stats-2');
  },
  async heatmap() {
    const v = { lng: 10.1076, lat: 53.4395, zoom: 14.2 };
    await page.evaluate(() => localStorage.setItem('fangpunkt.heatmap', '1'));
    await openMap(v);
    await shot('heatmap');
    await page.evaluate(() => localStorage.setItem('fangpunkt.heatmap', '0'));
  },
};

for (const [name, fn] of Object.entries(steps)) {
  if (only && name !== 'import' && !only.includes(name)) continue;
  try {
    await fn();
  } catch (e) {
    console.error(`✗ ${name}:`, e.message);
    process.exitCode = 1;
  }
}
await browser.close();
