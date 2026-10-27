// Profilseite (Wunsch Nutzer 2026-10-27): eigenes Profil und Beiträge. Bleibt auf dem Gerät, ist Teil der Sicherung.
// Fotos werden wie beim Fang in derselben Transaktion gespeichert. Ein Beitrag aus einem Fang bekommt Kopien der
// gewählten Fangfotos – so bleibt der Beitrag erhalten, auch wenn der Fang gelöscht wird.
import { PhotoSchema, PROFILE_ID, type Photo, type Post, type Profile } from '../domain/schemas';
import { newId } from '../domain/id';
import { nowIso } from '../domain/time';
import { getDb, type FangpunktDB } from './db';
import { repo } from './repository';
import { ValidationError } from './errors';
import type { NewPhoto } from './catchService';

function photoRows(photos: NewPhoto[], ownerType: Photo['ownerType'], ownerId: string): Photo[] {
  const now = nowIso();
  return photos.map((p) => {
    const check = PhotoSchema.safeParse({
      ...p,
      id: newId(),
      createdAt: now,
      updatedAt: now,
      rev: 0,
      bytes: p.blob.size,
      ownerType,
      ownerId,
    });
    if (!check.success)
      throw new ValidationError(check.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`));
    return check.data;
  });
}

export async function getProfile(db: FangpunktDB = getDb()): Promise<Profile | undefined> {
  const p = await db.profiles.get(PROFILE_ID);
  return p && !p.deletedAt ? p : undefined;
}

/** Name und Text speichern; `avatar`: neues Bild, `null` entfernt das Bild, fehlt = unverändert. */
export async function saveProfile(
  fields: { name: string; bio?: string | undefined },
  avatar?: NewPhoto | null,
  db: FangpunktDB = getDb(),
): Promise<Profile> {
  const r = repo('profiles', db);
  return db.transaction('rw', db.profiles, db.photos, async () => {
    const cur = await db.profiles.get(PROFILE_ID);
    let avatarPhotoId = cur?.avatarPhotoId;
    if (avatar !== undefined) {
      if (avatarPhotoId) await db.photos.delete(avatarPhotoId);
      avatarPhotoId = undefined;
      if (avatar) {
        const [row] = photoRows([avatar], 'profile', PROFILE_ID);
        if (row) {
          await db.photos.add(row);
          avatarPhotoId = row.id;
        }
      }
    }
    const data = { name: fields.name, bio: fields.bio || undefined, avatarPhotoId };
    if (!cur) return r.create({ id: PROFILE_ID, ...data });
    if (cur.deletedAt) await r.restore(PROFILE_ID);
    return r.update(PROFILE_ID, data);
  });
}

/** Neuer Beitrag mit neuen Fotos und/oder Kopien von Fangfotos (`catchPhotoIds`). */
export async function createPost(
  args: {
    caption?: string | undefined;
    catchId?: string | undefined;
    photos: NewPhoto[];
    catchPhotoIds?: string[];
  },
  db: FangpunktDB = getDb(),
): Promise<Post> {
  const r = repo('posts', db);
  return db.transaction('rw', db.posts, db.photos, async () => {
    const postId = newId();
    const copies: Photo[] = [];
    for (const pid of args.catchPhotoIds ?? []) {
      const src = await db.photos.get(pid);
      if (!src) throw new Error(`Foto ${pid} nicht gefunden`);
      const { id: _id, createdAt: _c, updatedAt: _u, rev: _r, ownerType: _o, ownerId: _w, ...rest } = src;
      void [_id, _c, _u, _r, _o, _w];
      copies.push(
        ...photoRows(
          [{ ...rest, width: rest.width ?? 1, height: rest.height ?? 1, thumb: rest.thumb ?? rest.blob }],
          'post',
          postId,
        ),
      );
    }
    const fresh = photoRows(args.photos, 'post', postId);
    const all = [...copies, ...fresh];
    await db.photos.bulkAdd(all);
    return r.create({
      id: postId,
      photoIds: all.map((p) => p.id),
      ...(args.caption ? { caption: args.caption } : {}),
      ...(args.catchId ? { catchId: args.catchId } : {}),
    });
  });
}

export const updatePostCaption = (id: string, caption: string, db: FangpunktDB = getDb()) =>
  repo('posts', db).update(id, { caption: caption || undefined });

export const removePost = (id: string, db: FangpunktDB = getDb()) => repo('posts', db).remove(id);
export const restorePost = (id: string, db: FangpunktDB = getDb()) => repo('posts', db).restore(id);

/** Sichtbare Beiträge, neueste zuerst */
export async function listPosts(db: FangpunktDB = getDb()): Promise<Post[]> {
  const all = await db.posts.orderBy('createdAt').reverse().toArray();
  return all.filter((p) => !p.deletedAt);
}
