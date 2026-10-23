// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { freshDb } from '../test/dbTestUtils';
import type { GaugeStation, Point } from '../domain/gauges';
import type { GaugesProvider, NrwGaugesProvider } from '../ports/gauges';
import { saveCatch } from './catchService';
import { fillMissingGauges, pendingGaugeIds, type GaugeSources } from './gaugeService';

const NOW = Date.parse('2026-10-23T12:00:00Z');
const AT = '2026-10-21T14:00:00+02:00'; // 12:00 UTC
const AT_MS = Date.parse(AT);
const base = {
  outcome: 'caught' as const,
  at: AT,
  tz: 'Europe/Berlin',
  position: { lat: 51.0, lng: 7.0, source: 'gps' as const },
};
const station = (over: Partial<GaugeStation>): GaugeStation => ({
  uuid: 'u1',
  source: 'pegelonline',
  name: 'Köln',
  water: 'Rhein',
  lat: 51.0,
  lng: 7.05, // ≈ 3,5 km östlich
  series: [{ kind: 'W', unit: 'cm' }],
  ...over,
});
/** Werte alle 15 min von 26 h vor bis 1 h nach dem Fang; steigt um 1 cm pro Stunde */
const series = (center: number): Point[] =>
  Array.from({ length: 27 * 4 + 1 }, (_, i) => {
    const t = center - 26 * 3_600_000 + i * 900_000;
    return { t, v: 300 + (t - center) / 3_600_000 };
  });

function sources(opts: {
  bund?: GaugeStation[];
  nrw?: { stations: GaugeStation[]; series: Map<string, Point[]> };
  inNrw?: boolean;
  between?: Point[];
}): GaugeSources & {
  gauges: { waterLevelBetween: ReturnType<typeof vi.fn>; stations: ReturnType<typeof vi.fn> };
  gaugesNrw: { withSeries: ReturnType<typeof vi.fn> };
} {
  const gauges = {
    id: 'test',
    stations: vi.fn(async () => opts.bund ?? []),
    waterLevel24h: vi.fn(async () => []),
    waterLevelBetween: vi.fn(async () => opts.between ?? []),
  } satisfies GaugesProvider;
  const gaugesNrw = {
    id: 'test-nrw',
    stations: vi.fn(async () => opts.nrw?.stations ?? []),
    withSeries: vi.fn(async () => opts.nrw ?? { stations: [], series: new Map() }),
  } satisfies NrwGaugesProvider;
  return { gauges, gaugesNrw, inNrw: async () => !!opts.inNrw };
}

