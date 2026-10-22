import { describe, expect, it } from 'vitest';
import type { Catch } from './schemas';
import { groupByWater, searchGroups } from './waterGroups';

const meta = { createdAt: '2026-10-20T10:00:00+02:00', updatedAt: '2026-10-20T10:00:00+02:00', rev: 0 };
let n = 0;
const c = (at: string, extra: Partial<Catch> = {}): Catch => ({
  id: `c${++n}`,
  ...meta,
  outcome: 'caught',
  at: `2026-10-${at}:00+02:00`,
  tz: 'Europe/Berlin',
  ...extra,
});
const pos = (lat: number, lng: number) => ({ position: { lat, lng, source: 'gps' as const } });
// 0,001° Breite ≈ 111 m
const LAT = 51.3;

describe('Fangbuch nach Gewässern', () => {
  it('bekannte Gewässer: ein Reiter je Name und Ort, neuestes zuerst', () => {
    const g = groupByWater([
      c('18T08:00', { waterId: 'osm:w1', waterSnapshot: { name: 'De Wittsee', place: 'Nettetal' } }),
      c('20T08:00', { waterId: 'osm:w2', waterSnapshot: { name: 'Rhein', place: 'Kreis Wesel' } }),
      c('19T08:00', { waterId: 'osm:w3', waterSnapshot: { name: 'Rhein', place: 'Kreis Wesel' } }),
      c('17T08:00', { waterId: 'osm:w9', waterSnapshot: { name: 'Rhein', place: 'Köln' } }),
    ]);
    expect(g.map((x) => [x.kind, x.name, x.place, x.ids.length])).toEqual([
      ['known', 'Rhein', 'Kreis Wesel', 2],
      ['known', 'De Wittsee', 'Nettetal', 1],
      ['known', 'Rhein', 'Köln', 1],
    ]);
  });

  it('unbekannte: Fangorte innerhalb von 200 m (auch über eine Kette) werden ein Reiter', () => {
    const g = groupByWater([
      c('20T08:00', pos(LAT, 6.2)),
      c('20T09:00', pos(LAT + 0.0015, 6.2)), // ≈ 167 m vom ersten
      c('20T10:00', pos(LAT + 0.003, 6.2)), // ≈ 167 m vom zweiten, 333 m vom ersten
      c('20T11:00', pos(LAT + 0.01, 6.2)), // > 700 m entfernt
      c('20T12:00'), // ohne Fangort
    ]);
    const unknown = g
      .filter((x) => x.kind === 'unknown')
      .map((x) => x.ids.length)
      .sort();
    expect(unknown).toEqual([1, 1, 3]);
    expect(g.every((x) => x.name === undefined)).toBe(true);
  });

  it('unbenannte Gewässer mit ID zählen als unbekannt; eigener Name und Ort werden übernommen', () => {
    const g = groupByWater([
      c('20T08:00', { ...pos(LAT, 6.2), waterId: 'osm:w5', waterSnapshot: { place: 'Nettetal' } }),
      c('20T09:00', { ...pos(LAT + 0.0005, 6.2), waterSnapshot: { customName: 'Hinterer Teich' } }),
    ]);
    expect(g).toHaveLength(1);
    expect(g[0]).toMatchObject({ kind: 'unknown', name: 'Hinterer Teich', place: 'Nettetal' });
  });

  it('Reiter-Schlüssel bleibt stabil, wenn ein neuer Fang dazukommt', () => {
    const first = c('20T08:00', pos(LAT, 6.2));
    const before = groupByWater([first])[0]?.key;
    const after = groupByWater([first, c('21T08:00', pos(LAT + 0.0005, 6.2))])[0]?.key;
    expect(after).toBe(before);
  });

  it('gelöschte Einträge zählen nicht', () => {
    expect(
      groupByWater([c('20T08:00', { deletedAt: meta.createdAt, waterSnapshot: { name: 'X' } })]),
    ).toEqual([]);
  });

  it('Suche nach Gewässername und Ort; unbekannte über „Unbekanntes Gewässer"', () => {
    const g = groupByWater([
      c('18T08:00', { waterSnapshot: { name: 'De Wittsee', place: 'Nettetal' } }),
      c('19T08:00', { waterSnapshot: { name: 'Krickenbecker See', place: 'Nettetal' } }),
      c('20T08:00', pos(LAT, 6.2)),
    ]);
    const names = (q: string) => searchGroups(g, q, 'Unbekanntes Gewässer').map((x) => x.name ?? '?');
    expect(names('wittsee')).toEqual(['De Wittsee']);
    expect(names('NETTETAL').sort()).toEqual(['De Wittsee', 'Krickenbecker See']);
    expect(names('unbekannt')).toEqual(['?']);
    expect(names('')).toHaveLength(3);
  });
});
