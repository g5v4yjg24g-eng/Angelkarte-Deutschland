// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setDb } from '../../../data/db';
import { startSession } from '../../../data/sessionService';
import { freshDb } from '../../../test/dbTestUtils';
import { applyPendingActions } from './pendingActions';

describe('Aktionen der Live-Activity-Knöpfe ausführen', () => {
  afterEach(() => setDb(undefined));

  it('Pause und Weiter zum Zeitpunkt des Knopfdrucks, nicht zur Ausführungszeit', async () => {
    const db = freshDb();
    setDb(db);
    const s = await startSession(db);
    const t0 = Date.parse(s.startAt);
    const now = t0 + 3 * 3600e3;
    await applyPendingActions(
      [
        { action: 'pause', sessionId: s.id, atMs: t0 + 600e3 },
        { action: 'resume', sessionId: s.id, atMs: t0 + 1200e3 },
      ],
      undefined,
      now,
    );
    const p = (await db.sessions.get(s.id))?.pauses ?? [];
    expect(p).toHaveLength(1);
    expect(Date.parse(p[0]?.from ?? '') - t0).toBe(600e3);
    expect(Date.parse(p[0]?.to ?? '') - t0).toBe(1200e3);
  });

  it('Beenden zum Zeitpunkt des Knopfdrucks, beendet die gemeinsame Session, Fehler stören nicht', async () => {
    const db = freshDb();
    setDb(db);
    const s = await startSession(db);
    await db.sessions.update(s.id, { groupId: 'g1' });
    const t0 = Date.parse(s.startAt);
    const endGroup = vi.fn(() => Promise.reject(new Error('offline')));
    await applyPendingActions([{ action: 'end', sessionId: s.id, atMs: t0 + 3600e3 }], endGroup, t0 + 7200e3);
    const ended = await db.sessions.get(s.id);
    expect(Date.parse(ended?.endAt ?? '') - t0).toBe(3600e3);
    expect(endGroup).toHaveBeenCalledWith('g1');
  });

  it('„Ja“ auf die Nachfrage nach 5 Stunden merkt den Zeitpunkt, die Session läuft weiter', async () => {
    const db = freshDb();
    setDb(db);
    const s = await startSession(db);
    const t0 = Date.parse(s.startAt);
    await applyPendingActions([{ action: 'keep', sessionId: s.id, atMs: t0 + 5 * 3600e3 }], undefined, t0 + 5.1 * 3600e3);
    const after = await db.sessions.get(s.id);
    expect(Date.parse(after?.stillFishingAt ?? '') - t0).toBe(5 * 3600e3);
    expect(after?.endAt).toBeUndefined();
  });

  it('doppelte, veraltete und unpassende Aktionen werden übergangen', async () => {
    const db = freshDb();
    setDb(db);
    const s = await startSession(db);
    const t0 = Date.parse(s.startAt);
    const now = t0 + 3600e3;
    await applyPendingActions(
      [
        { action: 'resume', sessionId: s.id, atMs: t0 + 100e3 }, // keine offene Pause
        { action: 'pause', sessionId: s.id, atMs: t0 + 200e3 },
        { action: 'pause', sessionId: s.id, atMs: t0 + 300e3 }, // schon pausiert
        { action: 'end', sessionId: 'unbekannt', atMs: t0 + 400e3 },
      ],
      undefined,
      now,
    );
    const after = await db.sessions.get(s.id);
    expect(after?.pauses).toHaveLength(1);
    expect(after?.endAt).toBeUndefined();
    // zu alt: nichts passiert
    await applyPendingActions(
      [{ action: 'end', sessionId: s.id, atMs: t0 + 400e3 }],
      undefined,
      t0 + 20 * 3600e3,
    );
    expect((await db.sessions.get(s.id))?.endAt).toBeUndefined();
    // beendete Session bleibt unberührt
    await applyPendingActions([{ action: 'end', sessionId: s.id, atMs: t0 + 900e3 }], undefined, now);
    const endAt = (await db.sessions.get(s.id))?.endAt;
    await applyPendingActions([{ action: 'end', sessionId: s.id, atMs: t0 + 1000e3 }], undefined, now);
    expect((await db.sessions.get(s.id))?.endAt).toBe(endAt);
  });
});
