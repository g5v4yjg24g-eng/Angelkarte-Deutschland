// Cloud-Sicherung (BACKUP_PLAN.md, Etappe 2): reine Logik ohne Netz und Datenbank.
// Plan: was ist neu, geändert oder gelöscht (→ backup_put), wohin kommt welche Datei, und wie wird eine
// heruntergeladene Sicherung wieder in Datensätze verwandelt (→ bestehender Import mit Vorschau).
import { z } from 'zod';
import { ENTITY_SCHEMAS, PhotoMetaSchema, TrackPointSchema, type EntityTable } from './schemas';
import { photoExt, photoPath } from './postSync';
import { emptyRecords, type InvalidRecord, type Records } from './backup/parse';

/** Zeilenart in `backup_items.kind` je Tabelle (a–z und _, Server prüft nur dieses Muster) */
export const KIND_OF_TABLE = {
  sessions: 'session',
  places: 'place',
  baitPresets: 'bait_preset',
  catches: 'catch',
  trips: 'trip',
  tracks: 'track',
  waterLinks: 'water_link',
  waterRules: 'water_rule',
  papers: 'paper',
  profiles: 'profile',
  posts: 'post',
  postLikes: 'post_like',
  postComments: 'post_comment',
  photos: 'photo',
} as const satisfies Record<EntityTable | 'photos', string>;
export type BackupTable = keyof typeof KIND_OF_TABLE;
export type BackupKind = (typeof KIND_OF_TABLE)[BackupTable];

const TABLE_OF_KIND = Object.fromEntries(
  (Object.entries(KIND_OF_TABLE) as [BackupTable, string][]).map(([t, k]) => [k, t]),
) as Record<string, BackupTable>;
export const tableOfKind = (kind: string): BackupTable | undefined => TABLE_OF_KIND[kind];

/** Grenzen des Servers (supabase/migrations/*_cloud_backup.sql) */
export const MAX_ITEM_BYTES = 65_536;
export const MAX_ITEMS_PER_CALL = 200;
export const QUOTA_BYTES = 524_288_000;

const keyOf = (kind: string, id: string) => `${kind}:${id}`;

// ---------------------------------------------------------------------------------------------------------------------
// Hochladen
// ---------------------------------------------------------------------------------------------------------------------

export interface PlannedFile {
  /** woher die Bytes kommen: Foto (Blob) oder Route (JSON mit den Segmenten) */
  source: { table: 'photos' | 'tracks'; id: string };
  /** `backups` = eigene Datei hochladen; `post-photos` = Verweis auf das Beitragsfoto, nichts hochladen */
  ref: 'backups' | 'post-photos';
  path: string;
  contentType: string;
}

export interface PlannedItem {
  kind: BackupKind;
  itemId: string;
  /** Vergleichswert: ändert er sich, wird der Eintrag neu geschrieben */
  fingerprint: string;
  data: Record<string, unknown>;
  file?: PlannedFile | undefined;
}

export interface DeviceBackupState {
  /** zuletzt geschriebener Vergleichswert je `<kind>:<id>` */
  uploaded: Record<string, string>;
  /** Pfad der eigenen Datei in `backups` je `<kind>:<id>` (nur wenn es eine gibt) */
  files: Record<string, string>;
}
export const emptyDeviceState = (): DeviceBackupState => ({ uploaded: {}, files: {} });

export interface BackupPlan {
  upserts: PlannedItem[];
  /** Einträge, die lokal nicht mehr vorkommen → Löschmarke auf dem Server */
  deletes: { kind: BackupKind; itemId: string }[];
  /** eigene Dateien im Speicher `backups`, die nicht mehr gebraucht werden (gelöschte Einträge, jetzt verwiesene Fotos) */
  removeFiles: string[];
  /** nicht gesichert, mit Grund (zu groß); erscheint in der Anzeige, bricht nichts ab */
  skipped: { kind: BackupKind; itemId: string; reason: 'too_large' }[];
  unchanged: number;
}

