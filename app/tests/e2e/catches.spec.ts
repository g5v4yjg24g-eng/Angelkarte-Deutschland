import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import {
  collectErrors,
  screenPoint,
  serveWaterFixture,
  tapRendered,
  useLocalExternals,
  waitForApp,
} from './helpers';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await useLocalExternals(page);
});

/** Wartet, bis die Karte n eigene Fang-Symbole gezeichnet hat (Symbolplatzierung ist verzögert). */
async function catchesRendered(page: Page, n: number) {
  await page.waitForFunction(
    (n) => (window.__fangpunktMap?.queryRenderedFeatures({ layers: ['fp-catches'] }).length ?? 0) >= n,
    n,
  );
}

const TEST_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#dfe8e8' } }],
};

/** Karte am De Wittsee öffnen (lokaler Teststil, Gewässer-Testdaten Nettetal). */
async function openMap(page: Page, view = { lng: 6.2425, lat: 51.3245, zoom: 14.3 }) {
  await page.route('https://tiles.openfreemap.org/**', (r) => r.fulfill({ json: TEST_STYLE }));
  await serveWaterFixture(page);
  await page.addInitScript((v) => localStorage.setItem('fangpunkt.mapView', JSON.stringify(v)), view);
  await page.goto('/');
  await waitForApp(page);
  await page.waitForFunction(() => !!window.__fangpunktMap?.getLayer('fp-places'), null, { timeout: 30_000 });
}

/** Tipp auf eine Stelle ohne Gewässer → „Neu an dieser Stelle" → Fangformular. */
async function newCatchAt(page: Page, lng: number, lat: number) {
  const p = await screenPoint(page, lng, lat);
  await page.mouse.click(p.x, p.y);
  await page
    .getByRole('dialog', { name: 'Neu an dieser Stelle' })
    .getByRole('button', { name: 'Fang oder Kontakt erfassen' })
    .click();
  const form = page.getByRole('dialog', { name: 'Fang oder Kontakt erfassen' });
  await expect(form).toBeVisible();
  return form;
}

/**
 * Eine sichtbare Stelle ohne Gewässer, eigene Symbole und Bedienelemente (je nach Bildschirmbreite verschieden).
 * Gesucht wird im mittleren Band der Karte, mit Abstand zu Suchfeld, Knöpfen und Navigation.
 */
async function dryPoint(page: Page, skip = 0) {
  const p = await page.evaluate((skip) => {
    const map = window.__fangpunktMap;
    if (!map) return undefined;
    const { width, height } = map.getContainer().getBoundingClientRect();
    const layers = ['fp-water-fill', 'fp-water-line-hit', 'fp-places', 'fp-catches'].filter((l) =>
      map.getLayer(l),
    );
    let found = 0;
    for (let y = height * 0.35; y < height * 0.7; y += 20)
      for (let x = width * 0.15; x < width * 0.75; x += 20) {
        const hits = map.queryRenderedFeatures(
          [
            [x - 30, y - 30],
            [x + 30, y + 30],
          ],
          { layers },
        );
        if (hits.length === 0 && found++ === skip) {
          const ll = map.unproject([x, y]);
          return { lng: ll.lng, lat: ll.lat };
        }
      }
    return undefined;
  }, skip);
  if (!p) throw new Error('Keine freie Stelle gefunden');
  return p;
}

