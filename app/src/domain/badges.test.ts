import { describe, expect, it } from 'vitest';
import { badgesFor, hasBadge, parseBadges, readBadgeCache } from './badges';

describe('Abzeichen (BADGE-1)', () => {
  it('liest nur bekannte Abzeichen vom Server, ohne Doppelte', () => {
    expect(parseBadges([{ badge: 'founder' }, { badge: 'founder' }, { badge: 'admin' }, {}])).toEqual([
      'founder',
    ]);
    expect(parseBadges(null)).toEqual([]);
  });

  it('gespeicherter Stand gilt nur für dieselbe Nutzer-ID', () => {
    const cache = readBadgeCache(JSON.stringify({ userId: 'u-1', badges: ['founder'], checkedAt: 1 }));
    expect(badgesFor(cache, 'u-1')).toEqual(['founder']);
    expect(badgesFor(cache, 'u-2')).toEqual([]);
    expect(badgesFor(cache, undefined)).toEqual([]);
    expect(hasBadge(badgesFor(cache, 'u-1'), 'founder')).toBe(true);
  });

  it('kaputter oder manipulierter Speicher zählt als keine Abzeichen', () => {
    expect(readBadgeCache('{kaputt')).toBeUndefined();
    expect(
      readBadgeCache(JSON.stringify({ userId: 'u-1', badges: ['superadmin'], checkedAt: 1 })),
    ).toBeUndefined();
    expect(readBadgeCache(null)).toBeUndefined();
  });
});
