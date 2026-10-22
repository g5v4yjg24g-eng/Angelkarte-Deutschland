// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import { endSession, SessionRunningError, startSession } from './sessionService';

describe('Sessions (Daten)', () => {
  it('SES-2: eine zweite Session startet nicht, solange eine läuft', async () => {
    const db = freshDb();
    const s = await startSession(db);
    expect(s.endAt).toBeUndefined();
    await expect(startSession(db)).rejects.toBeInstanceOf(SessionRunningError);
    expect(await db.sessions.count()).toBe(1);
    await endSession(s.id, Date.parse(s.startAt) + 3600e3, db);
    const next = await startSession(db);
    expect(next.id).not.toBe(s.id);
  });

  it('Ende vor dem Beginn wird abgelehnt', async () => {
    const db = freshDb();
    const s = await startSession(db);
    await expect(endSession(s.id, Date.parse(s.startAt) - 60000, db)).rejects.toThrow();
    expect((await db.sessions.get(s.id))?.endAt).toBeUndefined();
  });
});
