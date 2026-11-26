import { describe, expect, it } from 'vitest';
import type { Trip } from './schemas';
import { tripReminderPlan } from './tripReminders';

const texts = { title: (t: Trip) => t.title ?? 'Angeltermin', body: (_t: Trip, k: 'soon' | 'evening') => k };
const trip = (over: Partial<Trip>): Trip =>
  ({ id: 't1', date: '2026-12-10', tz: 'Europe/Berlin', createdAt: '', updatedAt: '', ...over }) as Trip;
const NOW = Date.parse('2026-12-01T00:00:00Z');

describe('tripReminderPlan', () => {
  it('mit Uhrzeit: eine Stunde vorher (Ortszeit)', () => {
    const [r] = tripReminderPlan([trip({ from: '06:30' })], NOW, texts);
    // 06:30 MEZ = 05:30 UTC, eine Stunde vorher = 04:30 UTC
    expect(r?.at).toBe(Date.parse('2026-12-10T04:30:00Z'));
    expect(r?.id).toBe('trip.t1.soon');
    expect(r?.body).toBe('soon');
  });
  it('ohne Uhrzeit: am Abend davor um 18 Uhr', () => {
    const [r] = tripReminderPlan([trip({})], NOW, texts);
    expect(r?.at).toBe(Date.parse('2026-12-09T17:00:00Z')); // 18:00 MEZ
    expect(r?.id).toBe('trip.t1.evening');
  });
  it('Vergangenes und gelöschte Termine entfallen, der Rest ist nach Zeit sortiert', () => {
    const plan = tripReminderPlan(
      [
        trip({ id: 'spaet', date: '2026-12-20', from: '08:00' }),
        trip({ id: 'alt', date: '2026-11-20', from: '08:00' }),
        trip({ id: 'weg', date: '2026-12-12', from: '08:00', deletedAt: '2026-11-30T00:00:00Z' }),
        trip({ id: 'frueh', date: '2026-12-05', from: '08:00' }),
      ],
      NOW,
      texts,
    );
    expect(plan.map((r) => r.id)).toEqual(['trip.frueh.soon', 'trip.spaet.soon']);
  });
  it('Termin heute früh, Erinnerung schon vorbei: keine Mitteilung', () => {
    const now = Date.parse('2026-12-10T05:00:00Z');
    expect(tripReminderPlan([trip({ from: '06:30' })], now, texts)).toEqual([]);
  });
});
