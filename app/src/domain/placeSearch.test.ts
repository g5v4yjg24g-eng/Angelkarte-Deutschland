import { describe, expect, it } from 'vitest';
import {
  MAX_HITS,
  MAX_RECENT,
  addRecent,
  hitLabel,
  isSearchedKey,
  normalizeQuery,
  parseGeocoding,
  parseRecents,
  searchedKey,
} from './placeSearch';

const koeln = {
  id: 2886242,
  name: 'Köln',
  latitude: 50.93333,
  longitude: 6.95,
  country_code: 'DE',
  admin1: 'Nordrhein-Westfalen',
  admin2: 'Regierungsbezirk Köln',
};

describe('normalizeQuery', () => {
  it('kürzt Leerraum, verlangt 2 Zeichen und begrenzt die Länge', () => {
    expect(normalizeQuery('  Bad   Salzuflen ')).toBe('Bad Salzuflen');
    expect(normalizeQuery(' K ')).toBeUndefined();
    expect(normalizeQuery('')).toBeUndefined();
    expect(normalizeQuery('x'.repeat(200))).toHaveLength(80);
  });
});

describe('parseGeocoding (GEO-1)', () => {
  it('nimmt Treffer in Deutschland mit Bundesland, Regierungsbezirk bleibt weg', () => {
    expect(parseGeocoding({ results: [koeln] })).toEqual([
      { id: '2886242', name: 'Köln', lat: 50.93333, lng: 6.95, region: 'Nordrhein-Westfalen' },
    ]);
  });
  it('zeigt bei gleichnamigen Orten den Landkreis', () => {
    const [h] = parseGeocoding({
      results: [
        { ...koeln, id: 7, name: 'Neustadt', admin2: 'Landkreis Marburg-Biedenkopf', admin1: 'Hessen' },
      ],
    });
    expect(hitLabel(h as never)).toBe('Neustadt (Landkreis Marburg-Biedenkopf, Hessen)');
  });
  it('überspringt Orte außerhalb Deutschlands und Unbrauchbares', () => {
    const out = parseGeocoding({
      results: [
        { ...koeln, country_code: 'IN', id: 1 },
        { ...koeln, id: 2, latitude: 'x' },
        { ...koeln, id: 3, latitude: 120 },
        { ...koeln, id: 4, name: '' },
        { ...koeln, id: null },
        null,
        { ...koeln, id: 5 },
      ],
    });
    expect(out.map((h) => h.id)).toEqual(['5']);
  });
  it('ohne Treffer oder mit fremder Antwort: leere Liste; höchstens 8', () => {
    expect(parseGeocoding({})).toEqual([]);
    expect(parseGeocoding(null)).toEqual([]);
    expect(parseGeocoding('x')).toEqual([]);
    const many = Array.from({ length: 20 }, (_, i) => ({ ...koeln, id: 100 + i }));
    expect(parseGeocoding({ results: many })).toHaveLength(MAX_HITS);
  });
});

describe('zuletzt gesuchte Orte', () => {
  const hit = (i: number) => ({ id: String(i), name: `Ort ${i}`, lat: 50, lng: 7 });
  it('neuester vorn, ohne Doppelte, höchstens 5', () => {
    let l = [hit(1), hit(2)];
    l = addRecent(l, hit(2));
    expect(l.map((h) => h.id)).toEqual(['2', '1']);
    for (let i = 3; i < 12; i++) l = addRecent(l, hit(i));
    expect(l).toHaveLength(MAX_RECENT);
    expect(l[0]?.id).toBe('11');
  });
  it('liest Gespeichertes und verwirft Kaputtes', () => {
    expect(parseRecents([hit(1), { id: 3 }, null, { ...hit(2), region: 'Hessen' }])).toEqual([
      hit(1),
      { ...hit(2), region: 'Hessen' },
    ]);
    expect(parseRecents('kaputt')).toEqual([]);
  });
  it('Auswahlwert', () => {
    expect(searchedKey('42')).toBe('s:42');
    expect(isSearchedKey('s:42')).toBe(true);
    expect(isSearchedKey('me')).toBe(false);
  });
});
