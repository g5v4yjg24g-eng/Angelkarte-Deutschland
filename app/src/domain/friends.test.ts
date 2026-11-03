import { describe, expect, it } from 'vitest';
import { friendErrorKind, groupFriends, parseFriendRows } from './friends';

const row = (o: Record<string, unknown>) => ({
  request_id: 'r',
  user_id: 'u',
  username: 'max',
  display_name: 'Max',
  status: 'accepted',
  direction: 'outgoing',
  badges: [],
  since: '2026-11-04T10:00:00Z',
  ...o,
});

describe('Freunde (FRD-1)', () => {
  it('liest die Server-Antwort, Abzeichen nur bekannte, Kaputtes fällt weg', () => {
    const list = parseFriendRows([
      row({ user_id: 'a', badges: ['founder', 'admin'] }),
      { kaputt: true },
      row({ user_id: 'b', status: 'unbekannt' }),
    ]);
    expect(list).toHaveLength(1);
    expect(list[0]?.badges).toEqual(['founder']);
  });

  it('teilt in Anfragen an mich, eigene Anfragen und Freunde, sortiert nach Name', () => {
    const g = groupFriends(
      parseFriendRows([
        row({ user_id: '1', display_name: 'Zander', status: 'pending', direction: 'incoming' }),
        row({ user_id: '2', display_name: 'aal', status: 'accepted' }),
        row({ user_id: '3', display_name: 'Barsch', status: 'accepted', direction: 'incoming' }),
        row({ user_id: '4', display_name: 'Hecht', status: 'pending', direction: 'outgoing' }),
      ]),
    );
    expect(g.incoming.map((f) => f.displayName)).toEqual(['Zander']);
    expect(g.outgoing.map((f) => f.displayName)).toEqual(['Hecht']);
    expect(g.friends.map((f) => f.displayName)).toEqual(['aal', 'Barsch']);
  });

  it('Fehlerarten', () => {
    expect(friendErrorKind({ message: 'not_found' })).toBe('notFound');
    expect(friendErrorKind({ message: 'self' })).toBe('self');
    expect(friendErrorKind({ message: 'no_profile' })).toBe('noProfile');
    expect(friendErrorKind({ message: 'Failed to fetch' })).toBe('offline');
    expect(friendErrorKind({ message: 'x', status: 401 })).toBe('notSignedIn');
    expect(friendErrorKind(undefined)).toBe('unknown');
  });
});
