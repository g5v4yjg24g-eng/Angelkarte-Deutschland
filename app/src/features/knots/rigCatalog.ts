// Montagen-Katalog (Wunsch Nutzer 2026-10-27): acht gängige Montagen mit Einsatzzweck, alle animiert.
// Texte in i18n/de.ts (rigs.items), Zeichnungen in rigDiagrams.ts. Inhalte sind redaktionell (Prüfung offen, PLAN.md).
import type { RigDiagramSpec } from '../../domain/rigs';
import type { KnotEntry } from './catalog';
import {
  carolinaDiagram,
  dropShotDiagram,
  fixedFloatDiagram,
  freeRigDiagram,
  hairRigDiagram,
  runningLedgerDiagram,
  slidingFloatDiagram,
  texasDiagram,
} from './rigDiagrams';

export type RigMethod = 'spin' | 'bottom' | 'float';
export const RIG_METHODS: readonly RigMethod[] = ['spin', 'bottom', 'float'];

export interface RigEntry {
  id:
    | 'carolina'
    | 'texas'
    | 'dropShot'
    | 'freeRig'
    | 'runningLedger'
    | 'fixedFloat'
    | 'slidingFloat'
    | 'hairRig';
  /** Pfad in der Adresse */
  slug: string;
  method: RigMethod;
  /** passende Knoten aus dem Knoten-Katalog */
  knots: KnotEntry['id'][];
  diagram: RigDiagramSpec;
}

export const RIGS: readonly RigEntry[] = [
  {
    id: 'carolina',
    slug: 'carolina-rig',
    method: 'spin',
    knots: ['clinch', 'palomar'],
    diagram: carolinaDiagram,
  },
  { id: 'texas', slug: 'texas-rig', method: 'spin', knots: ['palomar'], diagram: texasDiagram },
  { id: 'dropShot', slug: 'drop-shot', method: 'spin', knots: ['palomar'], diagram: dropShotDiagram },
  { id: 'freeRig', slug: 'free-rig', method: 'spin', knots: ['palomar', 'uni'], diagram: freeRigDiagram },
  {
    id: 'runningLedger',
    slug: 'laufblei',
    method: 'bottom',
    knots: ['clinch', 'uni'],
    diagram: runningLedgerDiagram,
  },
  { id: 'hairRig', slug: 'haar-montage', method: 'bottom', knots: [], diagram: hairRigDiagram },
  {
    id: 'fixedFloat',
    slug: 'feste-pose',
    method: 'float',
    knots: ['perfection'],
    diagram: fixedFloatDiagram,
  },
  {
    id: 'slidingFloat',
    slug: 'laufpose',
    method: 'float',
    knots: ['clinch', 'uni'],
    diagram: slidingFloatDiagram,
  },
];

export const rigBySlug = (slug: string) => RIGS.find((r) => r.slug === slug);
