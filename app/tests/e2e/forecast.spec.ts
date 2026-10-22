import { expect, test, type Page, type Route } from './fixtures';
import type { Catch } from '../../src/domain/schemas';
import { collectErrors, useLocalExternals, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

const HOUR = 3_600_000;
/** Mitternacht in Berlin (Sommer- oder Winterzeit) für den Tag von `ms` */
function berlinMidnight(ms: number): number {
  const day = new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  for (const off of [1, 2]) {
    const c = Date.parse(`${day}T00:00:00Z`) - off * HOUR;
    if (new Date(c).toLocaleString('sv-SE', { timeZone: 'Europe/Berlin' }).startsWith(`${day} 00:00`))
      return c;
  }
  throw new Error('Zeitzone');
}

/** Simulierte Forecast-API: 9 Tage ab gestern, Luftdruck fällt 0,1 hPa/h (3 h = −0,3 hPa, ohne Rundungsgrenze). Anfragen werden mitgeschrieben. */
async function fakeForecast(page: Page) {
  const requests: URL[] = [];
  let fail = false;
  await page.route('https://api.open-meteo.com/**', async (route: Route) => {
    const u = new URL(route.request().url());
    requests.push(u);
    if (fail) return route.abort();
    const start = berlinMidnight(Date.now() - 86_400_000);
    const days = Array.from({ length: 9 }, (_, i) => berlinMidnight(start + i * 86_400_000 + 12 * HOUR));
    const hours = Array.from({ length: 9 * 24 }, (_, i) => start + i * HOUR);
    await route.fulfill({
      json: {
        hourly: {
          time: hours.map((t) => t / 1000),
          pressure_msl: hours.map((_, i) => 1025 - i * 0.1),
          temperature_2m: hours.map(() => 9),
          wind_speed_10m: hours.map(() => 4),
          wind_direction_10m: hours.map(() => 270),
          wind_gusts_10m: hours.map(() => 9),
          weather_code: hours.map(() => 3),
        },
        daily: {
          time: days.map((t) => t / 1000),
          sunrise: days.map((t) => (t + 8 * HOUR) / 1000),
          sunset: days.map((t) => (t + 18 * HOUR) / 1000),
          temperature_2m_max: days.map(() => 12),
          temperature_2m_min: days.map(() => 5),
          precipitation_sum: days.map(() => 1.5),
          weather_code: days.map(() => 61),
        },
      },
    });
  });
  return { requests, setFail: (v: boolean) => (fail = v) };
}

async function stubGeolocation(page: Page) {
  await page.addInitScript(() => {
    const ok = (cb: PositionCallback) =>
      setTimeout(
        () =>
          cb({
            coords: { latitude: 51.32634, longitude: 6.24178, accuracy: 30 },
            timestamp: Date.now(),
          } as GeolocationPosition),
        30,
      );
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: ok,
        watchPosition: (cb: PositionCallback) => (ok(cb), 1),
        clearWatch() {},
      },
      configurable: true,
    });
  });
}

const t = '2026-10-20T15:12:00+02:00';
const wittsee: Catch = {
  id: 'fc-1',
  createdAt: t,
  updatedAt: t,
  rev: 0,
  outcome: 'caught',
  at: t,
  tz: 'Europe/Berlin',
  position: { lat: 51.31871, lng: 6.25012, source: 'gps' },
  waterId: 'osm:w1',
  waterSnapshot: { name: 'De Wittsee', place: 'Nettetal' },
};

test('FC-1: Wetter-Bereich mit Vorhersage, Luftdruck-Verlauf, Ortswahl, Zwischenspeicher', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await useLocalExternals(page);
  await stubGeolocation(page);
  const api = await fakeForecast(page);
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
  }, wittsee);
  // Direkt in IndexedDB geschrieben: neu laden, damit Dexie den Eintrag sieht
  await page.reload();
  await waitForApp(page);

  // Über die Leiste erreichbar; Standard: eigener Standort (gerundet)
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Wetter' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Wetter' })).toBeVisible();
  const now = page.getByRole('region', { name: 'Jetzt' });
  await expect(now).toContainText('9 °C');
  await expect(now).toContainText('Bedeckt');
  await expect(now).toContainText('−0,3 hPa in 3 h');
  await expect(page.getByRole('img', { name: /Luftdruck-Verlauf von/ })).toBeVisible();
  await expect(page.getByText('Heute', { exact: true })).toBeVisible();
  await expect(page.getByText('Morgen', { exact: true })).toBeVisible();
  await expect(page.getByText(/Quelle: Open-Meteo\.com \(CC BY 4\.0\)/)).toBeVisible();
  expect(api.requests.at(-1)?.searchParams.get('latitude')).toBe('51.326');
  expect(api.requests.at(-1)?.searchParams.get('longitude')).toBe('6.242');

  // Gewässer aus dem Fangbuch wählen → Vorhersage dort; Wahl bleibt
  await page.getByLabel('Ort').selectOption({ label: 'De Wittsee (Nettetal)' });
  await expect.poll(() => api.requests.at(-1)?.searchParams.get('latitude')).toBe('51.319');
  await page.reload();
  await waitForApp(page);
  await expect(page.getByLabel('Ort')).toHaveValue(/^w:/);

  // Dienst nicht erreichbar → letzte Vorhersage mit Hinweis
  api.setFail(true);
  await page.reload();
  await waitForApp(page);
  await expect(page.getByText(/Ohne Verbindung – gezeigt wird die Vorhersage von/)).toBeVisible();
  await expect(now).toContainText('9 °C');

  // 390 px ohne horizontales Scrollen
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors.filter((e) => !e.includes('Failed to load resource'))).toEqual([]);
});

test('FC-2: Wetter ausgeschaltet → keine Abfrage, Hinweis mit Link', async ({ page }) => {
  await useLocalExternals(page);
  await stubGeolocation(page);
  const api = await fakeForecast(page);
  await page.goto('/mehr/einstellungen');
  await waitForApp(page);
  const off = page.getByRole('group', { name: 'Wetter am Fang' }).getByRole('radio', { name: 'Aus' });
  await off.click();
  await expect(off).toBeChecked();
  await page.goto('/wetter');
  await waitForApp(page);
  await expect(page.getByRole('link', { name: /Wetter ist ausgeschaltet/ })).toBeVisible();
  expect(api.requests).toHaveLength(0);
});
