import type { Page } from '@playwright/test';

/** Wartet, bis das Intro vollständig verschwunden ist. */
export async function waitForApp(page: Page) {
  await page.waitForFunction(() => document.documentElement.dataset.intro === 'done', null, {
    timeout: 10_000,
  });
}

/** Sammelt Laufzeitfehler; Tests prüfen am Ende, dass keine aufgetreten sind (TEST_PLAN §4). */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  return errors;
}
