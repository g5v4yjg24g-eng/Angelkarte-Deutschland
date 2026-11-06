// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import { endSession, startSession } from './sessionService';
import { GroupSessionBusyError, joinGroupLocally, linkGroup } from './groupSessionService';

describe('Gemeinsame Session auf dem Gerät (GRP-2)', () => {
  it('Zusagen ohne laufende Session startet eine neue, verknüpfte Session mit Titel', async () => {
    const db = freshDb();
    const s = await joinGroupLocally({ id: 'g1', title: 'Abendansitz' }, db);
    expect(s).toMatchObject({ groupId: 'g1', title: 'Abendansitz' });
    expect(s.endAt).toBeUndefined();
    // zweimal zusagen: dieselbe Session
    expect((await joinGroupLocally({ id: 'g1' }, db)).id).toBe(s.id);
  });

  it('eine laufende eigene Session wird verknüpft; eine andere gemeinsame blockiert', async () => {
    const db = freshDb();
    const running = await startSession(db);
    const linked = await joinGroupLocally({ id: 'g1' }, db);
    expect(linked.id).toBe(running.id);
    expect(linked.groupId).toBe('g1');
    await expect(joinGroupLocally({ id: 'g2' }, db)).rejects.toBeInstanceOf(GroupSessionBusyError);
    await endSession(running.id, Date.now(), db);
    expect((await joinGroupLocally({ id: 'g2' }, db)).groupId).toBe('g2');
  });

  it('Verknüpfung lösen (Verlassen) lässt die eigene Session unverändert', async () => {
    const db = freshDb();
    const s = await joinGroupLocally({ id: 'g1' }, db);
    await linkGroup(s.id, undefined, db);
    const after = await db.sessions.get(s.id);
    expect(after?.groupId).toBeUndefined();
    expect(after?.startAt).toBe(s.startAt);
  });
});
