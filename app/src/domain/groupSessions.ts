// Gemeinsame Sessions, Schritt 8a (Freigabe Nutzer 2026-11-06): einladen (nur Freunde, höchstens 10 Teilnehmer),
// zusagen/ablehnen, Teilnehmer, verlassen. Der Server kennt keine Positionen, Routen oder Fänge. Rein, ohne Netz.
import { z } from 'zod';
import type { FriendEntry } from './friends';

export const MAX_GROUP_MEMBERS = 10;

export type GroupMemberStatus = 'invited' | 'joined' | 'declined' | 'left';

export interface GroupSession {
  id: string;
  hostId: string;
  hostUsername: string;
  hostDisplayName: string;
  title?: string | undefined;
  waterName?: string | undefined;
  startedAt: string;
  endedAt?: string | undefined;
  myStatus: 'invited' | 'joined' | 'left';
  joinedCount: number;
}

export interface GroupMember {
  userId: string;
  username: string;
  displayName: string;
  status: GroupMemberStatus;
  isHost: boolean;
}

const SessionRow = z.object({
  id: z.string(),
  host_id: z.string(),
  host_username: z.string(),
  host_display_name: z.string(),
  title: z.string().nullable().optional(),
  water_name: z.string().nullable().optional(),
  started_at: z.string(),
  ended_at: z.string().nullable().optional(),
  my_status: z.enum(['invited', 'joined', 'left']),
  joined_count: z.number().int().min(0),
});

const MemberRow = z.object({
  user_id: z.string(),
  username: z.string(),
  display_name: z.string(),
  status: z.enum(['invited', 'joined', 'declined', 'left']),
  is_host: z.boolean(),
});

/** Antwort von my_group_sessions; kaputte Zeilen fallen weg */
export function parseGroupSessions(rows: readonly unknown[] | null | undefined): GroupSession[] {
  return (rows ?? []).flatMap((r) => {
    const p = SessionRow.safeParse(r);
    if (!p.success) return [];
    const d = p.data;
    return [
      {
        id: d.id,
        hostId: d.host_id,
        hostUsername: d.host_username,
        hostDisplayName: d.host_display_name,
        title: d.title ?? undefined,
        waterName: d.water_name ?? undefined,
        startedAt: d.started_at,
        endedAt: d.ended_at ?? undefined,
        myStatus: d.my_status,
        joinedCount: d.joined_count,
      },
    ];
  });
}

/** Antwort von group_session_members_list */
export function parseGroupMembers(rows: readonly unknown[] | null | undefined): GroupMember[] {
  return (rows ?? []).flatMap((r) => {
    const p = MemberRow.safeParse(r);
    if (!p.success) return [];
    const d = p.data;
    return [
      {
        userId: d.user_id,
        username: d.username,
        displayName: d.display_name,
        status: d.status,
        isHost: d.is_host,
      },
    ];
  });
}

/** Offene Einladungen: eingeladen und die Session läuft noch */
export const openInvites = (list: readonly GroupSession[]) =>
  list.filter((g) => g.myStatus === 'invited' && !g.endedAt);

/** Freie Plätze (Gastgeber, Eingeladene und Teilnehmer zählen) */
export function freeSlots(members: readonly GroupMember[]): number {
  const taken = members.filter((m) => m.status === 'invited' || m.status === 'joined').length;
  return Math.max(0, MAX_GROUP_MEMBERS - Math.max(1, taken));
}

/**
 * Wen man noch einladen kann: angenommene Freunde, die nicht schon eingeladen oder dabei sind und nicht abgelehnt
 * haben (so prüft es auch der Server). Wer gegangen ist, darf erneut eingeladen werden.
 */
export function invitableFriends(
  friends: readonly FriendEntry[],
  members: readonly GroupMember[],
): FriendEntry[] {
  const blocked = new Set(members.filter((m) => m.status !== 'left').map((m) => m.userId));
  return friends
    .filter((f) => f.status === 'accepted' && !blocked.has(f.userId))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'de'));
}

export type GroupErrorKey =
  'notFound' | 'ended' | 'tooManyMembers' | 'tooMany' | 'banned' | 'host' | 'noInvitees' | 'unknown';

/** Fehlertext des Servers → Schlüssel für die Anzeige */
export function groupErrorKey(e: unknown): GroupErrorKey {
  const m = e instanceof Error ? e.message : String(e);
  if (m.includes('no_invitees')) return 'noInvitees';
  if (m.includes('too_many_members')) return 'tooManyMembers';
  if (m.includes('too_many')) return 'tooMany';
  if (m.includes('not_found')) return 'notFound';
  if (m.includes('ended')) return 'ended';
  if (m.includes('banned')) return 'banned';
  if (m.includes('host')) return 'host';
  return 'unknown';
}

/** Anzeigename der gemeinsamen Session */
export const groupLabel = (g: Pick<GroupSession, 'title' | 'waterName'>) => g.title ?? g.waterName;
