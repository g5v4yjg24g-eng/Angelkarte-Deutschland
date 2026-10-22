import { expect, test, type Page } from './fixtures';
import type { Catch, Session } from '../../src/domain/schemas';
import { entry, session, statsBasic } from '../../src/test/fixtures/stats';
import { useLocalExternals, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await useLocalExternals(page);
});

/** Daten direkt in IndexedDB legen (wie nach einem Import) und die Statistik öffnen. */
async function seed(page: Page, data: { catches: Catch[]; sessions: Session[] }) {
  await page.goto('/statistik');
  await waitForApp(page);
  await page.evaluate(async (data) => {
    const req = indexedDB.open('fangpunkt');
    const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['catches', 'sessions'], 'readwrite');
      for (const c of data.catches) tx.objectStore('catches').put(c);
      for (const s of data.sessions) tx.objectStore('sessions').put(s);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as Error);
    });
    db.close();
  }, data);
  await page.reload();
  await waitForApp(page);
}

const tile = (page: Page, label: string) =>
  page
    .locator('div')
    .filter({ has: page.getByText(label, { exact: true }) })
    .last();

test('STA-1/5/6/7: stats-basic zeigt die Sollwerte, saubere Texte, keine Breitenüberschreitung', async ({
  page,
}) => {
  await seed(page, statsBasic());
  await expect(tile(page, 'Fänge')).toContainText('7');
  await expect(tile(page, 'Bisse gesamt')).toContainText('12');
  await expect(tile(page, 'Landequote')).toContainText('70 %');
  await expect(tile(page, 'Fänge pro Stunde')).toContainText('1,08');
  await expect(page.getByText('7 Fänge in 6 h 30 min Angelzeit (3 Sessions)')).toBeVisible();
  await expect(page.getByText('1 Beobachtung zählt nicht als Fang.')).toBeVisible();
  await expect(page.getByRole('table', { name: 'Arten' })).toContainText('Zander');
  await expect(page.getByText('Kleine Stichprobe (n = 7)', { exact: false })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Köder' })).toContainText('Gummifisch 12 cm');

  // STA-7: jede Grafik hat eine Textform – Verlauf als Tabelle aufklappbar
  await expect(page.getByRole('img', { name: 'Fänge pro Monat' })).toBeVisible();
  await page.getByText('Als Tabelle anzeigen').click();
  await expect(page.getByRole('cell', { name: /Juni 2026|Jun\.? 2026/ })).toBeVisible();

  // STA-5: keine technischen Platzhalter im Text
  const text = await page.locator('main').innerText();
  for (const bad of ['NaN', 'Infinity', 'undefined', 'null']) expect(text).not.toContain(bad);
  // STA-6: kein horizontales Scrollen
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test('STA-2: leere Daten erklären, was zu tun ist', async ({ page }) => {
  await page.goto('/statistik');
  await waitForApp(page);
  await expect(page.getByRole('heading', { name: 'Noch nichts auszuwerten' })).toBeVisible();
  await page.getByRole('link', { name: 'Ersten Fang erfassen' }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('STA-3: unter den Mindestmengen keine Quote, sondern „Zu wenige Daten"', async ({ page }) => {
  await seed(page, {
    catches: [
      entry('caught', '2026-07-01T10:00:00+02:00', { sessionId: 't1' }),
      entry('caught', '2026-07-01T10:30:00+02:00', { sessionId: 't1' }),
      entry('contact', '2026-07-01T11:00:00+02:00', { sessionId: 't1' }),
    ],
    sessions: [session('t1', '2026-07-01T09:00:00+02:00', '2026-07-01T13:00:00+02:00')],
  });
  await expect(tile(page, 'Landequote')).toContainText('Zu wenige Daten (n = 3)');
  await expect(tile(page, 'Fänge pro Stunde')).toContainText('Zu wenige Daten (n = 1)');
  await expect(page.getByText(/Zu wenige Daten: Köder sind erst bei 0/)).toBeVisible();
});

test('STA-4: Filter Art + Gewässer + Zeitraum kombiniert', async ({ page }) => {
  await seed(page, statsBasic());
  await page.getByLabel('Fischart').selectOption({ label: 'Zander' });
  await page.getByLabel('Gewässer').selectOption('De Wittsee');
  await expect(tile(page, 'Fänge')).toContainText('3');
  await expect(page.getByText('3 Fänge in 2 h 30 min Angelzeit (2 Sessions)')).toBeVisible();
  await page.getByLabel('Zeitraum').selectOption({ label: 'Letzte 7 Tage' });
  await expect(page.getByText('Für diese Filter gibt es keine Einträge.')).toBeVisible();
});
