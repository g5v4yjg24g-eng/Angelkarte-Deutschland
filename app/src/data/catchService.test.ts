// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import { saveCatch, type NewPhoto } from './catchService';
import { isQuotaError } from './errors';

const base = { outcome: 'caught' as const, at: '2026-10-21T14:00:00+02:00', tz: 'Europe/Berlin' };
const photo = (n: number): NewPhoto => ({
  blob: new Blob([new Uint8Array(n)], { type: 'image/jpeg' }),
  thumb: new Blob([new Uint8Array(10)], { type: 'image/jpeg' }),
  mime: 'image/jpeg',
  width: 1600,
  height: 1200,
});

describe('saveCatch', () => {
  it('speichert Fang und Fotos zusammen; Fotos gehören zum Fang', async () => {
    const db = freshDb();
    const c = await saveCatch({ input: base, addPhotos: [photo(100), photo(200)] }, db);
    expect(c.photoIds).toHaveLength(2);
    const photos = await db.photos.toArray();
    expect(photos.map((p) => [p.ownerType, p.ownerId, p.bytes]).sort()).toEqual([
      ['catch', c.id, 100],
      ['catch', c.id, 200],
    ]);
  });

  it('Bearbeiten: Fotos hinzufügen und entfernen (entfernte werden gelöscht)', async () => {
    const db = freshDb();
    const c = await saveCatch({ input: base, addPhotos: [photo(1), photo(2)] }, db);
    const [keep, drop] = c.photoIds ?? [];
    const u = await saveCatch(
      { id: c.id, changes: { notes: 'neu' }, addPhotos: [photo(3)], removePhotoIds: [drop ?? ''] },
      db,
    );
    expect(u.photoIds).toHaveLength(2);
    expect(u.photoIds?.[0]).toBe(keep);
    expect(await db.photos.get(drop ?? '')).toBeUndefined();
    expect(u.notes).toBe('neu');
    // Letztes Foto entfernt → kein leeres photoIds-Feld
    const v = await saveCatch({ id: c.id, changes: {}, removePhotoIds: u.photoIds ?? [] }, db);
    expect(v.photoIds).toBeUndefined();
  });

  it('CAT-5: Speicher voll → nichts wird gespeichert, auch kein halber Eintrag', async () => {
    const db = freshDb();
    const quota = Object.assign(new Error('voll'), { name: 'QuotaExceededError' });
    vi.spyOn(db.photos, 'bulkAdd').mockRejectedValueOnce(quota);
    const err = await saveCatch({ input: base, addPhotos: [photo(1)] }, db).catch((e: unknown) => e);
    expect(isQuotaError(err)).toBe(true);
    expect(await db.catches.count()).toBe(0);
    expect(await db.photos.count()).toBe(0);
    // „Ohne Foto speichern"
    const c = await saveCatch({ input: base }, db);
    expect(c.photoIds).toBeUndefined();
    expect(await db.catches.count()).toBe(1);
  });

  it('ungültiger Fang: auch die Fotos werden nicht gespeichert', async () => {
    const db = freshDb();
    await expect(
      saveCatch({ input: { ...base, lengthCm: 900 }, addPhotos: [photo(1)] }, db),
    ).rejects.toThrow();
    expect(await db.photos.count()).toBe(0);
  });
});
