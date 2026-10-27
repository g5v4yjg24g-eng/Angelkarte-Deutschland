// Bildschirmaufnahme für das interne Erklärvideo „Profil“ (HyperFrames-Projekt marketing/videos/intern-profil):
// echte Live-App mit Beispieldaten (Profil „Jonas“, 8 Beiträge, ein Zander-Fang mit Foto; Fotos von Wikimedia Commons,
// Quellen in intern-profil/assets/beispielbilder/quellen.json). Ablauf: Profil → Neuer Beitrag aus dem Fang → Posten →
// Beitrag öffnen → Gefällt mir → Kommentar → zurück → Profil teilen („Demnächst“) → Bearbeiten.
// Technik wie tools/record-knoten.mjs. Ergebnis: intern-profil/assets/app-profil.mp4 und app-profil.json.
// Aufruf (Repo-Root): node marketing/tools/record-profil.mjs
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { chromium } from '../../node_modules/.pnpm/node_modules/playwright/index.mjs';
import { BASE, WATER, seed, waitApp } from './demo.mjs';

const root = new URL('../', import.meta.url).pathname;
const build = `${root}videos/_build/profil/`;
const assets = `${root}videos/intern-profil/assets/`;
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
// ---------- Beispieldaten ----------
const img = (k) => readFileSync(`${assets}beispielbilder/${k}.jpg`).toString('base64');
const meta = (at) => ({ createdAt: at, updatedAt: at, rev: 0 });
const POSTS = [
  ['hecht', '2026-06-14T19:20:00+00:00', 'Erster Hecht der Saison! Wobbler am Damm – und wieder schwimmen lassen.'],
  ['bachforelle-1', '2026-07-02T06:10:00+00:00', 'Morgens am Bach. Kleiner Spinner, große Freude.'],
  ['karpfen', '2026-07-19T03:05:00+00:00', 'Nachtansitz hat sich gelohnt 🌙'],
  ['maraene', '2026-08-09T09:30:00+00:00', 'Mal was anderes: Maräne vom Boot aus. Wer fängt die öfter?'],
  ['forelle-fliege', '2026-08-30T17:45:00+00:00', 'Mit der Fliegenrute unterwegs – endlich hat es geklappt.'],
  ['regenbogenforelle', '2026-09-13T15:00:00+00:00', 'Regenbogenforelle am Vereinssee. Petri an alle, die heute draußen waren!'],
  ['spiegelkarpfen', '2026-09-27T12:20:00+00:00', 'Spiegelkarpfen beim Feedern 💪'],
  ['bachforelle-2', '2026-10-11T08:40:00+00:00', 'Die hat den Köder fast im Flug genommen.'],
];
const data = { catches: [], sessions: [], places: [], trips: [] };
data.catches.push({
  id: 'demo-zander', ...meta('2026-10-26T16:42:00+00:00'), outcome: 'caught', at: '2026-10-26T16:40:00+00:00', tz: 'Europe/Berlin',
  stateCode: 'NW', position: { lat: 51.4836, lng: 8.1035, source: 'map-tap' }, ...WATER, method: 'jigging',
  bait: { name: 'Gummifisch 10 cm', type: 'softbait', color: 'Motoroil' }, speciesId: 'zander', lengthCm: 68,
  lengthMethod: 'measured', released: 'released', photoIds: ['photo-catch-zander'],
});
const photos = [
  { id: 'photo-avatar', k: 'avatar', w: 600, h: 600, ownerType: 'profile', ownerId: 'me', at: '2026-06-01T10:00:00+00:00' },
  { id: 'photo-catch-zander', k: 'zander', ownerType: 'catch', ownerId: 'demo-zander', at: '2026-10-26T16:42:00+00:00' },
  ...POSTS.map(([k, at]) => ({ id: `photo-post-${k}`, k, ownerType: 'post', ownerId: `post-${k}`, at })),
].map((p) => ({ ...p, b64: img(p.k), t64: img(`${p.k}-thumb`) }));

