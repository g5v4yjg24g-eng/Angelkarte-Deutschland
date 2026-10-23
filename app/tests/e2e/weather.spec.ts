import { expect, test, type Page } from './fixtures';
import type { Catch } from '../../src/domain/schemas';
import { collectErrors, startCatchAt, useLocalExternals, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

const AT = '2026-10-20T15:10:00+02:00';
const stamp = '2026-10-20T15:12:00+02:00';
const withPos: Catch = {
  id: 'wx-1',
  createdAt: stamp,
  updatedAt: stamp,
  rev: 0,
  outcome: 'caught',
  at: AT,
  tz: 'Europe/Berlin',
  speciesId: 'pike',
  position: { lat: 51.3123456, lng: 6.2098765, source: 'gps' },
};
const noPos: Catch = { ...withPos, id: 'wx-2', position: undefined };

/** Open-Meteo nie wirklich abrufen: Antwort aus den angefragten Stunden bauen, Anfragen mitschreiben. */
async function fakeOpenMeteo(page: Page, host = 'historical-forecast-api.open-meteo.com') {
  const requests: URL[] = [];
  await page.route(`https://${host}/**`, async (route) => {
    const u = new URL(route.request().url());
    requests.push(u);
    const start = Date.parse(`${u.searchParams.get('start_hour')}:00Z`);
    const end = Date.parse(`${u.searchParams.get('end_hour')}:00Z`);
    const time: string[] = [];
    for (let t = start; t <= end; t += 3_600_000) time.push(new Date(t).toISOString().slice(0, 16));
    const n = time.length;
    await route.fulfill({
      json: {
        hourly: {
          time,
          temperature_2m: Array(n).fill(9.4),
          pressure_msl: time.map((_, i) => 1020.7 - i),
          wind_speed_10m: Array(n).fill(3.77),
          wind_direction_10m: Array(n).fill(101),
          wind_gusts_10m: Array(n).fill(7.4),
          cloud_cover: Array(n).fill(100),
          precipitation: Array(n).fill(0),
          weather_code: Array(n).fill(3),
        },
      },
    });
  });
  return requests;
}

/** Direkt in IndexedDB legen (wie nach einem Import); funktioniert auch offline. */
async function put(page: Page, catches: Catch[]) {
  await page.evaluate(async (catches) => {
    const req = indexedDB.open('fangpunkt');
    const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['catches'], 'readwrite');
      for (const c of catches) tx.objectStore('catches').put(c);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as Error);
    });
    db.close();
  }, catches);
}

const later: Catch = {
  ...withPos,
  id: 'wx-3',
  at: '2026-10-21T08:00:00+02:00',
  createdAt: '2026-10-21T08:05:00+02:00',
  updatedAt: '2026-10-21T08:05:00+02:00',
  speciesId: 'perch',
};

