import { expect, test, type Page } from '@playwright/test';
import { serveWaterFixture, useLocalExternals, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

const TEST_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#dfe8e8' } }],
};

test.beforeEach(async ({ page }) => {
  await useLocalExternals(page);
  await page.route('https://tiles.openfreemap.org/**', (r) => r.fulfill({ json: TEST_STYLE }));
  await serveWaterFixture(page);
  await page.addInitScript(() =>
    localStorage.setItem('fangpunkt.mapView', JSON.stringify({ lng: 6.2425, lat: 51.3245, zoom: 14.3 })),
  );
  await page.goto('/');
  await waitForApp(page);
  await page.waitForFunction(() => !!window.__fangpunktMap?.getLayer('fp-water-fill'), null, {
    timeout: 30_000,
  });
  // Gewässer müssen gezeichnet sein, bevor gesucht wird
  await page.waitForFunction(
    () => (window.__fangpunktMap?.queryRenderedFeatures({ layers: ['fp-water-fill'] }).length ?? 0) > 3,
  );
});

/**
 * Bildschirmpunkt am Ufer: kein Gewässer direkt unter dem Finger, aber mindestens zwei verschiedene im Umkreis
 * von 40 px (wie die App sucht). Liefert Seitenkoordinaten.
 */
async function shorePoint(page: Page) {
  const p = await page.evaluate(() => {
    const map = window.__fangpunktMap;
    if (!map) return undefined;
    const r = map.getContainer().getBoundingClientRect();
    const layers = ['fp-water-fill', 'fp-water-line-hit'];
    for (let y = r.height * 0.3; y < r.height * 0.75; y += 8)
      for (let x = r.width * 0.15; x < r.width * 0.8; x += 8) {
        if (map.queryRenderedFeatures([x, y], { layers }).length) continue;
        if (map.queryRenderedFeatures([x, y], { layers: ['fp-places', 'fp-catches'] }).length) continue;
        const near = map.queryRenderedFeatures(
          [
            [x - 40, y - 40],
            [x + 40, y + 40],
          ],
          { layers },
        );
        if (new Set(near.map((f) => f.properties.wid)).size >= 2) return { x: r.left + x, y: r.top + y };
      }
    return undefined;
  });
  if (!p) throw new Error('Kein Uferpunkt gefunden');
  return p;
}

test('M5.5: Mehrere Gewässer in der Nähe → Auswahl; später zuordnen und ändern', async ({ page }) => {
  const p = await shorePoint(page);
  await page.mouse.click(p.x, p.y);
  await page
    .getByRole('dialog', { name: 'Neu an dieser Stelle' })
    .getByRole('button', { name: 'Fang oder Kontakt erfassen' })
    .click();
  const form = page.getByRole('dialog', { name: 'Fang oder Kontakt erfassen' });
  const select = form.getByRole('combobox', { name: 'Gewässer' });
  await expect(select).toBeVisible();
  const options = await select.locator('option').allTextContents();
  expect(options.length).toBeGreaterThanOrEqual(3); // ≥ 2 Gewässer + „Kein Gewässer"
  expect(options.at(-1)).toBe('Kein Gewässer / unbekannt');
  // Erst ohne Gewässer speichern …
  await select.selectOption({ label: 'Kein Gewässer / unbekannt' });
  await form.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Fang gespeichert.')).toBeVisible();

  // … dann im Fangbuch nachträglich zuordnen
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Fangbuch' })
    .click();
  await page.getByRole('main').getByRole('list').getByRole('link').first().click();
  await page.getByRole('button', { name: 'Gewässer zuordnen' }).click();
  const sheet = page.getByRole('dialog', { name: 'Gewässer zuordnen' });
  await expect(sheet.getByText('Gewässer an der Stelle dieses Eintrags:')).toBeVisible({ timeout: 20_000 });
  const first = sheet.getByRole('button').filter({ hasText: /\(/ }).first();
  const label = (await first.textContent()) ?? '';
  const name = label.replace(/ \(.*\)$/, '');
  await first.click();
  await expect(page.getByText(`Zugeordnet: ${name}.`)).toBeVisible();

  // Detail zeigt das Gewässer; Ändern bietet „Zuordnung entfernen"
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Fangbuch' })
    .click();
  await page.getByRole('main').getByRole('list').getByRole('link').first().click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Gewässer ändern' }).click();
  await page
    .getByRole('dialog', { name: 'Gewässer zuordnen' })
    .getByRole('button', { name: 'Zuordnung entfernen' })
    .click();
  await expect(page.getByText('Zuordnung entfernt.')).toBeVisible();
});
