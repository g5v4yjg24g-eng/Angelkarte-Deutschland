// Hecht beim Doppeltipp (Wunsch Nutzer 2026-11-06, Vorschau freigegeben 2026-11-06). Rein, ohne DOM.
// Form des Hechts (Seitenansicht, Kopf nach +x, Länge 100 Einheiten), Bahn im Bildrahmen, Zeitplan und
// Doppeltipp-Erkennung. Die Animation ist nur Rückmeldung – „Gefällt mir“ läuft unabhängig davon (Zeitgeber).

// ---------------------------------------------------------------------------------------------------------
// Form
export const PIKE_TOP: readonly (readonly [number, number])[] = [
  [10, 3.0],
  [18, 4.6],
  [28, 7.0],
  [40, 9.0],
  [52, 9.6],
  [64, 9.2],
  [74, 8.2],
  [81, 6.6],
  [86, 5.0],
  [91, 3.4],
  [96, 2.2],
  [100, 1.2],
];
export const PIKE_BOTTOM: readonly (readonly [number, number])[] = [
  [10, 3.0],
  [18, 4.8],
  [28, 7.4],
  [40, 9.4],
  [52, 10.0],
  [64, 9.2],
  [74, 7.6],
  [81, 5.8],
  [86, 4.2],
  [91, 2.8],
  [96, 1.9],
  [100, 1.5],
];

/** Halbe Körperhöhe an Stelle x (weich zwischen den Stützstellen) */
export function profileAt(table: readonly (readonly [number, number])[], x: number): number {
  const first = table[0];
  const last = table[table.length - 1];
  if (!first || !last) return 0;
  if (x <= first[0]) return first[1];
  for (let i = 1; i < table.length; i++) {
    const a = table[i - 1];
    const b = table[i];
    if (a && b && x <= b[0]) {
      const k = (x - a[0]) / (b[0] - a[0]);
      return a[1] + (b[1] - a[1]) * k * k * (3 - 2 * k);
    }
  }
  return last[1];
}

/** Welle entlang des Körpers (in der Seitenansicht leicht auf und ab), stärker zum Schwanz */
export function bodyWave(x: number, phase: number, amp: number): number {
  const r = (100 - x) / 100;
  return amp * r * r * Math.sin(phase - r * 5.2);
}

/** Helle Flecken in versetzten Reihen: [x, Lage relativ zur halben Höhe (−oben/+unten), Größe, Drehung] */
export const PIKE_SPOTS: readonly (readonly [number, number, number, number])[] = (() => {
  const out: [number, number, number, number][] = [];
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let row = 0; row < 5; row++) {
    const rel = -0.78 + row * 0.33;
    for (let x = 20 + (row % 2) * 2.2; x < 79; x += 4.4) {
      out.push([
        x + (rnd() - 0.5) * 1.6,
        rel + (rnd() - 0.5) * 0.12,
        0.85 + rnd() * 0.45,
        (rnd() - 0.5) * 0.6,
      ]);
    }
  }
  return out;
})();

// ---------------------------------------------------------------------------------------------------------
// Bahn und Zeitplan
export interface Point {
  x: number;
  y: number;
}
export interface SwimPath {
  start: Point;
  ctrl: Point;
  end: Point;
  heading0: number;
  /** Länge des Hechts in px */
  size: number;
}

export const APPEAR_MS = 200;
export const TURN_MS = 250;
export const SWIM_MS = 600;
export const DIVE_MS = 200;
/** Ab hier taucht der Hecht über dem Daumen ab – dann wechselt der Knopf */
export const ARRIVE_MS = APPEAR_MS + TURN_MS + SWIM_MS;
export const TOTAL_MS = ARRIVE_MS + DIVE_MS;
export const RING_MS = 520;

/** Länge des Hechts passend zur Bildbreite (Vorschau: 96 px bei ~360 px) */
export const pikeSize = (frameWidth: number): number =>
  Math.round(Math.min(120, Math.max(64, frameWidth * 0.27)));

/**
 * Bahn im Bildrahmen (w × h): vom Tipp im Bogen zum unteren Rand genau über dem Daumen (targetX), dort
 * senkrecht nach unten. Start und Ziel werden so begrenzt, dass der Hecht im Bild bleibt.
 */
