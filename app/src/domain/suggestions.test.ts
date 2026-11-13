import { describe, expect, it } from 'vitest';
import {
  FETCH_COUNT,
  nextAnchors,
  parsePrefs,
  parseSuggestionRows,
  reasonsOf,
  roundRegion,
  sharedWaters,
  splitCarousels,
  topAchievements,
  watersKey,
} from './suggestions';
import type { Catch, Session } from './schemas';
import type { Suggestion } from './suggestions';

const row = (n: number, extra: object = {}) => ({
  user_id: `u${n}`,
  username: `user${n}`,
  display_name: `User ${n}`,
  badges: [],
  common_friends: 0,
  achievement_keys: null,
  ...extra,
});

describe('parseSuggestionRows', () => {
  it('liest gültige Zeilen, wirft kaputte und doppelte weg', () => {
    const list = parseSuggestionRows([
      row(1, { common_friends: 3, badges: ['founder'], achievement_keys: ['first'] }),
      { user_id: 'x' },
      row(1),
      row(2, { same_region: true, shared_water: 'De Wittsee' }),
      null,
    ]);
    expect(list.map((s) => s.userId)).toEqual(['u1', 'u2']);
    expect(list[0]).toMatchObject({ commonFriends: 3, badges: ['founder'], achievementKeys: ['first'] });
    // Gewässer und Region kennt die App nicht (selbst wenn eine ältere Antwort sie noch mitschickt)
    expect(list[1]).not.toHaveProperty('sharedWater');
    expect(list[1]).not.toHaveProperty('sameRegion');
    expect(list[1]).not.toHaveProperty('achievementKeys');
    expect(parseSuggestionRows(undefined)).toEqual([]);
  });
});

describe('reasonsOf', () => {
  it('nennt nur gemeinsame Kontakte', () => {
    const s = parseSuggestionRows([
      row(1, { common_friends: 2, shared_water: 'Rhein', same_region: true }),
    ])[0] as Suggestion;
    expect(reasonsOf(s)).toEqual([{ kind: 'friends', count: 2 }]);
  });
  it('ohne gemeinsame Kontakte kein Grund – auch nicht Gewässer oder Region', () => {
    const s = parseSuggestionRows([row(1, { shared_water: 'Rhein', same_region: true })])[0] as Suggestion;
    expect(reasonsOf(s)).toEqual([]);
  });
});

describe('topAchievements', () => {
  it('höchste Stufe je Familie, wertvollste zuerst, höchstens drei', () => {
    expect(
      topAchievements([
        'catches:bronze',
        'catches:silver',
        'pike:gold',
        'species:bronze',
        'big:silver',
        'first',
      ]),
    ).toEqual([
      { kind: 'pike', tier: 'gold' },
      { kind: 'catches', tier: 'silver' },
      { kind: 'big', tier: 'silver' },
    ]);
  });
  it('„Erster Fang“ erscheint, wenn Platz ist', () => {
    expect(topAchievements(['first'])).toEqual([{ kind: 'first', tier: 'start' }]);
  });
  it('nicht freigegeben oder leer → nichts, unbekannte Schlüssel zählen nicht', () => {
    expect(topAchievements(undefined)).toEqual([]);
    expect(topAchievements([])).toEqual([]);
    expect(topAchievements(['quatsch:gold'])).toEqual([]);
  });
});

describe('nextAnchors', () => {
  it('erstes Karussell nach 5 Beiträgen, bei weniger am Ende', () => {
    expect(nextAnchors([], 10, 2)).toEqual([5]);
    expect(nextAnchors([], 3, 2)).toEqual([3]);
  });
  it('nichts ohne Beiträge oder ohne Karussell', () => {
    expect(nextAnchors([], 0, 2)).toEqual([]);
    expect(nextAnchors([], 20, 0)).toEqual([]);
  });
  it('ein gesetzter Platz bleibt, auch wenn mehr Beiträge kommen', () => {
    const a = nextAnchors([], 3, 1);
    expect(nextAnchors(a, 40, 1)).toEqual([3]);
  });
  it('zweites Karussell frühestens 12 Beiträge nach dem ersten und nur, wenn es eines gibt', () => {
    expect(nextAnchors([5], 17, 2)).toEqual([5]);
    expect(nextAnchors([5], 18, 2)).toEqual([5, 17]);
    expect(nextAnchors([5], 40, 1)).toEqual([5]);
    expect(nextAnchors([], 20, 2)).toEqual([5, 17]);
  });
  it('nie mehr als zwei', () => {
    expect(nextAnchors([5, 17], 100, 5)).toEqual([5, 17]);
  });
});