export interface PlanInput {
  userId: string;
  records: Records;
  /** SHA-256 der Foto-Bytes je Foto-ID (Foto-Dateien ändern sich nie); fehlt ein Wert, wird nicht nach Dopplungen gesucht */
  photoHashes: Record<string, string>;
  state: DeviceBackupState;
}

const toJson = (v: unknown): Record<string, unknown> => JSON.parse(JSON.stringify(v)) as Record<string, unknown>;
const byteLength = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;

/** Wo ein Foto liegt: als Verweis auf das Beitragsfoto (schon auf dem Server) oder als eigene Datei in `backups` */
function fileForPhoto(
  photo: Records['photos'][number],
  userId: string,
  ownPath: (p: Records['photos'][number]) => string,
  postPhotoByHash: Map<string, string>,
  ownPostPhotoPath: Map<string, string>,
  hashes: Record<string, string>,
): PlannedFile {
  const source = { table: 'photos' as const, id: photo.id };
  const direct = ownPostPhotoPath.get(photo.id);
  const hash = hashes[photo.id];
  const shared = direct ?? (hash ? postPhotoByHash.get(hash) : undefined);
  if (shared) return { source, ref: 'post-photos', path: shared, contentType: photo.mime };
  void userId;
  return { source, ref: 'backups', path: ownPath(photo), contentType: photo.mime };
}

/** Eigene Kopie eines Fotos in `backups` – Rückfall, falls die verwiesene Beitragsdatei fehlt (Beitrag gelöscht) */
export function ownCopyOf(item: PlannedItem, userId: string): PlannedItem {
  if (!item.file || item.file.source.table !== 'photos') return item;
  const mime = item.file.contentType;
  const path = `${userId}/photos/${item.itemId}.${photoExt(mime)}`;
  return {
    ...item,
    fingerprint: `${item.fingerprint.split('|')[0]}|backups|${path}`,
    file: { ...item.file, ref: 'backups', path },
  };
}

export function planBackup(input: PlanInput): BackupPlan {
  const { userId, records, photoHashes, state } = input;
  const plan: BackupPlan = { upserts: [], deletes: [], removeFiles: [], skipped: [], unchanged: 0 };

  // Beitragsfotos, die schon auf dem Server liegen (Beitrag geteilt und von diesem Konto hochgeladen)
  const photoById = new Map(records.photos.map((p) => [p.id, p]));
  const ownPostPhotoPath = new Map<string, string>();
  const postPhotoByHash = new Map<string, string>();
  for (const post of records.posts) {
    if (post.share !== 'shared' || post.accountId !== userId || post.deletedAt) continue;
    for (const [i, photoId] of post.photoIds.entries()) {
      const photo = photoById.get(photoId);
      if (!photo) continue;
      const path = photoPath(userId, post.id, i, photo.mime);
      ownPostPhotoPath.set(photoId, path);
      const hash = photoHashes[photoId];
      if (hash && !postPhotoByHash.has(hash)) postPhotoByHash.set(hash, path);
    }
  }
  const ownPath = (p: Records['photos'][number]) => `${userId}/photos/${p.id}.${photoExt(p.mime)}`;

  const seen = new Set<string>();
  const consider = (item: PlannedItem) => {
    const key = keyOf(item.kind, item.itemId);
    seen.add(key);
    if (byteLength(item.data) > MAX_ITEM_BYTES) {
      plan.skipped.push({ kind: item.kind, itemId: item.itemId, reason: 'too_large' });
      return;
    }
    if (state.uploaded[key] === item.fingerprint) {
      plan.unchanged++;
      return;
    }
    plan.upserts.push(item);
    // eine frühere eigene Datei, die nun nicht mehr gebraucht wird (Verweis statt Kopie, anderer Pfad)
    const before = state.files[key];
    if (before && !(item.file?.ref === 'backups' && item.file.path === before)) plan.removeFiles.push(before);
  };

  for (const table of Object.keys(KIND_OF_TABLE) as BackupTable[]) {
    const kind = KIND_OF_TABLE[table];
    if (table === 'photos') {
      for (const p of records.photos) {
        const file = fileForPhoto(p, userId, ownPath, postPhotoByHash, ownPostPhotoPath, photoHashes);
        consider({
          kind,
          itemId: p.id,
          fingerprint: `${p.bytes}|${file.ref}|${file.path}`,
          data: toJson(p),
          file,
        });
      }
    } else if (table === 'tracks') {
      for (const tr of records.tracks) {
        const { segments: _s, ...meta } = tr;
        void _s;
        consider({
          kind,
          itemId: tr.id,
          fingerprint: `${tr.updatedAt}|${tr.rev}`,
          data: toJson(meta),
          file: {
            source: { table: 'tracks', id: tr.id },
            ref: 'backups',
            path: `${userId}/tracks/${tr.id}.json`,
            contentType: 'application/json',
          },
        });
      }
    } else {
      for (const rec of records[table] as { id: string; updatedAt: string; rev: number }[]) {
        consider({ kind, itemId: rec.id, fingerprint: `${rec.updatedAt}|${rec.rev}`, data: toJson(rec) });
      }
    }
  }

  for (const key of Object.keys(state.uploaded)) {
    if (seen.has(key)) continue;
    const i = key.indexOf(':');
    plan.deletes.push({ kind: key.slice(0, i) as BackupKind, itemId: key.slice(i + 1) });
    const file = state.files[key];
    if (file) plan.removeFiles.push(file);
  }
  plan.removeFiles = [...new Set(plan.removeFiles)];
  return plan;
}

