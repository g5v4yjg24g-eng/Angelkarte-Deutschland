// Cloud-Sicherung, Etappe 3 (BACKUP_PLAN.md): Dienst zwischen Gerät (Dexie) und Server. Die Regeln – was ist neu,
// wohin kommt welche Datei, wie wird zurückgeholt – stehen rein in `domain/cloudBackup.ts`.
import type { AccountProvider } from '../ports/account';
import {
  applyUploaded,
  backupErrorCode,
  chunk,
  CLOUD_INTERVAL_MS,
  emptyCloudState,
  filesToRemove,
  nextCloudRun,
  ownCopyOf,
  parseTrackFile,
  planBackup,
  planRestore,
  toDeleteItem,
  toPutItem,
  trackFileText,
  MAX_ITEMS_PER_CALL,
  type CloudDeviceState,
  type PlannedItem,
} from '../domain/cloudBackup';
import { emptyRecords, type ParsedBackup, type Records } from '../domain/backup/parse';
import type { PhotoMeta } from '../domain/schemas';
import { nowIso } from '../domain/time';
import { getDb, type FangpunktDB } from './db';
import { getSetting, setSetting } from './settings';
import type { ReadBackup } from './backupService';

/** Höchstens so viele Dateien je Lauf (der Rest folgt im nächsten, so bleibt ein Lauf kurz) */
export const MAX_FILES_PER_RUN = 60;

export interface CloudRunResult {
  status: 'off' | 'ok' | 'quota' | 'failed';
  uploaded: number;
  deleted: number;
  skipped: number;
  /** es ist noch etwas übrig (Dateien-Grenze erreicht): bald erneut laufen */
  more: boolean;
}

// ---------------------------------------------------------------------------------------------------------------------
// Stand dieses Geräts
// ---------------------------------------------------------------------------------------------------------------------

export async function loadCloudState(userId: string, db: FangpunktDB = getDb()): Promise<CloudDeviceState> {
  return (await getSetting('cloudBackup', db))?.[userId] ?? emptyCloudState();
}
async function saveCloudState(userId: string, state: CloudDeviceState, db: FangpunktDB) {
  const all = (await getSetting('cloudBackup', db)) ?? {};
  await setSetting('cloudBackup', { ...all, [userId]: state }, db);
}

/** Cloud-Sicherung ein- oder ausschalten (Einschalten = Zustimmung, wird mit Zeitpunkt festgehalten) */
export async function setCloudBackupEnabled(userId: string, enabled: boolean, db: FangpunktDB = getDb()) {
  const cur = await loadCloudState(userId, db);
  await saveCloudState(
    userId,
    enabled
      ? { ...cur, enabled: true, consentAt: cur.consentAt ?? nowIso(), lastError: undefined, retries: 0 }
      : { ...cur, enabled: false },
    db,
  );
}

/** Wann der nächste Lauf fällig ist (Zeitstempel in ms); `undefined`, wenn die Sicherung aus ist */
export async function nextCloudRunAt(userId: string, now: number, db: FangpunktDB = getDb()) {
  const st = await loadCloudState(userId, db);
  return st.enabled ? nextCloudRun(st, now) : undefined;
}

// ---------------------------------------------------------------------------------------------------------------------
// Lesen vom Gerät
// ---------------------------------------------------------------------------------------------------------------------

/** Alle Datensätze (Fotos nur als Angaben ohne Bilddaten) */
export async function readRecords(db: FangpunktDB = getDb()): Promise<Records> {
  const [sessions, places, baitPresets, catches, trips, tracks, waterLinks, waterRules, papers, profiles, posts, postLikes, postComments, photoRows] =
    await Promise.all([
      db.sessions.toArray(),
      db.places.toArray(),
      db.baitPresets.toArray(),
      db.catches.toArray(),
      db.trips.toArray(),
      db.tracks.toArray(),
      db.waterLinks.toArray(),
      db.waterRules.toArray(),
      db.papers.toArray(),
      db.profiles.toArray(),
      db.posts.toArray(),
      db.postLikes.toArray(),
      db.postComments.toArray(),
      db.photos.toArray(),
    ]);
  const photos: PhotoMeta[] = photoRows.map(({ blob: _b, thumb: _t, ...meta }) => {
    void _b;
    void _t;
    return meta;
  });
  return { sessions, places, baitPresets, catches, trips, tracks, waterLinks, waterRules, papers, profiles, posts, postLikes, postComments, photos };
}

async function sha256Of(blob: Blob): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Prüfsummen nur dort berechnen, wo sie für den Verweis auf Beitragsfotos gebraucht werden: Fotos geteilter Beiträge
 * und Fangfotos, die genauso groß sind wie eines davon. Das Ergebnis wird gemerkt (Fotos ändern sich nie).
 */
