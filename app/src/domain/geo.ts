// Ebene Geometrie für Landesgrenzen (rein, ohne Abhängigkeiten – auch von tools/water-pipeline genutzt).
// Koordinaten [lng, lat] in Grad. Abstände in Metern über eine örtliche Rechteckprojektion; für Abstände
// von einigen hundert Metern ist der Fehler vernachlässigbar.

export type Ring = [number, number][];
/** Polygon = äußerer Ring + Löcher */
export type PolygonRings = Ring[];

const M_PER_DEG = 111_320;
const toRad = Math.PI / 180;

/** Punkt in Polygon (gerade/ungerade Regel über alle Ringe, damit zählen Löcher richtig). */
export function inPolygon(lng: number, lat: number, poly: PolygonRings): boolean {
  let inside = false;
  for (const ring of poly)
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i] as [number, number];
      const [xj, yj] = ring[j] as [number, number];
      if (yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
  return inside;
}

/** Abstand eines Punkts zur Strecke a–b in Metern. */
export function segmentDistanceM(lng: number, lat: number, a: [number, number], b: [number, number]): number {
  const kx = M_PER_DEG * Math.cos(lat * toRad);
  const ky = M_PER_DEG;
  const ax = (a[0] - lng) * kx;
  const ay = (a[1] - lat) * ky;
  const bx = (b[0] - lng) * kx;
  const by = (b[1] - lat) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2));
  return Math.hypot(ax + t * dx, ay + t * dy);
}

/** Kürzester Abstand zum Rand (alle Ringe) in Metern. */
export function boundaryDistanceM(lng: number, lat: number, poly: PolygonRings): number {
  let d = Infinity;
  for (const ring of poly)
    for (let i = 1; i < ring.length; i++)
      d = Math.min(
        d,
        segmentDistanceM(lng, lat, ring[i - 1] as [number, number], ring[i] as [number, number]),
      );
  return d;
}

/**
 * Douglas-Peucker auf einem geschlossenen Ring: Jeder weggelassene Punkt liegt höchstens `toleranceM` Meter von der
 * vereinfachten Linie entfernt. Ringe, die dabei zu klein werden, entfallen (null).
 */
export function simplifyRing(ring: Ring, toleranceM: number): Ring | null {
  if (ring.length < 4) return null;
  const keep = new Uint8Array(ring.length);
  keep[0] = 1;
  keep[ring.length - 1] = 1;
  // Geschlossener Ring: zusätzlich den vom Start am weitesten entfernten Punkt halten, sonst kollabiert er
  const [sx, sy] = ring[0] as [number, number];
  let far = 0;
  let farD = -1;
  for (let i = 1; i < ring.length - 1; i++) {
    const [x, y] = ring[i] as [number, number];
    const d = Math.hypot((x - sx) * Math.cos(sy * toRad), y - sy);
    if (d > farD) {
      farD = d;
      far = i;
    }
  }
  keep[far] = 1;
  const stack: [number, number][] = [
    [0, far],
    [far, ring.length - 1],
  ];
  while (stack.length) {
    const [s, e] = stack.pop() as [number, number];
    let idx = -1;
    let max = toleranceM;
    for (let i = s + 1; i < e; i++) {
      const [x, y] = ring[i] as [number, number];
      const d = segmentDistanceM(x, y, ring[s] as [number, number], ring[e] as [number, number]);
      if (d > max) {
        max = d;
        idx = i;
      }
    }
    if (idx >= 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  const out = ring.filter((_, i) => keep[i]);
  return out.length >= 4 ? out : null;
}

export interface StateShape<C extends string = string> {
  code: C;
  /** [minLng, minLat, maxLng, maxLat] */
  bbox: [number, number, number, number];
  polygons: PolygonRings[];
}

export type StateHit<C extends string = string> =
  | { kind: 'state'; code: C }
  /** zu nah an einer Grenze (Vereinfachung): Kandidaten in Reihenfolge der Nähe */
  | { kind: 'border'; codes: C[] }
  | { kind: 'outside' };

/**
 * Bundesland an einem Punkt. Liegt der Punkt näher als `marginM` an einer Landesgrenze, wird nicht geraten:
 * Ergebnis „border" mit den Ländern in der Nähe.
 */
export function stateAt<C extends string>(
  lng: number,
  lat: number,
  states: readonly StateShape<C>[],
  marginM: number,
): StateHit<C> {
  const pad = (marginM / M_PER_DEG) * 2;
  const near: { code: C; inside: boolean; dist: number }[] = [];
  for (const s of states) {
    const [x0, y0, x1, y1] = s.bbox;
    if (lng < x0 - pad * 2 || lng > x1 + pad * 2 || lat < y0 - pad || lat > y1 + pad) continue;
    let inside = false;
    let dist = Infinity;
    for (const p of s.polygons) {
      if (inPolygon(lng, lat, p)) inside = true;
      dist = Math.min(dist, boundaryDistanceM(lng, lat, p));
    }
    if (inside || dist < marginM) near.push({ code: s.code, inside, dist });
  }
  const codes = [
    ...new Set(
      [...near].sort((a, b) => Number(b.inside) - Number(a.inside) || a.dist - b.dist).map((n) => n.code),
    ),
  ];
  const hit = near.find((n) => n.inside);
  // Nah an der Grenze zwischen zwei Ländern: nicht raten
  if (codes.length > 1 && near.some((n) => n.dist < marginM)) return { kind: 'border', codes };
  if (hit) return { kind: 'state', code: hit.code };
  // Knapp außerhalb eines Landes (z. B. Staatsgrenze): ebenfalls nachfragen
  return codes.length ? { kind: 'border', codes } : { kind: 'outside' };
}
