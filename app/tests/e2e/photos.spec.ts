import { expect, test, type Page } from '@playwright/test';
import { useLocalExternals, waitForApp } from './helpers';

// Mit Service Worker: die Abnahme verlangt Erfassen offline und Neustart offline (CAT-2).

test.beforeEach(async ({ page }) => {
  await useLocalExternals(page);
});

/** EXIF-Block (APP1) mit GPS-Breite 51° 19' 34" N – so, wie ihn ein Handyfoto enthält. */
function exifWithGps(): Buffer {
  const tiff = Buffer.alloc(80);
  tiff.write('II', 0, 'ascii');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4); // IFD0
  tiff.writeUInt16LE(1, 8); // 1 Eintrag
  tiff.writeUInt16LE(0x8825, 10); // GPSInfo-Zeiger
  tiff.writeUInt16LE(4, 12); // LONG
  tiff.writeUInt32LE(1, 14);
  tiff.writeUInt32LE(26, 18); // GPS-IFD bei 26
  tiff.writeUInt32LE(0, 22); // kein weiteres IFD
  tiff.writeUInt16LE(2, 26); // 2 Einträge
  tiff.writeUInt16LE(0x0001, 28); // GPSLatitudeRef
  tiff.writeUInt16LE(2, 30); // ASCII
  tiff.writeUInt32LE(2, 32);
  tiff.write('N\0', 36, 'ascii');
  tiff.writeUInt16LE(0x0002, 40); // GPSLatitude
  tiff.writeUInt16LE(5, 42); // RATIONAL
  tiff.writeUInt32LE(3, 44);
  tiff.writeUInt32LE(56, 48);
  tiff.writeUInt32LE(0, 52);
  [51, 19, 34].forEach((v, i) => {
    tiff.writeUInt32LE(v, 56 + i * 8);
    tiff.writeUInt32LE(1, 60 + i * 8);
  });
  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'binary'), tiff]);
  const head = Buffer.from([0xff, 0xe1, 0, 0]);
  head.writeUInt16BE(payload.length + 2, 2);
  return Buffer.concat([head, payload]);
}

