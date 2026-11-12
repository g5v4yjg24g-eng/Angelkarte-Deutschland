import { describe, expect, it } from 'vitest';
import type { SearchEntry } from './search';
import { distanceKm, formatDistance, kindSummary, nearbyWaters, toggleKind } from './nearby';

const here = { lat: 51.3, lng: 6.25 };
// [Name, Art, lat, lng, Kontext, Rang, wid]
const E: SearchEntry[] = [
  ['Windmühlenbruch', 'lake', 51.31, 6.26, 'Nettetal', 85, 'osm:w1'],
  ['De Wittsee', 'lake', 51.325, 6.24, 'Nettetal', 141, 'osm:w2'],
  ['Nette', 'river', 51.29, 6.27, 'Kreis Viersen', 207, 'osm:r3'],
  ['Pastors Weiher', 'pond', 51.35, 6.3, 'Brüggen', 6, 'osm:w4'],
  ['Pastors Weiher', 'pond', 51.352, 6.302, 'Brüggen', 9, 'osm:w5'],
  ['Fernsee', 'lake', 52.5, 8.0, 'Weit weg', 300, 'osm:w6'],
  ['Hellbach', 'stream', 51.305, 6.255, 'Kreis Viersen', 12, 'osm:w7'],
  ['Nettetal', 'place:town', 51.3, 6.25, 'Kreis Viersen', 0, ''],
  ['Unbenannt', 'other', 51.301, 6.251, 'Nettetal', 1, ''],
];

describe('distanceKm', () => {
  it('rechnet Luftlinie', () => {
    expect(distanceKm(here, here)).toBe(0);
    expect(distanceKm({ lat: 51, lng: 6 }, { lat: 52, lng: 6 })).toBeCloseTo(111.2, 0);
  });
});

describe('formatDistance', () => {
  it('Kilometer mit Komma, nah als „unter 100 m“', () => {
    expect(formatDistance(1.34)).toBe('1,3 km');
    expect(formatDistance(12)).toBe('12,0 km');
    expect(formatDistance(0.05)).toBe('unter 100 m');
  });
});

describe('nearbyWaters', () => {
  it('ohne Art zeigt alle Gewässer im Umkreis, ohne Orte, nach Entfernung', () => {
    const r = nearbyWaters(E, { origin: here, radiusKm: 10, kinds: [], sort: 'distance' });
    expect(r.map((x) => x.name)).toEqual([
      'Unbenannt',
      'Hellbach',
      'Windmühlenbruch',
      'Nette',
      'De Wittsee',
      'Pastors Weiher',
    ]);
    expect(r.every((x) => !x.isPlace)).toBe(true);
    expect(r.find((x) => x.name === 'Fernsee')).toBeUndefined();
  });
  it('mit gewählten Arten nur diese (Mehrfachauswahl)', () => {
    const only = nearbyWaters(E, { origin: here, radiusKm: 10, kinds: ['lake'], sort: 'distance' });
    expect(only.map((x) => x.name)).toEqual(['Windmühlenbruch', 'De Wittsee']);
    const two = nearbyWaters(E, { origin: here, radiusKm: 10, kinds: ['lake', 'river'], sort: 'distance' });
    expect(two.map((x) => x.name).sort()).toEqual(['De Wittsee', 'Nette', 'Windmühlenbruch']);
  });
  it('Umkreis begrenzt', () => {
    const near = nearbyWaters(E, { origin: here, radiusKm: 2, kinds: [], sort: 'distance' });
    expect(near.map((x) => x.name)).toEqual(['Unbenannt', 'Hellbach', 'Windmühlenbruch', 'Nette']);
  });
  it('gleiche Abschnitte (Name, Art, Kontext) werden zusammengefasst, der nächste zählt', () => {
    const r = nearbyWaters(E, { origin: here, radiusKm: 10, kinds: ['pond'], sort: 'distance' });
    expect(r).toHaveLength(1);
    expect(r[0]?.wid).toBe('osm:w4');
  });
  it('Namensteil wirkt wie bei der Suche', () => {
    const r = nearbyWaters(E, { origin: here, radiusKm: 50, kinds: [], name: 'de witt', sort: 'distance' });
    expect(r.map((x) => x.name)).toEqual(['De Wittsee']);
  });
  it('ohne Mittelpunkt gibt es keine Entfernung und keinen Umkreis', () => {
    const r = nearbyWaters(E, { kinds: ['lake'], sort: 'name' });
    expect(r.map((x) => x.name)).toEqual(['De Wittsee', 'Fernsee', 'Windmühlenbruch']);
    expect(r[0]?.distanceKm).toBeUndefined();
    expect(nearbyWaters(E, { kinds: [], name: 'fern', sort: 'name' }).map((x) => x.name)).toEqual([
      'Fernsee',
    ]);
  });
  it('sortiert nach Name und Größe', () => {
    const n = nearbyWaters(E, { origin: here, radiusKm: 10, kinds: ['lake', 'river'], sort: 'name' });
    expect(n.map((x) => x.name)).toEqual(['De Wittsee', 'Nette', 'Windmühlenbruch']);
    const s = nearbyWaters(E, { origin: here, radiusKm: 10, kinds: ['lake', 'river'], sort: 'size' });
    expect(s.map((x) => x.name)).toEqual(['Nette', 'De Wittsee', 'Windmühlenbruch']);
  });
});

describe('toggleKind / kindSummary', () => {
  it('schaltet an und aus, Reihenfolge bleibt wie im Dropdown', () => {
    let s: string[] = [];
    s = toggleKind(s, 'river');
    s = toggleKind(s, 'lake');
    expect(s).toEqual(['lake', 'river']);
    s = toggleKind(s, 'lake');
    expect(s).toEqual(['river']);
    expect(toggleKind(s, 'river')).toEqual([]);
  });
  it('Kurzfassung', () => {
    const label = (k: string) => ({ lake: 'See', pond: 'Teich', river: 'Fluss', canal: 'Kanal' })[k] ?? k;
    expect(kindSummary([], label, 'Alle Gewässerarten')).toBe('Alle Gewässerarten');
    expect(kindSummary(['lake', 'pond'], label, 'x')).toBe('See, Teich');
    expect(kindSummary(['lake', 'pond', 'river', 'canal'], label, 'x')).toBe('See, Teich, Fluss +1');
  });
});