/** Aufteilen in Aufrufe mit höchstens 200 Einträgen */
export function chunk<T>(items: readonly T[], size = MAX_ITEMS_PER_CALL): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Nach erfolgreichem Schreiben den Stand dieses Geräts fortschreiben */
export function applyUploaded(state: DeviceBackupState, plan: BackupPlan, done: PlannedItem[]): DeviceBackupState {
  const uploaded = new Map(Object.entries(state.uploaded));
  const files = new Map(Object.entries(state.files));
  for (const item of done) {
    const key = keyOf(item.kind, item.itemId);
    uploaded.set(key, item.fingerprint);
    if (item.file?.ref === 'backups') files.set(key, item.file.path);
    else files.delete(key);
  }
  for (const d of plan.deletes) {
    const key = keyOf(d.kind, d.itemId);
    uploaded.delete(key);
    files.delete(key);
  }
  return { uploaded: Object.fromEntries(uploaded), files: Object.fromEntries(files) };
}

// ---------------------------------------------------------------------------------------------------------------------
// Wiederherstellen
// ---------------------------------------------------------------------------------------------------------------------

export const BackupRowSchema = z.object({
  kind: z.string(),
  item_id: z.string(),
  rev: z.number().int().nonnegative(),
  deleted: z.boolean(),
  data: z.record(z.string(), z.unknown()).nullable(),
  file_ref: z.enum(['backups', 'post-photos']).nullable(),
  file_path: z.string().nullable(),
  file_bytes: z.number().int().nonnegative(),
});
export type BackupRow = z.infer<typeof BackupRowSchema>;

export interface RestoreFile {
  kind: 'photo' | 'track';
  id: string;
  ref: 'backups' | 'post-photos';
  path: string;
}

export interface RestorePlan {
  /** geprüfte Datensätze (ohne Fotos-Bytes und ohne Routen-Punkte; die kommen über `files`) */
  records: Records;
  /** herunterzuladende Dateien: Fotos und Routen */
  files: RestoreFile[];
  /** Einträge mit Löschmarke */
  deleted: { kind: string; id: string }[];
  invalid: InvalidRecord[];
  /** höchste gesehene rev (merkt sich das Gerät für den nächsten Abruf) */
  lastRev: number;
}