test('WX-1: Wetter ist standardmäßig an; offline erfasst, online nachgeladen, gerundet gesendet; abschaltbar', async ({
  page,
  context,
}) => {
  const errors = collectErrors(page);
  await useLocalExternals(page);
  const requests = await fakeOpenMeteo(page);
  await page.goto('/fangbuch');
  await waitForApp(page);

  // Offline erfasst → noch kein Abruf, Hinweis „wird geladen"
  await context.setOffline(true);
  await put(page, [withPos, noPos]);
  // Ohne Netz kein page.goto: im Client navigieren
  await page.evaluate(() => {
    history.pushState({}, '', '/fangbuch/wx-1');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  const box = page.getByRole('region', { name: 'Wetter (Modellwert)' });
  await expect(box).toContainText('Wird geladen, sobald eine Verbindung besteht.');
  expect(requests).toHaveLength(0);

  // Wieder online → Wetter wird nachgeladen und als Modellwert gekennzeichnet
  await context.setOffline(false);
  await expect(box).toContainText('Bedeckt');
  await expect(box).toContainText('9,4 °C');
  await expect(box).toContainText('3,8 m/s · aus O · Böen 7,4 m/s');
  await expect(box).toContainText('1018 hPa · −3 hPa in 3 h');
  await expect(box).toContainText('nicht am Gewässer gemessen');
  await expect(box).toContainText('Quelle: Open-Meteo.com, CC BY 4.0');

  // Datenschutz: genau ein Abruf (nur der Fang mit Standort), Koordinaten auf 3 Stellen gerundet
  expect(requests).toHaveLength(1);
  expect(requests[0]?.searchParams.get('latitude')).toBe('51.312');
  expect(requests[0]?.searchParams.get('longitude')).toBe('6.210');
  expect(requests[0]?.href).not.toContain('51.3123');

  // 390 px ohne horizontales Scrollen
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  // Abschalten → neue Fänge werden nicht mehr abgefragt
  await page.goto('/mehr/einstellungen');
  await waitForApp(page);
  const on = page.getByRole('radio', { name: 'Automatisch laden' });
  await expect(on).toBeChecked();
  const off = page.getByRole('group', { name: 'Wetter am Fang' }).getByRole('radio', { name: 'Aus' });
  await off.click();
  await expect(off).toBeChecked();
  await put(page, [later]);
  await page.goto('/fangbuch/wx-3');
  await waitForApp(page);
  await expect(box).toContainText('Wetter ist ausgeschaltet.');
  await page.goto('/fangbuch/wx-2');
  await waitForApp(page);
  await expect(page.getByRole('region', { name: 'Wetter (Modellwert)' })).toHaveCount(0);
  expect(requests).toHaveLength(1);
  expect(errors).toEqual([]);
});

test('GAUGE-3: Pegel am Fang – Wasserstand zum Fangzeitpunkt wird gespeichert, ohne Position zu senden', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await useLocalExternals(page);
  await fakeOpenMeteo(page);
  const HOUR = 3_600_000;
  // Fang vor zwei Tagen (Messreihen reichen 30 Tage zurück), außerhalb von NRW
  const at = Math.floor((Date.now() - 48 * HOUR) / HOUR) * HOUR;
  const iso = new Date(at).toISOString().replace('.000Z', '+00:00');
  const requests: URL[] = [];
  await page.route('https://www.pegelonline.wsv.de/**', (route) => {
    const u = new URL(route.request().url());
    requests.push(u);
    if (u.pathname.endsWith('/W/measurements.json')) {
      const from = Date.parse(u.searchParams.get('start') ?? '');
      const to = Date.parse(u.searchParams.get('end') ?? '');
      const json = [];
      for (let t = from; t <= to; t += 15 * 60_000)
        json.push({ timestamp: new Date(t).toISOString(), value: 400 + Math.round((t - at) / HOUR) });
      return route.fulfill({ json });
    }
    return route.fulfill({
      json: [
        {
          uuid: 'test-hh',
          longname: 'HAMBURG ST. PAULI',
          latitude: 53.545,
          longitude: 9.97,
          water: { longname: 'ELBE' },
          timeseries: [
            { shortname: 'W', unit: 'cm', currentMeasurement: { value: 410, stateMnwMhw: 'normal' } },
          ],
        },
      ],
    });
  });
  await page.goto('/fangbuch');
  await waitForApp(page);
  await put(page, [
    {
      ...withPos,
      id: 'g-1',
      at: iso,
      tz: 'UTC',
      createdAt: iso,
      updatedAt: iso,
      position: { lat: 53.5512345, lng: 9.9934567, source: 'gps' },
    },
  ]);
  await page.goto('/fangbuch/g-1');
  await waitForApp(page);
  const box = page.getByRole('region', { name: 'Pegel am Fang' });
  await expect(box).toContainText('Hamburg St. Pauli · Elbe');
  await expect(box).toContainText('km vom Fangort');
  await expect(box).toContainText('400 cm · +24 cm in 24 h');
  await expect(box).toContainText('keine Wassertiefe');
  await expect(box).toContainText('PEGELONLINE');
  // Lage zu MNW/MHW gibt es für vergangene Zeitpunkte nicht → nicht vom aktuellen Wert übernehmen
  await expect(box).not.toContainText('normal');
  // Keine Position in den Anfragen
  for (const u of requests) expect(u.search).not.toMatch(/53\.|9\.9|lat|lon/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('WX-3: Wetter erscheint schon beim Erfassen unter „Mehr Details“, lässt sich übernehmen und wird gespeichert', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await useLocalExternals(page);
  // gerade erfasster Fang → Forecast-API (die letzten Stunden fehlen im Archiv womöglich noch)
  const requests = await fakeOpenMeteo(page, 'api.open-meteo.com');
  await page.goto('/');
  await waitForApp(page);
  await page.waitForFunction(() => !!window.__fangpunktMap?.getLayer('fp-places'), null, { timeout: 30_000 });
  await startCatchAt(page);
  const form = page.getByRole('dialog', { name: 'Fang oder Kontakt erfassen' });
  await form.getByText('Mehr Details').click();
  const box = form.getByRole('region', { name: 'Wetter am Fangort (Modellwert)' });
  await expect(box).toContainText('Bedeckt');
  await expect(box).toContainText('9,4 °C');
  await expect(box).toContainText('3,8 m/s · aus O · Böen 7,4 m/s');
  await expect(box).toContainText('nicht am Gewässer gemessen');
  // Nicht still in die eigenen Felder: erst auf Wunsch übernehmen
  await expect(form.getByLabel('Lufttemperatur (°C)')).toHaveValue('');
  await box.getByRole('button', { name: 'In die Felder übernehmen' }).click();
  await expect(form.getByLabel('Lufttemperatur (°C)')).toHaveValue('9,4');
  await expect(form.getByLabel(/Wind/)).toHaveValue('3');
  await expect(form.getByRole('combobox', { name: 'Himmel' })).toHaveValue('cloudy');

  await form.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Fang gespeichert.')).toBeVisible();
  // Gespeichert ist das Wetter aus dem Formular – kein zweiter Abruf
  const stored = await page.evaluate(async () => {
    const req = indexedDB.open('fangpunkt');
    const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
    const all = await new Promise<{ weather?: { tempC?: number } }[]>((r) => {
      const g = db.transaction('catches').objectStore('catches').getAll();
      g.onsuccess = () => r(g.result as { weather?: { tempC?: number } }[]);
    });
    db.close();
    return all.map((c) => c.weather?.tempC);
  });
  expect(stored).toEqual([9.4]);
  await page.waitForTimeout(500);
  expect(requests).toHaveLength(1);
  expect(requests[0]?.searchParams.get('latitude')).toMatch(/^\d+\.\d{3}$/);
  expect(errors).toEqual([]);
});
