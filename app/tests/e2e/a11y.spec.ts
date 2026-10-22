// Barrierefreiheit aller Hauptansichten (TEST_PLAN §6, M11): axe ohne „serious"/„critical", hell und dunkel,
// mit Daten (Fang mit Wetter und Rechts-Prüfung, Session mit Pause, Köder-Favorit).
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import type { BaitPreset, Catch, Session } from '../../src/domain/schemas';
import { useLocalExternals, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });

const t = '2026-10-20T15:12:00+02:00';
const meta = { createdAt: t, updatedAt: t, rev: 0 };
const session: Session = {
  id: 'a11y-s',
  ...meta,
  startAt: '2026-10-20T14:00:00+02:00',
  endAt: '2026-10-20T18:00:00+02:00',
  tz: 'Europe/Berlin',
  title: 'Nachmittag',
  pauses: [{ from: '2026-10-20T15:30:00+02:00', to: '2026-10-20T16:00:00+02:00' }],
};
const catches: Catch[] = [
  {
    id: 'a11y-c',
    ...meta,
    outcome: 'caught',
    at: '2026-10-20T15:10:00+02:00',
    tz: 'Europe/Berlin',
    speciesId: 'pike',
    lengthCm: 62,
    lengthMethod: 'measured',
    sessionId: 'a11y-s',
    bait: { name: 'Shad 12 cm', type: 'softbait', color: 'Motoroil' },
    position: { lat: 51.3123, lng: 6.2099, source: 'gps' },
    weather: {
      provider: 'open-meteo',
      fetchedAt: t,
      kind: 'model',
      forHour: '2026-10-20T13:00:00.000Z',
      tempC: 9.4,
      windMs: 3.8,
      windDirDeg: 101,
      pressureHpa: 1018,
      attribution: 'Open-Meteo.com, CC BY 4.0',
    },
  },
  { id: 'a11y-k', ...meta, outcome: 'contact', at: '2026-10-20T16:30:00+02:00', tz: 'Europe/Berlin' },
];
const preset: BaitPreset = {
  id: 'a11y-p',
  ...meta,
  label: 'Shad 12 cm',
  bait: { name: 'Shad 12 cm', type: 'softbait' },
};

async function seed(page: Page) {
  await page.goto('/fangbuch');
  await waitForApp(page);
  await page.evaluate(
    async ({ catches, session, preset }) => {
      const req = indexedDB.open('fangpunkt');
      const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(['catches', 'sessions', 'baitPresets'], 'readwrite');
        for (const c of catches) tx.objectStore('catches').put(c);
        tx.objectStore('sessions').put(session);
        tx.objectStore('baitPresets').put(preset);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error as Error);
      });
      db.close();
    },
    { catches, session, preset },
  );
}

/** Seiten, teils mit geöffnetem Formular (Aktion nach dem Laden) */
const ROUTES: (string | [string, (p: Page) => Promise<void>])[] = [
  '/',
  '/fangbuch',
  '/fangbuch/a11y-c',
  ['/fangbuch/a11y-c', (p) => p.getByRole('button', { name: 'Bearbeiten' }).click()],
  '/fangbuch/sessions',
  '/fangbuch/sessions/a11y-s',
  ['/fangbuch/sessions/a11y-s', (p) => p.getByText('Pause nachtragen', { exact: true }).first().click()],
  '/wetter',
  '/statistik',
  '/mehr',
  '/mehr/einstellungen',
  '/mehr/koeder',
  ['/mehr/koeder', (p) => p.getByRole('button', { name: 'Favorit anlegen' }).click()],
  '/mehr/info',
  '/mehr/datenschutz',
  '/mehr/daten',
  '/mehr/recht',
  '/mehr/recht/BY',
  '/gibt-es-nicht',
];

for (const scheme of ['light', 'dark'] as const)
  test(`A11Y: alle Hauptansichten ohne schwere axe-Befunde (${scheme === 'light' ? 'hell' : 'dunkel'})`, async ({
    page,
  }) => {
    test.slow();
    await useLocalExternals(page);
    await page.emulateMedia({ colorScheme: scheme });
    await seed(page);
    const found: string[] = [];
    for (const entry of ROUTES) {
      const [route, action] = typeof entry === 'string' ? [entry] : entry;
      await page.goto(route);
      await waitForApp(page);
      await page.locator('main').waitFor();
      await page.waitForTimeout(400); // Lazy-Inhalte und Live-Abfragen
      if (action) {
        await action(page);
        await page.waitForTimeout(200);
      }
      const r = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      for (const v of r.violations)
        found.push(
          `${route} [${v.impact}] ${v.id}: ${v.nodes
            .map((n) => n.target.join(' '))
            .slice(0, 3)
            .join(' | ')}`,
        );
    }
    console.log(found.join('\n') || 'keine Befunde');
    expect(found.filter((f) => /\[(serious|critical)\]/.test(f))).toEqual([]);
  });

test('A11Y: Touch-Ziele mindestens 44 × 44 px (mobil)', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobil', 'nur auf dem Handy-Profil');
  test.slow();
  await useLocalExternals(page);
  await seed(page);
  const small: string[] = [];
  for (const entry of ROUTES) {
    const [route, action] = typeof entry === 'string' ? [entry] : entry;
    await page.goto(route);
    await waitForApp(page);
    await page.locator('main').waitFor();
    await page.waitForTimeout(400);
    if (action) await action(page);
    const found = await page.evaluate(() =>
      [
        ...document.querySelectorAll<HTMLElement>(
          'button, a[href], input:not([type=hidden]):not([type=file]), select, summary, [role=button]',
        ),
      ]
        // sichtbar; Links im Fließtext sind ausgenommen (WCAG 2.5.8)
        .filter((e) => e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden')
        .filter((e) => !(e.tagName === 'A' && e.closest('p, li, dd, td') && !e.className))
        .map((e) => {
          // versteckte Radio-/Checkbox-Eingaben zählen über ihr Label
          const target =
            e instanceof HTMLInputElement && /^(radio|checkbox)$/.test(e.type) && e.labels?.[0]
              ? e.labels[0]
              : e;
          const b = target.getBoundingClientRect();
          const name = e.getAttribute('aria-label') ?? target.textContent?.trim().slice(0, 30) ?? e.tagName;
          return { name, w: Math.round(b.width), h: Math.round(b.height) };
        })
        .filter((x) => x.w > 0 && (x.w < 44 || x.h < 44))
        .map((x) => `"${x.name}" ${x.w}×${x.h}`),
    );
    small.push(...found.map((f) => `${route}: ${f}`));
  }
  expect(small).toEqual([]);
});
