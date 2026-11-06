// Profilbild auf dem Server (Paket 2b, Freigabe Nutzer 2026-11-06). Rein, ohne Netz/DB.
// Das Profilbild wird auf dem Gerät gewählt und zugeschnitten; angemeldet wird es hochgeladen, damit Freunde es sehen.
// Gemerkt wird je Konto, welches lokale Bild zuletzt erfolgreich hochgeladen wurde.

/** Grenze des Speichers „avatars“ (*_avatars.sql) */
export const AVATAR_MAX_BYTES = 1_048_576;

export interface AvatarSynced {
  userId: string;
  /** zuletzt hochgeladenes lokales Foto; null = Bild wurde auf dem Server entfernt */
  photoId: string | null;
}

export type AvatarSyncPlan = 'upload' | 'clear' | 'none';

/**
 * Was zu tun ist:
 * - lokales Bild, das für dieses Konto noch nicht oben ist → hochladen
 * - lokal entfernt, nachdem für dieses Konto schon eins oben war → auf dem Server entfernen
 * - sonst nichts. Nie ein Server-Bild entfernen, das dieses Gerät nicht selbst hochgeladen hat (anderes Gerät).
 */
export function planAvatarSync(
  localPhotoId: string | undefined,
  synced: AvatarSynced | undefined,
  userId: string,
): AvatarSyncPlan {
  const mine = synced?.userId === userId ? synced : undefined;
  if (localPhotoId) return mine?.photoId === localPhotoId ? 'none' : 'upload';
  return mine?.photoId ? 'clear' : 'none';
}

/** Pfad im Speicher: <Nutzer-ID>/<Version>.jpg – neue Version = neue Adresse, kein veraltetes Bild im Cache */
export function avatarPath(userId: string, version: string): string {
  return `${userId}/${version.replace(/-/g, '').toLowerCase()}.jpg`;
}

// Nutzer-ID (auf dem Server eine UUID) / 32 Hex-Zeichen .jpg – keine weiteren Ordner, keine Punkte im Ordnernamen
const PATH = /^[0-9a-z-]{1,36}\/[0-9a-f]{32}\.jpg$/;
export const isAvatarPath = (p: unknown): p is string => typeof p === 'string' && PATH.test(p);

/** Zeilen von avatar_paths(users) → Nutzer-ID → Pfad (unbrauchbare Zeilen fallen weg) */
export function parseAvatarRows(rows: readonly unknown[] | null | undefined): Map<string, string> {
  const out = new Map<string, string>();
  for (const r of rows ?? []) {
    if (!r || typeof r !== 'object') continue;
    const { user_id: id, avatar_path: path } = r as Record<string, unknown>;
    if (typeof id === 'string' && isAvatarPath(path)) out.set(id, path);
  }
  return out;
}

/** Einmal gemerkten Stand lesen (aus dem Gerätespeicher, beliebiger Inhalt) */
export function parseSynced(raw: string | null): AvatarSynced | undefined {
  if (!raw) return undefined;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object') return undefined;
    const { userId, photoId } = v as Record<string, unknown>;
    if (typeof userId !== 'string' || !(photoId === null || typeof photoId === 'string')) return undefined;
    return { userId, photoId };
  } catch {
    return undefined;
  }
}
