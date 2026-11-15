import { describe, expect, it } from 'vitest';
import {
  clampStep,
  GROUPS,
  GUIDE_IDS,
  isLastStep,
  shouldMarkSilently,
  shouldOfferWelcome,
  TOUR,
} from './guide';

describe('Anleitung', () => {
  it('jedes Thema steht in genau einer Gruppe', () => {
    const all = GROUPS.flatMap((g) => g.topics);
    expect([...all].sort()).toEqual([...GUIDE_IDS].sort());
  });
  it('die Tour enthält nur bekannte Themen ohne Doppelte', () => {
    expect(new Set(TOUR).size).toBe(TOUR.length);
    for (const t of TOUR) expect(GUIDE_IDS).toContain(t);
    expect(TOUR).toHaveLength(7);
  });
  it('Willkommensblatt nur bei neuer Installation', () => {
    expect(shouldOfferWelcome(undefined, false)).toBe(true);
    expect(shouldOfferWelcome(undefined, true)).toBe(false);
    expect(shouldOfferWelcome(1, false)).toBe(false);
  });
  it('Bestandsnutzer ohne Stand werden still markiert', () => {
    expect(shouldMarkSilently(undefined, true)).toBe(true);
    expect(shouldMarkSilently(undefined, false)).toBe(false);
    expect(shouldMarkSilently(1, true)).toBe(false);
  });
  it('Schritte bleiben im Bereich', () => {
    expect(clampStep(-1, 7)).toBe(0);
    expect(clampStep(9, 7)).toBe(6);
    expect(isLastStep(6, 7)).toBe(true);
    expect(isLastStep(5, 7)).toBe(false);
  });
});
