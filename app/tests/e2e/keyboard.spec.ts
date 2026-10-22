// Tastaturbedienung (TEST_PLAN §6, M11): sichtbarer Fokus, Navigation, Fokus-Rückgabe nach Dialogen,
// Fang erfassen ganz ohne Maus.
import { expect, test, type Page } from './fixtures';
import { collectErrors, useLocalExternals, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });
test.skip(({ isMobile }) => isMobile, 'Tastatur: Desktop-Profil');

const active = (page: Page) =>
  page.evaluate(() => {
    const e = document.activeElement as HTMLElement | null;
    return {
      text: (
        e?.getAttribute('aria-label') ??
        (e instanceof HTMLInputElement ? e.labels?.[0]?.textContent : e?.textContent) ??
        ''
      ).trim(),
      inDialog: !!e?.closest('dialog[open]'),
      outline: e ? getComputedStyle(e).outlineStyle : 'none',
    };
  });

/** Tab drücken, bis das Element mit diesem Namen den Fokus hat (höchstens 40×). */
async function tabTo(page: Page, name: RegExp) {
  for (let i = 0; i < 40; i++) {
    await page.keyboard.press('Tab');
    if (name.test((await active(page)).text)) return;
  }
  throw new Error(`Per Tab nicht erreichbar: ${name}`);
}

test.beforeEach(async ({ page }) => {
  await useLocalExternals(page);
});

async function openMap(page: Page) {
  await page.goto('/');
  await waitForApp(page);
  await page.waitForFunction(() => !!window.__fangpunktMap?.getLayer('fp-places'), null, { timeout: 30_000 });
}

test('KEY-1: Navigation per Tab und Enter, Fokus sichtbar', async ({ page }) => {
  await page.goto('/fangbuch');
  await waitForApp(page);
  await tabTo(page, /^Statistik$/);
  expect((await active(page)).outline).not.toBe('none');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Statistik' })).toBeVisible();
  await tabTo(page, /^Mehr$/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Mehr' })).toBeVisible();
  await tabTo(page, /Einstellungen/);
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Einstellungen' })).toBeVisible();
  // Segment-Schalter: Pfeiltasten wählen
  await tabTo(page, /^Wie System$/);
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('radio', { name: 'Hell' })).toBeChecked();
});

test('KEY-2: Dialog öffnet mit Fokus darin, Escape schließt, Fokus kehrt zum Auslöser zurück', async ({
  page,
}) => {
  await openMap(page);
  await page.getByRole('button', { name: 'Legende' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Kartensymbole' })).toBeVisible();
  expect((await active(page)).inDialog).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Kartensymbole' })).toBeHidden();
  expect((await active(page)).text).toBe('Legende');
  // Schließen-Knopf ebenso
  await page.keyboard.press('Enter');
  await page
    .getByRole('dialog', { name: 'Kartensymbole' })
    .getByRole('button', { name: 'Schließen' })
    .focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Kartensymbole' })).toBeHidden();
  expect((await active(page)).text).toBe('Legende');
});

test('KEY-3: Fang ganz ohne Maus erfassen (Kartenmitte)', async ({ page }) => {
  const errors = collectErrors(page);
  await openMap(page);
  await page.getByRole('button', { name: 'Fang erfassen' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByText('Tippe auf die Stelle', { exact: false })).toBeVisible();
  await tabTo(page, /^Kartenmitte/);
  await page.keyboard.press('Enter');
  const form = page.getByRole('dialog', { name: 'Fang oder Kontakt erfassen' });
  await expect(form).toBeVisible();
  expect((await active(page)).inDialog).toBe(true);
  await form.getByRole('combobox', { name: 'Fischart' }).focus();
  await form.getByRole('combobox', { name: 'Fischart' }).selectOption({ label: 'Zander' });
  await tabTo(page, /^Speichern$/);
  await page.keyboard.press('Enter');
  await expect(page.getByText('Fang gespeichert.')).toBeVisible();
  // Nach dem Schließen landet der Fokus wieder auf „Fang erfassen"
  expect((await active(page)).text).toBe('Fang erfassen');
  expect(errors).toEqual([]);
});
