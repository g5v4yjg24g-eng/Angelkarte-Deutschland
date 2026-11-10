// Profilseite (Wunsch Nutzer 2026-10-27): eigenes Profil und Beiträge. Bleibt auf dem Gerät, ist Teil der Sicherung.
// Fotos werden wie beim Fang in derselben Transaktion gespeichert. Ein Beitrag aus einem Fang bekommt Kopien der
// gewählten Fangfotos – so bleibt der Beitrag erhalten, auch wenn der Fang gelöscht wird.
import { toggleHighlight } from '../domain/profile';
import {
  LOCAL_AUTHOR,
  PhotoSchema,
  PROFILE_ID,
  type Photo,
  type Post,
  type PostComment,
  type Profile,
} from '../domain/schemas';
import { likeIdOf } from '../domain/profile';
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
  fields: {
    name: string;
    bio?: string | undefined;
    /** Paket 11 – fehlt = unverändert, leere Liste/undefined in `extras` = entfernen */
    extras?: Pick<Profile, 'targetSpecies' | 'methods' | 'region'>;
  },
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
    const extras = fields.extras
      ? {
          targetSpecies: fields.extras.targetSpecies?.length ? fields.extras.targetSpecies : undefined,
          methods: fields.extras.methods?.length ? fields.extras.methods : undefined,
          region: fields.extras.region,
        }
      : {};
    const data = { name: fields.name, bio: fields.bio || undefined, avatarPhotoId, ...extras };
    if (!cur) return r.create({ id: PROFILE_ID, ...data });
    if (cur.deletedAt) await r.restore(PROFILE_ID);
    return r.update(PROFILE_ID, data);
  });
}

/** Beitrag im Profil anheften/lösen (Paket 11); liefert false, wenn schon drei angeheftet sind */
export async function toggleProfileHighlight(postId: string, db: FangpunktDB = getDb()): Promise<boolean> {
  return db.transaction('rw', db.profiles, async () => {
    const cur = await db.profiles.get(PROFILE_ID);
    const next = toggleHighlight(cur?.highlightPostIds, postId);
    if (next.full) return false;
    const highlightPostIds = next.ids.length ? next.ids : undefined;
    if (!cur) await repo('profiles', db).create({ id: PROFILE_ID, name: '', highlightPostIds });
    else await repo('profiles', db).update(PROFILE_ID, { highlightPostIds });
    return true;
  });
}

/** Neuer Beitrag mit neuen Fotos und/oder Kopien von Fangfotos (`catchPhotoIds`). */
export async function createPost(
  args: {
    caption?: string | undefined;
    catchId?: string | undefined;
    visibility?: Post['visibility'];
    speciesId?: string | undefined;
    lengthCm?: number | undefined;
    /** Highlight einer gemeinsamen Session (Paket 8b) */
    groupId?: string | undefined;
    /** `pending`: mit dem Konto sichern (Etappe 2); `accountId` = angemeldetes Konto */
    share?: 'pending';
    accountId?: string | undefined;
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
      ...(args.visibility ? { visibility: args.visibility } : {}),
      ...(args.speciesId ? { speciesId: args.speciesId } : {}),
      ...(args.lengthCm !== undefined ? { lengthCm: args.lengthCm } : {}),
      ...(args.groupId ? { groupId: args.groupId } : {}),
      ...(args.share ? { share: args.share } : {}),
      ...(args.accountId ? { accountId: args.accountId } : {}),
    });
  });
}

export const updatePost = (
  id: string,
  changes: {
    caption: string;
    visibility: NonNullable<Post['visibility']>;
    speciesId?: string | undefined;
    lengthCm?: number | undefined;
  },
  db: FangpunktDB = getDb(),
) =>
  repo('posts', db).update(id, {
    caption: changes.caption || undefined,
    visibility: changes.visibility,
    // selbst gewählt: kein „bitte prüfen“ mehr
    visibilityAssumed: undefined,
    speciesId: changes.speciesId || undefined,
    lengthCm: changes.lengthCm,
  });

/** „Gefällt mir“ setzen oder zurücknehmen; liefert den neuen Stand. */
export async function toggleLike(
  postId: string,
  authorId = LOCAL_AUTHOR,
  db: FangpunktDB = getDb(),
): Promise<boolean> {
  const id = likeIdOf(authorId, postId);
  const r = repo('postLikes', db);
  return db.transaction('rw', db.postLikes, async () => {
    const cur = await db.postLikes.get(id);
    if (!cur) {
      await r.create({ id, postId, authorId });
      return true;
    }
    if (cur.deletedAt) {
      await r.restore(id);
      return true;
    }
    await r.remove(id);
    return false;
  });
}

/** letzte vergebene Zeit einer Kommentar-ID */
let lastCommentMs = 0;

export async function addComment(
  postId: string,
  text: string,
  authorId = LOCAL_AUTHOR,
  db: FangpunktDB = getDb(),
): Promise<PostComment> {
  // ID beginnt mit der Zeit in ms (streng steigend): Kommentare derselben Sekunde bleiben in ihrer Reihenfolge
  lastCommentMs = Math.max(Date.now(), lastCommentMs + 1);
  const id = `c-${lastCommentMs.toString(36).padStart(9, '0')}-${newId()}`;
  return repo('postComments', db).create({ id, postId, authorId, text: text.trim() });
}

export const removeComment = (id: string, db: FangpunktDB = getDb()) => repo('postComments', db).remove(id);
export const restoreComment = (id: string, db: FangpunktDB = getDb()) => repo('postComments', db).restore(id);

/** Likes (sichtbar) und Kommentare (älteste zuerst) eines Beitrags */
export async function postReactions(postId: string, db: FangpunktDB = getDb()) {
  const [likes, comments] = await Promise.all([
    db.postLikes.where('postId').equals(postId).toArray(),
    db.postComments.where('postId').equals(postId).toArray(),
  ]);
  return {
    likes: likes.filter((l) => !l.deletedAt),
    comments: comments
      .filter((c) => !c.deletedAt)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)),
  };
}

export const removePost = (id: string, db: FangpunktDB = getDb()) => repo('posts', db).remove(id);
export const restorePost = (id: string, db: FangpunktDB = getDb()) => repo('posts', db).restore(id);

/** Sichtbare Beiträge, neueste zuerst */
export async function listPosts(db: FangpunktDB = getDb()): Promise<Post[]> {
  const all = await db.posts.orderBy('createdAt').reverse().toArray();
  return all.filter((p) => !p.deletedAt);
}
