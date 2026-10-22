import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { collectErrors, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

test('M7: Übersicht der Länder, Land ohne geprüfte Angaben (LAW-4), Hinweis „keine Rechtsauskunft"', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/mehr');
  await waitForApp(page);
  await page.getByRole('link', { name: /Angelrecht der Länder/ }).click();

  await expect(page.getByRole('heading', { name: 'Angelrecht der Länder', level: 1 })).toBeVisible();
  await expect(page.getByText(/^Keine Rechtsauskunft\./)).toBeVisible();
  const states = page.getByRole('navigation', { name: 'Bundesländer' }).getByRole('link');
  await expect(states).toHaveCount(16);
  await expect(states.first()).toHaveText(/Baden-Württemberg/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await expect(states.filter({ hasText: 'Bayern' })).toContainText('Teilweise geprüft');
  await expect(states.filter({ hasText: 'Niedersachsen' })).toContainText('Teilweise geprüft');
  // LAW-4: erstes Land ohne Datei → erklärender Zustand mit Link zum Landesrechtsportal
  const empty = states.filter({ hasText: 'Noch keine Angaben' }).first();
  const name = ((await empty.textContent()) ?? '').replace('Noch keine Angaben', '').trim();
  expect(name.length).toBeGreaterThan(0);
  await empty.click();
  await expect(page.getByRole('heading', { name: `Für ${name} noch keine geprüften Angaben` })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Zum Landesrechtsportal' })).toHaveAttribute(
    'href',
    /^https:\/\//,
  );
  await expect(page.getByText(/^Keine Rechtsauskunft\./)).toBeVisible();
  expect(
    await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
      .then((r) =>
        r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
      ),
  ).toEqual([]);

  // Zurück zur Übersicht; unbekanntes Kürzel → „nicht gefunden"
  await page.getByRole('link', { name: 'Zurück' }).click();
  await expect(states).toHaveCount(16);
  await page.goto('/mehr/recht/XX');
  await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Gegengeprüftes Land (Bayern): Status, Fundstellen, Fischereischein-Regeln', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/mehr/recht/BY');
  await waitForApp(page);
  await expect(page.getByText(/^Keine Rechtsauskunft\./)).toBeVisible();
  await expect(page.getByText('Teilweise geprüft')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0); // kein Entwurfsbanner
  const hecht = page.getByRole('listitem').filter({ hasText: 'Hecht' }).filter({ hasText: 'ab 50 cm' });
  await expect(hecht).toContainText('Anlage Nr. 2.36 AVBayFiG');
  const licences = page.getByRole('heading', { name: 'Fischereischein und Erlaubnisse' }).locator('..');
  await expect(licences).toContainText('Art. 46 Abs. 1 BayFiG');
  await expect(page.getByRole('link', { name: /Bayerisches Fischereigesetz/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
