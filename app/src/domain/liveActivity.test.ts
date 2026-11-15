import { describe, expect, it } from 'vitest';
import {
  biggestFish,
  distanceKmOf,
  KEEP_ENDED_SECONDS,
  liveKey,
  livePayload,
  nextLiveAction,
  type LiveMemory,
} from './liveActivity';
import type { Catch, Session } from './schemas';

const meta = { rev: 1, createdAt: '2026-11-15T07:00:00+01:00', updatedAt: '2026-11-15T07:00:00+01:00' };
const START = Date.parse('2026-11-15T07:00:00+01:00');
const session = (over: Partial<Session> = {}): Session =>
  ({ ...meta, id: 's1', startAt: '2026-11-15T07:00:00+01:00', tz: 'Europe/Berlin', ...over }) as Session;
const fang = (id: string, over: Partial<Catch> = {}): Catch =>
  ({
    ...meta,
    id,
    outcome: 'caught',
    at: '2026-11-15T08:00:00+01:00',
    tz: 'Europe/Berlin',
    sessionId: 's1',
    ...over,
  }) as Catch;
const NOW = START + 2 * 3600e3 + 14 * 60e3 + 36e3; // 2:14:36 nach dem Start

describe('livePayload', () => {
  it('läuft: Zeit, Fänge, Bisse, Titel, Strecke', () => {
    const s = session({ waterSnapshot: { name: 'De Wittsee' } });
    const p = livePayload(
      s,
      [
        fang('a'),
        fang('b', { outcome: 'contact' }),
        fang('c', { outcome: 'missed_bite' }),
        fang('d', { outcome: 'observation' }),
      ],
      3420,
      { showTitle: true, nowMs: NOW },
    );
    expect(p).toMatchObject({
      sessionId: 's1',
      state: 'running',
      title: 'De Wittsee',
      activeSeconds: 2 * 3600 + 14 * 60 + 36,
      catches: 1,
      bites: 3,
      distanceKm: 3.4,
    });
    expect(p.timerStartMs).toBe(START);
    expect(p.biggest).toBeUndefined();
  });
  it('Pausen zählen nicht zur Angelzeit; offene Pause = pausiert', () => {
    const s = session({
      pauses: [
        { from: '2026-11-15T08:00:00+01:00', to: '2026-11-15T08:30:00+01:00' },
        { from: '2026-11-15T09:00:00+01:00' },
      ],
    });
    const p = livePayload(s, [], undefined, { showTitle: true, nowMs: NOW });
    expect(p.state).toBe('paused');
    // 2:14:36 gesamt, 30 min geschlossene Pause, offene Pause seit 09:00 (14:36 min) abgezogen
    expect(p.activeSeconds).toBe(2 * 3600 + 14 * 60 + 36 - 30 * 60 - (14 * 60 + 36));
  });
  it('ohne Gewässer „Angeltag“, eigener Name vor Datenname, Titel kann aus sein', () => {
    expect(livePayload(session(), [], undefined, { showTitle: true, nowMs: NOW }).title).toBe('Angeltag');
    const s = session({ waterSnapshot: { name: 'Rhein', customName: 'Mein Bach' } });
    expect(livePayload(s, [], undefined, { showTitle: true, nowMs: NOW }).title).toBe('Mein Bach');
    expect(livePayload(s, [], undefined, { showTitle: false, nowMs: NOW }).title).toBe('');
  });
  it('beendet: größter Fisch, nur Einträge dieser Session', () => {
    const s = session({ endAt: '2026-11-15T11:00:00+01:00' });
    const p = livePayload(
      s,
      [
        fang('a', { speciesId: 'pike', lengthCm: 74 }),
        fang('b', { speciesId: 'perch', lengthCm: 28 }),
        fang('x', { speciesId: 'zander', lengthCm: 99, sessionId: 'andere' }),
      ],
      undefined,
      { showTitle: true, nowMs: NOW },
    );
    expect(p.state).toBe('ended');
    expect(p.biggest).toBe('Hecht 74 cm');
    expect(p.catches).toBe(2);
    expect(p.activeSeconds).toBe(4 * 3600);
  });
});

