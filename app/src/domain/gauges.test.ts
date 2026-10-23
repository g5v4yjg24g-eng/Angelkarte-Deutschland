import { describe, expect, it } from 'vitest';
import {
  changeOver,
  nearestGauge,
  parseMeasurements,
  parsePegelonlineStations,
  seriesOf,
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
