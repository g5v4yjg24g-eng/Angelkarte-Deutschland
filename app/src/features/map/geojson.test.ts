import { describe, expect, it } from 'vitest';
import type { Catch, Place } from '../../domain/schemas';
import { circlePolygon, toFeatures } from './geojson';
import { ALL_MARKERS, markerSvg } from './markerIcons';

const meta = { createdAt: '2026-06-14T07:10:00+02:00', updatedAt: '2026-06-14T07:10:00+02:00', rev: 0 };
const place = (id: string, extra: Partial<Place> = {}): Place => ({
  ...meta,
  id,
  type: 'jetty',
  position: { lat: 51.3, lng: 6.2, source: 'map-tap' },
  ...extra,
});
const fang = (id: string, extra: Partial<Catch> = {}): Catch => ({
  ...meta,
  id,
  outcome: 'caught',
  at: '2026-06-14T07:10:00+02:00',
  tz: 'Europe/Berlin',
  position: { lat: 51.31, lng: 6.21, source: 'gps' },
  ...extra,
});

describe('Kartenobjekte', () => {
  it('übernimmt Orte und Fänge mit Position, ohne Gelöschte und ohne Fänge ohne Position', () => {
    const { placeFc, catchFc } = toFeatures(
      [place('a'), place('b', { deletedAt: meta.updatedAt })],
      [
        fang('c'),
        fang('d', { outcome: 'missed_bite' }),
        fang('e', { position: undefined } as Partial<Catch>),
      ],
    );
    expect(placeFc.features.map((f) => f.properties.kind)).toEqual(['place-jetty']);
    expect(placeFc.features[0]?.geometry.coordinates).toEqual([6.2, 51.3]);
    expect(catchFc.features.map((f) => f.properties.kind)).toEqual(['catch-caught', 'catch-missed_bite']);
  });

  it('jedes Symbol ist ein gültiges SVG mit Zeichen zusätzlich zur Farbe', () => {
    for (const k of ALL_MARKERS) {
      const svg = markerSvg(k);
      expect(svg).toMatch(/^<svg [^>]*viewBox="0 0 40 40">/);
      expect(svg.match(/<(path|circle|rect)/g)?.length, k).toBeGreaterThanOrEqual(2);
    }
  });

  it('Genauigkeitskreis hat den richtigen Radius', () => {
    const c = circlePolygon(6.2, 51.3, 100);
    const ring = c.geometry.coordinates[0] ?? [];
    expect(ring[0]).toEqual(ring[ring.length - 1]);
    const [lng0, lat0] = ring[12] ?? [0, 0]; // 90°: genau nördlich
    expect((lat0 - 51.3) * 111_320).toBeCloseTo(100, 0);
    expect(lng0).toBeCloseTo(6.2, 6);
  });
});
