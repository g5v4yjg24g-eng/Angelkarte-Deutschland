import { expect, test } from './fixtures';
import { collectErrors, waitForApp, useLocalExternals } from './helpers';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await useLocalExternals(page);
});

test('PWA-2: Intro erscheint beim Kaltstart und gibt die App schnell frei', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await expect(page.locator('#intro')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.classList.contains('intro-anim'))).toBe(true);
  await waitForApp(page);
  // Gemessen in der Seite ab Navigationsstart: Mindestdauer 750 ms + 250 ms Ausblenden + Laden.
  const doneMs = Number(await page.evaluate(() => document.documentElement.dataset.introDoneMs));
  expect(doneMs).toBeGreaterThanOrEqual(1000);
  expect(doneMs).toBeLessThan(3000);
  await expect(page.locator('#intro')).toHaveCount(0);
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('Intro lässt sich per Tipp überspringen', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  // Sofort tippen; ist das Intro (bei schneller App) schon weg, gibt es nichts zu überspringen
  const fadedImmediately = await page.evaluate(() => {
    const el = document.getElementById('intro');
    if (!el || el.classList.contains('is-out')) return null;
    el.click();
    return el.classList.contains('is-out'); // Ausblenden beginnt im selben Moment
  });
  expect(fadedImmediately === null || fadedImmediately).toBe(true);
  await waitForApp(page);
  await expect(page.locator('#intro')).toHaveCount(0);
});

test('PWA-3: Reduzierte Bewegung zeigt ein statisches Intro und endet sehr schnell', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.classList.contains('intro-static'))).toBe(true);
  await waitForApp(page);
  // Statisch: 200 ms Mindestdauer + 150 ms Ausblenden (+ Laden), gemessen in der Seite
  expect(Number(await page.evaluate(() => document.documentElement.dataset.introDoneMs))).toBeLessThan(2000);
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
