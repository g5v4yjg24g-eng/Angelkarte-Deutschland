// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import type { AccountProvider } from '../ports/account';
import type { BackupPutItem } from '../domain/cloudBackup';
import { applyImport, prepareImport } from './backupService';
import {
  deleteCloudBackup,
  fetchCloudBackup,
  loadCloudState,
  MAX_FILES_PER_RUN,
  runCloudBackup,
  setCloudBackupEnabled,
} from './cloudBackupService';

const ME = '00000000-0000-0000-0000-0000000000a1';
const T = '2026-11-01T10:00:00.000Z';
const meta = (id: string) => ({ id, createdAt: T, updatedAt: T, rev: 0 });
const place = (id: string) => ({
  ...meta(id),
  type: 'spot' as const,
  name: 'Steg',
  position: { lat: 51.2, lng: 6.8, source: 'gps' as const },
});
const bytes = (n: number, v = 1) => new Uint8Array(n).fill(v);
const photoRow = (id: string, ownerType: 'catch' | 'post', ownerId: string, data: Uint8Array) => ({
  ...meta(id),
  mime: 'image/jpeg' as const,
  bytes: data.byteLength,
  ownerType,
  ownerId,
  blob: new Blob([data as Uint8Array<ArrayBuffer>], { type: 'image/jpeg' }),
});

/** Server im Speicher: Zeilen, Dateien je Speicher; Fehler lassen sich einstellen */
function server() {
  const rows = new Map<string, BackupPutItem & { rev: number }>();
  const files = { backups: new Map<string, Blob>(), 'post-photos': new Map<string, Blob>() };
  const calls: string[] = [];
  let rev = 0;
  const fail = { put: undefined as string | undefined, upload: undefined as string | undefined };
  const account = {
    backupUploadFile: (path: string, blob: Blob) => {
      calls.push(`upload:${path}`);
      if (fail.upload) return Promise.reject(new Error(fail.upload));
      files.backups.set(path, blob);
      return Promise.resolve();
    },
    backupPut: (items: BackupPutItem[]) => {
      calls.push(`put:${items.length}`);
      if (fail.put) return Promise.reject(new Error(fail.put));
      for (const i of items) {
        if (i.file_ref && !files[i.file_ref].has(i.file_path ?? '')) return Promise.reject(new Error('file_missing'));
      }
      const out = items.map((i) => {
        rows.set(`${i.kind}:${i.item_id}`, { ...i, rev: ++rev });
        return { kind: i.kind, itemId: i.item_id, rev };
      });
      return Promise.resolve(out);
    },
    backupRemoveFiles: (paths: string[]) => {
      calls.push(`remove:${paths.join(',')}`);
      for (const p of paths) files.backups.delete(p);
      return Promise.resolve();
    },
    backupList: (since: number) =>
      Promise.resolve(
        [...rows.values()]
          .filter((r) => r.rev > since)
          .map((r) => ({
            kind: r.kind,
            item_id: r.item_id,
            rev: r.rev,
            deleted: r.deleted ?? false,
            data: r.data ?? null,
            file_ref: r.file_ref ?? null,
            file_path: r.file_path ?? null,
            file_bytes: 0,
          })),
      ),
    backupDownloadFile: (ref: 'backups' | 'post-photos', path: string) => Promise.resolve(files[ref].get(path)),
    backupDeleteAll: () => {
      const paths = [...rows.values()].filter((r) => r.file_ref === 'backups').map((r) => r.file_path ?? '');
      rows.clear();
      return Promise.resolve(paths);
    },
  } as unknown as AccountProvider;
  return { account, rows, files, calls, fail };
}

async function enabled() {
  const db = freshDb();
  await setCloudBackupEnabled(ME, true, db);
  return db;
}

