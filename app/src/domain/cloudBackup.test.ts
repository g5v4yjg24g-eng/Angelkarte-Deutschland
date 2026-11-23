import { describe, expect, it } from 'vitest';
import {
  applyUploaded,
  chunk,
  emptyDeviceState,
  KIND_OF_TABLE,
  ownCopyOf,
  parseTrackFile,
  planBackup,
  planRestore,
  quotaState,
  tableOfKind,
  trackFileText,
  type DeviceBackupState,
  type PlanInput,
} from './cloudBackup';
import { emptyRecords } from './backup/parse';

const must = <T>(v: T | undefined): T => {
  if (v === undefined) throw new Error('erwartet einen Wert');
  return v;
};
const U = '00000000-0000-0000-0000-0000000000a1';
const T = '2026-11-01T10:00:00.000Z';
const meta = (id: string, over: Record<string, unknown> = {}) => ({ id, createdAt: T, updatedAt: T, rev: 0, ...over });

const place = (id: string) => ({ ...meta(id), type: 'spot', name: 'Steg', position: { lat: 51.2, lng: 6.8, source: 'gps' } });
const photo = (id: string, ownerType: string, ownerId: string, over: Record<string, unknown> = {}) => ({
  ...meta(id),
  mime: 'image/jpeg',
  bytes: 1000,
  ownerType,
  ownerId,
  ...over,
});
const post = (id: string, photoIds: string[], over: Record<string, unknown> = {}) => ({
  ...meta(id),
  photoIds,
  share: 'shared',
  accountId: U,
  ...over,
});
const input = (
  patch: { records?: Record<string, unknown[]>; photoHashes?: Record<string, string>; state?: DeviceBackupState } = {},
): PlanInput => ({
  userId: U,
  records: { ...emptyRecords(), ...(patch.records ?? {}) } as unknown as PlanInput['records'],
  photoHashes: patch.photoHashes ?? {},
  state: patch.state ?? emptyDeviceState(),
});

describe('Arten', () => {
  it('jede Tabelle hat eine eindeutige Art, die der Server annimmt (a–z und _)', () => {
    const kinds = Object.values(KIND_OF_TABLE);
    expect(new Set(kinds).size).toBe(kinds.length);
    for (const k of kinds) expect(k).toMatch(/^[a-z_]{1,30}$/);
    expect(tableOfKind('bait_preset')).toBe('baitPresets');
    expect(tableOfKind('gibt-es-nicht')).toBeUndefined();
  });
});

