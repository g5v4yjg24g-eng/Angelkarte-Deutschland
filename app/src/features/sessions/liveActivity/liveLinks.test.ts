// @vitest-environment node
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setDb } from '../../../data/db';
import { startSession, pauseSession, endSession } from '../../../data/sessionService';
import { freshDb } from '../../../test/dbTestUtils';
import { runLiveAction } from './liveLinks';

describe('Knöpfe der Live Activity', () => {
  beforeEach(() => setDb(freshDb()));
  afterEach(() => setDb(undefined));
  const nav = () => vi.fn();

  it('Pause und Weiter ändern die laufende Session und öffnen sie', async () => {
    const db = freshDb();
    setDb(db);
    const s = await startSession(db);
    const go = nav();
    await runLiveAction('pause', go);
    expect((await db.sessions.get(s.id))?.pauses?.at(-1)?.to).toBeUndefined();
    expect((await db.sessions.get(s.id))?.pauses).toHaveLength(1);
    expect(go).toHaveBeenCalledWith(`/fangbuch/sessions/${s.id}`);
    // zweimal Pause: keine zweite Pause
    await runLiveAction('pause', nav());
    expect((await db.sessions.get(s.id))?.pauses).toHaveLength(1);
    await runLiveAction('resume', nav());
    expect((await db.sessions.get(s.id))?.pauses?.at(-1)?.to).toBeDefined();
  });
  it('Beenden beendet die Session, beendet die gemeinsame auf dem Server und öffnet den Rückblick', async () => {
    const db = freshDb();
    setDb(db);
    const s = await startSession(db);
    await db.sessions.update(s.id, { groupId: 'g1' });
    const go = nav();
    const endGroup = vi.fn(() => Promise.resolve());
    await runLiveAction('end', go, endGroup);
    expect((await db.sessions.get(s.id))?.endAt).toBeDefined();
    expect(endGroup).toHaveBeenCalledWith('g1');
    expect(go).toHaveBeenCalledWith(`/fangbuch/sessions/${s.id}/rueckblick`);
    // ohne laufende Session passiert nichts weiter
    const go2 = nav();
    await runLiveAction('end', go2, endGroup);
    expect(go2).toHaveBeenCalledWith('/fangbuch/sessions');
    expect(endGroup).toHaveBeenCalledTimes(1);
  });
  it('Beenden: Fehler beim Server stört nicht', async () => {
    const db = freshDb();
    setDb(db);
    const s = await startSession(db);
    await db.sessions.update(s.id, { groupId: 'g1' });
    const go = nav();
    await runLiveAction('end', go, () => Promise.reject(new Error('offline')));
    expect(go).toHaveBeenCalledWith(`/fangbuch/sessions/${s.id}/rueckblick`);
  });
  it('Fang erfassen öffnet die Karte im Wahlmodus', async () => {
    const go = nav();
    await runLiveAction('catch', go);
    expect(go).toHaveBeenCalledWith('/', { state: { startCatch: true } });
  });
  it('Rückblick: zuletzt beendete Session; ohne Session die Liste', async () => {
    const db = freshDb();
    setDb(db);
    const go = nav();
    await runLiveAction('review', go);
    expect(go).toHaveBeenCalledWith('/fangbuch/sessions');
    const s = await startSession(db);
    await pauseSession(s.id, Date.parse(s.startAt) + 600e3, db);
    await endSession(s.id, Date.parse(s.startAt) + 3600e3, db);
    const go2 = nav();
    await runLiveAction('review', go2);
    expect(go2).toHaveBeenCalledWith(`/fangbuch/sessions/${s.id}/rueckblick`);
  });
});
