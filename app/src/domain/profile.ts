// Profilseite (Wunsch Nutzer 2026-10-27): Regeln für Profil und Beiträge – rein, ohne DB.
import { MAX_PHOTOS_PER_POST } from './schemas';

export const PROFILE_NAME_MAX = 40;
export const PROFILE_BIO_MAX = 300;
export const POST_CAPTION_MAX = 2200;
export { MAX_PHOTOS_PER_POST };

export const profileNameValid = (name: string) => {
  const n = name.trim();
  return n.length > 0 && n.length <= PROFILE_NAME_MAX;
};

/** Wie viele Fotos noch dazukommen dürfen */
export const photoRoom = (count: number) => Math.max(0, MAX_PHOTOS_PER_POST - count);

/** Ein Beitrag braucht mindestens ein Foto */
export const canPublish = (photoCount: number) => photoCount > 0 && photoCount <= MAX_PHOTOS_PER_POST;

export const COMMENT_MAX = 1000;

/** Je Verfasser höchstens ein „Gefällt mir“ je Beitrag */
export const likeIdOf = (authorId: string, postId: string) => `like-${authorId}-${postId}`;

export const commentValid = (text: string) => {
  const t = text.trim();
  return t.length > 0 && t.length <= COMMENT_MAX;
};