describe('Hilfen', () => {
  it('größter Fisch: Länge fehlt → nichts, Art fehlt → nur Länge, Komma bei Dezimalen', () => {
    expect(biggestFish([fang('a')])).toBeUndefined();
    expect(biggestFish([fang('a', { lengthCm: 41.5 })])).toBe('41,5 cm');
    expect(biggestFish([fang('a', { outcome: 'contact', lengthCm: 80 })])).toBeUndefined();
  });
  it('Strecke: unter 50 m oder ohne Route nichts, sonst 0,1 km', () => {
    expect(distanceKmOf(undefined)).toBeUndefined();
    expect(distanceKmOf(49)).toBeUndefined();
    expect(distanceKmOf(50)).toBe(0.1);
    expect(distanceKmOf(3449)).toBe(3.4);
  });
  it('Schlüssel ändert sich bei Fang, Pause, Titel – nicht mit der Uhrzeit', () => {
    const s = session();
    const a = livePayload(s, [], undefined, { showTitle: true, nowMs: NOW });
    const b = livePayload(s, [], undefined, { showTitle: true, nowMs: NOW + 5000 });
    expect(liveKey(a, s)).toBe(liveKey(b, s));
    const c = livePayload(s, [fang('a')], undefined, { showTitle: true, nowMs: NOW });
    expect(liveKey(c, s)).not.toBe(liveKey(a, s));
    const paused = session({ pauses: [{ from: '2026-11-15T09:00:00+01:00' }] });
    const d = livePayload(paused, [], undefined, { showTitle: true, nowMs: NOW });
    expect(liveKey(d, paused)).not.toBe(liveKey(a, s));
    const e = livePayload(s, [], undefined, { showTitle: false, nowMs: NOW });
    expect(liveKey(e, s)).not.toBe(liveKey(a, s));
  });
});

describe('nextLiveAction', () => {
  const run = (s: Session, catches: Catch[] = []) => {
    const p = livePayload(s, catches, undefined, { showTitle: true, nowMs: NOW });
    return { p, key: liveKey(p, s) };
  };
  it('Start, dann nichts, dann Aktualisierung bei Änderung', () => {
    const s = session();
    const one = run(s);
    const r1 = nextLiveAction({}, one.p, one.key, true);
    expect(r1.action?.kind).toBe('start');
    const r2 = nextLiveAction(r1.memory, one.p, one.key, true);
    expect(r2.action).toBeUndefined();
    const two = run(s, [fang('a')]);
    const r3 = nextLiveAction(r2.memory, two.p, two.key, true);
    expect(r3.action?.kind).toBe('update');
  });
  it('Ende mit Zusammenfassung nur für die angezeigte Session, einmal', () => {
    const live = run(session());
    const shown = nextLiveAction({}, live.p, live.key, true).memory;
    const done = run(session({ endAt: '2026-11-15T11:00:00+01:00' }));
    const r = nextLiveAction(shown, done.p, done.key, true);
    expect(r.action).toMatchObject({ kind: 'end', sessionId: 's1', keepSeconds: KEEP_ENDED_SECONDS });
    expect(nextLiveAction(r.memory, done.p, done.key, true).action).toBeUndefined();
    // eine alte, längst beendete Session wird nie angezeigt
    expect(nextLiveAction({}, done.p, done.key, true).action).toBeUndefined();
  });
  it('ausgeschaltet oder keine Session: laufende Anzeige sofort weg, sonst nichts', () => {
    const live = run(session());
    const shown: LiveMemory = nextLiveAction({}, live.p, live.key, true).memory;
    expect(nextLiveAction(shown, live.p, live.key, false).action).toEqual({
      kind: 'end',
      sessionId: 's1',
      keepSeconds: 0,
    });
    expect(nextLiveAction(shown, undefined, undefined, true).action).toMatchObject({
      kind: 'end',
      keepSeconds: 0,
    });
    expect(nextLiveAction({}, undefined, undefined, true).action).toBeUndefined();
    expect(nextLiveAction({}, live.p, live.key, false).action).toBeUndefined();
  });
  it('neue Session nach einer beendeten startet neu', () => {
    const live = run(session());
    const shown = nextLiveAction({}, live.p, live.key, true).memory;
    const done = run(session({ endAt: '2026-11-15T11:00:00+01:00' }));
    const ended = nextLiveAction(shown, done.p, done.key, true).memory;
    const next = run(session({ id: 's2' }));
    expect(nextLiveAction(ended, next.p, next.key, true).action?.kind).toBe('start');
  });
});
