import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from './fixtures';
import { collectErrors, startCatchAt, useLocalExternals, waitForApp } from './helpers';

test.use({ serviceWorkers: 'block' });
test.beforeEach(async ({ page }) => {
  await useLocalExternals(page);
});

const axe = (page: Page) =>
  new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa'])
    .analyze()
    .then((r) =>
      r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
    );
const noOverflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);

/** JPEG aus dem Browser (einfarbig mit Verlauf) */
async function jpeg(page: Page, color: string): Promise<{ name: string; mimeType: string; buffer: Buffer }> {
  const bytes = await page.evaluate(async (color) => {
    const c = document.createElement('canvas');
    c.width = 1200;
    c.height = 900;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('kein Canvas');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, 1200, 900);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.9));
    return Array.from(new Uint8Array(await (blob as Blob).arrayBuffer()));
  }, color);
  return { name: `${color.slice(1)}.jpg`, mimeType: 'image/jpeg', buffer: Buffer.from(bytes) };
}

test('PRF-4: Profil einrichten, Beitrag mit zwei Fotos posten, ansehen, Text ändern, löschen und zurückholen', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await waitForApp(page);
  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  await expect(nav.getByRole('link')).toHaveText(['Karte', 'Fangbuch', 'Profil', 'Wetter', 'Mehr']);
  await nav.getByRole('link', { name: 'Profil' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible();
  await expect(page.getByText('Noch keine Beiträge')).toBeVisible();
  await expect(page.getByText('Follower')).toBeVisible();
  await page.getByRole('button', { name: 'Profil teilen' }).click();
  await expect(page.getByText('Kommt mit dem Konto – demnächst.')).toBeVisible();
  expect(await axe(page)).toEqual([]);

  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.getByLabel('Profilbild wählen').setInputFiles(await jpeg(page, '#1f7a8c'));
  await expect(page.getByRole('img', { name: 'Profilbild' })).toBeVisible();
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Bitte einen Namen eingeben.')).toBeVisible();
  await page.getByLabel('Name').fill('Kevin');
  await page.getByLabel('Über dich').fill('📍 Rursee\n🎣 Hecht und Zander');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Kevin', { exact: true })).toBeVisible();
  await expect(page.getByText(/Hecht und Zander/)).toBeVisible();
  // Profilbild auch in der Leiste
  await expect(nav.getByRole('link', { name: 'Profil' }).locator('img')).toBeVisible();

  await page.getByRole('button', { name: 'Neuer Beitrag' }).click();
  await page.getByRole('button', { name: 'Posten' }).click();
  await expect(page.getByText('Wähle mindestens ein Foto.')).toBeVisible();
  await page
    .getByLabel('Fotos wählen')
    .setInputFiles([await jpeg(page, '#f2994a'), await jpeg(page, '#6fcf97')]);
  await expect(page.getByRole('img', { name: 'Foto 2' })).toBeVisible();
  await page.getByLabel('Text').fill('Erster Abend am Rursee');
  expect(await axe(page)).toEqual([]);
  await page.getByRole('button', { name: 'Posten' }).click();

  const grid = page.getByRole('list', { name: 'Beiträge' });
  await expect(grid.getByRole('link')).toHaveCount(1);
  await expect(page.locator('section strong').first()).toHaveText('1');
  expect(await noOverflow(page)).toBe(true);
  expect(await axe(page)).toEqual([]);

  await grid.getByRole('link', { name: /Erster Abend/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Beitrag' })).toBeVisible();
  await expect(page.getByRole('img', { name: 'Foto 2' })).toBeAttached();
  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.getByLabel('Text').fill('Erster Abend am Rursee – zwei Bisse');
  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Erster Abend am Rursee – zwei Bisse')).toBeVisible();
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await axe(page)).toEqual([]);

  await page.getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByText('Beitrag gelöscht.')).toBeVisible();
  await page.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(page.getByText('Beitrag wiederhergestellt.')).toBeVisible();
  await expect(grid.getByRole('link')).toHaveCount(1);

  // bleibt nach Neustart
  await page.reload();
  await waitForApp(page);
  await expect(page.getByRole('list', { name: 'Beiträge' }).getByRole('link')).toHaveCount(1);
  expect(errors).toEqual([]);
});

test('PRF-5: Beitrag aus einem Fang – Fangfoto wird übernommen, Beitrag verweist auf den Fang', async ({
  page,
}) => {
  await page.goto('/');
  await waitForApp(page);
  await page.waitForFunction(() => !!window.__fangpunktMap?.getLayer('fp-places'), null, { timeout: 30_000 });
  await startCatchAt(page);
  const form = page.getByRole('dialog', { name: 'Fang oder Kontakt erfassen' });
  await form.getByLabel('Fischart').selectOption({ label: 'Hecht' });
  await form.getByLabel('Aus Galerie').setInputFiles(await jpeg(page, '#2d9cdb'));
  await expect(form.getByRole('img', { name: 'Foto 1' })).toBeVisible();
  await form.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Fang gespeichert.')).toBeVisible();

  const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
  await nav.getByRole('link', { name: 'Fangbuch' }).click();
  await page.getByRole('link', { name: /Hecht/ }).first().click();
  await page.getByRole('button', { name: 'Im Profil posten' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Neuer Beitrag' })).toBeVisible();
  await expect(page.getByLabel('Mit Fang verknüpfen')).toHaveValue(/.+/);
  await expect(page.getByRole('button', { name: 'Fangfoto 1 übernehmen' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Posten' }).click();

  await page.getByRole('list', { name: 'Beiträge' }).getByRole('link').first().click();
  await page.getByRole('link', { name: /^Zum Fang: Fang · Hecht/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Fang' })).toBeVisible();

  // Statistik ist ein Reiter im Fangbuch
  await nav.getByRole('link', { name: 'Fangbuch' }).click();
  await page.getByRole('navigation', { name: 'Fangbuch' }).getByRole('link', { name: 'Statistik' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Statistik' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Fangbuch' })).toHaveClass(/active/);
});

test('PRF-6: Gefällt mir per Daumen und Doppeltipp, Kommentare im Fenster von unten, Sichtbarkeit pro Beitrag', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/profil/neu');
  await waitForApp(page);
  await page.getByLabel('Fotos wählen').setInputFiles(await jpeg(page, '#2d9cdb'));
  await expect(page.getByRole('img', { name: 'Foto 1' })).toBeVisible();
  await page.getByRole('radio', { name: 'Alle' }).check({ force: true });
  await page.getByRole('button', { name: 'Posten' }).click();
  await page.getByRole('list', { name: 'Beiträge' }).getByRole('link').first().click();
  await expect(page.getByText(/Sichtbar für: Alle/)).toBeVisible();

  const like = page.getByRole('button', { name: 'Gefällt mir' });
  await expect(like).toHaveAttribute('aria-pressed', 'false');
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('1 „Gefällt mir“-Angabe')).toBeVisible();
  await like.click();
  await expect(page.getByText(/„Gefällt mir“-Angabe/)).toHaveCount(0);
  // Doppeltipp auf das Foto setzt „Gefällt mir“, nimmt es aber nie zurück
  const slide = page.locator('li[aria-roledescription="slide"]').first();
  await slide.dblclick();
  await expect(like).toHaveAttribute('aria-pressed', 'true');
  await slide.dblclick();
  await expect(like).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: 'Kommentieren' }).click();
  const sheet = page.getByRole('dialog', { name: 'Kommentare' });
  await expect(sheet).toBeVisible();
  await expect(sheet.getByText('Schreib den ersten Kommentar.')).toBeVisible();
  await expect(sheet.getByRole('button', { name: 'Senden' })).toBeDisabled();
  await sheet.getByRole('button', { name: '🎣 einfügen' }).click();
  await sheet.getByLabel('Kommentar hinzufügen').press('End');
  await sheet.getByLabel('Kommentar hinzufügen').pressSequentially(' Petri Heil!');
  await sheet.getByLabel('Kommentar hinzufügen').press('Enter');
  await expect(sheet.getByText('🎣 Petri Heil!')).toBeVisible();
  await expect(sheet.getByLabel('Kommentar hinzufügen')).toHaveValue('');
  expect(await axe(page)).toEqual([]);
  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await axe(page)).toEqual([]);

  await sheet.getByRole('button', { name: 'Kommentar löschen' }).click();
  await expect(sheet.getByText('🎣 Petri Heil!')).toHaveCount(0);
  await sheet.getByRole('button', { name: 'Rückgängig' }).click();
  await expect(sheet.getByText('🎣 Petri Heil!')).toBeVisible();
  // Escape schließt (Herunterziehen: Touch, siehe PRF-7)
  await page.keyboard.press('Escape');
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('button', { name: '1 Kommentar ansehen' })).toBeVisible();
  expect(await noOverflow(page)).toBe(true);

  await page.reload();
  await waitForApp(page);
  await expect(page.getByRole('button', { name: 'Gefällt mir' })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: '1 Kommentar', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Kommentare' }).getByText('🎣 Petri Heil!')).toBeVisible();
  expect(errors).toEqual([]);
});

test('PRF-7: Kommentar-Fenster schließt beim Herunterziehen, kurzes Ziehen federt zurück', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Touch über CDP');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/profil/neu');
  await waitForApp(page);
  await page.getByLabel('Fotos wählen').setInputFiles(await jpeg(page, '#27ae60'));
  await expect(page.getByRole('img', { name: 'Foto 1' })).toBeVisible();
  await page.getByRole('button', { name: 'Posten' }).click();
  await page.getByRole('list', { name: 'Beiträge' }).getByRole('link').first().click();
  await page.getByRole('button', { name: 'Kommentieren' }).click();
  const sheet = page.getByRole('dialog', { name: 'Kommentare' });
  await expect(sheet).toBeVisible();
  const top = (await sheet.getByRole('heading', { name: 'Kommentare' }).boundingBox())?.y ?? 200;

  const cdp = await page.context().newCDPSession(page);
  const drag = async (dist: number, stepMs: number) => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: top }] });
    for (let d = 20; d <= dist; d += 20) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: 195, y: top + d }],
      });
      await page.waitForTimeout(stepMs);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  };
  // langsam und kurz: federt zurück
  await drag(60, 120);
  await page.waitForTimeout(400);
  await expect(sheet).toBeVisible();
  await drag(360, 20);
  await expect(sheet).toBeHidden();
});