test('CAT-1/M5.3: Fang erfassen, im Fangbuch ansehen, bearbeiten, löschen und wiederherstellen', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await openMap(page);
  const FIELD = await dryPoint(page);
  const form = await newCatchAt(page, FIELD.lng, FIELD.lat);
  await expect(form.getByRole('radio', { name: /^Fang/ })).toBeChecked();
  await expect(form.getByText('Angetippte Stelle')).toBeVisible();
  await form.getByLabel('Fischart').selectOption({ label: 'Zander' });
  const axe = await new AxeBuilder({ page }).include('dialog').analyze();
  expect(
    axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => v.id),
  ).toEqual([]);
  await form.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Fang gespeichert.')).toBeVisible();
  await tapRendered(page, 'fp-catches', FIELD.lng, FIELD.lat);
  await expect(page.getByRole('dialog', { name: 'Fang' })).toContainText('Fang · Zander');
  await page.keyboard.press('Escape');

  // Fangbuch: Eintrag unter dem heutigen Tag, Details, Bearbeiten
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Fangbuch' })
    .click();
  await expect(page.getByText('1 Eintrag', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: /Fang · Zander/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Fang' })).toBeVisible();
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.getByText('Mehr Details').click();
  await page.getByLabel('Länge (cm)').fill('54,5');
  await page.getByLabel('Köder', { exact: true }).fill('Gummifisch 10 cm');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('54,5 cm')).toBeVisible();
  await expect(page.getByText('Gummifisch 10 cm')).toBeVisible();

  // Auf der Karte zeigen öffnet den Eintrag dort
  await page.getByRole('button', { name: 'Auf der Karte zeigen' }).click();
  await expect(page.getByRole('dialog', { name: 'Fang' })).toContainText('54,5 cm');
  await page.keyboard.press('Escape');

  // Löschen mit „Rückgängig" in der Liste
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Fangbuch' })
    .click();
  await page.getByRole('link', { name: /Fang · Zander/ }).click();
  await page.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByText('Eintrag gelöscht.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Noch keine Einträge' })).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByRole('link', { name: /Fang · Zander/ })).toBeVisible();

  // Köder taucht beim nächsten Fang als Schnellauswahl auf
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Karte' })
    .click();
  await catchesRendered(page, 1);
  const spot2 = await dryPoint(page);
  const next = await newCatchAt(page, spot2.lng, spot2.lat);
  await expect(next.getByRole('button', { name: 'Zander' })).toBeVisible(); // zuletzt genutzte Art
  await next.getByText('Mehr Details').click();
  await next.getByRole('button', { name: 'Gummifisch 10 cm' }).click();
  await expect(next.getByLabel('Köder', { exact: true })).toHaveValue('Gummifisch 10 cm');
  expect(errors).toEqual([]);
});

test('CAT-3/CAT-4: Kontakt ohne Messwerte; ungültige Länge hält das Formular offen', async ({ page }) => {
  await openMap(page);
  const FIELD = await dryPoint(page);
  const form = await newCatchAt(page, FIELD.lng, FIELD.lat);
  await form.getByText('Mehr Details').click();
  await form.getByLabel('Länge (cm)').fill('900');
  await form.getByRole('button', { name: 'Speichern' }).click();
  await expect(form.getByText('Länge zwischen 0,1 und 250 cm.')).toBeVisible();
  await expect(form.getByText('Bitte die markierten Felder prüfen.')).toBeVisible();
  await expect(form.getByLabel('Länge (cm)')).toHaveValue('900');
  // Nach dem Korrigieren lässt sich speichern
  await form.getByLabel('Länge (cm)').fill('62');
  await expect(form.getByText('Bitte die markierten Felder prüfen.')).toHaveCount(0);
  await form.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Fang gespeichert.')).toBeVisible();
  await catchesRendered(page, 1);
  const spot2 = await dryPoint(page); // nicht dieselbe Stelle: dort liegt jetzt der neue Fang
  const again = await newCatchAt(page, spot2.lng, spot2.lat);
  await again.getByText('Mehr Details').click();

  // Fischkontakt: Länge nur geschätzt, keine Wahl „gemessen"/„gewogen"
  await again.getByRole('radio', { name: /^Fischkontakt/ }).check();
  await expect(again.getByRole('radio', { name: 'gemessen' })).toHaveCount(0);
  await expect(again.getByRole('radio', { name: 'gewogen' })).toHaveCount(0);
  await expect(again.getByText('Ohne gelandeten Fisch nur geschätzt.')).toBeVisible();
  await again.getByLabel('Länge (cm)').fill('70');
  await again.getByLabel('Wann verloren?').selectOption({ label: 'Im Drill' });
  await again.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Fischkontakt gespeichert.')).toBeVisible();

  await page.goto('/fangbuch');
  await page.getByRole('link', { name: /Fischkontakt/ }).click();
  await expect(page.getByText('ca. 70 cm')).toBeVisible();
  await expect(page.getByText('Im Drill')).toBeVisible();
});

