// GPS-Route einer Session (Session-Rückblick): Punkte annehmen oder verwerfen, Strecke, Vereinfachung, Abspielen.
// Rein, ohne Browser-APIs. Grenzwerte sind Einteilungen für typische Angeltage zu Fuß, im Boot oder Bellyboat [A].
import { segmentDistanceM } from './geo';
import type { LatLng, Track, TrackPoint } from './schemas';

/** Ungenauere Fixe (Funkzelle/WLAN statt GPS) werden verworfen */
export const MAX_ACCURACY_M = 50;
/** Höchstens alle 10 s ein Punkt */
export const MIN_INTERVAL_MS = 10_000;
/** Kleinere Bewegungen sind meist GPS-Rauschen am selben Platz */
export const MIN_STEP_M = 8;
/** Schneller (≈ 54 km/h) ist am Wasser ein Sprung des GPS, keine Bewegung */
export const MAX_SPEED_MS = 15;
/** Längere Lücke → neuer Abschnitt statt einer erfundenen Verbindung */
export const GAP_MS = 5 * 60_000;
/** Obergrenze je Session (≈ 55 h bei einem Punkt alle 10 s) */
export const MAX_POINTS = 20_000;

export interface Fix {
  lat: number;
  lng: number;
  acc: number;
  t: number;
}

export type FixDecision =
  | { kind: 'append'; point: TrackPoint }
  | { kind: 'newSegment'; point: TrackPoint }
  | { kind: 'skip'; reason: 'inaccurate' | 'tooSoon' | 'tooClose' | 'jump' | 'full' | 'past' };

export const distM = (a: LatLng, b: LatLng) => segmentDistanceM(a.lng, a.lat, [b.lng, b.lat], [b.lng, b.lat]);

const round6 = (x: number) => Math.round(x * 1e6) / 1e6;
export const toPoint = (f: Fix): TrackPoint => ({
  t: Math.round(f.t),
  lat: round6(f.lat),
  lng: round6(f.lng),
  acc: Math.min(1000, Math.round(f.acc)),
});

export const pointCount = (segments: readonly (readonly TrackPoint[])[]) =>
  segments.reduce((n, s) => n + s.length, 0);

/**
 * Entscheidet über einen neuen GPS-Fix. `restart` = die Aufzeichnung beginnt neu (Start, Rückkehr aus dem
 * Hintergrund, Ende einer Pause): der Punkt eröffnet einen neuen Abschnitt.
 */
export function decideFix(
  segments: readonly (readonly TrackPoint[])[],
  f: Fix,
  restart: boolean,
): FixDecision {
  if (!(f.acc <= MAX_ACCURACY_M)) return { kind: 'skip', reason: 'inaccurate' };
  if (pointCount(segments) >= MAX_POINTS) return { kind: 'skip', reason: 'full' };
  const last = segments.at(-1)?.at(-1);
  const point = toPoint(f);
  if (!last) return { kind: 'newSegment', point };
  const dt = f.t - last.t;
  if (dt <= 0) return { kind: 'skip', reason: 'past' };
  if (restart || dt > GAP_MS) return { kind: 'newSegment', point };
  if (dt < MIN_INTERVAL_MS) return { kind: 'skip', reason: 'tooSoon' };
  const d = distM(last, f);
  if (d < Math.max(MIN_STEP_M, Math.min(f.acc, last.acc))) return { kind: 'skip', reason: 'tooClose' };
  if (d / (dt / 1000) > MAX_SPEED_MS) return { kind: 'skip', reason: 'jump' };
  return { kind: 'append', point };
}

export function applyFix(segments: TrackPoint[][], d: FixDecision): TrackPoint[][] {
  if (d.kind === 'append') {
    const head = segments.slice(0, -1);
    return [...head, [...(segments.at(-1) ?? []), d.point]];
  }
  if (d.kind === 'newSegment') return [...segments, [d.point]];
  return segments;
}

/** Strecke entlang der aufgezeichneten Punkte (nur innerhalb der Abschnitte, Lücken zählen nicht). */
export function trackDistanceM(segments: readonly (readonly TrackPoint[])[]): number {
  let sum = 0;
  for (const s of segments)
    for (let i = 1; i < s.length; i++) sum += distM(s[i - 1] as LatLng, s[i] as LatLng);
  return sum;
}

