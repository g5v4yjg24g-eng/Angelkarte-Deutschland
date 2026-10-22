import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import type { Catch } from '../../src/domain/schemas';
import { collectErrors, useLocalExternals, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

const stamp = '2026-10-21T15:12:00+02:00';
const zander: Catch = {
  id: 'bait-1',
  createdAt: stamp,
  updatedAt: stamp,
  rev: 0,
  outcome: 'caught',
  at: '2026-10-21T15:10:00+02:00',
  tz: 'Europe/Berlin',
  speciesId: 'zander',
};

async function put(page: Page, c: Catch) {
  await page.evaluate(async (c) => {
    const req = indexedDB.open('fangpunkt');
    const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['catches'], 'readwrite');
      tx.objectStore('catches').put(c);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as Error);
    });
    db.close();
  }, c);
}

test('Köder-Favoriten: anlegen, im Fang mit einem Tipp übernehmen, aus dem Formular speichern, löschen', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await useLocalExternals(page);
  await page.goto('/mehr');
  await waitForApp(page);
  await page.getByRole('link', { name: /Köder-Favoriten/ }).click();
  await expect(page.getByRole('heading', { name: 'Noch keine Favoriten' })).toBeVisible();

  // Anlegen mit allen Angaben
  await page.getByRole('button', { name: 'Favorit anlegen' }).click();
  const form = page.getByRole('form', { name: 'Neuer Favorit' });
  await form.getByLabel('Name').fill('Shad 12 cm');
  await form.getByLabel('Köderart').selectOption({ label: 'Gummiköder' });
  await form.getByLabel('Farbe').fill('Motoroil');
  await form.getByLabel('Größe (cm)').fill('12');
  await form.getByLabel('Gewicht (g)').fill('14,5');
  await form.getByLabel('Hakengröße').fill('3/0');
  await form.getByLabel('Methode').selectOption({ label: 'Jiggen' });
  await form.getByRole('button', { name: 'Speichern' }).click();
  const list = page.getByRole('list', { name: 'Köder-Favoriten' });
  await expect(list).toContainText('Gummiköder · Motoroil · 12 cm · 14,5 g · Haken 3/0 · Jiggen');

  // Doppelter Name wird abgelehnt
  await page.getByRole('button', { name: 'Favorit anlegen' }).click();
  await page.getByRole('form', { name: 'Neuer Favorit' }).getByLabel('Name').fill('shad 12 CM');
  await page.getByRole('form', { name: 'Neuer Favorit' }).getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Diesen Favoriten gibt es schon.')).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();
  const axe = await new AxeBuilder({ page }).include('main').analyze();
  expect(
    axe.violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => v.id),
  ).toEqual([]);

  // Im Fang mit einem Tipp übernehmen – Details kommen mit
  await put(page, zander);
  await page.goto('/fangbuch/bait-1');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.getByText('Mehr Details').click();
  const favs = page.getByRole('group', { name: 'Köder-Favoriten' });
  await favs.getByRole('button', { name: 'Shad 12 cm' }).click();
  await expect(favs.getByRole('button', { name: 'Shad 12 cm' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByLabel('Köder', { exact: true })).toHaveValue('Shad 12 cm');
  await expect(page.getByLabel('Methode')).toHaveValue('jigging');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(
    page.getByText('Shad 12 cm · Gummiköder · Motoroil · 12 cm · 14,5 g · Haken 3/0'),
  ).toBeVisible();

  // Anderen Köder direkt im Formular als Favorit speichern
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  // Details sind offen, weil der Eintrag schon einen Köder hat
  await page.getByLabel('Köder', { exact: true }).fill('Spinner Gr. 3');
  await page.getByLabel('Köderart').selectOption({ label: 'Spinner' });
  await page.getByRole('button', { name: 'Als Favorit merken' }).click();
  await expect(favs.getByRole('button', { name: 'Spinner Gr. 3' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('button', { name: 'Als Favorit merken' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Speichern' }).click();
  // Details des alten Favoriten sind weg
  await expect(page.getByText('Spinner Gr. 3 · Spinner', { exact: true })).toBeVisible();

  // Verwalten: Nutzung, Löschen mit Rückgängig, 390 px
  await page.goto('/mehr/koeder');
  await waitForApp(page);
  await expect(list.getByRole('listitem').filter({ hasText: 'Spinner Gr. 3' })).toContainText('1 Eintrag');
  await page.getByRole('button', { name: 'Shad 12 cm: Löschen' }).click();
  await expect(page.getByText('„Shad 12 cm“ gelöscht')).toBeVisible();
  await expect(list).not.toContainText('Shad 12 cm');
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(list).toContainText('Shad 12 cm');
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
