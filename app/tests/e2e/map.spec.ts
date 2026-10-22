import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { legacyExport } from '../../src/test/fixtures/legacy-angelkarte-v2';
import { collectErrors, screenPoint, serveWaterFixture, tapRendered, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

// Lokaler Ersatz für OpenFreeMap: Tests belasten den Dienst nicht und laufen ohne Netz.
/** Erwartete Meldungen: Gewässerdaten sind in diesen Tests absichtlich nicht vorhanden (404). */
const unexpected = (errors: string[]) => errors.filter((e) => !/status of 404/.test(e));

const TEST_STYLE = {
  version: 8,
  name: 'test',
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#dfe8e8' } }],
};

async function mockBasemap(page: Page) {
  // Kartentests ohne Gewässerdaten (die prüft water.spec.ts); sonst öffnet ein Tipp ins Wasser das Profil
  await serveWaterFixture(page, { missing: true });
  let styleRequests = 0;
  await page.route('https://tiles.openfreemap.org/**', (route) => {
    styleRequests++;
    return route.fulfill({ json: TEST_STYLE });
  });
  return () => styleRequests;
}

/** Zählt Standortabfragen; mode steuert die Antwort. */
async function stubGeolocation(page: Page, mode: 'ok' | 'denied') {
  await page.addInitScript((m) => {
    const w = window as unknown as { __geoCalls: number };
    w.__geoCalls = 0;
    const geo = {
      watchPosition(ok: PositionCallback, err?: PositionErrorCallback | null) {
        w.__geoCalls++;
        setTimeout(() => {
          if (m === 'ok')
            ok({
              coords: { latitude: 51.3263, longitude: 6.2418, accuracy: 25 },
              timestamp: Date.now(),
            } as GeolocationPosition);
          else
            err?.({
              code: 1,
              PERMISSION_DENIED: 1,
              POSITION_UNAVAILABLE: 2,
              TIMEOUT: 3,
              message: 'denied',
            } as GeolocationPositionError);
        }, 50);
        return 1;
      },
      clearWatch() {},
      getCurrentPosition() {
        w.__geoCalls++;
      },
    };
    Object.defineProperty(navigator, 'geolocation', { value: geo, configurable: true });
  }, mode);
}

async function openMap(page: Page, at?: { lat: number; lng: number; zoom: number }) {
  if (at)
    await page.addInitScript((v) => localStorage.setItem('fangpunkt.mapView', JSON.stringify(v)), {
      lng: at.lng,
      lat: at.lat,
      zoom: at.zoom,
    });
  await page.goto('/');
  await waitForApp(page);
  await page.waitForFunction(() => !!window.__fangpunktMap?.getLayer('fp-places'), null, { timeout: 30_000 });
}

// Eindeutige IDs zählen: ein Objekt an einer Kachelgrenze kommt mehrfach vor
const placeCount = (page: Page) =>
  page.evaluate(
    () => new Set(window.__fangpunktMap?.querySourceFeatures('fp-places').map((f) => f.properties.id)).size,
  );

test('MAP-3/MRK-1: Tipp auf die Karte legt einen Steg an; bearbeiten, löschen, rückgängig', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await mockBasemap(page);
  await openMap(page, { lat: 51.3263, lng: 6.2418, zoom: 15 });
  await expect(
    page.getByRole('region', { name: 'Karte von Deutschland mit deinen Markierungen' }),
  ).toBeVisible();

  const p = await screenPoint(page, 6.2418, 51.3263);
  await page.mouse.click(p.x, p.y);
  const sheet = page.getByRole('dialog', { name: 'Neu an dieser Stelle' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Fang oder Kontakt erfassen' })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include('dialog').analyze()).violations.filter((v) =>
      ['serious', 'critical'].includes(v.impact ?? ''),
    ),
  ).toEqual([]);
  await sheet.getByRole('button', { name: 'Angelsteg' }).click();

  const form = page.getByRole('dialog', { name: 'Angelsteg anlegen' });
  await form.getByLabel('Bezeichnung (optional)').fill('Steg am Schilf');
  await form.getByLabel('Notizen (optional)').fill('Morgens Schatten');
  await form.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Angelsteg gespeichert.')).toBeVisible();
  await expect.poll(() => placeCount(page)).toBe(1);

  // Antippen des Symbols öffnet die Details
  await tapRendered(page, 'fp-places', 6.2418, 51.3263);
  const details = page.getByRole('dialog', { name: 'Angelsteg' });
  await expect(details.getByText('Steg am Schilf')).toBeVisible();
  await expect(details.getByText('Morgens Schatten')).toBeVisible();
  await details.getByRole('button', { name: 'Bearbeiten' }).click();
  const edit = page.getByRole('dialog', { name: 'Angelsteg bearbeiten' });
  await edit.getByLabel('Bezeichnung (optional)').fill('Steg Nord');
  await edit.getByRole('radio', { name: 'Angelstelle' }).check();
  await edit.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Angelstelle gespeichert.')).toBeVisible();

  // Löschen mit Rückgängig (Angelstelle ist ein Pin mit Spitze unten → etwas oberhalb tippen)
  await tapRendered(page, 'fp-places', 6.2418, 51.3263, -14);
  await page.getByRole('dialog', { name: 'Angelstelle' }).getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByText('Angelstelle gelöscht.')).toBeVisible();
  await expect.poll(() => placeCount(page)).toBe(0);
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect.poll(() => placeCount(page)).toBe(1);

  // Nach Neuladen noch da
  await page.reload();
  await waitForApp(page);
  await page.waitForFunction(() => !!window.__fangpunktMap?.getLayer('fp-places'));
  await expect.poll(() => placeCount(page)).toBe(1);
  expect(unexpected(errors)).toEqual([]);
});

