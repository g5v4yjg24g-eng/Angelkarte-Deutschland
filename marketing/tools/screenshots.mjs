// Echte Screenshots der Live-App (GitHub Pages) mit klar gekennzeichneten BEISPIELDATEN.
// Die Daten sind ausgedacht und dienen nur der Darstellung; jedes Motiv, das sie zeigt, trägt den Vermerk „Beispieldaten“.
// Aufruf (Repo-Root): node marketing/tools/screenshots.mjs  → marketing/screenshots/*.png
import { mkdirSync } from 'node:fs';
import { chromium } from '../../node_modules/.pnpm/node_modules/playwright/index.mjs';

const BASE = process.env.APP_URL ?? 'https://g5v4yjg24g-eng.github.io/Angelkarte-Deutschland/';
const OUT = new URL('../screenshots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// Möhnesee (NRW), Wasserpunkte aus der Gewässerebene der App ermittelt
const WATER = { waterId: 'osm:r2419130', waterSnapshot: { name: 'Möhnesee (Möhnetalsperre)', place: 'Möhnesee' } };
const SPOTS = [
  [8.10182, 51.48201], [8.10486, 51.48201], [8.10789, 51.48201], [8.11092, 51.48201],
  [8.11699, 51.48579], [8.12306, 51.48579], [8.09879, 51.48012], [8.09575, 51.4839],
];
const HOME = { latitude: 51.4827, longitude: 8.1168 };

let rngState = 7;
const rnd = () => ((rngState = (rngState * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, '+00:00');
const meta = { createdAt: '2026-10-20T08:00:00+00:00', updatedAt: '2026-10-20T08:00:00+00:00', rev: 0 };

function demoData() {
  rngState = 7;
  const species = [
    ['zander', 'jigging', { name: 'Gummifisch 10 cm', type: 'softbait', color: 'Motoroil' }, [38, 72]],
    ['perch', 'dropshot', { name: 'Dropshot-Shad 7 cm', type: 'softbait', color: 'Natur' }, [18, 38]],
    ['pike', 'spinning', { name: 'Wobbler 12 cm', type: 'crankbait', color: 'Hecht' }, [55, 95]],
    ['perch', 'spinning', { name: 'Spinner Gr. 3', type: 'spinner' }, [16, 32]],
  ];
  const days = ['06-06', '06-14', '06-28', '07-05', '07-19', '08-02', '08-16', '08-30', '09-06', '09-13', '09-20', '09-27', '10-04', '10-11', '10-18'];
  const sessions = [];
  const catches = [];
  days.forEach((d, i) => {
    const evening = i % 3 !== 0;
    const start = new Date(`2026-${d}T${evening ? '16:30' : '05:30'}:00+02:00`);
    const hours = 3 + Math.floor(rnd() * 3);
    const end = new Date(start.getTime() + hours * 3600e3);
    const sid = `demo-s${i}`;
    sessions.push({ id: sid, ...meta, startAt: iso(start), endAt: iso(end), tz: 'Europe/Berlin', ...WATER, title: evening ? 'Abendansitz' : 'Morgens am Damm' });
    const n = 3 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const at = new Date(start.getTime() + (0.3 + rnd() * (hours - 0.5)) * 3600e3);
      const [sp, method, bait, [lo, hi]] = pick(species);
      const [lng, lat] = pick(SPOTS);
      const r = rnd();
      const outcome = r < 0.55 ? 'caught' : r < 0.8 ? 'contact' : 'missed_bite';
      const c = {
        id: `demo-c${i}-${k}`, ...meta, outcome, at: iso(at), tz: 'Europe/Berlin', sessionId: sid, stateCode: 'NW',
        position: { lat: lat + (rnd() - 0.5) * 0.0012, lng: lng + (rnd() - 0.5) * 0.0012, source: 'map-tap' },
        ...WATER, method, bait,
      };
      if (outcome === 'caught') {
        Object.assign(c, { speciesId: sp, lengthCm: Math.round(lo + rnd() * (hi - lo)), lengthMethod: 'measured', released: rnd() < 0.6 ? 'released' : 'kept' });
      }
      if (outcome === 'contact') c.contactDetail = pick(['lost_on_hook_set', 'lost_in_fight', 'lost_at_landing']);
      catches.push(c);
    }
  });
  const places = [
    { id: 'demo-p1', ...meta, type: 'spot', name: 'Kante am Damm', position: { lat: 51.4836, lng: 8.1035, source: 'map-tap' }, ...WATER },
    { id: 'demo-p2', ...meta, type: 'jetty', name: 'Steg Bucht', position: { lat: 51.4838, lng: 8.1185, source: 'map-tap' }, ...WATER },
    { id: 'demo-p3', ...meta, type: 'parking', name: 'Parkplatz', position: { lat: 51.4795, lng: 8.1115, source: 'map-tap' } },
  ];
  const trips = [
    { id: 'demo-t1', ...meta, date: '2026-10-25', from: '07:00', to: '11:00', tz: 'Europe/Berlin', ...WATER, title: 'Zander am Damm' },
    { id: 'demo-t2', ...meta, date: '2026-10-31', from: '15:00', to: '18:30', tz: 'Europe/Berlin', ...WATER, title: 'Barsch mit Dropshot' },
  ];
  return { sessions, catches, places, trips };
}

async function seed(page, data) {
  await page.evaluate(async (data) => {
    const req = indexedDB.open('fangpunkt');
    const db = await new Promise((r) => (req.onsuccess = () => r(req.result)));
    await new Promise((resolve, reject) => {
      const tx = db.transaction(['catches', 'sessions', 'places', 'trips', 'settings'], 'readwrite');
      for (const k of ['catches', 'sessions', 'places', 'trips']) for (const r of data[k]) tx.objectStore(k).put(r);
      tx.objectStore('settings').put({ key: 'lastBackupAt', value: new Date().toISOString() });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }, data);
}

const waitApp = (page) =>
  page.waitForFunction(() => document.documentElement.dataset.intro === 'done', null, { timeout: 20000 });

async function run(theme) {
  const browser = await chromium.launch({
    executablePath: process.env.CHROME ?? '/opt/pw-browsers/chromium',
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, locale: 'de-DE', timezoneId: 'Europe/Berlin',
    geolocation: HOME, permissions: ['geolocation'], colorScheme: theme, serviceWorkers: 'block',
  });
  const page = await ctx.newPage();
  const go = async (path) => {
    await page.goto(new URL(path, BASE).href);
    await waitApp(page);
  };
  const shot = (name) => page.screenshot({ path: `${OUT}${theme}-${name}.png` });

  await go('./fangbuch');
  await seed(page, demoData());
  await page.evaluate(() => localStorage.setItem('fangpunkt.locHintSeen', '1'));
  await go('./fangbuch');
  // Wetter am Fang lädt im Hintergrund nach (echte Modellwerte von Open-Meteo)
  await page.waitForTimeout(25000);
  // Das Nachladen ändert die Einträge; danach als gesichert markieren, damit die Erinnerung nicht im Bild steht
  await seed(page, { catches: [], sessions: [], places: [], trips: [] });
  await go('./fangbuch');
  await page.waitForTimeout(1500);
  await shot('fangbuch');

  await page.locator('main a[href*="/fangbuch/demo-c"]').first().click();
  await page.waitForTimeout(2500);
  await shot('fang-detail');

  await go('./statistik');
  await page.waitForTimeout(2000);
  await shot('statistik');
  await page.mouse.wheel(0, 900);
  await page.waitForTimeout(800);
  await shot('statistik-2');

  await go('./wetter');
  await page.getByText(/Die nächsten Tage/i).first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(3000);
  await shot('wetter');
  const toHeading = async (re, name) => {
    await page.getByText(re).first().evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await page.evaluate(() => window.scrollBy(0, -70));
    await page.waitForTimeout(1000);
    await shot(name);
  };
  await toHeading(/Luftdruck-Verlauf/i, 'wetter-luftdruck');
  await toHeading(/Pegel in der Nähe/i, 'wetter-pegel');
  await toHeading(/^Beißfenster$/i, 'wetter-beissfenster');
  await toHeading(/Aus deinem Fangbuch/i, 'wetter-bisse');

  await go('./wetter/kalender');
  await page.waitForTimeout(2500);
  await shot('kalender');

  await go('./mehr/recht');
  await page.waitForTimeout(1500);
  await shot('recht');

  await go('./');
  await page.waitForFunction(() => window.__fangpunktMap?.loaded(), null, { timeout: 30000 });
  await page.evaluate(() => window.__fangpunktMap.jumpTo({ center: [8.1095, 51.4832], zoom: 13.9 }));
  await page.waitForTimeout(7000);
  await shot('karte');
  await page.evaluate(() => localStorage.setItem('fangpunkt.heatmap', '1'));
  await go('./');
  await page.waitForFunction(() => window.__fangpunktMap?.loaded(), null, { timeout: 30000 });
  await page.evaluate(() => window.__fangpunktMap.jumpTo({ center: [8.1095, 51.4832], zoom: 13.9 }));
  await page.waitForTimeout(7000);
  await shot('karte-heatmap');
  await page.evaluate(() => localStorage.removeItem('fangpunkt.heatmap'));

  await browser.close();
}

for (const theme of (process.env.THEMES ?? 'light,dark').split(',')) {
  await run(theme);
  console.log('fertig:', theme);
}
