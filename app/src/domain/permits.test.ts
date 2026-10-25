import { describe, expect, it } from 'vitest';
import {
  associationsFor,
  linkHost,
  normalizeUserUrl,
  permitFor,
  WaterPermitListSchema,
  type Association,
  type WaterPermit,
} from './permits';

const permit: WaterPermit = {
  waterId: 'osm:r1',
  waterName: 'Testsee',
  issuer: 'Testverein',
  url: 'https://example.org/see',
  checkedAt: '2026-10-25',
  checkedBy: 'Test',
};
const assoc = (state: Association['state'], name: string): Association => ({
  state,
  name,
  url: `https://example.org/${name}`,
  checkedAt: '2026-10-25',
});

describe('Gewässerkarte (PRM-1)', () => {
  it('normalizeUserUrl: ergänzt https, lehnt Unbrauchbares ab', () => {
    expect(normalizeUserUrl('verein.de/gastkarten')).toBe('https://verein.de/gastkarten');
    expect(normalizeUserUrl('  https://www.verein.de  ')).toBe('https://www.verein.de/');
    expect(normalizeUserUrl('http://verein.de/a?b=1')).toBe('http://verein.de/a?b=1');
    for (const bad of [
      '',
      '   ',
      'kein link',
      'javascript:alert(1)',
      'ftp://verein.de',
      'localhost',
      'https://a:b@verein.de',
    ])
      expect(normalizeUserUrl(bad), bad).toBeUndefined();
  });

  it('linkHost zeigt den Host ohne www', () => {
    expect(linkHost('https://www.anglerverband-hh.de/x')).toBe('anglerverband-hh.de');
    expect(linkHost('kaputt')).toBe('kaputt');
  });

  it('permitFor und associationsFor', () => {
    expect(permitFor([permit], 'osm:r1')).toBe(permit);
    expect(permitFor([permit], 'osm:r2')).toBeUndefined();
    const list = [assoc('NW', 'a'), assoc('NW', 'b'), assoc('BY', 'c')];
    expect(associationsFor(list, 'NW').map((a) => a.name)).toEqual(['a', 'b']);
    expect(associationsFor(list, 'HB')).toEqual([]);
    expect(associationsFor(list, undefined)).toEqual([]);
  });

  it('Schema: nur https, gültige Gewässer-ID, kein Gewässer doppelt', () => {
    expect(WaterPermitListSchema.safeParse([permit]).success).toBe(true);
    expect(WaterPermitListSchema.safeParse([{ ...permit, url: 'http://example.org' }]).success).toBe(false);
    expect(WaterPermitListSchema.safeParse([{ ...permit, waterId: '123' }]).success).toBe(false);
    expect(WaterPermitListSchema.safeParse([permit, permit]).success).toBe(false);
  });
});
