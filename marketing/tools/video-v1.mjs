// Video V1 „Fang eintragen, bevor er zurück im Wasser ist“ (VIDEO-KONZEPTE.md) als erste Fassung ohne Naturaufnahmen:
// Titelbild → echte Bildschirmaufnahme der Live-App (Beispieldaten) mit Schritt-Einblendungen → Schluss-Karte.
// Ablauf: 1. Aufnahme per Chrome-Screencast (scharfe Einzelbilder in Gerätepixeln), 2. Einblendungen mit Chromium rendern,
// 3. Schnitt mit ffmpeg. Aufruf (Repo-Root): node marketing/tools/video-v1.mjs  → marketing/videos/v1-fang-eintragen-1080x1920.mp4
// Voraussetzung: node marketing/tools/render.mjs (Titelbild, Schluss-Karte).
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from '../../node_modules/.pnpm/node_modules/playwright/index.mjs';
import { BASE, HOME, demoData, seed, waitApp } from './demo.mjs';

const root = new URL('../', import.meta.url).pathname;
const build = `${root}videos/_build/v1/`;
rmSync(build, { recursive: true, force: true });
mkdirSync(`${build}frames`, { recursive: true });
const OUT = `${root}videos/v1-fang-eintragen-1080x1920.mp4`;
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

