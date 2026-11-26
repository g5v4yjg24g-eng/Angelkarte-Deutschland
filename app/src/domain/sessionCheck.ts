// Nachfrage „Angelst du noch?“ (Wunsch Nutzer 2026-11-27): läuft eine Session 5 Stunden, kommt eine Mitteilung auf das
// iPhone; am Sperrbildschirm lange drücken zeigt „Ja“ und „Nein – Session beenden“. „Ja“ (`Session.stillFishingAt`)
// stellt die nächste Nachfrage in weitere 5 Stunden. Gezählt wird ab Beginn, letzter Antwort oder dem Ende der letzten
// Pause – je nachdem, was am spätesten war. Pausierte Sessions bekommen keine Nachfrage. Rein, ohne Gerätezugriff.
import type { Reminder } from './papers';
import type { Session } from './schemas';
import { openPause } from './session';

export const SESSION_CHECK_HOURS = 5;
const HOUR_MS = 3_600_000;

export interface SessionCheckTexts {
  title: string;
  /** Text mit der Zahl vollendeter Stunden seit Beginn */
  body: (hours: number) => string;
}

/** Zeitpunkt, ab dem die nächste Nachfrage gezählt wird */
export function checkBase(s: Session): number {
  const times = [Date.parse(s.startAt), s.stillFishingAt ? Date.parse(s.stillFishingAt) : NaN];
  for (const p of s.pauses ?? []) if (p.to) times.push(Date.parse(p.to));
  return Math.max(...times.filter((t) => Number.isFinite(t)));
}

/** Kennung der Mitteilung je Session (Vorsilbe `fp.paper.` kommt im Gerätemodul dazu) */
export const checkId = (sessionId: string) => `session.${sessionId}.check`;

/** Nachfragen für laufende, nicht pausierte Sessions; Zeitpunkte vor `nowMs` entfallen (keine Dauerschleife). */
export function sessionCheckPlan(
  sessions: readonly Session[],
  nowMs: number,
  texts: SessionCheckTexts,
): Reminder[] {
  const out: Reminder[] = [];
  for (const s of sessions) {
    if (s.deletedAt || s.endAt || openPause(s)) continue;
    const at = checkBase(s) + SESSION_CHECK_HOURS * HOUR_MS;
    if (!Number.isFinite(at) || at <= nowMs) continue;
    const hours = Math.max(1, Math.round((at - Date.parse(s.startAt)) / HOUR_MS));
    out.push({ id: checkId(s.id), at, title: texts.title, body: texts.body(hours), sessionId: s.id });
  }
  return out.sort((a, b) => a.at - b.at);
}