/** Großes JPEG (3000×2000) aus dem Browser, mit eingefügtem EXIF-GPS-Block. */
async function photoWithGps(page: Page): Promise<Buffer> {
  const bytes = await page.evaluate(async () => {
    const c = document.createElement('canvas');
    c.width = 3000;
    c.height = 2000;
    const ctx = c.getContext('2d');
    if (!ctx) throw new Error('kein Canvas');
    const g = ctx.createLinearGradient(0, 0, 3000, 2000);
    g.addColorStop(0, '#1f7a8c');
    g.addColorStop(1, '#f2994a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 3000, 2000);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.9));
    return Array.from(new Uint8Array(await (blob as Blob).arrayBuffer()));
  });
  const jpeg = Buffer.from(bytes);
  const out = Buffer.concat([jpeg.subarray(0, 2), exifWithGps(), jpeg.subarray(2)]);
  expect(out.includes(Buffer.from('Exif'))).toBe(true);
  return out;
}

/** Gespeicherte Fotos direkt aus IndexedDB (Größe, EXIF vorhanden?). */
function storedPhotos(page: Page) {
  return page.evaluate(async () => {
    const req = indexedDB.open('fangpunkt');
    const db = await new Promise<IDBDatabase>((r) => (req.onsuccess = () => r(req.result)));
    const rows = await new Promise<{ blob: Blob; width: number; height: number; ownerId: string }[]>((r) => {
      const q = db.transaction('photos').objectStore('photos').getAll();
      q.onsuccess = () => r(q.result as { blob: Blob; width: number; height: number; ownerId: string }[]);
    });
    const out = [];
    for (const p of rows) {
      const text = new TextDecoder('latin1').decode(new Uint8Array(await p.blob.arrayBuffer()));
      out.push({
        width: p.width,
        height: p.height,
        type: p.blob.type,
        hasExif: text.includes('Exif'),
        ownerId: p.ownerId,
      });
    }
    db.close();
    return out;
  });
}

async function openCatchForm(page: Page) {
  await page.waitForFunction(() => !!window.__fangpunktMap?.getLayer('fp-places'), null, { timeout: 30_000 });
  await page.getByRole('button', { name: 'Fang erfassen' }).click();
  const form = page.getByRole('dialog', { name: 'Fang oder Kontakt erfassen' });
  await expect(form).toBeVisible();
  return form;
}

test('CAT-2: Fang mit Foto komplett offline erfassen; nach Neustart vorhanden, Foto ohne EXIF/GPS', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await waitForApp(page);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await waitForApp(page);
  expect(await page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  const file = await photoWithGps(page);

  // Flugmodus: App neu starten, erfassen, Foto hinzufügen, speichern
  await context.setOffline(true);
  await page.reload();
  await waitForApp(page);
  const form = await openCatchForm(page);
  await form.getByLabel('Fischart').selectOption({ label: 'Hecht' });
  await form
    .getByLabel('Aus Galerie')
    .setInputFiles({ name: 'hecht.jpg', mimeType: 'image/jpeg', buffer: file });
  await expect(form.getByRole('img', { name: 'Foto 1' })).toBeVisible();
  await form.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByText('Fang gespeichert.')).toBeVisible();

  // Neustart weiterhin offline
  await page.reload();
  await waitForApp(page);
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Fangbuch' })
    .click();
  await page.getByRole('link', { name: /Fang · Hecht/ }).click();
  await page.getByRole('button', { name: 'Foto 1 groß anzeigen' }).click();
  const big = page.getByRole('dialog', { name: 'Foto 1' });
  await expect(big.getByRole('img', { name: 'Foto 1' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(big).toHaveCount(0);

  const photos = await storedPhotos(page);
  expect(photos).toHaveLength(1);
  expect(photos[0]).toMatchObject({ width: 1600, height: 1067, type: 'image/jpeg', hasExif: false });
  await context.setOffline(false);
});

test.describe('ohne Service Worker', () => {
  test.use({ serviceWorkers: 'block' });

  test('CAT-5: Speicher voll → verständliche Meldung, „Ohne Foto speichern" rettet den Eintrag', async ({
    page,
  }) => {
    // IndexedDB meldet beim Speichern von Fotos „Speicher voll"
    await page.addInitScript(() => {
      const add = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function (
        this: IDBObjectStore,
        ...args: Parameters<IDBObjectStore['add']>
      ) {
        if (this.name === 'photos') throw new DOMException('Speicher voll', 'QuotaExceededError');
        return add.apply(this, args);
      };
    });
    await page.goto('/');
    await waitForApp(page);
    const file = await photoWithGps(page);
    const form = await openCatchForm(page);
    await form
      .getByLabel('Aus Galerie')
      .setInputFiles({ name: 'a.jpg', mimeType: 'image/jpeg', buffer: file });
    await expect(form.getByRole('img', { name: 'Foto 1' })).toBeVisible();
    await form.getByRole('button', { name: 'Speichern' }).click();
    await expect(form.getByText('Der Speicher ist voll.')).toBeVisible();
    await form.getByRole('button', { name: 'Ohne Foto speichern' }).click();
    await expect(page.getByText('Fang gespeichert.')).toBeVisible();
    expect(await storedPhotos(page)).toHaveLength(0);
  });

  test('Fotos beim Bearbeiten hinzufügen und entfernen; unlesbare Datei wird erklärt', async ({ page }) => {
    await page.goto('/');
    await waitForApp(page);
    const file = await photoWithGps(page);
    const form = await openCatchForm(page);
    await form.getByLabel('Aus Galerie').setInputFiles([
      { name: 'a.jpg', mimeType: 'image/jpeg', buffer: file },
      { name: 'b.jpg', mimeType: 'image/jpeg', buffer: file },
    ]);
    await expect(form.getByRole('img', { name: 'Foto 2' })).toBeVisible();
    await form
      .getByLabel('Aus Galerie')
      .setInputFiles({ name: 'kaputt.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('kein Bild') });
    await expect(form.getByText(/Dieses Bild lässt sich nicht lesen/)).toBeVisible();
    await form.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByText('Fang gespeichert.')).toBeVisible();
    expect(await storedPhotos(page)).toHaveLength(2);

    await page
      .getByRole('navigation', { name: 'Hauptnavigation' })
      .getByRole('link', { name: 'Fangbuch' })
      .click();
    await page.getByRole('main').getByRole('list').getByRole('link').first().click();
    await page.getByRole('button', { name: 'Bearbeiten' }).click();
    await page.getByRole('button', { name: 'Foto 1 entfernen' }).click();
    await expect(page.getByRole('img', { name: 'Foto 2' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Speichern' }).click();
    await expect(page.getByRole('button', { name: 'Foto 1 groß anzeigen' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Foto 2 groß anzeigen' })).toHaveCount(0);
    expect(await storedPhotos(page)).toHaveLength(1);
  });
});
