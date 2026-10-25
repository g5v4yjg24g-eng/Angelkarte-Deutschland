import { readFileSync } from 'node:fs';
import { expect, test, type Page } from './fixtures';
import type { Catch } from '../../src/domain/schemas';
import { collectErrors, useLocalExternals, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

// Synthetische Testgrenzen (Rechtecke), nur für diesen Test – keine echten Landesgrenzen.
const box = (code: string, x0: number, y0: number, x1: number, y1: number) => ({
  code,
  bbox: [x0, y0, x1, y1],
  polygons: [
    [
      [
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
        [x0, y0],
      ],
    ],
  ],
});
const STATES = {
  format: 'fangpunkt-states',
  formatVersion: 1,
  dataDate: '2026-10-22T00:00:00Z',
  toleranceM: 50,
  marginM: 150,
  states: [box('BW', 8, 48, 10, 49), box('BY', 10, 48, 12, 49), box('NW', 6, 51, 8, 52)],
};
const MANIFEST = JSON.parse(
  readFileSync(new URL('../fixtures/water/water-manifest.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

async function serveStates(page: Page, withStates = true) {
  await page.route('**/data/water/water-manifest.json', (r) =>
    r.fulfill({ json: withStates ? { ...MANIFEST, states: 'states.json' } : MANIFEST }),
  );
  await page.route('**/data/water/states.json', (r) => r.fulfill({ json: STATES }));
}

const stamp = '2026-03-10T10:05:00+01:00';
const pike = (id: string, lng: number, lat: number, extra: Partial<Catch> = {}): Catch => ({
  id,
  createdAt: stamp,
  updatedAt: stamp,
  rev: 0,
  outcome: 'caught',
  at: '2026-03-10T10:00:00+01:00',
  tz: 'Europe/Berlin',
  speciesId: 'pike',
  lengthCm: 45,
  lengthMethod: 'measured',
  position: { lat, lng, source: 'gps' },
  ...extra,
});

async function put(page: Page, catches: Catch[]) {
  await page.evaluate(async (catches) => {
    const req = indexedDB.open('fangpunkt');
    const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['catches'], 'readwrite');
      for (const c of catches) tx.objectStore('catches').put(c);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as Error);
    });
    db.close();
  }, catches);
}

async function open(page: Page, id: string) {
  await page.goto(`/fangbuch/${id}`);
  await waitForApp(page);
}

test('LAW-5: Warnung bei Schonzeit und Mindestmaß, Bundesland aus dem Fangort, nicht blockierend', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await useLocalExternals(page);
  await serveStates(page);
  await page.goto('/fangbuch');
  await waitForApp(page);
  await put(page, [
    pike('by', 11, 48.5),
    pike('nw', 7, 51.5),
    pike('grenze', 10.0005, 48.5),
    pike('kontakt', 11, 48.5, { outcome: 'contact', lengthCm: 45, lengthMethod: 'estimated' }),
  ]);

  // Bayern: Schonzeit 15.02.–30.04. und unter 50 cm
  await open(page, 'by');
  const panel = page.getByRole('region', { name: 'Landesrecht Bayern' });
  await expect(panel).toContainText('darf nach Landesrecht vermutlich nicht entnommen werden');
  await expect(panel).toContainText('Schonzeit: Hecht 15.02.–30.04.');
  await expect(panel).toContainText('Unter dem Mindestmaß: Hecht 45 cm, erlaubt ab 50 cm');
  await expect(panel).toContainText('Anlage Nr. 2.36');
  await expect(panel).toContainText('Keine Rechtsauskunft');
  await expect(panel.getByRole('link', { name: 'Alle Regeln für Bayern' })).toHaveAttribute(
    'href',
    '/mehr/recht/BY',
  );

  // Im Formular live: maßig und außerhalb der Schonzeit → keine Warnung; Speichern war nie gesperrt
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  const formPanel = page.getByRole('region', { name: 'Landesrecht Bayern' });
  await expect(formPanel).toContainText('Unter dem Mindestmaß');
  await page.getByLabel('Länge (cm)').fill('55');
  await page.getByLabel('Datum').fill('2026-06-01');
  await expect(formPanel).toContainText('Nach den erfassten Regeln für Bayern');
  await page.getByRole('button', { name: 'Speichern', exact: true }).click();
  await expect(panel).toContainText('Nach den erfassten Regeln für Bayern');

  // NRW (gegengeprüft 2026-10-25): Hecht am 10.03. in der Schonzeit, 45 cm genau am Mindestmaß
  await open(page, 'nw');
  const nw = page.getByRole('region', { name: 'Landesrecht Nordrhein-Westfalen' });
  await expect(nw).toContainText('Schonzeit: Hecht 15.02.–30.04.');
  await expect(nw).toContainText('§ 2 Nr. 6 Landesfischereiverordnung (LFischVO)');
  await expect(nw).not.toContainText('Unter dem Mindestmaß');

  // Grenznähe (≈ 35 m von der Grenze BW/BY): nachfragen statt raten, Wahl wird gespeichert
  await open(page, 'grenze');
  const ask = page.getByRole('region', { name: 'Landesrecht' });
  await expect(ask).toContainText('nah an einer Landesgrenze');
  await ask.getByRole('button', { name: 'Baden-Württemberg' }).click();
  await expect(page.getByRole('region', { name: 'Landesrecht Baden-Württemberg' })).toBeVisible();
  await page.reload();
  await waitForApp(page);
  await expect(page.getByRole('region', { name: 'Landesrecht Baden-Württemberg' })).toBeVisible();

  // Kontakt (nicht gelandet): keine Prüfung
  await open(page, 'kontakt');
  await expect(page.getByRole('heading', { name: /Landesrecht/ })).toHaveCount(0);

  await page.setViewportSize({ width: 390, height: 844 });
  await open(page, 'by');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('LAW-6: ohne Landesgrenzen in den Daten → „Bundesland unbekannt – keine Prüfung möglich"', async ({
  page,
}) => {
  await useLocalExternals(page);
  await serveStates(page, false);
  await page.goto('/fangbuch');
  await waitForApp(page);
  await put(page, [pike('ohne', 11, 48.5)]);
  await open(page, 'ohne');
  await expect(page.getByRole('region', { name: 'Landesrecht' })).toContainText(
    'Bundesland unbekannt – keine Prüfung möglich.',
  );
});
