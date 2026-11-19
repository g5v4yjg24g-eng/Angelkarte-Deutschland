// Kennzahlen über dem Fangbuch (Wunsch Nutzer 2026-11-20): gelandete Fische, größter Fisch, Zahl der Gewässer. Rein.
import type { Catch } from './schemas';

export interface CatchbookSummary {
  /** gelandete Fische (Ergebnis „Fang“) */
  landed: number;
  /** größte erfasste Länge eines gelandeten Fisches in cm; fehlt, wenn keine Länge erfasst ist */
  biggestCm?: number;
  /** Zahl der Gewässer im Fangbuch (siehe `groupByWater`) */
  waters: number;
}

export function catchbookSummary(catches: readonly Catch[], waters: number): CatchbookSummary {
  let landed = 0;
  let biggest: number | undefined;
  for (const c of catches) {
    if (c.deletedAt || c.outcome !== 'caught') continue;
    landed++;
    if (c.lengthCm !== undefined && (biggest === undefined || c.lengthCm > biggest)) biggest = c.lengthCm;
  }
  return { landed, ...(biggest !== undefined ? { biggestCm: biggest } : {}), waters };
}
