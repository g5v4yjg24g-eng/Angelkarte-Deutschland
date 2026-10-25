// NEWS-1: Fenster „Neu in Fangpunkt“ nach einem Update (einmal je Gerät, nicht bei neuer Installation).
import { expect, test, type Page } from './fixtures';
import { collectErrors, useLocalExternals, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await useLocalExternals(page);
  // In Tests ist das Fenster sonst aus (würde andere Tests blockieren)
  await page.addInitScript(() => localStorage.setItem('fangpunkt.e2e.whatsNew', '1'));
});

const dialog = (page: Page) => page.getByRole('dialog', { name: 'Neu in Fangpunkt' });
const introDone = (page: Page) =>
  page.waitForFunction(() => document.documentElement.dataset.intro !== 'shown');

async function put(page: Page, store: string, row: object) {
  await page.evaluate(
    async ([store, row]) => {
      const req = indexedDB.open('fangpunkt');
      const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(store as string, 'readwrite');
        tx.objectStore(store as string).put(row);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as Error);
      });
      db.close();
    },
    [store, row] as const,
  );
}

test('NEWS-1: neue Installation ohne Fenster; nach Update einmal „Neu in Fangpunkt“, dann nicht mehr', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await waitForApp(page);
  await introDone(page);
  await page.waitForTimeout(600);
  await expect(dialog(page)).toHaveCount(0);

  // Update simulieren: zuletzt gesehen ist ein älterer Stand
  await put(page, 'settings', { key: 'lastSeenChangelog', value: '2000-01-01' });
  await page.reload();
  await waitForApp(page);
  await expect(dialog(page)).toBeVisible();
  await expect(dialog(page)).toContainText('Session-Rückblick');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(dialog(page).getByRole('button', { name: 'Alles klar' })).toBeInViewport();
  await dialog(page).getByRole('button', { name: 'Alles klar' }).click();
  await expect(dialog(page)).toHaveCount(0);

  // Nur einmal
  await page.reload();
  await waitForApp(page);
  await introDone(page);
  await page.waitForTimeout(600);
  await expect(dialog(page)).toHaveCount(0);

  // Später nachlesbar
  await page.goto('/mehr/info');
  await waitForApp(page);
  await expect(page.getByRole('heading', { name: 'Neuigkeiten' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('NEWS-2: wer schon Daten hat, sieht beim ersten Start mit dieser Funktion die neuesten Neuigkeiten', async ({
  page,
}) => {
  await page.goto('/fangbuch');
  await waitForApp(page);
  // Bestandsnutzer: Eintrag vorhanden, aber noch kein gemerkter Stand
  await page.evaluate(async () => {
    const req = indexedDB.open('fangpunkt');
    const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
    await new Promise<void>((resolve) => {
      const tx = db.transaction('settings', 'readwrite');
      tx.objectStore('settings').delete('lastSeenChangelog');
      tx.oncomplete = () => resolve();
    });
    db.close();
  });
  const t = '2026-10-20T15:12:00+02:00';
  await put(page, 'catches', {
    id: 'news-1',
    createdAt: t,
    updatedAt: t,
    rev: 0,
    outcome: 'caught',
    at: t,
    tz: 'Europe/Berlin',
  });
  await page.reload();
  await waitForApp(page);
  await expect(dialog(page)).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog(page)).toHaveCount(0);
});
