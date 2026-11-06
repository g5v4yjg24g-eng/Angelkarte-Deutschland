import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import { collectErrors, useLocalExternals, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await useLocalExternals(page);
});

/** Fänge direkt in die App-Datenbank schreiben (älter als ein Tag, damit sie zählen) */
async function addCatches(
  page: Page,
  items: { species?: string; water?: string; length?: number }[],
  start = 0,
) {
  await page.evaluate(
    async ({ items, start }) => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const r = indexedDB.open('fangpunkt');
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      const created = new Date(Date.now() - 3 * 86_400_000).toISOString();
      const tx = db.transaction('catches', 'readwrite');
      items.forEach((it, i) =>
        tx.objectStore('catches').put({
          id: `erf-${start + i}`,
          createdAt: created,
          updatedAt: created,
          rev: 1,
          at: created,
          tz: 'Europe/Berlin',
          outcome: 'caught',
          ...(it.species ? { speciesId: it.species, speciesCertainty: 'certain' } : {}),
          ...(it.water ? { waterId: it.water } : {}),
          ...(it.length ? { lengthCm: it.length, lengthMethod: 'measured' } : {}),
        }),
      );
      await new Promise((resolve, reject) => {
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    },
    { items, start },
  );
}

test('ERF-1: Erfolge im Profil und in der Übersicht; neue Stufe mit Hinweis; Stufen bleiben nach dem Löschen', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/profil');
  await waitForApp(page);
  const card = page.getByRole('region', { name: /^Erfolge/ });
  await expect(card).toContainText('0 von 22 Stufen');

  // 10 Hechte über 82 cm an 3 Gewässern → Erster Fang, Fänge Bronze, Gewässer Bronze, Hecht Silber, Großfisch Silber
  await addCatches(
    page,
    Array.from({ length: 10 }, (_, i) => ({
      species: 'pike',
      water: `w${i % 3}`,
      length: i === 0 ? 82 : 50,
    })),
  );
  // wie ein erster Start mit vorhandenem Fangbuch: noch kein gespeicherter Stand
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('fangpunkt');
      r.onsuccess = () => resolve(r.result);
    });
    const tx = db.transaction('settings', 'readwrite');
    tx.objectStore('settings').delete('achievements');
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
  });
  await page.reload();
  await waitForApp(page);
  // Erster Abgleich: still, ohne „Neu“
  await expect(card).toContainText('7 von 22 Stufen');
  await expect(card.getByRole('link', { name: /^Neu/ })).toHaveCount(0);
  await expect(card.getByRole('img', { name: 'Hecht: Silber' })).toBeVisible();

  // ein weiterer Fang einer neuen Art → nichts Neues; dann fünf Arten → Fischarten Bronze mit Hinweis
  await addCatches(
    page,
    ['perch', 'zander', 'carp', 'roach'].map((species) => ({ species })),
    100,
  );
  await page.reload();
  await waitForApp(page);
  // neue Stufen: im Profil als „Neu“ markiert, bis die Übersicht geöffnet wird
  await expect(
    card.getByRole('link', { name: /^Neu (Fischarten|Zander) in Bronze und 1 weitere/ }),
  ).toBeVisible();
  await expect(card).toContainText('9 von 22 Stufen');

  await page.getByRole('link', { name: 'Alle ansehen' }).click();
  await expect(page.getByText('Neu', { exact: true })).toHaveCount(2);
  await expect(page.getByRole('heading', { level: 1, name: 'Erfolge' })).toBeVisible();
  const list = page.getByRole('list', { name: 'Erfolge' });
  await expect(list.getByRole('listitem')).toHaveCount(8);
  await expect(list.getByText('Größter: 82 cm · nächste: Gold')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }

  // Variante A: alles löschen → Stufen bleiben
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('fangpunkt');
      r.onsuccess = () => resolve(r.result);
    });
    const tx = db.transaction('catches', 'readwrite');
    tx.objectStore('catches').clear();
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
  });
  await page.goto('/profil');
  await waitForApp(page);
  await expect(page.getByRole('region', { name: /^Erfolge/ })).toContainText('9 von 22 Stufen');
  // angesehen: keine „Neu“-Zeile mehr
  await expect(
    page.getByRole('region', { name: /^Erfolge/ }).getByRole('link', { name: /^Neu/ }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('ERF-2: frische Fänge zählen erst nach einem Tag', async ({ page }) => {
  await page.goto('/profil');
  await waitForApp(page);
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve) => {
      const r = indexedDB.open('fangpunkt');
      r.onsuccess = () => resolve(r.result);
    });
    const now = new Date().toISOString();
    const tx = db.transaction('catches', 'readwrite');
    tx.objectStore('catches').put({
      id: 'neu',
      createdAt: now,
      updatedAt: now,
      rev: 1,
      at: now,
      tz: 'Europe/Berlin',
      outcome: 'caught',
    });
    await new Promise((resolve) => (tx.oncomplete = resolve));
    db.close();
  });
  await page.reload();
  await waitForApp(page);
  await expect(page.getByRole('region', { name: /^Erfolge/ })).toContainText('0 von 22 Stufen');
});
