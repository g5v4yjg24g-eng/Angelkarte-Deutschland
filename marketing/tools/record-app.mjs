// Bildschirmaufnahme für Video V1 (HyperFrames-Projekt marketing/videos/v1-hyperframes):
// echte Live-App mit Beispieldaten, aufgenommen per Chrome-Screencast (scharfe Einzelbilder in Gerätepixeln).
// Ergebnis: v1-hyperframes/assets/app-aufnahme.mp4 und assets/marks.json (Zeitpunkte der vier Tipps in Sekunden).
// Aufruf (Repo-Root): node marketing/tools/record-app.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from '../../node_modules/.pnpm/node_modules/playwright/index.mjs';
import { BASE, HOME, demoData, seed, waitApp } from './demo.mjs';

const root = new URL('../', import.meta.url).pathname;
const build = `${root}videos/_build/v1/`;
const assets = `${root}videos/v1-hyperframes/assets/`;
mkdirSync(assets, { recursive: true });
rmSync(build, { recursive: true, force: true });
mkdirSync(`${build}frames`, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--lang=de-DE'],
  env: { ...process.env, LANG: 'de_DE.UTF-8', LANGUAGE: 'de' },
});

// ---------- 1. Aufnahme ----------
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: 'de-DE', timezoneId: 'Europe/Berlin',
  geolocation: HOME, permissions: ['geolocation'], colorScheme: 'light', serviceWorkers: 'block',
});
const page = await ctx.newPage();
// Uhrzeit für das Formular: früher Morgen statt der echten Aufnahmezeit
// (nur Date verschieben; Timer und Animationen laufen normal weiter)
await page.addInitScript(() => {
  const offset = Date.parse('2026-10-24T07:42:00+02:00') - Date.now();
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
});
const go = async (path) => {
  await page.goto(new URL(path, BASE).href);
  await waitApp(page);
};
await go('./fangbuch');
await seed(page, demoData());
await page.evaluate(async () => {
  localStorage.setItem('fangpunkt.locHintSeen', '1');
  // Kein Wetter-Nachladen: hält die Daten unverändert, damit keine Sicherungs-Erinnerung ins Bild kommt
  const req = indexedDB.open('fangpunkt');
  const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
  await new Promise((res) => {
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').put({ key: 'weatherEnabled', value: false });
    tx.oncomplete = res;
  });
  db.close();
});
await go('./');
await page.waitForFunction(() => window.__fangpunktMap?.loaded(), null, { timeout: 30000 });
await page.evaluate(() => window.__fangpunktMap.jumpTo({ center: [8.1075, 51.4826], zoom: 14.6 }));
await page.waitForTimeout(8000);

// Tipp-Anzeige: Kreis an jeder Berührung (nur in der Aufnahme, nicht Teil der App)
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

const cdp = await ctx.newCDPSession(page);
const frames = [];
let t0;
cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
  t0 ??= metadata.timestamp;
  const file = `${build}frames/${String(frames.length).padStart(5, '0')}.jpg`;
  writeFileSync(file, Buffer.from(data, 'base64'));
  frames.push({ file, t: metadata.timestamp - t0 });
  await cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
});
await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, maxWidth: 1170, maxHeight: 2532 });
const startWall = Date.now();
const mark = {};
const stamp = (k) => (mark[k] = (Date.now() - startWall) / 1000);
const pause = (ms) => page.waitForTimeout(ms);
// Bewegung im Bild halten, damit der Screencast auch in ruhigen Momenten Bilder liefert
const nudge = setInterval(() => page.evaluate(() => window.__fangpunktMap?.triggerRepaint()).catch(() => {}), 100);

await pause(1400);
stamp('s1');
await page.getByRole('button', { name: 'Fang erfassen' }).click();
await pause(1300);
const p = await page.evaluate(() => {
  const m = window.__fangpunktMap;
  const r = m.getCanvas().getBoundingClientRect();
  const q = m.project([8.1049, 51.4822]);
  return { x: r.left + q.x, y: r.top + q.y };
});
stamp('s2');
await page.mouse.click(p.x, p.y);
const form = page.getByRole('dialog', { name: 'Fang oder Kontakt erfassen' });
await form.waitFor();
await pause(1600);
stamp('s3');
await form.getByRole('button', { name: 'Zander', exact: true }).click();
await pause(1300);
const save = form.getByRole('button', { name: 'Speichern' });
await save.scrollIntoViewIfNeeded();
await pause(700);
stamp('s4');
await save.click();
await pause(2600);
stamp('end');
clearInterval(nudge);
await cdp.send('Page.stopScreencast');
await ctx.close();
if (frames.length < 20) throw new Error(`Zu wenige Bilder aufgenommen (${frames.length})`);
// Zeitbasis angleichen: Screencast-Zeit beginnt beim ersten Bild, die Marken bei Aufnahmebeginn
const shift = frames[0].t; // = 0
const recLen = Math.max(mark.end, frames.at(-1).t + 0.2) - shift;
let list = 'ffconcat version 1.0\n';
frames.forEach((f, i) => {
  const next = i + 1 < frames.length ? frames[i + 1].t : recLen;
  list += `file '${f.file}'\nduration ${Math.max(next - f.t, 0.001).toFixed(3)}\n`;
});
list += `file '${frames.at(-1).file}'\n`;
writeFileSync(`${build}frames.txt`, list);
console.log(`Aufnahme: ${frames.length} Bilder, ${recLen.toFixed(1)} s`, mark);

await browser.close();
// 30 fps, Gerätepixel (1170 × 2532); Tipp-Zeitpunkte relativ zum Beginn der Aufnahme
execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', `${build}frames.txt`,
  '-vf', 'fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-movflags', '+faststart',
  `${assets}app-aufnahme.mp4`], { stdio: 'inherit' });
writeFileSync(`${assets}marks.json`, JSON.stringify({ ...mark, duration: +recLen.toFixed(2) }, null, 2) + '\n');
console.log(`${assets}app-aufnahme.mp4`);
