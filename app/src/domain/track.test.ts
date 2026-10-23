import { describe, expect, it } from 'vitest';
import type { TrackPoint } from './schemas';
import {
  applyFix,
  decideFix,
  displaySegments,
  distM,
  GAP_MS,
  MAX_POINTS,
  routeUntil,
  spreadOffsets,
  trackDistanceM,
  type Fix,
} from './track';

const T0 = Date.parse('2026-10-23T06:00:00Z');
/** ~ m nach Norden (1° Breite ≈ 111 195 m) */
const north = (m: number) => m / 111_195;
const fix = (sec: number, mNorth: number, acc = 5): Fix => ({
  t: T0 + sec * 1000,
  lat: 51 + north(mNorth),
  lng: 7,
  acc,
});

function record(fixes: Fix[], restartAt: number[] = []) {
  let segs: TrackPoint[][] = [];
  fixes.forEach((f, i) => {
    segs = applyFix(segs, decideFix(segs, f, i === 0 || restartAt.includes(i)));
  });
  return segs;
}

describe('GPS-Aufzeichnung: Punkte annehmen/verwerfen (TRK-1)', () => {
  it('erster Punkt eröffnet einen Abschnitt; ungenaue, zu frühe und zu nahe Fixe werden verworfen', () => {
    expect(decideFix([], fix(0, 0), true).kind).toBe('newSegment');
    expect(decideFix([], fix(0, 0, 80), true)).toEqual({ kind: 'skip', reason: 'inaccurate' });
    const segs = record([fix(0, 0)]);
    expect(decideFix(segs, fix(5, 30), false)).toEqual({ kind: 'skip', reason: 'tooSoon' });
    expect(decideFix(segs, fix(30, 3), false)).toEqual({ kind: 'skip', reason: 'tooClose' });
    expect(decideFix(segs, fix(30, 40), false).kind).toBe('append');
  });

  it('unplausible Sprünge (> 54 km/h) werden verworfen', () => {
    const segs = record([fix(0, 0)]);
    expect(decideFix(segs, fix(20, 2000), false)).toEqual({ kind: 'skip', reason: 'jump' });
    // Bellyboat/Boot mit 5 m/s ist plausibel
    expect(decideFix(segs, fix(20, 100), false).kind).toBe('append');
  });

  it('Lücke oder Neustart → neuer Abschnitt statt erfundener Verbindung', () => {
    const segs = record([
      fix(0, 0),
      fix(30, 50),
      fix(30 + GAP_MS / 1000 + 1, 500),
      fix(30 + GAP_MS / 1000 + 40, 560),
    ]);
    expect(segs.map((s) => s.length)).toEqual([2, 2]);
    const restarted = record([fix(0, 0), fix(30, 50), fix(60, 100)], [2]);
    expect(restarted.map((s) => s.length)).toEqual([2, 1]);
  });

  it('Strecke entlang der Punkte, Lücken zählen nicht; Luftlinie Start–Ende ist kürzer', () => {
    // hin und zurück: 0 → 100 → 0 m
    const segs = record([fix(0, 0), fix(30, 50), fix(60, 100), fix(90, 50), fix(120, 0)]);
    expect(Math.round(trackDistanceM(segs))).toBe(200);
    const first = segs[0]?.[0] as TrackPoint;
    const last = segs.at(-1)?.at(-1) as TrackPoint;
    expect(Math.round(distM(first, last))).toBe(0);
    const gap = record([
      fix(0, 0),
      fix(30, 50),
      fix(30 + GAP_MS / 1000 + 1, 1000),
      fix(30 + GAP_MS / 1000 + 31, 1050),
    ]);
    expect(Math.round(trackDistanceM(gap))).toBe(100);
  });

  it('speichert nur, was nötig ist: gerundet, mit Zeitstempel und Obergrenze', () => {
    const d = decideFix([], { t: T0 + 0.4, lat: 51.123456789, lng: 7.987654321, acc: 4.6 }, true);
    expect(d).toEqual({ kind: 'newSegment', point: { t: T0, lat: 51.123457, lng: 7.987654, acc: 5 } });
    const full = [Array.from({ length: MAX_POINTS }, (_, i) => ({ t: T0 + i, lat: 51, lng: 7, acc: 5 }))];
    expect(decideFix(full, fix(MAX_POINTS, 100), false)).toEqual({ kind: 'skip', reason: 'full' });
  });
});

describe('Wiedergabe (TRK-2)', () => {
  const segs = record([
    fix(0, 0),
    fix(60, 100),
    fix(120, 200),
    fix(120 + GAP_MS / 1000 + 10, 400),
    fix(120 + GAP_MS / 1000 + 70, 500),
  ]);

  it('Route wächst bis zum Zeitpunkt, Kopf interpoliert; vor dem Start nichts', () => {
    expect(routeUntil(segs, T0 - 1).lines).toEqual([]);
    const half = routeUntil(segs, T0 + 30_000);
    expect(half.lines).toHaveLength(1);
    expect(half.lines[0]).toHaveLength(2);
    expect(half.head?.lat).toBeCloseTo(51 + north(50), 6);
  });

  it('in der Lücke bleibt der erste Abschnitt stehen, der zweite fehlt noch; am Ende beide getrennt', () => {
    const inGap = routeUntil(segs, T0 + 200_000);
    expect(inGap.lines).toHaveLength(1);
    const end = routeUntil(segs, T0 + 10 * 60_000);
    expect(end.lines).toHaveLength(2);
    expect(end.lines[0]?.at(-1)).toEqual([7, segs[0]?.at(-1)?.lat]);
  });

  it('lange Routen werden für die Anzeige vereinfacht, ohne Start und Ende zu verlieren', () => {
    const zig = Array.from({ length: 6000 }, (_, i) => ({
      t: T0 + i * 10_000,
      lat: 51 + north(i * 5),
      lng: 7 + (i % 2) * 1e-6,
      acc: 5,
    }));
    const out = displaySegments([zig], 1500);
    expect(out[0]?.length).toBeLessThanOrEqual(1500);
    expect(out[0]?.[0]).toEqual(zig[0]);
    expect(out[0]?.at(-1)).toEqual(zig.at(-1));
    expect(Math.abs(trackDistanceM(out) - trackDistanceM([zig]))).toBeLessThan(5);
  });

  it('Marker an derselben Stelle werden auseinandergezogen, einzelne bleiben', () => {
    const p = { lat: 51, lng: 7 };
    const offs = spreadOffsets([p, { lat: 51 + north(1), lng: 7 }, { lat: 51 + north(100), lng: 7 }]);
    expect(offs[2]).toEqual([0, 0]);
    expect(offs[0]).not.toEqual(offs[1]);
  });
});
