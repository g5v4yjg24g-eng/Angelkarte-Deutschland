import { describe, expect, it } from 'vitest';
import { osmUrl, waterFromTile } from './water';
import { normalize, search, shardKey, type SearchEntry } from './search';

describe('Gewässer aus Kacheln', () => {
  it('übernimmt nur belegte Felder und rät nichts', () => {
    expect(
      waterFromTile(
        {
          wid: 'osm:w35044256',
          t: 'lake',
          n: 'De Wittsee',
          ha: 24.61,
          s: 'NW',
          k: 'Kreis Viersen',
          g: 'Nettetal',
          mz: 10,
        },
        false,
      ),
    ).toEqual({
      wid: 'osm:w35044256',
      name: 'De Wittsee',
      type: 'lake',
      areaHa: 24.61,
      isLine: false,
      state: 'NW',
      district: 'Kreis Viersen',
      municipality: 'Nettetal',
    });
    expect(waterFromTile({ wid: 'osm:w1', t: 'pond' }, false)).toEqual({
      wid: 'osm:w1',
      type: 'pond',
      isLine: false,
    });
  });
  it('unbekannter Typ → other, unbekanntes Land → weggelassen, kaputte ID → verworfen', () => {
    expect(waterFromTile({ wid: 'osm:r5', t: 'lava', s: 'XX' }, false)).toEqual({
      wid: 'osm:r5',
      type: 'other',
      isLine: false,
    });
    expect(waterFromTile({ wid: 'kaputt', t: 'lake' }, false)).toBeUndefined();
  });
  it('Linien haben keine Fläche', () => {
    expect(waterFromTile({ wid: 'osm:w2', t: 'river', ha: 3 }, true)?.areaHa).toBeUndefined();
  });
  it('baut OSM-Links', () => {
    expect(osmUrl('osm:w35044256')).toBe('https://www.openstreetmap.org/way/35044256');
    expect(osmUrl('osm:r12')).toBe('https://www.openstreetmap.org/relation/12');
    expect(osmUrl('x')).toBeUndefined();
  });
});

describe('Suche', () => {
  const E: SearchEntry[] = [
    ['De Wittsee', 'lake', 51.3263, 6.2418, 'Nettetal', 140, 'osm:w35044256'],
    ['Kleiner De Wittsee', 'other', 51.3188, 6.2457, 'Nettetal', 85, 'osm:w27634541'],
    ['Nettetal', 'place:town', 51.31, 6.28, 'Kreis Viersen', 0, ''],
    ['Nette', 'river', 51.3, 6.25, 'Kreis Viersen', 150, 'osm:w355735536'],
    ['Möhnesee', 'reservoir', 51.49, 8.12, 'Möhnesee', 300, 'osm:r1'],
    ['Wittsee', 'pond', 52.5, 13.4, 'Berlin', 10, 'osm:w9'],
  ];
  it('normalisiert Umlaute wie die Pipeline', () => {
    expect(normalize('Möhne-See Straße')).toBe('moehne see strasse');
    expect(shardKey('  Möhne')).toBe('mo');
    expect(shardKey('a')).toBeUndefined();
  });
  it('findet Wortanfänge, auch mit Umlautschreibweise', () => {
    expect(search(E, 'moehne').map((r) => r.name)).toEqual(['Möhnesee']);
    expect(search(E, 'Möhn').map((r) => r.name)).toEqual(['Möhnesee']);
    expect(search(E, 'wittsee').map((r) => r.name)).toEqual(['Wittsee', 'De Wittsee', 'Kleiner De Wittsee']);
  });
  it('genauer Treffer vor Präfix, Nähe entscheidet bei gleicher Güte', () => {
    const near = { lat: 51.32, lng: 6.24 };
    expect(search(E, 'nette', near).map((r) => r.name)).toEqual(['Nette', 'Nettetal']);
    expect(search(E, 'de witt', near)[0]).toMatchObject({
      name: 'De Wittsee',
      wid: 'osm:w35044256',
      isPlace: false,
    });
    expect(search(E, 'nettetal')[0]).toMatchObject({ isPlace: true, context: 'Kreis Viersen' });
    expect(search(E, 'nettetal')[0]).not.toHaveProperty('wid');
  });
  it('kein Ergebnis für zu kurze Anfragen', () => expect(search(E, 'n')).toEqual([]));
});
