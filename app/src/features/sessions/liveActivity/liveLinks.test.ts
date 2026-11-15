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
  it('Beenden öffnet nur die Session (dort mit Rückfrage), beendet aber nichts', async () => {
    const db = freshDb();
    setDb(db);
    const s = await startSession(db);
    const go = nav();
    await runLiveAction('end', go);
    expect(go).toHaveBeenCalledWith(`/fangbuch/sessions/${s.id}`);
    expect((await db.sessions.get(s.id))?.endAt).toBeUndefined();
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
