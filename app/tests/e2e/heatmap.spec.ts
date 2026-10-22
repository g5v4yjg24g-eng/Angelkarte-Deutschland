import { expect, test, type Page } from './fixtures';
import type { Catch } from '../../src/domain/schemas';
import { collectErrors, useLocalExternals, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await useLocalExternals(page);
});

const t = '2026-10-20T15:12:00+02:00';
const c = (id: string, outcome: Catch['outcome'], lng: number, lat: number): Catch => ({
  id,
  createdAt: t,
  updatedAt: t,
  rev: 0,
  outcome,
  at: t,
  tz: 'Europe/Berlin',
  position: { lat, lng, source: 'gps' },
});

async function put(page: Page, catches: Catch[]) {
  await page.evaluate(async (catches) => {
    const req = indexedDB.open('fangpunkt');
    const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['catches'], 'readwrite');
      for (const x of catches) tx.objectStore('catches').put(x);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as Error);
    });
    db.close();
  }, catches);
}

async function openMap(page: Page) {
  await page.addInitScript(() =>
    localStorage.setItem('fangpunkt.mapView', JSON.stringify({ lng: 6.2425, lat: 51.3245, zoom: 13 })),
  );
  await page.goto('/');
  await waitForApp(page);
  await page.waitForFunction(() => !!window.__fangpunktMap?.getLayer('fp-catch-heat'), null, {
    timeout: 30_000,
  });
}

const visibility = (page: Page, id: string) =>
  page.evaluate((id) => window.__fangpunktMap?.getLayoutProperty(id, 'visibility') ?? 'visible', id);

test('HEAT-1: Heatmap der gelandeten Fische ein- und ausschalten, Wahl bleibt, Leerzustand', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await openMap(page);
  // Standard: aus, Zahlenkreise sichtbar
  expect(await visibility(page, 'fp-catch-heat')).toBe('none');
  const toggle = page.getByRole('button', { name: 'Heatmap der Fänge zeigen' });
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Heatmap ausblenden' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByText('Noch keine gelandeten Fische mit Fangort')).toBeVisible();
  expect(await visibility(page, 'fp-catch-heat')).toBe('visible');
  expect(await visibility(page, 'fp-catch-clusters')).toBe('none');

  // Mit Fängen: nur gelandete zählen
  await put(page, [
    c('h1', 'caught', 6.2425, 51.3245),
    c('h2', 'caught', 6.2427, 51.3246),
    c('h3', 'contact', 6.25, 51.33),
  ]);
  await page.reload();
  await waitForApp(page);
  await page.waitForFunction(() => !!window.__fangpunktMap?.getLayer('fp-catch-heat'));
  // Wahl bleibt nach dem Neuladen
  await expect(page.getByRole('button', { name: 'Heatmap ausblenden' })).toBeVisible();
  await expect.poll(() => visibility(page, 'fp-catch-heat')).toBe('visible');
  await expect(page.getByText('Noch keine gelandeten Fische mit Fangort')).toHaveCount(0);
  // Wenige Punkte: Hinweis auf Scheinmuster (Alt-App-Regel, < 30)
  await expect(
    page.getByText('Erst 2 Fänge mit Fangort – unter 30 sind Häufungen oft Zufall.'),
  ).toBeVisible();
  const filter = await page.evaluate(() => JSON.stringify(window.__fangpunktMap?.getFilter('fp-catch-heat')));
  expect(filter).toContain('catch-caught');

  await page.getByRole('button', { name: 'Heatmap ausblenden' }).click();
  expect(await visibility(page, 'fp-catch-heat')).toBe('none');
  expect(await visibility(page, 'fp-catch-clusters')).toBe('visible');

  // Legende erklärt die Heatmap
  await page.getByRole('button', { name: 'Legende' }).click();
  await expect(page.getByRole('dialog', { name: 'Kartensymbole' })).toContainText(
    'von Gelb (wenige) bis Rot (viele)',
  );
  expect(errors).toEqual([]);
});
