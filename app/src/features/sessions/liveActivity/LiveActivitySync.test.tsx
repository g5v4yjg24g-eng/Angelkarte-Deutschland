import 'fake-indexeddb/auto';
import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setDb } from '../../../data/db';
import { setSetting } from '../../../data/settings';
import { endSession, pauseSession, startSession } from '../../../data/sessionService';
import { KEEP_ENDED_SECONDS } from '../../../domain/liveActivity';
import type { LiveActivityProvider } from '../../../ports/liveActivity';
import { ProvidersProvider } from '../../../ports/providers';
import type { Providers } from '../../../ports/providersContext';
import { freshDb } from '../../../test/dbTestUtils';
import { LiveActivitySync } from './LiveActivitySync';

function fake() {
  const p = {
    available: vi.fn(() => Promise.resolve(true)),
    start: vi.fn<LiveActivityProvider['start']>(() => Promise.resolve()),
    update: vi.fn<LiveActivityProvider['update']>(() => Promise.resolve()),
    end: vi.fn<LiveActivityProvider['end']>(() => Promise.resolve()),
  };
  return p satisfies LiveActivityProvider;
}
const mount = (live: LiveActivityProvider | undefined) =>
  render(
    <ProvidersProvider value={{ liveActivity: live } as unknown as Providers}>
      <LiveActivitySync />
    </ProvidersProvider>,
  );

describe('LiveActivitySync', () => {
  beforeEach(() => setDb(freshDb()));
  afterEach(() => setDb(undefined));

  it('startet mit der Session, aktualisiert bei Pause und beendet mit Zusammenfassung', async () => {
    const db = freshDb();
    setDb(db);
    const live = fake();
    mount(live);
    const s = await startSession(db);
    await waitFor(() => expect(live.start).toHaveBeenCalledTimes(1));
    expect(live.start.mock.calls[0]?.[0]).toMatchObject({
      sessionId: s.id,
      state: 'running',
      title: 'Angeltag',
    });

    await act(async () => {
      await pauseSession(s.id, Date.parse(s.startAt) + 600e3, db);
    });
    await waitFor(() => expect(live.update).toHaveBeenCalledTimes(1));
    expect(live.update.mock.calls[0]?.[0]).toMatchObject({ state: 'paused' });

    await act(async () => {
      await endSession(s.id, Date.parse(s.startAt) + 3600e3, db);
    });
    await waitFor(() => expect(live.end).toHaveBeenCalledTimes(1));
    const [id, payload, keep] = live.end.mock.calls[0] ?? [];
    expect(id).toBe(s.id);
    expect(payload).toMatchObject({ state: 'ended' });
    expect(keep).toBe(KEEP_ENDED_SECONDS);
  });

  it('ausgeschaltet: nichts wird angezeigt', async () => {
    const db = freshDb();
    setDb(db);
    await setSetting('liveActivity', false, db);
    const live = fake();
    mount(live);
    await startSession(db);
    await new Promise((r) => setTimeout(r, 300));
    expect(live.start).not.toHaveBeenCalled();
  });

  it('Gewässername aus: der Titel bleibt leer', async () => {
    const db = freshDb();
    setDb(db);
    await setSetting('liveActivityTitle', false, db);
    const live = fake();
    mount(live);
    await startSession(db);
    await waitFor(() => expect(live.start).toHaveBeenCalled());
    expect(live.start.mock.calls[0]?.[0]).toMatchObject({ title: '' });
  });

  it('ohne Anbieter (Browser) passiert nichts und nichts bricht', async () => {
    const db = freshDb();
    setDb(db);
    const { container } = mount(undefined);
    await startSession(db);
    await new Promise((r) => setTimeout(r, 100));
    expect(container).toBeEmptyDOMElement();
  });
});
