import { describe, expect, it } from 'vitest';
import {
  changeOver,
  gaugeForCatch,
  gaugeSnapshot,
  GaugeSnapshotSchema,
  type GaugeStation,
  levelState,
  nearestGauge,
  parseHygonStations,
  parseMeasurements,
  parsePegelonlineStations,
  seriesOf,
  summarizeHygon,
  titleCase,
} from './gauges';

// Auszug echter Einträge (stations.json, Abruf 2026-10-23)
const sample = [
  {
    uuid: '8f7e5f92-1153-4f93-acba-ca48670c8ca9',
    shortname: 'DÜSSELDORF',
    longname: 'DÜSSELDORF',
    longitude: 6.769891,
    latitude: 51.225498,
    water: { shortname: 'RHEIN', longname: 'RHEIN' },
    timeseries: [
      {
        shortname: 'Q',
        unit: 'm³/s',
        currentMeasurement: { timestamp: '2026-10-23T08:00:00+02:00', value: 627.0 },
      },
      {
        shortname: 'W',
        unit: 'cm',
        currentMeasurement: {
          timestamp: '2026-10-23T08:15:00+02:00',
          value: 15.0,
          stateMnwMhw: 'low',
          stateNswHsw: 'normal',
        },
      },
      { shortname: 'LT', unit: '°C', currentMeasurement: { value: 9 } },
    ],
  },
  {
    uuid: 'ohne-koordinaten',
    shortname: 'X',
    water: { longname: 'Y' },
    timeseries: [{ shortname: 'W', unit: 'cm' }],
  },
  {
    uuid: 'dr',
    longname: 'DUISBURG-RUHRORT',
    longitude: 6.729,
    latitude: 51.455,
    water: { longname: 'RHEIN' },
    timeseries: [
      {
        shortname: 'WT',
        unit: '°C',
        currentMeasurement: { timestamp: '2026-10-23T08:00:00+02:00', value: 12.4 },
      },
    ],
  },
];

describe('Pegel (PEGELONLINE)', () => {
  it('liest Stationen mit Koordinaten und W/Q/WT; andere Zeitreihen entfallen', () => {
    const s = parsePegelonlineStations(sample) ?? [];
    expect(s.map((x) => x.name)).toEqual(['Düsseldorf', 'Duisburg-Ruhrort']);
    expect(s[0]?.water).toBe('Rhein');
    expect(s[0] && seriesOf(s[0], 'W')).toMatchObject({ value: 15, unit: 'cm', state: 'low' });
    expect(s[0]?.series.map((x) => x.kind)).toEqual(['Q', 'W']);
    expect(parsePegelonlineStations({})).toBeNull();
  });

  it('nächster Pegel mit Entfernung', () => {
    const s = parsePegelonlineStations(sample) ?? [];
    const n = nearestGauge(s, { lat: 51.32, lng: 6.24 });
    expect(n?.station.name).toBe('Duisburg-Ruhrort');
    expect(n?.km).toBeGreaterThan(35);
    expect(n?.km).toBeLessThan(40);
    expect(nearestGauge([], { lat: 51, lng: 7 })).toBeUndefined();
  });

  it('Messwerte und Änderung über 24 h (nur mit Wert um diese Zeit)', () => {
    const h = 3_600_000;
    const t0 = Date.parse('2026-10-22T09:00:00+02:00');
    const pts = parseMeasurements([
      { timestamp: new Date(t0 + 24 * h).toISOString(), value: 20 },
      { timestamp: new Date(t0).toISOString(), value: 14 },
      { timestamp: 'kaputt', value: 1 },
    ]);
    expect(pts.map((p) => p.v)).toEqual([14, 20]);
    expect(changeOver(pts)).toBe(6);
    expect(changeOver(pts.slice(1))).toBeUndefined();
  });

  it('Namen lesbar schreiben', () => {
    expect(titleCase('RHEIN-HERNE-KANAL')).toBe('Rhein-Herne-Kanal');
    expect(titleCase('KÖLN')).toBe('Köln');
  });
});

// Echte Zeilen aus OpenHygon (Abruf 2026-10-23): Stationsliste und messwerte.txt (Zeiten in MEZ, +01:00)
const hygonStations = [
  'station_latitude;station_longitude;station_name;station_no;catchment_no;catchment_name;LANUV_Info_1;LANUV_Info_2;LANUV_Info_3;LANUV_MNW;LANUV_MW;LANUV_MHW;station_carteasting;station_cartnorthing;CATCHMENT_SIZE;DIST_TO_CONFL',
  '51.3107669538538;6.25253239621388;Sassenfeld;2862500000100;286;Niers- und Schwalmeinzugsgebiet;;;;4.0;11.0;42.0;;;93.51 km²;18.03 km',
  '51.3906489186876;6.33641680072098;Haus_Langenfeld;2862790000100;286;Niers- und Schwalmeinzugsgebiet;110.0;125.0;135.0;28.0;49.0;96.0;;;165.29 km²;3.20 km',
  ';;Ohne Koordinaten;1;;;;;;;;;;;;',
].join('\r\n');
const hygonValues = [
  'station_no;time;value(cm)',
  '2862500000100;2026-10-22T03:35:00.000+01:00;9.50',
  '2862500000100;2026-10-22T15:35:00.000+01:00;10.40',
  '2862500000100;2026-10-23T03:35:00.000+01:00;9.10',
  '2862500000100;',
  '9999999999999;2026-10-23T03:35:00.000+01:00;50.00',
  '2862790000100;2026-10-23T03:30:00.000+01:00;20.00',
].join('\n');

