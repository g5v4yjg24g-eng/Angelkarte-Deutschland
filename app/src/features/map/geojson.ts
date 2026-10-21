// Gespeicherte Orte und Fänge → GeoJSON für die Kartenebenen (rein, testbar).
import type { FeatureCollection, Point } from 'geojson';
import type { Catch, Place } from '../../domain/schemas';
import type { MarkerKind } from './markerIcons';

export interface MarkerProps {
  id: string;
  kind: MarkerKind;
  entity: 'place' | 'catch';
  /** Sortierung: neuere Fänge oben */
  sort: number;
}

export function toFeatures(places: Place[], catches: Catch[]) {
  const placeFc: FeatureCollection<Point, MarkerProps> = {
    type: 'FeatureCollection',
    features: places
      .filter((p) => !p.deletedAt)
      .map((p) => ({
        type: 'Feature',
        id: p.id,
        geometry: { type: 'Point', coordinates: [p.position.lng, p.position.lat] },
        properties: { id: p.id, kind: `place-${p.type}`, entity: 'place', sort: 0 },
      })),
  };
  const catchFc: FeatureCollection<Point, MarkerProps> = {
    type: 'FeatureCollection',
    features: catches
      .filter((c): c is Catch & { position: NonNullable<Catch['position']> } => !c.deletedAt && !!c.position)
      .map((c) => ({
        type: 'Feature',
        id: c.id,
        geometry: { type: 'Point', coordinates: [c.position.lng, c.position.lat] },
        properties: { id: c.id, kind: `catch-${c.outcome}`, entity: 'catch', sort: Date.parse(c.at) / 1e3 },
      })),
  };
  return { placeFc, catchFc };
}

/** Kreis um einen Punkt (Genauigkeit des Standorts) als Polygon, Radius in Metern. */
export function circlePolygon(lng: number, lat: number, radiusM: number, steps = 48) {
  const coords: [number, number][] = [];
  const dLat = radiusM / 111_320;
  const dLng = radiusM / (111_320 * Math.cos((lat * Math.PI) / 180));
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * 2 * Math.PI;
    coords.push([lng + dLng * Math.cos(a), lat + dLat * Math.sin(a)]);
  }
  return {
    type: 'Feature' as const,
    properties: {},
    geometry: { type: 'Polygon' as const, coordinates: [coords] },
  };
}
