// Köderführung mit Angler (Wunsch Nutzer 2026-10-27): Die Rute bewegt sich im Takt der Köderbahn, die Schnur läuft
// von der Rutenspitze zum Köder. Rein und ohne DOM; die Ansicht berechnet daraus jedes Bild der Animation.

export type Pt = readonly [number, number];

/** Rutenbewegung während eines Bahnstücks: Winkel (Grad über der Waagerechten, Spitze nach links) über die Zeit 0…1 */
export interface RodMove {
  keys: readonly (readonly [number, number])[];
  /** Rolle dreht (einkurbeln) */
  reel?: boolean;
  /** Schnur locker (Twitchen, Jerken, Absinken an lockerer Schnur) */
  slack?: boolean;
}

export interface AnglerSpec {
  /** Hände (Rutengriff) */
  hand: Pt;
  /** Rutenlänge im Bild */
  length: number;
  /** Ruhewinkel vor der ersten Bewegung */
  base: number;
  /** Schnur zum Köder zeichnen (nicht bei der Ansicht von oben) */
  line?: boolean;
}

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** Winkel zur Zeit t (linear zwischen den Stützstellen) */
export function rodAngleAt(move: RodMove | undefined, t: number, fallback: number): number {
  const keys = move?.keys ?? [];
  if (!keys.length) return fallback;
  const x = clamp01(t);
  const first = keys[0] as readonly [number, number];
  if (x <= first[0]) return first[1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, a1] = keys[i] as readonly [number, number];
    const [t0, a0] = keys[i - 1] as readonly [number, number];
    if (x <= t1) return t1 === t0 ? a1 : a0 + ((a1 - a0) * (x - t0)) / (t1 - t0);
  }
  return (keys[keys.length - 1] as readonly [number, number])[1];
}

/** Rutenspitze bei gegebenem Winkel; über 90° zeigt die Spitze zum Angler hin (seitliches Ziehen) */
export function rodTip(a: AnglerSpec, angleDeg: number): Pt {
  const r = (angleDeg * Math.PI) / 180;
  return [a.hand[0] - a.length * Math.cos(r), a.hand[1] - a.length * Math.sin(r)];
}

/** Schnur von der Spitze zum Köder; locker hängt sie stärker durch */
export function lineCurve(tip: Pt, lure: Pt, slack = false): string {
  const mx = (tip[0] + lure[0]) / 2;
  const my = (tip[1] + lure[1]) / 2 + (slack ? 28 : 6);
  const f = (n: number) => Math.round(n * 10) / 10;
  return `M${f(tip[0])} ${f(tip[1])} Q${f(mx)} ${f(my)} ${f(lure[0])} ${f(lure[1])}`;
}

/** Rutenwinkel am Ende einer Bewegung */
export const endAngle = (move: RodMove | undefined, fallback: number) => rodAngleAt(move, 1, fallback);
