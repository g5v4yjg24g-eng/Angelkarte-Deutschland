import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import { collectErrors, serveWaterFixture, waitForApp, waterFixtureSearch } from './helpers';

test.use({ serviceWorkers: 'block' });

const TEST_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#dfe8e8' } }],
};

async function openMapAt(page: Page, lng: number, lat: number, zoom: number, { missing = false } = {}) {
  await page.route('https://tiles.openfreemap.org/**', (r) => r.fulfill({ json: TEST_STYLE }));
  await serveWaterFixture(page, { missing });
  await page.addInitScript((v) => localStorage.setItem('fangpunkt.mapView', JSON.stringify(v)), {
    lng,
    lat,
    zoom,
  });
  await page.goto('/');
  await waitForApp(page);
  await page.waitForFunction(() => !!window.__fangpunktMap?.getLayer('fp-places'));
}

/** Wartet, bis ein Gewässer an der Stelle gezeichnet ist, und tippt es an. */
async function tapWater(page: Page, lng: number, lat: number, layer = 'fp-water-fill') {
  await page.waitForFunction(
    ([lng, lat, layer]) => {
      const map = window.__fangpunktMap;
      if (!map?.getLayer(layer)) return false;
      const p = map.project([lng, lat]);
      return (
        map.queryRenderedFeatures(
          [
            [p.x - 8, p.y - 8],
            [p.x + 8, p.y + 8],
          ],
          { layers: [layer] },
        ).length > 0
      );
    },
    [lng, lat, layer] as const,
    { timeout: 20_000 },
  );
  const pt = await page.evaluate(
    ([lng, lat]) => {
      const map = window.__fangpunktMap;
      const p = map?.project([lng, lat]);
      const r = map?.getContainer().getBoundingClientRect();
      return { x: (r?.left ?? 0) + (p?.x ?? 0), y: (r?.top ?? 0) + (p?.y ?? 0) };
    },
    [lng, lat] as const,
  );
  await page.mouse.click(pt.x, pt.y);
}

/**
 * Sucht über ein Bildschirmraster einen Punkt, an dem genau die gewünschte Situation vorliegt
 * (robuster als Geometrie-Rechnungen bei unregelmäßigen Formen). Liefert Seitenkoordinaten.
 */
async function findScreenPoint(page: Page, kind: 'unnamed-area' | 'named-line') {
  return page.evaluate((kind) => {
    const map = window.__fangpunktMap;
    if (!map) return undefined;
    const r = map.getContainer().getBoundingClientRect();
    for (let y = 140; y < r.height - 140; y += 12)
      for (let x = 40; x < r.width - 70; x += 12) {
        const box: [[number, number], [number, number]] = [
          [x - 12, y - 12],
          [x + 12, y + 12],
        ];
        const fills = map.queryRenderedFeatures(box, { layers: ['fp-water-fill'] });
        if (kind === 'unnamed-area') {
          const at = map.queryRenderedFeatures([x, y], { layers: ['fp-water-fill'] });
          if (at.length === 1 && fills.every((f) => !f.properties.n) && !at[0]?.properties.n)
            return { x: r.left + x, y: r.top + y, name: '', type: '' };
        } else if (fills.length === 0) {
          const line = map.queryRenderedFeatures(
            [
              [x - 4, y - 4],
              [x + 4, y + 4],
            ],
            { layers: ['fp-water-line-hit'] },
          )[0];
          if (line?.properties.n)
            return {
              x: r.left + x,
              y: r.top + y,
              name: String(line.properties.n),
              type: String(line.properties.t),
            };
        }
      }
    return undefined;
  }, kind);
}

test('WAT-1/2: Suche findet den De Wittsee; das Profil zeigt nur belegte Angaben mit Quelle', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await openMapAt(page, 6.28, 51.31, 11);
  await page.getByRole('button', { name: 'Gewässer oder Ort suchen' }).click();
  const sheet = page.getByRole('dialog', { name: 'Suchen' });
  await expect(sheet.getByText(/Abgedeckt: Nordrhein-Westfalen/)).toBeVisible();
  await sheet.getByLabel('Gewässer oder Ort').fill('de witt');
  await expect(sheet.getByRole('list', { name: 'Suchen' })).toContainText('De Wittsee');
  await sheet.getByLabel('Gewässer oder Ort').fill('wittsee');
  const first = sheet.getByRole('listitem').first();
  await expect(first).toContainText('De Wittsee');
  await expect(first).toContainText('See · Nettetal');
  await expect(sheet.getByRole('listitem')).toHaveCount(2);
  await first.getByRole('button').click();

  const profile = page.getByRole('dialog', { name: 'De Wittsee' });
  await expect(profile).toBeVisible({ timeout: 20_000 });
  await expect(profile.getByText('24,6 ha')).toBeVisible();
  await expect(profile.getByText('aus der Kartengeometrie berechnet', { exact: false })).toBeVisible();
  await expect(profile.getByText('Nettetal · Kreis Viersen · Nordrhein-Westfalen')).toBeVisible();
  await expect(profile.getByText(/^Nicht verfügbar/)).toBeVisible();
  await expect(profile.getByText('Keine geprüften Angaben.')).toBeVisible();
  await expect(profile.getByText(/Datenstand 21\.10\.2026/)).toBeVisible();
  await expect(profile.getByRole('link', { name: 'Objekt bei OpenStreetMap ansehen' })).toHaveAttribute(
    'href',
    'https://www.openstreetmap.org/way/35044256',
  );
  // WAT-5: kein Tiefenkarten-Knopf ohne verfügbare Tiefendaten
  await expect(profile.getByRole('button', { name: /Tiefenkarte/ })).toHaveCount(0);
  // Landesrecht des Bundeslands verlinkt (M7)
  await expect(
    profile.getByRole('link', { name: 'Landesrecht Nordrhein-Westfalen: Schonzeiten, Mindestmaße' }),
  ).toHaveAttribute('href', /\/mehr\/recht\/NW$/);
  // Hervorhebung des gewählten Gewässers
  expect(
    await page.evaluate(
      () =>
        window.__fangpunktMap?.getFeatureState({
          source: 'fp-water',
          sourceLayer: 'areas',
          id: 'osm:w35044256',
        })?.sel,
    ),
  ).toBe(true);
  const axe = await new AxeBuilder({ page }).include('dialog').analyze();
  expect(
    axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => v.id),
  ).toEqual([]);
  expect(errors).toEqual([]);
});

