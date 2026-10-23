// Aufnahmen für das Erklärvideo „Ein Angeltag mit Fangpunkt“ (tools/marketing-video/hyperframes-tutorial).
// Echte Abläufe in der veröffentlichten App, Handy-Ansicht 393 × 798 CSS-px, bildgenau mit 30 fps
// (die Seitenuhr steht während der Aufnahme still und wird je Bild um 1/30 s weitergestellt).
// Jeder Tipp wird mit Ort und Zeit in <name>.taps.json geschrieben – daraus zeichnet das Video den Fingerring.
// Aufruf: node scripts/record-tutorial.mjs [--only=weather,search,…] [--dry]
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildBackup, buildDemoData } from './demo-data.mjs';

const root = new URL('..', import.meta.url);
const { targetUrl } = JSON.parse(readFileSync(new URL('video.config.json', root), 'utf8'));
const out = new URL('assets/tutorial/', root).pathname;
mkdirSync(out, { recursive: true });
const only = process.argv.find((a) => a.startsWith('--only='))?.slice(7).split(',');
const dry = process.argv.includes('--dry');
const FPS = 30;
const DPR = 2;
const W = 393;
const H = 798;

const demoFile = join(tmpdir(), 'fangpunkt-demo-backup.json');
writeFileSync(demoFile, JSON.stringify(buildBackup(buildDemoData())));

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--lang=de-DE'],
  env: { ...process.env, LANG: 'de_DE.UTF-8' },
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: DPR,
  isMobile: true,
  hasTouch: true,
  locale: 'de-DE',
  timezoneId: 'Europe/Berlin',
  colorScheme: 'light',
  serviceWorkers: 'block',
  userAgent:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
});
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
  await page.waitForTimeout(300);
}
async function openMap(view, wait = 7000) {
  await page.evaluate((v) => localStorage.setItem('fangpunkt.mapView', JSON.stringify(v)), view);
  await open('', wait);
}

// Tipp mit Protokoll: auf einen Locator (Mitte) oder einen Punkt
let taps = [];
let tNow = 0;
async function tap(target) {
  let x, y;
  if (typeof target === 'object' && 'x' in target) ({ x, y } = target);
  else {
    const b = await target.boundingBox();
    x = b.x + b.width / 2;
    y = b.y + b.height / 2;
  }
  taps.push({ t: +tNow.toFixed(3), x: +x.toFixed(1), y: +y.toFixed(1) });
  await page.mouse.click(x, y);
}
// Bildschirm sanft scrollen (bildgenau): Ziel-Scrollwert über n Bilder
function scrollSteps(selector, from, to, at, dur) {
  const n = Math.round(dur * FPS);
  return [...Array(n + 1)].map((_, i) => ({
    at: at + i / FPS,
    run: () =>
      page.evaluate(
        ([sel, v]) => {
          // Die App scrollt in einem eigenen Container: den größten scrollbaren Bereich nehmen
          const el = sel
            ? document.querySelector(sel)
            : [...document.querySelectorAll('*')]
                .filter((e) => e.scrollHeight > e.clientHeight + 20 && /auto|scroll/.test(getComputedStyle(e).overflowY))
                .sort((a, b) => b.clientHeight - a.clientHeight)[0] || document.scrollingElement;
          el.scrollTop = v;
        },
        [selector, from + (to - from) * (0.5 - Math.cos((Math.PI * i) / n) / 2)],
      ),
  }));
}

// Sanft zu einem Element scrollen (im nächsten scrollbaren Vorfahren), Ziel wird beim ersten Bild ermittelt
function scrollToSteps(locator, at, dur, top = 140) {
  const n = Math.round(dur * FPS);
  const st = {};
  return [...Array(n + 1)].map((_, i) => ({
    at: at + i / FPS,
    run: async () => {
      if (i === 0) {
        const h = await locator.elementHandle();
        Object.assign(st, await h.evaluate((el, top) => {
          let p = el.parentElement;
          while (p && !(p.scrollHeight > p.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(p).overflowY))) p = p.parentElement;
          p.dataset.recScroll = '1';
          const from = p.scrollTop;
          const to = Math.min(p.scrollHeight - p.clientHeight, from + el.getBoundingClientRect().top - top);
          return { from, to };
        }, top));
      }
      const v = st.from + (st.to - st.from) * (0.5 - Math.cos((Math.PI * i) / n) / 2);
      await page.evaluate((v) => { document.querySelector('[data-rec-scroll]').scrollTop = v; }, v);
    },
  }));
}

