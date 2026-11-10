import { describe, expect, it } from 'vitest';
import { sessionShareFacts } from './sessionShare';
import type { Review } from './sessionReview';

const review = (o: Partial<Review>): Review => ({
  durationMs: 3_600_000,
  activeMs: 3_000_000,
  segments: 0,
  events: 0,
  counts: { caught: 2, contact: 1, missed_bite: 1, observation: 0 },
  bites: 4,
  speciesCount: 2,
  moments: [],
  ...o,
});

describe('Session-Zusammenfassung (Paket 12, SOC-3)', () => {
  it('nur Zahlen, kein Ort; Strecke erst ab 100 m, auf 0,1 km gerundet', () => {
    const f = sessionShareFacts(review({ distanceM: 2345 }));
    expect(f).toEqual({
      activeMs: 3_000_000,
      caught: 2,
      bites: 4,
      speciesCount: 2,
      longest: undefined,
      distanceKm: 2.3,
    });
    expect(sessionShareFacts(review({ distanceM: 60 })).distanceKm).toBeUndefined();
    expect(JSON.stringify(f)).not.toMatch(/lat|lng|water/i);
  });
  it('größter Fisch mit Art und Hinweis „geschätzt“', () => {
    const item = {
      id: 'c',
      speciesId: 'pike',
      lengthCm: 82,
      waterSnapshot: { name: 'Geheimsee' },
    } as unknown as NonNullable<Review['longest']>['item'];
    const f = sessionShareFacts(review({ longest: { item, estimated: true } }));
    expect(f.longest).toEqual({ speciesId: 'pike', lengthCm: 82, estimated: true });
    expect(JSON.stringify(f)).not.toContain('Geheimsee');
  });
});
