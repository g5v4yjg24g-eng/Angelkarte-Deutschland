import { describe, expect, it } from 'vitest';
import type { Catch, Session } from './schemas';
import { analyzeBites, matchNow, MIN_EVENTS, pressureBucket, trendBucket } from './biteAnalysis';

const meta = { createdAt: '2026-06-01T10:00:00+02:00', updatedAt: '2026-06-01T10:00:00+02:00', rev: 0 };
let n = 0;
const bite = (at: string, extra: Partial<Catch> = {}): Catch => ({
  id: `b${++n}`,
  ...meta,
  outcome: 'caught',
  at,
  tz: 'Europe/Berlin',
  ...extra,
});
const session = (id: string, startAt: string, endAt: string, extra: Partial<Session> = {}): Session => ({
  id,
  ...meta,
  startAt,
  endAt,
  tz: 'Europe/Berlin',
  ...extra,
});
const wx = (pressureHpa: number, pressureTrend3h: number) => ({
  weather: {
    provider: 'open-meteo' as const,
    fetchedAt: meta.createdAt,
    kind: 'model' as const,
    forHour: '2026-06-01T04:00:00.000Z',
    pressureHpa,
    pressureTrend3h,
    attribution: 'Open-Meteo.com, CC BY 4.0',
  },
});

describe('Persönliche Beißzeiten', () => {
  it('unter der Mindestmenge: keine Auswertung, nur n', () => {
    const a = analyzeBites([bite('2026-06-01T06:30:00+02:00')], []);
    expect(a.slots).toEqual({ ok: false, n: 1, need: MIN_EVENTS });
  });

  it('Tageszeit als Bisse pro Angelstunde; Pausen zählen nicht als Angelzeit', () => {
    // 20 Bisse: 16 morgens 6–8 Uhr in Sessions, 4 abends ohne Session
    const sessions = [
      session('s1', '2026-06-01T06:00:00+02:00', '2026-06-01T08:00:00+02:00'),
      session('s2', '2026-06-02T06:00:00+02:00', '2026-06-02T08:00:00+02:00', {
        pauses: [{ from: '2026-06-02T07:00:00+02:00', to: '2026-06-02T08:00:00+02:00' }],
      }),
    ];
    const bites = [
      ...Array.from({ length: 16 }, (_, i) =>
        bite(`2026-06-0${(i % 2) + 1}T06:${String(10 + i).padStart(2, '0')}:00+02:00`, {
          sessionId: i % 2 ? 's2' : 's1',
        }),
      ),
      ...Array.from({ length: 4 }, () => bite('2026-06-03T20:30:00+02:00')),
    ];
    const a = analyzeBites(bites, sessions);
    if (!a.slots.ok) throw new Error('nicht freigegeben');
    const morning = a.slots.value[3]; // 6–8 Uhr
    expect(morning).toMatchObject({ from: 6, bites: 16, hours: 3 });
    expect(morning?.perHour).toBeCloseTo(16 / 3, 5);
    const evening = a.slots.value[10]; // 20–22 Uhr: Bisse, aber keine Angelzeit aus Sessions → keine Rate
    expect(evening).toMatchObject({ bites: 4, hours: 0, perHour: undefined });
  });

  it('Luftdruck und Tendenz nur aus Einträgen mit Wetter; Grenzen offen benannt', () => {
    expect([1004.9, 1005, 1014.9, 1015, 1025].map(pressureBucket)).toEqual([0, 1, 1, 2, 3]);
    expect([-1.1, -1, 0, 1, 1.1].map(trendBucket)).toEqual([
      'falling',
      'steady',
      'steady',
      'steady',
      'rising',
    ]);
    const bites = [
      ...Array.from({ length: 12 }, () => bite('2026-06-01T06:30:00+02:00', wx(1012, -2))),
      ...Array.from({ length: 8 }, () => bite('2026-06-01T06:30:00+02:00', wx(1020, 0))),
      bite('2026-06-01T06:30:00+02:00'),
    ];
    const a = analyzeBites(bites, []);
    expect(a.pressure).toEqual({ ok: true, n: 20, value: { 0: 0, 1: 12, 2: 8, 3: 0 } });
    expect(a.trend).toEqual({ ok: true, n: 20, value: { falling: 12, steady: 8, rising: 0 } });
    expect(matchNow(a, { hour: 7, pressureHpa: 1010, trend3h: -1.5 })).toMatchObject({
      pressure: { bucket: 1, count: 12, of: 20 },
      trend: { bucket: 'falling', count: 12, of: 20 },
    });
  });

  it('Beobachtungen zählen nicht als Biss', () => {
    const a = analyzeBites([bite('2026-06-01T06:30:00+02:00', { outcome: 'observation' })], []);
    expect(a.bites).toBe(0);
  });
});

describe('Bisse nach Pegellage (GAUGE-4)', () => {
  const gauge = (state: 'low' | 'normal' | 'high' | undefined, change24h?: number) => ({
    gauge: {
      status: 'ok' as const,
      source: 'hygon' as const,
      stationId: 'hygon:1',
      name: 'Pegel',
      km: 2,
      levelCm: 120,
      at: '2026-06-01T04:00:00.000Z',
      ...(state ? { state } : {}),
      ...(change24h !== undefined ? { change24h } : {}),
      fetchedAt: meta.createdAt,
      attribution: 'LANUK NRW',
    },
  });

  it('Lage und Tendenz nur aus Einträgen mit Pegel; ab der Mindestmenge', () => {
    const few = analyzeBites([bite('2026-06-01T06:00:00+02:00', gauge('high', 5))], []);
    expect(few.gaugeState).toEqual({ ok: false, n: 1, need: MIN_EVENTS });
    const list = [
      ...Array.from({ length: 12 }, () => bite('2026-06-01T06:00:00+02:00', gauge('normal', -3))),
      ...Array.from({ length: 8 }, () => bite('2026-06-01T06:00:00+02:00', gauge('high', 1))),
      bite('2026-06-01T06:00:00+02:00', gauge(undefined, 10)), // Bundespegel: Lage unbekannt
      bite('2026-06-01T06:00:00+02:00', {
        gauge: { status: 'none', reason: 'no-station', checkedAt: meta.createdAt },
      }),
    ];
    const a = analyzeBites(list, []);
    expect(a.gaugeState).toEqual({ ok: true, n: 20, value: { low: 0, normal: 12, high: 8 } });
    expect(a.gaugeTrend).toEqual({ ok: true, n: 21, value: { falling: 12, steady: 8, rising: 1 } });
  });
});
