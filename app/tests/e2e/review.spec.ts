import { expect, test, type Page } from './fixtures';
import { collectErrors, useLocalExternals, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await useLocalExternals(page);
});

/** GPS-Attrappe: Fixe werden im Test mit __emit(Meter nach Norden, Genauigkeit, Sekunden später) ausgelöst. */
async function fakeGps(page: Page, mode: 'ok' | 'denied' = 'ok') {
  await page.addInitScript((m) => {
    type W = {
      __watchers: Map<number, { ok: PositionCallback; err?: PositionErrorCallback | null }>;
      __emit: (north: number, acc?: number, dtSec?: number) => void;
      __gpsClock: number;
    };
    const w = window as unknown as W;
    w.__watchers = new Map();
    // Zeit läuft im Test schneller: jeder Fix liegt dtSec nach dem vorigen
    w.__gpsClock = Number(sessionStorage.getItem('gpsClock') ?? Date.now());
    let next = 1;
    w.__emit = (north, acc = 5, dtSec = 30) => {
      w.__gpsClock += dtSec * 1000;
      sessionStorage.setItem('gpsClock', String(w.__gpsClock));
      for (const { ok } of w.__watchers.values())
        ok({
          coords: { latitude: 51.3263 + north / 111_195, longitude: 6.2418, accuracy: acc },
          timestamp: w.__gpsClock,
        } as GeolocationPosition);
    };
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition(ok: PositionCallback, err?: PositionErrorCallback | null) {
          const id = next++;
          if (m === 'denied')
            setTimeout(
              () =>
                err?.({
                  code: 1,
                  PERMISSION_DENIED: 1,
                  POSITION_UNAVAILABLE: 2,
                  TIMEOUT: 3,
                  message: 'denied',
                } as GeolocationPositionError),
              30,
            );
          else w.__watchers.set(id, { ok, err });
          return id;
        },
        clearWatch(id: number) {
          w.__watchers.delete(id);
        },
        getCurrentPosition() {},
      },
    });
  }, mode);
}

const emit = (page: Page, north: number, acc = 5, dtSec = 30) =>
  page.evaluate(([n, a, d]) => (window as unknown as { __emit: (...x: number[]) => void }).__emit(n, a, d), [
    north,
    acc,
    dtSec,
  ] as const);

const watchers = (page: Page) =>
  page.evaluate(() => (window as unknown as { __watchers: Map<number, unknown> }).__watchers.size);

/** Session, Route und Einträge direkt in IndexedDB (wie nach einem Import). */
async function seed(page: Page, data: { sessions?: object[]; tracks?: object[]; catches?: object[] }) {
  await page.evaluate(async (data) => {
    const req = indexedDB.open('fangpunkt');
    const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['sessions', 'tracks', 'catches'], 'readwrite');
      for (const s of data.sessions ?? []) tx.objectStore('sessions').put(s);
      for (const t of data.tracks ?? []) tx.objectStore('tracks').put(t);
      for (const c of data.catches ?? []) tx.objectStore('catches').put(c);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as Error);
    });
    db.close();
  }, data);
}

const meta = { createdAt: '2026-10-20T06:00:00+02:00', updatedAt: '2026-10-20T10:00:00+02:00', rev: 0 };
const START = Date.parse('2026-10-20T06:00:00+02:00');
const MIN = 60_000;
/** Weg nach Norden mit einem Punkt pro Minute; Lücke zwischen 60. und 90. Minute */
const route = (n = 60) => [
  Array.from({ length: n }, (_, i) => ({ t: START + i * MIN, lat: 51.3 + i * 0.0003, lng: 6.2, acc: 5 })),
  Array.from({ length: n }, (_, i) => ({
    t: START + (90 + i) * MIN,
    lat: 51.3 + (60 + i) * 0.0003,
    lng: 6.2 + i * 0.0002,
    acc: 6,
  })),
];
const entry = (id: string, minute: number, extra: object) => ({
  id,
  ...meta,
  // wie in der App: Ortszeit mit Offset
  at: new Date(START + minute * MIN + 2 * 3_600_000).toISOString().replace('.000Z', '+02:00'),
  tz: 'Europe/Berlin',
  sessionId: 'rv',
  ...extra,
});
const reviewData = {
  sessions: [
    {
      id: 'rv',
      ...meta,
      startAt: '2026-10-20T06:00:00+02:00',
      endAt: '2026-10-20T08:40:00+02:00',
      tz: 'Europe/Berlin',
      waterSnapshot: { name: 'De Wittsee' },
    },
  ],
  tracks: [{ id: 'track-rv', ...meta, sessionId: 'rv', segments: route() }],
  catches: [
    entry('bite', 20, { outcome: 'missed_bite', position: { lat: 51.306, lng: 6.2, source: 'gps' } }),
    entry('pike', 40, {
      outcome: 'caught',
      speciesId: 'pike',
      lengthCm: 74,
      lengthMethod: 'measured',
      weightG: 3100,
      weightMethod: 'weighed',
      position: { lat: 51.312, lng: 6.2, source: 'gps' },
      notes: 'Am Schilfrand',
    }),
    // gleiche Stelle wie der Hecht: muss einzeln erreichbar bleiben
    entry('lost', 41, {
      outcome: 'contact',
      contactDetail: 'lost_in_fight',
      position: { lat: 51.312, lng: 6.2, source: 'gps' },
    }),
    entry('seen', 120, { outcome: 'observation', position: { lat: 51.327, lng: 6.206, source: 'gps' } }),
    // ohne Ort: nur in der Chronik
    entry('perch', 130, { outcome: 'caught', speciesId: 'perch', lengthCm: 28, lengthMethod: 'estimated' }),
  ],
};

