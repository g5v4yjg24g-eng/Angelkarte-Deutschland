// Erinnerungen vor Angelterminen (Wunsch Nutzer 2026-11-02, umgesetzt 2026-11-27): lokale Mitteilungen auf dem iPhone.
// Gleiche Zeiten wie in der Kalenderdatei (domain/ics.ts): mit Uhrzeit eine Stunde vorher, ohne Uhrzeit am Abend davor
// um 18 Uhr. Rein, ohne Gerätezugriff; die App übergibt den Plan zusammen mit dem der Angelpapiere.
import { ALLDAY_REMIND_TIME, REMIND_BEFORE_MIN } from './ics';
import type { Reminder } from './papers';
import type { Trip } from './schemas';
import { addDays } from './trip';
import { localToZonedIso } from './time';

export interface TripReminderTexts {
  /** Titel der Mitteilung: Name des Termins bzw. Gewässer */
  title: (t: Trip) => string;
  /** Text: `soon` = eine Stunde vorher (mit Uhrzeit), `evening` = Abend vorher (ganztägig) */
  body: (t: Trip, kind: 'soon' | 'evening') => string;
}

/** Alle noch anstehenden Erinnerungen für Termine, früheste zuerst. Zeitpunkte vor `nowMs` entfallen. */
export function tripReminderPlan(
  trips: readonly Trip[],
  nowMs: number,
  texts: TripReminderTexts,
): Reminder[] {
  const out: Reminder[] = [];
  for (const t of trips) {
    if (t.deletedAt) continue;
    const timed = !!t.from;
    const at = timed
      ? Date.parse(localToZonedIso(t.date, t.from as string, t.tz)) - REMIND_BEFORE_MIN * 60_000
      : Date.parse(localToZonedIso(addDays(t.date, -1), ALLDAY_REMIND_TIME, t.tz));
    if (!Number.isFinite(at) || at <= nowMs) continue;
    const kind = timed ? 'soon' : 'evening';
    out.push({ id: `trip.${t.id}.${kind}`, at, title: texts.title(t), body: texts.body(t, kind) });
  }
  return out.sort((a, b) => a.at - b.at);
}
