// GUIDE-1/2: Anleitung nachlesen (Mehr und Einstellungen), Kurztour, Willkommensblatt nur bei neuer Installation.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import { collectErrors, useLocalExternals, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await useLocalExternals(page);
});

const introDone = (page: Page) =>
  page.waitForFunction(() => document.documentElement.dataset.intro !== 'shown');
const welcome = (page: Page) => page.getByRole('dialog', { name: 'Willkommen bei Fangpunkt' });
const tour = (page: Page) => page.getByRole('dialog', { name: 'Kurztour' });
const guideSeen = (page: Page) =>
  page.evaluate(async () => {
    const req = indexedDB.open('fangpunkt');
    const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
    const v = await new Promise<unknown>((r) => {
      const g = db.transaction('settings').objectStore('settings').get('guideSeen');
      g.onsuccess = () => r((g.result as { value?: unknown } | undefined)?.value);
    });
    db.close();
    return v;
  });

test('GUIDE-1: Anleitung unter Mehr und in den Einstellungen, Themen aufklappen, Kurztour durchgehen', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/mehr');
  await waitForApp(page);
  await page.getByRole('link', { name: 'Anleitung' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Anleitung' })).toBeVisible();
  for (const g of ['Los geht’s', 'Auswerten', 'Planen', 'Lernen', 'Mehr']) {
    await expect(page.getByRole('heading', { name: g })).toBeVisible();
  }
  // Thema aufklappen: Schritte, Hinweis (Recht: keine Rechtsauskunft), „Probier’s aus“ führt zur Funktion
  const law = page.getByRole('button', { name: /Recht und Regeln/ });
  await expect(law).toHaveAttribute('aria-expanded', 'false');
  await law.click();
  await expect(law).toHaveAttribute('aria-expanded', 'true');
  await expect(page.getByText('Das ist keine Rechtsauskunft.')).toBeVisible();
  await page.getByRole('button', { name: /Sessions/ }).click();
  await expect(law).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  await law.click();
  await page.getByRole('link', { name: 'Probier’s aus' }).click();
  await expect(page).toHaveURL(/\/mehr\/recht$/);

  // Kurztour: sieben Schritte, Zurück/Weiter, am Ende „Los geht’s“
  await page.goto('/mehr/anleitung');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Tour starten' }).click();
  await expect(tour(page)).toBeVisible();
  await expect(tour(page).getByText('1 von 7')).toBeVisible();
  await expect(tour(page).getByRole('heading', { name: 'Karte und Gewässer' })).toBeVisible();
  await expect(tour(page).getByRole('button', { name: 'Zurück' })).toBeDisabled();
  await tour(page).getByRole('button', { name: 'Weiter' }).click();
  await expect(tour(page).getByRole('heading', { name: 'Fang erfassen' })).toBeVisible();
  await tour(page).getByRole('button', { name: 'Zurück' }).click();
  await expect(tour(page).getByText('1 von 7')).toBeVisible();
  for (let i = 0; i < 6; i += 1) await tour(page).getByRole('button', { name: 'Weiter' }).click();
  await expect(tour(page).getByText('7 von 7')).toBeVisible();
  await expect(tour(page).getByRole('heading', { name: 'Knoten, Montagen, Köder' })).toBeVisible();
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  await tour(page).getByRole('button', { name: 'Los geht’s' }).click();
  await expect(tour(page)).toBeHidden();
  await expect.poll(() => guideSeen(page)).toBe(1);

  // „Probier’s aus“ in der Tour führt zur Funktion und schließt die Tour; Escape schließt auch
  await page.getByRole('button', { name: 'Tour starten' }).click();
  await tour(page)
    .getByRole('link', { name: /Karte öffnen/ })
    .click();
  await expect(page).toHaveURL(/\/$/);
  await expect(tour(page)).toBeHidden();
  await page.goto('/mehr/anleitung');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Tour starten' }).click();
  await page.keyboard.press('Escape');
  await expect(tour(page)).toBeHidden();

  // Einstellungen: dieselbe Seite
  await page.goto('/mehr/einstellungen');
  await waitForApp(page);
  await page.getByRole('link', { name: 'Anleitung & Tour' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Anleitung' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('GUIDE-2: Willkommensblatt nur bei neuer Installation, einmal; Bestandsnutzer sehen nichts', async ({
  page,
}) => {
  const errors = collectErrors(page);
  // In Tests ist das Fenster sonst aus (würde andere Tests blockieren)
  await page.addInitScript(() => localStorage.setItem('fangpunkt.e2e.guide', '1'));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await waitForApp(page);
  await introDone(page);
  await expect(welcome(page)).toBeVisible();
  await expect(welcome(page)).toContainText('Karte, Fangbuch, Wetter und Recht an einem Ort.');
  // Später: Blatt weg, gemerkt, nicht wieder
  await welcome(page)
    .getByRole('button', { name: /^Später/ })
    .click();
  await expect(welcome(page)).toBeHidden();
  await expect.poll(() => guideSeen(page)).toBe(1);
  await page.reload();
  await waitForApp(page);
  await introDone(page);
  await page.waitForTimeout(600);
  await expect(welcome(page)).toHaveCount(0);

  // Bestandsnutzer: Daten vorhanden, kein Stand → kein Fenster, Stand wird still gemerkt
  await page.evaluate(async () => {
    const req = indexedDB.open('fangpunkt');
    const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['settings', 'places'], 'readwrite');
      tx.objectStore('settings').delete('guideSeen');
      const now = new Date().toISOString();
      tx.objectStore('places').put({
        id: 'p1',
        createdAt: now,
        updatedAt: now,
        rev: 1,
        type: 'spot',
        position: { lat: 51.3, lng: 6.2, source: 'map-tap' },
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as Error);
    });
    db.close();
  });
  await page.reload();
  await waitForApp(page);
  await introDone(page);
  await page.waitForTimeout(600);
  await expect(welcome(page)).toHaveCount(0);
  await expect.poll(() => guideSeen(page)).toBe(1);

  // Neue Installation: „Kurze Tour“ öffnet die Tour; Schließen merkt den Stand
  await page.evaluate(async () => {
    const req = indexedDB.open('fangpunkt');
    const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(['settings', 'places'], 'readwrite');
      tx.objectStore('settings').delete('guideSeen');
      tx.objectStore('places').delete('p1');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error as Error);
    });
    db.close();
  });
  await page.reload();
  await waitForApp(page);
  await introDone(page);
  await expect(welcome(page)).toBeVisible();
  await welcome(page)
    .getByRole('button', { name: /Kurze Tour starten/ })
    .click();
  await expect(tour(page)).toBeVisible();
  await expect(tour(page).getByText('1 von 7')).toBeVisible();
  await tour(page).getByRole('button', { name: 'Überspringen' }).click();
  await expect(tour(page)).toBeHidden();
  await expect.poll(() => guideSeen(page)).toBe(1);
  expect(errors).toEqual([]);
});
