// Angeltermin mit Einladung und gemeinsamer Start (Wunsch Nutzer 2026-11-11). Rein, ohne Netz und Speicher:
// Eingeladene am Termin, Start-Anfragen vom Server, Wartezustand des Erstellers.
// Regel (Entscheidung Nutzer): Die Session des Erstellers startet erst, wenn mindestens eine eingeladene Person
// bestätigt hat. Damit er nicht festhängt, kommt nach START_ESCAPE_MS „Ohne … starten“ dazu – und sofort, wenn
// alle abgelehnt haben. „Abbrechen“ gibt es immer.
import { z } from 'zod';
import type { GroupMember } from './groupSessions';

/** So lange wartet der Ersteller, bevor „Ohne … starten“ erscheint */
export const START_ESCAPE_MS = 120_000;
/** Wie der Server: Ersteller + höchstens 9 Eingeladene */
export const MAX_TRIP_INVITEES = 9;
/** Anfragen, die älter sind, zeigt die App nicht mehr (wie der Server: 6 Stunden) */
export const REQUEST_MAX_AGE_MS = 6 * 3_600_000;

export interface Invitee {
  userId: string;
  name: string;
}

/** Person an- oder abwählen; höchstens MAX_TRIP_INVITEES */
export function toggleInvitee(list: readonly Invitee[], who: Invitee): Invitee[] {
  if (list.some((i) => i.userId === who.userId)) return list.filter((i) => i.userId !== who.userId);
  return list.length >= MAX_TRIP_INVITEES ? [...list] : [...list, who];
}

export interface StartRequest {
  id: string;
  hostId: string;
  hostUsername: string;
  hostDisplayName: string;
  title?: string | undefined;
  waterName?: string | undefined;
  startedAt: string;
}

const RequestRow = z.object({
  id: z.string(),
  host_id: z.string(),
  host_username: z.string(),
  host_display_name: z.string(),
  title: z.string().nullable().optional(),
  water_name: z.string().nullable().optional(),
  started_at: z.string(),
});

/** Antwort von my_start_requests; kaputte Zeilen fallen weg */
export function parseStartRequests(rows: readonly unknown[] | null | undefined): StartRequest[] {
  return (rows ?? []).flatMap((r) => {
    const p = RequestRow.safeParse(r);
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
      },
    ];
  });
}

/** Bezeichnung der Session für Fenster und Titel: Name, sonst Gewässer */
export const requestLabel = (r: Pick<StartRequest, 'title' | 'waterName'>) =>
  r.title || r.waterName || undefined;

/** Beim Ersteller gemerkt, solange er auf die Bestätigung wartet (überlebt App-Neustart und Seitenwechsel) */
export interface PendingStart {
  groupId: string;
  title?: string | undefined;
  /** Namen der Eingeladenen, nur zur Anzeige */
  names: string[];
  /** Zeitpunkt der Anfrage (ms) */
  since: number;
}

const PendingSchema = z.object({
  groupId: z.string().min(1).max(64),
  title: z.string().max(120).optional(),
  names: z.array(z.string().max(60)).max(MAX_TRIP_INVITEES),
  since: z.number().int().min(0),
});

export function parsePendingStart(raw: string | null | undefined): PendingStart | undefined {
  if (!raw) return undefined;
  try {
    const p = PendingSchema.safeParse(JSON.parse(raw));
    return p.success ? p.data : undefined;
  } catch {
    return undefined;
  }
}

export type WaitState = 'waiting' | 'confirmed' | 'declined';

/** Stand der Eingeladenen (ohne den Ersteller): einer dabei → bestätigt; alle abgelehnt/gegangen → abgelehnt */
export function waitState(members: readonly GroupMember[]): WaitState {
  const others = members.filter((m) => !m.isHost);
  if (others.some((m) => m.status === 'joined')) return 'confirmed';
  if (others.length > 0 && others.every((m) => m.status === 'declined' || m.status === 'left'))
    return 'declined';
  return 'waiting';
}

/** „Ohne … starten“ gibt es nach START_ESCAPE_MS oder wenn alle abgelehnt haben */
export function canStartWithout(state: WaitState, sinceMs: number, nowMs: number): boolean {
  return state === 'declined' || (state === 'waiting' && nowMs - sinceMs >= START_ESCAPE_MS);
}

/** Namen derer, auf die noch gewartet wird (Einladung offen) */
export function waitingNames(members: readonly GroupMember[]): string[] {
  return members.filter((m) => !m.isHost && m.status === 'invited').map((m) => m.displayName);
}

/** Antwort der Eingeladenen ist veraltet, wenn die Anfrage zu alt ist */
export const requestFresh = (r: Pick<StartRequest, 'startedAt'>, nowMs: number) =>
  nowMs - Date.parse(r.startedAt) < REQUEST_MAX_AGE_MS;
