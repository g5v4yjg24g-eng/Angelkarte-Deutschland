// Untere Leiste: leuchtende Linie am unteren Rand der Kapsel, die sich über dem aktiven Punkt zu einem Hügel wölbt
// (Wunsch Nutzer 2026-11-25, Vorlage: Video; nur die Umrandung, in den Farben der App). Reine Geometrie – Anzeige und
// Bewegung in app/NavWave.tsx.

export interface WaveGeometry {
  /** Außenmaße der Kapsel in px (Rahmenbox) */
  width: number;
  height: number;
  /** Mitte des Hügels (x) – außerhalb von 0…width: kein Hügel */
  center: number;
  /** halbe Breite des Hügels am Fuß */
  halfBase: number;
}

/** Abstand der Linie vom Außenrand (Mitte des Rahmens) */
export const WAVE_INSET = 1;
/** Scheitel des Hügels von oben, in Teilen der Höhe */
const APEX_RATIO = 0.1;
/** Flacher Scheitel: Anteil der halben Fußbreite */
const PLATEAU_RATIO = 0.1;
/** Wo die Linie am Bogen des Kapselendes beginnt (Winkel vom tiefsten Punkt) */
const END_ANGLE = (62 * Math.PI) / 180;
const STEP_PX = 2;

type Pt = [number, number];

/** Verlauf des Hügels: 1 am Scheitel (flach), weich auf 0 am Fuß. */
export function bump(distance: number, halfBase: number): number {
  const d = Math.abs(distance);
  const plateau = halfBase * PLATEAU_RATIO;
  if (d >= halfBase) return 0;
  if (d <= plateau) return 1;
  return 0.5 * (1 + Math.cos((Math.PI * (d - plateau)) / (halfBase - plateau)));
}

/** Untere Kontur der Kapsel (Mitte des Rahmens) an der Stelle x. */
export function baseY(x: number, width: number, height: number): number {
  const r = height / 2;
  const inner = r - WAVE_INSET;
  const left = r;
  const right = width - r;
  if (x < left) return r + Math.sqrt(Math.max(0, inner * inner - (left - x) ** 2));
  if (x > right) return r + Math.sqrt(Math.max(0, inner * inner - (x - right) ** 2));
  return height - WAVE_INSET;
}

/** Höhe (y) der Linie bei x: Kontur, zum Hügel hin angehoben. */
export function waveY(x: number, g: WaveGeometry): number {
  const base = baseY(x, g.width, g.height);
  const apex = WAVE_INSET + g.height * APEX_RATIO;
  return base + (apex - base) * bump(x - g.center, g.halfBase);
}

/** Anfang und Ende der Linie (x) auf den Bögen der Kapselenden. */
export function waveRange(width: number, height: number): [number, number] {
  const r = height / 2;
  const inner = r - WAVE_INSET;
  return [r - inner * Math.sin(END_ANGLE), width - r + inner * Math.sin(END_ANGLE)];
}

export function wavePoints(g: WaveGeometry): Pt[] {
  const [from, to] = waveRange(g.width, g.height);
  const pts: Pt[] = [];
  for (let x = from; x < to; x += STEP_PX) pts.push([x, waveY(x, g)]);
  pts.push([to, waveY(to, g)]);
  return pts;
}

const fmt = (n: number) => (Math.round(n * 10) / 10).toString();
const toPath = (pts: readonly Pt[]) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${fmt(x)} ${fmt(y)}`).join('');

/** Pfad der Linie. */
export function wavePath(g: WaveGeometry): string {
  return toPath(wavePoints(g));
}

/** Fläche zwischen Hügel und Kontur (leicht aufgehellt); leer, wenn kein Hügel zu sehen ist. */
export function waveFill(g: WaveGeometry): string {
  const from = Math.max(waveRange(g.width, g.height)[0], g.center - g.halfBase);
  const to = Math.min(waveRange(g.width, g.height)[1], g.center + g.halfBase);
  if (to - from < 2) return '';
  const top: Pt[] = [];
  const bottom: Pt[] = [];
  for (let x = from; x < to; x += STEP_PX) {
    top.push([x, waveY(x, g)]);
    bottom.push([x, baseY(x, g.width, g.height)]);
  }
  top.push([to, waveY(to, g)]);
  bottom.push([to, baseY(to, g.width, g.height)]);
  return `${toPath(top)}${bottom
    .reverse()
    .map(([x, y]) => `L${fmt(x)} ${fmt(y)}`)
    .join('')}Z`;
}

/** Ein Schritt der weichen Bewegung zum Ziel (dt in ms, tau = Zeitkonstante in ms). */
export function approach(current: number, target: number, dtMs: number, tauMs = 70): number {
  const k = 1 - Math.exp(-Math.max(0, dtMs) / tauMs);
  const next = current + (target - current) * k;
  return Math.abs(target - next) < 0.25 ? target : next;
}

/** Fußbreite des Hügels: etwas breiter als der Punkt, aber nicht ausufernd. */
export function halfBaseFor(tabWidth: number): number {
  return Math.min(Math.max(tabWidth * 0.72, 30), 56);
}

/** Mitte „kein Hügel“ (Linie flach) */
export const NO_WAVE = -9999;

/** Linie ohne Hügel: unterer Rand der Kapsel samt Bögen an den Enden. */
export function baselinePath(width: number, height: number): string {
  return wavePath({ width, height, center: NO_WAVE, halfBase: 1 });
}

/** Nur der Hügel auf gerader Grundlinie (x von 0 bis 2·halfBase, Scheitel bei halfBase): wird verschoben, nicht neu berechnet. */
export function humpPoints(halfBase: number, height: number): Pt[] {
  const base = height - WAVE_INSET;
  const apex = WAVE_INSET + height * APEX_RATIO;
  const pts: Pt[] = [];
  for (let x = 0; x < 2 * halfBase; x += STEP_PX)
    pts.push([x, base + (apex - base) * bump(x - halfBase, halfBase)]);
  pts.push([2 * halfBase, base]);
  return pts;
}

export function humpPath(halfBase: number, height: number): string {
  return toPath(humpPoints(halfBase, height));
}

/** Fläche unter dem Hügel bis zur Grundlinie. */
export function humpFill(halfBase: number, height: number): string {
  const base = height - WAVE_INSET;
  const pts = humpPoints(halfBase, height);
  return `${toPath(pts)}L${fmt(2 * halfBase)} ${fmt(base)}L0 ${fmt(base)}Z`;
}

/**
 * Verschiebungen (px) der verschiebbaren Teile für einen Hügel bei `center`:
 * Hügel selbst, linkes Fenster (zeigt die Linie links vom Hügel) und rechtes Fenster (rechts davon).
 * Die Fenster sind Rahmen mit abgeschnittenem Inhalt; der Inhalt wird gegengleich verschoben und bleibt so an Ort und Stelle.
 */
export function waveShifts(center: number, halfBase: number, width: number) {
  if (center <= NO_WAVE / 2) return { hump: -2 * halfBase, left: 0, right: width, visible: false };
  const leftEdge = center - halfBase + 1; // 1 px Überlappung gegen Haarlinien
  const rightEdge = center + halfBase - 1;
  return { hump: center - halfBase, left: leftEdge - width, right: rightEdge, visible: true };
}
