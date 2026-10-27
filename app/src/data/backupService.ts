// Export, Import und Snapshots. Import schreibt in EINER Transaktion: entweder alles oder nichts (TEST_PLAN BAK-4).
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { buildBackup, photoFileName, type BackupData, type BackupFile } from '../domain/backup/format';
import { BackupError, MAX_BACKUP_BYTES, parseBackupText, type ParsedBackup } from '../domain/backup/parse';
import {
  planImport,
  PLAN_TABLES,
  selectWrites,
  type ImportPlan,
  type ImportStrategy,
  type PlanTable,
} from '../domain/backup/plan';
import type { Photo, PhotoMeta } from '../domain/schemas';
import { nowIso } from '../domain/time';
import { getDb, SCHEMA_VERSION, type FangpunktDB, type SnapshotRow } from './db';
import { setSetting } from './settings';
import { newId } from '../domain/id';

const SNAPSHOTS_KEPT = 2;

async function collect(
  db: FangpunktDB,
  withPhotos: boolean,
): Promise<{ data: BackupData; blobs: Record<string, Blob> }> {
  const [
    catches,
    places,
    sessions,
    baitPresets,
    trips,
    tracks,
    waterLinks,
    profiles,
    posts,
    postLikes,
    postComments,
    photos,
  ] = await Promise.all([
    db.catches.toArray(),
    db.places.toArray(),
    db.sessions.toArray(),
    db.baitPresets.toArray(),
    db.trips.toArray(),
    db.tracks.toArray(),
    db.waterLinks.toArray(),
    db.profiles.toArray(),
    db.posts.toArray(),
    db.postLikes.toArray(),
    db.postComments.toArray(),
    withPhotos ? db.photos.toArray() : Promise.resolve([] as Photo[]),
  ]);
  const blobs: Record<string, Blob> = {};
  const metas: PhotoMeta[] = photos.map(({ blob, thumb: _t, ...meta }) => {
    void _t;
    blobs[meta.id] = blob;
    return meta;
  });
  return {
    data: {
      catches,
      places,
      sessions,
      baitPresets,
      trips,
      tracks,
      waterLinks,
      profiles,
      posts,
      postLikes,
      postComments,
      photos: metas,
    },
    blobs,
  };
}

export interface ExportResult {
  blob: Blob;
  fileName: string;
  backup: BackupFile;
}

/** Erstellt eine Sicherungsdatei. Mit Fotos als ZIP (backup.json + photos/…), sonst als JSON. */
export async function exportBackup(
  { withPhotos }: { withPhotos: boolean },
  db: FangpunktDB = getDb(),
): Promise<ExportResult> {
  const { data, blobs } = await collect(db, withPhotos);
  const exportedAt = nowIso();
  const backup = await buildBackup(data, {
    appVersion: __APP_VERSION__,
    exportedAt,
    schemaVersion: SCHEMA_VERSION,
    withPhotos,
  });
  const json = JSON.stringify(backup, null, 1);
  const stamp = exportedAt.slice(0, 10);
  let blob: Blob, fileName: string;
  if (withPhotos) {
    const files: Record<string, Uint8Array> = { 'backup.json': strToU8(json) };
    for (const p of data.photos) {
      const b = blobs[p.id];
      // Bilder sind bereits komprimiert: nur speichern, nicht erneut packen
      if (b) files[photoFileName(p)] = new Uint8Array(await b.arrayBuffer());
    }
    blob = new Blob([zipSync(files, { level: 0 })], { type: 'application/zip' });
    fileName = `fangpunkt-sicherung-${stamp}.zip`;
  } else {
    blob = new Blob([json], { type: 'application/json' });
    fileName = `fangpunkt-sicherung-${stamp}.json`;
  }
  await setSetting('lastBackupAt', exportedAt, db);
  return { blob, fileName, backup };
}

export interface ReadBackup {
  parsed: ParsedBackup;
  /** Foto-ID → Bilddaten (aus ZIP oder Alt-App). */
  photoBlobs: Map<string, Blob>;
}

