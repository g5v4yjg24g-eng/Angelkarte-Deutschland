// Beiträge mit dem Server abgleichen (Etappe 2): Plan aus domain/postSync.ts, Upload über den Konto-Port.
// Der Teilen-Stand wird direkt gesetzt (ohne rev zu ändern); `sharedRev` ≠ `rev` heißt: Änderung nachziehen.
import type { AccountProvider } from '../ports/account';
import { planPostSync } from '../domain/postSync';
import type { Post } from '../domain/schemas';
import { getDb, type FangpunktDB } from './db';

export interface PostSyncResult {
  done: number;
  failed: number;
  /** Server-Grenze erreicht (Paket 7c: höchstens 20 neue Beiträge in 24 h) – Beiträge, die deshalb warten */
  limited: string[];
}

/** Fehler der Server-Grenze für neue Beiträge (*_discover.sql) */
export const isPostLimitError = (e: unknown) => e instanceof Error && e.message.includes('too_many_posts');

/** Beiträge, die etwas mit dem Server zu tun haben (für den Auslöser im Hintergrund) */
export async function pendingPostKey(db: FangpunktDB = getDb()): Promise<string> {
  const all = await db.posts.toArray();
  const plan = planPostSync(all);
  return [...plan.upload, ...plan.update, ...plan.remove].map((p) => `${p.id}:${p.rev}:${p.share}`).join(',');
}

async function photosOf(p: Post, db: FangpunktDB) {
  const rows = await db.photos.bulkGet(p.photoIds);
  return rows.flatMap((r) => (r ? [{ blob: r.blob, mime: r.mime }] : []));
}

export async function syncPosts(
  account: AccountProvider,
  db: FangpunktDB = getDb(),
): Promise<PostSyncResult> {
  const plan = planPostSync(await db.posts.toArray());
  const result: PostSyncResult = { done: 0, failed: 0, limited: [] };
  const step = async (fn: () => Promise<void>, id?: string) => {
    try {
      await fn();
      result.done++;
    } catch (e) {
      result.failed++;
      if (id && isPostLimitError(e)) result.limited.push(id);
    }
  };
  for (const p of plan.upload)
    await step(async () => {
      const photos = await photosOf(p, db);
      if (!photos.length) throw new Error('keine Fotos');
      await account.publishPost({
        id: p.id,
        caption: p.caption,
        visibility: p.visibility ?? 'friends',
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
          }
        });
    }, p.id);
  for (const p of plan.update)
    await step(async () => {
      await account.updateSharedPost(p.id, {
        caption: p.caption,
        visibility: p.visibility ?? 'friends',
        speciesId: p.speciesId,
        lengthCm: p.lengthCm,
      });
      await db.posts
        .where('id')
        .equals(p.id)
        .modify((cur) => {
          cur.sharedRev = p.rev;
        });
    });
  for (const p of plan.remove)
    await step(async () => {
      await account.deleteSharedPost(p.id);
      await db.posts
        .where('id')
        .equals(p.id)
        .modify((cur) => {
          // „nicht mehr teilen“ → nur noch lokal; gelöscht → beim Wiederherstellen erneut hochladen
          cur.share = cur.share === 'unshare' ? undefined : 'pending';
          delete cur.sharedRev;
        });
    });
  return result;
}

/** Teilen anstoßen oder zurücknehmen (ändert rev nicht) */
export async function setShare(id: string, share: 'pending' | 'unshare', db: FangpunktDB = getDb()) {
  await db.posts
    .where('id')
    .equals(id)
    .modify((cur) => {
      if (share === 'pending')
        cur.share = cur.share === 'unshare' || cur.share === 'shared' ? 'shared' : 'pending';
      else cur.share = cur.share === 'pending' ? undefined : 'unshare';
    });
}
