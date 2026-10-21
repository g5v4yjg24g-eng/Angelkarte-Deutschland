// Basiskarte deutsch beschriften: OpenMapTiles-Stile nutzen oft name:latin/name_en.
// Ersetzt in Beschriftungen jeden Bezug auf einen Namen durch name:de → name (Ortsname vor Ort).
import type { ExpressionSpecification } from 'maplibre-gl';

const GERMAN: ExpressionSpecification = ['coalesce', ['get', 'name:de'], ['get', 'name']];
const NAME_KEYS = /^(name|name_en|name_int|name:latin|name:en|name:nonlatin)$/;

function usesName(v: unknown): boolean {
  if (typeof v === 'string') return /\{(name[^}]*)\}/.test(v);
  if (Array.isArray(v)) {
    if (v[0] === 'get' && typeof v[1] === 'string' && NAME_KEYS.test(v[1])) return true;
    return v.some(usesName);
  }
  return false;
}

/** Liefert für jede Symbolebene mit Namensbeschriftung die neue text-field-Angabe. */
export function germanTextFields(layers: { id: string; type: string; layout?: Record<string, unknown> }[]) {
  return layers
    .filter((l) => l.type === 'symbol' && usesName(l.layout?.['text-field']))
    .map((l) => ({ id: l.id, textField: GERMAN }));
}