const mapBox = (page: Page) => page.getByRole('region', { name: 'Karte mit der Route der Session' });
const progress = async (page: Page) => Number(await mapBox(page).getAttribute('data-progress'));
const visible = async (page: Page) =>
  ((await mapBox(page).getAttribute('data-visible-events')) ?? '').split(',');
async function seek(page: Page, permille: number) {
  await page.getByLabel('Zeitpunkt in der Wiedergabe').evaluate((el, v) => {
    const input = el as HTMLInputElement;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, String(v));
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, permille);
}
const reviewReady = (page: Page) =>
  page.waitForFunction(() => !!window.__fangpunktReviewMap?.getLayer('rv-events'), null, { timeout: 30_000 });

test('REV-1: Route während der Session aufzeichnen, Neustart der App, Ende öffnet den Rückblick', async ({
  page,
}) => {
  test.slow();
  const errors = collectErrors(page);
  await fakeGps(page);
  await page.goto('/fangbuch/sessions');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Session starten' }).click();
  const status = page.getByRole('region', { name: 'Route' });
  await expect(status).toContainText('GPS aktiv – warte auf ein genaues Signal');
  // genau ein Standort-Zuhörer
  await expect.poll(() => watchers(page)).toBe(1);

  for (let i = 0; i <= 5; i++) await emit(page, i * 50);
  await expect(status).toContainText('GPS aktiv – Route wird aufgezeichnet.');
  await expect(status).toContainText('6 Punkte · 0,25 km');
  await expect(page.getByRole('link', { name: /Laufende Session.*GPS aktiv/ })).toBeVisible();
  // ungenauer Fix und GPS-Sprung werden nicht gespeichert
  await emit(page, 300, 120);
  await expect(status).toContainText('Schwaches GPS-Signal');
  await emit(page, 5000, 5, 20);
  await expect(status).toContainText('6 Punkte');

  // App schließen und wieder öffnen: Route ist noch da, neuer Abschnitt beginnt
  await page.reload();
  await waitForApp(page);
  await expect(status).toContainText('6 Punkte · 0,25 km');
  await expect.poll(() => watchers(page)).toBe(1);
  await emit(page, 400);
  await emit(page, 450);
  await expect(status).toContainText('8 Punkte · 0,3 km');

  // Beenden: erst gespeichert, dann Rückblick; Zuhörer ist weg
  await page.getByRole('button', { name: 'Session beenden' }).click();
  const dialog = page.getByRole('dialog', { name: /./ });
  await expect(dialog.getByRole('heading', { name: 'Dein Angeltrip im Rückblick' })).toBeVisible();
  await expect.poll(() => watchers(page)).toBe(0);
  await reviewReady(page);
  await expect(dialog).toContainText('0,3 km');
  await expect(dialog).toContainText('einmal unterbrochen');
  await expect(dialog).toContainText('Heute stand das Erkunden im Vordergrund.');
  await page.getByRole('button', { name: 'Rückblick schließen' }).click();
  await expect(page.getByRole('button', { name: 'Rückblick ansehen' })).toBeVisible();

  // In der Liste: Hinweis auf die Route und Zugang zum Rückblick
  await page.goto('/fangbuch/sessions');
  await waitForApp(page);
  await expect(page.getByRole('link', { name: /mit Route/ })).toBeVisible();
  await page.getByRole('link', { name: /^Rückblick ansehen/ }).click();
  await expect(page.getByRole('heading', { name: 'Dein Angeltrip im Rückblick' })).toBeVisible();
  expect(errors.filter((e) => !/status of 404/.test(e))).toEqual([]);
});

