import { expect, test } from '@playwright/test';
import { collectErrors, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

test('PWA-2: Intro erscheint beim Kaltstart und gibt die App schnell frei', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.locator('#intro')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.classList.contains('intro-anim'))).toBe(true);
  const t0 = Date.now();
  await waitForApp(page);
  // Mindestdauer 750 ms + 250 ms Ausblenden; großzügige Obergrenze für langsame CI-Rechner.
  expect(Date.now() - t0).toBeLessThan(2500);
  await expect(page.locator('#intro')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Intro lässt sich per Tipp überspringen', async ({ page }) => {
  await page.goto('/');
  await page.locator('#intro').click();
  await waitForApp(page);
  await expect(page.locator('#intro')).toHaveCount(0);
});

test('PWA-3: Reduzierte Bewegung zeigt ein statisches Intro und endet sehr schnell', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const start = Date.now();
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.classList.contains('intro-static'))).toBe(true);
  await waitForApp(page);
  expect(Date.now() - start).toBeLessThan(1500);
});

test('PWA-4: Rückkehr aus dem Hintergrund zeigt kein Intro', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
  });
  await expect(page.locator('#intro')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.dataset.intro)).toBe('done');
});
