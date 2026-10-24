import { describe, expect, it } from 'vitest';
import { countedPath, validCounterCode } from './usage';

describe('Anonyme Nutzungszählung (USE-1)', () => {
  it('zählt nur Bereiche, nie IDs von Fängen oder Sessions', () => {
    expect(countedPath('/')).toBe('/');
    expect(countedPath('/fangbuch/')).toBe('/fangbuch');
    expect(countedPath('/fangbuch/6f1d3c1e-0a6b-4b51')).toBe('/fangbuch/:id');
    expect(countedPath('/fangbuch/sessions/abc')).toBe('/fangbuch/sessions/:id');
    expect(countedPath('/fangbuch/sessions/abc/rueckblick')).toBe('/fangbuch/sessions/:id/rueckblick');
    expect(countedPath('/mehr/recht/NW')).toBe('/mehr/recht/NW');
    expect(countedPath('/irgendwas/geheim')).toBe('/sonstige');
    expect(countedPath('/Angelkarte-Deutschland/wetter', '/Angelkarte-Deutschland/')).toBe('/wetter');
  });
  it('nur gültige Codes', () => {
    expect(validCounterCode('fangpunkt')).toBe(true);
    expect(validCounterCode(undefined)).toBe(false);
    expect(validCounterCode('')).toBe(false);
    expect(validCounterCode('evil.com/x')).toBe(false);
  });
});
