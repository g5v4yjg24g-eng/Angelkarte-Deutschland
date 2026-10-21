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
