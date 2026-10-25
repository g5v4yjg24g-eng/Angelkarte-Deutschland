// Knoten-Katalog (Wunsch Nutzer 2026-10-25, Pilot: drei animierte Knoten). Texte in i18n/de.ts (knots.items),
// Zeichnungen in diagrams.ts. Inhalte sind redaktionell (Gegenprüfung durch den Nutzer, siehe PLAN.md).
import type { KnotDiagramSpec } from '../../domain/knots';
import { clinchDiagram, palomarDiagram, uniDiagram } from './diagrams';

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
  { id: 'doubleUni', slug: 'doppelter-uni', uses: ['join'] },
  { id: 'fg', slug: 'fg', uses: ['join'] },
  { id: 'surgeon', slug: 'chirurgen', uses: ['join', 'loop'] },
  { id: 'perfection', slug: 'perfection-loop', uses: ['loop'] },
  { id: 'arbor', slug: 'spulenknoten', uses: ['spool'] },
  { id: 'snell', slug: 'snell', uses: ['attach'] },
];

export const knotBySlug = (slug: string) => KNOTS.find((k) => k.slug === slug);
