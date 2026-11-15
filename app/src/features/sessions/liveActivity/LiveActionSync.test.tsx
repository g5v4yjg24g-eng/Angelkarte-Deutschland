import 'fake-indexeddb/auto';
import { render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { setDb } from '../../../data/db';
import { startSession } from '../../../data/sessionService';
import type { PendingLiveAction } from '../../../domain/liveActivity';
import type { LiveActivityProvider } from '../../../ports/liveActivity';
import { ProvidersProvider } from '../../../ports/providers';
import type { Providers } from '../../../ports/providersContext';
import { freshDb } from '../../../test/dbTestUtils';
import { LiveActionSync } from './LiveActionSync';

describe('LiveActionSync', () => {
  afterEach(() => setDb(undefined));

  it('führt vorgemerkte Aktionen beim Start und bei einem neuen Knopfdruck aus', async () => {
    const db = freshDb();
    setDb(db);
    const s = await startSession(db);
    const t0 = Date.parse(s.startAt);
    const queue: PendingLiveAction[][] = [
      [{ action: 'pause', sessionId: s.id, atMs: Math.max(t0 + 1, Date.now() - 5000) }],
      [],
    ];
    let listener: (() => void) | undefined;
    const live = {
      available: () => Promise.resolve(true),
      start: () => Promise.resolve(),
      update: () => Promise.resolve(),
      end: () => Promise.resolve(),
      takeActions: vi.fn(() => Promise.resolve(queue.shift() ?? [])),
      onAction: (l: () => void) => {
        listener = l;
        return () => undefined;
      },
    } satisfies LiveActivityProvider;
    render(
      <ProvidersProvider value={{ liveActivity: live, account: { enabled: false } } as unknown as Providers}>
        <LiveActionSync />
      </ProvidersProvider>,
    );
    // beim Start: Pause aus der Warteschlange
    await waitFor(async () => expect((await db.sessions.get(s.id))?.pauses).toHaveLength(1), {
      timeout: 5000,
    });
    expect(t0).toBeLessThan(Date.now());
    // später ein Knopfdruck, während die App läuft
    queue.length = 0;
    queue.push([{ action: 'end', sessionId: s.id, atMs: Date.now() }]);
    listener?.();
    await waitFor(async () => expect((await db.sessions.get(s.id))?.endAt).toBeDefined(), { timeout: 5000 });
  }, 20000);

  it('ohne Anbieter (Browser) passiert nichts', () => {
    const { container } = render(
      <ProvidersProvider value={{ account: { enabled: false } } as unknown as Providers}>
        <LiveActionSync />
      </ProvidersProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
