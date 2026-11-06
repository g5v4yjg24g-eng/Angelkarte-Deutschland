import { describe, expect, it } from 'vitest';
import {
  bestTier,
  headline,
  mergeUnlocked,
  parseUnlocked,
  progressFrom,
  reachedKeys,
  tierFor,
  TOTAL_STEPS,
  unlockedCount,
} from './achievements';

const NOW = Date.parse('2026-11-06T12:00:00Z');
const OLD = '2026-10-01T10:00:00.000Z';
const FRESH = '2026-11-06T08:00:00.000Z';

type C = Parameters<typeof progressFrom>[0][number];
const c = (o: Partial<C>): C => ({ outcome: 'caught', createdAt: OLD, ...o });

describe('progressFrom', () => {
  it('zählt nur gelandete, nicht gelöschte Fische, die mindestens einen Tag alt sind', () => {
    const p = progressFrom(
      [
        c({}),
        c({ outcome: 'contact' }),
        c({ outcome: 'missed_bite' }),
        c({ deletedAt: OLD }),
        c({ createdAt: FRESH }),
      ],
      [],
      NOW,
    );
    expect(p.values.catches).toBe(1);
    expect(p.first).toBe(true);
  });
  it('Arten nur bei sicher/wahrscheinlich; Gewässer nur bekannte; Sessions nur beendete', () => {
    const p = progressFrom(
      [
        c({ speciesId: 'pike', speciesCertainty: 'certain', waterId: 'w1' }),
        c({ speciesId: 'pike', waterId: 'w1' }),
        c({ speciesId: 'zander', speciesCertainty: 'likely', waterId: 'w2' }),
        c({ speciesId: 'perch', speciesCertainty: 'guess' }),
      ],
      [{ endAt: OLD }, {}, { endAt: OLD, deletedAt: OLD }],
      NOW,
    );
    expect(p.values).toMatchObject({ species: 2, waters: 2, sessions: 1, pike: 2, zander: 1 });
  });
  it('Großfisch nur gemessen', () => {
    const p = progressFrom(
      [c({ lengthCm: 104, lengthMethod: 'estimated' }), c({ lengthCm: 82, lengthMethod: 'measured' })],
      [],
      NOW,
    );
    expect(p.values.big).toBe(82);
    expect(tierFor('big', p.values.big)).toBe('silver');
  });
});

describe('Stufen', () => {
  it('Schwellen je Familie', () => {
    expect(tierFor('catches', 9)).toBeUndefined();
    expect(tierFor('catches', 10)).toBe('bronze');
    expect(tierFor('catches', 50)).toBe('silver');
    expect(tierFor('catches', 250)).toBe('gold');
    expect(tierFor('pike', 1)).toBe('bronze');
    expect(TOTAL_STEPS).toBe(22);
  });
  it('erster Abgleich übernimmt still, danach meldet er nur Neues; nichts wird entfernt (Variante A)', () => {
    const many = progressFrom(
      Array.from({ length: 12 }, () => c({})),
      [],
      NOW,
    );
    const first = mergeUnlocked(undefined, many, 'T1');
    expect(first.fresh).toEqual([]);
    expect(first.next).toEqual({ first: 'T1', 'catches:bronze': 'T1' });

    const more = progressFrom(
      Array.from({ length: 50 }, () => c({})),
      [],
      NOW,
    );
    const second = mergeUnlocked(first.next, more, 'T2');
    expect(second.fresh).toEqual(['catches:silver']);
    expect(second.next['catches:bronze']).toBe('T1');

    // alles gelöscht: Stufen bleiben
    const none = progressFrom([], [], NOW);
    const third = mergeUnlocked(second.next, none, 'T3');
    expect(third.fresh).toEqual([]);
    expect(third.next).toEqual(second.next);
    expect(bestTier(third.next, 'catches')).toBe('silver');
    expect(unlockedCount(third.next)).toBe(3);
  });
  it('reachedKeys und headline: höchste neue Stufe zuerst', () => {
    const p = progressFrom(
      Array.from({ length: 100 }, () => c({})),
      [],
      NOW,
    );
    expect(reachedKeys(p)).toEqual(['first', 'catches:bronze', 'catches:silver', 'catches:gold']);
    expect(headline(['first', 'catches:bronze', 'catches:gold'])).toEqual({
      family: 'catches',
      tier: 'gold',
    });
    expect(headline(['first'])).toEqual({ family: 'first' });
    expect(headline([])).toBeUndefined();
  });
  it('gespeicherter Stand: Unbekanntes und Kaputtes fällt weg', () => {
    expect(parseUnlocked(null)).toBeUndefined();
    expect(parseUnlocked([])).toBeUndefined();
    expect(
      parseUnlocked({ first: OLD, 'catches:gold': 'kein Datum', 'x:gold': OLD, 'pike:bronze': OLD }),
    ).toEqual({
      first: OLD,
      'pike:bronze': OLD,
    });
  });
});
