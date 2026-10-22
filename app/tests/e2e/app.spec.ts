import AxeBuilder from '@axe-core/playwright';
import { expect, test } from './fixtures';
import { collectErrors, waitForApp, useLocalExternals } from './helpers';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await useLocalExternals(page);
});

const VIEWS = [
  { path: '/fangbuch', heading: 'Fangbuch' },
  { path: '/statistik', heading: 'Statistik' },
  { path: '/mehr', heading: 'Mehr' },
  { path: '/mehr/einstellungen', heading: 'Einstellungen' },
  { path: '/mehr/info', heading: 'Über Fangpunkt' },
];

test('Navigation über die Hauptleiste erreicht alle Bereiche', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');
  await waitForApp(page);
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  for (const [name, heading] of [
    ['Fangbuch', 'Fangbuch'],
    ['Statistik', 'Statistik'],
    ['Mehr', 'Mehr'],
  ] as const) {
    await nav.getByRole('link', { name }).click();
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(nav.getByRole('link', { name })).toHaveAttribute('aria-current', 'page');
  }
  expect(errors).toEqual([]);
});

test('Direktaufruf einer Unterseite und unbekannter Pfad', async ({ page }) => {
  await page.goto('/mehr/info');
  await waitForApp(page);
  await expect(page.getByRole('heading', { name: 'Über Fangpunkt' })).toBeVisible();
  await expect(page.getByText(/^Version \d+\.\d+\.\d+$/)).toBeVisible();
  await page.goto('/gibt-es-nicht');
  await expect(page.getByRole('heading', { name: 'Seite nicht gefunden' })).toBeVisible();
});

test('Theme-Wahl wirkt sofort und bleibt nach dem Neuladen erhalten', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/mehr/einstellungen');
  await waitForApp(page);
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  const light = await bg();
  await page.getByRole('radio', { name: 'Dunkel' }).check();
  expect(await bg()).not.toBe(light);
  await page.reload();
  await waitForApp(page);
  expect(await page.evaluate(() => document.documentElement.dataset.theme)).toBe('dark');
  await expect(page.getByRole('radio', { name: 'Dunkel' })).toBeChecked();
  await page.getByRole('radio', { name: 'Wie System' }).check();
  expect(await bg()).toBe(light);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`Barrierefreiheit und Layout (${scheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    for (const v of VIEWS) {
      await page.goto(v.path);
      await waitForApp(page);
      await expect(page.getByRole('heading', { name: v.heading })).toBeVisible();
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
      const serious = results.violations.filter((x) => x.impact === 'serious' || x.impact === 'critical');
      expect(serious.map((x) => `${v.path}: ${x.id} – ${x.help}`)).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth + 1,
      );
      expect(overflow, `${v.path} scrollt horizontal`).toBe(false);
      for (const bad of ['NaN', 'undefined', 'null', 'Infinity']) {
        await expect(page.locator('body')).not.toContainText(bad);
      }
    }
  });
}

test('Touch-Ziele der Navigation sind mindestens 44 × 44 px groß', async ({ page }) => {
  await page.goto('/');
  await waitForApp(page);
  for (const link of await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link')
    .all()) {
    const box = await link.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }
});
