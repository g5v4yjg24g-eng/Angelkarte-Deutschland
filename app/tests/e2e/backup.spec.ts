import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { legacyExport } from '../../src/test/fixtures/legacy-angelkarte-v2';
import { collectErrors, waitForApp, useLocalExternals } from './helpers';

test.use({ serviceWorkers: 'block' });

test.beforeEach(async ({ page }) => {
  await useLocalExternals(page);
});

const dir = mkdtempSync(join(tmpdir(), 'fangpunkt-e2e-'));
const legacyFile = join(dir, 'angelkarte-2026-10-18.json');
writeFileSync(legacyFile, JSON.stringify(legacyExport));

async function openBackup(page: Page) {
  await page.goto('/mehr');
  await waitForApp(page);
  await page.getByRole('link', { name: /Daten & Sicherung/ }).click();
  await expect(page.getByRole('heading', { name: 'Daten & Sicherung' })).toBeVisible();
}

async function importFile(page: Page, file: string) {
  await page.locator('input[type="file"]').setInputFiles(file);
}

test('Alt-App importieren, sichern, wieder einlesen, rückgängig machen', async ({ page }) => {
  const errors = collectErrors(page);
  await openBackup(page);
  await expect(page.getByText('0 Einträge im Fangbuch · 0 Orte · 0 Sessions · 0 Fotos')).toBeVisible();
  await expect(page.getByText('Noch keine Sicherung erstellt.')).toBeVisible();

  // BAK-7 Alt-App
  await importFile(page, legacyFile);
  const preview = page.getByRole('region', { name: 'Was würde importiert?' });
  await expect(preview).toBeVisible();
  await expect(preview.getByText('Sicherung der bisherigen Angelkarte-App erkannt.')).toBeVisible();
  await expect(preview.getByText('2 Datensätze sind ungültig und werden übersprungen')).toBeVisible();
  await expect(preview.getByRole('row', { name: /Fangbuch/ })).toContainText('3');
  expect(
    await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze()
      .then((r) =>
        r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => v.id),
      ),
  ).toEqual([]);
  await preview.getByRole('button', { name: '7 Datensätze importieren' }).click();
  await expect(page.getByText(/^7 Datensätze importiert/)).toBeVisible();
  await expect(page.getByText('3 Einträge im Fangbuch · 2 Orte · 1 Sessions · 1 Fotos')).toBeVisible();

  // BAK-6: Erinnerung erscheint auf anderen Seiten (6 ungesicherte Änderungen) und lässt sich vertagen
  await page
    .getByRole('navigation', { name: 'Hauptnavigation' })
    .getByRole('link', { name: 'Fangbuch' })
    .click();
  // Fangbuch zeigt die importierten Einträge der Alt-App
  await expect(page.getByText('3 Einträge', { exact: true })).toBeVisible();
  const reminder = page.getByText('6 Änderungen sind noch nicht gesichert.');
  await expect(reminder).toBeVisible();
  await page.getByRole('button', { name: 'Später' }).click();
  await expect(reminder).toHaveCount(0);
  await openBackup(page);

  // BAK-1: ZIP mit Fotos sichern
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Sicherung mit Fotos (.zip)' }).click(),
  ]);
  expect(download.suggestedFilename()).toMatch(/^fangpunkt-sicherung-\d{4}-\d{2}-\d{2}\.zip$/);
  const zipPath = join(dir, download.suggestedFilename());
  await download.saveAs(zipPath);
  await expect(page.getByText(/^Letzte Sicherung: /)).toBeVisible();

  // Dieselbe Datei erneut: nichts zu tun
  await importFile(page, zipPath);
  await expect(page.getByText('Alles aus dieser Datei ist bereits auf dem Gerät.')).toBeVisible();
  await page.getByRole('button', { name: 'Abbrechen' }).click();

  // BAK-2: manipulierte Datei → Fehlermeldung, keine Änderung
  const tampered = join(dir, 'kaputt.json');
  writeFileSync(tampered, '{"format":"fangpunkt-backup","formatVersion":1}');
  await importFile(page, tampered);
  await expect(page.getByRole('alert')).toContainText('beschädigt');

  // Rückgängig: Stand vor dem letzten Import (leer)
  page.once('dialog', (d) => void d.accept());
  await page.getByRole('button', { name: 'Stand vor dem Import wiederherstellen' }).click();
  await expect(page.getByText('Der Stand vor dem Import wurde wiederhergestellt.')).toBeVisible();
  await expect(page.getByText('0 Einträge im Fangbuch · 0 Orte · 0 Sessions · 0 Fotos')).toBeVisible();

  // Und aus der ZIP-Sicherung wiederherstellen, inklusive Foto
  await importFile(page, zipPath);
  await page.getByRole('button', { name: /Datensätze importieren/ }).click();
  await expect(page.getByText('3 Einträge im Fangbuch · 2 Orte · 1 Sessions · 1 Fotos')).toBeVisible();

  expect(readFileSync(zipPath).subarray(0, 2).toString()).toBe('PK');
  expect(errors).toEqual([]);
});

test('Daten überstehen einen Neustart der App', async ({ page }) => {
  await openBackup(page);
  await importFile(page, legacyFile);
  await page.getByRole('button', { name: /Datensätze importieren/ }).click();
  await expect(page.getByText('3 Einträge im Fangbuch · 2 Orte · 1 Sessions · 1 Fotos')).toBeVisible();
  await page.reload();
  await waitForApp(page);
  await expect(page.getByText('3 Einträge im Fangbuch · 2 Orte · 1 Sessions · 1 Fotos')).toBeVisible();
});
