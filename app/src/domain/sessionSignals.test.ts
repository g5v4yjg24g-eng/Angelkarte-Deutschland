import { describe, expect, it } from 'vitest';
import type { Session } from './schemas';
import {
  announcement,
  isFreshSignal,
  localState,
  parseSessionSignals,
  planSignal,
  signalTime,
  type SessionSignal,
} from './sessionSignals';

const base = {
  createdAt: '2026-06-14T06:00:00Z',
  updatedAt: '2026-06-14T06:00:00Z',
  rev: 0,
  tz: 'Europe/Berlin',
};
const session = (extra: Partial<Session> = {}): Session =>
  ({ ...base, id: 's1', startAt: '2026-06-14T08:00:00+02:00', groupId: 'g1', ...extra }) as Session;
const signal = (kind: SessionSignal['kind'], at = '2026-06-14T09:00:00+02:00'): SessionSignal => ({
  id: 'x1',
  groupId: 'g1',
  kind,
  byUserId: 'u1',
  byUsername: 'anna',
  byDisplayName: 'Anna',
  at,
  sessionEnded: false,
});
const NOW = Date.parse('2026-06-14T09:30:00+02:00');

describe('parseSessionSignals (SIG-1)', () => {
  it('liest Zeilen, wirft Kaputtes weg und sortiert nach Zeit', () => {
    const row = (id: string, at: string, kind = 'pause') => ({
      id,
      session_id: 'g1',
      kind,
      by_user_id: 'u1',
      by_username: 'anna',
      by_display_name: 'Anna',
      at,
      session_title: null,
      session_ended: false,
    });
    const out = parseSessionSignals([
      row('b', '2026-06-14T10:00:00Z'),
      row('a', '2026-06-14T09:00:00Z', 'end'),
      { id: 'x' },
      row('c', '2026-06-14T09:30:00Z', 'sprengen'),
      null,
    ]);
    expect(out.map((s) => s.id)).toEqual(['a', 'b']);
    expect(parseSessionSignals(null)).toEqual([]);
  });
});

describe('localState', () => {
  it('läuft, pausiert, beendet', () => {
    expect(localState(session())).toBe('running');
    expect(localState(session({ pauses: [{ from: '2026-06-14T09:00:00+02:00' }] }))).toBe('paused');
    expect(
      localState(
        session({ pauses: [{ from: '2026-06-14T09:00:00+02:00', to: '2026-06-14T09:10:00+02:00' }] }),
      ),
    ).toBe('running');
    expect(localState(session({ endAt: '2026-06-14T10:00:00+02:00' }))).toBe('ended');
  });
});

describe('planSignal: was die eigene Session tut', () => {
  it('Pause: nur wenn sie läuft, zum Zeitpunkt der Meldung', () => {
    expect(planSignal(signal('pause'), session(), NOW)).toEqual({
      action: 'pause',
      atMs: Date.parse('2026-06-14T09:00:00+02:00'),
    });
    expect(
      planSignal(signal('pause'), session({ pauses: [{ from: '2026-06-14T08:50:00+02:00' }] }), NOW),
    ).toEqual({
      action: 'none',
    });
  });
  it('Weiter: nur wenn sie pausiert; Ende: wenn sie läuft oder pausiert', () => {
    const paused = session({ pauses: [{ from: '2026-06-14T08:50:00+02:00' }] });
    expect(planSignal(signal('resume'), paused, NOW).action).toBe('resume');
    expect(planSignal(signal('resume'), session(), NOW).action).toBe('none');
    expect(planSignal(signal('end'), paused, NOW).action).toBe('end');
    expect(planSignal(signal('end'), session(), NOW).action).toBe('end');
  });
  it('nichts für eine beendete, gelöschte, fremde oder fehlende Session', () => {
    expect(planSignal(signal('end'), session({ endAt: '2026-06-14T09:00:00+02:00' }), NOW).action).toBe(
      'none',
    );
    expect(planSignal(signal('end'), session({ deletedAt: '2026-06-14T09:00:00Z' }), NOW).action).toBe(
      'none',
    );
    expect(planSignal(signal('end'), session({ groupId: 'andere' }), NOW).action).toBe('none');
    expect(planSignal(signal('end'), undefined, NOW).action).toBe('none');
  });
});

describe('signalTime', () => {
  it('nie vor dem Beginn oder der letzten Pause, nie in der Zukunft', () => {
    const s = session({ pauses: [{ from: '2026-06-14T08:20:00+02:00', to: '2026-06-14T08:40:00+02:00' }] });
    expect(signalTime(Date.parse('2026-06-14T07:00:00+02:00'), s, NOW)).toBe(
      Date.parse('2026-06-14T08:40:00+02:00'),
    );
    expect(signalTime(Date.parse('2026-06-14T09:00:00+02:00'), s, NOW)).toBe(
      Date.parse('2026-06-14T09:00:00+02:00'),
    );
    expect(signalTime(Date.parse('2026-06-14T12:00:00+02:00'), s, NOW)).toBe(NOW);
    expect(signalTime(Date.parse('2026-06-14T07:00:00+02:00'), session(), NOW)).toBe(
      Date.parse(session().startAt),
    );
  });
});

describe('announcement: was die eigene Session meldet', () => {
  it('Pause, Weiter und Ende; beim ersten Stand und ohne Wechsel nichts', () => {
    expect(announcement('running', 'paused')).toBe('pause');
    expect(announcement('paused', 'running')).toBe('resume');
    expect(announcement('running', 'ended')).toBe('end');
    expect(announcement('paused', 'ended')).toBe('end');
    expect(announcement(undefined, 'paused')).toBeUndefined();
    expect(announcement('running', 'running')).toBeUndefined();
    expect(announcement('ended', 'running')).toBeUndefined();
  });
});

describe('isFreshSignal', () => {
  it('höchstens 12 Stunden alt', () => {
    expect(isFreshSignal({ at: '2026-06-14T09:00:00+02:00' }, NOW)).toBe(true);
    expect(isFreshSignal({ at: '2026-06-13T09:00:00+02:00' }, NOW)).toBe(false);
  });
});