describe('planBackup', () => {
  it('neue Einträge werden geschrieben, unveränderte nicht', () => {
    const p1 = place('p1');
    const first = planBackup(input({ records: { places: [p1] } }));
    expect(first.upserts.map((i) => `${i.kind}:${i.itemId}`)).toEqual(['place:p1']);
    const state = applyUploaded(emptyDeviceState(), first, first.upserts);
    const again = planBackup(input({ records: { places: [p1] }, state }));
    expect(again.upserts).toHaveLength(0);
    expect(again.unchanged).toBe(1);
  });

  it('eine Änderung (updatedAt oder rev) wird erneut geschrieben', () => {
    const p1 = place('p1');
    const state = applyUploaded(emptyDeviceState(), planBackup(input({ records: { places: [p1] } })), [
      must(planBackup(input({ records: { places: [p1] } })).upserts[0]),
    ]);
    const changed = planBackup(input({ records: { places: [{ ...p1, rev: 1, updatedAt: '2026-11-02T10:00:00.000Z' }] }, state }));
    expect(changed.upserts).toHaveLength(1);
  });

  it('lokal entfernte Einträge bekommen eine Löschmarke und ihre Datei wird entfernt', () => {
    const state: DeviceBackupState = {
      uploaded: { 'place:alt': 'x', 'photo:f9': 'y' },
      files: { 'photo:f9': `${U}/photos/f9.jpg` },
    };
    const plan = planBackup(input({ state }));
    expect(plan.deletes).toEqual([
      { kind: 'place', itemId: 'alt' },
      { kind: 'photo', itemId: 'f9' },
    ]);
    expect(plan.removeFiles).toEqual([`${U}/photos/f9.jpg`]);
    const next = applyUploaded(state, plan, []);
    expect(next.uploaded).toEqual({});
    expect(next.files).toEqual({});
  });

  it('Routen: Daten ohne Punkte, Punkte als eigene Datei', () => {
    const track = { ...meta('t1'), sessionId: 's1', segments: [[{ t: 1, lat: 51, lng: 6, acc: 5 }]] };
    const plan = planBackup(input({ records: { tracks: [track] } }));
    const item = must(plan.upserts[0]);
    expect(item.data).not.toHaveProperty('segments');
    expect(item.file).toMatchObject({ source: { table: 'tracks', id: 't1' }, ref: 'backups', path: `${U}/tracks/t1.json`, contentType: 'application/json' });
  });

  it('Foto: eigene Datei in backups', () => {
    const plan = planBackup(input({ records: { photos: [photo('f1', 'catch', 'c1')] } }));
    expect(must(plan.upserts[0]).file).toMatchObject({ ref: 'backups', path: `${U}/photos/f1.jpg` });
  });

  it('Beitragsfoto eines geteilten Beitrags: nur Verweis, kein Hochladen', () => {
    const plan = planBackup(
      input({ records: { photos: [photo('f2', 'post', 'b1', { mime: 'image/png' })], posts: [post('b1', ['f2'])] } }),
    );
    const f = must(plan.upserts.find((i) => i.kind === 'photo'));
    expect(f.file).toMatchObject({ ref: 'post-photos', path: `${U}/b1/1.png` });
  });

  it('Fangfoto mit gleichem Inhalt wie ein geteiltes Beitragsfoto: ebenfalls nur Verweis (Hash)', () => {
    const plan = planBackup(
      input({
        records: {
          photos: [photo('fa', 'catch', 'c1'), photo('fb', 'post', 'b1')],
          posts: [post('b1', ['fb'])],
        },
        photoHashes: { fa: 'h1', fb: 'h1' },
      }),
    );
    const fa = must(plan.upserts.find((i) => i.itemId === 'fa'));
    expect(fa.file).toMatchObject({ ref: 'post-photos', path: `${U}/b1/1.jpg` });
  });

  it('ohne Hash keine Verwechslung: Fangfoto bleibt eigene Datei', () => {
    const plan = planBackup(
      input({ records: { photos: [photo('fa', 'catch', 'c1'), photo('fb', 'post', 'b1')], posts: [post('b1', ['fb'])] } }),
    );
    expect(must(plan.upserts.find((i) => i.itemId === 'fa')).file?.ref).toBe('backups');
  });

  it('Beitrag eines anderen Kontos, nicht geteilt oder gelöscht: kein Verweis', () => {
    for (const p of [
      post('b1', ['fb'], { accountId: 'anderes-konto' }),
      post('b1', ['fb'], { share: 'pending' }),
      post('b1', ['fb'], { deletedAt: T }),
      post('b1', ['fb'], { share: undefined }),
    ]) {
      const plan = planBackup(input({ records: { photos: [photo('fb', 'post', 'b1')], posts: [p] } }));
      expect(must(plan.upserts.find((i) => i.kind === 'photo')).file?.ref).toBe('backups');
    }
  });

  it('wechselt ein Foto von eigener Datei auf Verweis, wird die alte Datei zum Entfernen gemeldet', () => {
    const ph = photo('fb', 'post', 'b1');
    const state: DeviceBackupState = {
      uploaded: { 'photo:fb': `1000|backups|${U}/photos/fb.jpg` },
      files: { 'photo:fb': `${U}/photos/fb.jpg` },
    };
    const plan = planBackup(input({ records: { photos: [ph], posts: [post('b1', ['fb'])] }, state }));
    expect(plan.upserts).toHaveLength(2);
    expect(plan.removeFiles).toEqual([`${U}/photos/fb.jpg`]);
  });

  it('zu große Einträge werden übersprungen und gemeldet', () => {
    const big = { ...place('p1'), name: 'x'.repeat(70_000) };
    const plan = planBackup(input({ records: { places: [big] } }));
    expect(plan.upserts).toHaveLength(0);
    expect(plan.skipped).toEqual([{ kind: 'place', itemId: 'p1', reason: 'too_large' }]);
  });
});

describe('ownCopyOf', () => {
  it('macht aus einem Verweis wieder eine eigene Datei (Rückfall, wenn das Beitragsfoto fehlt)', () => {
    const plan = planBackup(
      input({ records: { photos: [photo('fb', 'post', 'b1')], posts: [post('b1', ['fb'])] } }),
    );
    const ref = must(plan.upserts.find((i) => i.kind === 'photo'));
    const own = ownCopyOf(ref, U);
    expect(own.file).toMatchObject({ ref: 'backups', path: `${U}/photos/fb.jpg` });
    expect(own.fingerprint).toContain('backups');
    expect(ownCopyOf(own, U)).toEqual(own);
  });
});

