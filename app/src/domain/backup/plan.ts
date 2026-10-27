// Import-Plan: vergleicht eingehende mit vorhandenen Datensätzen (TEST_PLAN BAK-3).
import type { EntityTable } from '../schemas';
import type { Records } from './parse';

export type ImportStrategy = 'keepNewer' | 'fileWins' | 'onlyNew';
export type PlanTable = EntityTable | 'photos';
export const PLAN_TABLES: PlanTable[] = [
  'sessions',
  'places',
  'baitPresets',
  'catches',
  'trips',
  'tracks',
  'waterLinks',
  'profiles',
  'posts',
  'photos',
];

interface Row {
  id: string;
  updatedAt: string;
}

export interface TablePlan<T extends Row = Row> {
  added: T[];
  identical: number;
  /** gleiche ID, Datei neuer */
  incomingNewer: T[];
  /** gleiche ID, Gerät neuer oder gleich alt aber verschieden */
  existingNewer: T[];
}
export type ImportPlan = Record<PlanTable, TablePlan>;

/** JSON mit sortierten Schlüsseln, damit gleiche Inhalte gleich verglichen werden. */
export function stableStringify(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(',')}]`;
  if (v && typeof v === 'object' && !(v instanceof Blob))
    return `{${Object.keys(v)
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  if (v instanceof Blob) return `"blob:${v.size}:${v.type}"`;
  return JSON.stringify(v);
}

export function planImport(incoming: Records, existing: { [K in PlanTable]: Map<string, Row> }): ImportPlan {
  const plan = {} as ImportPlan;
  for (const table of PLAN_TABLES) {
    const t: TablePlan = { added: [], identical: 0, incomingNewer: [], existingNewer: [] };
    for (const rec of incoming[table] as Row[]) {
      const cur = existing[table].get(rec.id);
      if (!cur) t.added.push(rec);
      else if (stableStringify(cur) === stableStringify(rec)) t.identical++;
      else if (Date.parse(rec.updatedAt) > Date.parse(cur.updatedAt)) t.incomingNewer.push(rec);
      else t.existingNewer.push(rec);
    }
    plan[table] = t;
  }
  return plan;
}

/** Welche Datensätze bei einer Strategie geschrieben werden. */
export function selectWrites(plan: ImportPlan, strategy: ImportStrategy): Record<PlanTable, Row[]> {
  const out = {} as Record<PlanTable, Row[]>;
  for (const table of PLAN_TABLES) {
    const t = plan[table];
    out[table] =
      strategy === 'onlyNew'
        ? t.added
        : strategy === 'keepNewer'
          ? [...t.added, ...t.incomingNewer]
          : [...t.added, ...t.incomingNewer, ...t.existingNewer];
  }
  return out;
}

export function summarize(plan: ImportPlan) {
  let added = 0,
    identical = 0,
    incomingNewer = 0,
    existingNewer = 0;
  for (const t of PLAN_TABLES) {
    added += plan[t].added.length;
    identical += plan[t].identical;
    incomingNewer += plan[t].incomingNewer.length;
    existingNewer += plan[t].existingNewer.length;
  }
  return { added, identical, incomingNewer, existingNewer, conflicts: incomingNewer + existingNewer };
}
