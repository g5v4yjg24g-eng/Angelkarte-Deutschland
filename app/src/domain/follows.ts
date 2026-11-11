// Folgen statt Freundschaft (Paket C, Wunsch Nutzer 2026-11-10; Entscheidungen: „Privates Konto“ selbst wählbar,
// Standard privat; Spots und gemeinsame Sessions nur bei gegenseitigem Folgen). Regeln wie in
// supabase/migrations/*_follows.sql – rein, ohne Netz.
import { z } from 'zod';
import { parseBadges, type Badge } from './badges';

export interface FollowEntry {
  userId: string;
  username: string;
  displayName: string;
  badges: Badge[];
  /** aus eigener Sicht: folgt mir (follower) oder ich folge (following) */
  direction: 'follower' | 'following';
  status: 'pending' | 'accepted';
  since: string;
}

const RowSchema = z.object({
  user_id: z.string(),
  username: z.string(),
  display_name: z.string(),
  badges: z.array(z.unknown()).nullable().optional(),
  direction: z.enum(['follower', 'following']),
  status: z.enum(['pending', 'accepted']),
  since: z.string(),
});

/** Antwort von my_follows(); fehlerhafte Zeilen fallen weg */
export function parseFollowRows(rows: readonly unknown[] | null | undefined): FollowEntry[] {
  const out: FollowEntry[] = [];
  for (const r of rows ?? []) {
    const p = RowSchema.safeParse(r);
    if (!p.success) continue;
    const d = p.data;
    out.push({
      userId: d.user_id,
      username: d.username,
      displayName: d.display_name,
      badges: parseBadges((d.badges ?? []).map((badge) => ({ badge }))),
      direction: d.direction,
      status: d.status,
      since: d.since,
    });
  }
  return out;
}

export interface FollowGroups {
  /** möchten mir folgen (privates Konto) */
  requests: FollowEntry[];
  followers: FollowEntry[];
  following: FollowEntry[];
  /** von mir angefragt, noch nicht bestätigt */
  requested: FollowEntry[];
  /** folgen sich gegenseitig (für Spots und gemeinsame Sessions) */
  mutual: Set<string>;
}

const byName = (a: FollowEntry, b: FollowEntry) =>
  a.displayName.localeCompare(b.displayName, 'de', { sensitivity: 'base' });

export function groupFollows(list: readonly FollowEntry[]): FollowGroups {
  const sorted = [...list].sort(byName);
  const followers = sorted.filter((f) => f.direction === 'follower' && f.status === 'accepted');
  const following = sorted.filter((f) => f.direction === 'following' && f.status === 'accepted');
  const followingIds = new Set(following.map((f) => f.userId));
  return {
    requests: sorted.filter((f) => f.direction === 'follower' && f.status === 'pending'),
    followers,
    following,
    requested: sorted.filter((f) => f.direction === 'following' && f.status === 'pending'),
    mutual: new Set(followers.filter((f) => followingIds.has(f.userId)).map((f) => f.userId)),
  };
}

/** Suche in der Liste: Name oder Nutzername, ohne Groß-/Kleinschreibung und ohne führendes „@“; leer = alle */
export function matchesQuery(f: Pick<FollowEntry, 'username' | 'displayName'>, query: string): boolean {
  const q = query.trim().replace(/^@/, '').toLowerCase();
  if (!q) return true;
  return f.username.toLowerCase().includes(q) || f.displayName.toLowerCase().includes(q);
}

export type FollowResult = 'requested' | 'following' | 'already';
export const FollowResultSchema = z.enum(['requested', 'following', 'already']);

export interface FollowCounts {
  followers: number;
  following: number;
  requests: number;
}
const CountsSchema = z.object({ followers: z.number(), following: z.number(), requests: z.number() });
export function parseFollowCounts(rows: readonly unknown[] | null | undefined): FollowCounts {
  const p = CountsSchema.safeParse((rows ?? [])[0]);
  return p.success ? p.data : { followers: 0, following: 0, requests: 0 };
}

/** Fehler des Servers auf eine Fehlerart abbilden */
export type FollowErrorKind =
  'notFound' | 'self' | 'noProfile' | 'tooMany' | 'notSignedIn' | 'offline' | 'unknown';
export function followErrorKind(e: { message?: string; status?: number } | undefined): FollowErrorKind {
  const m = (e?.message ?? '').toLowerCase();
  if (m.includes('not_found')) return 'notFound';
  if (m.includes('self')) return 'self';
  if (m.includes('no_profile')) return 'noProfile';
  if (m.includes('too_many_follows')) return 'tooMany';
  if (m.includes('not signed in') || e?.status === 401) return 'notSignedIn';
  if (m.includes('fetch') || m.includes('network')) return 'offline';
  return 'unknown';
}
