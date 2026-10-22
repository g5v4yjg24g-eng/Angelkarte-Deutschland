// Angelkalender (Wunsch Nutzer 2026-10-22): Monatsraster, anstehende Termine, Formularprüfung und ob es für einen
// Termin schon eine Vorhersage gibt. Rein, ohne DB. Datumsangaben als lokale Tage „JJJJ-MM-TT".
import type { Trip } from './schemas';
import { DEFAULT_TZ, localToZonedIso } from './time';
import { FORECAST_DAYS } from './forecast';

const DAY_MS = 86_400_000;
const p2 = (n: number) => String(n).padStart(2, '0');
const fromUtc = (ms: number) => {
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
};
const toUtc = (date: string) => Date.parse(`${date}T00:00:00Z`);

/** Lokaler Tag eines Zeitpunkts in einer Zeitzone. */
export const localDate = (ms: number, tz: string = DEFAULT_TZ) =>
  new Date(ms).toLocaleDateString('sv-SE', { timeZone: tz });

/** Tage zwischen zwei lokalen Daten (b − a). */
export const daysBetween = (a: string, b: string) => Math.round((toUtc(b) - toUtc(a)) / DAY_MS);
export const addDays = (date: string, n: number) => fromUtc(toUtc(date) + n * DAY_MS);

/** Beginn des lokalen Tages als Zeitpunkt (ms) – auch an Tagen mit Zeitumstellung. */
export const dayStartMs = (date: string, tz: string = DEFAULT_TZ) =>
  Date.parse(localToZonedIso(date, '00:00', tz));

export interface MonthCell {
  date: string;
  inMonth: boolean;
}

/** Wochen (Montag zuerst) des Monats `ym` („JJJJ-MM"), aufgefüllt mit Tagen der Nachbarmonate. */
export function monthGrid(ym: string): MonthCell[][] {
  const first = `${ym}-01`;
  const weekday = (new Date(toUtc(first)).getUTCDay() + 6) % 7; // 0 = Montag
  const start = addDays(first, -weekday);
  const weeks: MonthCell[][] = [];
  for (let w = 0; w < 6; w++) {
    const week = Array.from({ length: 7 }, (_, d) => {
      const date = addDays(start, w * 7 + d);
      return { date, inMonth: date.startsWith(ym) };
    });
    if (w > 3 && !week.some((c) => c.inMonth)) break;
    weeks.push(week);
  }
  return weeks;
}

export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split('-').map(Number) as [number, number];
  const idx = y * 12 + (m - 1) + n;
  return `${Math.floor(idx / 12)}-${p2((idx % 12) + 1)}`;
}

const order = (a: Trip, b: Trip) =>
  a.date === b.date ? (a.from ?? '').localeCompare(b.from ?? '') : a.date.localeCompare(b.date);

/** Termine ab heute, zeitlich sortiert (ohne gelöschte). */
export const upcomingTrips = (trips: readonly Trip[], today: string) =>
  trips.filter((t) => !t.deletedAt && t.date >= today).sort(order);

/** Termine eines Tages, sortiert. */
export const tripsOn = (trips: readonly Trip[], date: string) =>
  trips.filter((t) => !t.deletedAt && t.date === date).sort(order);

export type ForecastStatus =
  | { kind: 'past' }
  | { kind: 'available'; dayIndex: number }
  /** Vorhersage gibt es ab `from` (FORECAST_DAYS Tage im Voraus) */
  | { kind: 'later'; from: string };

export function forecastStatus(date: string, today: string): ForecastStatus {
  const d = daysBetween(today, date);
  if (d < 0) return { kind: 'past' };
  if (d < FORECAST_DAYS) return { kind: 'available', dayIndex: d };
  return { kind: 'later', from: addDays(date, -(FORECAST_DAYS - 1)) };
}

export interface TripDraft {
  date: string;
  from: string;
  to: string;
  water: string;
  title: string;
  notes: string;
}
export type TripField = keyof TripDraft;
export type TripErrors = Partial<Record<TripField, 'dateRequired' | 'endBeforeStart'>>;

export const emptyTripDraft = (date: string): TripDraft => ({
  date,
  from: '',
  to: '',
  water: '',
  title: '',
  notes: '',
});

export const tripDraftFrom = (t: Trip, waterKey: string): TripDraft => ({
  date: t.date,
  from: t.from ?? '',
  to: t.to ?? '',
  water: waterKey,
  title: t.title ?? '',
  notes: t.notes ?? '',
});

export type TripFields = Pick<Trip, 'date' | 'from' | 'to' | 'title' | 'notes'>;

/** Formular → Felder; leere Angaben entfallen. */
export function tripDraftToFields(d: TripDraft): { fields?: TripFields; errors: TripErrors } {
  const errors: TripErrors = {};
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.date)) errors.date = 'dateRequired';
  if (d.from && d.to && d.to <= d.from) errors.to = 'endBeforeStart';
  if (Object.keys(errors).length) return { errors };
  const opt = (v: string) => (v.trim() ? v.trim() : undefined);
  return {
    errors,
    fields: { date: d.date, from: opt(d.from), to: opt(d.to), title: opt(d.title), notes: opt(d.notes) },
  };
}

export type CalendarView = 'month' | 'week' | 'day';

/** Montag der Woche von `date`. */
export function weekStart(date: string): string {
  const weekday = (new Date(toUtc(date)).getUTCDay() + 6) % 7;
  return addDays(date, -weekday);
}

/** Die 7 Tage (Mo–So) der Woche von `date`. */
export const weekDays = (date: string) => Array.from({ length: 7 }, (_, i) => addDays(weekStart(date), i));

/** Kalenderwoche nach ISO 8601 (Woche mit dem ersten Donnerstag ist KW 1). */
export function isoWeek(date: string): number {
  const thursday = addDays(weekStart(date), 3);
  const jan1 = `${thursday.slice(0, 4)}-01-01`;
  return Math.floor(daysBetween(jan1, thursday) / 7) + 1;
}

/** Blättern je nach Ansicht: Monat ±1 Monat (Tag 1), Woche ±7 Tage, Tag ±1 Tag. */
export function shiftDate(date: string, view: CalendarView, n: number): string {
  if (view === 'day') return addDays(date, n);
  if (view === 'week') return addDays(date, 7 * n);
  return `${addMonths(date.slice(0, 7), n)}-01`;
}