await page.goto(new URL('./profil', BASE).href);
await waitApp(page);
await seed(page, data);
await page.evaluate(async ({ photos, posts }) => {
  localStorage.setItem('fangpunkt.locHintSeen', '1');
  const blob = (b64) => new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'image/jpeg' });
  const size = (b) => createImageBitmap(b).then((bm) => ({ w: bm.width, h: bm.height }));
  const req = indexedDB.open('fangpunkt');
  const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
  const rows = [];
  for (const p of photos) {
    const b = blob(p.b64);
    const { w, h } = await size(b);
    rows.push({ id: p.id, createdAt: p.at, updatedAt: p.at, rev: 0, mime: 'image/jpeg', width: w, height: h, bytes: b.size,
      ownerType: p.ownerType, ownerId: p.ownerId, blob: b, thumb: blob(p.t64) });
  }
  await new Promise((res, rej) => {
    const tx = db.transaction(['photos', 'posts', 'profiles', 'settings'], 'readwrite');
    for (const r of rows) tx.objectStore('photos').put(r);
    for (const [k, at, caption] of posts)
      tx.objectStore('posts').put({ id: `post-${k}`, createdAt: at, updatedAt: at, rev: 0, caption, photoIds: [`photo-post-${k}`], visibility: 'friends' });
    tx.objectStore('profiles').put({ id: 'me', createdAt: '2026-06-01T10:00:00+00:00', updatedAt: '2026-06-01T10:00:00+00:00', rev: 0,
      name: 'Jonas', bio: 'Angeln am Möhnesee und an der Ruhr 🎣 Zander, Hecht, Karpfen – zurücksetzen, wo es passt.', avatarPhotoId: 'photo-avatar' });
    tx.objectStore('settings').put({ key: 'lastBackupAt', value: new Date().toISOString() });
    tx.oncomplete = res;
    tx.onerror = () => rej(tx.error);
  });
  db.close();
}, { photos, posts: POSTS });
await page.goto(new URL('./profil', BASE).href);
await waitApp(page);
await page.getByText('Jonas').first().waitFor();
await page.waitForTimeout(2500);

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
const type = (loc, text) => loc.pressSequentially(text, { delay: 55 * SLOW });

await pause(3200);
stamp('new');
await page.getByRole('button', { name: 'Neuer Beitrag' }).first().click();
await page.getByLabel('Mit Fang verknüpfen').waitFor();
await pause(1600);
stamp('link');
await page.getByLabel('Mit Fang verknüpfen').selectOption('demo-zander');
await pause(2200);
stamp('caption');
await type(page.getByLabel('Text'), 'Zander am Abend 🎣 Gummifisch in Motoroil.');
await pause(800);
stamp('visibility');
await scrollTo(page.getByText('Sichtbar für').first(), 330);
await page.getByRole('radio', { name: 'Alle' }).click().catch(() => page.getByText('Alle', { exact: true }).first().click());
await pause(1600);
stamp('publish');
await page.getByRole('button', { name: 'Posten' }).click();
await page.getByText('Jonas').first().waitFor();
await pause(2800);
stamp('open');
await page.getByRole('link', { name: /^Beitrag 1/ }).click();
await page.getByRole('button', { name: 'Gefällt mir' }).waitFor();
await pause(2000);
stamp('like');
await page.getByRole('button', { name: 'Gefällt mir' }).click();
await pause(1600);
stamp('comment');
await page.getByRole('button', { name: 'Kommentieren' }).click();
const input = page.getByLabel('Kommentar hinzufügen');
await input.waitFor();
await pause(1000);
await type(input, 'Petri! Starker Fisch 👍');
await pause(500);
stamp('send');
await page.getByRole('button', { name: 'Senden' }).click();
await pause(2000);
stamp('close');
await page.keyboard.press('Escape');
await pause(2000);
stamp('back');
await page.getByRole('link', { name: 'Zurück' }).first().click();
await page.getByText('Jonas').first().waitFor();
await pause(1600);
stamp('share');
await page.getByRole('button', { name: 'Profil teilen' }).click();
await pause(2600);
stamp('edit');
await page.getByRole('button', { name: 'Bearbeiten' }).first().click();
await page.getByLabel('Name').waitFor();
await pause(3000);
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
  `${assets}app-profil.mp4`], { stdio: 'inherit' });
writeFileSync(`${assets}app-profil.json`, JSON.stringify(Object.fromEntries(Object.entries({ ...mark, duration: recLen }).map(([k, v]) => [k, +v.toFixed(2)])), null, 2) + '\n');
console.log(`${assets}app-profil.mp4`);