describe('chunk / applyUploaded', () => {
  it('teilt in Aufrufe mit höchstens 200', () => {
    const parts = chunk(Array.from({ length: 450 }, (_, i) => i));
    expect(parts.map((p) => p.length)).toEqual([200, 200, 50]);
  });
  it('merkt eigene Dateien nur bei backups', () => {
    const plan = planBackup(
      input({
        records: { photos: [photo('fa', 'catch', 'c1'), photo('fb', 'post', 'b1')], posts: [post('b1', ['fb'])] },
      }),
    );
    const next = applyUploaded(emptyDeviceState(), plan, plan.upserts);
    expect(next.files).toEqual({ 'photo:fa': `${U}/photos/fa.jpg` });
    expect(Object.keys(next.uploaded).sort()).toEqual(['photo:fa', 'photo:fb', 'post:b1']);
  });
});

describe('planRestore', () => {
  const row = (over: Record<string, unknown>) => ({
    kind: 'place',
    item_id: 'p1',
    rev: 5,
    deleted: false,
    data: place('p1'),
    file_ref: null,
    file_path: null,
    file_bytes: 0,
    ...over,
  });

  it('gültige Zeilen werden zu Datensätzen, höchste rev wird gemerkt', () => {
    const r = planRestore([row({}), row({ kind: 'place', item_id: 'p2', rev: 9, data: place('p2') })]);
    expect(r.records.places.map((p) => p.id)).toEqual(['p1', 'p2']);
    expect(r.lastRev).toBe(9);
    expect(r.invalid).toEqual([]);
  });

  it('kaputte und unbekannte Zeilen werden gemeldet, die übrigen gelten', () => {
    const r = planRestore([
      row({}),
      row({ item_id: 'p3', data: { id: 'p3' } }),
      row({ kind: 'ufo', item_id: 'u1', data: {} }),
      { unsinn: true },
    ]);
    expect(r.records.places).toHaveLength(1);
    expect(r.invalid).toHaveLength(3);
  });

  it('Löschmarken werden getrennt geführt', () => {
    const r = planRestore([row({ deleted: true, data: null })]);
    expect(r.deleted).toEqual([{ kind: 'place', id: 'p1' }]);
    expect(r.records.places).toHaveLength(0);
  });

  it('Fotos brauchen eine Datei, Routen auch', () => {
    const ph = photo('f1', 'catch', 'c1');
    const ok = planRestore([row({ kind: 'photo', item_id: 'f1', data: ph, file_ref: 'backups', file_path: `${U}/photos/f1.jpg` })]);
    expect(ok.files).toEqual([{ kind: 'photo', id: 'f1', ref: 'backups', path: `${U}/photos/f1.jpg` }]);
    const missing = planRestore([row({ kind: 'photo', item_id: 'f1', data: ph })]);
    expect(missing.invalid).toHaveLength(1);
    const { segments: _s, ...tmeta } = { ...meta('t1'), sessionId: 's1', segments: [] as unknown[] };
    void _s;
    const tr = planRestore([row({ kind: 'track', item_id: 't1', data: tmeta, file_ref: 'backups', file_path: `${U}/tracks/t1.json` })]);
    expect(tr.files).toEqual([{ kind: 'track', id: 't1', ref: 'backups', path: `${U}/tracks/t1.json` }]);
    expect(tr.records.tracks).toHaveLength(0);
  });
});

describe('Routen-Datei', () => {
  const segs = [[{ t: 1, lat: 51, lng: 6, acc: 5 }, { t: 2, lat: 51.001, lng: 6, acc: 5 }]];
  const row = { ...meta('t1'), sessionId: 's1' };
  it('verbindet Zeile und Datei zu einer Route', () => {
    const tr = parseTrackFile(row, trackFileText(segs));
    expect(tr?.segments).toHaveLength(1);
    expect(tr?.sessionId).toBe('s1');
  });
  it('lehnt kaputte Dateien ab', () => {
    expect(parseTrackFile(row, 'kein json')).toBeUndefined();
    expect(parseTrackFile(row, '{"segments":"x"}')).toBeUndefined();
    expect(parseTrackFile(row, trackFileText([[{ t: 2, lat: 1, lng: 1, acc: 1 }, { t: 1, lat: 1, lng: 1, acc: 1 }]]))).toBeUndefined();
  });
});

describe('quotaState', () => {
  it('Stufen ok, near, full', () => {
    expect(quotaState(0).level).toBe('ok');
    expect(quotaState(450 * 1024 * 1024).level).toBe('near');
    expect(quotaState(524_288_000).level).toBe('full');
    expect(quotaState(10, 0).level).toBe('full');
  });
});
