// Köderführung (Wunsch Nutzer 2026-10-27): acht Techniken mit Einsatzzweck, alle animiert. Texte in i18n/de.ts
// (retrieves.items), Zeichnungen in retrieveDiagrams.ts. Inhalte sind redaktionell (Prüfung offen, PLAN.md).
import type { RigDiagramSpec } from '../../domain/rigs';
import type { RigEntry } from './rigCatalog';
import {
  dragDiagram,
  faulenzenDiagram,
  jerkDiagram,
  jigDiagram,
  steadyDiagram,
  stopGoDiagram,
  twitchDiagram,
  verticalDiagram,
} from './retrieveDiagrams';

export type RetrieveZone = 'bottom' | 'midwater';
export const RETRIEVE_ZONES: readonly RetrieveZone[] = ['bottom', 'midwater'];

export interface RetrieveEntry {
  id: 'jig' | 'faulenzen' | 'steady' | 'stopGo' | 'twitch' | 'jerk' | 'vertical' | 'drag';
  slug: string;
  zone: RetrieveZone;
  /** passende Montagen */
  rigs: RigEntry['id'][];
  diagram: RigDiagramSpec;
}

export const RETRIEVES: readonly RetrieveEntry[] = [
  { id: 'jig', slug: 'jiggen', zone: 'bottom', rigs: [], diagram: jigDiagram },
  { id: 'faulenzen', slug: 'faulenzen', zone: 'bottom', rigs: [], diagram: faulenzenDiagram },
  { id: 'drag', slug: 'schleifen', zone: 'bottom', rigs: ['carolina', 'texas'], diagram: dragDiagram },
  { id: 'vertical', slug: 'vertikal', zone: 'bottom', rigs: ['dropShot'], diagram: verticalDiagram },
  { id: 'steady', slug: 'einkurbeln', zone: 'midwater', rigs: [], diagram: steadyDiagram },
  { id: 'stopGo', slug: 'stop-and-go', zone: 'midwater', rigs: [], diagram: stopGoDiagram },
  { id: 'twitch', slug: 'twitchen', zone: 'midwater', rigs: [], diagram: twitchDiagram },
  { id: 'jerk', slug: 'jerken', zone: 'midwater', rigs: [], diagram: jerkDiagram },
];

export const retrieveBySlug = (slug: string) => RETRIEVES.find((r) => r.slug === slug);