// ---------- 2. Einblendungen ----------
const fontCss = `@font-face{font-family:Inter;font-weight:100 900;src:url(${root}brand/fonts/inter-latin-wght-normal.woff2)}
@font-face{font-family:Fraunces;font-weight:100 900;src:url(${root}brand/fonts/fraunces-latin-wght-normal.woff2)}`;
const PH = { x: 190, y: 455, w: 700, bezel: 16 };
PH.sw = PH.w - 2 * PH.bezel;
PH.sh = Math.round((PH.sw * 2532) / 1170);
PH.h = PH.sh + 2 * PH.bezel;
async function png(name, html, transparent = false) {
  const pg = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
  await pg.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${fontCss}
    *{margin:0;box-sizing:border-box}html,body{width:1080px;height:1920px;background:${transparent ? 'transparent' : '#0B2A33'}}</style></head><body>${html}</body></html>`);
  await pg.evaluate(() => document.fonts.ready);
  await pg.screenshot({ path: `${build}${name}.png`, omitBackground: transparent });
  await pg.close();
}
const waves = Array.from({ length: 8 }, (_, i) => {
  const y = 1000 + i * 120;
  let d = `M-20 ${y}`;
  for (let x = -20; x < 1300; x += 160) d += ` q40 -14 80 0 t80 0`;
  return `<path d="${d}" fill="none" stroke="#5CC4D6" stroke-opacity="${0.3 - i * 0.03}" stroke-width="2.5" stroke-linecap="round"/>`;
}).join('');
// Hintergrund mit Marke
await png('bg', `<div style="position:absolute;inset:0;background:radial-gradient(120% 80% at 80% 0%,#145A6A 0%,#0B2A33 55%,#071D24 100%)"></div>
  <svg style="position:absolute;inset:0" width="1080" height="1920">${waves}</svg>`);
// Telefonrahmen mit durchsichtigem Bildschirm (Rahmen deckt die Ecken der Aufnahme ab)
await png('phone', `<svg width="1080" height="1920" style="position:absolute;inset:0">
  <defs><mask id="m"><rect width="1080" height="1920" fill="white"/><rect x="${PH.x + PH.bezel}" y="${PH.y + PH.bezel}" width="${PH.sw}" height="${PH.sh}" rx="62" fill="black"/></mask></defs>
  <rect x="${PH.x}" y="${PH.y}" width="${PH.w}" height="${PH.h}" rx="${62 + PH.bezel}" fill="#05161B" mask="url(#m)" stroke="rgba(92,196,214,.35)" stroke-width="2"/></svg>
  <div style="position:absolute;left:${PH.x - 40}px;top:${PH.y + PH.h - 150}px;transform:rotate(-4deg);font:600 26px/1 Inter;padding:14px 22px;border-radius:999px;background:rgba(5,22,27,.88);color:#E8F4F5;border:1.5px solid rgba(92,196,214,.5)">Echte App · <b style="color:#F2994A">Beispieldaten</b></div>`, true);
// Schritt-Texte (eingebrannte Untertitel)
const STEPS = [
  ['s1', '1', 'Fang erfassen'],
  ['s2', '2', 'Stelle antippen'],
  ['s3', '3', 'Fischart wählen'],
  ['s4', '4', 'Speichern. Fertig.'],
];
for (const [k, n, text] of STEPS) {
  await png(`cap-${k}`, `<div style="position:absolute;left:0;right:0;top:250px;display:flex;justify-content:center;align-items:center;gap:26px">
    <span style="width:92px;height:92px;border-radius:50%;background:#F2994A;color:#2B1600;font:800 50px/92px Inter;text-align:center">${n}</span>
    <span style="font:650 76px/1.05 Fraunces;color:#E8F4F5">${text}</span></div>
    <div style="position:absolute;left:0;right:0;top:372px;text-align:center;font:500 34px/1 Inter;color:#BFD8DC">${n} von 4 Tipps</div>`, true);
}
await browser.close();

// ---------- 3. Schnitt ----------
const INTRO = 2.6;
const OUTRO = 2.6;
const FADE = 0.35;
const sw = PH.sw;
const sh = PH.sh;
const enables = STEPS.map(([k], i) => {
  const a = mark[k];
  const b = i + 1 < STEPS.length ? mark[STEPS[i + 1][0]] : recLen;
  return `between(t,${a.toFixed(2)},${b.toFixed(2)})`;
});
const caps = STEPS.map((_, i) => `[${4 + i}:v]`);
let chain = `[1:v]scale=${sw}:${sh}:flags=lanczos,setsar=1[rec];[0:v][rec]overlay=${PH.x + PH.bezel}:${PH.y + PH.bezel}[a];[a][3:v]overlay=0:0[b]`;
let last = 'b';
caps.forEach((c, i) => {
  chain += `;[${last}]${c}overlay=0:0:enable='${enables[i]}'[c${i}]`;
  last = `c${i}`;
});
const filter = [
  `[8:v]scale=1080:1920,zoompan=z='min(zoom+0.0009,1.05)':d=${Math.round(INTRO * 30)}:s=1080x1920:fps=30,format=yuv420p,setsar=1[intro]`,
  `${chain};[${last}]fps=30,format=yuv420p,trim=duration=${recLen.toFixed(2)},setsar=1[main]`,
  `[9:v]scale=1080:1920,fps=30,format=yuv420p,setsar=1[outro]`,
  `[2:v]nullsink`,
  `[intro][main]xfade=transition=fade:duration=${FADE}:offset=${(INTRO - FADE).toFixed(2)}[x1]`,
  `[x1][outro]xfade=transition=fade:duration=${FADE}:offset=${(INTRO + recLen - 2 * FADE).toFixed(2)}[v]`,
].join(';');
const args = [
  '-y', '-loglevel', 'error',
  '-loop', '1', '-t', recLen.toFixed(2), '-i', `${build}bg.png`, // 0
  '-f', 'concat', '-safe', '0', '-i', `${build}frames.txt`, // 1
  '-f', 'lavfi', '-i', 'nullsrc=s=16x16:d=1', // 2 (Platzhalter, damit die Indizes lesbar bleiben)
  '-loop', '1', '-t', recLen.toFixed(2), '-i', `${build}phone.png`, // 3
  ...STEPS.flatMap(([k]) => ['-loop', '1', '-t', recLen.toFixed(2), '-i', `${build}cap-${k}.png`]), // 4–7
  '-loop', '1', '-t', String(INTRO), '-i', `${root}stories/reel-cover/cover-video-v1-1080x1920.png`, // 8
  '-loop', '1', '-t', String(OUTRO), '-i', `${root}brand/schlusskarte-1080x1920.png`, // 9
  '-filter_complex', filter, '-map', '[v]',
  '-r', '30', '-c:v', 'libx264', '-preset', 'slow', '-crf', '19', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', OUT,
];
execFileSync('ffmpeg', args, { stdio: 'inherit' });
console.log(OUT);
