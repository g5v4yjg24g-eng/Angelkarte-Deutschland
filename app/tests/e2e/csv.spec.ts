import { readFileSync } from 'node:fs';
import { expect, test } from './fixtures';
import type { Catch } from '../../src/domain/schemas';
import { useLocalExternals, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await useLocalExternals(page);
});

const t = '2026-10-20T15:12:00+02:00';
const zander: Catch = {
  id: 'csv-1',
  createdAt: t,
  updatedAt: t,
  rev: 0,
  outcome: 'caught',
  at: '2026-10-20T15:10:00+02:00',
  tz: 'Europe/Berlin',
  speciesId: 'zander',
  lengthCm: 58,
  lengthMethod: 'measured',
  notes: 'Am Steg, "kurz" vor Regen',
};

test('CSV-1: Fangbuch als CSV herunterladen (Excel-tauglich)', async ({ page }) => {
  await page.goto('/mehr/daten');
  await waitForApp(page);
  // Leer: Hinweis statt leerer Datei
  await page.getByRole('button', { name: 'Fangbuch exportieren (.csv)' }).click();
  await expect(page.getByText('Noch keine Einträge im Fangbuch.')).toBeVisible();

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
  }, zander);

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Fangbuch exportieren (.csv)' }).click();
  const d = await download;
  expect(d.suggestedFilename()).toMatch(/^fangpunkt-fangbuch-\d{4}-\d{2}-\d{2}\.csv$/);
  await expect(page.getByText(/mit 1 Eintrag wurde erstellt/)).toBeVisible();
  const text = readFileSync((await d.path()) ?? '', 'utf8');
  expect(text.charCodeAt(0)).toBe(0xfeff);
  const [head, row] = text.slice(1).split('\r\n');
  expect(head?.startsWith('Datum;Uhrzeit;Ergebnis;Art;Länge (cm);')).toBe(true);
  expect(row?.startsWith('20.10.2026;15:10;Fang;Zander;58;gemessen;')).toBe(true);
  expect(row?.endsWith(';"Am Steg, ""kurz"" vor Regen"')).toBe(true);
});
