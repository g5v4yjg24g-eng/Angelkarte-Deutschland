// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import type { AccountProvider, SharedPostInput } from '../ports/account';
import type { NewPhoto } from './catchService';
import { createPost, removePost, restorePost, updatePost } from './profileService';
import { setShare, syncPosts } from './postSyncService';

const photo = (): NewPhoto => ({
  blob: new Blob([new Uint8Array(20)], { type: 'image/jpeg' }),
  thumb: new Blob([new Uint8Array(5)], { type: 'image/jpeg' }),
  mime: 'image/jpeg',
  width: 1080,
  height: 1080,
});

/** Server im Speicher: nur die Teilen-Funktionen */
function server(fail = false) {
  const posts = new Map<string, Omit<SharedPostInput, 'photos'> & { photos: number }>();
  const calls: string[] = [];
  const account = {
    publishPost: (p: SharedPostInput) => {
      calls.push(`publish:${p.id}`);
      if (fail) return Promise.reject(new Error('Failed to fetch'));
      posts.set(p.id, { ...p, photos: p.photos.length });
      return Promise.resolve();
    },
    updateSharedPost: (id: string, c: { caption?: string; visibility: 'friends' | 'public' }) => {
      calls.push(`update:${id}`);
      const cur = posts.get(id);
      if (cur) posts.set(id, { ...cur, caption: c.caption, visibility: c.visibility });
      return Promise.resolve();
    },
    deleteSharedPost: (id: string) => {
      calls.push(`delete:${id}`);
      posts.delete(id);
      return Promise.resolve();
    },
  } as unknown as AccountProvider;
  return { account, posts, calls };
}

describe('Beiträge teilen (PST-2)', () => {
  it('hochladen, Änderung nachziehen, löschen und wiederherstellen', async () => {
    const db = freshDb();
    const s = server();
    const p = await createPost({ caption: 'Hecht!', share: 'pending', photos: [photo(), photo()] }, db);
    await createPost({ caption: 'nur lokal', photos: [photo()] }, db);

    expect(await syncPosts(s.account, db)).toEqual({ done: 1, failed: 0 });
    expect(s.posts.get(p.id)).toMatchObject({ caption: 'Hecht!', visibility: 'friends', photos: 2 });
    expect((await db.posts.get(p.id))?.share).toBe('shared');
    expect(await syncPosts(s.account, db)).toEqual({ done: 0, failed: 0 }); // nichts mehr zu tun

    await updatePost(p.id, { caption: 'Hecht, 92 cm', visibility: 'public' }, db);
    await syncPosts(s.account, db);
    expect(s.posts.get(p.id)).toMatchObject({ caption: 'Hecht, 92 cm', visibility: 'public' });

    await removePost(p.id, db);
    await syncPosts(s.account, db);
    expect(s.posts.has(p.id)).toBe(false);
    await restorePost(p.id, db);
    await syncPosts(s.account, db);
    expect(s.posts.has(p.id)).toBe(true);
    expect(s.calls.filter((c) => c.startsWith('publish'))).toHaveLength(2);
  });

  it('nicht mehr teilen entfernt vom Server und lässt den Beitrag lokal; erneut teilen lädt wieder hoch', async () => {
    const db = freshDb();
    const s = server();
    const p = await createPost({ share: 'pending', photos: [photo()] }, db);
    await syncPosts(s.account, db);
    await setShare(p.id, 'unshare', db);
    await syncPosts(s.account, db);
    expect(s.posts.has(p.id)).toBe(false);
    expect((await db.posts.get(p.id))?.share).toBeUndefined();
    await setShare(p.id, 'pending', db);
    await syncPosts(s.account, db);
    expect(s.posts.has(p.id)).toBe(true);
  });

  it('ohne Verbindung bleibt der Beitrag zum Hochladen vorgemerkt', async () => {
    const db = freshDb();
    const p = await createPost({ share: 'pending', photos: [photo()] }, db);
    expect(await syncPosts(server(true).account, db)).toEqual({ done: 0, failed: 1 });
    expect((await db.posts.get(p.id))?.share).toBe('pending');
  });
});
