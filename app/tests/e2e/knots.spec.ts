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
  await expect(page.getByText('Animiert', { exact: true })).toHaveCount(9);
  await expect(page.getByText('Animation folgt', { exact: true })).toHaveCount(0);
  expect(await noOverflow(page)).toBe(true);
  expect(await axe(page)).toEqual([]);

  const filters = page.getByRole('group', { name: 'Nach Einsatz filtern' });
  await filters.getByRole('button', { name: 'Verbinden' }).click();
  await expect(filters.getByRole('button', { name: 'Verbinden' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('Doppelter Uni-Knoten')).toBeVisible();
  await expect(page.getByText('Palomarknoten')).toHaveCount(0);
  // Verbindungsknoten: zweite Schnur in eigener Farbe
  await page.getByRole('link', { name: /^FG-Knoten/ }).click();
  await expect(page.getByText('Schritt 1 von 4')).toBeVisible();
  await page.getByRole('button', { name: /^Zu Schritt 4:/ }).click();
  await expect(page.getByRole('img', { name: /^FG-Knoten: Das Vorfach dicht/ })).toBeVisible();
  expect(await axe(page)).toEqual([]);
  await page.getByRole('link', { name: 'Zurück' }).click();
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

test('RIG-4: Knoten & Montagen → Montagen: Umschalter, Filter, Anleitung mit Wofür, Wiedergabe, Knoten-Link', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/mehr');
  await waitForApp(page);
  await page.getByRole('link', { name: /^Knoten, Montagen & Köderführung/ }).click();
  await page
    .getByRole('navigation', { name: 'Knoten, Montagen & Köderführung' })
    .getByRole('link', { name: 'Montagen' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Montagen' })).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  expect(await axe(page)).toEqual([]);

  await page.getByRole('button', { name: 'Grundangeln' }).click();
  await expect(page.getByRole('link', { name: /^Carolina-Rig/ })).toHaveCount(0);
  await page.getByRole('link', { name: /^Haar-Montage/ }).click();
  await expect(page.getByRole('region', { name: 'Wofür?' })).toContainText('Selbsthakeffekt');
  await page.getByRole('link', { name: 'Zurück' }).click();
  await page.getByRole('button', { name: 'Alle' }).click();

  await page.getByRole('link', { name: /^Carolina-Rig/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Carolina-Rig' })).toBeVisible();
  await expect(page.getByText('Schritt 1 von 5')).toBeVisible();
  await page.getByRole('button', { name: 'Abspielen' }).click();
  await expect(page.getByText('Schritt 2 von 5')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Anhalten' }).click();
  await page.getByRole('button', { name: /^Zu Schritt 5:/ }).click();
  await expect(page.getByRole('img', { name: /^Carolina-Rig: Den Gummiköder/ })).toContainText('Gummiköder');
  expect(await noOverflow(page)).toBe(true);
  expect(await axe(page)).toEqual([]);

  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await axe(page)).toEqual([]);
  await page.getByRole('link', { name: /^Palomarknoten/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Palomarknoten' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('RET-3: Köderführung – Reiter, Filter, Anleitung mit laufendem Köder, 390 px, axe hell und dunkel', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/mehr');
  await waitForApp(page);
  await page.getByRole('link', { name: /^Knoten, Montagen & Köderführung/ }).click();
  await page
    .getByRole('navigation', { name: 'Knoten, Montagen & Köderführung' })
    .getByRole('link', { name: 'Köderführung' })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Köderführung' })).toBeVisible();
  expect(await noOverflow(page)).toBe(true);
  expect(await axe(page)).toEqual([]);

  await page.getByRole('link', { name: /^Jiggen/ }).click();
  await expect(page.getByRole('region', { name: 'Wofür?' })).toContainText('Absinkphase');
  const drawing = page.getByRole('img', { name: /^Jiggen: Auswerfen/ });
  await expect(drawing).toBeVisible();
  // der Köder läuft die Bahn ab
  const lure = drawing.locator('path[class*="lure"]');
  await expect(lure).toHaveCount(1);
  await expect(lure.locator('animateMotion')).toHaveCount(1);
  await page.getByRole('button', { name: 'Abspielen' }).click();
  await expect(page.getByText('Schritt 2 von 4')).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Anhalten' }).click();
  await page.getByRole('button', { name: /^Zu Schritt 4:/ }).click();
  await expect(page.getByRole('img', { name: /^Jiggen: So in Sprüngen/ })).toContainText('wiederholen');
  expect(await noOverflow(page)).toBe(true);
  expect(await axe(page)).toEqual([]);
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.getByRole('button', { name: /^Zu Schritt 3:/ }).click();
  // bei reduzierter Bewegung ruht der Köder am Ende der Bahn
  await expect(page.getByRole('img').locator('path[class*="lure"]')).toHaveAttribute(
    'transform',
    /translate/,
  );
  expect(await axe(page)).toEqual([]);
  expect(errors).toEqual([]);
});
