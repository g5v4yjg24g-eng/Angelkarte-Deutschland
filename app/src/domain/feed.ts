// Feed (Etappe 3): Beiträge von Freunden und eigene, neueste zuerst; Entdecken (Paket 7c). Rein, ohne Netz.
import { z } from 'zod';
import { parseBadges, type Badge } from './badges';
import { PostVisibilitySchema, type PostVisibility } from './schemas';

export interface FeedPost {
  id: string;
  authorId: string;
  username: string;
  displayName: string;
  badges: Badge[];
  caption?: string | undefined;
  visibility: PostVisibility;
  photoPaths: string[];
  createdAt: string;
  /** Fischart und Länge (Paket 7a, freiwillig) */
  speciesId?: string | undefined;
  lengthCm?: number | undefined;
  /** Highlight einer gemeinsamen Session (Paket 8b) mit deren Titel */
  groupId?: string | undefined;
  groupTitle?: string | undefined;
  /** nur bei „Entdecken“: wann geteilt (Sortierung, Nachladen) */
  sharedAt?: string | undefined;
  /** nur bei „Gespeichert“: wann gespeichert (Sortierung, Nachladen) */
  savedAt?: string | undefined;
  /** zeitlich begrenzte Adressen der Fotos (gleiche Reihenfolge wie photoPaths; fehlt eins, ist es leer) */
  photoUrls: string[];
}

export const FEED_PAGE = 20;

const RowSchema = z.object({
  id: z.string(),
  author_id: z.string(),
  username: z.string(),
  display_name: z.string(),
  badges: z.array(z.unknown()).nullable().optional(),
  caption: z.string().nullable().optional(),
  visibility: PostVisibilitySchema,
  photo_paths: z.array(z.string()).min(1),
  created_at: z.string(),
  species_id: z.string().nullable().optional(),
  length_cm: z.union([z.number(), z.string()]).nullable().optional(),
  saved_at: z.string().nullable().optional(),
  shared_at: z.string().nullable().optional(),
  group_session_id: z.string().nullable().optional(),
  group_title: z.string().nullable().optional(),
});

export function parseFeedRows(rows: readonly unknown[] | null | undefined): Omit<FeedPost, 'photoUrls'>[] {
  const out: Omit<FeedPost, 'photoUrls'>[] = [];
  for (const r of rows ?? []) {
    const p = RowSchema.safeParse(r);
    if (!p.success) continue;
    const d = p.data;
    out.push({
      id: d.id,
      authorId: d.author_id,
      username: d.username,
      displayName: d.display_name,
      badges: parseBadges((d.badges ?? []).map((badge) => ({ badge }))),
      caption: d.caption ?? undefined,
      visibility: d.visibility,
      photoPaths: d.photo_paths,
      createdAt: d.created_at,
      ...(d.species_id ? { speciesId: d.species_id } : {}),
      ...(d.length_cm !== null && d.length_cm !== undefined && Number.isFinite(Number(d.length_cm))
        ? { lengthCm: Number(d.length_cm) }
        : {}),
      ...(d.saved_at ? { savedAt: d.saved_at } : {}),
      ...(d.shared_at ? { sharedAt: d.shared_at } : {}),
      ...(d.group_session_id ? { groupId: d.group_session_id } : {}),
      ...(d.group_title ? { groupTitle: d.group_title } : {}),
    });
  }
  return out;
}

/** Neue Seite anhängen: ohne Doppelte, neueste zuerst */
export function mergeFeed(current: readonly FeedPost[], next: readonly FeedPost[]): FeedPost[] {
  const seen = new Set(current.map((p) => p.id));
  return [...current, ...next.filter((p) => !seen.has(p.id))].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );
}

/** Gibt es vermutlich mehr? (volle Seite geladen) */
export const hasMore = (page: readonly unknown[]) => page.length >= FEED_PAGE;

/** Anfangsbuchstabe für das Profilbild-Ersatzzeichen */
export const initialOf = (name: string) => (name.trim()[0] ?? '?').toLocaleUpperCase('de-DE');
