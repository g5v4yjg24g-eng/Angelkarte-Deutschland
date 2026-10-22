// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import type { WaterDataProvider } from '../ports/waterData';
import type { SearchEntry } from '../domain/search';
import { repo } from './repository';
import { fillMissingPlaces, renameUnknownWater } from './waterPlaceService';

const base = { outcome: 'caught' as const, at: '2026-10-20T10:00:00+02:00', tz: 'Europe/Berlin' };
const shard: SearchEntry[] = [
  ['De Wittsee', 'lake', 51.32, 6.24, 'Nettetal', 200, 'osm:w1'],
  ['De Wittsee', 'lake', 52.0, 7.0, 'Woanders', 10, 'osm:w2'],
];
const provider = (fail = false): WaterDataProvider => ({
  id: 'test',
  loadManifest: async () =>
    ({
      format: 'fangpunkt-water',
      formatVersion: 1,
      dataDate: '',
      source: { name: '', license: '', attribution: '', url: '' },
      coverage: [],
      tiles: '',
      search: '',
    }) as never,
  tilesUrl: () => '',
  loadSearchShard: async (_m, key) => {
    if (fail) throw new Error('offline');
    return key === 'de' ? shard : [];
  },
  loadStates: async () => null,
});

describe('Ort nachtragen und unbekannte Gewässer benennen', () => {
  it('Ort aus dem Suchindex über dieselbe Gewässer-ID, sonst nichts', async () => {
    const db = freshDb();
    const r = repo('catches', db);
    const a = await r.create({ ...base, waterId: 'osm:w1', waterSnapshot: { name: 'De Wittsee' } });
    const b = await r.create({ ...base, waterId: 'osm:w7', waterSnapshot: { name: 'De Wittsee' } });
    expect(await fillMissingPlaces(provider(), db)).toBe(1);
    expect((await db.catches.get(a.id))?.waterSnapshot?.place).toBe('Nettetal');
    expect((await db.catches.get(b.id))?.waterSnapshot?.place).toBeUndefined();
  });

  it('offline: nichts ändern, kein Fehler', async () => {
    const db = freshDb();
    await repo('catches', db).create({ ...base, waterId: 'osm:w1', waterSnapshot: { name: 'De Wittsee' } });
    expect(await fillMissingPlaces(provider(true), db)).toBe(0);
  });

  it('eigener Name nur für unbekannte Gewässer; leer setzt zurück; Ort bleibt', async () => {
    const db = freshDb();
    const r = repo('catches', db);
    const u = await r.create({ ...base, waterSnapshot: { place: 'Nettetal' } });
    const k = await r.create({ ...base, waterId: 'osm:w1', waterSnapshot: { name: 'De Wittsee' } });
    await renameUnknownWater([u.id, k.id], '  Hinterer   Teich ', db);
    expect((await db.catches.get(u.id))?.waterSnapshot).toEqual({
      place: 'Nettetal',
      customName: 'Hinterer Teich',
    });
    expect((await db.catches.get(k.id))?.waterSnapshot).toEqual({ name: 'De Wittsee' });
    await renameUnknownWater([u.id], '', db);
    expect((await db.catches.get(u.id))?.waterSnapshot).toEqual({ place: 'Nettetal' });
  });
});
