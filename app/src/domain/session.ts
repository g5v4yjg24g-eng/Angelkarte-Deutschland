// Angelsessions (DATA_MODEL §5.3): höchstens eine läuft; > 24 h deutet auf ein vergessenes Ende hin.
import type { Catch, Session } from './schemas';

export const FORGOTTEN_AFTER_MS = 24 * 3600e3;

export const isRunning = (s: Session) => !s.deletedAt && !s.endAt;

/** Die laufende Session (es darf nur eine geben). */
export function runningSession(sessions: readonly Session[]): Session | undefined {
  return sessions.find(isRunning);
}

export function durationMs(s: Session, nowMs: number): number {
  const end = s.endAt ? Date.parse(s.endAt) : nowMs;
  return Math.max(0, end - Date.parse(s.startAt));
}

// Eigene Strukturtypen statt Session: SessionSchema nutzt pauseIssue (sonst Typ-Zyklus).
export interface Pause {
  from: string;
  to?: string | undefined;
}
interface Timed {
  startAt: string;
  endAt?: string | undefined;
  pauses?: Pause[] | undefined;
}
const MIN = 60000;

/** Laufende Pause (nur bei laufender Session). */
export function openPause(s: Pick<Timed, 'pauses' | 'endAt'>): Pause | undefined {
  const last = s.pauses?.at(-1);
  return !s.endAt && last && !last.to ? last : undefined;
}

/** Summe der Pausen, begrenzt auf Beginn bis Ende (bzw. jetzt). */
export function pauseMs(s: Timed, nowMs: number): number {
  const start = Date.parse(s.startAt);
  const end = s.endAt ? Date.parse(s.endAt) : nowMs;
  return (s.pauses ?? []).reduce((sum, p) => {
    const a = Math.max(start, Date.parse(p.from));
    const b = Math.min(end, p.to ? Date.parse(p.to) : end);
    return sum + Math.max(0, b - a);
  }, 0);
}

/** Aktive Angelzeit = Dauer ohne Pausen (DATA_MODEL §9). */
export function activeMs(s: Session, nowMs: number): number {
  return Math.max(0, durationMs(s, nowMs) - pauseMs(s, nowMs));
}

export type PauseIssue = 'order' | 'outside' | 'overlap' | 'open';

/**
 * Prüft die Pausen einer Session (minutengenau wie `covers`): Ende nicht vor Beginn, innerhalb der Session,
 * zeitlich sortiert ohne Überschneidung, offen höchstens die letzte einer laufenden Session.
 */
export function pauseIssue(s: Timed): PauseIssue | undefined {
  const ps = s.pauses ?? [];
  const start = Math.floor(Date.parse(s.startAt) / MIN) * MIN;
  const end = s.endAt ? Math.ceil(Date.parse(s.endAt) / MIN) * MIN : Infinity;
  let prevEnd = -Infinity;
  for (const [i, p] of ps.entries()) {
    const from = Date.parse(p.from);
    const to = p.to ? Date.parse(p.to) : undefined;
    if (to === undefined && (i !== ps.length - 1 || s.endAt)) return 'open';
    if (to !== undefined && to < from) return 'order';
    if (from < start || (to ?? from) > end) return 'outside';
    if (from < prevEnd) return 'overlap';
    prevEnd = to ?? Infinity;
  }
  return undefined;
}

/** Pausen nach dem Ende entfallen, überstehende werden gekürzt, eine offene endet mit der Session. */
export function pausesUntil(pauses: Pause[] | undefined, endIso: string): Pause[] | undefined {
  const end = Date.parse(endIso);
  const out = (pauses ?? [])
    .filter((p) => Date.parse(p.from) < end)
    .map((p) => (!p.to || Date.parse(p.to) > end ? { from: p.from, to: endIso } : p));
  return out.length ? out : undefined;
}

/** Neue Pause einsortieren (nach Beginn). */
export function withPause(pauses: Pause[] | undefined, p: Pause): Pause[] {
  return [...(pauses ?? []), p].sort((a, b) => Date.parse(a.from) - Date.parse(b.from));
}

/** Läuft seit mehr als 24 h → wohl vergessen zu beenden (SES-3). */
export function looksForgotten(s: Session, nowMs: number): boolean {
  return isRunning(s) && nowMs - Date.parse(s.startAt) > FORGOTTEN_AFTER_MS;
}

/**
 * Liegt der Zeitpunkt innerhalb der Session? Bei laufender Session zählt alles ab Beginn.
 * Minutengenau: Einträge haben keine Sekunden (Uhrzeitfeld), ein Fang um 06:00 gehört zur Session ab 06:00:42.
 */
export function covers(s: Session, atIso: string): boolean {
  const t = Date.parse(atIso);
  const start = Math.floor(Date.parse(s.startAt) / 60000) * 60000;
  return t >= start && (!s.endAt || t <= Date.parse(s.endAt));
}

/** Einträge einer Session, älteste zuerst; `outside` markiert Zeiten außerhalb von Beginn/Ende. */
export function sessionCatches(s: Session, catches: readonly Catch[]): { item: Catch; outside: boolean }[] {
  return catches
    .filter((c) => !c.deletedAt && c.sessionId === s.id)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at))
    .map((item) => ({ item, outside: !covers(s, item.at) }));
}

/** Vorschlag für das Ende einer vergessenen Session: letzter Eintrag, sonst Beginn + 4 h. */
export function suggestedEnd(s: Session, catches: readonly Catch[]): number {
  const last = sessionCatches(s, catches).at(-1);
  return last ? Date.parse(last.item.at) : Date.parse(s.startAt) + 4 * 3600e3;
}

/** „2 h 05 min", „45 min" (auf volle Minuten gerundet) */
export function formatDuration(ms: number): string {
  const min = Math.round(ms / 60000);
  const h = Math.floor(min / 60);
  return h ? `${h} h ${String(min % 60).padStart(2, '0')} min` : `${min} min`;
}
