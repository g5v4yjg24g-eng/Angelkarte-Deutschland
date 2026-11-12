import { describe, expect, it } from 'vitest';
import {
  adoptedPlace,
  adoptFields,
  incomingSpots,
  outgoingSpots,
  parseSharedSpotRows,
  shareErrorKind,
  shareInput,
  type SharedSpot,
} from './sharedSpots';
import type { Place } from './schemas';

const row = (o: Record<string, unknown>) => ({
  id: 's1',
  place_id: 'p1',
  direction: 'incoming',
  owner_id: 'anna-id',
  owner_username: 'anna',
  owner_display_name: 'Anna',
  owner_badges: ['founder'],
  recipient_id: null,
  recipient_username: null,
  recipient_display_name: null,
  place_type: 'spot',
  name: 'Buhne 3',
  note: null,
  lat: 51.123456789,
  lng: 6.987654321,
  updated_at: '2026-11-07T10:00:00+00:00',
  ...o,
});

const spot = (o: Partial<SharedSpot>): SharedSpot => ({
  id: 's',
  placeId: 'p',
  direction: 'incoming',
  ownerId: 'o',
  ownerUsername: 'o',
  ownerName: 'O',
  ownerBadges: [],
  type: 'spot',
  lat: 51,
  lng: 7,
  updatedAt: '2026-11-07T10:00:00Z',
  ...o,
});

const place = (o: Partial<Place>): Place => ({
  id: 'x',
  createdAt: '2026-11-07T10:00:00Z',
  updatedAt: '2026-11-07T10:00:00Z',
  rev: 0,
  type: 'spot',
  position: { lat: 51, lng: 7, source: 'map-tap' },
  ...o,
});

describe('Geteilte Spots (SPOT-1)', () => {
  it('liest die Server-Antwort mit genauer Position; kaputte Zeilen fallen weg', () => {
    const list = parseSharedSpotRows([
      row({}),
      row({
        id: 's2',
        direction: 'outgoing',
        recipient_id: 'b',
        recipient_username: 'ben',
        recipient_display_name: 'Ben',
      }),
      row({ id: 's3', place_type: 'boot' }),
      row({ id: 's4', lat: 91 }),
      { kaputt: true },
    ]);
    expect(list.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(list[0]).toMatchObject({
      lat: 51.123456789,
      lng: 6.987654321,
      ownerBadges: ['founder'],
      recipient: undefined,
    });
    expect(list[1]?.recipient).toEqual({ id: 'b', username: 'ben', name: 'Ben' });
    expect(parseSharedSpotRows(null)).toEqual([]);
  });

  it('zeigt denselben Ort nur einmal, auch wenn er persönlich und an alle geteilt ist (neuester Stand)', () => {
    const list = [
      spot({ id: 'a', placeId: 'p', updatedAt: '2026-11-07T09:00:00Z' }),
      spot({
        id: 'b',
        placeId: 'p',
        updatedAt: '2026-11-07T11:00:00Z',
        recipient: { id: 'me', username: 'me', name: 'Ich' },
      }),
      spot({ id: 'c', placeId: 'q', updatedAt: '2026-11-07T10:00:00Z' }),
      spot({ id: 'd', placeId: 'p', ownerId: 'other' }),
      spot({ id: 'e', direction: 'outgoing' }),
    ];
    expect(incomingSpots(list).map((s) => s.id)).toEqual(['b', 'c', 'd']);
    expect(outgoingSpots(list).map((s) => s.id)).toEqual(['e']);
    expect(outgoingSpots(list, 'nix')).toEqual([]);
  });

  it('erkennt übernommene Spots an der genauen Position; gelöschte zählen nicht', () => {
    const s = spot({ lat: 51.5, lng: 7.25 });
    expect(adoptedPlace(s, [place({ position: { lat: 51.5, lng: 7.25, source: 'import' } })])).toBeDefined();
    expect(
      adoptedPlace(s, [place({ position: { lat: 51.5001, lng: 7.25, source: 'import' } })]),
    ).toBeUndefined();
    expect(
      adoptedPlace(s, [
        place({ deletedAt: '2026-11-07T12:00:00Z', position: { lat: 51.5, lng: 7.25, source: 'import' } }),
      ]),
    ).toBeUndefined();
  });

  it('übernimmt Art, Name, Notiz und Position und nennt die Herkunft', () => {
    const f = adoptFields(
      spot({ name: 'Steg', note: 'Nur morgens', ownerName: 'Anna', ownerUsername: 'anna' }),
      (n, u) => `von ${n} (@${u})`,
    );
    expect(f).toEqual({
      type: 'spot',
      name: 'Steg',
      notes: 'Nur morgens\n\nvon Anna (@anna)',
      position: { lat: 51, lng: 7, source: 'import' },
      sharedWithFriends: false,
    });
    expect(adoptFields(spot({ note: 'x'.repeat(2000) }), () => 'Herkunft').notes).toHaveLength(2000);
  });

  it('teilt nur Art, Name, Notiz und Position – keine Fotos, kein Gewässer', () => {
    const p = place({ id: 'p9', name: 'Bucht', notes: 'Hecht', photoIds: ['f1'], waterId: 'w1' });
    expect(shareInput(p)).toEqual({
      placeId: 'p9',
      type: 'spot',
      name: 'Bucht',
      note: 'Hecht',
      lat: 51,
      lng: 7,
    });
    expect(shareInput(p, 'ben')).toMatchObject({ recipientId: 'ben' });
  });

  it('ordnet Server-Fehler zu', () => {
    expect(shareErrorKind(new Error('not_friends'))).toBe('notFriends');
    expect(shareErrorKind(new Error('no_profile'))).toBe('noProfile');
    expect(shareErrorKind({ message: 'x', status: 401 })).toBe('notSignedIn');
    expect(shareErrorKind(new Error('Failed to fetch'))).toBe('offline');
    expect(shareErrorKind(undefined)).toBe('unknown');
  });
});
