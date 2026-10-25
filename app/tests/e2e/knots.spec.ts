import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import { collectErrors, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

const axe = (page: Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
    .then((r) =>
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    );
const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

test('KNT-4: Mehr → Knoten: Liste, Filter, Anleitung mit Schritten und Wiedergabe', async ({ page }) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/mehr');
  await waitForApp(page);
  await page.getByRole('link', { name: /^Knoten/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Knoten' })).toBeVisible();
  await expect(page.getByText('Animiert', { exact: true })).toHaveCount(3);
  await expect(page.getByText('Animation folgt', { exact: true })).toHaveCount(6);
  expect(await noOverflow(page)).toBe(true);
  expect(await axe(page)).toEqual([]);

  const filters = page.getByRole('group', { name: 'Nach Einsatz filtern' });
  await filters.getByRole('button', { name: 'Verbinden' }).click();
  await expect(filters.getByRole('button', { name: 'Verbinden' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Doppelter Uni-Knoten')).toBeVisible();
  await expect(page.getByText('Palomarknoten')).toHaveCount(0);
  await filters.getByRole('button', { name: 'Alle' }).click();

  await page.getByRole('link', { name: /^Verbesserter Clinchknoten/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Verbesserter Clinchknoten' })).toBeVisible();
  await expect(page.getByText('Schritt 1 von 5')).toBeVisible();
  await expect(
    page.getByRole('img', { name: /^Verbesserter Clinchknoten: Die Schnur durch das Öhr/ }),
  ).toBeVisible();

  // Wiedergabe schaltet selbst zum nächsten Schritt
  await page.getByRole('button', { name: 'Abspielen' }).click();
  await expect(page.getByText('Schritt 2 von 5')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Anhalten' }).click();
  await page.getByRole('button', { name: /^Zu Schritt 5:/ }).click();
  await expect(page.getByText('Schritt 5 von 5')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Von vorn' })).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  expect(await axe(page)).toEqual([]);

  await page.getByRole('link', { name: 'Zurück' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Knoten' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('KNT-5: Reduzierte Bewegung – Bilder erscheinen ohne Zeichenanimation', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/mehr/knoten/uni');
  await waitForApp(page);
  await page.getByRole('button', { name: 'Schritt weiter' }).click();
  await expect(page.getByText('Schritt 2 von 4')).toBeVisible();
  const anim = await page
    .locator('svg[role="img"] path[pathLength]')
    .first()
    .evaluate((el) => getComputedStyle(el).animationName);
  expect(anim).toBe('none');
});
