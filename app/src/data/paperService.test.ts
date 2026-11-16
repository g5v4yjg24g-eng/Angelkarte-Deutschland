// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import { removePaper, renewPaper, restorePaper, savePaper } from './paperService';
import type { NewPhoto } from './catchService';

const photo = (): NewPhoto => ({
  blob: new Blob(['x'], { type: 'image/jpeg' }),
  thumb: new Blob(['t'], { type: 'image/jpeg' }),
  mime: 'image/jpeg',
  width: 10,
  height: 10,
});
const fields = { kind: 'permit' as const, title: 'Jahreskarte See', validUntil: '2026-12-31', remind: true };

describe('Angelpapiere (PAP-1)', () => {
  it('speichert ein Papier mit Fotos in einer Transaktion', async () => {
    const db = freshDb();
    const p = await savePaper({ input: fields, addPhotos: [photo(), photo()] }, db);
    expect(p.photoIds).toHaveLength(2);
    const rows = await db.photos.bulkGet(p.photoIds ?? []);
    expect(rows.every((x) => x?.ownerType === 'paper' && x.ownerId === p.id)).toBe(true);
  });

  it('ändert, entfernt und ergänzt Fotos; mehr als 4 werden abgelehnt', async () => {
    const db = freshDb();
    const p = await savePaper({ input: fields, addPhotos: [photo(), photo()] }, db);
    const [first] = p.photoIds ?? [];
    const next = await savePaper(
      {
        id: p.id,
        changes: { ...fields, title: 'Jahreskarte Fluss' },
        removePhotoIds: [first as string],
        addPhotos: [photo()],
      },
      db,
    );
    expect(next.title).toBe('Jahreskarte Fluss');
    expect(next.photoIds).toHaveLength(2);
    expect(await db.photos.get(first as string)).toBeUndefined();
    await expect(
      savePaper({ id: p.id, changes: fields, addPhotos: [photo(), photo(), photo()] }, db),
    ).rejects.toThrow();
    expect((await db.papers.get(p.id))?.photoIds).toHaveLength(2); // nichts halb gespeichert
    expect(await db.photos.count()).toBe(2);
  });

  it('lehnt ein Ablaufdatum vor dem Beginn ab', async () => {
    const db = freshDb();
    await expect(
      savePaper({ input: { ...fields, validFrom: '2027-01-01', validUntil: '2026-12-31' } }, db),
    ).rejects.toThrow();
    expect(await db.papers.count()).toBe(0);
  });

  it('Papierkorb und Wiederherstellen', async () => {
    const db = freshDb();
    const p = await savePaper({ input: fields }, db);
    await removePaper(p.id, db);
    expect((await db.papers.get(p.id))?.deletedAt).toBeDefined();
    await restorePaper(p.id, db);
    expect((await db.papers.get(p.id))?.deletedAt).toBeUndefined();
  });

  it('Verlängern setzt ein späteres Datum, ein früheres wird abgelehnt', async () => {
    const db = freshDb();
    const p = await savePaper({ input: fields }, db);
    expect((await renewPaper(p.id, '2027-12-31', db)).validUntil).toBe('2027-12-31');
    await expect(renewPaper(p.id, '2027-06-01', db)).rejects.toThrow();
    expect((await db.papers.get(p.id))?.validUntil).toBe('2027-12-31');
  });
});
