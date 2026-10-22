import { describe, expect, it } from 'vitest';
import { boundaryDistanceM, inPolygon, simplifyRing, stateAt, type Ring, type StateShape } from './geo';

// Zwei angrenzende Quadrate (synthetisch): A links von 10,0°, B rechts davon; 0,1° ≈ 7 km bei 51° Breite
const sq = (x0: number, y0: number, x1: number, y1: number): Ring => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];
const A: StateShape = { code: 'A', bbox: [9.9, 51, 10, 51.1], polygons: [[sq(9.9, 51, 10, 51.1)]] };
const B: StateShape = { code: 'B', bbox: [10, 51, 10.1, 51.1], polygons: [[sq(10, 51, 10.1, 51.1)]] };

describe('Geometrie Landesgrenzen', () => {
  it('Punkt in Polygon, auch mit Loch (Enklave wie Bremen in Niedersachsen)', () => {
    const withHole = [sq(0, 0, 10, 10), sq(4, 4, 6, 6)];
    expect(inPolygon(1, 1, withHole)).toBe(true);
    expect(inPolygon(5, 5, withHole)).toBe(false);
    expect(inPolygon(11, 5, withHole)).toBe(false);
  });

  it('Abstand zur Grenze in Metern', () => {
    // 0,01° Länge bei 51° ≈ 700 m
    const d = boundaryDistanceM(9.99, 51.05, [sq(9.9, 51, 10, 51.1)]);
    expect(d).toBeGreaterThan(690);
    expect(d).toBeLessThan(710);
  });

  it('Land eindeutig, wenn weit genug von der Grenze', () => {
    expect(stateAt(9.95, 51.05, [A, B], 150)).toEqual({ kind: 'state', code: 'A' });
    expect(stateAt(10.05, 51.05, [A, B], 150)).toEqual({ kind: 'state', code: 'B' });
    expect(stateAt(12, 51.05, [A, B], 150)).toEqual({ kind: 'outside' });
  });

  it('nah an der Landesgrenze wird nicht geraten', () => {
    // 0,001° ≈ 70 m östlich der Grenze
    expect(stateAt(10.001, 51.05, [A, B], 150)).toEqual({ kind: 'border', codes: ['B', 'A'] });
    // knapp außerhalb beider (Staatsgrenze im Norden)
    expect(stateAt(9.95, 51.1005, [A, B], 150)).toEqual({ kind: 'border', codes: ['A'] });
  });

  it('Vereinfachung: Punkte bleiben innerhalb der Toleranz, Ring bleibt geschlossen', () => {
    const ring: Ring = [];
    for (let i = 0; i <= 100; i++) ring.push([10 + i * 0.001, 51 + (i % 2) * 0.00001]); // Zickzack ≈ 1 m
    ring.push([10.1, 51.05], [10, 51.05], [10, 51]);
    const s = simplifyRing(ring, 20);
    expect(s).not.toBeNull();
    expect(s?.length).toBeLessThan(10);
    expect(s?.[0]).toEqual(s?.at(-1));
    for (const [x, y] of ring) expect(boundaryDistanceM(x, y, [s ?? []])).toBeLessThanOrEqual(20);
    expect(
      simplifyRing(
        [
          [0, 0],
          [1, 0],
          [0, 0],
        ],
        1,
      ),
    ).toBeNull();
  });
});
