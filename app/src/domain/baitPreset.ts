// Köder-Favoriten (DATA_MODEL §5.5): gespeicherte Köder mit Details, im Fangformular mit einem Tipp übernommen.
// Rein: Formular ↔ Favorit, Prüfung über dasselbe Schema wie Datenbank und Import.
import { BaitPresetSchema, type BaitPreset, type BaitType, type Catch, type Method } from './schemas';
import { parseDecimal } from './decimal';

export interface PresetDraft {
  name: string;
  type: '' | BaitType;
  color: string;
  sizeCm: string;
  weightG: string;
  hookSize: string;
  method: '' | Method;
}
export type PresetField = keyof PresetDraft;
export type PresetError = 'required' | 'number' | 'range' | 'duplicate';
export type PresetErrors = Partial<Record<PresetField, PresetError>>;
export type PresetFields = Pick<BaitPreset, 'label' | 'bait' | 'method'>;

export const emptyPresetDraft = (): PresetDraft => ({
  name: '',
  type: '',
  color: '',
  sizeCm: '',
  weightG: '',
  hookSize: '',
  method: '',
});

const num = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','));

export function presetDraftFrom(p: BaitPreset): PresetDraft {
  return {
    name: p.bait.name ?? p.label,
    type: p.bait.type ?? '',
    color: p.bait.color ?? '',
    sizeCm: num(p.bait.sizeCm),
    weightG: num(p.bait.weightG),
    hookSize: p.bait.hookSize ?? '',
    method: p.method ?? '',
  };
}

export const normName = (s: string) => s.trim().toLocaleLowerCase('de-DE').replace(/\s+/g, ' ');

/** Favoriten zum Anzeigen: ohne gelöschte, alphabetisch. */
export function sortPresets(presets: readonly BaitPreset[]): BaitPreset[] {
  return presets
    .filter((p) => !p.deletedAt)
    .sort((a, b) => a.label.localeCompare(b.label, 'de', { sensitivity: 'base' }));
}

/** Favorit mit diesem Namen (Groß-/Kleinschreibung und Leerzeichen egal). */
export function presetByName(presets: readonly BaitPreset[], name: string): BaitPreset | undefined {
  const n = normName(name);
  return n ? presets.find((p) => !p.deletedAt && normName(p.label) === n) : undefined;
}

const ISSUE_FIELD: Record<string, PresetField> = {
  label: 'name',
  'bait.name': 'name',
  'bait.color': 'color',
  'bait.sizeCm': 'sizeCm',
  'bait.weightG': 'weightG',
  'bait.hookSize': 'hookSize',
};

/**
 * Formular → Felder eines Favoriten. Der Name ist zugleich Bezeichnung und Ködername. `others` sind die übrigen
 * Favoriten (für die Prüfung auf doppelte Namen).
 */
export function presetDraftToFields(
  d: PresetDraft,
  others: readonly BaitPreset[] = [],
): { fields?: PresetFields; errors: PresetErrors } {
  const errors: PresetErrors = {};
  const name = d.name.trim().replace(/\s+/g, ' ');
  if (!name) errors.name = 'required';
  else if (presetByName(others, name)) errors.name = 'duplicate';
  const sizeCm = parseDecimal(d.sizeCm);
  const weightG = parseDecimal(d.weightG);
  if (Number.isNaN(sizeCm)) errors.sizeCm = 'number';
  if (Number.isNaN(weightG)) errors.weightG = 'number';
  if (Object.keys(errors).length) return { errors };

  const bait = Object.fromEntries(
    Object.entries({
      name,
      type: d.type || undefined,
      color: d.color.trim() || undefined,
      sizeCm,
      weightG,
      hookSize: d.hookSize.trim() || undefined,
    }).filter(([, v]) => v !== undefined),
  ) as BaitPreset['bait'];
  const fields: PresetFields = { label: name, bait, ...(d.method ? { method: d.method } : {}) };
  const now = '2000-01-01T00:00:00Z';
  const check = BaitPresetSchema.safeParse({ ...fields, id: 'x', createdAt: now, updatedAt: now, rev: 0 });
  if (!check.success) {
    for (const i of check.error.issues) {
      const f = ISSUE_FIELD[i.path.join('.')];
      if (f) errors[f] ??= 'range';
    }
    return { errors: Object.keys(errors).length ? errors : { name: 'range' } };
  }
  return { fields, errors };
}

/** Details eines Favoriten, die das Fangformular nicht selbst zeigt (Farbe, Größe, Gewicht, Haken). */
export function presetDetails(bait: BaitPreset['bait']): NonNullable<Catch['bait']> {
  const { color, sizeCm, weightG, hookSize } = bait;
  return Object.fromEntries(
    Object.entries({ color, sizeCm, weightG, hookSize }).filter(([, v]) => v !== undefined),
  ) as NonNullable<Catch['bait']>;
}
