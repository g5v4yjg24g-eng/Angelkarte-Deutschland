import { describe, expect, it } from 'vitest';
import { followErrorKind, groupFollows, parseFollowCounts, parseFollowRows } from './follows';

const row = (u: string, direction: string, status: string) => ({
  user_id: `id-${u}`,
  username: u,
  display_name: u.toUpperCase(),
  badges: u === 'anna' ? ['founder'] : [],
  direction,
  status,
  since: '2026-11-10T10:00:00+00:00',
});

describe('follows', () => {
  it('liest Zeilen und verwirft kaputte', () => {
    const list = parseFollowRows([row('anna', 'follower', 'accepted'), { user_id: 1 }, null]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ userId: 'id-anna', direction: 'follower', badges: ['founder'] });
  });

  it('gruppiert Anfragen, Follower, Gefolgte, Angefragte und Gegenseitige', () => {
    const g = groupFollows(
      parseFollowRows([
        row('bert', 'follower', 'accepted'),
        row('anna', 'follower', 'accepted'),
        row('anna', 'following', 'accepted'),
        row('carl', 'follower', 'pending'),
        row('dora', 'following', 'pending'),
        row('eva', 'following', 'accepted'),
      ]),
    );
    expect(g.followers.map((f) => f.username)).toEqual(['anna', 'bert']);
    expect(g.following.map((f) => f.username)).toEqual(['anna', 'eva']);
    expect(g.requests.map((f) => f.username)).toEqual(['carl']);
    expect(g.requested.map((f) => f.username)).toEqual(['dora']);
    expect([...g.mutual]).toEqual(['id-anna']);
  });

  it('Zahlen mit Rückfall auf 0', () => {
    expect(parseFollowCounts([{ followers: 3, following: 2, requests: 1 }])).toEqual({
      followers: 3,
      following: 2,
      requests: 1,
    });
    expect(parseFollowCounts(null)).toEqual({ followers: 0, following: 0, requests: 0 });
  });

  it('Fehlerarten', () => {
    expect(followErrorKind({ message: 'too_many_follows' })).toBe('tooMany');
    expect(followErrorKind({ message: 'not_found' })).toBe('notFound');
    expect(followErrorKind({ message: 'Failed to fetch' })).toBe('offline');
    expect(followErrorKind(undefined)).toBe('unknown');
  });
});
