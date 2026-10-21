// @vitest-environment node
import { strToU8, unzipSync, zipSync, strFromU8 } from 'fflate';
import { describe, expect, it } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import { legacyExport } from '../test/fixtures/legacy-angelkarte-v2';
import type { FangpunktDB } from './db';
import { repo } from './repository';
import {
  applyImport,
  changesSince,
  exportBackup,
  latestSnapshot,
  prepareImport,
  readBackupFile,
  restoreSnapshot,
} from './backupService';
import { summarize } from '../domain/backup/plan';
import { BackupError } from '../domain/backup/parse';
import { getSetting } from './settings';

const at = '2026-06-14T07:10:00+02:00';
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4, 0xff, 0xd9]);

async function seed(db: FangpunktDB) {
  const session = await repo('sessions', db).create({
    startAt: at,
    endAt: '2026-06-14T10:00:00+02:00',
    tz: 'Europe/Berlin',
  });
  const place = await repo('places', db).create({
    type: 'jetty',
    name: 'Steg',
    position: { lat: 51.3, lng: 6.2, source: 'gps' },
  });
  const preset = await repo('baitPresets', db).create({
    label: 'Shad 12',
    bait: { type: 'softbait', sizeCm: 12 },
  });
  const c = await repo('catches', db).create({
    outcome: 'caught',
    at,
    tz: 'Europe/Berlin',
    sessionId: session.id,
    placeId: place.id,
    speciesId: 'pike',
    lengthCm: 68,
    lengthMethod: 'measured',
    notes: 'Umlaute äöüß – „Anführungszeichen"',
  });
  await db.photos.add({
    id: 'foto-1',
    createdAt: at,
    updatedAt: at,
    rev: 0,
    mime: 'image/jpeg',
    bytes: jpeg.length,
    ownerType: 'catch',
    ownerId: c.id,
    blob: new Blob([jpeg], { type: 'image/jpeg' }),
  });
  await repo('catches', db).update(c.id, { photoIds: ['foto-1'] });
  return { session, place, preset, c };
}

async function dump(db: FangpunktDB) {
  const photos = await Promise.all(
    (await db.photos.toArray()).map(async ({ blob, ...m }) => ({
      ...m,
      bytes: [...new Uint8Array(await blob.arrayBuffer())],
    })),
  );
  return {
    catches: await db.catches.toArray(),
    places: await db.places.toArray(),
    sessions: await db.sessions.toArray(),
    baitPresets: await db.baitPresets.toArray(),
    photos,
  };
}

async function importFile(
  file: Blob,
  db: FangpunktDB,
  strategy: 'keepNewer' | 'fileWins' | 'onlyNew' = 'keepNewer',
) {
  const read = await readBackupFile(file);
  const plan = await prepareImport(read, db);
  return { read, plan, result: await applyImport(read, plan, strategy, db) };
}

describe('BAK-1: Export → leeres Gerät → Import ergibt dieselben Daten', () => {
  it('ZIP mit Fotos', async () => {
    const a = freshDb();
    await seed(a);
    const exp = await exportBackup({ withPhotos: true }, a);
    expect(exp.fileName).toMatch(/^fangpunkt-sicherung-\d{4}-\d{2}-\d{2}\.zip$/);
    expect(await getSetting('lastBackupAt', a)).toBe(exp.backup.exportedAt);

    const b = freshDb();
    const { plan } = await importFile(exp.blob, b);
    expect(summarize(plan)).toMatchObject({ added: 5, conflicts: 0 });
    expect(await dump(b)).toEqual(await dump(a));
  });

  it('JSON ohne Fotos: Daten identisch, Foto fehlt mit Hinweis', async () => {
    const a = freshDb();
    await seed(a);
    const exp = await exportBackup({ withPhotos: false }, a);
    const b = freshDb();
    const { read } = await importFile(exp.blob, b);
    const [da, db] = [await dump(a), await dump(b)];
    expect(db.catches).toEqual(da.catches);
    expect(db.photos).toEqual([]);
    expect(read.parsed.photosIncluded).toBe(false);
  });

  it('zweiter Import derselben Datei ändert nichts', async () => {
    const a = freshDb();
    await seed(a);
    const exp = await exportBackup({ withPhotos: true }, a);
    const { plan } = await importFile(exp.blob, a);
    expect(summarize(plan)).toMatchObject({ added: 0, identical: 5, conflicts: 0 });
  });
});

