import { describe, expect, it } from 'vitest';
import type { Session } from './schemas';
import { checkId, sessionCheckPlan } from './sessionCheck';

const texts = { title: 'Angelst du noch?', body: (h: number) => `${h} h` };
const s = (over: Partial<Session> = {}): Session =>
  ({
    id: 's1',
    startAt: '2026-12-01T08:00:00+01:00',
    tz: 'Europe/Berlin',
    createdAt: '',
    updatedAt: '',
    ...over,
  }) as Session;
const START = Date.parse('2026-12-01T07:00:00Z');
const H = 3_600_000;

describe('sessionCheckPlan', () => {
  it('fragt 5 Stunden nach dem Beginn', () => {
    const [r] = sessionCheckPlan([s()], START + H, texts);
    expect(r?.at).toBe(START + 5 * H);
    expect(r?.id).toBe(checkId('s1'));
    expect(r?.sessionId).toBe('s1');
    expect(r?.body).toBe('5 h');
  });
  it('nach „Ja“ zählt es ab der Antwort, Text nennt die Stunden seit Beginn', () => {
    const plan = sessionCheckPlan([s({ stillFishingAt: '2026-12-01T13:05:00+01:00' })], START + 6 * H, texts);
    expect(plan[0]?.at).toBe(Date.parse('2026-12-01T12:05:00Z') + 5 * H);
    expect(plan[0]?.body).toBe('10 h');
  });
  it('nach einer Pause zählt es ab ihrem Ende', () => {
    const plan = sessionCheckPlan(
      [s({ pauses: [{ from: '2026-12-01T09:00:00+01:00', to: '2026-12-01T10:00:00+01:00' }] })],
      START + 3 * H,
      texts,
    );
    expect(plan[0]?.at).toBe(Date.parse('2026-12-01T09:00:00Z') + 5 * H);
  });
  it('keine Nachfrage bei Pause, Ende, gelöschter oder überfälliger Session', () => {
    const now = START + 2 * H;
    expect(sessionCheckPlan([s({ pauses: [{ from: '2026-12-01T09:00:00+01:00' }] })], now, texts)).toEqual([]);
    expect(sessionCheckPlan([s({ endAt: '2026-12-01T10:00:00+01:00' })], now, texts)).toEqual([]);
    expect(sessionCheckPlan([s({ deletedAt: '2026-12-01T10:00:00Z' })], now, texts)).toEqual([]);
    expect(sessionCheckPlan([s()], START + 6 * H, texts)).toEqual([]);
  });
});
