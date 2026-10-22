import { describe, expect, it } from 'vitest';
import { SessionSchema, type Session } from './schemas';
import { activeMs, openPause, pauseIssue, pauseMs, pausesUntil, withPause } from './session';
import { computeStats } from './stats';
import { entry, session } from '../test/fixtures/stats';

const meta = { createdAt: '2026-10-21T06:00:00+02:00', updatedAt: '2026-10-21T06:00:00+02:00', rev: 0 };
const s = (over: Partial<Session> = {}): Session => ({
  id: 's1',
  ...meta,
  startAt: '2026-10-21T06:00:00+02:00',
  endAt: '2026-10-21T10:00:00+02:00',
  tz: 'Europe/Berlin',
  ...over,
});
const p = (from: string, to?: string) => ({
  from: `2026-10-21T${from}:00+02:00`,
  ...(to ? { to: `2026-10-21T${to}:00+02:00` } : {}),
});
const MIN = 60000;

describe('Session-Pausen (aktive Angelzeit)', () => {
  it('Angelzeit = Dauer minus Pausen', () => {
    const x = s({ pauses: [p('07:00', '07:30'), p('08:00', '08:15')] });
    expect(pauseMs(x, 0) / MIN).toBe(45);
    expect(activeMs(x, 0) / MIN).toBe(195);
  });

  it('laufende Pause zählt bis jetzt; laufende Session ohne Ende', () => {
    const x = s({ endAt: undefined, pauses: [p('07:00', '07:30'), p('09:00')] });
    const now = Date.parse('2026-10-21T09:20:00+02:00');
    expect(openPause(x)?.from).toContain('09:00');
    expect(pauseMs(x, now) / MIN).toBe(50);
    expect(activeMs(x, now) / MIN).toBe(150);
  });

  it('prüft Lage, Reihenfolge, Überschneidung und offene Pausen', () => {
    expect(pauseIssue(s({ pauses: [p('07:00', '07:30')] }))).toBeUndefined();
    expect(pauseIssue(s({ pauses: [p('07:30', '07:00')] }))).toBe('order');
    expect(pauseIssue(s({ pauses: [p('05:30', '06:30')] }))).toBe('outside');
    expect(pauseIssue(s({ pauses: [p('09:30', '10:30')] }))).toBe('outside');
    expect(pauseIssue(s({ pauses: [p('07:00', '08:00'), p('07:30', '07:45')] }))).toBe('overlap');
    expect(pauseIssue(s({ pauses: [p('07:00')] }))).toBe('open'); // beendete Session
    expect(pauseIssue(s({ endAt: undefined, pauses: [p('07:00'), p('08:00', '08:10')] }))).toBe('open');
    // minutengenau wie covers(): Beginn 06:00:42, Pause ab 06:00
    expect(
      pauseIssue(s({ startAt: '2026-10-21T06:00:42+02:00', pauses: [p('06:00', '06:10')] })),
    ).toBeUndefined();
  });

  it('Schema lehnt ungültige Pausen ab (gleiche Prüfung für Import und Datenbank)', () => {
    expect(SessionSchema.safeParse(s({ pauses: [p('07:00', '08:00')] })).success).toBe(true);
    expect(SessionSchema.safeParse(s({ pauses: [p('07:00', '08:00'), p('07:30', '07:45')] })).success).toBe(
      false,
    );
  });

  it('Ende setzen: offene Pause endet mit der Session, spätere entfallen, überstehende werden gekürzt', () => {
    const end = '2026-10-21T08:00:00+02:00';
    expect(pausesUntil([p('07:00', '07:10'), p('07:50'), p('09:00', '09:10')], end)).toEqual([
      p('07:00', '07:10'),
      { from: p('07:50').from, to: end },
    ]);
    expect(pausesUntil([p('09:00', '09:10')], end)).toBeUndefined();
  });

  it('nachgetragene Pause wird zeitlich einsortiert', () => {
    expect(withPause([p('09:00', '09:10')], p('07:00', '07:10')).map((x) => x.from)).toEqual([
      p('07:00').from,
      p('09:00').from,
    ]);
  });

  it('Statistik: Fänge pro Stunde und Session-Vergleich rechnen ohne Pausen', () => {
    const sessions = [
      session('a', '2026-06-01T06:00:00+02:00', '2026-06-01T09:00:00+02:00', {
        pauses: [{ from: '2026-06-01T07:00:00+02:00', to: '2026-06-01T08:00:00+02:00' }],
      }),
      session('b', '2026-06-02T06:00:00+02:00', '2026-06-02T08:00:00+02:00'),
    ];
    const catches = [
      entry('caught', '2026-06-01T06:30:00+02:00', { sessionId: 'a' }),
      entry('caught', '2026-06-01T08:30:00+02:00', { sessionId: 'a' }),
      entry('caught', '2026-06-02T07:00:00+02:00', { sessionId: 'b' }),
    ];
    const st = computeStats(
      catches,
      sessions,
      { period: 'all', speciesId: '', water: '' },
      Date.parse('2026-07-01T00:00:00Z'),
    );
    expect(st.perHour.hours).toBe(4); // 2 h aktiv + 2 h
    expect(st.sessions.find((r) => r.id === 'a')?.durationMs).toBe(2 * 3600e3);
    expect(st.sessions.find((r) => r.id === 'a')?.perHour).toBe(1);
  });
});
