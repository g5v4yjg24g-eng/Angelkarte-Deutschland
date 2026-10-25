// Knoten-Katalog (Wunsch Nutzer 2026-10-25): alle neun Knoten animiert. Texte in i18n/de.ts (knots.items),
// Zeichnungen in diagrams.ts. Inhalte sind redaktionell (Pilot vom Nutzer gegengeprüft 2026-10-25, Rest siehe PLAN.md).
import type { KnotDiagramSpec } from '../../domain/knots';
import {
  arborDiagram,
  clinchDiagram,
  doubleUniDiagram,
  fgDiagram,
  palomarDiagram,
  perfectionDiagram,
  snellDiagram,
  surgeonDiagram,
  uniDiagram,
} from './diagrams';

export type KnotUse = 'attach' | 'join' | 'loop' | 'spool';
export const KNOT_USES: readonly KnotUse[] = ['attach', 'join', 'loop', 'spool'];

export interface KnotEntry {
  id: 'clinch' | 'palomar' | 'uni' | 'doubleUni' | 'fg' | 'surgeon' | 'perfection' | 'arbor' | 'snell';
  /** Pfad in der Adresse */
  slug: string;
  uses: KnotUse[];
  diagram?: KnotDiagramSpec;
}

export const KNOTS: readonly KnotEntry[] = [
  { id: 'clinch', slug: 'clinch', uses: ['attach'], diagram: clinchDiagram },
  { id: 'palomar', slug: 'palomar', uses: ['attach'], diagram: palomarDiagram },
  { id: 'uni', slug: 'uni', uses: ['attach'], diagram: uniDiagram },
  { id: 'doubleUni', slug: 'doppelter-uni', uses: ['join'], diagram: doubleUniDiagram },
  { id: 'fg', slug: 'fg', uses: ['join'], diagram: fgDiagram },
  { id: 'surgeon', slug: 'chirurgen', uses: ['join', 'loop'], diagram: surgeonDiagram },
  { id: 'perfection', slug: 'perfection-loop', uses: ['loop'], diagram: perfectionDiagram },
  { id: 'arbor', slug: 'spulenknoten', uses: ['spool'], diagram: arborDiagram },
  { id: 'snell', slug: 'snell', uses: ['attach'], diagram: snellDiagram },
];

export const knotBySlug = (slug: string) => KNOTS.find((k) => k.slug === slug);