async function ensureHashes(
  records: Records,
  userId: string,
  known: Record<string, string>,
  db: FangpunktDB,
): Promise<Record<string, string>> {
  const sharedIds = new Set<string>();
  for (const p of records.posts) {
    if (p.share === 'shared' && p.accountId === userId && !p.deletedAt) for (const id of p.photoIds) sharedIds.add(id);
  }
  if (!sharedIds.size) return known;
  const byId = new Map(records.photos.map((p) => [p.id, p]));
  const sharedBytes = new Set([...sharedIds].map((id) => byId.get(id)?.bytes).filter((b): b is number => b !== undefined));
  const out = { ...known };
  for (const photo of records.photos) {
    if (out[photo.id]) continue;
    const wanted = sharedIds.has(photo.id) || (photo.ownerType === 'catch' && sharedBytes.has(photo.bytes));
    if (!wanted) continue;
    const row = await db.photos.get(photo.id);
    if (row?.blob) out[photo.id] = await sha256Of(row.blob);
  }
  return out;
}

/** Bytes einer Datei, die hochgeladen werden soll; `undefined`, wenn sie auf dem Gerät fehlt */
async function fileBlob(item: PlannedItem, db: FangpunktDB): Promise<Blob | undefined> {
  const f = item.file;
  if (!f) return undefined;
  if (f.source.table === 'photos') return (await db.photos.get(f.source.id))?.blob;
  const track = await db.tracks.get(f.source.id);
  return track ? new Blob([trackFileText(track.segments)], { type: 'application/json' }) : undefined;
}

// ---------------------------------------------------------------------------------------------------------------------
// Sichern
// ---------------------------------------------------------------------------------------------------------------------

/** Dateien eines Stapels hochladen; Einträge, deren Datei auf dem Gerät fehlt, bleiben außen vor */
async function uploadFiles(account: AccountProvider, batch: PlannedItem[], db: FangpunktDB): Promise<PlannedItem[]> {
  const ready: PlannedItem[] = [];
  for (const item of batch) {
    if (item.file?.ref !== 'backups') {
      ready.push(item);
      continue;
    }
    const blob = await fileBlob(item, db);
    if (!blob) continue;
    await account.backupUploadFile(item.file.path, blob, item.file.contentType);
    ready.push(item);
  }
  return ready;
}

/** Ein Stapel zum Server; fehlt eine verwiesene Beitragsdatei, wird für diese Einträge eine eigene Kopie hochgeladen */
async function putBatch(account: AccountProvider, userId: string, batch: PlannedItem[], db: FangpunktDB) {
  let items = await uploadFiles(account, batch, db);
  if (!items.length) return [];
  try {
    await account.backupPut(items.map(toPutItem));
    return items;
  } catch (e) {
    if (!backupErrorCode(e, 'file_missing')) throw e;
    items = items.map((i) => (i.file?.ref === 'post-photos' ? ownCopyOf(i, userId) : i));
    items = await uploadFiles(account, items, db);
    if (!items.length) return [];
    await account.backupPut(items.map(toPutItem));
    return items;
  }
}

