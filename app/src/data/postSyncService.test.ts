// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import type { AccountProvider, SharedPostInput } from '../ports/account';
import type { FeedPost } from '../domain/feed';
import type { NewPhoto } from './catchService';
import { createPost, removePost, restorePost, updatePost } from './profileService';
import { adoptLocalPosts, pullOwnPosts, retryPost, syncPosts } from './postSyncService';

const ME = 'u-anna';
const photo = (): NewPhoto => ({
  blob: new Blob([new Uint8Array(20)], { type: 'image/jpeg' }),
  thumb: new Blob([new Uint8Array(5)], { type: 'image/jpeg' }),
  mime: 'image/jpeg',
  width: 1080,
  height: 1080,
});

/** Server im Speicher: Beiträge je ID (wie publish_post: höchstens einmal angelegt) */
function server(fail: boolean | string = false) {
  const posts = new Map<string, Omit<SharedPostInput, 'photos'> & { photos: number; thumbs: number }>();
  const calls: string[] = [];
  const account = {
    publishPost: (p: SharedPostInput) => {
      calls.push(`publish:${p.id}`);
      if (fail) return Promise.reject(new Error(typeof fail === 'string' ? fail : 'Failed to fetch'));
      posts.set(p.id, { ...p, photos: p.photos.length, thumbs: p.photos.filter((f) => f.thumb).length });
      return Promise.resolve();
    },
    updateSharedPost: (id: string, c: { caption?: string; visibility: SharedPostInput['visibility'] }) => {
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

describe('Beiträge sichern (PST-2)', () => {
  it('hochladen (mit Vorschaubildern), Änderung nachziehen, löschen und wiederherstellen', async () => {
    const db = freshDb();
    const s = server();
    const p = await createPost({ caption: 'Hecht!', visibility: 'friends', share: 'pending', photos: [photo(), photo()] }, db);

    expect(await syncPosts(s.account, ME, db)).toEqual({ done: 1, failed: 0 });
    expect(s.posts.get(p.id)).toMatchObject({ caption: 'Hecht!', visibility: 'friends', photos: 2, thumbs: 2 });
    expect(await db.posts.get(p.id)).toMatchObject({ share: 'shared', accountId: ME });
    expect(await syncPosts(s.account, ME, db)).toEqual({ done: 0, failed: 0 }); // nichts mehr zu tun

    await updatePost(p.id, { caption: 'Hecht, 92 cm', visibility: 'private' }, db);
    await syncPosts(s.account, ME, db);
    expect(s.posts.get(p.id)).toMatchObject({ caption: 'Hecht, 92 cm', visibility: 'private' });

    await removePost(p.id, db);
    await syncPosts(s.account, ME, db);
    expect(s.posts.has(p.id)).toBe(false);
    await restorePost(p.id, db);
    await syncPosts(s.account, ME, db);
    expect(s.posts.has(p.id)).toBe(true);
    expect(s.calls.filter((c) => c.startsWith('publish'))).toHaveLength(2);
  });

  it('automatische Übertragung: Sichtbarkeit bleibt, ohne Angabe „Nur ich“ (PST-3)', async () => {
    const db = freshDb();
    const old = await createPost({ photos: [photo()] }, db); // ältere Version: ohne Sichtbarkeit
    const pub = await createPost({ photos: [photo()], visibility: 'public' }, db);
    const gone = await createPost({ photos: [photo()] }, db);
    await removePost(gone.id, db);
    const other = await createPost({ photos: [photo()], visibility: 'friends' }, db);
    await db.posts.update(other.id, { accountId: 'u-bert' }); // gehört einem anderen Konto auf diesem Gerät

    expect(await adoptLocalPosts(ME, db)).toBe(2);
    expect(await db.posts.get(old.id)).toMatchObject({ share: 'pending', visibility: 'private', visibilityAssumed: true });
    expect(await db.posts.get(pub.id)).toMatchObject({ share: 'pending', visibility: 'public' });
    expect((await db.posts.get(pub.id))?.visibilityAssumed).toBeUndefined();
    expect((await db.posts.get(gone.id))?.share).toBeUndefined();
    expect((await db.posts.get(other.id))?.share).toBeUndefined();

    const s = server();
    await syncPosts(s.account, ME, db);
    expect([...s.posts.keys()].sort()).toEqual([old.id, pub.id].sort());
    expect(s.posts.get(old.id)?.createdAt).toBe(old.createdAt); // Erstellungsdatum bleibt
    // zweiter Lauf: keine Doppelten, nichts erneut
    expect(await adoptLocalPosts(ME, db)).toBe(0);
    await syncPosts(s.account, ME, db);
    expect(s.calls.filter((c) => c.startsWith('publish'))).toHaveLength(2);

    // selbst gewählt → kein „bitte prüfen“ mehr
    await updatePost(old.id, { caption: '', visibility: 'friends' }, db);
    expect((await db.posts.get(old.id))?.visibilityAssumed).toBeUndefined();
  });

  it('ohne Verbindung: bleibt vorgemerkt, wartet mit wachsender Pause, „Erneut versuchen“ hebt sie auf', async () => {
    const db = freshDb();
    const p = await createPost({ share: 'pending', photos: [photo()] }, db);
    const t0 = Date.parse('2026-11-10T12:00:00Z');
    const off = server(true);
    expect(await syncPosts(off.account, ME, db, t0)).toEqual({ done: 0, failed: 1 });
    expect(await db.posts.get(p.id)).toMatchObject({
      share: 'pending',
      syncError: 'failed',
      syncAttempts: 1,
      syncRetryAt: '2026-11-10T12:01:00.000Z',
    });
    // vor Ablauf der Pause: kein Versuch
    expect(await syncPosts(off.account, ME, db, t0 + 30_000)).toEqual({ done: 0, failed: 0 });
    await syncPosts(off.account, ME, db, t0 + 61_000);
    expect((await db.posts.get(p.id))?.syncRetryAt).toBe('2026-11-10T12:06:01.000Z'); // 5 min
    await retryPost(p.id, db);
    const on = server();
    expect(await syncPosts(on.account, ME, db, t0 + 90_000)).toEqual({ done: 1, failed: 0 });
    const saved = await db.posts.get(p.id);
    expect(saved?.share).toBe('shared');
    expect(saved?.syncError).toBeUndefined();
    expect(saved?.syncAttempts).toBeUndefined();
  });

  it('Tagesgrenze des Servers: Beitrag wartet eine Stunde (DISC-2)', async () => {
    const db = freshDb();
    const p = await createPost({ share: 'pending', photos: [photo()] }, db);
    const t0 = Date.parse('2026-11-10T12:00:00Z');
    expect(await syncPosts(server('too_many_posts').account, ME, db, t0)).toEqual({ done: 0, failed: 1 });
    expect(await db.posts.get(p.id)).toMatchObject({
      share: 'pending',
      syncError: 'limited',
      syncRetryAt: '2026-11-10T13:00:00.000Z',
    });
  });

  it('fehlende Fotodatei: nie als gesichert melden, kein Dauerversuch', async () => {
    const db = freshDb();
    const p = await createPost({ share: 'pending', photos: [photo()] }, db);
    await db.photos.clear();
    const s = server();
    expect(await syncPosts(s.account, ME, db)).toEqual({ done: 0, failed: 1 });
    expect(await db.posts.get(p.id)).toMatchObject({ share: 'pending', syncError: 'photo_missing' });
    expect(await syncPosts(s.account, ME, db)).toEqual({ done: 0, failed: 0 });
    expect(s.calls).toEqual([]);
  });

  it('Highlight geht mit der gemeinsamen Session hoch (GRP-3)', async () => {
    const db = freshDb();
    const s = server();
    const p = await createPost({ share: 'pending', groupId: 'g1', visibility: 'friends', photos: [photo()] }, db);
    await syncPosts(s.account, ME, db);
    expect(s.posts.get(p.id)).toMatchObject({ groupId: 'g1' });
  });
});

describe('Eigenes Profil auf jedem Gerät (PST-4)', () => {
  const remote = (o: Partial<FeedPost>): FeedPost => ({
    id: 'srv-1',
    authorId: ME,
    username: 'anna',
    displayName: 'Anna',
    badges: [],
    visibility: 'private',
    photoPaths: [`${ME}/srv-1/1.jpg`],
    photoUrls: [],
    createdAt: '2026-10-01T08:00:00+00:00',
    ...o,
  });
  const account = (list: FeedPost[], missing: string[] = []) =>
    ({
      userPosts: (_u: string, before?: string) => Promise.resolve(before ? [] : list),
      downloadPostPhotos: (paths: string[]) =>
        Promise.resolve(
          paths.some((p) => missing.some((m) => p.includes(m)))
            ? undefined
            : paths.map((p) => ({ blob: new Blob([new Uint8Array(p.length)]) })),
        ),
    }) as unknown as AccountProvider;

  it('holt fehlende eigene Beiträge mit Fotos und Datum, ohne Doppelte', async () => {
    const db = freshDb();
    const here = await createPost({ share: 'pending', photos: [photo()] }, db);
    const list = [
      remote({ caption: 'Zander', speciesId: 'zander', lengthCm: 61 }),
      remote({ id: here.id, photoPaths: [`${ME}/${here.id}/1.jpg`] }),
      remote({ id: 'srv-2', photoPaths: [`${ME}/srv-2/1.png`, `${ME}/srv-2/2.jpg`], visibility: 'public' }),
    ];
    expect(await pullOwnPosts(account(list), ME, db)).toBe(2);
    expect(await db.posts.get('srv-1')).toMatchObject({
      caption: 'Zander',
      visibility: 'private',
      speciesId: 'zander',
      lengthCm: 61,
      createdAt: '2026-10-01T08:00:00+00:00',
      share: 'shared',
      accountId: ME,
    });
    const two = await db.posts.get('srv-2');
    const photos = await db.photos.bulkGet(two?.photoIds ?? []);
    expect(photos.map((p) => p?.mime)).toEqual(['image/png', 'image/jpeg']);
    expect(photos[0]?.thumb).toBeDefined(); // ohne Vorschaubild auf dem Server: Foto als Vorschau
    expect(await pullOwnPosts(account(list), ME, db)).toBe(0);
    expect(await db.posts.count()).toBe(3);
  });

  it('Foto nicht abrufbar oder lokal gelöscht: nichts anlegen', async () => {
    const db = freshDb();
    const gone = await createPost({ photos: [photo()] }, db);
    await removePost(gone.id, db);
    const list = [remote({}), remote({ id: gone.id })];
    expect(await pullOwnPosts(account(list, ['srv-1/1.jpg']), ME, db)).toBe(0);
    expect(await db.posts.count()).toBe(1);
  });
});
