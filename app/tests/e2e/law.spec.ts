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

  // LAW-4: Bayern hat (noch) keine Datei → erklärender Zustand mit Link zum Landesrechtsportal
  await expect(states.filter({ hasText: 'Bayern' })).toContainText('Noch keine Angaben');
  await states.filter({ hasText: 'Bayern' }).click();
  await expect(page.getByRole('heading', { name: 'Für Bayern noch keine geprüften Angaben' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Zum Landesrechtsportal' })).toHaveAttribute(
    'href',
    'https://www.gesetze-bayern.de/',
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

test('Prüfansicht zeigt Entwürfe nur mit ?pruefung und deutlicher Warnung', async ({ page }) => {
  await page.goto('/mehr/recht/HH');
  await waitForApp(page);
  await expect(page.getByRole('heading', { name: 'Für Hamburg noch keine geprüften Angaben' })).toBeVisible();
  await page.goto('/mehr/recht/HH?pruefung=1');
  await expect(page.getByRole('alert')).toContainText('ungeprüfter Entwurf');
  await expect(page.getByText(/^Keine Rechtsauskunft\./)).toBeVisible();
  const zander = page
    .getByRole('listitem')
    .filter({ hasText: 'Zander' })
    .filter({ hasText: 'Entnahmefenster' });
  await expect(zander).toContainText('45–75 cm');
  await expect(zander).toContainText('Anlage 1 Nr. 9 (zu § 7 Abs. 1) HmbFAnGDVO');
});