/** Douglas-Peucker je Abschnitt; Start, Ende und Zeitstempel der verbleibenden Punkte bleiben erhalten. */
export function simplify(points: readonly TrackPoint[], toleranceM: number): TrackPoint[] {
  if (points.length <= 2) return [...points];
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop() as [number, number];
    const a = points[s] as TrackPoint;
    const b = points[e] as TrackPoint;
    let maxD = -1;
    let idx = -1;
    for (let i = s + 1; i < e; i++) {
      const p = points[i] as TrackPoint;
      const d = segmentDistanceM(p.lng, p.lat, [a.lng, a.lat], [b.lng, b.lat]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > toleranceM && idx > 0) {
      keep[idx] = 1;
      stack.push([s, idx], [idx, e]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Für die Anzeige höchstens etwa `maxPoints` Punkte; die Toleranz wächst, bis es passt (höchstens 20 m). */
export function displaySegments(segments: readonly TrackPoint[][], maxPoints = 1500): TrackPoint[][] {
  let tol = 0;
  let out = segments.map((s) => [...s]);
  while (pointCount(out) > maxPoints && tol < 20) {
    tol = tol ? tol * 2 : 1;
    out = segments.map((s) => simplify(s, tol));
  }
  return out;
}

/**
 * Bis zum Zeitpunkt t gezeichnete Route: vollständige Abschnitte, der laufende bis zum interpolierten Kopf.
 * Liefert auch die Kopfposition (undefined, solange t in einer Lücke oder vor dem Start liegt).
 */
export function routeUntil(
  segments: readonly TrackPoint[][],
  t: number,
): { lines: [number, number][][]; head?: LatLng | undefined } {
  const lines: [number, number][][] = [];
  let head: LatLng | undefined;
  for (const s of segments) {
    const first = s[0];
    if (!first || first.t > t) break;
    const line: [number, number][] = [];
    let i = 0;
    for (; i < s.length && (s[i] as TrackPoint).t <= t; i++)
      line.push([(s[i] as TrackPoint).lng, (s[i] as TrackPoint).lat]);
    const prev = s[i - 1] as TrackPoint;
    const next = s[i];
    if (next) {
      const f = (t - prev.t) / (next.t - prev.t);
      head = { lng: prev.lng + (next.lng - prev.lng) * f, lat: prev.lat + (next.lat - prev.lat) * f };
      line.push([head.lng, head.lat]);
    } else head = { lng: prev.lng, lat: prev.lat };
    lines.push(line.length === 1 ? [line[0] as [number, number], line[0] as [number, number]] : line);
    if (next) break;
  }
  return { lines, head };
}

export const trackRange = (tr: Pick<Track, 'segments'>) => {
  const first = tr.segments[0]?.[0];
  const last = tr.segments.at(-1)?.at(-1);
  return first && last ? { from: first.t, to: last.t } : undefined;
};

/**
 * Bildschirm-Versatz für Marker an (fast) derselben Stelle, damit keiner einen anderen verdeckt: Gruppen im Umkreis
 * von `radiusM` werden im Kreis um ihren gemeinsamen Ort verteilt (px, für icon-offset).
 */
export function spreadOffsets(points: readonly LatLng[], radiusM = 4, iconPx = 36): [number, number][] {
  const out: [number, number][] = points.map(() => [0, 0]);
  const done = new Set<number>();
  for (let i = 0; i < points.length; i++) {
    if (done.has(i)) continue;
    const group = [i];
    for (let j = i + 1; j < points.length; j++)
      if (!done.has(j) && distM(points[i] as LatLng, points[j] as LatLng) <= radiusM) group.push(j);
    // Kreisradius so, dass benachbarte Symbole (Durchmesser iconPx) sich nicht überdecken, plus etwas Luft
    const px = group.length > 1 ? (iconPx / 2 + 4) / Math.sin(Math.PI / group.length) : 0;
    if (group.length > 1)
      group.forEach((k, n) => {
        const a = (2 * Math.PI * n) / group.length - Math.PI / 2;
        out[k] = [Math.round(Math.cos(a) * px), Math.round(Math.sin(a) * px)];
      });
    group.forEach((k) => done.add(k));
  }
  return out;
}