describe('Cloud-Sicherung: Dienst', () => {
  it('ist aus, solange niemand zugestimmt hat: nichts wird gesendet', async () => {
    const db = freshDb();
    await db.places.put(place('p1'));
    const s = server();
    const r = await runCloudBackup(s.account, ME, db);
    expect(r.status).toBe('off');
    expect(s.calls).toEqual([]);
  });

  it('sichert Daten, Foto und Route; der zweite Lauf lädt nichts erneut hoch', async () => {
    const db = await enabled();
    await db.places.put(place('p1'));
    await db.photos.put(photoRow('f1', 'catch', 'c1', bytes(40)));
    await db.tracks.put({ ...meta('t1'), sessionId: 's1', segments: [[{ t: 1, lat: 51, lng: 6, acc: 5 }]] });
    const s = server();
    const first = await runCloudBackup(s.account, ME, db);
    expect(first).toMatchObject({ status: 'ok', uploaded: 3, more: false });
    expect([...s.files.backups.keys()].sort()).toEqual([`${ME}/photos/f1.jpg`, `${ME}/tracks/t1.json`]);
    expect([...s.rows.keys()].sort()).toEqual(['photo:f1', 'place:p1', 'track:t1']);
    const calls = s.calls.length;
    const second = await runCloudBackup(s.account, ME, db);
    expect(second).toMatchObject({ status: 'ok', uploaded: 0, deleted: 0 });
    expect(s.calls.length).toBe(calls);
    expect((await loadCloudState(ME, db)).lastOkAt).toBeTruthy();
  });

  it('ein Beitragsfoto und das gleiche Fangfoto liegen nur einmal auf dem Server (Verweis)', async () => {
    const db = await enabled();
    const data = bytes(64, 7);
    await db.photos.put(photoRow('fa', 'catch', 'c1', data));
    await db.photos.put(photoRow('fb', 'post', 'b1', data));
    await db.posts.put({ ...meta('b1'), photoIds: ['fb'], share: 'shared', accountId: ME });
    const s = server();
    s.files['post-photos'].set(`${ME}/b1/1.jpg`, new Blob([data as Uint8Array<ArrayBuffer>]));
    const r = await runCloudBackup(s.account, ME, db);
    expect(r.status).toBe('ok');
    expect(s.files.backups.size).toBe(0);
    expect(s.rows.get('photo:fa')?.file_ref).toBe('post-photos');
    expect(s.rows.get('photo:fb')?.file_ref).toBe('post-photos');
    expect(s.calls.some((c) => c.startsWith('upload:'))).toBe(false);
  });

  it('fehlt die verwiesene Beitragsdatei auf dem Server, wird eine eigene Kopie hochgeladen', async () => {
    const db = await enabled();
    await db.photos.put(photoRow('fb', 'post', 'b1', bytes(30)));
    await db.posts.put({ ...meta('b1'), photoIds: ['fb'], share: 'shared', accountId: ME });
    const s = server(); // Beitragsdatei fehlt
    const r = await runCloudBackup(s.account, ME, db);
    expect(r).toMatchObject({ status: 'ok', uploaded: 2 });
    expect(s.rows.get('photo:fb')).toMatchObject({ file_ref: 'backups', file_path: `${ME}/photos/fb.jpg` });
    expect(s.files.backups.has(`${ME}/photos/fb.jpg`)).toBe(true);
  });

  it('lokal Gelöschtes bekommt eine Löschmarke, seine Datei wird entfernt', async () => {
    const db = await enabled();
    await db.places.put(place('p1'));
    await db.photos.put(photoRow('f1', 'catch', 'c1', bytes(20)));
    const s = server();
    await runCloudBackup(s.account, ME, db);
    await db.places.delete('p1');
    await db.photos.delete('f1');
    const r = await runCloudBackup(s.account, ME, db);
    expect(r).toMatchObject({ status: 'ok', deleted: 2 });
    expect(s.rows.get('place:p1')?.deleted).toBe(true);
    expect(s.files.backups.size).toBe(0);
    expect((await loadCloudState(ME, db)).state.uploaded).toEqual({});
  });

  it('Grenze erreicht: Status „quota“, der Stand rückt nicht vor', async () => {
    const db = await enabled();
    await db.places.put(place('p1'));
    const s = server();
    s.fail.put = 'backup_quota';
    const r = await runCloudBackup(s.account, ME, db);
    expect(r.status).toBe('quota');
    const st = await loadCloudState(ME, db);
    expect(st.lastError).toBe('quota');
    expect(st.state.uploaded).toEqual({});
  });

  it('Netzfehler: Status „failed“, Wiederholungen werden gezählt, später klappt es', async () => {
    const db = await enabled();
    await db.places.put(place('p1'));
    const s = server();
    s.fail.put = 'Failed to fetch';
    expect((await runCloudBackup(s.account, ME, db)).status).toBe('failed');
    expect((await runCloudBackup(s.account, ME, db)).status).toBe('failed');
    expect((await loadCloudState(ME, db)).retries).toBe(2);
    s.fail.put = undefined;
    expect((await runCloudBackup(s.account, ME, db)).status).toBe('ok');
    expect((await loadCloudState(ME, db)).retries).toBe(0);
  });

  it('viele Fotos: je Lauf höchstens so viele Dateien, der Rest folgt im nächsten', async () => {
    const db = await enabled();
    const n = MAX_FILES_PER_RUN + 5;
    for (let i = 0; i < n; i++) await db.photos.put(photoRow(`f${i}`, 'catch', 'c1', bytes(10, i + 1)));
    const s = server();
    const first = await runCloudBackup(s.account, ME, db);
    expect(first).toMatchObject({ status: 'ok', uploaded: MAX_FILES_PER_RUN, more: true });
    expect((await loadCloudState(ME, db)).lastOkAt).toBeUndefined();
    const second = await runCloudBackup(s.account, ME, db);
    expect(second).toMatchObject({ uploaded: 5, more: false });
    expect(s.files.backups.size).toBe(n);
  });

  it('Wiederherstellen: Daten, Foto und Route kommen auf einem neuen Gerät an', async () => {
    const db = await enabled();
    await db.places.put(place('p1'));
    await db.photos.put(photoRow('f1', 'catch', 'c1', bytes(40, 9)));
    await db.tracks.put({ ...meta('t1'), sessionId: 's1', segments: [[{ t: 1, lat: 51, lng: 6, acc: 5 }, { t: 2, lat: 51.1, lng: 6, acc: 5 }]] });
    const s = server();
    await runCloudBackup(s.account, ME, db);

    const read = await fetchCloudBackup(s.account);
    expect(read.parsed.records.places.map((p) => p.id)).toEqual(['p1']);
    expect(read.parsed.records.tracks[0]?.segments[0]).toHaveLength(2);
    expect(read.photoBlobs.get('f1')?.size).toBe(40);
    expect(read.parsed.invalid).toEqual([]);

    const fresh = freshDb();
    const plan = await prepareImport(read, fresh);
    await applyImport(read, plan, 'keepNewer', fresh);
    expect(await fresh.places.count()).toBe(1);
    expect(await fresh.tracks.count()).toBe(1);
    expect((await fresh.photos.get('f1'))?.blob.size).toBe(40);
  });

  it('Wiederherstellen: fehlende Fotodatei wird gemeldet, der Rest kommt trotzdem', async () => {
    const db = await enabled();
    await db.places.put(place('p1'));
    await db.photos.put(photoRow('f1', 'catch', 'c1', bytes(10)));
    const s = server();
    await runCloudBackup(s.account, ME, db);
    s.files.backups.clear();
    const read = await fetchCloudBackup(s.account);
    expect(read.parsed.records.places).toHaveLength(1);
    expect(read.parsed.records.photos).toHaveLength(0);
    expect(read.parsed.notes.join(' ')).toContain('1 Fotos');
  });

  it('Cloud-Sicherung löschen: Zeilen und Dateien weg, Sicherung aus', async () => {
    const db = await enabled();
    await db.places.put(place('p1'));
    await db.photos.put(photoRow('f1', 'catch', 'c1', bytes(10)));
    const s = server();
    await runCloudBackup(s.account, ME, db);
    await deleteCloudBackup(s.account, ME, db);
    expect(s.rows.size).toBe(0);
    expect(s.files.backups.size).toBe(0);
    const st = await loadCloudState(ME, db);
    expect(st.enabled).toBe(false);
    expect(st.state.uploaded).toEqual({});
    expect(st.consentAt).toBeTruthy();
  });
});