describe('Landespegel NRW (OpenHygon)', () => {
  it('Stationen lesen, Unterstriche im Namen ersetzen, ohne Koordinaten weglassen', () => {
    const s = parseHygonStations(hygonStations);
    expect(s.map((x) => x.name)).toEqual(['Sassenfeld', 'Haus Langenfeld']);
    expect(s[0]).toMatchObject({
      no: '2862500000100',
      mnw: 4,
      mhw: 42,
      area: 'Niers- und Schwalmeinzugsgebiet',
    });
  });

  it('letzter Wert, 24-h-Änderung und Lage zu MNW/MHW; ohne Gewässername, mit Einzugsgebiet', () => {
    const g = summarizeHygon(parseHygonStations(hygonStations), hygonValues);
    expect(g).toHaveLength(2);
    expect(g[0]).toMatchObject({
      uuid: 'hygon:2862500000100',
      source: 'hygon',
      water: '',
      area: 'Niers- und Schwalmeinzugsgebiet',
      change24h: -0.4,
    });
    expect(g[0]?.series[0]).toMatchObject({
      kind: 'W',
      unit: 'cm',
      value: 9.1,
      state: 'normal',
      at: '2026-10-23T02:35:00.000Z',
    });
    // Haus Langenfeld: 20 cm ≤ MNW 28 → niedrig; nur ein Wert → keine Änderung
    expect(g[1]?.series[0]?.state).toBe('low');
    expect(g[1]?.change24h).toBeUndefined();
    expect(levelState(42, 4, 42)).toBe('high');
    expect(levelState(10)).toBe('unknown');
  });
});

describe('Pegel am Fang – Auswahl und Messwert (GAUGE-3)', () => {
  const NOW = Date.parse('2026-10-23T12:00:00Z');
  const st = (over: Partial<GaugeStation>): GaugeStation => ({
    uuid: 'u',
    source: 'pegelonline',
    name: 'P',
    water: 'Rhein',
    lat: 51,
    lng: 7.05,
    series: [],
    ...over,
  });
  const pos = { lat: 51, lng: 7 };

  it('nimmt den nächsten Pegel, dessen Messreihe weit genug zurückreicht', () => {
    const nrw = st({ uuid: 'hygon:1', source: 'hygon', lng: 7.01 });
    const bund = st({ uuid: 'b' });
    const fresh = NOW - 2 * 86_400_000;
    const old = NOW - 10 * 86_400_000;
    expect(gaugeForCatch([bund, nrw], pos, fresh, NOW)).toMatchObject({ station: { uuid: 'hygon:1' } });
    expect(gaugeForCatch([bund, nrw], pos, old, NOW)).toMatchObject({ station: { uuid: 'b' } });
    expect(gaugeForCatch([nrw], pos, old, NOW)).toBe('too-old');
    expect(gaugeForCatch([st({ lat: 52 })], pos, fresh, NOW)).toBe('no-station');
  });

  it('Messwert höchstens 45 min neben dem Fang; Reihe noch zu kurz → später erneut', () => {
    const at = NOW - 86_400_000;
    const near = { station: st({}), km: 3.46 };
    const pts = [
      { t: at - 24 * 3_600_000, v: 280 },
      { t: at + 30 * 60_000, v: 300 },
      { t: at + 3 * 3_600_000, v: 310 },
    ];
    const ok = gaugeSnapshot(near, pts, at, new Date(NOW).toISOString());
    expect(ok).toMatchObject({ status: 'ok', levelCm: 300, km: 3.5 });
    expect(GaugeSnapshotSchema.safeParse(ok).success).toBe(true);
    expect(gaugeSnapshot(near, [{ t: at - 2 * 3_600_000, v: 1 }], at, 'x')).toBe('later');
    expect(
      gaugeSnapshot(
        near,
        [
          { t: at - 2 * 3_600_000, v: 1 },
          { t: at + 2 * 3_600_000, v: 1 },
        ],
        at,
        new Date(NOW).toISOString(),
      ),
    ).toMatchObject({ status: 'none', reason: 'no-value' });
  });
});
