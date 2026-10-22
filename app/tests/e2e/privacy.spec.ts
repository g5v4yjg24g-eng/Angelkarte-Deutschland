// Datenschutz (TEST_PLAN §6): Die App spricht nur mit den Servern, die die Datenschutzseite nennt.
import { expect, test } from './fixtures';
import type { Catch } from '../../src/domain/schemas';
import { useLocalExternals, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

const ALLOWED_EXTERNAL = [
  'tiles.openfreemap.org',
  'historical-forecast-api.open-meteo.com',
  'api.open-meteo.com',
];
const ROUTES = [
  '/',
  '/fangbuch',
  '/fangbuch/priv-1',
  '/fangbuch/sessions',
  '/wetter',
  '/statistik',
  '/mehr',
  '/mehr/einstellungen',
  '/mehr/koeder',
  '/mehr/daten',
  '/mehr/recht',
  '/mehr/recht/BY',
  '/mehr/info',
  '/mehr/datenschutz',
];
const t = '2026-10-20T15:12:00+02:00';
const withPosition: Catch = {
  id: 'priv-1',
  createdAt: t,
  updatedAt: t,
  rev: 0,
  outcome: 'caught',
  at: '2026-10-20T15:10:00+02:00',
  tz: 'Europe/Berlin',
  speciesId: 'pike',
  position: { lat: 51.3245, lng: 6.2425, source: 'gps' },
  notes: 'geheime Stelle',
};

test('PRIV-1: nur App-Server, OpenFreeMap und Open-Meteo; Fänge und Notizen verlassen das Gerät nicht', async ({
  page,
  baseURL,
}) => {
  test.slow();
  await useLocalExternals(page);
  const requests: URL[] = [];
  page.on('request', (r) => requests.push(new URL(r.url())));
  await page.goto('/fangbuch');
  await waitForApp(page);
  await page.evaluate(async (c) => {
    const req = indexedDB.open('fangpunkt');
    const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
    await new Promise<void>((resolve) => {
      const tx = db.transaction(['catches'], 'readwrite');
      tx.objectStore('catches').put(c);
      tx.oncomplete = () => resolve();
    });
    db.close();
  }, withPosition);
  for (const r of ROUTES) {
    await page.goto(r);
    await waitForApp(page);
    await page.waitForTimeout(500);
  }
  const app = new URL(baseURL ?? 'http://localhost').host;
  const hosts = [...new Set(requests.filter((u) => /^https?:$/.test(u.protocol)).map((u) => u.host))];
  expect(hosts.filter((h) => h !== app && !ALLOWED_EXTERNAL.includes(h))).toEqual([]);
  // Wetter: nur gerundete Position, nie Notizen oder Fang-IDs
  for (const u of requests.filter((x) => x.host === 'historical-forecast-api.open-meteo.com')) {
    expect(u.searchParams.get('latitude')).toBe('51.325');
    expect(u.href).not.toContain('geheime');
    expect(u.href).not.toContain('priv-1');
  }
  expect(requests.some((u) => u.host === 'historical-forecast-api.open-meteo.com')).toBe(true);

  // Die Seite nennt genau diese Server
  await page.goto('/mehr/datenschutz');
  await waitForApp(page);
  for (const name of ['GitHub Pages', 'OpenFreeMap (tiles.openfreemap.org)', 'Open-Meteo'])
    await expect(page.getByText(name, { exact: false }).first()).toBeVisible();
});
