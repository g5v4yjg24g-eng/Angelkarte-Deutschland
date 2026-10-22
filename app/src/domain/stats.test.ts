import { describe, expect, it } from 'vitest';
import { computeStats, NO_STATS_FILTER } from './stats';
import { entry, session, statsBasic } from '../test/fixtures/stats';

const NOW = Date.parse('2026-07-10T12:00:00+02:00');

describe('Statistik (DATA_MODEL §9)', () => {
  it('STA-1: stats-basic ergibt die Sollwerte', () => {
    const { catches, sessions } = statsBasic();
    const s = computeStats(catches, sessions, NO_STATS_FILTER, NOW);
    expect(s.counts).toEqual({ caught: 7, contact: 3, missed_bite: 2, observation: 1, contactsTotal: 12 });
    expect(s.landingRate).toEqual({ ok: true, value: 7 / 10, n: 10 });
    expect(s.perHour.ok).toBe(true);
    expect(s.perHour.hours).toBe(6.5);
    expect(s.perHour.sessions).toBe(3);
    if (s.perHour.ok) expect(s.perHour.value).toBeCloseTo(7 / 6.5, 10);
    // Beobachtung (Rapfen) zählt nicht als Fang
    expect(s.species).toEqual([
      { id: 'zander', n: 3 },
      { id: 'perch', n: 3 },
      { id: 'pike', n: 1 },
    ]);
    expect(s.speciesSmallSample).toBe(true);
    expect(s.methods).toEqual([
      { method: 'spinning', caught: 4 },
      { method: 'jigging', caught: 2 },
    ]);
    expect(s.waters).toEqual([{ name: 'De Wittsee', caught: 3 }]);
    expect(s.baits).toEqual({
      ok: true,
      n: 3,
      value: [
        { name: 'Gummifisch 12 cm', caught: 2, contacts: 3 },
        { name: 'Spinner Gr. 3', caught: 2, contacts: 2 },
        { name: 'Wobbler', caught: 1, contacts: 2 },
      ],
    });
    // Rekorde: nur gemessene Längen als Rekord, Schätzungen getrennt
    expect(s.records).toEqual([
      { speciesId: 'pike', estimatedCm: 74 },
      { speciesId: 'zander', measuredCm: 62 },
      { speciesId: 'perch', measuredCm: 28, estimatedCm: 31 },
    ]);
    // Verlauf: Juni 6, Juli 1 – leere Monate als 0
    expect(s.timeline).toEqual({
      unit: 'month',
      points: [
        { key: '2026-06', caught: 6 },
        { key: '2026-07', caught: 1 },
      ],
    });
    expect(s.sessions.map((r) => [r.id, r.durationMs / 60000, r.caught, r.contacts, r.perHour])).toEqual([
      ['s3', 30, 1, 2, undefined], // < 1 h: keine Rate
      ['s2', 240, 4, 7, 1],
      ['s1', 120, 2, 3, 1],
    ]);
  });

  it('STA-2/STA-3: leer und unter den Mindestmengen keine Quoten', () => {
    const empty = computeStats([], [], NO_STATS_FILTER, NOW);
    expect(empty.counts.contactsTotal).toBe(0);
    expect(empty.landingRate).toEqual({ ok: false, n: 0, need: 5 });
    expect(empty.perHour.ok).toBe(false);
    expect(empty.timeline.points).toEqual([]);

    const tiny = computeStats(
      [
        entry('caught', '2026-07-01T10:00:00+02:00', { sessionId: 'a' }),
        entry('caught', '2026-07-01T10:30:00+02:00', { sessionId: 'a' }),
        entry('contact', '2026-07-01T11:00:00+02:00', { sessionId: 'a' }),
      ],
      [session('a', '2026-07-01T09:00:00+02:00', '2026-07-01T13:00:00+02:00')],
      NO_STATS_FILTER,
      NOW,
    );
    expect(tiny.landingRate).toEqual({ ok: false, n: 3, need: 5 });
    expect(tiny.perHour).toMatchObject({ ok: false, sessions: 1, need: 2 }); // nur eine Session
    expect(tiny.baits).toEqual({ ok: false, n: 0, need: 3 });
  });

  it('ungültige und laufende Sessions zählen nicht in die Angelzeit', () => {
    const { catches, sessions } = statsBasic();
    const all = [
      ...sessions,
      session('rueckwaerts', '2026-06-10T10:00:00+02:00', '2026-06-10T09:00:00+02:00'),
      session('vergessen', '2026-06-11T10:00:00+02:00', '2026-06-12T16:00:00+02:00'),
      session('laeuft', '2026-07-10T10:00:00+02:00', undefined),
    ];
    const s = computeStats(catches, all, NO_STATS_FILTER, NOW);
    expect(s.perHour.hours).toBe(6.5);
    expect(s.sessionsExcluded).toBe(2);
  });

  it('STA-4: Filter Zeitraum, Art und Gewässer kombiniert', () => {
    const { catches, sessions } = statsBasic();
    const zanderWitt = computeStats(
      catches,
      sessions,
      { period: 'all', speciesId: 'zander', water: 'De Wittsee' },
      NOW,
    );
    expect(zanderWitt.counts.caught).toBe(3);
    // Gewässerfilter: nur Sessions mit Einträgen an diesem Gewässer (s1, s3 = 2,5 h)
    expect(zanderWitt.perHour.hours).toBe(2.5);
    if (zanderWitt.perHour.ok) expect(zanderWitt.perHour.value).toBeCloseTo(3 / 2.5, 10);
    const last30 = computeStats(catches, sessions, { period: '30d', speciesId: '', water: '' }, NOW);
    expect(last30.counts.caught).toBe(1); // nur Juli
    expect(last30.timeline.unit).toBe('day');
    expect(last30.timeline.points).toHaveLength(30);
    expect(last30.timeline.points.reduce((a, p) => a + p.caught, 0)).toBe(1);
    const year = computeStats(catches, sessions, { period: 'year', speciesId: 'perch', water: '' }, NOW);
    expect(year.timeline.points.map((p) => p.key)).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
    ]);
    expect(year.timeline.points.map((p) => p.caught)).toEqual([0, 0, 0, 0, 0, 3, 0]);
  });
});
