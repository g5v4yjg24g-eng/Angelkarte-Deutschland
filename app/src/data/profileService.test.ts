// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import { saveCatch, type NewPhoto } from './catchService';
import {
  createPost,
  getProfile,
  listPosts,
  removePost,
  restorePost,
  saveProfile,
  updatePostCaption,
} from './profileService';
import { exportBackup } from './backupService';

const photo = (n: number): NewPhoto => ({
  blob: new Blob([new Uint8Array(n)], { type: 'image/jpeg' }),
  thumb: new Blob([new Uint8Array(10)], { type: 'image/jpeg' }),
  mime: 'image/jpeg',
  width: 1080,
  height: 1080,
});

describe('Profil (PRF-1)', () => {
  it('Profil anlegen und ändern; ein neues Profilbild ersetzt das alte, null entfernt es', async () => {
    const db = freshDb();
    expect(await getProfile(db)).toBeUndefined();
    const p = await saveProfile({ name: 'Kevin', bio: '📍 VIE' }, photo(5), db);
    expect(p).toMatchObject({ id: 'me', name: 'Kevin', bio: '📍 VIE' });
    const first = p.avatarPhotoId;
    expect((await db.photos.get(first as string))?.ownerType).toBe('profile');

    const p2 = await saveProfile({ name: 'Kevin F.', bio: '' }, photo(6), db);
    expect(p2.bio).toBeUndefined();
    expect(p2.avatarPhotoId).not.toBe(first);
    expect(await db.photos.get(first as string)).toBeUndefined();

    const p3 = await saveProfile({ name: 'Kevin F.' }, undefined, db);
    expect(p3.avatarPhotoId).toBe(p2.avatarPhotoId);
    const p4 = await saveProfile({ name: 'Kevin F.' }, null, db);
    expect(p4.avatarPhotoId).toBeUndefined();
    expect(await db.photos.count()).toBe(0);
  });

  it('Beitrag mit neuen Fotos und Kopien von Fangfotos; Fang löschen lässt den Beitrag unberührt', async () => {
    const db = freshDb();
    const c = await saveCatch(
      {
        input: { outcome: 'caught', at: '2026-10-21T14:00:00+02:00', tz: 'Europe/Berlin' },
        addPhotos: [photo(100)],
      },
      db,
    );
    const post = await createPost(
      { caption: 'Erster Hecht', catchId: c.id, photos: [photo(7)], catchPhotoIds: c.photoIds ?? [] },
      db,
    );
    expect(post.photoIds).toHaveLength(2);
    const rows = await db.photos.bulkGet(post.photoIds);
    expect(rows.map((r) => [r?.ownerType, r?.ownerId, r?.bytes])).toEqual([
      ['post', post.id, 100],
      ['post', post.id, 7],
    ]);
    expect(post.photoIds).not.toContain(c.photoIds?.[0]);
    await db.photos.delete(c.photoIds?.[0] as string);
    expect(await db.photos.get(post.photoIds[0] as string)).toBeDefined();
  });

  it('Text ändern, löschen, wiederherstellen; Liste neueste zuerst', async () => {
    const db = freshDb();
    const a = await createPost({ photos: [photo(1)] }, db);
    await db.posts.update(a.id, { createdAt: '2026-10-01T10:00:00+02:00' });
    const b = await createPost({ photos: [photo(2)], caption: 'b' }, db);
    expect((await listPosts(db)).map((p) => p.id)).toEqual([b.id, a.id]);
    expect((await updatePostCaption(a.id, 'neu', db)).caption).toBe('neu');
    await removePost(b.id, db);
    expect((await listPosts(db)).map((p) => p.id)).toEqual([a.id]);
    await restorePost(b.id, db);
    expect(await listPosts(db)).toHaveLength(2);
  });

  it('ohne Fotos kein Beitrag', async () => {
    const db = freshDb();
    await expect(createPost({ photos: [], caption: 'nur Text' }, db)).rejects.toThrow();
    expect(await db.posts.count()).toBe(0);
  });

  it('Profil und Beiträge sind Teil der Sicherung', async () => {
    const db = freshDb();
    await saveProfile({ name: 'Kevin' }, photo(3), db);
    await createPost({ photos: [photo(4)] }, db);
    const { backup } = await exportBackup({ withPhotos: true }, db);
    expect(backup.counts).toMatchObject({ profiles: 1, posts: 1, photos: 2 });
  });
});
