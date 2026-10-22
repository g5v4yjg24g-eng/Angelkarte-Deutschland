import { expect, test, type Page } from '@playwright/test';
import type { Catch } from '../../src/domain/schemas';
import { collectErrors, useLocalExternals, waitForApp } from './helpers';

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
async function fakeOpenMeteo(page: Page) {
  const requests: URL[] = [];
  await page.route('https://historical-forecast-api.open-meteo.com/**', async (route) => {
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

async function seed(page: Page, catches: Catch[]) {
  await page.goto('/fangbuch');
  await waitForApp(page);
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

test('WX-1: Wetter ist aus, bis es eingeschaltet wird; offline erfasst, online nachgeladen, gerundet gesendet', async ({
  page,
  context,
}) => {
  const errors = collectErrors(page);
  await useLocalExternals(page);
  const requests = await fakeOpenMeteo(page);
  await seed(page, [withPos, noPos]);

  // Standard: aus – nichts verlässt das Gerät
  await page.goto('/fangbuch/wx-1');
  await waitForApp(page);
  const box = page.getByRole('region', { name: 'Wetter (Modellwert)' });
  await expect(box).toContainText('Wetter kann in den Einstellungen eingeschaltet werden.');
  expect(requests).toHaveLength(0);

  // Offline einschalten → noch kein Abruf, Hinweis „wird geladen"
  await box.getByRole('link').click();
  await expect(page.getByRole('heading', { name: 'Einstellungen' })).toBeVisible();
  await context.setOffline(true);
  const on = page.getByRole('radio', { name: 'Automatisch laden' });
  await on.click();
  await expect(on).toBeChecked();
  await page.goBack();
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

  // Fang ohne Standort: kein Wetterbereich
  await page.goto('/fangbuch/wx-2');
  await waitForApp(page);
  await expect(page.getByRole('region', { name: 'Wetter (Modellwert)' })).toHaveCount(0);

  // 390 px ohne horizontales Scrollen
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/fangbuch/wx-1');
  await waitForApp(page);
  await expect(box).toContainText('Bedeckt');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
