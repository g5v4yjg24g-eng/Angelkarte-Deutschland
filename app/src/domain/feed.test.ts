import { describe, expect, it } from 'vitest';
import { FEED_PAGE, hasMore, initialOf, mergeFeed, parseFeedRows, type FeedPost } from './feed';

const row = (o: Record<string, unknown>) => ({
  id: 'p1',
  author_id: 'a',
  username: 'anna',
  display_name: 'Anna',
  badges: ['founder'],
  caption: null,
  visibility: 'friends',
  photo_paths: ['a/p1/1.jpg'],
  created_at: '2026-11-06T10:00:00+00:00',
  ...o,
});
const fp = (id: string, createdAt: string): FeedPost => ({
  id,
  authorId: 'a',
  username: 'a',
  displayName: 'A',
  badges: [],
  visibility: 'friends',
  photoPaths: ['x'],
  createdAt,
  photoUrls: [],
});

describe('Feed (FEED-1)', () => {
  it('liest die Server-Antwort; ohne Foto oder kaputt fällt weg', () => {
    const list = parseFeedRows([row({}), row({ id: 'p2', photo_paths: [] }), { kaputt: 1 }]);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'p1', displayName: 'Anna', badges: ['founder'], caption: undefined });
    expect(list[0]?.sharedAt).toBeUndefined();
  });

  it('Entdecken: Zeitpunkt des Teilens wird gelesen (DISC-1)', () => {
    const [p] = parseFeedRows([row({ visibility: 'public', shared_at: '2026-11-07T08:00:00+00:00' })]);
    expect(p).toMatchObject({ visibility: 'public', sharedAt: '2026-11-07T08:00:00+00:00' });
  });

  it('Seiten zusammenführen ohne Doppelte, neueste zuerst', () => {
    const a = [fp('1', '2026-11-06T10:00:00Z'), fp('2', '2026-11-05T10:00:00Z')];
    const b = [fp('2', '2026-11-05T10:00:00Z'), fp('3', '2026-11-04T10:00:00Z')];
    expect(mergeFeed(a, b).map((p) => p.id)).toEqual(['1', '2', '3']);
  });

  it('mehr laden nur nach voller Seite; Anfangsbuchstabe', () => {
    expect(hasMore(new Array(FEED_PAGE).fill(0))).toBe(true);
    expect(hasMore([1, 2])).toBe(false);
    expect(initialOf(' ärger')).toBe('Ä');
    expect(initialOf('')).toBe('?');
  });
});
