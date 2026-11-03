// Freunde (Etappe 1, Entscheidung Nutzer 2026-11-03: Freundschaftsanfrage). Regeln wie in
// supabase/migrations/*_friendships.sql – rein, ohne Netz.
import { z } from 'zod';
import { parseBadges, type Badge } from './badges';

export interface FriendEntry {
  requestId: string;
  userId: string;
  username: string;
  displayName: string;
  status: 'pending' | 'accepted';
  /** wer angefragt hat, aus eigener Sicht */
  direction: 'incoming' | 'outgoing';
  badges: Badge[];
  since: string;
}

const RowSchema = z.object({
  request_id: z.string(),
  user_id: z.string(),
  username: z.string(),
  display_name: z.string(),
  status: z.enum(['pending', 'accepted']),
  direction: z.enum(['incoming', 'outgoing']),
  badges: z.array(z.unknown()).nullable().optional(),
  since: z.string(),
});

/** Antwort von my_friends(); fehlerhafte Zeilen fallen weg */
export function parseFriendRows(rows: readonly unknown[] | null | undefined): FriendEntry[] {
  const out: FriendEntry[] = [];
  for (const r of rows ?? []) {
    const p = RowSchema.safeParse(r);
    if (!p.success) continue;
    const d = p.data;
    out.push({
      requestId: d.request_id,
      userId: d.user_id,
      username: d.username,
      displayName: d.display_name,
      status: d.status,
      direction: d.direction,
      badges: parseBadges((d.badges ?? []).map((badge) => ({ badge }))),
      since: d.since,
    });
  }
  return out;
}

export interface FriendGroups {
  incoming: FriendEntry[];
  outgoing: FriendEntry[];
  friends: FriendEntry[];
}

const byName = (a: FriendEntry, b: FriendEntry) =>
  a.displayName.localeCompare(b.displayName, 'de', { sensitivity: 'base' });

export function groupFriends(list: readonly FriendEntry[]): FriendGroups {
  const sorted = [...list].sort(byName);
  return {
    incoming: sorted.filter((f) => f.status === 'pending' && f.direction === 'incoming'),
    outgoing: sorted.filter((f) => f.status === 'pending' && f.direction === 'outgoing'),
    friends: sorted.filter((f) => f.status === 'accepted'),
  };
}

export type FriendRequestResult = 'sent' | 'accepted' | 'already';
export const FriendRequestResultSchema = z.enum(['sent', 'accepted', 'already']);

/** Fehler des Servers auf eine Fehlerart abbilden */
export type FriendErrorKind = 'notFound' | 'self' | 'noProfile' | 'notSignedIn' | 'offline' | 'unknown';
export function friendErrorKind(e: { message?: string; status?: number } | undefined): FriendErrorKind {
  const m = (e?.message ?? '').toLowerCase();
  if (m.includes('not_found')) return 'notFound';
  if (m.includes('self')) return 'self';
  if (m.includes('no_profile')) return 'noProfile';
  if (m.includes('not signed in') || e?.status === 401) return 'notSignedIn';
  if (m.includes('fetch') || m.includes('network')) return 'offline';
  return 'unknown';
}