describe('Pegel am Fang (GAUGE-3)', () => {
  it('speichert den Wasserstand des nächsten Bundespegels zum Fangzeitpunkt mit 24-h-Änderung', async () => {
    const db = freshDb();
    const a = await saveCatch({ input: base }, db);
    await saveCatch({ input: { ...base, position: undefined } }, db);
    const src = sources({ bund: [station({})], between: series(AT_MS) });
    const run = await fillMissingGauges(src, { nowMs: NOW }, db);
    expect(run.filled).toEqual([a.id]);
    expect(src.gauges.stations).toHaveBeenCalledTimes(1);
    expect(src.gaugesNrw.withSeries).not.toHaveBeenCalled();
    const [uuid, from, to] = src.gauges.waterLevelBetween.mock.calls[0] ?? [];
    expect(uuid).toBe('u1');
    expect(from).toBeLessThan(AT_MS - 24 * 3_600_000);
    expect(to).toBeGreaterThan(AT_MS);
    const g = (await db.catches.get(a.id))?.gauge;
    expect(g).toMatchObject({ status: 'ok', name: 'Köln', water: 'Rhein', levelCm: 300, change24h: 24 });
    expect(g?.status === 'ok' && g.state).toBeFalsy(); // Lage zu MNW/MHW gibt es bei PEGELONLINE nur aktuell
    expect(await pendingGaugeIds(db, NOW)).toEqual([]);
  });

  it('ohne Pegel im Umkreis: „kein Pegel“ wird gespeichert, damit nicht ständig neu gesucht wird', async () => {
    const db = freshDb();
    const a = await saveCatch({ input: base }, db);
    const src = sources({ bund: [station({ lat: 52.5 })] });
    await fillMissingGauges(src, { nowMs: NOW }, db);
    expect((await db.catches.get(a.id))?.gauge).toMatchObject({ status: 'none', reason: 'no-station' });
    expect(src.gauges.waterLevelBetween).not.toHaveBeenCalled();
  });

  it('älter als 30 Tage: „zu alt“, ohne Messreihe abzurufen', async () => {
    const db = freshDb();
    const a = await saveCatch({ input: { ...base, at: '2026-09-01T10:00:00+02:00' } }, db);
    const src = sources({ bund: [station({})] });
    await fillMissingGauges(src, { nowMs: NOW }, db);
    expect((await db.catches.get(a.id))?.gauge).toMatchObject({ status: 'none', reason: 'too-old' });
    expect(src.gauges.waterLevelBetween).not.toHaveBeenCalled();
  });

  it('Landespegel NRW: nur bei Ort in NRW, Reihe aus der Tagesdatei, Lage aus MNW/MHW', async () => {
    const db = freshDb();
    const a = await saveCatch({ input: base }, db);
    const nrwStation = station({
      uuid: 'hygon:286',
      source: 'hygon',
      name: 'Sassenfeld',
      water: '',
      area: 'Niers',
      lng: 7.01,
      mnw: 100,
      mhw: 250,
    });
    const src = sources({
      bund: [station({})],
      nrw: { stations: [nrwStation], series: new Map([['hygon:286', series(AT_MS)]]) },
      inNrw: true,
    });
    await fillMissingGauges(src, { nowMs: NOW }, db);
    const g = (await db.catches.get(a.id))?.gauge;
    expect(g).toMatchObject({
      status: 'ok',
      source: 'hygon',
      name: 'Sassenfeld',
      area: 'Niers',
      state: 'high',
    });
    expect(g?.status === 'ok' && g.water).toBeFalsy();
    expect(src.gauges.waterLevelBetween).not.toHaveBeenCalled();

    // Außerhalb von NRW wird die Tagesdatei nicht geladen
    const db2 = freshDb();
    await saveCatch({ input: base }, db2);
    const src2 = sources({ bund: [station({})], between: series(AT_MS) });
    await fillMissingGauges(src2, { nowMs: NOW }, db2);
    expect(src2.gaugesNrw.withSeries).not.toHaveBeenCalled();
  });

  it('NRW-Fang älter als die Tagesdatei: nächster Bundespegel, sonst „zu alt“', async () => {
    const db = freshDb();
    const old = await saveCatch({ input: { ...base, at: '2026-10-10T14:00:00+02:00' } }, db);
    const nrwStation = station({ uuid: 'hygon:1', source: 'hygon', water: '', lng: 7.01 });
    const src = sources({ nrw: { stations: [nrwStation], series: new Map() }, inNrw: true });
    await fillMissingGauges(src, { nowMs: NOW }, db);
    expect((await db.catches.get(old.id))?.gauge).toMatchObject({ status: 'none', reason: 'too-old' });
  });

  it('Messwert noch nicht da (Tagesdatei von heute früh): Fang bleibt offen', async () => {
    const db = freshDb();
    const recent = Date.parse('2026-10-23T10:00:00Z');
    const a = await saveCatch({ input: { ...base, at: '2026-10-23T12:00:00+02:00' } }, db);
    const src = sources({ bund: [station({})], between: series(recent - 5 * 3_600_000) });
    const run = await fillMissingGauges(src, { nowMs: NOW }, db);
    expect(run.later).toEqual([a.id]);
    expect((await db.catches.get(a.id))?.gauge).toBeUndefined();
  });

  it('Netzfehler: bricht ab, Fang bleibt offen', async () => {
    const db = freshDb();
    const a = await saveCatch({ input: base }, db);
    const src = sources({});
    src.gauges.stations.mockRejectedValueOnce(new TypeError('offline'));
    const run = await fillMissingGauges(src, { nowMs: NOW }, db);
    expect(run.error).toBeInstanceOf(TypeError);
    expect(await pendingGaugeIds(db, NOW)).toEqual([a.id]);
  });

  it('Zeit oder Ort geändert: gespeicherter Pegel wird verworfen und neu gesucht', async () => {
    const db = freshDb();
    const a = await saveCatch({ input: base }, db);
    await fillMissingGauges(sources({ bund: [station({})], between: series(AT_MS) }), { nowMs: NOW }, db);
    await saveCatch({ id: a.id, changes: { notes: 'nur Notiz' } }, db);
    expect((await db.catches.get(a.id))?.gauge?.status).toBe('ok');
    await saveCatch({ id: a.id, changes: { at: '2026-10-21T15:00:00+02:00' } }, db);
    expect((await db.catches.get(a.id))?.gauge).toBeUndefined();
    expect(await pendingGaugeIds(db, NOW)).toEqual([a.id]);
  });
});
