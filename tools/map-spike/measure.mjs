// Messung Spike S2 (headless Chromium, Smartphone-Viewport, 4× CPU-Drosselung).
// Achtung: Headless nutzt Software-WebGL – FPS-Werte sind Untergrenzen, kein Ersatz für echte Geräte.
// Aufruf: DATA_DIR=<pipeline-ausgabe> OUT_DIR=<screenshots> node measure.mjs
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright');
const PORT = 8131, BASE = `http://localhost:${PORT}/index.html`;
const OUT = process.env.OUT_DIR ?? 'out';
mkdirSync(OUT, { recursive: true });

const srv = spawn(process.execPath, ['serve.mjs'], { env: { ...process.env, PORT: String(PORT) }, stdio: 'ignore' });
await new Promise((r) => setTimeout(r, 800));

const VIEWS = [
  { id: 'deutschland', lat: 51.2, lng: 10.4, z: 5.3 },
  { id: 'koeln', lat: 50.94, lng: 6.96, z: 11 },
  { id: 'de-wittsee', lat: 51.3226, lng: 6.2438, z: 14 },
];
const STYLES = (process.env.STYLES ?? 'liberty,positron,dark').split(',');
const ONLY = process.env.VIEWS?.split(',');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const results = [];

async function run(style, view, water) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  const bytes = { basemap: 0, water: 0 }, reqs = { basemap: 0, water: 0 };
  // context-Ereignisse erfassen auch Abrufe aus MapLibre-Workern
  ctx.on('requestfinished', async (r) => {
    const u = r.url(), size = (await r.sizes().catch(() => null))?.responseBodySize ?? 0;
    if (u.includes('openfreemap.org')) { bytes.basemap += size; reqs.basemap++; }
    else if (u.includes('/data/water.pmtiles')) { bytes.water += size; reqs.water++; }
  });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}?style=${style}&water=${water ? 1 : 0}&lat=${view.lat}&lng=${view.lng}&z=${view.z}`);
  // Zeit ab Navigationsstart bis zum ersten 'idle' (alle sichtbaren Kacheln geladen und gezeichnet)
  await page.waitForFunction(() => window.__firstIdleMs !== undefined, null, { timeout: 90_000 });
  const idleMs = Math.round(await page.evaluate(() => window.__firstIdleMs));
  // Verschiebe-Test: 3 s lang panBy, Bilder zählen
  const fps = await page.evaluate(() => new Promise((resolve) => {
    let frames = 0; const end = performance.now() + 3000;
    const tick = () => { frames++; if (performance.now() < end) { window.__map.panBy([4, 2], { animate: false }); requestAnimationFrame(tick); } else resolve(frames / 3); };
    requestAnimationFrame(tick);
  }));
  const attribution = await page.textContent('.maplibregl-ctrl-attrib');
  if (view.id !== 'deutschland' || style === 'liberty')
    await page.screenshot({ path: join(OUT, `${style}-${view.id}${water ? '-water' : ''}.png`) });
  console.log(style, view.id, water, idleMs, "ms");
  results.push({ style, view: view.id, water, idleMs, fps: Math.round(fps), reqs, kb: { basemap: Math.round(bytes.basemap / 1024), water: Math.round(bytes.water / 1024) }, attribution: attribution?.trim(), errors });
  await ctx.close();
}

for (const style of STYLES) for (const view of VIEWS) if (!ONLY || ONLY.includes(view.id)) await run(style, view, false);
if (process.env.WATER === '1') for (const view of VIEWS) if (!ONLY || ONLY.includes(view.id)) await run('liberty', view, true);

await browser.close();
srv.kill();
writeFileSync(join(OUT, 'results.json'), JSON.stringify(results, null, 2));
console.table(results.map(({ attribution, errors, reqs, kb, ...r }) => ({ ...r, reqBase: reqs.basemap, kbBase: kb.basemap, reqWater: reqs.water, kbWater: kb.water, errors: errors.length })));
console.log('Attribution:', results[0]?.attribution);