test('REV-2: Wiedergabe – Marker zum richtigen Zeitpunkt, Pause, Tempo, erneut abspielen, Chronik ↔ Karte', async ({
  page,
}) => {
  test.slow();
  const errors = collectErrors(page);
  await page.goto('/fangbuch');
  await waitForApp(page);
  await seed(page, reviewData);
  await page.goto('/fangbuch/sessions/rv/rueckblick');
  await waitForApp(page);
  const dialog = page.getByRole('dialog', { name: 'De Wittsee' });
  await expect(dialog).toBeVisible();
  await reviewReady(page);

  // startet von selbst
  await expect.poll(() => progress(page)).toBeGreaterThan(0);
  await dialog.getByRole('button', { name: 'Anhalten' }).click();
  const p1 = await progress(page);
  await page.waitForTimeout(500);
  expect(await progress(page)).toBe(p1);

  // Zeitachse 06:00–08:40 (160 min): Biss bei 20 min = 0,125, Hecht bei 40 min = 0,25
  await seek(page, 120);
  expect(await visible(page)).toEqual(['']);
  await seek(page, 130);
  expect(await visible(page)).toEqual(['bite']);
  await seek(page, 300);
  expect(await visible(page)).toEqual(['bite', 'pike', 'lost']);
  // Route in der Lücke (60–90 min) nicht verbunden: Linie hat nur einen Abschnitt
  await seek(page, 500);
  expect(await mapBox(page).getAttribute('data-route-lines')).toBe('1');
  await seek(page, 1000);
  expect(await mapBox(page).getAttribute('data-route-lines')).toBe('2');
  await seek(page, 500);

  // Weiter abspielen, schneller
  await dialog.getByRole('radio', { name: '4×' }).check();
  await dialog.getByRole('button', { name: 'Abspielen', exact: true }).click();
  const a = await progress(page);
  await page.waitForTimeout(600);
  expect((await progress(page)) - a).toBeGreaterThan(0.08);
  // Ganze Route: alles sichtbar, das Ereignis ohne Ort nicht auf der Karte
  await dialog.getByRole('button', { name: 'Ganze Route' }).click();
  await expect.poll(() => progress(page)).toBe(1);
  expect(await visible(page)).toEqual(['bite', 'pike', 'lost', 'seen']);
  await expect(dialog.locator('li[data-id]')).toHaveCount(5);
  await expect(dialog.getByRole('button', { name: 'Abspielen', exact: true })).toBeVisible();
  // Erneut abspielen beginnt vorn
  await dialog.getByRole('button', { name: 'Erneut abspielen' }).click();
  await expect.poll(() => progress(page)).toBeLessThan(0.5);
  await dialog.getByRole('button', { name: 'Anhalten' }).click();

  // Highlights aus den gespeicherten Daten
  await expect(dialog).toContainText('Deine Highlights');
  await expect(dialog).toContainText('2 Gefangen');
  await expect(dialog).toContainText('1 Verloren');
  await expect(dialog).toContainText('1 Bisse ohne Haken');
  await expect(dialog).toContainText('1 Gesichtet');
  await expect(dialog).toContainText('74 cm');
  await expect(dialog).toContainText('3,1 kg');
  await expect(dialog).toContainText('2 h 40 min');

  // Chronik: Eintrag ohne Ort ist da, aber ohne Kartenknopf
  const perch = dialog.locator('li[data-id="perch"]');
  await expect(perch).toContainText('ohne Ort');
  await expect(perch).toContainText('28 cm');
  // Chronik → Karte: springt hin und hebt hervor
  await dialog.locator('li[data-id="seen"]').getByRole('button', { name: 'Auf der Karte zeigen' }).click();
  await expect.poll(() => visible(page)).toContain('seen');
  await expect(dialog.locator('li[data-id="seen"]')).toHaveAttribute('aria-current', 'true');
  // Karte → Chronik: Marker antippen (Hecht und Verlust liegen übereinander und sind auseinandergezogen)
  await dialog.getByRole('button', { name: 'Ganze Route' }).click();
  await mapBox(page).scrollIntoViewIfNeeded();
  await page.waitForTimeout(800);
  const hits = await page.evaluate(() => {
    const map = window.__fangpunktReviewMap;
    if (!map) return [];
    const r = map.getContainer().getBoundingClientRect();
    return map.queryRenderedFeatures({ layers: ['rv-events'] }).map((f) => {
      const [lng, lat] = (f.geometry as { coordinates: [number, number] }).coordinates;
      const p = map.project([lng, lat]);
      const raw = f.properties.off as unknown;
      const off = (Array.isArray(raw) ? raw : JSON.parse(String(raw))) as [number, number];
      return { id: String(f.properties.id), x: r.left + p.x + off[0], y: r.top + p.y + off[1] };
    });
  });
  const pike = hits.find((h) => h.id === 'pike');
  const lost = hits.find((h) => h.id === 'lost');
  expect(pike && lost && (pike.x !== lost.x || pike.y !== lost.y)).toBe(true);
  if (lost) await page.mouse.click(lost.x, lost.y);
  await expect(dialog.locator('li[data-id="lost"]')).toHaveAttribute('aria-current', 'true');

  // Schließen jederzeit, ohne die Animation abzuwarten
  await page.keyboard.press('Escape');
  await expect(page).toHaveURL(/\/fangbuch\/sessions\/rv$/);
  expect(errors.filter((e) => !/status of 404/.test(e))).toEqual([]);
});

