import { describe, expect, it } from 'vitest';
import {
  groupTotals,
  leaders,
  parseGroupStats,
  statsFromReview,
  statsPayload,
  type GroupStatsEntry,
} from './groupStats';
import type { Review } from './sessionReview';

const entry = (userId: string, o: Partial<GroupStatsEntry> = {}): GroupStatsEntry => ({
  userId,
  caught: 0,
  bites: 0,
  entries: 0,
  activeMs: 0,
  ...o,
});

describe('groupStats', () => {
  it('liest Serverzeilen und lässt kaputte weg', () => {
    const rows = parseGroupStats([
      {
        user_id: 'a',
        caught: 2,
        bites: 5,
        entries: 6,
        longest_cm: 62.5,
        longest_species: 'pike',
        active_ms: 9,
        distance_m: 7400,
      },
      {
        user_id: 'b',
        caught: 0,
        bites: 0,
        entries: 0,
        longest_cm: null,
        longest_species: null,
        active_ms: 0,
        distance_m: null,
      },
      { user_id: 'c', caught: -1, bites: 0, entries: 0, active_ms: 0 },
      'kaputt',
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ userId: 'a', longestCm: 62.5, distanceM: 7400 });
    expect(rows[1]?.longestCm).toBeUndefined();
    expect(parseGroupStats(null)).toEqual([]);
  });

  it('übernimmt aus dem Rückblick nur gespeicherte Werte (kein Fisch ohne Länge)', () => {
    const review = {
      counts: { caught: 2, contact: 1, missed_bite: 0, observation: 1 },
      bites: 3,
      events: 4,
      activeMs: 3_600_000.4,
      distanceM: 1234.6,
      longest: { item: { speciesId: 'pike', lengthCm: 62 }, estimated: false },
    } as unknown as Review;
    expect(statsFromReview(review)).toEqual({
      caught: 2,
      bites: 3,
      entries: 4,
      longestCm: 62,
      longestSpecies: 'pike',
      activeMs: 3_600_000,
      distanceM: 1235,
    });
    const none = {
      ...review,
      longest: { item: { speciesId: 'pike' }, estimated: true },
      distanceM: undefined,
    } as unknown as Review;
    const s = statsFromReview(none);
    expect(s.longestCm).toBeUndefined();
    expect(s.longestSpecies).toBeUndefined();
    expect(statsPayload(s).distance_m).toBeNull();
  });

  it('nennt nur einen Gewinner, wenn es einen eindeutigen gibt', () => {
    const a = entry('a', { caught: 3, bites: 7, longestCm: 62, activeMs: 100 });
    const b = entry('b', { caught: 1, bites: 7, longestCm: 48, activeMs: 100 });
    expect(leaders([a, b])).toEqual({ longest: 'a', caught: 'a', bites: undefined, time: undefined });
    expect(leaders([entry('a'), entry('b')])).toEqual({
      longest: undefined,
      caught: undefined,
      bites: undefined,
      time: undefined,
    });
    expect(leaders([a]).caught).toBe('a');
  });

  it('summiert Einträge und Strecken; ohne Strecke bleibt sie leer', () => {
    expect(groupTotals([entry('a', { entries: 3, distanceM: 1000 }), entry('b', { entries: 2 })])).toEqual({
      entries: 5,
      distanceM: 1000,
    });
    expect(groupTotals([entry('a', { entries: 1 })]).distanceM).toBeUndefined();
  });
});
