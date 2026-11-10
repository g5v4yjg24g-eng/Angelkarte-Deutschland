// Beiträge mit dem Server abgleichen (Etappe 2; zentrale Bildspeicherung, Freigabe Nutzer 2026-11-10).
// Plan aus domain/postSync.ts, Übertragung über den Konto-Port. Der Teilen-Stand wird direkt gesetzt (ohne rev zu
// ändern); `sharedRev` ≠ `rev` heißt: Änderung nachziehen. Lokale Fotos bleiben immer erhalten.
import type { AccountProvider } from '../ports/account';
import {
  mimeOfPath,
  planPostSync,
  postsToAdopt,
  retryAt,
} from '../domain/postSync';
import type { FeedPost } from '../domain/feed';
import { PhotoSchema, PostSchema, type Photo, type Post } from '../domain/schemas';
import { newId } from '../domain/id';
import { nowIso } from '../domain/time';
import { getDb, type FangpunktDB } from './db';

export interface PostSyncResult {
  done: number;
  failed: number;
}

/** Fehler der Server-Grenze für neue Beiträge (*_discover.sql) */
export const isPostLimitError = (e: unknown) => e instanceof Error && e.message.includes('too_many_posts');

/** Tagesgrenze erreicht: in einer Stunde erneut versuchen */
const LIMIT_RETRY_MS = 60 * 60_000;

/** Was im Hintergrund zu tun ist (Auslöser für den Abgleich) */
export async function pendingPostKey(userId: string, db: FangpunktDB = getDb()): Promise<string> {
  const all = await db.posts.toArray();
  const plan = planPostSync(all, userId, Date.now());
  return [...plan.upload, ...plan.update, ...plan.remove, ...postsToAdopt(all, userId)]
    .map((p) => `${p.id}:${p.rev}:${p.share}:${p.syncRetryAt ?? ''}`)
    .join(',');
}

/**
 * Automatische Übertragung: alles, was nur auf dem Gerät liegt, mit dem angemeldeten Konto sichern.
 * Sichtbarkeit bleibt; fehlt sie, wird „Nur ich“ gesetzt und als „bitte prüfen“ markiert. Liefert die Anzahl.
 */
export async function adoptLocalPosts(userId: string, db: FangpunktDB = getDb()): Promise<number> {
  const ids = new Set(postsToAdopt(await db.posts.toArray(), userId).map((p) => p.id));
  if (!ids.size) return 0;
  return db.posts
    .filter((p) => ids.has(p.id) && !p.share)
    .modify((p) => {
      p.share = 'pending';
      p.accountId = userId;
      if (!p.visibility) {
        p.visibility = 'private';
        p.visibilityAssumed = true;
      }
    });
}

const clearSyncState = (p: Post) => {
  delete p.syncError;
  delete p.syncAttempts;
  delete p.syncRetryAt;
};

async function photosOf(p: Post, db: FangpunktDB) {
  const rows = await db.photos.bulkGet(p.photoIds);
  if (rows.some((r) => !r)) return undefined;
  return rows.flatMap((r) => (r ? [{ blob: r.blob, mime: r.mime, thumb: r.thumb }] : []));
}

export async function syncPosts(
  account: AccountProvider,
  userId: string,
  db: FangpunktDB = getDb(),
  now: number = Date.now(),
): Promise<PostSyncResult> {
  const plan = planPostSync(await db.posts.toArray(), userId, now);
  const result: PostSyncResult = { done: 0, failed: 0 };
  /** Fehlschlag merken: später erneut (mit wachsender Pause) */
  const failedOn = async (id: string, e: unknown) => {
    result.failed++;
    const limited = isPostLimitError(e);
    await db.posts
      .where('id')
      .equals(id)
      .modify((cur) => {
        cur.syncAttempts = (cur.syncAttempts ?? 0) + 1;
        cur.syncError = limited ? 'limited' : 'failed';
        cur.syncRetryAt = limited
          ? new Date(now + LIMIT_RETRY_MS).toISOString()
          : retryAt(cur.syncAttempts, now);
      });
  };

  for (const p of plan.upload) {
    try {
      const photos = await photosOf(p, db);
      if (!photos?.length) {
        // Datei fehlt auf dem Gerät: nie als übertragen melden, nicht endlos versuchen
        result.failed++;
        await db.posts
          .where('id')
          .equals(p.id)
          .modify((cur) => {
            cur.syncError = 'photo_missing';
          });
        continue;
      }
      await account.publishPost({
        id: p.id,
        caption: p.caption,
        visibility: p.visibility ?? 'private',
        createdAt: p.createdAt,
        photos,
        speciesId: p.speciesId,
        lengthCm: p.lengthCm,
        groupId: p.groupId,
      });
      // hochgeladen ist der Stand `p.rev`; spätere Änderungen zieht der nächste Lauf nach
      await db.posts
        .where('id')
        .equals(p.id)
        .modify((cur) => {
          if (cur.share === 'pending') {
            cur.share = 'shared';
            cur.sharedRev = p.rev;
            cur.accountId = userId;
            clearSyncState(cur);
          }
        });
      result.done++;
    } catch (e) {
      await failedOn(p.id, e);
    }
  }
  for (const p of plan.update) {
    try {
      await account.updateSharedPost(p.id, {
        caption: p.caption,
        visibility: p.visibility ?? 'private',
        speciesId: p.speciesId,
        lengthCm: p.lengthCm,
      });
      await db.posts
        .where('id')
        .equals(p.id)
        .modify((cur) => {
          cur.sharedRev = p.rev;
          clearSyncState(cur);
        });
      result.done++;
    } catch (e) {
      await failedOn(p.id, e);
    }
  }
  for (const p of plan.remove) {
    try {
      await account.deleteSharedPost(p.id);
      await db.posts
        .where('id')
        .equals(p.id)
        .modify((cur) => {
          // gelöscht → beim Wiederherstellen erneut hochladen; „nicht mehr teilen“ (ältere Versionen) → als
          // „Nur ich“ wieder sichern
          if (cur.share === 'unshare') {
            delete cur.share;
            cur.visibility = 'private';
          } else cur.share = 'pending';
          delete cur.sharedRev;
          clearSyncState(cur);
        });
      result.done++;
    } catch (e) {
      await failedOn(p.id, e);
    }
  }
  return result;
}

