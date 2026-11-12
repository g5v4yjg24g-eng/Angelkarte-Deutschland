import { describe, expect, it } from 'vitest';
import type { Place } from '../domain/schemas';
import type { SpotSyncState } from '../domain/spotSync';
import { runSpotSync } from './spotSyncService';

const place = (id: string, over: Partial<Place> = {}): Place =>
  ({
    id,
    type: 'spot',
    name: `Ort ${id}`,
    position: { lat: 51.3, lng: 6.2, source: 'map-tap' },
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
    rev: 0,
    ...over,
  }) as Place;

const link = (partnerId: string, over: Record<string, unknown> = {}) => ({
  id: `l-${partnerId}`,
  partnerId,
  username: partnerId,
  displayName: partnerId,
  badges: [],
  direction: 'outgoing' as const,
  status: 'accepted' as const,
  createdAt: '2026-11-12T10:00:00Z',
  spotsFromPartner: 0,
  spotsToPartner: 0,
  iShare: true,
  ...over,
});

function setup(links: ReturnType<typeof link>[], places: Place[], state: SpotSyncState = {}) {
  const calls: string[] = [];
  let saved: SpotSyncState = state;
  const deps = {
    account: {
      spotLinks: () => Promise.resolve(links),
      shareSpot: (i: { placeId: string; recipientId?: string | undefined }) => {
        calls.push(`share:${i.placeId}>${i.recipientId}`);
        return Promise.resolve();
      },
      unsharePlace: (id: string) => {
        calls.push(`unshare:${id}`);
        return Promise.resolve();
      },
    },
    places: () => Promise.resolve(places),
    load: () => state,
    save: (s: SpotSyncState) => {
      saved = s;
    },
  };
  return { deps, calls, saved: () => saved };
}

describe('Orte automatisch teilen: Abgleich (SPOT-7)', () => {
  it('lädt neue Orte bei allen angenommenen Partnern hoch und merkt es sich', async () => {
    const t = setup([link('u-anna'), link('u-bert')], [place('p1'), place('p2', { sharedWithFriends: false })]);
    const r = await runSpotSync(t.deps);
    expect(t.calls).toEqual(['share:p1>u-anna', 'share:p1>u-bert']);
    expect(r).toMatchObject({ partners: 2, uploaded: 2, removed: 0 });
    // zweiter Lauf: nichts mehr zu tun
    const again = setup([link('u-anna'), link('u-bert')], [place('p1')], t.saved());
    await runSpotSync(again.deps);
    expect(again.calls).toEqual([]);
  });

  it('wartende Angebote und Bestandsverbindungen ohne Zustimmung bekommen nichts', async () => {
    const t = setup(
      [link('u-a', { status: 'pending' }), link('u-b', { iShare: false }), link('u-c', { direction: 'incoming' })],
      [place('p1')],
    );
    await runSpotSync(t.deps);
    // nur die angenommene Verbindung (u-c hatte angeboten, ich habe angenommen) bekommt den Ort
    expect(t.calls).toEqual(['share:p1>u-c']);
  });

  it('entfernt Orte, die abgeschaltet oder gelöscht wurden', async () => {
    const state: SpotSyncState = {
      p1: { sig: 'x', to: ['u-anna'] },
      p2: { sig: 'y', to: ['u-anna'] },
    };
    const t = setup([link('u-anna')], [place('p1', { sharedWithFriends: false }), place('p2', { deletedAt: '2026-11-02T00:00:00Z' })], state);
    const r = await runSpotSync(t.deps);
    expect(t.calls.sort()).toEqual(['unshare:p1', 'unshare:p2']);
    expect(r.removed).toBe(2);
    expect(t.saved()).toEqual({});
  });

  it('beendete Verbindung mitten im Lauf überspringt nur diese Person', async () => {
    const t = setup([link('u-anna'), link('u-bert')], [place('p1'), place('p2')]);
    t.deps.account.shareSpot = (i) => {
      if (i.recipientId === 'u-anna') return Promise.reject(new Error('no_link'));
      t.calls.push(`share:${i.placeId}>${i.recipientId}`);
      return Promise.resolve();
    };
    const r = await runSpotSync(t.deps);
    expect(t.calls).toEqual(['share:p1>u-bert', 'share:p2>u-bert']);
    expect(r.uploaded).toBe(2);
  });

  it('anderer Fehler bricht ab, bisher Erledigtes bleibt gemerkt', async () => {
    const t = setup([link('u-anna')], [place('p1'), place('p2')]);
    let n = 0;
    t.deps.account.shareSpot = (i) => {
      if (++n === 2) return Promise.reject(new Error('offline'));
      t.calls.push(`share:${i.placeId}`);
      return Promise.resolve();
    };
    await expect(runSpotSync(t.deps)).rejects.toThrow('offline');
    expect(Object.keys(t.saved())).toEqual(['p1']);
  });

  it('höchstens so viele Uploads je Lauf wie erlaubt', async () => {
    const t = setup([link('u-anna')], [place('p1'), place('p2'), place('p3')]);
    const r = await runSpotSync({ ...t.deps, limit: 2 });
    expect(t.calls).toHaveLength(2);
    expect(r.more).toBe(true);
  });
});