describe('splitCarousels', () => {
  const list = (n: number) => Array.from({ length: n }, (_, i) => ({ userId: `u${i}` }));
  it('höchstens zehn je Karussell, keine Person doppelt', () => {
    const parts = splitCarousels([...list(25), ...list(5)], 2);
    expect(parts.map((p) => p.length)).toEqual([10, 10]);
    expect(new Set(parts.flat().map((s) => s.userId)).size).toBe(20);
  });
  it('zu wenige für ein Karussell → keine leeren oder dünnen', () => {
    expect(splitCarousels(list(12), 2).map((p) => p.length)).toEqual([10]);
    expect(splitCarousels(list(2), 2)).toEqual([]);
    expect(FETCH_COUNT).toBe(20);
  });
});

describe('roundRegion', () => {
  it('rundet auf 0,1°', () => {
    expect(roundRegion(51.3263, 6.2418)).toEqual({ lat: 51.3, lng: 6.2 });
    expect(roundRegion(51.349, 6.251)).toEqual({ lat: 51.3, lng: 6.3 });
  });
  it('außerhalb des Bereichs oder kaputt → nichts', () => {
    expect(roundRegion(10, 10)).toBeUndefined();
    expect(roundRegion(51, 30)).toBeUndefined();
    expect(roundRegion(Number.NaN, 6)).toBeUndefined();
  });
});

const base = { rev: 1, createdAt: '2026-01-01T10:00:00+01:00', updatedAt: '2026-01-01T10:00:00+01:00' };
const fang = (id: string, over: object): Catch =>
  ({
    ...base,
    id,
    outcome: 'caught',
    at: '2026-05-01T10:00:00+02:00',
    tz: 'Europe/Berlin',
    ...over,
  }) as Catch;
const sess = (id: string, over: object): Session =>
  ({ ...base, id, startAt: '2026-06-01T10:00:00+02:00', tz: 'Europe/Berlin', ...over }) as Session;

describe('sharedWaters', () => {
  it('nur Fänge und Sessions mit Kennung und Name aus den Daten, zuletzt genutzt zuerst', () => {
    const list = sharedWaters(
      [
        fang('a', { waterId: 'osm:w1', waterSnapshot: { name: 'De Wittsee' } }),
        fang('b', { waterId: 'osm:w2', waterSnapshot: { name: 'Rhein' }, at: '2026-07-01T10:00:00+02:00' }),
        // eigener Name, kein Name, falsche Kennung, gelöscht: nie
        fang('c', { waterId: 'osm:w3', waterSnapshot: { customName: 'Mein Geheimsee' } }),
        fang('d', { waterSnapshot: { name: 'Ohne Kennung' } }),
        fang('e', { waterId: 'abc', waterSnapshot: { name: 'Falsch' } }),
        fang('f', {
          waterId: 'osm:w9',
          waterSnapshot: { name: 'Gelöscht' },
          deletedAt: '2026-07-02T10:00:00+02:00',
        }),
      ],
      [sess('s', { waterId: 'osm:w1', waterSnapshot: { name: 'De Wittsee' } })],
    );
    expect(list).toEqual([
      { id: 'osm:w2', name: 'Rhein' },
      { id: 'osm:w1', name: 'De Wittsee' },
    ]);
  });
  it('höchstens 30', () => {
    const many = Array.from({ length: 40 }, (_, i) =>
      fang(`c${i}`, { waterId: `osm:w${i + 1}`, waterSnapshot: { name: `See ${i}` } }),
    );
    expect(sharedWaters(many, [])).toHaveLength(30);
  });
  it('Merker ändert sich mit der Liste', () => {
    expect(watersKey('u', [{ id: 'osm:w1', name: 'A' }])).not.toBe(
      watersKey('u', [{ id: 'osm:w1', name: 'B' }]),
    );
  });
});

describe('parsePrefs', () => {
  it('liest die Zeile, sonst Standard (auffindbar, Gewässer an, Region aus)', () => {
    expect(parsePrefs([{ discoverable: false, waters_on: true, region_on: true }])).toEqual({
      discoverable: false,
      watersOn: true,
      regionOn: true,
    });
    expect(parsePrefs([])).toEqual({ discoverable: true, watersOn: true, regionOn: false });
  });
});
