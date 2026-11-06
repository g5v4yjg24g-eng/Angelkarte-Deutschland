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

/**
 * Länge am Beitrag aus der Eingabe (Paket 7a): leer = keine Angabe, Komma erlaubt, 0 < Länge ≤ 250 cm, auf 0,5 cm
 * gerundet wie im Fangbuch üblich. `invalid` bei unbrauchbarer Eingabe.
 */
export function parsePostLength(text: string): number | undefined | 'invalid' {
  const t = text.trim().replace(',', '.');
  if (!t) return undefined;
  if (!/^\d{1,3}(\.\d+)?$/.test(t)) return 'invalid';
  const n = Math.round(Number(t) * 10) / 10;
  return n > 0 && n <= 250 ? n : 'invalid';
}

/** Länge zum Anzeigen im Eingabefeld (Komma) */
export const lengthText = (cm: number | undefined) => (cm === undefined ? '' : String(cm).replace('.', ','));
