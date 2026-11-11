// Termin-Einladungen (Wunsch Nutzer 2026-11-11): Was die eingeladene Person sieht und was daraus im eigenen Kalender
// wird; was der Ersteller über Zu- und Absagen erfährt. Rein, ohne Netz. Gespeichert werden auf dem Server nur
// Titel, Gewässername (Text), Tag und Uhrzeit – keine Position, keine Notizen.
import { z } from 'zod';
import type { Trip } from './schemas';

export type InviteStatus = 'invited' | 'accepted' | 'declined';

export interface TripInvite {
  tripId: string;
  hostId: string;
  hostUsername: string;
  hostDisplayName: string;
  title?: string | undefined;
  waterName?: string | undefined;
  date: string;
  from?: string | undefined;
  to?: string | undefined;
  tz: string;
  status: InviteStatus;
}

const Row = z.object({
  trip_id: z.string(),
  host_id: z.string(),
  host_username: z.string(),
  host_display_name: z.string(),
  title: z.string().nullable().optional(),
  water_name: z.string().nullable().optional(),
  trip_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  from_time: z.string().nullable().optional(),
  to_time: z.string().nullable().optional(),
  tz: z.string(),
  status: z.enum(['invited', 'accepted', 'declined']),
});

/** Antwort von my_trip_invites; kaputte Zeilen fallen weg */
export function parseTripInvites(rows: readonly unknown[] | null | undefined): TripInvite[] {
  return (rows ?? []).flatMap((r) => {
    const p = Row.safeParse(r);
    if (!p.success) return [];
    const d = p.data;
    return [
      {
        tripId: d.trip_id,
        hostId: d.host_id,
        hostUsername: d.host_username,
        hostDisplayName: d.host_display_name,
        title: d.title ?? undefined,
        waterName: d.water_name ?? undefined,
        date: d.trip_date,
        from: d.from_time ?? undefined,
        to: d.to_time ?? undefined,
        tz: d.tz,
        status: d.status,
      },
    ];
  });
}

/** Felder des eigenen Termins aus einer Einladung (gleiche ID wie beim Ersteller: so entsteht er nur einmal) */
export function tripFromInvite(i: TripInvite): Omit<Trip, 'createdAt' | 'updatedAt' | 'rev' | 'deletedAt'> {
  return {
    id: i.tripId,
    date: i.date,
    ...(i.from ? { from: i.from } : {}),
    ...(i.to && i.from ? { to: i.to } : {}),
    tz: i.tz,
    ...(i.title ? { title: i.title } : {}),
    ...(i.waterName ? { waterSnapshot: { name: i.waterName } } : {}),
    invitedBy: { userId: i.hostId, name: i.hostDisplayName },
  };
}

/** Offene Einladungen (noch nicht beantwortet), nach Tag */
export const openInvites = (list: readonly TripInvite[]) =>
  list.filter((i) => i.status === 'invited').sort((a, b) => a.date.localeCompare(b.date));

/** Zugesagte, die auf diesem Gerät (noch) fehlen – z. B. nach Zusage auf einem anderen Gerät.
 *  Auch gelöschte Termine zählen als „vorhanden“: wer ihn gelöscht hat, bekommt ihn nicht zurück. */
export function missingAccepted(list: readonly TripInvite[], knownIds: ReadonlySet<string>): TripInvite[] {
  return list.filter((i) => i.status === 'accepted' && !knownIds.has(i.tripId));
}

export interface TripReply {
  tripId: string;
  userId: string;
  status: InviteStatus;
}

const ReplyRow = z.object({
  trip_id: z.string(),
  user_id: z.string(),
  status: z.enum(['invited', 'accepted', 'declined']),
});

/** Antwort von trip_invite_statuses */
export function parseTripReplies(rows: readonly unknown[] | null | undefined): TripReply[] {
  return (rows ?? []).flatMap((r) => {
    const p = ReplyRow.safeParse(r);
    return p.success ? [{ tripId: p.data.trip_id, userId: p.data.user_id, status: p.data.status }] : [];
  });
}

/** Eingeladene mit Antwort: „Anna“ (offen), „Anna (zugesagt)“ … */
export function invitedWithReplies(
  invited: readonly { userId: string; name: string }[],
  replies: readonly TripReply[],
  tripId: string,
  words: { accepted: string; declined: string },
): string[] {
  return invited.map((i) => {
    const r = replies.find((x) => x.tripId === tripId && x.userId === i.userId);
    if (r?.status === 'accepted') return `${i.name} (${words.accepted})`;
    if (r?.status === 'declined') return `${i.name} (${words.declined})`;
    return i.name;
  });
}

/** Eingeladene, deren Einladung noch nicht beim Server angekommen ist (Netz fehlte beim Speichern) */
export const unsentInvitees = (trip: Pick<Trip, 'invited'>) => (trip.invited ?? []).filter((i) => !i.sent);
