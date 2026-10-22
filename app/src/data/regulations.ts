// Landesdateien aus app/data/regulations: werden als eigene JS-Chunks mitgebaut (Precache-Muster **/*.js;
// offline noch ohne E2E-Beleg). Jede Datei wird vor der Anzeige gegen das Schema geprüft; Entwürfe gelten als
// „keine Angaben" – außer in der Prüfansicht (`includeDraft`), die nur für die Gegenprüfung gedacht ist.
import { isShown, RegulationSetSchema, type RegulationSet } from '../domain/regulations';
import type { StateCode } from '../domain/water';

// Ohne Typparameter: mit `glob<…>(` erkennt Vite den Aufruf nicht und liefert {}.
const files: Record<string, () => Promise<unknown>> = import.meta.glob('../../data/regulations/*.json', {
  import: 'default',
});

export const regulationFileFor = (code: StateCode) => `../../data/regulations/${code}.json`;

export type RegulationResult =
  { kind: 'ok'; set: RegulationSet } | { kind: 'none' } | { kind: 'invalid' } | { kind: 'error' };

export async function loadRegulation(
  code: StateCode,
  { includeDraft = false }: { includeDraft?: boolean } = {},
): Promise<RegulationResult> {
  const load = files[regulationFileFor(code)];
  if (!load) return { kind: 'none' };
  try {
    const r = RegulationSetSchema.safeParse(await load());
    if (!r.success || r.data.stateCode !== code) return { kind: 'invalid' };
    return isShown(r.data) || includeDraft ? { kind: 'ok', set: r.data } : { kind: 'none' };
  } catch {
    return { kind: 'error' };
  }
}