test('REV-3: Ohne Standortfreigabe läuft die Session normal; Rückblick ohne erfundene Route', async ({
  page,
}) => {
  await fakeGps(page, 'denied');
  await page.goto('/fangbuch/sessions');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Session starten' }).click();
  const status = page.getByRole('region', { name: 'Route' });
  await expect(status).toContainText('Standort nicht freigegeben – die Session läuft normal weiter');
  await expect(status.getByRole('button', { name: 'Standort erneut anfragen' })).toBeVisible();
  await page.getByRole('button', { name: 'Session beenden' }).click();
  const dialog = page.getByRole('dialog', { name: /./ });
  await expect(dialog).toContainText('Für diese Session wurde keine Route aufgezeichnet.');
  await expect(dialog).toContainText('Heute stand das Erkunden im Vordergrund.');
  await expect(dialog).toContainText('keine Route');
  await expect(mapBox(page)).toHaveCount(0);
});

test('REV-4: Lange Session (6 000 Punkte), 390 px, Dunkelmodus, ohne Netz', async ({ page, context }) => {
  test.slow();
  const errors = collectErrors(page);
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/fangbuch');
  await waitForApp(page);
  const long = [
    Array.from({ length: 6000 }, (_, i) => ({
      t: START + i * 10_000,
      lat: 51.3 + Math.sin(i / 300) * 0.004,
      lng: 6.2 + i * 0.000004,
      acc: 5,
    })),
  ];
  await seed(page, {
    sessions: [{ ...reviewData.sessions[0], endAt: '2026-10-20T22:40:00+02:00' }],
    tracks: [{ id: 'track-rv', ...meta, sessionId: 'rv', segments: long }],
    catches: reviewData.catches,
  });
  // Erst online öffnen (lädt den Kartenteil der App, den sonst der Service Worker vorhält), dann ohne Netz erneut
  await page.goto('/fangbuch/sessions/rv/rueckblick');
  await waitForApp(page);
  await reviewReady(page);
  await page.getByRole('button', { name: 'Rückblick schließen' }).click();
  await expect(page).toHaveURL(/\/fangbuch\/sessions\/rv$/);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await context.setOffline(true);
  await page.evaluate(() => {
    history.pushState({}, '', '/fangbuch/sessions/rv/rueckblick');
    dispatchEvent(new PopStateEvent('popstate'));
  });
  const dialog = page.getByRole('dialog', { name: 'De Wittsee' });
  await expect(dialog).toContainText('Kartenhintergrund ohne Verbindung nicht verfügbar');
  await reviewReady(page);
  await dialog.getByRole('button', { name: 'Ganze Route' }).click();
  await expect.poll(() => progress(page)).toBe(1);
  // vereinfachte Darstellung, Route bleibt vollständig
  const shown = Number(await mapBox(page).getAttribute('data-route-points'));
  expect(shown).toBeGreaterThan(50);
  expect(shown).toBeLessThanOrEqual(1500);
  await expect(dialog).toContainText('Lange Session');
  await expect(dialog.locator('li[data-id]')).toHaveCount(5);
  // kein seitliches Scrollen, Schließen erreichbar
  expect(
    await dialog.evaluate((d) => {
      const s = d.firstElementChild as HTMLElement;
      return s.scrollWidth <= s.clientWidth;
    }),
  ).toBe(true);
  await expect(page.getByRole('button', { name: 'Rückblick schließen' })).toBeInViewport();
  await context.setOffline(false);
  expect(errors.filter((e) => !/status of 404|ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(e))).toEqual(
    [],
  );
});
