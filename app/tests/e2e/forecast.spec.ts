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
  await expect(page.getByText('Heute', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Morgen', { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/Quelle: Open-Meteo\.com \(CC BY 4\.0\)/)).toBeVisible();
  expect(api.requests.at(-1)?.searchParams.get('latitude')).toBe('51.326');
  expect(api.requests.at(-1)?.searchParams.get('longitude')).toBe('6.242');

  // Beißfenster: beide Blickwinkel getrennt; mit 1 Eintrag keine Auswertung
  await expect(page.getByRole('heading', { name: 'Beißfenster' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Aus deinem Fangbuch' })).toContainText(
    'Zu wenige Daten (n = 1, ab 20).',
  );
  const solunar = page.getByRole('region', { name: 'Solunar-Zeiten (Theorie)' });
  await expect(solunar).toContainText('wissenschaftlich nicht belegt');
  await expect(solunar.getByText(/Hauptzeit · Mond (oben|unten)/).first()).toBeVisible();
  await expect(solunar.getByText(/% beleuchtet/).first()).toBeVisible();

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

test('FC-3: Beißfenster aus dem Fangbuch – Bisse pro Angelstunde, Luftdruck, Tendenz', async ({ page }) => {
  await useLocalExternals(page);
  await stubGeolocation(page);
  await fakeForecast(page);
  await page.goto('/fangbuch');
  await waitForApp(page);
  // 20 Bisse in zwei Sessions (6–8 Uhr), Wetter: 1012 hPa, fallend
  const day = (d: number) => `2026-10-0${d}`;
  const sessions = [1, 2].map((d) => ({
    id: `s${d}`,
    createdAt: t,
    updatedAt: t,
    rev: 0,
    startAt: `${day(d)}T06:00:00+02:00`,
    endAt: `${day(d)}T08:00:00+02:00`,
    tz: 'Europe/Berlin',
  }));
  const catches = Array.from({ length: 20 }, (_, i) => ({
    ...wittsee,
    id: `b${i}`,
    at: `${day((i % 2) + 1)}T06:${String(10 + i).padStart(2, '0')}:00+02:00`,
    sessionId: `s${(i % 2) + 1}`,
    weather: {
      provider: 'open-meteo',
      fetchedAt: t,
      kind: 'model',
      forHour: '2026-10-01T04:00:00.000Z',
      pressureHpa: 1012,
      pressureTrend3h: -2,
      attribution: 'Open-Meteo.com, CC BY 4.0',
    },
  }));
  await page.evaluate(
    async ({ catches, sessions }) => {
      const req = indexedDB.open('fangpunkt');
      const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
      await new Promise<void>((resolve) => {
        const tx = db.transaction(['catches', 'sessions'], 'readwrite');
        for (const c of catches) tx.objectStore('catches').put(c);
        for (const s of sessions) tx.objectStore('sessions').put(s);
        tx.oncomplete = () => resolve();
      });
      db.close();
    },
    { catches, sessions },
  );
  await page.goto('/wetter');
  await waitForApp(page);
  const own = page.getByRole('region', { name: 'Aus deinem Fangbuch' });
  await expect(own).toContainText('Ausgewertet: 20 Bisse');
  // 20 Bisse in 4 h Angelzeit → 5 pro Stunde im Fenster 6–8 Uhr
  await expect(own.getByRole('row', { name: /6–8 Uhr/ })).toContainText('5 (20 in 4 h)');
  await expect(own.getByRole('row', { name: /1005 bis unter 1015 hPa/ })).toContainText('20');
  await expect(own.getByRole('row', { name: /fallend/ })).toContainText('20');
  // Jetzt: Luftdruck aus der Vorhersage und Anteil deiner Bisse in diesem Bereich
  await expect(own).toContainText(/Luftdruck jetzt \d+ hPa/);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('CAL-1: Angelkalender – Termin eintragen, Wetter am Gewässer, bearbeiten, löschen mit Rückgängig', async ({
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
  await page.goto('/wetter');
  await waitForApp(page);
  await page
    .getByRole('navigation', { name: 'Wetter-Ansicht' })
    .getByRole('link', { name: 'Angelkalender' })
    .click();
  await expect(page).toHaveURL(/\/wetter\/kalender$/);
  await expect(page.getByText('Noch keine Termine')).toBeVisible();

  // Übermorgen wählen und Termin am Wittsee eintragen
  const inTwo = new Date(Date.now() + 2 * 86_400_000).toLocaleDateString('sv-SE', {
    timeZone: 'Europe/Berlin',
  });
  const dayName = new Date(`${inTwo}T12:00:00Z`).toLocaleDateString('de-DE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  if (inTwo.slice(0, 7) !== new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' }).slice(0, 7))
    await page.getByRole('button', { name: 'Nächster Monat' }).click();
  await page.getByRole('button', { name: dayName, exact: true }).click();
  await page.getByRole('button', { name: 'Termin eintragen' }).click();
  const sheet = page.getByRole('dialog', { name: 'Neuer Angeltermin' });
  await expect(sheet.getByLabel('Tag')).toHaveValue(inTwo);
  await sheet.getByLabel('Von').fill('06:00');
  await sheet.getByLabel('Bis').fill('05:00');
  await sheet.getByLabel('Gewässer').selectOption({ label: 'De Wittsee (Nettetal)' });
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(sheet.getByText('Das Ende liegt vor dem Beginn.')).toBeVisible();
  await sheet.getByLabel('Bis').fill('10:00');
  await sheet.getByLabel('Titel (optional)').fill('Hecht vom Ufer');
  await sheet.getByRole('button', { name: 'Speichern' }).click();
  await expect(sheet).toBeHidden();

  // Tag ist markiert; Termin mit Wetter (Vorhersage am Wittsee) und Solunar-Hinweis
  await expect(page.getByRole('button', { name: `${dayName}, 1 Termin` })).toBeVisible();
  const upcoming = page.getByRole('region', { name: 'Nächste Termine' });
  const card = upcoming.getByRole('listitem').filter({ hasText: 'Hecht vom Ufer' });
  await expect(card).toContainText('06:00–10:00 Uhr');
  await expect(card).toContainText('De Wittsee (Nettetal)');
  await expect(card).toContainText('Leichter Regen · 5–12 °C · 1,5 mm');
  await expect(card).toContainText('Solunar-Hauptzeiten (Theorie)');
  await expect.poll(() => api.requests.some((u) => u.searchParams.get('latitude') === '51.319')).toBe(true);

  // Bearbeiten: Titel ändern
  await card.getByRole('button', { name: /Bearbeiten/ }).click();
  const edit = page.getByRole('dialog', { name: 'Termin bearbeiten' });
  await expect(edit.getByLabel('Gewässer')).toHaveValue(/^w:/);
  await edit.getByLabel('Titel (optional)').fill('Zander am Abend');
  await edit.getByRole('button', { name: 'Speichern' }).click();
  await expect(upcoming).toContainText('Zander am Abend');

  // Löschen und rückgängig
  await upcoming.getByRole('button', { name: /Löschen/ }).click();
  await expect(page.getByText('Termin gelöscht.')).toBeVisible();
  await expect(page.getByText('Noch keine Termine')).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(upcoming).toContainText('Zander am Abend');

  // Termin in drei Wochen: Wetter erst später
  await page.getByRole('button', { name: 'Termin eintragen' }).click();
  const far = new Date(Date.now() + 21 * 86_400_000).toLocaleDateString('sv-SE', {
    timeZone: 'Europe/Berlin',
  });
  const s2 = page.getByRole('dialog', { name: 'Neuer Angeltermin' });
  await s2.getByLabel('Tag').fill(far);
  await s2.getByLabel('Gewässer').selectOption({ label: 'De Wittsee (Nettetal)' });
  await s2.getByRole('button', { name: 'Speichern' }).click();
  await expect(upcoming.getByText(/Wetter ab .* \(7 Tage im Voraus\)\./)).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors.filter((e) => !e.includes('Failed to load resource'))).toEqual([]);
});

test('CAL-2: Angelkalender – Ansicht Monat/Woche/Tag, blättern, „Heute“ springt zurück', async ({ page }) => {
  await useLocalExternals(page);
  await stubGeolocation(page);
  await fakeForecast(page);
  await page.goto('/wetter/kalender');
  await waitForApp(page);
  const berlin = (ms: number) => new Date(ms).toLocaleDateString('sv-SE', { timeZone: 'Europe/Berlin' });
  const today = berlin(Date.now());
  const longDay = (d: string) =>
    new Date(`${d}T12:00:00Z`).toLocaleDateString('de-DE', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  const title = page.locator('#cal-title');
  const view = page.getByRole('group', { name: 'Ansicht' });

  // Monat (Standard)
  await expect(view.getByRole('radio', { name: 'Monat' })).toBeChecked();
  await expect(page.getByRole('button', { name: /, / }).first()).toBeVisible();

  // Woche: Kalenderwoche im Titel, nur eine Zeile Tage
  await view.getByRole('radio', { name: 'Woche' }).check();
  await expect(title).toContainText(/^KW \d+ · /);
  await expect(page.locator('table tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: 'Nächste Woche' }).click();
  await page.getByRole('button', { name: 'Nächste Woche' }).click();
  await expect(page.locator('button[aria-current="date"]')).toHaveCount(0);

  // „Heute“ springt zurück
  await page.getByRole('button', { name: 'Zum heutigen Tag springen' }).click();
  await expect(page.locator('button[aria-current="date"]')).toHaveCount(1);

  // Tag: Titel ist der Tag, blättern um einen Tag
  await view.getByRole('radio', { name: 'Tag' }).check();
  await expect(title).toHaveText(longDay(today));
  await expect(page.locator('table')).toHaveCount(0);
  await page.getByRole('button', { name: 'Nächster Tag' }).click();
  await expect(title).toHaveText(longDay(berlin(Date.now() + 86_400_000)));
  await page.getByRole('button', { name: 'Zum heutigen Tag springen' }).click();
  await expect(title).toHaveText(longDay(today));

  // Ansicht bleibt nach dem Neuladen
  await page.reload();
  await waitForApp(page);
  await expect(view.getByRole('radio', { name: 'Tag' })).toBeChecked();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
