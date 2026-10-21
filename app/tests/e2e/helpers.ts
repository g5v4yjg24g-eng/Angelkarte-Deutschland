import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

const WATER_FIXTURE = fileURLToPath(new URL('../fixtures/water/', import.meta.url));

/**
 * Liefert die Test-Gewässerdaten (Nettetal) statt der echten aus – mit HTTP-Range wie ein echter Server,
 * denn PMTiles ruft nur Ausschnitte der Datei ab.
 */
export async function serveWaterFixture(page: Page, { missing = false } = {}) {
  await page.route('**/data/water/**', async (route) => {
    if (missing) return route.fulfill({ status: 404, body: '' });
    const rel = new URL(route.request().url()).pathname.split('/data/water/')[1] ?? '';
    const file = join(WATER_FIXTURE, rel);
    if (!rel || !existsSync(file)) return route.fulfill({ status: 404, body: '' });
    const buf = readFileSync(file);
    const type = file.endsWith('.json') ? 'application/json' : 'application/octet-stream';
    const m = /bytes=(\d+)-(\d*)/.exec(route.request().headers()['range'] ?? '');
    if (!m)
      return route.fulfill({
        status: 200,
        body: buf,
        headers: { 'Content-Type': type, 'Accept-Ranges': 'bytes' },
      });
    const start = Number(m[1]);
    const end = m[2] ? Math.min(Number(m[2]), buf.length - 1) : buf.length - 1;
    return route.fulfill({
      status: 206,
      body: buf.subarray(start, end + 1),
      headers: {
        'Content-Type': type,
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${buf.length}`,
      },
    });
  });
}

export function waterFixtureSearch(
  shard: string,
): [string, string, number, number, string, number, string][] {
  return JSON.parse(readFileSync(join(WATER_FIXTURE, 'search', `${shard}.json`), 'utf8'));
}

const TEST_BASEMAP_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'bg', type: 'background', paint: { 'background-color': '#dfe8e8' } }],
};

/** Keine Fremdabrufe in Tests: Basiskarte als lokaler Teststil, Gewässer aus den Testdaten. */
export async function useLocalExternals(page: Page) {
  await page.route('https://tiles.openfreemap.org/**', (r) => r.fulfill({ json: TEST_BASEMAP_STYLE }));
  await serveWaterFixture(page);
}
