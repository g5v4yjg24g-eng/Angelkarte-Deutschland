import { expect, test, type Page } from './fixtures';
import { startCatchAt, useLocalExternals, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await useLocalExternals(page);
});

const nav = (page: Page, name: string) =>
  page.getByRole('navigation', { name: 'Hauptnavigation' }).getByRole('link', { name }).click();

async function openMap(page: Page) {
  await page.goto('/');
  await waitForApp(page);
  await page.waitForFunction(() => !!window.__fangpunktMap?.getLayer('fp-places'), null, { timeout: 30_000 });
}

async function addCatch(page: Page, species: string) {
  await startCatchAt(page);
  const form = page.getByRole('dialog', { name: 'Fang oder Kontakt erfassen' });
  await expect(form.getByText(/Wird der laufenden Session/)).toBeVisible();
  await form.getByRole('combobox', { name: 'Fischart' }).selectOption({ label: species });
  await form.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Fang gespeichert.')).toBeVisible();
}

test('SES-1/SES-2: Session starten, Einträge zuordnen, beenden; keine zweite gleichzeitig', async ({
  page,
}) => {
  // Langer Ablauf (~25 s auf mobil, auch vor der Wetter-Änderung) – sonst knapp am 30-s-Limit
  test.slow();
  await openMap(page);
  await page.getByRole('button', { name: 'Session starten' }).click();
  await expect(page.getByText('Session gestartet.', { exact: false })).toBeVisible();
  const chip = page.getByRole('link', { name: /Laufende Session/ });
  await expect(chip).toBeVisible();
  // SES-2: solange eine läuft, gibt es keinen zweiten Start
  await expect(page.getByRole('button', { name: 'Session starten' })).toHaveCount(0);

  for (const species of ['Zander', 'Hecht', 'Flussbarsch']) await addCatch(page, species);

  await chip.click();
  await expect(page.getByRole('heading', { level: 1, name: 'Session' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Einträge (3)' })).toBeVisible();
  await page.getByRole('button', { name: 'Session beenden' }).click();
  // Nach dem Beenden öffnet sich der Rückblick; Schließen führt zur Session zurück
  await expect(page.getByRole('heading', { name: 'Dein Angeltrip im Rückblick' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('3 Gefangen');
  await page.getByRole('button', { name: 'Rückblick schließen' }).click();
  await expect(page.getByRole('link', { name: /Laufende Session/ })).toHaveCount(0);

  // Titel vergeben; Liste zeigt 3 Einträge
  await page.getByLabel('Titel (optional)').fill('Abendansitz');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Session gespeichert.')).toBeVisible();
  await page.goto('/fangbuch/sessions');
  await expect(page.getByRole('link', { name: /Abendansitz.*3 Einträge/ })).toBeVisible();

  // Eintrag zeigt seine Session
  await nav(page, 'Fangbuch');
  await page.getByRole('link', { name: /Fang · Hecht/ }).click();
  await expect(page.getByText(/^Session vom /)).toBeVisible();
});

test('SES-3: Session länger als 24 h → Korrekturdialog mit Vorschlag', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  // Session, die vor 30 h gestartet und nie beendet wurde
  await page.evaluate(async () => {
    const start = new Date(Date.now() - 30 * 3600e3);
    const iso = start.toISOString().replace('Z', '+00:00');
    const req = indexedDB.open('fangpunkt');
    const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('sessions', 'readwrite');
      tx.objectStore('sessions').put({
        id: 'alt',
        createdAt: iso,
        updatedAt: iso,
        rev: 0,
        startAt: iso,
        tz: 'UTC',
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as Error);
    });
    db.close();
  });
  await page.reload();
  await waitForApp(page);
  const chip = page.getByRole('link', { name: 'Session vergessen zu beenden?' });
  await expect(chip).toContainText('Session über 24 h');
  await chip.click();
  await expect(page.getByText('Diese Session läuft seit über 24 Stunden.', { exact: false })).toBeVisible();

  // Ende vor dem Beginn wird abgelehnt
  await page.getByLabel('Ende – Datum').fill('2000-01-01');
  await page.getByRole('button', { name: 'Ende speichern' }).click();
  await expect(page.getByText('Das Ende liegt vor dem Beginn.')).toBeVisible();

  // Vorschlag (Beginn + 4 h, keine Einträge) übernehmen
  await page.reload();
  await page.getByRole('button', { name: 'Ende speichern' }).click();
  await expect(page.getByRole('heading', { name: 'Dein Angeltrip im Rückblick' })).toBeVisible();
  await page.getByRole('button', { name: 'Rückblick schließen' }).click();
  await expect(page.getByText('4 h 00 min', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /Session über 24 h/ })).toHaveCount(0);
});

test('SES-4: Pause und Weiter, Pause nachtragen; Angelzeit ohne Pausen', async ({ page }) => {
  // Laufende Session: Pause → Kopfzeile zeigt „Pause“ → Weiter angeln
  await page.goto('/fangbuch/sessions');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Session starten' }).click();
  await page.getByRole('link', { name: /Laufende Session/ }).click();
  await page.getByRole('button', { name: 'Pause' }).click();
  await expect(page.getByText(/^Pause seit \d\d:\d\d Uhr$/)).toBeVisible();
  await expect(page.getByRole('link', { name: /Laufende Session in Pause/ })).toBeVisible();
  await page.getByRole('button', { name: 'Weiter angeln' }).click();
  await expect(page.getByRole('link', { name: /^Laufende Session, seit/ })).toBeVisible();
  await expect(page.getByText(/^1 Pause \(/)).toBeVisible();
  await page.getByRole('button', { name: 'Session beenden' }).click();
  await expect(page.getByRole('heading', { name: 'Dein Angeltrip im Rückblick' })).toBeVisible();
  await page.getByRole('button', { name: 'Rückblick schließen' }).click();

  // Beendete Session (06:00–10:00): Pause nachtragen
  await page.evaluate(async () => {
    const req = indexedDB.open('fangpunkt');
    const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['sessions'], 'readwrite');
      tx.objectStore('sessions').put({
        id: 'ses-4',
        createdAt: '2026-10-20T06:00:00+02:00',
        updatedAt: '2026-10-20T10:00:00+02:00',
        rev: 0,
        startAt: '2026-10-20T06:00:00+02:00',
        endAt: '2026-10-20T10:00:00+02:00',
        tz: 'Europe/Berlin',
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as Error);
    });
    db.close();
  });
  await page.goto('/fangbuch/sessions/ses-4');
  await waitForApp(page);
  await expect(page.getByText('Keine Pausen erfasst.')).toBeVisible();
  await page.getByText('Pause nachtragen', { exact: true }).first().click();
  await page.getByLabel('Pause von').fill('2026-10-20T07:00');
  await page.getByLabel('Pause bis').fill('2026-10-20T07:30');
  await page.getByRole('button', { name: 'Pause nachtragen' }).click();
  await expect(page.getByText('07:00–07:30 (30 min)')).toBeVisible();
  await expect(page.getByText('1 Pause (30 min)')).toBeVisible();
  await expect(page.locator('dd', { hasText: '3 h 30 min' })).toBeVisible();

  // Überschneidung und Lage außerhalb werden abgelehnt
  await page.getByLabel('Pause von').fill('2026-10-20T07:15');
  await page.getByLabel('Pause bis').fill('2026-10-20T07:45');
  await page.getByRole('button', { name: 'Pause nachtragen' }).click();
  await expect(page.getByRole('alert')).toHaveText('Die Pause überschneidet sich mit einer anderen.');
  await page.getByLabel('Pause von').fill('2026-10-20T09:45');
  await page.getByLabel('Pause bis').fill('2026-10-20T10:30');
  await page.getByRole('button', { name: 'Pause nachtragen' }).click();
  await expect(page.getByRole('alert')).toHaveText('Die Pause muss innerhalb der Session liegen.');

  // Entfernen
  await page.getByRole('button', { name: 'Pause entfernen 07:00' }).click();
  await expect(page.getByText('Keine Pausen erfasst.')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
