// Landesdateien aus app/data/regulations: werden mitgebaut (Precache), also offline verfügbar.
// Jede Datei wird vor der Anzeige gegen das Schema geprüft; Entwürfe gelten als „keine Angaben".
import { isShown, RegulationSetSchema, type RegulationSet } from '../domain/regulations';
import type { StateCode } from '../domain/water';

const files = import.meta.glob<unknown>('../../data/regulations/*.json', { import: 'default' });

export const regulationFileFor = (code: StateCode) => `../../data/regulations/${code}.json`;

export type RegulationResult =
  { kind: 'ok'; set: RegulationSet } | { kind: 'none' } | { kind: 'invalid' } | { kind: 'error' };

export async function loadRegulation(code: StateCode): Promise<RegulationResult> {
  const load = files[regulationFileFor(code)];
  if (!load) return { kind: 'none' };
  try {
    const r = RegulationSetSchema.safeParse(await load());
    if (!r.success || r.data.stateCode !== code) return { kind: 'invalid' };
    return isShown(r.data) ? { kind: 'ok', set: r.data } : { kind: 'none' };
  } catch {
    return { kind: 'error' };
  }
}
