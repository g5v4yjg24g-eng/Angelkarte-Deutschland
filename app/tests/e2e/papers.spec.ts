// PAP-1: Angelpapiere im Wallet – anlegen, Stand und Hinweis, Verlängern, Löschen mit Rückgängig, unbefristet, a11y.
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import { animationsDone, collectErrors, useLocalExternals, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await useLocalExternals(page);
});

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const inDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return iso(d);
};

async function add(page: Page, title: string, until: string | undefined, kind?: string) {
  await page.getByRole('button', { name: 'Papier hinzufügen' }).click();
  const form = page.getByRole('dialog', { name: 'Neues Papier' });
  await animationsDone(form);
  if (kind) await form.getByLabel('Art').selectOption({ label: kind });
  await form.getByLabel('Bezeichnung').fill(title);
  if (until) await form.getByLabel('Gültig bis').fill(until);
  await form.getByRole('button', { name: 'Speichern' }).click();
  const detail = page.getByRole('dialog', { name: title });
  await expect(detail).toBeVisible();
  await animationsDone(detail);
  await detail.getByRole('button', { name: 'Schließen' }).click();
  await expect(detail).toBeHidden();
}

test('PAP-1: Papier anlegen, läuft bald ab, verlängern, unbefristet, löschen und zurückholen', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/mehr/papiere');
  await waitForApp(page);
  await expect(page.getByRole('heading', { level: 1, name: 'Angelpapiere' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Noch keine Papiere' })).toBeVisible();

  // Pflichtfelder: ohne Bezeichnung und ohne Ablaufdatum wird nichts gespeichert
  await page.getByRole('button', { name: 'Papier hinzufügen' }).click();
  const form = page.getByRole('dialog', { name: 'Neues Papier' });
  await animationsDone(form);
  await form.getByRole('button', { name: 'Speichern' }).click();
  await expect(form.getByText('Bitte eine Bezeichnung eingeben.')).toBeVisible();
  await form.getByLabel('Bezeichnung').fill('Jahreskarte Baggersee');
  await form.getByRole('button', { name: 'Speichern' }).click();
  await expect(form.getByText('Bitte das Ablaufdatum eingeben oder „Unbefristet“ wählen.')).toBeVisible();
  await form.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(form).toBeHidden();

  await add(page, 'Jahreskarte Baggersee', inDays(10));
  const card = page.getByRole('button', { name: /Jahreskarte Baggersee/ });
  await expect(card).toContainText('läuft in 10 Tagen ab');
  await expect(page.getByText('1 Papier ist abgelaufen oder läuft bald ab.')).toBeVisible();
  // Im Browser gibt es keine Mitteilung – dort steht der Hinweis beim Öffnen
  await expect(page.getByText('Erinnerungen als Mitteilung gibt es in der iPhone-App.')).toBeVisible();

  // Hinweis in der Mehr-Liste
  await page.goto('/mehr');
  await expect(page.getByRole('link', { name: /Angelpapiere/ })).toContainText('1 läuft bald ab');
  await page.getByRole('link', { name: /Angelpapiere/ }).click();

  // Fischereischein: standardmäßig unbefristet, ohne Ablaufdatum
  await add(page, 'Fischereischein', undefined, 'Fischereischein');
  await expect(page.getByRole('button', { name: /Fischereischein/ })).toContainText('unbefristet');

  // Verlängern: nur ein späteres Datum
  await card.click();
  const detail = page.getByRole('dialog', { name: 'Jahreskarte Baggersee' });
  await animationsDone(detail);
  await detail.getByRole('button', { name: 'Verlängert' }).click();
  await detail.getByLabel('Neues Ablaufdatum').fill(inDays(5));
  await detail.getByRole('button', { name: 'Speichern' }).click();
  await expect(detail.getByText('Das neue Datum muss nach dem bisherigen liegen.')).toBeVisible();
  await detail.getByLabel('Neues Ablaufdatum').fill(inDays(400));
  await detail.getByRole('button', { name: 'Speichern' }).click();
  await expect(detail.getByRole('button', { name: 'Verlängert' })).toBeVisible();
  await detail.getByRole('button', { name: 'Schließen' }).click();
  await expect(card).toContainText('noch 400 Tage');
  await expect(page.getByText('1 Papier ist abgelaufen oder läuft bald ab.')).toBeHidden();

  // Löschen und zurückholen
  await card.click();
  const again = page.getByRole('dialog', { name: 'Jahreskarte Baggersee' });
  await animationsDone(again);
  await again.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('button', { name: /Jahreskarte Baggersee/ })).toBeHidden();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByRole('button', { name: /Jahreskarte Baggersee/ })).toBeVisible();

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  for (const scheme of ['light', 'dark'] as const) {
    await page.emulateMedia({ colorScheme: scheme });
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    ).toEqual([]);
  }
  expect(errors).toEqual([]);
});

test('PAP-2: abgelaufenes Papier wird als solches gezeigt', async ({ page }) => {
  await page.goto('/mehr/papiere');
  await waitForApp(page);
  await add(page, 'Erlaubnisschein Fluss', inDays(-3));
  await expect(page.getByRole('button', { name: /Erlaubnisschein Fluss/ })).toContainText(
    'seit 3 Tagen abgelaufen',
  );
  await expect(page.getByText('1 Papier ist abgelaufen oder läuft bald ab.')).toBeVisible();
});
