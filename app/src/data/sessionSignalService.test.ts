// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import { repo } from './repository';
import { applySignal } from './sessionSignalService';
import { consumeEcho } from './signalEcho';
import type { SessionSignal } from '../domain/sessionSignals';

const sig = (kind: SessionSignal['kind'], at: string, groupId = 'g1'): SessionSignal => ({
  id: 'sig-1',
  groupId,
  kind,
  byUserId: 'u1',
  byUsername: 'anna',
  byDisplayName: 'Anna',
  at,
  sessionEnded: false,
});
const NOW = Date.parse('2026-06-14T10:00:00+02:00');

describe('applySignal (SIG-3)', () => {
  it('Pause, Weiter und Ende zum Zeitpunkt der Meldung; die Änderung wird als „von Meldung“ gemerkt', async () => {
    const db = freshDb();
    const s = await repo('sessions', db).create({
      startAt: '2026-06-14T08:00:00+02:00',
      tz: 'Europe/Berlin',
      groupId: 'g1',
    });
    expect(await applySignal(sig('pause', '2026-06-14T09:00:00+02:00'), NOW, db)).toBe('applied');
    expect((await db.sessions.get(s.id))?.pauses).toEqual([{ from: '2026-06-14T09:00:00+02:00' }]);
    expect(consumeEcho(s.id, 'paused')).toBe(true);
    expect(consumeEcho(s.id, 'paused')).toBe(false); // nur einmal

    // Pause bei schon pausierter Session: nichts
    expect(await applySignal(sig('pause', '2026-06-14T09:10:00+02:00'), NOW, db)).toBe('none');

    expect(await applySignal(sig('resume', '2026-06-14T09:20:00+02:00'), NOW, db)).toBe('applied');
    expect((await db.sessions.get(s.id))?.pauses).toEqual([
      { from: '2026-06-14T09:00:00+02:00', to: '2026-06-14T09:20:00+02:00' },
    ]);
    expect(consumeEcho(s.id, 'running')).toBe(true);

    expect(await applySignal(sig('end', '2026-06-14T09:45:00+02:00'), NOW, db)).toBe('applied');
    expect((await db.sessions.get(s.id))?.endAt).toBe('2026-06-14T09:45:00+02:00');
    expect(consumeEcho(s.id, 'ended')).toBe(true);
  });

  it('ohne passende lokale Session oder bei beendeter Session: nichts', async () => {
    const db = freshDb();
    expect(await applySignal(sig('end', '2026-06-14T09:45:00+02:00'), NOW, db)).toBe('none');
    const s = await repo('sessions', db).create({
      startAt: '2026-06-14T08:00:00+02:00',
      endAt: '2026-06-14T09:00:00+02:00',
      tz: 'Europe/Berlin',
      groupId: 'g1',
    });
    expect(await applySignal(sig('end', '2026-06-14T09:45:00+02:00'), NOW, db)).toBe('none');
    expect(consumeEcho(s.id, 'ended')).toBe(false);
    await repo('sessions', db).create({
      startAt: '2026-06-14T09:30:00+02:00',
      tz: 'Europe/Berlin',
      groupId: 'andere',
    });
    expect(await applySignal(sig('pause', '2026-06-14T09:45:00+02:00'), NOW, db)).toBe('none');
  });
});
