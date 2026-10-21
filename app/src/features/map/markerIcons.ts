// Symbolsystem (ARCHITECTURE §5.3): Form = Art des Orts, Kreis = Fangereignis; Farbe nie allein –
// jedes Symbol hat zusätzlich ein eigenes Zeichen. SVGs werden für die Karte und die Legende genutzt.
import type { CatchOutcome, PlaceType } from '../../domain/schemas';

export type MarkerKind = `place-${PlaceType}` | `catch-${CatchOutcome}`;

const W = '#ffffff';
const OUTLINE = 'stroke="#ffffff" stroke-width="2.5"';

const PLACE: Record<PlaceType, string> = {
  // Tropfen-Pin mit Punkt
  spot: `<path d="M20 3C12.8 3 7 8.6 7 15.6 7 25 20 37 20 37s13-12 13-21.4C33 8.6 27.2 3 20 3Z" fill="#0F5C6E" ${OUTLINE}/><circle cx="20" cy="15.5" r="4.6" fill="${W}"/>`,
  // Quadrat mit Planken
  jetty: `<rect x="6" y="6" width="28" height="28" rx="6" fill="#8A5A2B" ${OUTLINE}/><path d="M12 14h16M12 20h16M12 26h16" stroke="${W}" stroke-width="2.6" stroke-linecap="round"/>`,
  parking: `<rect x="6" y="6" width="28" height="28" rx="8" fill="#2F5DA8" ${OUTLINE}/><path d="M16 28V12h5.5a4.5 4.5 0 0 1 0 9H16" fill="none" stroke="${W}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  access: `<circle cx="20" cy="20" r="14" fill="#2E7D4F" ${OUTLINE}/><path d="M13 20h13M21 14l6 6-6 6" fill="none" stroke="${W}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  hazard: `<path d="M20 4 36 33H4Z" fill="#B93A0B" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 14v9" stroke="${W}" stroke-width="3.2" stroke-linecap="round"/><circle cx="20" cy="28" r="2" fill="${W}"/>`,
  other: `<path d="M20 4 36 20 20 36 4 20Z" fill="#56656C" stroke="#ffffff" stroke-width="2.5" stroke-linejoin="round"/><circle cx="20" cy="20" r="4" fill="${W}"/>`,
};

const CATCH: Record<CatchOutcome, string> = {
  caught: `<circle cx="20" cy="20" r="13" fill="#D9731F" ${OUTLINE}/><path d="m14 20.5 4 4 8-9" fill="none" stroke="${W}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`,
  contact: `<circle cx="20" cy="20" r="13" fill="#A16207" ${OUTLINE}/><path d="M14 22l4-5 4 5 4-5" fill="none" stroke="${W}" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round"/>`,
  missed_bite: `<circle cx="20" cy="20" r="13" fill="#6B7A80" ${OUTLINE}/><path d="M15 15l10 10M25 15 15 25" stroke="${W}" stroke-width="2.8" stroke-linecap="round"/>`,
  observation: `<circle cx="20" cy="20" r="13" fill="#1F7A8C" ${OUTLINE}/><path d="M12 20s3-5 8-5 8 5 8 5-3 5-8 5-8-5-8-5Z" fill="none" stroke="${W}" stroke-width="2.2"/><circle cx="20" cy="20" r="2.2" fill="${W}"/>`,
};

export const PLACE_TYPES = Object.keys(PLACE) as PlaceType[];
export const CATCH_OUTCOMES = Object.keys(CATCH) as CatchOutcome[];

export function markerSvg(kind: MarkerKind): string {
  const body = kind.startsWith('place-')
    ? PLACE[kind.slice(6) as PlaceType]
    : CATCH[kind.slice(6) as CatchOutcome];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">${body}</svg>`;
}

export const markerDataUrl = (kind: MarkerKind) =>
  `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markerSvg(kind))}`;

export const ALL_MARKERS: MarkerKind[] = [
  ...PLACE_TYPES.map((t) => `place-${t}` as const),
  ...CATCH_OUTCOMES.map((o) => `catch-${o}` as const),
];
