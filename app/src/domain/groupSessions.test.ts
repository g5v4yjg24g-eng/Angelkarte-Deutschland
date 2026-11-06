import { describe, expect, it } from 'vitest';
import type { FriendEntry } from './friends';
import {
  freeSlots,
  groupErrorKey,
  groupLabel,
  invitableFriends,
  openInvites,
  parseGroupMembers,
  parseGroupSessions,
  type GroupMember,
} from './groupSessions';

const friend = (
  userId: string,
  displayName: string,
  status: 'accepted' | 'pending' = 'accepted',
): FriendEntry => ({
  requestId: `r-${userId}`,
  userId,
  username: displayName.toLowerCase(),
  displayName,
  status,
  direction: 'outgoing',
  badges: [],
  since: '2026-11-01T00:00:00Z',
});
const member = (userId: string, status: GroupMember['status'], isHost = false): GroupMember => ({
  userId,
  username: userId,
  displayName: userId,
  status,
  isHost,
});

describe('Gemeinsame Sessions (GRP-1)', () => {
  it('liest die Server-Antworten; kaputte Zeilen fallen weg', () => {
    const list = parseGroupSessions([
      {
        id: 'g1',
        host_id: 'h',
        host_username: 'hans',
        host_display_name: 'Hans',
        title: null,
        water_name: 'Baldeneysee',
        started_at: '2026-11-06T16:00:00Z',
        ended_at: null,
        my_status: 'invited',
        joined_count: 1,
      },
      { id: 'kaputt' },
    ]);
    expect(list).toEqual([
      expect.objectContaining({
        id: 'g1',
        hostDisplayName: 'Hans',
        title: undefined,
        waterName: 'Baldeneysee',
      }),
    ]);
    expect(list[0] && groupLabel(list[0])).toBe('Baldeneysee');
    expect(
      parseGroupMembers([
        { user_id: 'h', username: 'hans', display_name: 'Hans', status: 'joined', is_host: true },
        { user_id: 'x', status: 'unbekannt' },
      ]),
    ).toEqual([{ userId: 'h', username: 'hans', displayName: 'Hans', status: 'joined', isHost: true }]);
  });

  it('offene Einladungen: nur eingeladen und nicht beendet', () => {
    const base = parseGroupSessions([
      {
        id: 'a',
        host_id: 'h',
        host_username: 'h1',
        host_display_name: 'H',
        started_at: '2026-11-06T16:00:00Z',
        my_status: 'invited',
        joined_count: 1,
      },
      {
        id: 'b',
        host_id: 'h',
        host_username: 'h1',
        host_display_name: 'H',
        started_at: '2026-11-06T16:00:00Z',
        ended_at: '2026-11-06T18:00:00Z',
        my_status: 'invited',
        joined_count: 1,
      },
      {
        id: 'c',
        host_id: 'h',
        host_username: 'h1',
        host_display_name: 'H',
        started_at: '2026-11-06T16:00:00Z',
        my_status: 'joined',
        joined_count: 2,
      },
    ]);
    expect(openInvites(base).map((g) => g.id)).toEqual(['a']);
  });

  it('höchstens 10 Personen: freie Plätze zählen Gastgeber, Eingeladene und Teilnehmer', () => {
    expect(freeSlots([])).toBe(9); // noch keine gemeinsame Session: nur man selbst
    expect(freeSlots([member('h', 'joined', true), member('a', 'invited'), member('b', 'declined')])).toBe(8);
    const full = [
      member('h', 'joined', true),
      ...Array.from({ length: 9 }, (_, i) => member(`m${i}`, 'joined')),
    ];
    expect(freeSlots(full)).toBe(0);
  });

  it('einladbar: nur angenommene Freunde, nicht schon dabei/eingeladen/abgelehnt; Gegangene wieder', () => {
    const friends = [
      friend('a', 'Zora'),
      friend('b', 'Anna'),
      friend('c', 'Carl'),
      friend('d', 'Dora', 'pending'),
    ];
    const members = [member('h', 'joined', true), member('a', 'declined'), member('c', 'left')];
    expect(invitableFriends(friends, members).map((f) => f.userId)).toEqual(['b', 'c']);
  });

  it('Fehler des Servers werden verständlich zugeordnet', () => {
    expect(groupErrorKey(new Error('too_many_members'))).toBe('tooManyMembers');
    expect(groupErrorKey(new Error('too_many'))).toBe('tooMany');
    expect(groupErrorKey(new Error('not_found'))).toBe('notFound');
    expect(groupErrorKey(new Error('ended'))).toBe('ended');
    expect(groupErrorKey(new Error('Failed to fetch'))).toBe('unknown');
  });
});