/** Zeilen von backup_list in Datensätze verwandeln; kaputte Zeilen werden gemeldet, die übrigen gelten */
export function planRestore(rows: readonly unknown[]): RestorePlan {
  const plan: RestorePlan = { records: emptyRecords(), files: [], deleted: [], invalid: [], lastRev: 0 };
  rows.forEach((raw, index) => {
    const parsed = BackupRowSchema.safeParse(raw);
    if (!parsed.success) {
      plan.invalid.push({ table: 'catches', index, reason: 'Zeile der Sicherung nicht lesbar' });
      return;
    }
    const row = parsed.data;
    plan.lastRev = Math.max(plan.lastRev, row.rev);
    if (row.deleted) {
      plan.deleted.push({ kind: row.kind, id: row.item_id });
      return;
    }
    const table = tableOfKind(row.kind);
    if (!table || !row.data) {
      plan.invalid.push({ table: 'catches', index, id: row.item_id, reason: `Unbekannte Art „${row.kind}“` });
      return;
    }
    const check =
      table === 'photos'
        ? PhotoMetaSchema.safeParse(row.data)
        : table === 'tracks'
          ? // die Segmente kommen aus der Datei; hier nur der Rest
            ENTITY_SCHEMAS.tracks.safeParse({ ...row.data, segments: [[{ t: 0, lat: 0, lng: 0, acc: 0 }]] })
          : ENTITY_SCHEMAS[table].safeParse(row.data);
    if (!check.success) {
      plan.invalid.push({
        table: table === 'photos' ? 'photos' : table,
        index,
        id: row.item_id,
        reason: check.error.issues.map((i) => `${i.path.join('.') || 'Datensatz'}: ${i.message}`).join('; '),
      });
      return;
    }
    if (table === 'tracks') {
      // Routen werden erst mit ihrer Datei vollständig (parseTrackFile); bis dahin nur vormerken
      if (row.file_ref && row.file_path)
        plan.files.push({ kind: 'track', id: row.item_id, ref: row.file_ref, path: row.file_path });
      else plan.invalid.push({ table: 'tracks', index, id: row.item_id, reason: 'Route ohne Datei' });
      return;
    }
    (plan.records[table] as unknown[]).push(check.data);
    if (table === 'photos') {
      if (row.file_ref && row.file_path)
        plan.files.push({ kind: 'photo', id: row.item_id, ref: row.file_ref, path: row.file_path });
      else plan.invalid.push({ table: 'photos', index, id: row.item_id, reason: 'Foto ohne Datei' });
    }
  });
  return plan;
}

const TrackFileSchema = z.object({ segments: z.array(z.array(TrackPointSchema).min(1)).max(2000) });

/** Routen-Datei lesen und mit den Angaben aus der Zeile zu einer ganzen Route verbinden; `undefined` bei Fehlern */
export function parseTrackFile(row: Record<string, unknown>, fileText: string) {
  let json: unknown;
  try {
    json = JSON.parse(fileText);
  } catch {
    return undefined;
  }
  const file = TrackFileSchema.safeParse(json);
  if (!file.success) return undefined;
  const track = ENTITY_SCHEMAS.tracks.safeParse({ ...row, segments: file.data.segments });
  return track.success ? track.data : undefined;
}

/** Inhalt der Routen-Datei (`{segments}`), so wie sie hochgeladen wird */
export const trackFileText = (segments: unknown) => JSON.stringify({ segments });

// ---------------------------------------------------------------------------------------------------------------------
// Verbrauch
// ---------------------------------------------------------------------------------------------------------------------

export type QuotaLevel = 'ok' | 'near' | 'full';
export function quotaState(usedBytes: number, limitBytes = QUOTA_BYTES): { percent: number; level: QuotaLevel } {
  const percent = limitBytes > 0 ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 100;
  return { percent, level: percent >= 100 ? 'full' : percent >= 90 ? 'near' : 'ok' };
}