test('Legende zeigt alle Symbole', async ({ page }) => {
  await mockBasemap(page);
  await openMap(page);
  await page.getByRole('button', { name: 'Legende' }).click();
  const legend = page.getByRole('dialog', { name: 'Kartensymbole' });
  for (const name of [
    'Angelstelle',
    'Angelsteg',
    'Parkplatz',
    'Zugang',
    'Gefahrenstelle',
    'Sonstige Markierung',
    'Fang',
    'Fischkontakt',
    'Fehlbiss',
    'Beobachtung',
  ])
    await expect(legend.getByText(name, { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(legend).toBeHidden();
});

const geoCalls = (page: Page) =>
  page.evaluate(() => (window as unknown as { __geoCalls: number }).__geoCalls);

test('MAP-1: Standort startet standardmäßig mit der Karte; abschaltbar, dann erst nach Erklärung', async ({
  page,
}) => {
  await stubGeolocation(page, 'ok');
  await mockBasemap(page);
  await openMap(page);
  await expect(page.getByText('Genauigkeit ca. 25 m')).toBeVisible();
  expect(await geoCalls(page)).toBe(1);
  await expect(page.getByRole('button', { name: 'Standort ausblenden' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect
    .poll(() => page.evaluate(() => Math.round(window.__fangpunktMap?.getZoom() ?? 0)))
    .toBeGreaterThanOrEqual(14);

  // Einstellung „Nur auf Knopfdruck" → kein Abruf beim Start, beim ersten Tipp eine Erklärung
  await page.goto('/mehr/einstellungen');
  await waitForApp(page);
  const manual = page.getByRole('radio', { name: 'Nur auf Knopfdruck' });
  await manual.click();
  await expect(manual).toBeChecked();
  await openMap(page);
  await page.waitForTimeout(300);
  expect(await geoCalls(page)).toBe(0);
  await page.getByRole('button', { name: 'Meinen Standort zeigen' }).click();
  const sheet = page.getByRole('dialog', { name: 'Standort anzeigen?' });
  await expect(sheet).toContainText('nicht gespeichert und nicht übertragen');
  expect(await geoCalls(page)).toBe(0);
  await sheet.getByRole('button', { name: 'Standort anzeigen' }).click();
  await expect(page.getByText('Genauigkeit ca. 25 m')).toBeVisible();
  // Zweites Mal ohne Erklärung
  await page.getByRole('button', { name: 'Standort ausblenden' }).click();
  await page.getByRole('button', { name: 'Meinen Standort zeigen' }).click();
  await expect(page.getByRole('dialog', { name: 'Standort anzeigen?' })).toHaveCount(0);
  await expect(page.getByText('Genauigkeit ca. 25 m')).toBeVisible();
});

test('MAP-2: Verweigerter Standort: beim Start still, auf Knopfdruck verständliche Meldung, Karte nutzbar', async ({
  page,
}) => {
  await stubGeolocation(page, 'denied');
  await mockBasemap(page);
  await openMap(page);
  await expect.poll(() => geoCalls(page)).toBe(1);
  await expect(page.getByRole('button', { name: 'Meinen Standort zeigen' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button', { name: 'Meinen Standort zeigen' }).click();
  await expect(page.getByRole('alert')).toContainText('Standortzugriff ist blockiert');
  await page.getByRole('button', { name: 'Legende' }).click();
  await expect(page.getByRole('dialog', { name: 'Kartensymbole' })).toBeVisible();
});

test('MAP-5: Ohne Netz bleibt die Karte mit eigenen Markierungen nutzbar', async ({ page, context }) => {
  const errors = collectErrors(page);
  await mockBasemap(page);
  await openMap(page, { lat: 51.3263, lng: 6.2418, zoom: 15 });
  const p = await screenPoint(page, 6.2418, 51.3263);
  await page.mouse.click(p.x, p.y);
  await page
    .getByRole('dialog', { name: 'Neu an dieser Stelle' })
    .getByRole('button', { name: 'Parkplatz' })
    .click();
  await page
    .getByRole('dialog', { name: 'Parkplatz anlegen' })
    .getByRole('button', { name: 'Speichern' })
    .click();
  await expect.poll(() => placeCount(page)).toBe(1);

  await context.setOffline(true);
  await expect(page.getByText(/^Offline: Die Karte selbst ist nicht verfügbar/)).toBeVisible();
  await page.waitForFunction(() => window.__fangpunktMap?.getStyle().name === 'fangpunkt-offline');
  await page.waitForFunction(() => !!window.__fangpunktMap?.getLayer('fp-places'));
  await expect.poll(() => placeCount(page)).toBe(1);
  await context.setOffline(false);
  await expect(page.getByText(/^Offline:/)).toHaveCount(0);
  expect(unexpected(errors).filter((e) => !/ERR_INTERNET_DISCONNECTED|Failed to fetch/.test(e))).toEqual([]);
});

test('Fänge aus einer Sicherung erscheinen auf der Karte; Gruppen lassen sich aufzoomen', async ({
  page,
}) => {
  const dir = mkdtempSync(join(tmpdir(), 'fangpunkt-map-'));
  const file = join(dir, 'alt.json');
  // Ohne Orte: hier geht es nur um Fänge und Gruppen (Orte würden über den Gruppen liegen)
  writeFileSync(file, JSON.stringify({ ...legacyExport, places: [] }));
  await mockBasemap(page);
  await page.goto('/mehr/daten');
  await waitForApp(page);
  await page.locator('input[type="file"]').setInputFiles(file);
  await page.getByRole('button', { name: /Datensätze importieren/ }).click();
  await expect(page.getByText(/Datensätze importiert/)).toBeVisible();

  await page.addInitScript(() =>
    localStorage.setItem('fangpunkt.mapView', JSON.stringify({ lng: 6.243, lat: 51.322, zoom: 11 })),
  );
  await openMap(page);
  await expect(page.getByText(/Änderungen sind noch nicht gesichert/)).toBeVisible();
  await page.waitForFunction(
    () => (window.__fangpunktMap?.queryRenderedFeatures({ layers: ['fp-catch-clusters'] }).length ?? 0) > 0,
  );
  const cluster = await page.evaluate(() => {
    const map = window.__fangpunktMap;
    if (!map) throw new Error('Karte fehlt');
    const f = map.queryRenderedFeatures({ layers: ['fp-catch-clusters'] })[0];
    const c = map.project((f?.geometry as { coordinates: [number, number] }).coordinates);
    const r = map.getContainer().getBoundingClientRect();
    return { x: r.left + c.x, y: r.top + c.y, count: f?.properties.point_count };
  });
  expect(cluster.count).toBeGreaterThanOrEqual(2);
  await page.mouse.click(cluster.x, cluster.y);
  await expect.poll(() => page.evaluate(() => window.__fangpunktMap?.getZoom() ?? 0)).toBeGreaterThan(11.5);

  // Einzelnen Fang antippen
  await page.evaluate(() => window.__fangpunktMap?.jumpTo({ center: [6.24172, 51.32631], zoom: 17 }));
  await page.waitForFunction(
    () => (window.__fangpunktMap?.queryRenderedFeatures({ layers: ['fp-catches'] }).length ?? 0) > 0,
  );
  await tapRendered(page, 'fp-catches', 6.24172, 51.32631);
  const d = page.getByRole('dialog', { name: 'Fang' });
  await expect(d.getByText('Fang · Hecht')).toBeVisible();
  await expect(d.getByText('68 cm')).toBeVisible();
  await expect(d.getByText('Großer De Witt See')).toBeVisible();
});

test('Karte nutzt OpenFreeMap „liberty" und färbt sie im dunklen Theme um', async ({ page }) => {
  const urls: string[] = [];
  // Ebenennamen wie im echten Stil, damit die Farbregeln greifen (inkl. einer Ebene, die nur teilweise passt)
  const style = {
    ...TEST_STYLE,
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f8f4f0' } },
      { id: 'waterway_river', type: 'background', paint: { 'background-color': '#a0c8f0' } },
    ],
  };
  await page.route('https://tiles.openfreemap.org/**', (route) => {
    urls.push(route.request().url());
    return route.fulfill({ json: style });
  });
  // Während eines Stilwechsels hat MapLibre kurz keinen Stil; dann gilt die Farbe als noch unbekannt
  const bg = () =>
    page.evaluate(() => {
      try {
        return window.__fangpunktMap?.getPaintProperty('background', 'background-color');
      } catch {
        return undefined;
      }
    });
  await page.emulateMedia({ colorScheme: 'dark' });
  await openMap(page);
  expect(urls).toContain('https://tiles.openfreemap.org/styles/liberty');
  expect(await bg()).toBe('#2C5550');
  // Regeln mit unpassendem Ebenentyp werden übersprungen, die eigenen Ebenen sind trotzdem da
  expect(await page.evaluate(() => !!window.__fangpunktMap?.getLayer('fp-places'))).toBe(true);
  await page.emulateMedia({ colorScheme: 'light' });
  await expect.poll(bg).toBe('#f8f4f0');
  await page.waitForFunction(() => !!window.__fangpunktMap?.getLayer('fp-places'));
});

test('MAP-6: OSM-Vermerk beim Start sichtbar, klappt nach 5 s zum ⓘ ein und lässt sich wieder öffnen', async ({
  page,
}) => {
  await serveWaterFixture(page, { missing: true });
  await page.route('https://tiles.openfreemap.org/**', (route) =>
    route.fulfill({
      json: {
        ...TEST_STYLE,
        sources: {
          osm: {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
            attribution: '© OpenStreetMap-Mitwirkende',
          },
        },
        layers: [...TEST_STYLE.layers, { id: 'osm-fill', type: 'fill', source: 'osm' }],
      },
    }),
  );
  await page.goto('/');
  await waitForApp(page);
  const attrib = page.locator('.maplibregl-ctrl-attrib');
  await expect(attrib.getByText('© OpenStreetMap-Mitwirkende')).toBeVisible();
  await expect(attrib).toHaveClass(/maplibregl-compact-show/);
  // Nach 5 s eingeklappt: nur noch der ⓘ-Knopf
  await expect(attrib).not.toHaveClass(/maplibregl-compact-show/, { timeout: 8000 });
  await expect(attrib.getByText('© OpenStreetMap-Mitwirkende')).toBeHidden();
  await attrib.locator('.maplibregl-ctrl-attrib-button').click();
  await expect(attrib.getByText('© OpenStreetMap-Mitwirkende')).toBeVisible();
  // Zusätzlich dauerhaft unter Mehr → Über
  await page.goto('/mehr/info');
  await waitForApp(page);
  await expect(page.getByText(/© OpenStreetMap-Mitwirkende/).first()).toBeVisible();
});