/** Datei (JSON oder ZIP) lesen und vollständig prüfen. Wirft BackupError mit verständlicher Meldung. */
export async function readBackupFile(file: Blob): Promise<ReadBackup> {
  if (file.size > MAX_BACKUP_BYTES)
    throw new BackupError('Die Datei ist größer als 500 MB und wird nicht importiert.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b;
  let text: string;
  let zipFiles: Record<string, Uint8Array> = {};
  if (isZip) {
    try {
      zipFiles = unzipSync(bytes);
    } catch {
      throw new BackupError('Das ZIP-Archiv ist beschädigt.');
    }
    const json = zipFiles['backup.json'];
    if (!json) throw new BackupError('Im ZIP-Archiv fehlt backup.json.');
    text = strFromU8(json);
  } else {
    text = new TextDecoder().decode(bytes);
  }
  const parsed = await parseBackupText(text);
  const photoBlobs = new Map<string, Blob>();
  for (const p of parsed.records.photos) {
    const f = zipFiles[photoFileName(p)];
    if (f) photoBlobs.set(p.id, new Blob([f as Uint8Array<ArrayBuffer>], { type: p.mime }));
  }
  // Alt-App: Fotos lagen als DataURL im Eintrag
  for (const lp of parsed.legacyPhotos) {
    const owner = parsed.records.catches.find((c) => c.id === lp.ownerId);
    const at = owner?.updatedAt ?? nowIso();
    parsed.records.photos.push({
      id: lp.id,
      createdAt: owner?.createdAt ?? at,
      updatedAt: at,
      rev: 0,
      mime: lp.mime,
      bytes: lp.bytes.byteLength,
      ownerType: 'catch',
      ownerId: lp.ownerId,
    });
    photoBlobs.set(lp.id, new Blob([lp.bytes as Uint8Array<ArrayBuffer>], { type: lp.mime }));
  }
  // Fotos ohne Bilddaten (Sicherung „ohne Fotos") werden nicht als leere Einträge angelegt
  const missing = parsed.records.photos.filter((p) => !photoBlobs.has(p.id)).length;
  parsed.records.photos = parsed.records.photos.filter((p) => photoBlobs.has(p.id));
  if (missing) parsed.notes.push(`${missing} Fotos sind in dieser Sicherung nicht enthalten.`);
  return { parsed, photoBlobs };
}

export async function prepareImport(read: ReadBackup, db: FangpunktDB = getDb()): Promise<ImportPlan> {
  const existing = {} as Record<PlanTable, Map<string, { id: string; updatedAt: string }>>;
  for (const table of PLAN_TABLES) {
    const ids = (read.parsed.records[table] as { id: string }[]).map((r) => r.id);
    const rows = await db.table(table).bulkGet(ids);
    existing[table] = new Map(
      rows.filter(Boolean).map((r) => {
        const row = r as { id: string; updatedAt: string; blob?: Blob; thumb?: Blob };
        // Fotos über die Metadaten vergleichen, nicht über die Bilddaten
        const { blob: _b, thumb: _t, ...meta } = row;
        void _b;
        void _t;
        return [row.id, table === 'photos' ? meta : row];
      }),
    );
  }
  return planImport(read.parsed.records, existing);
}

export interface ImportResult {
  written: number;
  snapshotId: string;
}

export async function applyImport(
  read: ReadBackup,
  plan: ImportPlan,
  strategy: ImportStrategy,
  db: FangpunktDB = getDb(),
  /** Nur für Tests: Fehler mitten im Schreiben simulieren. */
  faultInjection?: () => void,
): Promise<ImportResult> {
  const writes = selectWrites(plan, strategy);
  const snapshotId = await createSnapshot('before-import', db);
  let written = 0;
  await db.transaction(
    'rw',
    [
      db.sessions,
      db.places,
      db.baitPresets,
      db.catches,
      db.trips,
      db.tracks,
      db.waterLinks,
      db.profiles,
      db.posts,
      db.postLikes,
      db.postComments,
      db.photos,
    ],
    async () => {
      for (const table of PLAN_TABLES) {
        let rows = writes[table] as object[];
        if (table === 'photos')
          rows = (rows as PhotoMeta[])
            .map((m) => ({ ...m, blob: read.photoBlobs.get(m.id) }))
            .filter((p) => p.blob);
        await db.table(table).bulkPut(rows);
        written += rows.length;
        faultInjection?.();
      }
    },
  );
  return { written, snapshotId };
}

/** Kompletter Datenstand inkl. Fotos; die ältesten über SNAPSHOTS_KEPT werden gelöscht. */
export async function createSnapshot(
  reason: SnapshotRow['reason'],
  db: FangpunktDB = getDb(),
): Promise<string> {
  const { data, blobs } = await collect(db, true);
  const createdAt = nowIso();
  const backup = await buildBackup(data, {
    appVersion: __APP_VERSION__,
    exportedAt: createdAt,
    schemaVersion: SCHEMA_VERSION,
    withPhotos: true,
  });
  const id = newId();
  await db.transaction('rw', db.snapshots, async () => {
    await db.snapshots.add({ id, createdAt, reason, backup, photoBlobs: blobs });
    const all = await db.snapshots.orderBy('createdAt').toArray();
    await db.snapshots.bulkDelete(all.slice(0, Math.max(0, all.length - SNAPSHOTS_KEPT)).map((s) => s.id));
  });
  return id;
}

export async function latestSnapshot(db: FangpunktDB = getDb()) {
  return db.snapshots.orderBy('createdAt').last();
}

/** Stellt einen Snapshot vollständig wieder her (ersetzt alle Nutzerdaten). */
export async function restoreSnapshot(id: string, db: FangpunktDB = getDb()): Promise<void> {
  const snap = await db.snapshots.get(id);
  if (!snap) throw new BackupError('Diese automatische Sicherung existiert nicht mehr.');
  const d = snap.backup.data;
  await db.transaction(
    'rw',
    [
      db.sessions,
      db.places,
      db.baitPresets,
      db.catches,
      db.trips,
      db.tracks,
      db.waterLinks,
      db.profiles,
      db.posts,
      db.postLikes,
      db.postComments,
      db.photos,
    ],
    async () => {
      await Promise.all([
        db.sessions.clear(),
        db.places.clear(),
        db.baitPresets.clear(),
        db.catches.clear(),
        db.trips.clear(),
        db.tracks.clear(),
        db.waterLinks.clear(),
        db.profiles.clear(),
        db.posts.clear(),
        db.postLikes.clear(),
        db.postComments.clear(),
        db.photos.clear(),
      ]);
      await db.sessions.bulkPut(d.sessions);
      await db.places.bulkPut(d.places);
      await db.baitPresets.bulkPut(d.baitPresets);
      await db.catches.bulkPut(d.catches);
      // Snapshots vor DB v2 haben keine Termine
      await db.trips.bulkPut(d.trips ?? []);
      // Snapshots vor DB v3 haben keine Routen
      await db.tracks.bulkPut(d.tracks ?? []);
      // Snapshots vor DB v4 haben keine eigenen Gewässer-Links
      await db.waterLinks.bulkPut(d.waterLinks ?? []);
      // Snapshots vor DB v5 haben kein Profil und keine Beiträge
      await db.profiles.bulkPut(d.profiles ?? []);
      await db.posts.bulkPut(d.posts ?? []);
      // Snapshots vor DB v6 haben keine Likes und Kommentare
      await db.postLikes.bulkPut(d.postLikes ?? []);
      await db.postComments.bulkPut(d.postComments ?? []);
      await db.photos.bulkPut(
        d.photos.flatMap((m) =>
          snap.photoBlobs[m.id] ? [{ ...m, blob: snap.photoBlobs[m.id] as Blob }] : [],
        ),
      );
    },
  );
}

export { changesSince } from './changes';
