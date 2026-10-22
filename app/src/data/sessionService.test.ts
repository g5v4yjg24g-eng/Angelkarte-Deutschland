// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import { ValidationError } from './errors';
import {
  addPause,
  endSession,
  pauseSession,
  removePause,
  resumeSession,
  SessionRunningError,
  SessionStateError,
  startSession,
} from './sessionService';

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

describe('Session-Pausen (Daten)', () => {
  it('Pause und Weiter; zweite Pause gleichzeitig nicht möglich', async () => {
    const db = freshDb();
    const s = await startSession(db);
    const t0 = Date.parse(s.startAt);
    await pauseSession(s.id, t0 + 30 * 60000, db);
    await expect(pauseSession(s.id, t0 + 31 * 60000, db)).rejects.toBeInstanceOf(SessionStateError);
    const r = await resumeSession(s.id, t0 + 45 * 60000, db);
    expect(r.pauses).toHaveLength(1);
    expect(Date.parse(r.pauses?.[0]?.to ?? '') - Date.parse(r.pauses?.[0]?.from ?? '')).toBe(15 * 60000);
    await expect(resumeSession(s.id, t0 + 50 * 60000, db)).rejects.toBeInstanceOf(SessionStateError);
  });

  it('Beenden während einer Pause schließt sie', async () => {
    const db = freshDb();
    const s = await startSession(db);
    const t0 = Date.parse(s.startAt);
    await pauseSession(s.id, t0 + 60 * 60000, db);
    const e = await endSession(s.id, t0 + 90 * 60000, db);
    expect(e.pauses?.[0]?.to).toBe(e.endAt);
  });

  it('Nachtragen prüft über das Schema; Entfernen', async () => {
    const db = freshDb();
    const s = await startSession(db);
    const t0 = Date.parse(s.startAt);
    await endSession(s.id, t0 + 4 * 3600e3, db);
    await addPause(s.id, t0 + 3600e3, t0 + 2 * 3600e3, db);
    await expect(addPause(s.id, t0 + 1.5 * 3600e3, t0 + 1.6 * 3600e3, db)).rejects.toBeInstanceOf(
      ValidationError,
    );
    await expect(addPause(s.id, t0 + 3.5 * 3600e3, t0 + 5 * 3600e3, db)).rejects.toBeInstanceOf(
      ValidationError,
    );
    expect((await db.sessions.get(s.id))?.pauses).toHaveLength(1);
    const r = await removePause(s.id, 0, db);
    expect(r.pauses).toBeUndefined();
  });
});
