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
