// Session-Zusammenfassung zum Teilen (Paket 12, Masterprompt 5.2 „bestimmte Session-Zusammenfassungen“). Rein.
// Bewusst ohne Ort: keine Route, keine Koordinaten, kein Gewässername – nur Zahlen. Teilen bleibt ein eigener
// Beitrag, den man vor dem Posten sieht und ändern kann.
import type { Review } from './sessionReview';

export interface SessionShareFacts {
  /** aktive Angelzeit (ohne Pausen) */
  activeMs: number;
  caught: number;
  /** Bisse wie in der Statistik: Fang + Kontakt + Fehlbiss */
  bites: number;
  speciesCount: number;
  /** größter gemessener oder geschätzter Fisch */
  longest?: { speciesId?: string | undefined; lengthCm: number; estimated: boolean } | undefined;
  /** Strecke in km (eine Nachkommastelle); nur mit Route, ohne die Route selbst */
  distanceKm?: number | undefined;
}

export function sessionShareFacts(review: Review): SessionShareFacts {
  const l = review.longest;
  return {
    activeMs: review.activeMs,
    caught: review.counts.caught,
    bites: review.bites,
    speciesCount: review.speciesCount,
    longest:
      l && l.item.lengthCm !== undefined
        ? { speciesId: l.item.speciesId, lengthCm: l.item.lengthCm, estimated: l.estimated }
        : undefined,
    distanceKm:
      review.distanceM !== undefined && review.distanceM >= 100
        ? Math.round(review.distanceM / 100) / 10
        : undefined,
  };
}
