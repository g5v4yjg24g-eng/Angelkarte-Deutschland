import { describe, expect, it } from 'vitest';
import { extrasKey, extrasPayload, parseUserHits, parseUserProfile, searchTerm } from './userProfile';

describe('Profile anderer und Suche (Paket 12/C, SOC-1)', () => {
  it('parseUserProfile: prüft Zeilen, verwirft Unbekanntes, ohne Zeile null', () => {
    expect(parseUserProfile([])).toBeNull();
    expect(parseUserProfile([{ username: 'x' }])).toBeNull();
    const p = parseUserProfile([
      {
        user_id: 'u-a',
        username: 'anna',
        display_name: 'Anna',
        badges: ['founder', 'quatsch'],
        relation: 'following',
        follows_me: true,
        is_private: false,
        follower_count: 3,
        following_count: 2,
        bio: '',
        target_species: ['pike', 'BAD', 'zander'],
        methods: ['spinning', 'dynamit'],
        region: 'XX',
        highlight_post_ids: ['p1', 2],
      },
    ]);
    expect(p).toEqual({
      userId: 'u-a',
      username: 'anna',
      displayName: 'Anna',
      badges: ['founder'],
      relation: 'following',
      followsMe: true,
      isPrivate: false,
      followerCount: 3,
      followingCount: 2,
      bio: undefined,
      targetSpecies: ['pike', 'zander'],
      methods: ['spinning'],
      region: undefined,
      highlightPostIds: ['p1'],
    });
    // Fremde: Server liefert keine Angaben
    expect(
      parseUserProfile([{ user_id: 'u', username: 'b', display_name: 'B', relation: 'none', region: null }]),
    ).toMatchObject({
      relation: 'none',
      targetSpecies: [],
      methods: [],
      highlightPostIds: [],
      followsMe: false,
      // fehlt die Angabe, gilt das Konto als privat (Standard)
      isPrivate: true,
      followerCount: 0,
      followingCount: 0,
    });
    // alte Beziehungen (vor Paket C) gelten nicht mehr
    expect(
      parseUserProfile([{ user_id: 'u', username: 'b', display_name: 'B', relation: 'friend' }]),
    ).toBeNull();
  });

  it('parseUserHits und searchTerm', () => {
    expect(
      parseUserHits([
        { user_id: 'u', username: 'anna', display_name: 'Anna', relation: 'requested', follows_me: true },
        { user_id: 'v', username: 'x', display_name: 'X', relation: 'boss' },
      ]),
    ).toEqual([
      {
        userId: 'u',
        username: 'anna',
        displayName: 'Anna',
        badges: [],
        relation: 'requested',
        followsMe: true,
      },
    ]);
    expect(searchTerm('  An ')).toBeUndefined();
    expect(searchTerm(' ANN ')).toBe('ann');
    expect(searchTerm('x'.repeat(41))).toBeUndefined();
  });

  it('extrasPayload: nur geteilte, nicht gelöschte Beiträge als Highlights; leere Angaben', () => {
    const posts = [
      { id: 'a', share: 'shared' as const },
      { id: 'b' },
      { id: 'c', share: 'shared' as const, deletedAt: '2026-11-10T00:00:00Z' },
      { id: 'd', share: 'pending' as const },
    ];
    const p = extrasPayload(
      {
        bio: '  Hallo ',
        targetSpecies: ['pike'],
        methods: ['jigging'],
        region: 'NW',
        highlightPostIds: ['b', 'a', 'c', 'd'],
      },
      posts,
    );
    expect(p).toEqual({
      bio: 'Hallo',
      targetSpecies: ['pike'],
      methods: ['jigging'],
      region: 'NW',
      highlightPostIds: ['a'],
    });
    expect(extrasPayload({}, [])).toEqual({
      bio: null,
      targetSpecies: [],
      methods: [],
      region: null,
      highlightPostIds: [],
    });
    expect(extrasKey('u1', p)).not.toBe(extrasKey('u2', p));
  });
});
