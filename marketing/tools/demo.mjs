// Gemeinsame Beispieldaten und Hilfen für Screenshots und Bildschirmvideos der Live-App.
// Die Daten sind ausgedacht (Möhnesee, NRW) und dienen nur der Darstellung – jede Verwendung trägt den Vermerk „Beispieldaten“.
export const BASE = process.env.APP_URL ?? 'https://g5v4yjg24g-eng.github.io/Angelkarte-Deutschland/';

// Möhnesee (NRW), Wasserpunkte aus der Gewässerebene der App ermittelt
export const WATER = { waterId: 'osm:r2419130', waterSnapshot: { name: 'Möhnesee (Möhnetalsperre)', place: 'Möhnesee' } };
export const SPOTS = [
  [8.10182, 51.48201], [8.10486, 51.48201], [8.10789, 51.48201], [8.11092, 51.48201],
  [8.11699, 51.48579], [8.12306, 51.48579], [8.09879, 51.48012], [8.09575, 51.4839],
];
export const HOME = { latitude: 51.4827, longitude: 8.1168 };

let rngState = 7;
const rnd = () => ((rngState = (rngState * 16807) % 2147483647) / 2147483647);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const iso = (d) => d.toISOString().replace(/\.\d{3}Z$/, '+00:00');
const meta = { createdAt: '2026-10-20T08:00:00+00:00', updatedAt: '2026-10-20T08:00:00+00:00', rev: 0 };

export function demoData() {
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

export async function seed(page, data) {
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

export const waitApp = (page) =>
  page.waitForFunction(() => document.documentElement.dataset.intro === 'done', null, { timeout: 20000 });