/** Ein Sicherungslauf: Neues und Geändertes hochladen, Gelöschtes mit Löschmarke versehen. Nur wenn eingeschaltet. */
export async function runCloudBackup(
  account: AccountProvider,
  userId: string,
  db: FangpunktDB = getDb(),
  now: number = Date.now(),
): Promise<CloudRunResult> {
  let st = await loadCloudState(userId, db);
  const result: CloudRunResult = { status: 'off', uploaded: 0, deleted: 0, skipped: 0, more: false };
  if (!st.enabled) return result;
  try {
    const records = await readRecords(db);
    const hashes = await ensureHashes(records, userId, st.hashes, db);
    st = { ...st, hashes };
    const plan = planBackup({ userId, records, photoHashes: hashes, state: st.state });
    result.skipped = plan.skipped.length;
    let state = st.state;
    let filesDone = 0;
    let rest = plan.upserts;
    while (rest.length) {
      const batch: PlannedItem[] = [];
      let files = 0;
      for (const it of rest) {
        const own = it.file?.ref === 'backups';
        if (batch.length >= MAX_ITEMS_PER_CALL || (own && filesDone + files >= MAX_FILES_PER_RUN)) break;
        batch.push(it);
        if (own) files++;
      }
      if (!batch.length) {
        result.more = true;
        break;
      }
      rest = rest.slice(batch.length);
      const done = await putBatch(account, userId, batch, db);
      const stale = filesToRemove(state, done);
      state = applyUploaded(state, { ...plan, deletes: [] }, done);
      filesDone += files;
      result.uploaded += done.length;
      await saveCloudState(userId, { ...st, state }, db);
      if (stale.length) await account.backupRemoveFiles(stale).catch(() => undefined);
    }
    if (!result.more) {
      for (const part of chunk(plan.deletes)) {
        await account.backupPut(part.map(toDeleteItem));
        const stale = filesToRemove(state, [], part);
        state = applyUploaded(state, { ...plan, deletes: part }, []);
        result.deleted += part.length;
        await saveCloudState(userId, { ...st, state }, db);
        if (stale.length) await account.backupRemoveFiles(stale).catch(() => undefined);
      }
    }
    result.status = 'ok';
    await saveCloudState(
      userId,
      {
        ...st,
        state,
        // noch etwas übrig: in etwa 30 Sekunden weitermachen statt erst in einer Stunde
        lastRunAt: new Date(result.more ? now - CLOUD_INTERVAL_MS + 30_000 : now).toISOString(),
        ...(result.more ? {} : { lastOkAt: new Date(now).toISOString() }),
        lastError: undefined,
        retries: 0,
        skipped: plan.skipped.length,
      },
      db,
    );
  } catch (e) {
    const quota = backupErrorCode(e, 'backup_quota');
    result.status = quota ? 'quota' : 'failed';
    const cur = await loadCloudState(userId, db);
    await saveCloudState(
      userId,
      {
        ...cur,
        hashes: { ...cur.hashes, ...st.hashes },
        lastRunAt: new Date(now).toISOString(),
        lastError: quota ? 'quota' : 'failed',
        retries: quota ? 0 : (cur.retries ?? 0) + 1,
      },
      db,
    );
  }
  return result;
}

// ---------------------------------------------------------------------------------------------------------------------
// Wiederherstellen und Löschen
// ---------------------------------------------------------------------------------------------------------------------

const PAGE = 1000;

/**
 * Die Sicherung vom Server holen und als gelesene Sicherung aufbereiten – der bestehende Import mit Vorschau
 * (`prepareImport`/`applyImport`) übernimmt den Rest. Fotos ohne Datei und Routen mit kaputter Datei werden
 * weggelassen und in `notes` genannt.
 */
export async function fetchCloudBackup(account: AccountProvider): Promise<ReadBackup> {
  const rows: unknown[] = [];
  for (let since = 0; ; ) {
    const page = await account.backupList(since, PAGE);
    rows.push(...page);
    if (page.length < PAGE) break;
    since = Math.max(...page.map((r) => Number((r as { rev?: unknown }).rev ?? 0)));
  }
  const plan = planRestore(rows);
  const records = plan.records;
  const photoBlobs = new Map<string, Blob>();
  const notes: string[] = [];
  const invalid = [...plan.invalid];
  let missingPhotos = 0;
  const photoMeta = new Map(records.photos.map((p) => [p.id, p]));
  for (const f of plan.files) {
    const blob = await account.backupDownloadFile(f.ref, f.path);
    if (f.kind === 'photo') {
      const meta = photoMeta.get(f.id);
      if (blob && meta) photoBlobs.set(f.id, new Blob([blob], { type: meta.mime }));
      else missingPhotos++;
    } else {
      const track = blob ? parseTrackFile(plan.trackMeta[f.id] ?? {}, await blob.text()) : undefined;
      if (track) records.tracks.push(track);
      else invalid.push({ table: 'tracks', index: 0, id: f.id, reason: 'Routen-Datei fehlt oder ist nicht lesbar' });
    }
  }
  records.photos = records.photos.filter((p) => photoBlobs.has(p.id));
  if (missingPhotos) notes.push(`${missingPhotos} Fotos sind in der Cloud-Sicherung nicht mehr vorhanden.`);
  const parsed: ParsedBackup = {
    kind: 'fangpunkt',
    photosIncluded: true,
    records: { ...emptyRecords(), ...records },
    legacyPhotos: [],
    invalid,
    notes,
  };
  return { parsed, photoBlobs };
}

/** „Cloud-Sicherung löschen“: Zeilen und Dateien entfernen, die Sicherung für dieses Konto ausschalten */
export async function deleteCloudBackup(account: AccountProvider, userId: string, db: FangpunktDB = getDb()) {
  const paths = await account.backupDeleteAll();
  for (const part of chunk(paths, 100)) await account.backupRemoveFiles(part);
  await saveCloudState(userId, { ...emptyCloudState(), consentAt: (await loadCloudState(userId, db)).consentAt }, db);
}