describe('BAK-2: Kaputte oder fremde Dateien werden abgelehnt, ohne Daten zu ändern', () => {
  const cases: [string, () => Promise<Blob>, RegExp][] = [
    ['leer', async () => new Blob(['']), /leer/],
    ['kein JSON', async () => new Blob(['{nicht json']), /kein lesbares JSON/],
    ['fremdes Format', async () => new Blob([JSON.stringify({ hallo: 1 })]), /Unbekanntes Dateiformat/],
    ['ZIP ohne backup.json', async () => new Blob([zipSync({ 'x.txt': strToU8('x') })]), /fehlt backup.json/],
    ['beschädigtes ZIP', async () => new Blob([new Uint8Array([0x50, 0x4b, 3, 4, 9, 9, 9])]), /beschädigt/],
    [
      'manipulierte Daten (Prüfsumme)',
      async () => {
        const a = freshDb();
        await seed(a);
        const exp = await exportBackup({ withPhotos: false }, a);
        const j = JSON.parse(await exp.blob.text());
        j.data.catches[0].lengthCm = 120;
        return new Blob([JSON.stringify(j)]);
      },
      /Prüfsumme/,
    ],
    [
      'neueres Format',
      async () => {
        const a = freshDb();
        const exp = await exportBackup({ withPhotos: false }, a);
        const j = JSON.parse(await exp.blob.text());
        j.formatVersion = 99;
        return new Blob([JSON.stringify(j)]);
      },
      /neueren Fangpunkt-Version/,
    ],
  ];
  for (const [name, make, msg] of cases) {
    it(name, async () => {
      const db = freshDb();
      await seed(db);
      const before = await dump(db);
      const err = await readBackupFile(await make()).catch((e) => e);
      expect(err).toBeInstanceOf(BackupError);
      expect(err.message).toMatch(msg);
      expect(await dump(db)).toEqual(before);
    });
  }

  it('einzelne ungültige Datensätze werden übersprungen und gemeldet', async () => {
    const a = freshDb();
    await seed(a);
    const exp = await exportBackup({ withPhotos: false }, a);
    const j = JSON.parse(await exp.blob.text());
    j.data.places.push({ id: 'x', type: 'ufo' });
    // Prüfsumme passend neu berechnen, damit nur der Datensatz ungültig ist
    const { checksumOf } = await import('../domain/backup/format');
    j.checksum = await checksumOf(j.data);
    const read = await readBackupFile(new Blob([JSON.stringify(j)]));
    expect(read.parsed.invalid).toHaveLength(1);
    expect(read.parsed.invalid[0]).toMatchObject({ table: 'places', id: 'x' });
    expect(read.parsed.records.places).toHaveLength(1);
  });
});

describe('BAK-3: Konflikte und Strategien', () => {
  async function setup() {
    const device = freshDb();
    const { place, preset } = await seed(device);
    const exp = await exportBackup({ withPhotos: true }, device);
    // Danach auf dem Gerät: Steg geändert (Gerät neuer)
    await repo('places', device).update(place.id, { name: 'Steg (Gerät)' });
    // In der Datei: Köder-Favorit neuer als auf dem Gerät
    const zip = unzipSync(new Uint8Array(await exp.blob.arrayBuffer()));
    const j = JSON.parse(strFromU8(zip['backup.json'] as Uint8Array));
    const bp = j.data.baitPresets.find((x: { id: string }) => x.id === preset.id);
    bp.label = 'Shad 12 (Datei)';
    bp.updatedAt = '2030-01-01T00:00:00+01:00';
    j.data.places.push({ ...j.data.places[0], id: 'neu-aus-datei', name: 'Neuer Platz' });
    const { checksumOf } = await import('../domain/backup/format');
    j.checksum = await checksumOf(j.data);
    zip['backup.json'] = strToU8(JSON.stringify(j));
    return { device, file: new Blob([zipSync(zip)]), place, preset };
  }

  it('Vorschau zählt neu, identisch und Konflikte', async () => {
    const { device, file } = await setup();
    const plan = await prepareImport(await readBackupFile(file), device);
    expect(summarize(plan)).toEqual({
      added: 1,
      identical: 3,
      incomingNewer: 1,
      existingNewer: 1,
      conflicts: 2,
    });
  });

  it('„Neuere behalten" (Standard)', async () => {
    const { device, file, place, preset } = await setup();
    await importFile(file, device, 'keepNewer');
    expect((await device.places.get(place.id))?.name).toBe('Steg (Gerät)');
    expect((await device.baitPresets.get(preset.id))?.label).toBe('Shad 12 (Datei)');
    expect(await device.places.get('neu-aus-datei')).toBeTruthy();
  });

  it('„Datei gewinnt"', async () => {
    const { device, file, place } = await setup();
    await importFile(file, device, 'fileWins');
    expect((await device.places.get(place.id))?.name).toBe('Steg');
  });

  it('„Nur neue hinzufügen"', async () => {
    const { device, file, place, preset } = await setup();
    await importFile(file, device, 'onlyNew');
    expect((await device.places.get(place.id))?.name).toBe('Steg (Gerät)');
    expect((await device.baitPresets.get(preset.id))?.label).toBe('Shad 12');
    expect(await device.places.get('neu-aus-datei')).toBeTruthy();
  });
});