test('„Fang erfassen" am Gewässer ordnet den See zu; Filter im Fangbuch', async ({ page }) => {
  await openMap(page, { lng: 6.2418, lat: 51.3263, zoom: 14.5 });
  // Gewässerebene muss in der Kartenmitte gezeichnet sein
  await page.waitForFunction(() => {
    const map = window.__fangpunktMap;
    if (!map?.getLayer('fp-water-fill')) return false;
    const c = map.project(map.getCenter());
    return map.queryRenderedFeatures([c.x, c.y], { layers: ['fp-water-fill'] }).length > 0;
  });
  await page.getByRole('button', { name: 'Fang erfassen' }).click();
  const form = page.getByRole('dialog', { name: 'Fang oder Kontakt erfassen' });
  await expect(form.getByText('De Wittsee')).toBeVisible();
  await form.getByRole('radio', { name: /^Fehlbiss/ }).check();
  await expect(form.getByLabel('Fischart')).toHaveCount(0);
  await form.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Fehlbiss gespeichert.')).toBeVisible();

  // Zweiter Eintrag ohne Gewässer
  await catchesRendered(page, 1);
  const FIELD = await dryPoint(page);
  const other = await newCatchAt(page, FIELD.lng, FIELD.lat);
  await other.getByLabel('Fischart').selectOption({ label: 'Hecht' });
  await other.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Fang gespeichert.')).toBeVisible();

  await page.goto('/fangbuch');
  await expect(page.getByText('2 Einträge', { exact: true })).toBeVisible();
  await page.getByLabel('Gewässer').selectOption('De Wittsee');
  await expect(page.getByText('1 von 2 Einträgen')).toBeVisible();
  await expect(page.getByRole('link', { name: /Fehlbiss/ })).toBeVisible();
  await page.getByLabel('Gewässer').selectOption('');
  await page.getByLabel('Suchen').fill('hecht');
  await expect(page.getByRole('link', { name: /Fang · Hecht/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Fehlbiss/ })).toHaveCount(0);
  await page.getByLabel('Suchen').fill('gibt es nicht');
  await expect(page.getByRole('heading', { name: 'Keine passenden Einträge' })).toBeVisible();
  await page.getByRole('button', { name: 'Filter zurücksetzen' }).click();
  await expect(page.getByText('2 Einträge', { exact: true })).toBeVisible();
});

test('Ohne Netz erfassen: Eintrag wird gespeichert und erscheint im Fangbuch', async ({ page, context }) => {
  await openMap(page);
  const FIELD = await dryPoint(page);
  await context.setOffline(true);
  const form = await newCatchAt(page, FIELD.lng, FIELD.lat);
  await form.getByLabel('Fischart').selectOption({ label: 'Flussbarsch' });
  await form.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Fang gespeichert.')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Fangbuch' })
    .click();
  await expect(page.getByRole('link', { name: /Fang · Flussbarsch/ })).toBeVisible();
});

test('Fang an einem gespeicherten Ort übernimmt Ort und Bezug', async ({ page }) => {
  await openMap(page);
  const FIELD = await dryPoint(page);
  const p = await screenPoint(page, FIELD.lng, FIELD.lat);
  await page.mouse.click(p.x, p.y);
  await page
    .getByRole('dialog', { name: 'Neu an dieser Stelle' })
    .getByRole('button', { name: 'Angelstelle' })
    .click();
  await page
    .getByRole('dialog', { name: 'Angelstelle anlegen' })
    .getByRole('button', { name: 'Speichern' })
    .click();
  await tapRendered(page, 'fp-places', FIELD.lng, FIELD.lat, -18);
  await page
    .getByRole('dialog', { name: 'Angelstelle' })
    .getByRole('button', { name: 'Fang hier erfassen' })
    .click();
  const form = page.getByRole('dialog', { name: 'Fang oder Kontakt erfassen' });
  await expect(form.getByText('Gespeicherter Ort')).toBeVisible();
  await form.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Fang gespeichert.')).toBeVisible();
  const placeId = await page.evaluate(async () => {
    const req = indexedDB.open('fangpunkt');
    const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
    const all = await new Promise<{ placeId?: string }[]>((r) => {
      const q = db.transaction('catches').objectStore('catches').getAll();
      q.onsuccess = () => r(q.result as { placeId?: string }[]);
    });
    return all[0]?.placeId;
  });
  expect(placeId).toBeTruthy();
});
