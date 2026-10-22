import { describe, expect, it } from 'vitest';
import { regulationFixture as fx } from '../test/fixtures/regulations';
import {
  berlinDay,
  closedSeasonsOn,
  freshness,
  inClosedSeason,
  isShown,
  RegulationSetSchema,
} from './regulations';

const one = <T>(list: readonly T[]): T => {
  const [x] = list;
  if (x === undefined) throw new Error('leer');
  return x;
};
const issues = (data: unknown) => {
  const r = RegulationSetSchema.safeParse(data);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
};

describe('RegulationSetSchema (LAW-1)', () => {
  it('nimmt die Testdaten an', () => expect(issues(fx)).toEqual([]));

  it('lehnt Regel ohne Paragraf ab', () => {
    const rule: Record<string, unknown> = { ...one(fx.minSizes) };
    delete rule.basisRef;
    expect(issues({ ...fx, minSizes: [rule] }).join()).toContain('minSizes.0.basisRef');
    expect(issues({ ...fx, minSizes: [{ ...rule, basisRef: '  ' }] }).join()).toContain(
      'minSizes.0.basisRef',
    );
  });

  it('lehnt Regel mit unbekannter Rechtsgrundlage ab', () => {
    const bad = { ...fx, otherRules: [{ ...one(fx.otherRules), basisId: 'XYZ' }] };
    expect(issues(bad).join()).toContain('unbekannte Rechtsgrundlage');
  });

  it('verlangt eine Quelle und eine https-Adresse', () => {
    expect(issues({ ...fx, legalBasis: [] }).join()).toContain('legalBasis');
    const http = [{ ...one(fx.legalBasis), url: 'http://example.org' }];
    expect(issues({ ...fx, legalBasis: http }).join()).toContain('legalBasis.0.url');
  });

  it('prüft Status, Arten und Kalendertage', () => {
    expect(issues({ ...fx, missing: [] }).join()).toContain('missing');
    expect(issues({ ...fx, status: 'verified' }).join()).toContain('missing');
    const unknownSpecies = [{ ...one(fx.minSizes), speciesId: 'dragon' }];
    expect(issues({ ...fx, minSizes: unknownSpecies }).join()).toContain('Art fehlt');
    const feb30 = [{ ...one(fx.closedSeasons), to: { month: 2, day: 30 } }];
    expect(issues({ ...fx, closedSeasons: feb30 }).join()).toContain('closedSeasons.0.to');
  });

  it('prüft Entnahmefenster', () => {
    const base = one(fx.minSizes);
    expect(issues({ ...fx, minSizes: [{ ...base, minCm: 50, maxCm: 40 }] }).join()).toContain('kleiner');
    expect(issues({ ...fx, minSizes: [{ ...base, minCm: undefined }] }).join()).toContain(
      'Maß oder Fangmenge',
    );
    expect(issues({ ...fx, minSizes: [{ ...base, minCm: 45, maxCm: 75, dailyLimit: 2 }] })).toEqual([]);
  });

  it('zeigt Entwürfe nie', () => {
    expect(isShown(fx)).toBe(true);
    expect(isShown({ ...fx, status: 'draft' })).toBe(false);
  });
});

describe('Schonzeit (LAW-3)', () => {
  const wrap = { from: { month: 10, day: 1 }, to: { month: 3, day: 1 } };
  it('über den Jahreswechsel', () => {
    expect(inClosedSeason(wrap, { month: 1, day: 15 })).toBe(true);
    expect(inClosedSeason(wrap, { month: 10, day: 1 })).toBe(true);
    expect(inClosedSeason(wrap, { month: 3, day: 1 })).toBe(true);
    expect(inClosedSeason(wrap, { month: 3, day: 2 })).toBe(false);
    expect(inClosedSeason(wrap, { month: 9, day: 30 })).toBe(false);
  });
  it('innerhalb eines Jahres', () => {
    const r = { from: { month: 2, day: 15 }, to: { month: 4, day: 30 } };
    expect(inClosedSeason(r, { month: 2, day: 14 })).toBe(false);
    expect(inClosedSeason(r, { month: 4, day: 30 })).toBe(true);
    expect(inClosedSeason(r, { month: 5, day: 1 })).toBe(false);
  });
  it('findet die Regeln einer Art an einem Tag', () => {
    expect(closedSeasonsOn(fx, 'brown_trout', { month: 1, day: 15 }).map((r) => r.basisRef)).toEqual([
      '§ 1 Abs. 2',
    ]);
    expect(closedSeasonsOn(fx, 'pike', { month: 1, day: 15 })).toEqual([]);
  });
  it('Kalendertag in deutscher Zeit', () => {
    // 31.12. 23:30 UTC ist in Berlin schon der 1.1.
    expect(berlinDay(Date.parse('2026-12-31T23:30:00Z'))).toEqual({ month: 1, day: 1 });
  });
});

describe('Prüfstand (LAW-2)', () => {
  const at = (d: string) => Date.parse(`${d}T12:00:00Z`);
  it('aktuell, möglicherweise veraltet, veraltet', () => {
    expect(freshness('2026-01-01', at('2026-06-29'))).toBe('current'); // 179 Tage
    expect(freshness('2026-01-01', at('2026-07-01'))).toBe('stale'); // 181 Tage
    expect(freshness('2026-01-01', at('2027-01-02'))).toBe('outdated');
  });
});
