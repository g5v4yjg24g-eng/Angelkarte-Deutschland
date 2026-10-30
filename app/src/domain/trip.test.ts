import { describe, expect, it } from 'vitest';
import type { Trip } from './schemas';
import {
  addMonths,
  dayStartMs,
  forecastStatus,
  monthGrid,
  tripDraftToFields,
  emptyTripDraft,
  upcomingTrips,
  weekStart,
  weekDays,
  isoWeek,
  shiftDate,
} from './trip';

const meta = { createdAt: '2026-10-22T10:00:00+02:00', updatedAt: '2026-10-22T10:00:00+02:00', rev: 0 };
const trip = (id: string, date: string, extra: Partial<Trip> = {}): Trip => ({
  id,
  ...meta,
  date,
  tz: 'Europe/Berlin',
  ...extra,
});

describe('Angelkalender', () => {
  it('Monatsraster beginnt am Montag und enthält alle Tage des Monats', () => {
    const g = monthGrid('2026-10'); // 1.10.2026 ist ein Donnerstag
    expect(g[0]?.map((c) => c.date)).toEqual([
      '2026-09-28',
      '2026-09-29',
      '2026-09-30',
      '2026-10-01',
      '2026-10-02',
      '2026-10-03',
      '2026-10-04',
    ]);
    expect(g.flat().filter((c) => c.inMonth)).toHaveLength(31);
    expect(g.every((w) => w.length === 7)).toBe(true);
    expect(
      monthGrid('2027-02')
        .flat()
        .filter((c) => c.inMonth),
    ).toHaveLength(28);
  });

  it('Monate blättern über den Jahreswechsel', () => {
    expect(addMonths('2026-12', 1)).toBe('2027-01');
    expect(addMonths('2026-01', -1)).toBe('2025-12');
  });

  it('Tagesbeginn auch am Tag der Zeitumstellung', () => {
    expect(dayStartMs('2026-10-25')).toBe(Date.parse('2026-10-24T22:00:00Z'));
    expect(dayStartMs('2026-10-26')).toBe(Date.parse('2026-10-25T23:00:00Z'));
  });

  it('Vorhersage: vorbei, verfügbar (heute + 9 Tage) oder erst später', () => {
    expect(forecastStatus('2026-10-21', '2026-10-22')).toEqual({ kind: 'past' });
    expect(forecastStatus('2026-10-22', '2026-10-22')).toEqual({ kind: 'available', dayIndex: 0 });
    expect(forecastStatus('2026-10-31', '2026-10-22')).toEqual({ kind: 'available', dayIndex: 9 });
    expect(forecastStatus('2026-11-05', '2026-10-22')).toEqual({ kind: 'later', from: '2026-10-27' });
  });

  it('anstehende Termine: ab heute, sortiert nach Tag und Uhrzeit, ohne gelöschte', () => {
    const list = upcomingTrips(
      [
        trip('a', '2026-10-25', { from: '14:00' }),
        trip('b', '2026-10-21'),
        trip('c', '2026-10-25', { from: '06:00' }),
        trip('d', '2026-10-23', { deletedAt: meta.createdAt }),
        trip('e', '2026-10-22'),
      ],
      '2026-10-22',
    );
    expect(list.map((t) => t.id)).toEqual(['e', 'c', 'a']);
  });

  it('Formular: Datum Pflicht, Ende nach Beginn, leere Felder entfallen', () => {
    expect(tripDraftToFields({ ...emptyTripDraft(''), title: 'x' }).errors).toEqual({ date: 'dateRequired' });
    expect(tripDraftToFields({ ...emptyTripDraft('2026-10-24'), from: '08:00', to: '07:00' }).errors).toEqual(
      {
        to: 'endBeforeStart',
      },
    );
    expect(
      tripDraftToFields({ ...emptyTripDraft('2026-10-24'), from: '06:00', title: ' Hecht ' }).fields,
    ).toEqual({
      date: '2026-10-24',
      from: '06:00',
      to: undefined,
      title: 'Hecht',
      notes: undefined,
    });
  });
});

describe('Angelkalender: Woche und Blättern', () => {
  it('Woche beginnt am Montag, auch über den Monatswechsel', () => {
    expect(weekStart('2026-10-22')).toBe('2026-10-19');
    expect(weekStart('2026-10-19')).toBe('2026-10-19');
    expect(weekStart('2026-10-25')).toBe('2026-10-19');
    expect(weekDays('2026-11-01')).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-10-31',
      '2026-11-01',
    ]);
  });

  it('Kalenderwoche nach ISO 8601, auch am Jahreswechsel', () => {
    expect(isoWeek('2026-10-22')).toBe(43);
    expect(isoWeek('2026-01-01')).toBe(1);
    expect(isoWeek('2027-01-01')).toBe(53); // Freitag gehört noch zu KW 53/2026
    expect(isoWeek('2026-12-28')).toBe(53);
    expect(isoWeek('2025-12-29')).toBe(1); // Montag gehört schon zu KW 1/2026
  });

  it('Blättern je nach Ansicht', () => {
    expect(shiftDate('2026-10-22', 'day', 1)).toBe('2026-10-23');
    expect(shiftDate('2026-10-22', 'week', -1)).toBe('2026-10-15');
    expect(shiftDate('2026-10-22', 'month', 1)).toBe('2026-11-01');
    expect(shiftDate('2026-01-31', 'month', -1)).toBe('2025-12-01');
  });
});
