import { describe, expect, it } from 'vitest';
import type { Place } from './schemas';
import {
  parseSpotSyncState,
  planSpotSync,
  pruneSpotPartners,
  withUploaded,
  withoutPlace,
  type SpotSyncState,
} from './spotSync';

const place = (over: Partial<Place> = {}): Place =>
  ({
    id: 'p1',
    type: 'spot',
    name: 'Buhne 3',
    position: { lat: 51.3, lng: 6.2, source: 'map-tap' },
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
    rev: 0,
    ...over,
  }) as Place;

describe('Orte automatisch teilen (SPOT-7)', () => {
  it('neue Orte gehen an alle Partner, schon hochgeladene nicht noch einmal', () => {
    const a = place();
    const plan = planSpotSync([a], ['u-anna', 'u-bert'], {});
    expect(plan.uploads.map((u) => u.partnerId)).toEqual(['u-anna', 'u-bert']);
    const state = withUploaded({}, a, 'u-anna');
    expect(planSpotSync([a], ['u-anna', 'u-bert'], state).uploads.map((u) => u.partnerId)).toEqual(['u-bert']);
  });

  it('eine Änderung am Ort lädt ihn bei allen neu hoch', () => {
    const a = place();
    let state: SpotSyncState = withUploaded(withUploaded({}, a, 'u-anna'), a, 'u-bert');
    expect(planSpotSync([a], ['u-anna', 'u-bert'], state).uploads).toEqual([]);
    const changed = place({ name: 'Buhne 4' });
    expect(planSpotSync([changed], ['u-anna', 'u-bert'], state).uploads).toHaveLength(2);
    state = withUploaded(state, changed, 'u-anna');
    expect(state['p1']?.to).toEqual(['u-anna']);
  });

  it('abgeschaltete und gelöschte Orte werden nicht hochgeladen und bei Partnern entfernt', () => {
    const state = withUploaded({}, place(), 'u-anna');
    const off = place({ sharedWithFriends: false });
    expect(planSpotSync([off], ['u-anna'], state)).toEqual({ uploads: [], removals: ['p1'] });
    const gone = place({ deletedAt: '2026-11-02T10:00:00Z' });
    expect(planSpotSync([gone], ['u-anna'], state).removals).toEqual(['p1']);
    expect(planSpotSync([], ['u-anna'], state).removals).toEqual(['p1']);
    expect(planSpotSync([place({ sharedWithFriends: true })], ['u-anna'], state).removals).toEqual([]);
    expect(planSpotSync([off], ['u-anna'], {}).removals).toEqual([]);
  });

  it('ohne Partner wird nichts hochgeladen', () => {
    expect(planSpotSync([place()], [], {}).uploads).toEqual([]);
  });

  it('Merker: entfernen, Partner streichen, kaputt lesen', () => {
    const state = withUploaded(withUploaded({}, place(), 'u-anna'), place(), 'u-bert');
    expect(withoutPlace(state, 'p1')).toEqual({});
    expect(pruneSpotPartners(state, ['u-bert'])['p1']?.to).toEqual(['u-bert']);
    expect(parseSpotSyncState('{kaputt')).toEqual({});
    expect(parseSpotSyncState(null)).toEqual({});
    expect(parseSpotSyncState(JSON.stringify({ p1: { sig: 'x', to: ['a', 1] }, p2: { sig: 5 } }))).toEqual({
      p1: { sig: 'x', to: ['a'] },
    });
  });

  it('ein Ort ohne neuen Partner nach neuer Verbindung geht nur an diesen', () => {
    const a = place();
    const state = withUploaded({}, a, 'u-anna');
    const plan = planSpotSync([a], ['u-anna', 'u-new'], state);
    expect(plan.uploads.map((u) => u.partnerId)).toEqual(['u-new']);
  });
});
