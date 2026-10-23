import { describe, expect, it } from 'vitest';
import type { Catch, Session } from './schemas';
import { buildReview, RECORD_MIN_HISTORY, reviewEvents, sessionWaterName } from './sessionReview';

const meta = { createdAt: '2026-10-20T06:00:00+02:00', updatedAt: '2026-10-20T06:00:00+02:00', rev: 0 };
const session: Session = {
  id: 's1',
  ...meta,
  startAt: '2026-10-20T06:00:00+02:00',
  endAt: '2026-10-20T10:00:00+02:00',
  tz: 'Europe/Berlin',
};
let n = 0;
const entry = (at: string, extra: Partial<Catch> = {}): Catch => ({
  id: `c${++n}`,
  ...meta,
  outcome: 'caught',
  at: `2026-10-20T${at}:00+02:00`,
  tz: 'Europe/Berlin',
  sessionId: 's1',
  ...extra,
});
const NOW = Date.parse('2026-10-21T12:00:00Z');

describe('Session-Rückblick: Kennzahlen (REV-1)', () => {
  const catches = [
    entry('06:30', {
      speciesId: 'pike',
      lengthCm: 72,
      lengthMethod: 'measured',
      weightG: 2600,
      weightMethod: 'weighed',
    }),
    entry('06:50', { speciesId: 'perch', lengthCm: 31, lengthMethod: 'estimated' }),
    entry('07:05', { speciesId: 'perch', lengthCm: 28 }),
    entry('07:30', { outcome: 'contact', contactDetail: 'lost_in_fight' }),
    entry('08:00', { outcome: 'missed_bite' }),
    entry('08:10', { outcome: 'missed_bite' }),
    entry('09:00', { outcome: 'observation', position: { lat: 51, lng: 7, source: 'gps' } }),
    entry('09:10', { deletedAt: '2026-10-20T09:11:00+02:00' }),
    entry('09:20', { sessionId: 'other' }),
  ];
  const events = reviewEvents(session, catches);
  const r = buildReview(session, events, undefined, catches, NOW);

  it('zählt nur gespeicherte, nicht gelöschte Einträge dieser Session – Ereignisse, nicht Fische', () => {
    expect(r.events).toBe(7);
    expect(r.counts).toEqual({ caught: 3, contact: 1, missed_bite: 2, observation: 1 });
    expect(r.bites).toBe(6);
    expect(r.durationMs).toBe(4 * 3_600_000);
    expect(r.distanceM).toBeUndefined();
  });

  it('Fang-Highlights nur aus erfassten Werten; geschätzte Länge wird gekennzeichnet', () => {
    expect(r.longest?.item.lengthCm).toBe(72);
    expect(r.longest?.estimated).toBe(false);
    expect(r.heaviest?.item.weightG).toBe(2600);
    expect(r.speciesCount).toBe(2);
    expect(r.topSpecies).toEqual({ speciesId: 'perch', count: 2 });
    expect(r.firstCatch?.at).toContain('06:30');
    expect(r.lastCatch?.at).toContain('07:05');
    expect(r.moments.find((m) => m.kind === 'burst')).toEqual({ kind: 'burst', count: 2, minutes: 20 });
  });

  it('Ereignis ohne Ort bleibt in der Chronik, bekommt aber keine Position', () => {
    expect(events.filter((e) => e.position)).toHaveLength(1);
    expect(events.map((e) => e.at)).toEqual([...events.map((e) => e.at)].sort((a, b) => a - b));
  });
});

describe('Session ohne Fang und ohne Route (REV-2)', () => {
  it('keine erfundenen Highlights', () => {
    const catches = [entry('07:00', { outcome: 'observation' })];
    const r = buildReview(session, reviewEvents(session, catches), undefined, catches, NOW);
    expect(r.counts.caught).toBe(0);
    expect(r.longest).toBeUndefined();
    expect(r.heaviest).toBeUndefined();
    expect(r.topSpecies).toBeUndefined();
    expect(r.firstCatch).toBeUndefined();
    expect(r.moments).toEqual([]);
  });

  it('mit Route: Strecke entlang der Punkte, Abschnitte gezählt', () => {
    const t = Date.parse(session.startAt);
    const track = {
      segments: [
        [
          { t, lat: 51, lng: 7, acc: 5 },
          { t: t + 60_000, lat: 51.001, lng: 7, acc: 5 },
        ],
        [{ t: t + 3_600_000, lat: 51.01, lng: 7, acc: 5 }],
      ],
    };
    const r = buildReview(session, [], track, [], NOW);
    expect(Math.round(r.distanceM ?? 0)).toBe(111);
    expect(r.segments).toBe(2);
  });
});

describe('Persönliche Rekorde nur mit belastbarem Vergleich (REV-3)', () => {
  const earlier = (len: number, i: number) =>
    entry('05:00', {
      id: `old${i}`,
      sessionId: undefined,
      at: `2026-09-0${i + 1}T08:00:00+02:00`,
      speciesId: 'pike',
      lengthCm: len,
    });

  it(`Rekord erst ab ${RECORD_MIN_HISTORY} früheren Werten derselben Art`, () => {
    const now = entry('07:00', { speciesId: 'pike', lengthCm: 80 });
    const few = [earlier(60, 0), earlier(65, 1), now];
    expect(buildReview(session, reviewEvents(session, few), undefined, few, NOW).moments).toEqual([]);
    const enough = [earlier(60, 0), earlier(65, 1), earlier(70, 2), now];
    const r = buildReview(session, reviewEvents(session, enough), undefined, enough, NOW);
    expect(r.moments).toContainEqual({ kind: 'recordLength', item: now, previousBestCm: 70 });
  });

  it('kein Rekord, wenn ein früherer Fisch größer war', () => {
    const now = entry('07:00', { speciesId: 'pike', lengthCm: 66 });
    const list = [earlier(60, 0), earlier(65, 1), earlier(70, 2), now];
    expect(buildReview(session, reviewEvents(session, list), undefined, list, NOW).moments).toEqual([]);
  });
});

describe('Gewässername', () => {
  it('von der Session, sonst der häufigste Name der Einträge', () => {
    const list = [
      entry('07:00', { waterSnapshot: { name: 'De Wittsee' } }),
      entry('07:10', { waterSnapshot: { name: 'De Wittsee' } }),
      entry('07:20', { waterSnapshot: { name: 'Nette' } }),
    ];
    expect(sessionWaterName(session, reviewEvents(session, list))).toBe('De Wittsee');
    expect(sessionWaterName({ ...session, waterSnapshot: { name: 'Krickenbecker See' } }, [])).toBe(
      'Krickenbecker See',
    );
  });
});
