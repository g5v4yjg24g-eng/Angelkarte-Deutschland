import { expect, test } from '@playwright/test';
import { waitForApp } from './helpers';

test('PWA-1: Manifest ist vollständig und alle Icons sind abrufbar', async ({ page, request }) => {
  await page.goto('/');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const res = await request.get(href ?? '');
  expect(res.ok()).toBe(true);
  const m = await res.json();
  expect(m).toMatchObject({ name: 'Fangpunkt', short_name: 'Fangpunkt', lang: 'de', display: 'standalone' });
  const sizes = m.icons.map(
    (i: { sizes: string; purpose?: string }) => `${i.sizes}${i.purpose ? ':' + i.purpose : ''}`,
  );
  expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512', '512x512:maskable']));
  for (const icon of m.icons) {
    const r = await request.get('/' + icon.src);
    expect(r.ok(), icon.src).toBe(true);
    expect(r.headers()['content-type']).toContain('image/png');
  }
  expect((await request.get('/icons/apple-touch-icon.png')).ok()).toBe(true);
  expect((await request.get('/icons/favicon.svg')).ok()).toBe(true);
});

test('PWA-6: Nach dem ersten Besuch startet die App auch offline', async ({ page, context }) => {
  await page.goto('/');
  await waitForApp(page);
  // Warten, bis der Service Worker aktiv ist und die Seite kontrolliert
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await waitForApp(page);
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await waitForApp(page);
  await expect(page.getByRole('navigation', { name: 'Hauptnavigation' })).toBeVisible();
  await expect(page.getByText('Offline', { exact: true })).toBeVisible();
  // Unterseite per Direktaufruf (Navigation-Fallback aus dem Cache)
  await page.goto('/mehr/info');
  await expect(page.getByRole('heading', { name: 'Über Fangpunkt' })).toBeVisible();
  await context.setOffline(false);
});
