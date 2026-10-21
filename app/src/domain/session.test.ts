import { describe, expect, it } from 'vitest';
import type { Catch, Session } from './schemas';
import {
  covers,
  durationMs,
  formatDuration,
  looksForgotten,
  runningSession,
  sessionCatches,
  suggestedEnd,
} from './session';

const meta = { createdAt: '2026-10-21T06:00:00+02:00', updatedAt: '2026-10-21T06:00:00+02:00', rev: 0 };
const session = (over: Partial<Session> = {}): Session => ({
  id: 's1',
  ...meta,
  startAt: '2026-10-21T06:00:00+02:00',
  tz: 'Europe/Berlin',
  ...over,
});
const entry = (id: string, at: string, over: Partial<Catch> = {}): Catch => ({
  id,
  ...meta,
  outcome: 'caught',
  at,
  tz: 'Europe/Berlin',
  sessionId: 's1',
  ...over,
});

describe('Sessions', () => {
  it('findet die laufende Session, ignoriert beendete und gelöschte', () => {
    const done = session({ id: 'a', endAt: '2026-10-21T08:00:00+02:00' });
    const trashed = session({ id: 'b', deletedAt: '2026-10-21T09:00:00+02:00' });
    expect(runningSession([done, trashed])).toBeUndefined();
    expect(runningSession([done, trashed, session({ id: 'c' })])?.id).toBe('c');
  });

  it('SES-1: Dauer und Zuordnung', () => {
    const s = session({ endAt: '2026-10-21T10:30:00+02:00' });
    expect(formatDuration(durationMs(s, 0))).toBe('4 h 30 min');
    expect(formatDuration(45 * 60000)).toBe('45 min');
    const list = sessionCatches(s, [
      entry('c2', '2026-10-21T09:00:00+02:00'),
      entry('c1', '2026-10-21T07:00:00+02:00'),
      entry('c3', '2026-10-21T11:00:00+02:00'), // nach dem Ende
      entry('x', '2026-10-21T08:00:00+02:00', { sessionId: 'andere' }),
      entry('d', '2026-10-21T08:00:00+02:00', { deletedAt: '2026-10-21T08:30:00+02:00' }),
    ]);
    expect(list.map((x) => [x.item.id, x.outside])).toEqual([
      ['c1', false],
      ['c2', false],
      ['c3', true],
    ]);
  });

  it('minutengenau: Fang in der Startminute gehört dazu; Dauer gerundet', () => {
    const s = session({ startAt: '2026-10-21T06:00:42+02:00' });
    expect(covers(s, '2026-10-21T06:00:00+02:00')).toBe(true);
    expect(covers(s, '2026-10-21T05:59:00+02:00')).toBe(false);
    expect(formatDuration(4 * 3600e3 - 400)).toBe('4 h 00 min');
  });

  it('laufende Session deckt alles ab Beginn ab', () => {
    expect(covers(session(), '2026-10-22T06:00:00+02:00')).toBe(true);
    expect(covers(session(), '2026-10-21T05:59:00+02:00')).toBe(false);
  });

  it('SES-3: nach 24 h „vergessen"; Vorschlag für das Ende', () => {
    const s = session();
    const start = Date.parse(s.startAt);
    expect(looksForgotten(s, start + 23 * 3600e3)).toBe(false);
    expect(looksForgotten(s, start + 25 * 3600e3)).toBe(true);
    expect(looksForgotten(session({ endAt: '2026-10-23T06:00:00+02:00' }), start + 99 * 3600e3)).toBe(false);
    expect(suggestedEnd(s, [])).toBe(start + 4 * 3600e3);
    expect(suggestedEnd(s, [entry('c', '2026-10-21T09:15:00+02:00')])).toBe(
      Date.parse('2026-10-21T09:15:00+02:00'),
    );
  });
});
