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
  await expect(nav.getByRole('link')).toHaveText(['Karte', 'Fangbuch', 'Feed', 'Profil', 'Wetter', 'Mehr']);
  await nav.getByRole('link', { name: 'Profil' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible();
  await expect(page.getByText('Noch keine Beiträge')).toBeVisible();
  await expect(page.getByText('Freunde', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Profil teilen' }).click();
  await expect(page.getByText('Kommt mit dem Konto – demnächst.')).toBeVisible();
  expect(await axe(page)).toEqual([]);

  await page.getByRole('button', { name: 'Bearbeiten' }).click();
  await page.getByLabel('Profilbild wählen').setInputFiles(await jpeg(page, '#1f7a8c'));
  await page
    .getByRole('dialog', { name: 'Profilbild zuschneiden' })
    .getByRole('button', { name: 'Übernehmen' })
    .click();
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
  // Länge im Formular (Details aufklappen, falls nötig)
  const len = form.getByLabel(/^Länge/);
  if (!(await len.isVisible()))
    await form
      .getByText(/Mehr Angaben|Details/)
      .first()
      .click();
  await len.fill('68');
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
  // Fischart und Länge sind aus dem Fang vorausgefüllt (freiwillig, änderbar)
  const info = page.getByRole('group', { name: 'Angaben zum Fang (freiwillig)' });
  await expect(info.getByLabel('Fischart')).toHaveValue('pike');
  await expect(info.getByLabel('Länge in cm')).toHaveValue('68');
  await info.getByLabel('Länge in cm').fill('300');
  await page.getByRole('button', { name: 'Posten' }).click();
  await expect(
    page.getByText('Bitte eine Länge zwischen 1 und 250 cm eingeben – oder das Feld leer lassen.'),
  ).toBeVisible();
  await info.getByLabel('Länge in cm').fill('68,5');
  await page.getByRole('button', { name: 'Posten' }).click();

  await page.getByRole('list', { name: 'Beiträge' }).getByRole('link').first().click();
  await expect(page.getByText('Hecht · 68,5 cm')).toBeVisible();
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
  // das Formular ist länger geworden (Fischart/Länge): erst in die Mitte scrollen, sonst liegt die Leiste darüber
  await page.getByRole('radio', { name: 'Alle' }).evaluate((el) => el.scrollIntoView({ block: 'center' }));
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

/** JPEG mit zwei Hälften: links `left`, rechts `right` */
async function twoTone(page: Page, left: string, right: string) {
  const bytes = await page.evaluate(
    async ([left, right]) => {
      const c = document.createElement('canvas');
      c.width = 1200;
      c.height = 900;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('kein Canvas');
      ctx.fillStyle = left;
      ctx.fillRect(0, 0, 600, 900);
      ctx.fillStyle = right;
      ctx.fillRect(600, 0, 600, 900);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.95));
      return Array.from(new Uint8Array(await (blob as Blob).arrayBuffer()));
    },
    [left, right] as const,
  );
  return { name: 'zwei.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(bytes) };
}

/** Größe und Farbe in der Mitte des Profilbilds auf der Profilseite */
const avatarPixel = (page: Page) =>
  page
    .getByRole('main')
    .getByRole('img', { name: 'Profilbild' })
    .first()
    .evaluate(async (el) => {
      const img = el as HTMLImageElement;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext('2d');
      if (!ctx) throw new Error('kein Canvas');
      ctx.drawImage(img, 0, 0);
      const [r, g, b] = ctx.getImageData(c.width / 2, c.height / 2, 1, 1).data;
      return { w: img.naturalWidth, h: img.naturalHeight, r: r ?? 0, g: g ?? 0, b: b ?? 0 };
    });

test('PRF-8: Profilbild zuschneiden – verschieben, zoomen, zurücksetzen, abbrechen behält das alte Bild', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/profil/bearbeiten');
  await waitForApp(page);
  await page.getByLabel('Name').fill('Kevin');

  // Abbrechen: kein Bild übernommen
  await page.getByLabel('Profilbild wählen').setInputFiles(await twoTone(page, '#c0392b', '#1f7a8c'));
  const dialog = page.getByRole('dialog', { name: 'Profilbild zuschneiden' });
  await expect(dialog.getByRole('group', { name: /Bildausschnitt/ }).locator('img')).toBeVisible();
  expect(await axe(page)).toEqual([]);
  expect(await noOverflow(page)).toBe(true);
  await dialog.getByRole('button', { name: 'Abbrechen' }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Bild entfernen' })).toHaveCount(0);

  // Wählen, nach rechts ziehen → linke (rote) Hälfte im Kreis
  await page.getByLabel('Profilbild wählen').setInputFiles(await twoTone(page, '#c0392b', '#1f7a8c'));
  const frame = dialog.getByRole('group', { name: /Bildausschnitt/ });
  await expect(frame.locator('img')).toBeVisible();
  const box = await frame.boundingBox();
  if (!box) throw new Error('kein Rahmen');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 1.4, box.y + box.height / 2, { steps: 8 });
  await page.mouse.up();
  // Zoomen per Regler und Tastatur, Zurücksetzen stellt den Start wieder her
  const zoom = dialog.getByRole('slider', { name: 'Zoom' });
  await zoom.fill('2');
  await expect(zoom).toHaveValue('2');
  await dialog.getByRole('button', { name: 'Zurücksetzen' }).click();
  await expect(zoom).toHaveValue('1');
  await frame.focus();
  for (let i = 0; i < 30; i++) await page.keyboard.press('ArrowLeft');
  await dialog.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Kevin', { exact: true })).toBeVisible();
  const px = await avatarPixel(page);
  // quadratisch gespeichert (rund nur in der Anzeige), Mitte rot = linke Bildhälfte
  expect(px.w).toBe(px.h);
  expect(px.r).toBeGreaterThan(150);
  expect(px.b).toBeLessThan(100);
  expect(errors).toEqual([]);
});

/** Ist gerade etwas auf der Hecht-Ebene gezeichnet? */
const pikeVisible = (page: Page) =>
  page
    .locator('canvas[aria-hidden="true"]')
    .first()
    .evaluate((el) => {
      const c = el as HTMLCanvasElement;
      const ctx = c.getContext('2d');
      if (!ctx || !c.width || !c.height) return false;
      const d = ctx.getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4 * 7) if ((d[i] ?? 0) > 0) return true;
      return false;
    });

test('PRF-9: Doppeltipp – Hecht schwimmt im Bild zum Daumen, setzt „Gefällt mir“ einmal und nimmt nie zurück; Verlassen mittendrin verliert nichts', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/profil/neu');
  await waitForApp(page);
  await page.getByLabel('Fotos wählen').setInputFiles(await jpeg(page, '#2d9cdb'));
  await page.getByRole('button', { name: 'Posten' }).click();
  await page.getByRole('list', { name: 'Beiträge' }).getByRole('link').first().click();
  const like = page.getByRole('button', { name: 'Gefällt mir' });
  await expect(like).toHaveAttribute('aria-pressed', 'false');
  const slide = page.locator('li[aria-roledescription="slide"]').first();
  const box = await slide.boundingBox();
  if (!box) throw new Error('kein Foto');

  // Doppeltipp: Hecht ist zu sehen, der Daumen wechselt erst, wenn er ankommt
  await slide.dblclick({ position: { x: box.width * 0.7, y: box.height * 0.3 } });
  await expect.poll(() => pikeVisible(page)).toBe(true);
  await expect(like).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('1 „Gefällt mir“-Angabe')).toBeVisible();
  // danach ist die Ebene wieder leer, der Daumen bleibt gesetzt
  await expect.poll(() => pikeVisible(page), { timeout: 3000 }).toBe(false);
  await slide.dblclick();
  await page.waitForTimeout(1300);
  await expect(like).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByText('1 „Gefällt mir“-Angabe')).toBeVisible();
  // Knopf nimmt weiterhin zurück
  await like.click();
  await expect(like).toHaveAttribute('aria-pressed', 'false');

  // Wischen im Karussell ist kein Doppeltipp
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(1000);
  await expect(like).toHaveAttribute('aria-pressed', 'false');

  // Mitten in der Animation die Seite verlassen: „Gefällt mir“ wird trotzdem gesetzt
  const url = page.url();
  await slide.dblclick();
  await page
    .getByRole('link', { name: /Zurück/ })
    .first()
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Profil' })).toBeVisible();
  await page.goto(url);
  await waitForApp(page);
  await expect(page.getByRole('button', { name: 'Gefällt mir' })).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('PRF-10: Doppeltipp bei reduzierter Bewegung – kein Hecht, „Gefällt mir“ sofort', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/profil/neu');
  await waitForApp(page);
  await page.getByLabel('Fotos wählen').setInputFiles(await jpeg(page, '#2d9cdb'));
  await page.getByRole('button', { name: 'Posten' }).click();
  await page.getByRole('list', { name: 'Beiträge' }).getByRole('link').first().click();
  const like = page.getByRole('button', { name: 'Gefällt mir' });
  await page.locator('li[aria-roledescription="slide"]').first().dblclick();
  await expect(like).toHaveAttribute('aria-pressed', 'true', { timeout: 300 });
  expect(await pikeVisible(page)).toBe(false);
});