/** „Erneut versuchen“: Wartezeit aufheben (auch nach fehlender Datei wird neu geprüft) */
export async function retryPost(id: string, db: FangpunktDB = getDb()) {
  await db.posts
    .where('id')
    .equals(id)
    .modify((cur) => {
      delete cur.syncRetryAt;
      if (cur.syncError === 'photo_missing') delete cur.syncError;
    });
}

/** Höchstens so viele Seiten eigener Beiträge je Lauf vom Server holen (je 20) */
const PULL_PAGES = 10;

/**
 * Eigenes Profil auf jedem Gerät: Beiträge dieses Kontos, die hier fehlen, samt Fotos vom Server holen.
 * Gleiche ID = gleicher Beitrag, so entstehen keine Doppelten. Lokal gelöschte werden nicht zurückgeholt.
 * Liefert die Anzahl neu geholter Beiträge.
 */
export async function pullOwnPosts(
  account: AccountProvider,
  userId: string,
  db: FangpunktDB = getDb(),
): Promise<number> {
  let added = 0;
  let before: string | undefined;
  for (let page = 0; page < PULL_PAGES; page++) {
    const list: FeedPost[] = await account.userPosts(userId, before);
    if (!list.length) break;
    for (const sp of list) {
      if (sp.authorId !== userId || (await db.posts.get(sp.id))) continue;
      if (await storePulled(account, userId, sp, db)) added++;
    }
    before = list[list.length - 1]?.createdAt;
    if (list.length < 20) break;
  }
  return added;
}

async function storePulled(account: AccountProvider, userId: string, sp: FeedPost, db: FangpunktDB) {
  const now = nowIso();
  const photos: Photo[] = [];
  const files = await account.downloadPostPhotos(sp.photoPaths);
  if (!files || files.length !== sp.photoPaths.length) return false;
  for (const [i, path] of sp.photoPaths.entries()) {
    const file = files[i];
    if (!file) return false;
    const { blob } = file;
    // ohne Vorschaubild auf dem Server: Foto als Vorschau
    const thumb = file.thumb ?? blob;
    const row = PhotoSchema.safeParse({
      id: newId(),
      createdAt: now,
      updatedAt: now,
      rev: 0,
      mime: mimeOfPath(path),
      bytes: blob.size,
      ownerType: 'post',
      ownerId: sp.id,
      blob,
      thumb,
    });
    if (!row.success) return false;
    photos.push(row.data);
  }
  const post = PostSchema.safeParse({
    id: sp.id,
    createdAt: sp.createdAt,
    updatedAt: now,
    rev: 0,
    photoIds: photos.map((p) => p.id),
    ...(sp.caption ? { caption: sp.caption } : {}),
    visibility: sp.visibility,
    ...(sp.speciesId ? { speciesId: sp.speciesId } : {}),
    ...(sp.lengthCm !== undefined ? { lengthCm: sp.lengthCm } : {}),
    ...(sp.groupId ? { groupId: sp.groupId } : {}),
    share: 'shared',
    sharedRev: 0,
    accountId: userId,
  });
  if (!post.success) return false;
  return db.transaction('rw', db.posts, db.photos, async () => {
    // zwischenzeitlich hier angelegt (z. B. zweiter Tab)? Dann nichts tun
    if (await db.posts.get(sp.id)) return false;
    await db.photos.bulkAdd(photos);
    await db.posts.add(post.data);
    return true;
  });
}
