// Montagen (Wunsch Nutzer 2026-10-27): Zeichenkern für die Schritt-für-Schritt-Animation, Gegenstück zu knots.ts.
// Eine Montage besteht aus Teilen (Schnurstücke, Blei, Perle, Wirbel, Haken, Pose, Köder), die je Schritt
// hinzukommen. Kreuzungen gibt es nicht: Teile liegen in der Reihenfolge der Vorgabe übereinander.
// Schnüre und Metallteile zeichnen sich als Linie, Körper (Blei, Perle, Pose, Köder) blenden ein.
// Rein und ohne DOM – die Ansicht rendert die Teile als SVG.
import type { AnglerSpec, RodMove } from './angler';

/**
 * line: Hauptschnur, line2: Vorfach/Haar, hardware: Haken und Ringe (Linie), metal: Wirbelkörper (Fläche),
 * weight: Blei, bead: Perle, float: Posenkörper, floatTip: Posenspitze, bait: Köder (Fläche), worm: Wurm (Strich),
 * stopper: Stopper/Posengummis, trail: Bahn des Köders (Köderführung, der Köder läuft sie ab), boat: Boot,
 * bank: Ufer, angler: Angler (Strichfigur),
 * context: Grund oder Wasseroberfläche (gestrichelt)
 */
export type RigStyle =
  | 'line'
  | 'line2'
  | 'hardware'
  | 'metal'
  | 'weight'
  | 'bead'
  | 'float'
  | 'floatTip'
  | 'bait'
  | 'worm'
  | 'stopper'
  | 'trail'
  | 'boat'
  | 'bank'
  | 'angler'
  | 'context';

/** Teile, die sich als Linie zeichnen; alle übrigen (Flächen, gestrichelter Grund) blenden ein */
const DRAWN: ReadonlySet<RigStyle> = new Set(['line', 'line2', 'hardware', 'worm', 'stopper', 'trail']);
export const isDrawn = (s: RigStyle) => DRAWN.has(s);

export interface RigLabelSpec {
  /** Schlüssel der Beschriftung (Texte in i18n) */
  key: string;
  x: number;
  y: number;
  anchor?: 'start' | 'middle' | 'end';
}

export interface RigPart {
  id: string;
  step: number;
  style: RigStyle;
  d: string;
  label?: RigLabelSpec;
  /** eigene Dauer der Animation (z. B. langsames Absinken) */
  ms?: number;
  /** Rutenbewegung während dieses Bahnstücks */
  rod?: RodMove;
}

export interface RigDiagramSpec {
  width: number;
  height: number;
  parts: RigPart[];
  /** Köderführung: ein Köder läuft die Bahn (`trail`) des aktuellen Schritts ab */
  lure?: boolean;
  /** Köderführung: Angler mit Rute, Schnur zum Köder */
  angler?: AnglerSpec;
}

export interface RigFramePart extends RigPart {
  /** im aktuellen Schritt neu: mit Animation */
  timing?: { delayMs: number; durationMs: number };
}

export const RIG_DRAW_MS = 650;
export const RIG_FADE_MS = 350;

export const rigStepCount = (spec: RigDiagramSpec) => spec.parts.reduce((n, p) => Math.max(n, p.step + 1), 0);

/** Sichtbare Teile bis einschließlich `step`; die neuen Teile kommen nacheinander. */
export function rigFrame(spec: RigDiagramSpec, step: number): RigFramePart[] {
  let t = 0;
  const out: RigFramePart[] = [];
  for (const p of spec.parts) {
    if (p.step > step) continue;
    if (p.step < step) {
      out.push(p);
      continue;
    }
    const durationMs = p.ms ?? (isDrawn(p.style) ? RIG_DRAW_MS : RIG_FADE_MS);
    out.push({ ...p, timing: { delayMs: t, durationMs } });
    t += durationMs;
  }
  return out;
}

/** Dauer, bis alle neuen Teile eines Schritts zu sehen sind */
export function rigStepDurationMs(spec: RigDiagramSpec, step: number): number {
  return rigFrame(spec, step).reduce(
    (m, p) => (p.timing ? Math.max(m, p.timing.delayMs + p.timing.durationMs) : m),
    0,
  );
}

/** Prüft die Vorgabe (für Tests): eindeutige IDs, jeder Schritt bringt etwas Neues, Pfade im Bild. */
export function rigProblems(spec: RigDiagramSpec): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const p of spec.parts) {
    if (ids.has(p.id)) problems.push(`doppelte ID ${p.id}`);
    ids.add(p.id);
    const nums = (p.d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    if (!/^M/.test(p.d.trim()) || nums.length < 2) problems.push(`${p.id}: Pfad beginnt nicht mit M`);
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = nums[i] as number;
      const y = nums[i + 1] as number;
      if (x < 0 || x > spec.width || y < 0 || y > spec.height) {
        problems.push(`${p.id}: Punkt ${x} ${y} außerhalb des Bildes`);
        break;
      }
    }
    if (p.label) {
      const { x, y } = p.label;
      if (x < 0 || x > spec.width || y < 0 || y > spec.height)
        problems.push(`${p.id}: Beschriftung außerhalb`);
    }
  }
  for (let s = 0; s < rigStepCount(spec); s++)
    if (!spec.parts.some((p) => p.step === s)) problems.push(`Schritt ${s + 1} ohne neue Teile`);
  return problems;
}

/** Endpunkt eines Pfads und Richtung der letzten Bewegung (Grad, 0 = nach rechts) – für den ruhenden Köder */
export function pathEnd(d: string): { x: number; y: number; angle: number } {
  const nums = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  const x = nums[nums.length - 2] ?? 0;
  const y = nums[nums.length - 1] ?? 0;
  const px = nums[nums.length - 4] ?? x;
  const py = nums[nums.length - 3] ?? y;
  const angle = px === x && py === y ? 0 : (Math.atan2(y - py, x - px) * 180) / Math.PI;
  return { x, y, angle };
}

/** Bahnstücke des Schritts mit Zeiten (für den laufenden Köder) */
export const stepTrail = (spec: RigDiagramSpec, step: number) =>
  rigFrame(spec, step).filter((p) => p.style === 'trail' && p.step === step);

/** Letztes Bahnstück bis einschließlich `step` (hier ruht der Köder) */
export function lastTrail(spec: RigDiagramSpec, step: number): RigPart | undefined {
  return spec.parts.filter((p) => p.style === 'trail' && p.step <= step).at(-1);
}

/** Erster Punkt eines Pfads (Start des Köders in einem Schritt) */
export function pathStart(d: string): { x: number; y: number } {
  const nums = (d.match(/-?\d*\.?\d+(?:e-?\d+)?/gi) ?? []).map(Number);
  return { x: nums[0] ?? 0, y: nums[1] ?? 0 };
}

/** Rutenwinkel, mit dem ein Schritt beginnt: Ende der letzten Bewegung davor, sonst der Ruhewinkel */
export function rodAngleBefore(spec: RigDiagramSpec, step: number): number {
  const base = spec.angler?.base ?? 30;
  const prev = spec.parts.filter((p) => p.style === 'trail' && p.step < step && p.rod).at(-1);
  const keys = prev?.rod?.keys;
  return keys?.length ? (keys[keys.length - 1] as readonly [number, number])[1] : base;
}
