// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import { endSession, pauseSession, resumeSession, startSession } from './sessionService';
import { getTrack, recordFix } from './trackService';

const north = (m: number) => m / 111_195;

describe('Route speichern (TRK-3)', () => {
  it('Punkte einer laufenden Session werden sofort gespeichert; Pause und Ende nehmen nichts mehr an', async () => {
    const db = freshDb();
    const s = await startSession(db);
    const t0 = Date.parse(s.startAt) + 1000;
    const at = (sec: number, m: number) => ({ t: t0 + sec * 1000, lat: 51 + north(m), lng: 7, acc: 5 });
    expect((await recordFix(s.id, at(0, 0), true, db)).kind).toBe('newSegment');
    expect((await recordFix(s.id, at(30, 40), false, db)).kind).toBe('append');
    // nach einem Neustart der App: Daten sind da
    expect((await getTrack(s.id, db))?.segments).toHaveLength(1);
    expect((await getTrack(s.id, db))?.segments[0]).toHaveLength(2);

    await pauseSession(s.id, t0 + 40_000, db);
    expect(await recordFix(s.id, at(50, 100), false, db)).toEqual({ kind: 'skip', reason: 'past' });
    await resumeSession(s.id, t0 + 60_000, db);
    expect((await recordFix(s.id, at(70, 140), true, db)).kind).toBe('newSegment');

    await endSession(s.id, t0 + 80_000, db);
    expect(await recordFix(s.id, at(90, 200), false, db)).toEqual({ kind: 'skip', reason: 'past' });
    const tr = await getTrack(s.id, db);
    expect(tr?.segments.map((x) => x.length)).toEqual([2, 1]);
    // Session und Fang-Daten unberührt
    expect((await db.sessions.get(s.id))?.endAt).toBeDefined();
  });

  it('Fix vor dem Beginn der Session wird nicht gespeichert', async () => {
    const db = freshDb();
    const s = await startSession(db);
    const r = await recordFix(s.id, { t: Date.parse(s.startAt) - 60_000, lat: 51, lng: 7, acc: 5 }, true, db);
    expect(r.kind).toBe('skip');
    expect(await getTrack(s.id, db)).toBeUndefined();
  });
});