describe('BAK-4: Abbruch mitten im Import', () => {
  it('rollt alles zurück und behält einen Snapshot', async () => {
    const src = freshDb();
    await seed(src);
    const exp = await exportBackup({ withPhotos: true }, src);
    const db = freshDb();
    const keep = await repo('places', db).create({
      type: 'spot',
      position: { lat: 1, lng: 1, source: 'gps' },
    });
    const before = await dump(db);
    const read = await readBackupFile(exp.blob);
    const plan = await prepareImport(read, db);
    let calls = 0;
    await expect(
      applyImport(read, plan, 'keepNewer', db, () => {
        if (++calls === 3) throw new Error('Stromausfall');
      }),
    ).rejects.toThrow('Stromausfall');
    expect(await dump(db)).toEqual(before);
    expect(await latestSnapshot(db)).toBeTruthy();
    expect(await db.places.get(keep.id)).toBeTruthy();
  });

  it('Snapshot stellt den Stand vor dem Import wieder her', async () => {
    const src = freshDb();
    await seed(src);
    const exp = await exportBackup({ withPhotos: true }, src);
    const db = freshDb();
    await repo('places', db).create({
      type: 'spot',
      name: 'Vorher',
      position: { lat: 1, lng: 1, source: 'gps' },
    });
    const before = await dump(db);
    const { result } = await importFile(exp.blob, db);
    expect((await dump(db)).catches).toHaveLength(1);
    await restoreSnapshot(result.snapshotId, db);
    expect(await dump(db)).toEqual(before);
  });

  it('hält höchstens 2 Snapshots', async () => {
    const src = freshDb();
    await seed(src);
    const exp = await exportBackup({ withPhotos: false }, src);
    const db = freshDb();
    for (let i = 0; i < 4; i++) await importFile(exp.blob, db);
    expect(await db.snapshots.count()).toBe(2);
  });
});

describe('BAK-5: Große Sicherungen', () => {
  it('10 000 Einträge in unter 10 s', async () => {
    const src = freshDb();
    const rows = Array.from({ length: 10_000 }, (_, i) => ({
      id: `c-${i}`,
      createdAt: at,
      updatedAt: at,
      rev: 0,
      outcome: 'caught' as const,
      at,
      tz: 'Europe/Berlin',
      speciesId: 'perch',
      notes: `Eintrag ${i}`,
    }));
    await src.catches.bulkAdd(rows);
    const t0 = performance.now();
    const exp = await exportBackup({ withPhotos: false }, src);
    const db = freshDb();
    await importFile(exp.blob, db);
    expect(await db.catches.count()).toBe(10_000);
    expect(performance.now() - t0).toBeLessThan(10_000);
  }, 20_000);
});

describe('BAK-7: Alt-App-Sicherung über den normalen Import', () => {
  it('importiert Fänge, Fotos, Sessions und Orte und meldet Ungültiges', async () => {
    const db = freshDb();
    const { read, plan } = await importFile(new Blob([JSON.stringify(legacyExport)]), db);
    expect(read.parsed.kind).toBe('legacy');
    expect(read.parsed.invalid).toHaveLength(2);
    expect(summarize(plan).added).toBe(3 + 1 + 2 + 1);
    expect(await db.catches.count()).toBe(3);
    expect(await db.places.count()).toBe(2);
    expect(await db.sessions.count()).toBe(1);
    const photo = await db.photos.get('6f1d3c1e-0a6b-4b51-9a2b-111111111111-photo');
    expect(photo?.mime).toBe('image/jpeg');
    expect(photo?.blob.size).toBeGreaterThan(100);
  });
});

describe('Änderungen seit der letzten Sicherung', () => {
  it('zählt neue und geänderte Datensätze', async () => {
    const db = freshDb();
    await seed(db);
    expect((await changesSince(undefined, db)).count).toBe(4);
    const exp = await exportBackup({ withPhotos: false }, db);
    expect((await changesSince(exp.backup.exportedAt, db)).count).toBe(0);
  });
});