async function record(name, timeline, durationS) {
  taps = [];
  const actions = [...timeline].sort((a, b) => a.at - b.at);
  if (dry) {
    let t = 0;
    for (const a of actions) {
      await page.waitForTimeout(Math.max(0, (a.at - t) * 1000));
      t = a.at;
      tNow = a.at;
      await a.run();
      if (a.shot) await page.screenshot({ path: join(out, `dry-${name}-${a.at}.png`) });
    }
    await page.waitForTimeout(Math.max(0, (durationS - t) * 1000));
    await page.screenshot({ path: join(out, `dry-${name}.png`) });
    console.log('✓ (Probe)', name, JSON.stringify(taps));
    return;
  }
  const dir = join(out, `.frames-${name}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Animation.enable');
  let next = 0;
  let realPerFrame = 200;
  await page.evaluate(() => window.__clock.freeze());
  const frames = Math.round(durationS * FPS);
  for (let f = 0; f < frames; f++) {
    tNow = f / FPS;
    while (next < actions.length && actions[next].at <= tNow) await actions[next++].run();
    const started = Date.now();
    await cdp.send('Animation.setPlaybackRate', { playbackRate: Math.min(1, 1000 / FPS / realPerFrame) });
    await page.evaluate(
      (ms) => new Promise((r) => { window.__clock.advance(ms); requestAnimationFrame(() => requestAnimationFrame(r)); }),
      1000 / FPS,
    );
    const { data } = await cdp.send('Page.captureScreenshot', {
      format: 'jpeg', quality: 92, clip: { x: 0, y: 0, width: W, height: H, scale: DPR },
    });
    writeFileSync(join(dir, `f${String(f).padStart(4, '0')}.jpg`), Buffer.from(data, 'base64'));
    realPerFrame = 0.8 * realPerFrame + 0.2 * (Date.now() - started);
  }
  await page.evaluate(() => window.__clock.release());
  await cdp.send('Animation.setPlaybackRate', { playbackRate: 1 });
  await cdp.detach();
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', join(dir, 'f%04d.jpg'),
    '-vf', 'format=yuv420p', '-c:v', 'libx264', '-crf', '18', '-g', '30', join(out, `${name}.mp4`)]);
  rmSync(dir, { recursive: true, force: true });
  writeFileSync(join(out, `${name}.taps.json`), JSON.stringify({ viewport: { width: W, height: H }, fps: FPS, durationS, taps }, null, 1) + '\n');
  console.log('✓', `${name}.mp4`, `${frames} Bilder`, `${taps.length} Tipps`);
}

const LAKE_VIEW = { lng: 10.1076, lat: 53.4395, zoom: 14.6 };

const steps = {
  async import() {
    await open('mehr/daten', 1000);
    await page.locator('input[type="file"]').setInputFiles(demoFile);
    await page.getByRole('button', { name: /Datensätze importieren/ }).click();
    await page.getByText(/Datensätze importiert/).waitFor();
  },
  // ① Abends: Wetter und Pegel in der Nähe für den Hohendeicher See
  async weather() {
    await open('wetter', 1500);
    const sel = page.getByLabel('Ort', { exact: true });
    const value = await sel.evaluate((el) => [...el.options].find((o) => /Hohendeicher/.test(o.text))?.value);
    await sel.selectOption(value);
    // Die Vorhersage (api.open-meteo.com) braucht hier teils > 10 s; bei Fehler neu laden
    for (let i = 0; i < 4; i++) {
      const done = await page.getByText('Jetzt', { exact: true }).waitFor({ timeout: 45_000 }).then(() => true, () => false);
      if (done) break;
      const retry = page.getByRole('button', { name: 'Erneut laden' });
      if (await retry.isVisible().catch(() => false)) await retry.click();
    }
    await page.getByText('Jetzt', { exact: true }).waitFor({ timeout: 5_000 });
    await page.waitForTimeout(1500);
    const gaugeY = await page.evaluate(() => {
      const h = [...document.querySelectorAll('h2,h3')].find((e) => /Pegel in der Nähe/.test(e.textContent));
      return h ? h.getBoundingClientRect().top - 140 : 900;
    });
    await record('weather', [...scrollSteps(null, 0, gaugeY, 2.6, 2.4)], 7.0);
  },
  // ② Gewässer finden: Suche, Kartenflug, Tipp aufs Wasser, Profil
  async search() {
    await openMap({ lng: 10.4, lat: 51.2, zoom: 5.2 }, 6000);
    const sheet = page.getByRole('dialog', { name: 'Suchen' });
    const word = 'Hohendeicher';
    await record(
      'search',
      [
        { at: 0.5, run: () => tap(page.getByRole('button', { name: 'Gewässer oder Ort suchen' })) },
        { at: 1.0, run: () => sheet.getByLabel('Gewässer oder Ort').focus() },
        ...[...word].map((ch, i) => ({ at: 1.1 + i * 0.09, run: () => page.keyboard.type(ch) })),
        { at: 2.4, run: () => sheet.getByRole('listitem').first().waitFor() },
        { at: 2.9, run: () => tap(sheet.getByRole('listitem').first().getByRole('button')) },
        // nach dem Flug: freie Wasserfläche nahe der Seemitte (Mitte der Karte, etwas links)
        { at: 6.6, run: () => tap({ x: 150, y: 470 }) },
      ],
      10.0,
    );
  },
  // ③ Steg markieren: Ufer antippen → Angelsteg → Speichern
  async place() {
    await openMap(LAKE_VIEW);
    await record(
      'place',
      [
        { at: 0.5, run: () => tap({ x: 60, y: 464 }) },
        { at: 1.6, run: () => tap(page.getByRole('button', { name: 'Angelsteg' })) },
        { at: 2.7, run: () => tap(page.getByRole('button', { name: 'Speichern' })) },
      ],
      4.6,
    );
  },
  // ④ Session starten
  async session() {
    await openMap(LAKE_VIEW, 5000);
    await record('session', [{ at: 0.5, run: () => tap(page.getByRole('button', { name: 'Session starten' })) }], 2.6);
  },
  // ⑤ Fang erfassen: Knopf, Fangstelle, Fischart, Länge, Rechts-Hinweis, Speichern
  async catch() {
    await openMap(LAKE_VIEW, 5000);
    const form = page.getByRole('dialog', { name: 'Fang oder Kontakt erfassen' });
    await record(
      'catch',
      [
        { at: 0.4, run: () => tap(page.getByRole('button', { name: 'Fang erfassen' })) },
        { at: 1.1, run: () => tap({ x: 150, y: 330 }) },
        { at: 2.3, run: () => tap(form.getByRole('button', { name: 'Hecht', exact: true })) },
        ...scrollToSteps(form.getByText('Mehr Details', { exact: true }), 2.8, 0.6, 420),
        { at: 3.6, run: () => tap(form.getByText('Mehr Details', { exact: true })) },
        { at: 4.1, run: () => tap(form.getByLabel('Länge (cm)')) },
        ...['6', '8'].map((ch, i) => ({ at: 4.4 + i * 0.15, run: () => page.keyboard.type(ch) })),
        ...scrollToSteps(form.getByText(/Nach den erfassten Regeln|Landesrecht/).first(), 5.0, 1.0, 300),
        { at: 7.0, run: () => tap(form.getByRole('button', { name: 'Speichern' })) },
      ],
      8.6,
    );
  },
  // ⑥ Fangbuch: nach Gewässern, neuer Eintrag mit Wetter am Fang
  async catches() {
    await open('fangbuch', 3000);
    await record(
      'catches',
      [
        ...scrollSteps(null, 0, 420, 0.6, 1.0),
        { at: 2.2, run: async () => {
          // oberster sichtbarer Eintrag (der eben erfasste Hecht steht ganz oben)
          const links = page.getByRole('link', { name: /Fang · Hecht/ });
          for (let i = 0; i < (await links.count()); i++) {
            const b = await links.nth(i).boundingBox();
            if (b && b.y > 80 && b.y + b.height < 700) return tap(links.nth(i));
          }
          throw new Error('kein sichtbarer Hecht-Eintrag');
        } },
        { at: 3.6, run: () => page.waitForTimeout(1500) },
      ],
      6.0,
    );
  },
  // ⑦ Statistik: bis zu den Ködern
  async stats() {
    await open('statistik', 2500);
    const baitY = await page.evaluate(() => {
      const h = [...document.querySelectorAll('h2,h3')].find((e) => /Köder/.test(e.textContent));
      return h ? h.getBoundingClientRect().top - 160 : 1200;
    });
    await record('stats', [...scrollSteps(null, 0, baitY, 0.8, 2.4)], 5.4);
  },
  // Session-Rückblick (Funktionsanimation hyperframes-route): laufende Beispiel-Session mit Route am Ostufer
  // einspielen, „Session beenden“ → „Dein Angeltrip im Rückblick“, Wiedergabe 4×, Highlights.
  // Allein aufrufen (--only=review), sonst läuft schon die Session aus dem Schritt „session“.
  async review() {
    await openMap(LAKE_VIEW, 5000);
    const rect = await page.evaluate(() => {
      const r = document.querySelector('.maplibregl-canvas').getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height };
    });
    // Bildpunkt (CSS-px der Ansicht LAKE_VIEW) → Länge/Breite (Web-Mercator, 512-px-Kacheln wie MapLibre)
    const ws = 512 * 2 ** LAKE_VIEW.zoom;
    const my = (lat) => (0.5 - Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360)) / (2 * Math.PI)) * ws;
    const toLngLat = ([px, py]) => {
      const x = (LAKE_VIEW.lng / 360 + 0.5) * ws + (px - rect.x - rect.w / 2);
      const y = my(LAKE_VIEW.lat) + (py - rect.y - rect.h / 2);
      const lat = (360 / Math.PI) * Math.atan(Math.exp((0.5 - y / ws) * 2 * Math.PI)) - 90;
      return { lat: +lat.toFixed(6), lng: +((x / ws - 0.5) * 360).toFixed(6) };
    };
    // Weg auf der Landseite des Ostufers (aus dem Kartenbild abgelesen), Fangstellen im Wasser davor
    const way = [[165, 120], [172, 160], [178, 200], [186, 228], [192, 250], [198, 270], [203, 285], [222, 312], [252, 340], [272, 366], [292, 388], [306, 410], [322, 432], [330, 456], [338, 478], [350, 502], [362, 526], [390, 560]];
    const spots = { a: [180, 300], b: [268, 402], c: [318, 500] };
    const start = Date.now() - 130 * 60_000;
    const min = (m) => start + m * 60_000;
    // Ablauf (Minuten): gehen, stehen (angeln), App im Hintergrund = Lücke
    const plan = [
      { from: 0, to: 8, a: 0, b: 6 }, // zum ersten Platz
      { from: 8, to: 40, stay: 6 },
      { from: 40, to: 52, a: 6, b: 10, gap: [43, 50] },
      { from: 52, to: 95, stay: 10 },
      { from: 95, to: 100, a: 10, b: 14 },
      { from: 100, to: 129, stay: 14 },
    ];
    // Wegpunkte fein auflösen und mit leichter Schlangenlinie (±4 px quer zur Laufrichtung) versehen
    const along = (i0, i1, f) => {
      const segs = way.slice(i0, i1 + 1);
      const lens = segs.slice(1).map((p, i) => Math.hypot(p[0] - segs[i][0], p[1] - segs[i][1]));
      let d = f * lens.reduce((a, b) => a + b, 0);
      for (let i = 0; i < lens.length; i++) {
        if (d <= lens[i] || i === lens.length - 1) {
          const [ax, ay] = segs[i], [bx, by] = segs[i + 1], q = Math.min(1, d / lens[i]);
          const nx = -(by - ay) / lens[i], ny = (bx - ax) / lens[i], w = 4 * Math.sin(f * 40);
          return [ax + (bx - ax) * q + nx * w, ay + (by - ay) * q + ny * w];
        }
        d -= lens[i];
      }
    };
    const segments = [[]];
    for (const p of plan) {
      for (let m = p.from; m < p.to; m += 0.25) {
        if (p.gap && m >= p.gap[0] && m < p.gap[1]) { if (segments.at(-1).length) segments.push([]); continue; }
        const xy = p.stay !== undefined ? way[p.stay] : along(p.a, p.b, (m - p.from) / (p.to - p.from));
        if (p.stay !== undefined && segments.at(-1).length && m > p.from) continue; // im Stand keine neuen Punkte (unter 8 m)
        segments.at(-1).push({ t: min(m), ...toLngLat(xy), acc: 6 });
      }
    }
    const iso = (t) => new Date(t).toISOString().replace(/\.\d{3}Z$/, '.000Z');
    const m0 = { createdAt: iso(start), updatedAt: iso(start), rev: 1 };
    const water = { waterId: 'osm:r9075175', waterSnapshot: { name: 'Hohendeicher See', centroid: { lat: 53.440107, lng: 10.107563 } } };
    const session = { ...m0, id: 'demo-review-session', startAt: iso(start), tz: 'Europe/Berlin', ...water, title: 'Morgenrunde' };
    const entry = (n, m, spot, extra) => ({
      ...m0, id: `demo-review-catch-${n}`, at: iso(min(m)), tz: 'Europe/Berlin', position: { ...toLngLat(spot), source: 'map-tap' },
      ...water, sessionId: session.id, stateCode: 'HH', ...extra,
    });
    const fish = (id, cm, method, bait) => ({ outcome: 'caught', speciesId: id, speciesCertainty: 'certain', speciesSource: 'user', lengthCm: cm, lengthMethod: 'measured', released: 'released', method, bait });
    const catches = [
      entry(1, 26, spots.a, fish('perch', 31, 'dropshot', { name: 'Gummifisch 7 cm', type: 'softbait' })),
      entry(2, 63, spots.b, { outcome: 'missed_bite', method: 'spinning', bait: { name: 'Wobbler 12 cm', type: 'crankbait' } }),
      entry(3, 82, spots.b, fish('pike', 68, 'spinning', { name: 'Wobbler 12 cm', type: 'crankbait' })),
      entry(4, 104, spots.c, fish('perch', 27, 'dropshot', { name: 'Gummifisch 7 cm', type: 'softbait' })),
    ];
    const track = { ...m0, id: `track-${session.id}`, sessionId: session.id, segments: segments.filter((s) => s.length) };
    const data = { catches, places: [], sessions: [session], baitPresets: [], trips: [], tracks: [track], photos: [] };
    const file = join(tmpdir(), 'fangpunkt-review-backup.json');
    writeFileSync(file, JSON.stringify({ ...buildBackup(data), schemaVersion: 3 }));
    await open('mehr/daten', 1000);
    await page.locator('input[type="file"]').setInputFiles(file);
    await page.getByRole('button', { name: /Datensätze? importieren/ }).click();
    await page.getByText(/importiert/).first().waitFor();
    // Standort am letzten Platz freigeben, damit die Session „GPS aktiv“ zeigt (statt „Standort nicht freigegeben“)
    await ctx.grantPermissions(['geolocation'], { origin: new URL(targetUrl).origin });
    await ctx.setGeolocation({ latitude: toLngLat(way[14]).lat, longitude: toLngLat(way[14]).lng, accuracy: 6 });
    await open(`fangbuch/sessions/${session.id}`, 2500);
    await record(
      'review',
      [
        { at: 0.6, run: () => tap(page.getByRole('button', { name: 'Session beenden' })) },
        { at: 2.4, shot: true, run: () => {} },
        // Steuerung liegt unter der Karte: kurz hinscrollen, 4× wählen, zurück zur Karte
        ...scrollToSteps(page.getByText('4×', { exact: true }), 2.2, 0.6, 520),
        { at: 3.0, run: () => tap(page.getByText('4×', { exact: true })) },
        ...scrollToSteps(page.getByLabel('Karte mit der Route der Session'), 3.4, 0.6, 40),
        { at: 5.0, shot: true, run: () => {} },
        ...scrollToSteps(page.getByRole('heading', { name: 'Deine Highlights' }), 9.2, 1.2, 70),
        ...scrollToSteps(page.getByRole('heading', { name: 'Fang-Highlights' }), 13.4, 1.2, 70),
      ],
      17.5,
    );
  },
};

for (const [name, fn] of Object.entries(steps)) {
  if (only && name !== 'import' && !only.includes(name)) continue;
  try {
    await fn();
  } catch (e) {
    console.error(`✗ ${name}:`, e.message.split('\n')[0]);
    await page.screenshot({ path: join(out, `fail-${name}.png`) }).catch(() => {});
    process.exitCode = 1;
  }
}
await browser.close();
