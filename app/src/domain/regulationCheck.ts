// Rechts-Warnung beim Erfassen (PLAN §3 „Vorgemerkt", Entscheidung Nutzer 2026-10-22): Darf der Fisch im
// Bundesland des Fangorts entnommen werden? Warnt nur, blockiert nie, rechnet keine „strengere" Regel aus.
import type { Catch } from './schemas';
import {
  berlinDay,
  inClosedSeason,
  isShown,
  type ClosedSeasonRule,
  type MinSizeRule,
  type RegulationSet,
} from './regulations';
import type { StateCode } from './water';

type Protected = RegulationSet['protectedSpecies'][number];

export type Finding =
  | { kind: 'closed'; rule: ClosedSeasonRule }
  | { kind: 'protected'; rule: Protected }
  | { kind: 'undersize'; rule: MinSizeRule; lengthCm: number }
  | { kind: 'oversize'; rule: MinSizeRule; lengthCm: number }
  /** Maß gilt, aber keine Länge erfasst */
  | { kind: 'needsLength'; rule: MinSizeRule };

export type LawCheck =
  /** nur gelandete Fische mit Art werden geprüft */
  | { status: 'notApplicable' }
  | { status: 'noState' }
  /** Grenznähe: Nutzer wählt das Land */
  | { status: 'chooseState'; candidates: StateCode[] }
  /** keine (sichtbaren) Daten für dieses Land → „keine Prüfung möglich" */
  | { status: 'noData'; state: StateCode }
  | {
      status: 'checked';
      state: StateCode;
      set: RegulationSet;
      /** Verstöße und Hinweise; leer = nach den erfassten Landesregeln nichts gefunden */
      findings: Finding[];
      /** Länge nur geschätzt → Maß-Befunde als Hinweis lesen */
      estimated: boolean;
      released: boolean;
    };

export type StateResolution =
  | { kind: 'state'; code: StateCode }
  | { kind: 'border'; codes: StateCode[] }
  | { kind: 'outside' }
  | { kind: 'unknown' };

type CatchInput = Pick<Catch, 'outcome' | 'speciesId' | 'at' | 'lengthCm' | 'lengthMethod' | 'released'>;

/** Befunde zu einer Art an einem Tag mit einer Länge (rein; `set` ist die Landesdatei). */
export function findings(set: RegulationSet, c: CatchInput): Finding[] {
  const id = c.speciesId;
  if (!id) return [];
  const day = berlinDay(Date.parse(c.at));
  const out: Finding[] = [];
  for (const rule of set.protectedSpecies) if (rule.speciesId === id) out.push({ kind: 'protected', rule });
  for (const rule of set.closedSeasons)
    if (rule.speciesId === id && inClosedSeason(rule, day)) out.push({ kind: 'closed', rule });
  for (const rule of set.minSizes) {
    if (rule.speciesId !== id || (rule.minCm === undefined && rule.maxCm === undefined)) continue;
    const len = c.lengthCm;
    if (len === undefined) out.push({ kind: 'needsLength', rule });
    else if (rule.minCm !== undefined && len < rule.minCm)
      out.push({ kind: 'undersize', rule, lengthCm: len });
    else if (rule.maxCm !== undefined && len > rule.maxCm)
      out.push({ kind: 'oversize', rule, lengthCm: len });
  }
  return out;
}

/**
 * Prüfung eines Eintrags. `state` kommt aus der Fangposition (Landesgrenzen) oder der Wahl des Nutzers,
 * `regulation` ist die Landesdatei (undefined = keine).
 */
export function checkCatch(
  c: CatchInput,
  state: StateResolution,
  regulation: RegulationSet | undefined,
): LawCheck {
  if (c.outcome !== 'caught' || !c.speciesId || c.speciesId === 'other') return { status: 'notApplicable' };
  if (state.kind === 'border') return { status: 'chooseState', candidates: state.codes };
  if (state.kind !== 'state') return { status: 'noState' };
  if (!regulation || !isShown(regulation)) return { status: 'noData', state: state.code };
  return {
    status: 'checked',
    state: state.code,
    set: regulation,
    findings: findings(regulation, c),
    estimated: c.lengthCm !== undefined && c.lengthMethod !== 'measured',
    released: c.released === 'released',
  };
}

/** Echte Verstöße (ohne „Länge fehlt"). */
export const violations = (fs: readonly Finding[]) => fs.filter((f) => f.kind !== 'needsLength');
