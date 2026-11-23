// Pause, Weiter und Ende in gemeinsamen Sessions (Wunsch Nutzer 2026-11-21): Meldungen der anderen Teilnehmer lesen,
// entscheiden, was die eigene Session daraus macht, und erkennen, wann die eigene Session etwas zu melden hat. Rein.
import { z } from 'zod';
import type { Session } from './schemas';
import { openPause } from './session';

export const SIGNAL_KINDS = ['pause', 'resume', 'end'] as const;
export type SignalKind = (typeof SIGNAL_KINDS)[number];

export interface SessionSignal {
  id: string;
  groupId: string;
  kind: SignalKind;
  byUserId: string;
  byUsername: string;
  byDisplayName: string;
  /** Zeitpunkt der Meldung (ISO) */
  at: string;
  sessionTitle?: string | undefined;
  /** die gemeinsame Session ist auf dem Server schon beendet */
  sessionEnded: boolean;
}

const RowSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  kind: z.enum(SIGNAL_KINDS),
  by_user_id: z.string(),
  by_username: z.string(),
  by_display_name: z.string(),
  at: z.string(),
  session_title: z.string().nullable().optional(),
  session_ended: z.boolean().optional().default(false),
});

/** Antwort von my_session_signals; kaputte Zeilen fallen weg, älteste zuerst */
export function parseSessionSignals(rows: readonly unknown[] | null | undefined): SessionSignal[] {
  return (rows ?? [])
    .flatMap((r) => {
      const p = RowSchema.safeParse(r);
      if (!p.success) return [];
      const d = p.data;
      return [
        {
          id: d.id,
          groupId: d.session_id,
          kind: d.kind,
          byUserId: d.by_user_id,
          byUsername: d.by_username,
          byDisplayName: d.by_display_name,
          at: d.at,
          sessionTitle: d.session_title ?? undefined,
          sessionEnded: d.session_ended,
        },
      ];
    })
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

export type LocalState = 'running' | 'paused' | 'ended';
export const localState = (s: Pick<Session, 'endAt' | 'pauses'>): LocalState =>
  s.endAt ? 'ended' : openPause(s) ? 'paused' : 'running';

/** Was die eigene Session auf eine Meldung hin tun würde (`none` = nichts zu tun) */
export type SignalPlan = { action: 'pause' | 'resume' | 'end'; atMs: number } | { action: 'none' };

/**
 * Zeitpunkt der Übernahme: der Moment der Meldung, aber nie vor dem Beginn der eigenen Session oder der letzten Pause
 * und nie in der Zukunft.
 */
export function signalTime(signalAtMs: number, session: Session, nowMs: number): number {
  const start = Date.parse(session.startAt);
  const lastPause = session.pauses?.at(-1);
  const floor = Math.max(start, lastPause ? Date.parse(lastPause.to ?? lastPause.from) : 0);
  return Math.min(Math.max(signalAtMs, floor), nowMs);
}

export function planSignal(signal: SessionSignal, session: Session | undefined, nowMs: number): SignalPlan {
  if (!session || session.deletedAt || session.groupId !== signal.groupId) return { action: 'none' };
  const state = localState(session);
  if (state === 'ended') return { action: 'none' };
  const atMs = signalTime(Date.parse(signal.at), session, nowMs);
  if (signal.kind === 'pause') return state === 'running' ? { action: 'pause', atMs } : { action: 'none' };
  if (signal.kind === 'resume') return state === 'paused' ? { action: 'resume', atMs } : { action: 'none' };
  return { action: 'end', atMs };
}

/** Was die eigene Session den anderen melden muss, wenn sie von `before` nach `after` wechselt */
export function announcement(before: LocalState | undefined, after: LocalState): SignalKind | undefined {
  if (before === undefined || before === after) return undefined;
  if (after === 'ended') return 'end';
  if (after === 'paused') return 'pause';
  return before === 'paused' ? 'resume' : undefined;
}

/** Meldungen länger als 12 Stunden zeigt der Server nicht mehr; die App verwirft auch lokal veraltete */
export const SIGNAL_MAX_AGE_MS = 12 * 3_600_000;
export const isFreshSignal = (s: Pick<SessionSignal, 'at'>, nowMs: number) =>
  nowMs - Date.parse(s.at) <= SIGNAL_MAX_AGE_MS;