export function swimPath(tap: Point, targetX: number, w: number, h: number, size: number): SwimPath {
  const half = size / 2;
  const clampX = (x: number) => Math.max(half * 0.6, Math.min(w - half * 0.6, x));
  const clampY = (y: number) => Math.max(half * 0.4, Math.min(h - half * 0.3, y));
  const start = { x: clampX(tap.x), y: clampY(tap.y) };
  const end = { x: clampX(targetX), y: h - size * 0.12 };
  const lift = Math.max(size * 0.9, (end.y - start.y) * 0.55);
  const ctrl = { x: end.x + (start.x - end.x) * 0.1, y: clampY(Math.min(start.y, end.y - lift)) };
  return { start, ctrl, end, size, heading0: Math.atan2(ctrl.y - start.y, ctrl.x - start.x) };
}

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
function bezier(p: SwimPath, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * p.start.x + 2 * u * t * p.ctrl.x + t * t * p.end.x,
    y: u * u * p.start.y + 2 * u * t * p.ctrl.y + t * t * p.end.y,
  };
}
function tangent(p: SwimPath, t: number): number {
  const x = 2 * (1 - t) * (p.ctrl.x - p.start.x) + 2 * t * (p.end.x - p.ctrl.x);
  const y = 2 * (1 - t) * (p.ctrl.y - p.start.y) + 2 * t * (p.end.y - p.ctrl.y);
  return Math.atan2(y, x);
}
function angleLerp(a: number, b: number, t: number): number {
  let d = b - a;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return a + d * t;
}

export interface SwimPose {
  x: number;
  y: number;
  /** Richtung der Schnauze (Bogenmaß) */
  heading: number;
  scale: number;
  alpha: number;
  /** Tempo des Schwanzschlags (1 = normal) */
  beat: number;
  done: boolean;
}

/** Lage des Hechts nach `ms` Millisekunden */
export function swimPose(p: SwimPath, ms: number): SwimPose {
  const swim0 = APPEAR_MS + TURN_MS;
  if (ms < APPEAR_MS) {
    const k = clamp01(ms / APPEAR_MS);
    return {
      ...p.start,
      heading: p.heading0 - 0.5,
      scale: 0.35 + 0.65 * (1 - (1 - k) ** 3),
      alpha: k,
      beat: 0.5,
      done: false,
    };
  }
  if (ms < swim0) {
    const k = clamp01((ms - APPEAR_MS) / TURN_MS);
    return {
      ...p.start,
      heading: angleLerp(p.heading0 - 0.5, p.heading0, easeInOut(k)),
      scale: 1,
      alpha: 1,
      beat: 0.7,
      done: false,
    };
  }
  if (ms < ARRIVE_MS) {
    const k = easeInOut(clamp01((ms - swim0) / SWIM_MS));
    return {
      ...bezier(p, k),
      heading: tangent(p, Math.max(0.001, k)),
      scale: 1,
      alpha: 1,
      beat: 1.5,
      done: false,
    };
  }
  const k = clamp01((ms - ARRIVE_MS) / DIVE_MS);
  return {
    x: p.end.x,
    y: p.end.y + k * p.size * 0.25,
    heading: tangent(p, 1),
    scale: 1 - 0.6 * k,
    alpha: 1 - k,
    beat: 1,
    done: ms >= TOTAL_MS,
  };
}

// ---------------------------------------------------------------------------------------------------------
// Doppeltipp: zwei kurze Tipps binnen 300 ms nah beieinander; wer dabei wischt (Karussell, Seite), tippt nicht
export interface Tap extends Point {
  t: number;
}
export const DOUBLE_TAP_MS = 300;
const TAP_SLOP_PX = 12;
const TAP_MAX_MS = 400;
const DOUBLE_TAP_DIST_PX = 30;

/** War Drücken → Loslassen ein Tipp (kaum bewegt, kurz)? */
export const isTap = (down: Tap, up: Tap): boolean =>
  Math.hypot(up.x - down.x, up.y - down.y) <= TAP_SLOP_PX && up.t - down.t <= TAP_MAX_MS;

/** Ergänzt den vorigen Tipp zu einem Doppeltipp? */
export const isDoubleTap = (prev: Tap | undefined, tap: Tap): boolean =>
  !!prev && tap.t - prev.t < DOUBLE_TAP_MS && Math.hypot(tap.x - prev.x, tap.y - prev.y) < DOUBLE_TAP_DIST_PX;
