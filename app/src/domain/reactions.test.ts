import { describe, expect, it } from 'vitest';
import {
  NO_REACTIONS,
  parseCommentRows,
  parseReactionRows,
  reactionErrorKind,
  toggledReactions,
} from './reactions';

describe('Gefällt mir und Kommentare vom Server (REACT-1)', () => {
  it('liest die Zahlen je Beitrag; kaputte Zeilen fallen weg', () => {
    const m = parseReactionRows([
      { post_id: 'p1', like_count: 3, liked: true, comment_count: 2 },
      { post_id: 'p2', like_count: -1, liked: false, comment_count: 0 },
      { kaputt: 1 },
    ]);
    expect([...m.keys()]).toEqual(['p1']);
    expect(m.get('p1')).toEqual({ likeCount: 3, liked: true, commentCount: 2 });
    expect(parseReactionRows(null).size).toBe(0);
  });

  it('liest Kommentare mit Name und Abzeichen, älteste zuerst; leere fallen weg', () => {
    const row = (o: Record<string, unknown>) => ({
      id: 'c1',
      author_id: 'u1',
      username: 'anna',
      display_name: 'Anna',
      badges: ['founder'],
      body: 'Petri!',
      created_at: '2026-11-04T10:00:00Z',
      can_delete: false,
      ...o,
    });
    const list = parseCommentRows([
      row({ id: 'c2', created_at: '2026-11-04T11:00:00Z', badges: null, can_delete: true }),
      row({}),
      row({ id: 'c3', body: '' }),
    ]);
    expect(list.map((c) => c.id)).toEqual(['c1', 'c2']);
    expect(list[0]).toMatchObject({
      displayName: 'Anna',
      badges: ['founder'],
      text: 'Petri!',
      canDelete: false,
    });
    expect(list[1]).toMatchObject({ badges: [], canDelete: true });
  });

  it('schaltet den Daumen sofort um, die Zahl geht nie unter 0', () => {
    expect(toggledReactions(NO_REACTIONS)).toEqual({ likeCount: 1, liked: true, commentCount: 0 });
    expect(toggledReactions({ likeCount: 1, liked: true, commentCount: 4 })).toEqual({
      likeCount: 0,
      liked: false,
      commentCount: 4,
    });
    expect(toggledReactions({ likeCount: 0, liked: true, commentCount: 0 }).likeCount).toBe(0);
  });

  it('ordnet Server-Fehler zu', () => {
    expect(reactionErrorKind(new Error('not_found'))).toBe('notFound');
    expect(reactionErrorKind(new Error('too_many'))).toBe('tooMany');
    expect(reactionErrorKind({ message: '', status: 401 })).toBe('notSignedIn');
    expect(reactionErrorKind(new Error('Failed to fetch'))).toBe('offline');
    expect(reactionErrorKind(undefined)).toBe('unknown');
  });
});