test('Antippen: See, Fließgewässer und unbenanntes Gewässer', async ({ page }) => {
  await openMapAt(page, 6.2425, 51.3245, 14.3);
  await tapWater(page, 6.2418, 51.3263);
  await expect(page.getByRole('dialog', { name: 'De Wittsee' })).toBeVisible();
  await page.keyboard.press('Escape');

  // Ein Fließgewässer-Punkt ohne Wasserfläche in der Nähe (sonst hätte die Fläche Vorrang)
  const onLine = await findScreenPoint(page, 'named-line');
  expect(onLine).toBeTruthy();
  await page.mouse.click(onLine?.x ?? 0, onLine?.y ?? 0);
  const river = page.getByRole('dialog', { name: onLine?.name ?? '' });
  await expect(river).toBeVisible();
  await expect(river.getByText(onLine?.type === 'river' ? 'Fluss' : 'Bach', { exact: true })).toBeVisible();
  await expect(river.getByText('Fließgewässer: angezeigt wird der angetippte Abschnitt.')).toBeVisible();
  await expect(river.getByText('Fläche')).toHaveCount(0);
  await page.keyboard.press('Escape');

  // WAT-3: ein unbenanntes Gewässer im Bild
  const unnamed = await findScreenPoint(page, 'unnamed-area');
  expect(unnamed).toBeTruthy();
  await page.mouse.click(unnamed?.x ?? 0, unnamed?.y ?? 0);
  const d = page.getByRole('dialog', { name: 'Unbenanntes Gewässer' });
  await expect(d).toBeVisible();
  await expect(d.getByText('Kartengewässer')).toBeVisible();
});

test('MRK-3: Am Gewässer markieren ordnet den Ort dem Gewässer zu', async ({ page }) => {
  await openMapAt(page, 6.2425, 51.3245, 14.3);
  await tapWater(page, 6.2418, 51.3263);
  const profile = page.getByRole('dialog', { name: 'De Wittsee' });
  await expect(profile.getByText('0 Orte · 0 Einträge im Fangbuch')).toBeVisible();
  await profile.getByRole('button', { name: 'Hier markieren' }).click();
  const neu = page.getByRole('dialog', { name: 'Neu an dieser Stelle' });
  await expect(neu.getByText(/^De Wittsee · /)).toBeVisible();
  await neu.getByRole('button', { name: 'Angelstelle' }).click();
  await page
    .getByRole('dialog', { name: 'Angelstelle anlegen' })
    .getByRole('button', { name: 'Speichern' })
    .click();
  await expect(page.getByText('Angelstelle gespeichert.')).toBeVisible();

  // Profil zählt den Ort jetzt mit (Antippen neben dem neuen Symbol)
  await tapWater(page, 6.2405, 51.3285);
  await expect(
    page.getByRole('dialog', { name: 'De Wittsee' }).getByText('1 Ort · 0 Einträge im Fangbuch'),
  ).toBeVisible();
});

test('Ohne Gewässerdaten bleibt die Karte nutzbar; Suche erklärt den Zustand', async ({ page }) => {
  await openMapAt(page, 6.2425, 51.3245, 14.3, { missing: true });
  expect(await page.evaluate(() => !!window.__fangpunktMap?.getLayer('fp-water-fill'))).toBe(false);
  await page.getByRole('button', { name: 'Gewässer oder Ort suchen' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Suchen' }).getByText('Die Suche ist gerade nicht verfügbar.'),
  ).toBeVisible();
  await page.keyboard.press('Escape');
  // Tipp ins Wasser legt dann direkt einen Ort an (keine Gewässerinfo vorhanden)
  const pt = await page.evaluate(() => {
    const map = window.__fangpunktMap;
    const p = map?.project([6.2418, 51.3263]);
    const r = map?.getContainer().getBoundingClientRect();
    return { x: (r?.left ?? 0) + (p?.x ?? 0), y: (r?.top ?? 0) + (p?.y ?? 0) };
  });
  await page.mouse.click(pt.x, pt.y);
  await expect(page.getByRole('dialog', { name: 'Neu an dieser Stelle' })).toBeVisible();
});

test('Suchergebnisse für Orte und Flüsse sind sinnvoll sortiert', async ({ page }) => {
  // Erwartung direkt aus den Testdaten: mehrere Abschnitte „Nette" in verschiedenen Kreisen
  const nette = waterFixtureSearch('ne').filter((e) => e[0] === 'Nette');
  expect(nette.length).toBeGreaterThanOrEqual(2);
  await openMapAt(page, 6.27, 51.29, 12);
  await page.getByRole('button', { name: 'Gewässer oder Ort suchen' }).click();
  const sheet = page.getByRole('dialog', { name: 'Suchen' });
  await sheet.getByLabel('Gewässer oder Ort').fill('nette');
  const items = sheet.getByRole('listitem');
  await expect(items.first()).toContainText('Nette');
  await expect(sheet.getByText('Nettetal', { exact: true })).toBeVisible();
  await expect(sheet.getByText(/Gemeinde · Kreis Viersen/)).toBeVisible();
});
