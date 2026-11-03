// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import type { SharedSpot } from '../domain/sharedSpots';
import { adoptSharedSpot } from './sharedSpotService';

const spot: SharedSpot = {
  id: 's1',
  placeId: 'p1',
  direction: 'incoming',
  ownerId: 'a',
  ownerUsername: 'anna',
  ownerName: 'Anna',
  ownerBadges: [],
  type: 'jetty',
  name: 'Steg am Hafen',
  lat: 51.123456789,
  lng: 6.987654321,
  updatedAt: '2026-11-07T10:00:00Z',
};

describe('Geteilten Spot übernehmen (SPOT-2)', () => {
  it('legt einen eigenen Ort mit genauer Position an – zweimal übernehmen ergibt keinen zweiten', async () => {
    const db = await freshDb();
    const label = (n: string, u: string) => `Geteilt von ${n} (@${u})`;
    const p = await adoptSharedSpot(spot, label, db);
    expect(p).toMatchObject({
      type: 'jetty',
      name: 'Steg am Hafen',
      notes: 'Geteilt von Anna (@anna)',
      position: { lat: 51.123456789, lng: 6.987654321, source: 'import' },
    });
    const again = await adoptSharedSpot(spot, label, db);
    expect(again.id).toBe(p.id);
    expect(await db.places.count()).toBe(1);
  });
});
