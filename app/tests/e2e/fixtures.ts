import { test as base } from '@playwright/test';

export { expect } from '@playwright/test';
export type { Page, Route } from '@playwright/test';

/**
 * Für alle Tests: Open-Meteo nie wirklich abrufen (TEST_PLAN §1, Wetter ist standardmäßig an). Antwortet
 * „keine Werte"; weather.spec.ts legt eine eigene Route darüber. Bright Sky (Warnungen) und PEGELONLINE ebenso.
 */
export const test = base.extend<{ noRealWeather: undefined }>({
  noRealWeather: [
    async ({ page }, use) => {
      await page.route('https://*.open-meteo.com/**', (r) => r.fulfill({ json: { hourly: { time: [] } } }));
      // Amtliche Warnungen: ohne eigene Route „keine Warnungen“
      await page.route('https://api.brightsky.dev/**', (r) =>
        r.fulfill({ json: { alerts: [], location: null } }),
      );
      // Pegel: ohne eigene Route keine Stationen
      await page.route('https://www.pegelonline.wsv.de/**', (r) => r.fulfill({ json: [] }));
      await use(undefined);
    },
    { auto: true },
  ],
});
