// Bildschirmaufnahme für das interne Erklärvideo „Montagen“ (HyperFrames-Projekt marketing/videos/intern-montagen):
// echte Live-App ohne eigene Daten: Mehr → Knoten & Montagen → Montagen → Filter → Carolina-Rig (Wofür?, Abspielen,
// Material, passende Knoten) → Clinchknoten. Technik wie tools/record-knoten.mjs.
// Ergebnis: intern-montagen/assets/app-montagen.mp4 und assets/app-montagen.json (Zeitpunkte in Sekunden).
// Aufruf (Repo-Root): node marketing/tools/record-montagen.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from '../../node_modules/.pnpm/node_modules/playwright/index.mjs';
import { BASE, waitApp } from './demo.mjs';

const root = new URL('../', import.meta.url).pathname;
const build = `${root}videos/_build/montagen/`;
const assets = `${root}videos/intern-montagen/assets/`;
mkdirSync(assets, { recursive: true });
rmSync(build, { recursive: true, force: true });
mkdirSync(`${build}frames`, { recursive: true });
const browser = await chromium.launch({
  executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
  args: ['--force-device-scale-factor=2', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--lang=de-DE'],
  env: { ...process.env, LANG: 'de_DE.UTF-8', LANGUAGE: 'de' },
});
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 }, locale: 'de-DE', timezoneId: 'Europe/Berlin',
  colorScheme: 'light', serviceWorkers: 'block',
});
const page = await ctx.newPage();
await page.addInitScript(() => {
  const st = setTimeout;
  const si = setInterval;
  globalThis.setTimeout = (fn, ms = 0, ...a) => st(fn, ms * (globalThis.__fpSlow ?? 1), ...a);
  globalThis.setInterval = (fn, ms = 0, ...a) => si(fn, ms * (globalThis.__fpSlow ?? 1), ...a);
});
await page.goto(new URL('./mehr', BASE).href);
await waitApp(page);
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
const frames = [];
let recording = true;
const t0 = Date.now();
const grab = (async () => {
  while (recording) {
    const t = (Date.now() - t0) / 1000 / SLOW;
    const { data: img } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
    const file = `${build}frames/${String(frames.length).padStart(5, '0')}.jpg`;
    writeFileSync(file, Buffer.from(img, 'base64'));
    frames.push({ file, t });
  }
})();
const mark = {};
const stamp = (k) => (mark[k] = (Date.now() - t0) / 1000 / SLOW);
const pause = (ms) => page.waitForTimeout(ms * SLOW);
// Weich scrollen (eigene Schritte, damit die Zeitlupe stimmt): Element bis zur Höhe `top` (CSS-px) holen
const scrollTo = async (locator, top) => {
  const delta = await locator.evaluate((el, top) => el.getBoundingClientRect().top - top, top);
  const n = 18;
  for (let i = 1; i <= n; i++) {
    const ease = (x) => 0.5 - Math.cos(Math.PI * x) / 2;
    const dy = delta * (ease(i / n) - ease((i - 1) / n));
    await page.mouse.wheel(0, dy);
    await pause(28);
  }
  await pause(250);
};
await page.mouse.move(195, 420);

await pause(1200);
stamp('open');
await page.getByRole('link', { name: /^Knoten & Montagen/ }).click();
await page.getByRole('link', { name: 'Montagen', exact: true }).waitFor();
await pause(1600);
stamp('tab');
await page.getByRole('link', { name: 'Montagen', exact: true }).click();
await page.getByRole('button', { name: 'Posenangeln' }).waitFor();
await pause(2600);
stamp('filter');
await page.getByRole('button', { name: 'Posenangeln' }).click();
await pause(2200);
stamp('all');
await page.getByRole('button', { name: 'Alle' }).click();
await pause(1500);
stamp('rig');
await page.getByRole('link', { name: /Carolina-Rig/ }).click();
await page.getByRole('button', { name: 'Abspielen' }).waitFor();
await pause(3800);
stamp('scrollPlayer');
const playBtn = page.getByRole('button', { name: 'Abspielen' });
await scrollTo(page.getByRole('img').first(), 70);
await pause(700);
stamp('play');
await playBtn.click();
await page.getByRole('button', { name: 'Von vorn' }).waitFor({ timeout: 300000 });
await pause(2200);
stamp('material');
await scrollTo(page.getByRole('heading', { name: 'Das brauchst du' }), 90);
await pause(3200);
stamp('knots');
await scrollTo(page.getByRole('heading', { name: 'Passende Knoten' }), 300);
await pause(2400);
stamp('knotTap');
await page.getByRole('link', { name: /Verbesserter Clinchknoten/ }).click();
await page.getByRole('button', { name: 'Abspielen' }).waitFor();
await pause(1200);
// Die neue Seite übernimmt die Scroll-Position der alten – zum Titel hochscrollen
stamp('knotTop');
await scrollTo(page.getByRole('heading', { level: 1 }), 80);
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
  `${assets}app-montagen.mp4`], { stdio: 'inherit' });
writeFileSync(`${assets}app-montagen.json`, JSON.stringify(Object.fromEntries(Object.entries({ ...mark, duration: recLen }).map(([k, v]) => [k, +v.toFixed(2)])), null, 2) + '\n');
console.log(`${assets}app-montagen.mp4`);
