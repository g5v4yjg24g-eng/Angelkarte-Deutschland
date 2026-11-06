// Kartenfilter (Wunsch Nutzer 2026-11-06, Paket 4): welche eigenen Einträge und geteilten Spots die Karte zeigt.
// Rein, ohne DOM. Gemerkt pro Gerät; fehlt oder ist der Stand kaputt, ist alles an. Öffentliche Community-Einträge
// gibt es auf der Karte (noch) nicht – deshalb auch keinen Schalter dafür.
import type { Catch, CatchOutcome } from './schemas';

export const MAP_LAYER_KEYS = [
  'caught',
  'contact',
  'missed_bite',
  'observation',
  'places',
  'shared',
] as const;
export type MapLayerKey = (typeof MAP_LAYER_KEYS)[number];
export type MapFilter = Readonly<Record<MapLayerKey, boolean>>;

export const ALL_LAYERS: MapFilter = {
  caught: true,
  contact: true,
  missed_bite: true,
  observation: true,
  places: true,
  shared: true,
};

/** Gespeicherten Stand lesen; unbekannte Schlüssel fallen weg, fehlende sind an */
export function parseMapFilter(raw: string | null | undefined): MapFilter {
  if (!raw) return ALL_LAYERS;
  try {
    const v = JSON.parse(raw) as unknown;
    if (!v || typeof v !== 'object') return ALL_LAYERS;
    const out: Record<MapLayerKey, boolean> = { ...ALL_LAYERS };
    for (const k of MAP_LAYER_KEYS) {
      const x = (v as Record<string, unknown>)[k];
      if (typeof x === 'boolean') out[k] = x;
    }
    return out;
  } catch {
    return ALL_LAYERS;
  }
}

/** Ist etwas ausgeblendet? (für den Hinweis am Knopf) */
export const isFiltered = (f: MapFilter): boolean => MAP_LAYER_KEYS.some((k) => !f[k]);

/**
 * Fänge für die Karte: nur sichtbare Arten. `keep` (z. B. der Fang, zu dem das Fangbuch springt) bleibt immer
 * sichtbar, sonst fände man ihn nicht. Bei eingeschalteter Heatmap zählen die gelandeten Fische immer mit.
 */
export function visibleCatches<C extends Pick<Catch, 'id' | 'outcome'>>(
  catches: readonly C[],
  f: MapFilter,
  opts: { keep?: string | undefined; heat?: boolean } = {},
): C[] {
  return catches.filter(
    (c) =>
      c.id === opts.keep || f[c.outcome as CatchOutcome] || (opts.heat === true && c.outcome === 'caught'),
  );
}
