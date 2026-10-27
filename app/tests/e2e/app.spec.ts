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
    ['Profil', 'Profil'],
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

/** Finger-Geste auf der Leiste nachstellen (Pointer Events wie auf dem Handy) */
async function swipeNav(
  page: import('./fixtures').Page,
  from: string,
  to: string,
  hold?: () => Promise<void>,
) {
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  const a = await nav.getByRole('link', { name: from }).boundingBox();
  const b = await nav.getByRole('link', { name: to }).boundingBox();
  if (!a || !b) throw new Error('Leiste nicht sichtbar');
  const y = a.y + a.height / 2;
  const fire = (type: string, x: number) =>
    nav.evaluate(
      (el, { type, x, y }) => {
        const target = document.elementFromPoint(x, y) ?? el;
        target.dispatchEvent(
          new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            pointerId: 7,
            pointerType: 'touch',
            isPrimary: true,
            clientX: x,
            clientY: y,
          }),
        );
      },
      { type, x, y },
    );
  const x0 = a.x + a.width / 2;
  const x1 = b.x + b.width / 2;
  await fire('pointerdown', x0);
  for (let i = 1; i <= 6; i++) await fire('pointermove', x0 + ((x1 - x0) * i) / 6);
  await hold?.();
  await fire('pointerup', x1);
}

test('NAV-1: Gedrückt über die Leiste wischen – Glas-Linse folgt, Loslassen wählt; Tipp bleibt Tipp', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Nur die mobile Leiste hat die Linse');
  const errors = collectErrors(page);
  await page.goto('/fangbuch');
  await waitForApp(page);
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  await swipeNav(page, 'Fangbuch', 'Profil', async () => {
    // Während des Wischens: Linse sichtbar, Punkt darunter vergrößert, Seite noch nicht gewechselt
    await expect(nav.locator('[class*="lens_"], [class*="_lens"]').first()).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Profil' })).toHaveClass(/lensed/);
    await expect(page.getByRole('heading', { level: 1, name: 'Fangbuch' })).toBeVisible();
  });
  await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Profil' })).toHaveAttribute('aria-current', 'page');
  // Linse verschwindet nach dem Einrasten
  await expect(nav.locator('[aria-hidden="true"][style*="--lens-x"]')).toHaveCount(0);
  // Normaler Tipp funktioniert weiter
  await nav.getByRole('link', { name: 'Wetter' }).tap();
  await expect(page.getByRole('heading', { level: 1, name: 'Wetter' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('NAV-2: Leiste ist durchsichtig (Inhalt scheint durch), bei „Transparenz reduzieren" deckend', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'Nur die mobile Leiste schwebt');
  await page.goto('/fangbuch');
  await waitForApp(page);
  const alpha = () =>
    page.getByRole('navigation', { name: 'Hauptnavigation' }).evaluate((el) => {
      const m = /rgba?\(([^)]+)\)|color\(srgb ([^)]+)\)/.exec(getComputedStyle(el).backgroundColor);
      const parts = (m?.[1] ?? m?.[2] ?? '').split(/[\s,/]+/).filter(Boolean);
      return parts.length === 4 ? Number(parts[3]) : 1;
    });
  expect(await alpha()).toBeLessThan(0.5);
});
