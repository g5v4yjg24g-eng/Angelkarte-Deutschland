// Erinnerungen vor Angelterminen (Wunsch Nutzer 2026-11-02, umgesetzt 2026-11-27): lokale Mitteilungen auf dem iPhone.
// Wann erinnert wird, wählt die Person in den Einstellungen: 1 Tag, 3 Stunden und/oder 1 Stunde vorher (Standard: 1 Stunde).
// Ganztägige Termine haben keine Uhrzeit: „1 Tag vorher“ = Abend davor 18 Uhr (wie in der Kalenderdatei, domain/ics.ts),
// „3 Stunden/1 Stunde vorher“ = am Morgen des Tages um 7 Uhr (zusammen nur eine Mitteilung).
// Rein, ohne Gerätezugriff; die App übergibt den Plan zusammen mit dem der Angelpapiere.
import { ALLDAY_REMIND_TIME } from './ics';
import type { Reminder } from './papers';
import type { Trip } from './schemas';
import { addDays } from './trip';
import { localToZonedIso } from './time';

export const TRIP_REMIND_OFFSETS = ['day', 'h3', 'h1'] as const;
export type TripRemindOffset = (typeof TRIP_REMIND_OFFSETS)[number];
export const DEFAULT_TRIP_REMIND: readonly TripRemindOffset[] = ['h1'];
/** Uhrzeit der Erinnerung am Morgen eines ganztägigen Termins */
export const ALLDAY_MORNING_TIME = '07:00';

const HOURS: Record<TripRemindOffset, number> = { day: 24, h3: 3, h1: 1 };

export type TripReminderKind = TripRemindOffset | 'evening' | 'morning';

export interface TripReminderTexts {
  /** Titel der Mitteilung: Name des Termins bzw. Gewässer */
  title: (t: Trip) => string;
  /** Text je Art: `day`/`h3`/`h1` = so viel vorher (mit Uhrzeit), `evening`/`morning` = ganztägig */
  body: (t: Trip, kind: TripReminderKind) => string;
}

/** Aus gespeicherten Werten nur bekannte Zeiten, ohne Doppelte; fehlt die Einstellung, gilt der Standard. */
export function normalizeOffsets(value: unknown): TripRemindOffset[] {
  if (!Array.isArray(value)) return [...DEFAULT_TRIP_REMIND];
  return TRIP_REMIND_OFFSETS.filter((o) => value.includes(o));
}

/** Alle noch anstehenden Erinnerungen für Termine, früheste zuerst. Zeitpunkte vor `nowMs` entfallen. */
export function tripReminderPlan(
  trips: readonly Trip[],
  nowMs: number,
  texts: TripReminderTexts,
  offsets: readonly TripRemindOffset[] = DEFAULT_TRIP_REMIND,
): Reminder[] {
  const out: Reminder[] = [];
  const push = (t: Trip, kind: TripReminderKind, at: number) => {
    if (!Number.isFinite(at) || at <= nowMs) return;
    out.push({ id: `trip.${t.id}.${kind}`, at, title: texts.title(t), body: texts.body(t, kind) });
  };
  for (const t of trips) {
    if (t.deletedAt) continue;
    if (t.from) {
      const start = Date.parse(localToZonedIso(t.date, t.from, t.tz));
      for (const o of offsets) push(t, o, start - HOURS[o] * 3_600_000);
      continue;
    }
    if (offsets.includes('day')) {
      push(t, 'evening', Date.parse(localToZonedIso(addDays(t.date, -1), ALLDAY_REMIND_TIME, t.tz)));
    }
    if (offsets.includes('h3') || offsets.includes('h1')) {
      push(t, 'morning', Date.parse(localToZonedIso(t.date, ALLDAY_MORNING_TIME, t.tz)));
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
