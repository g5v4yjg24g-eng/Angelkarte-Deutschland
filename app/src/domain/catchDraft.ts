// Fangformular ↔ Fangbuch-Eintrag (M5). Das Formular arbeitet mit Texten (Zahlen mit Komma, leere Felder);
// gespeichert wird nur, was CatchSchema akzeptiert – dasselbe Schema wie bei Import und Datenbank.
import type { BaitPreset, Catch, CatchOutcome, Method, BaitType } from './schemas';
import { parseDecimal } from './decimal';
import { normName, presetDetails } from './baitPreset';
import { CatchSchema } from './schemas';
import { localToZonedIso, toZonedIso, DEFAULT_TZ } from './time';

export type ContactDetail = NonNullable<Catch['contactDetail']>;
export type Sky = NonNullable<NonNullable<Catch['conditions']>['sky']>;

export interface CatchDraft {
  outcome: CatchOutcome;
  speciesId: string;
  /** Lokales Datum (JJJJ-MM-TT) und Uhrzeit (HH:MM) in der Zeitzone des Eintrags */
  date: string;
  time: string;
  lengthCm: string;
  lengthMethod: 'measured' | 'estimated';
  weightKg: string;
  weightMethod: 'weighed' | 'estimated';
  released: '' | 'released' | 'kept';
  contactDetail: '' | ContactDetail;
  method: '' | Method;
  baitName: string;
  baitType: '' | BaitType;
  /** gewählter Köder-Favorit; gilt nur, solange der Ködername dazu passt */
  baitPresetId: string;
  sky: '' | Sky;
  airTempC: string;
  waterTempC: string;
  windBft: string;
  notes: string;
}
export type DraftField = keyof CatchDraft;
/** Fehlerart je Feld; die Oberfläche formuliert daraus den Text. */
export type DraftError = 'number' | 'range' | 'date';
export type DraftErrors = Partial<Record<DraftField, DraftError>>;

/** Felder, die das Formular verwaltet (ohne Position, Gewässer, Bezüge). */
export type CatchFormFields = Pick<
  Catch,
  | 'outcome'
  | 'at'
  | 'tz'
  | 'speciesId'
  | 'lengthCm'
  | 'lengthMethod'
  | 'weightG'
  | 'weightMethod'
  | 'released'
  | 'contactDetail'
  | 'method'
  | 'bait'
  | 'baitPresetId'
  | 'conditions'
  | 'notes'
>;

/** Lokales Datum/Uhrzeit aus einem ISO-Zeitpunkt mit Offset (der Offset ist bereits die lokale Zeit). */
function splitIso(iso: string) {
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export function emptyDraft(nowMs: number, tz: string = DEFAULT_TZ): CatchDraft {
  return {
    outcome: 'caught',
    speciesId: '',
    ...splitIso(toZonedIso(nowMs, tz)),
    lengthCm: '',
    lengthMethod: 'measured',
    weightKg: '',
    weightMethod: 'weighed',
    released: '',
    contactDetail: '',
    method: '',
    baitName: '',
    baitType: '',
    baitPresetId: '',
    sky: '',
    airTempC: '',
    waterTempC: '',
    windBft: '',
    notes: '',
  };
}

const num = (n: number | undefined) => (n === undefined ? '' : String(n).replace('.', ','));

export function draftFromCatch(c: Catch): CatchDraft {
  return {
    outcome: c.outcome,
    speciesId: c.speciesId ?? '',
    ...splitIso(c.at),
    lengthCm: num(c.lengthCm),
    lengthMethod: c.lengthMethod ?? (c.outcome === 'caught' ? 'measured' : 'estimated'),
    weightKg: num(c.weightG === undefined ? undefined : c.weightG / 1000),
    weightMethod: c.weightG !== undefined && c.weightMethod !== 'weighed' ? 'estimated' : 'weighed',
    released: c.released ?? '',
    contactDetail: c.contactDetail ?? '',
    method: c.method ?? '',
    baitName: c.bait?.name ?? '',
    baitType: c.bait?.type ?? '',
    baitPresetId: c.baitPresetId ?? '',
    sky: c.conditions?.sky ?? '',
    airTempC: num(c.conditions?.airTempC),
    waterTempC: num(c.conditions?.waterTempC),
    windBft: num(c.conditions?.windBft),
    notes: c.notes ?? '',
  };
}

export { parseDecimal };

const opt = <T extends string>(v: '' | T): T | undefined => (v === '' ? undefined : v);

/** Leere Objekte entfallen, damit kein `bait: {}` gespeichert wird. */
function compact<T extends object>(o: T): T | undefined {
  const entries = Object.entries(o).filter(([, v]) => v !== undefined);
  return entries.length ? (Object.fromEntries(entries) as T) : undefined;
}

// Wohin ein Fehler des Schemas im Formular gehört
const ISSUE_FIELD: Record<string, DraftField> = {
  lengthCm: 'lengthCm',
  weightG: 'weightKg',
  'conditions.airTempC': 'airTempC',
  'conditions.waterTempC': 'waterTempC',
  'conditions.windBft': 'windBft',
  'bait.name': 'baitName',
  notes: 'notes',
  at: 'date',
};

/**
 * Formular → Felder eines Eintrags. `base` ist der bestehende Eintrag beim Bearbeiten: Angaben, die das Formular
 * nicht zeigt (z. B. Köderfarbe aus der Alt-App, Luftdruck), bleiben erhalten.
 */
export function draftToFields(
  d: CatchDraft,
  { tz = DEFAULT_TZ, base, preset }: { tz?: string; base?: Catch; preset?: BaitPreset } = {},
): { fields?: CatchFormFields; errors: DraftErrors } {
  const errors: DraftErrors = {};
  const number = (field: DraftField, scale = 1) => {
    const v = parseDecimal(d[field]);
    if (Number.isNaN(v)) errors[field] = 'number';
    return v === undefined || Number.isNaN(v) ? undefined : Math.round(v * scale * 100) / 100;
  };

  let at: string | undefined;
  try {
    at = localToZonedIso(d.date, d.time, base?.tz ?? tz);
  } catch {
    errors.date = 'date';
  }

  const caught = d.outcome === 'caught';
  // Größe gibt es nur bei Fisch am Haken; gemessen/gewogen nur, wenn er gelandet wurde (CAT-3)
  const sized = caught || d.outcome === 'contact';
  const lengthCm = sized ? number('lengthCm') : undefined;
  const weightG = sized ? number('weightKg', 1000) : undefined;
  const airTempC = number('airTempC');
  const waterTempC = number('waterTempC');
  const windBft = number('windBft');

  const fields: CatchFormFields = {
    outcome: d.outcome,
    at: at ?? '',
    tz: base?.tz ?? tz,
    speciesId: d.outcome === 'missed_bite' ? undefined : opt(d.speciesId),
    lengthCm,
    lengthMethod: lengthCm === undefined ? undefined : caught ? d.lengthMethod : 'estimated',
    weightG,
    weightMethod:
      weightG === undefined
        ? undefined
        : // „berechnet" (z. B. aus der Alt-App) bleibt, solange das Gewicht unverändert ist
          base?.weightMethod === 'calculated' && base.weightG === weightG
          ? 'calculated'
          : caught
            ? d.weightMethod
            : 'estimated',
    released: caught ? opt(d.released) : undefined,
    contactDetail: d.outcome === 'contact' ? opt(d.contactDetail) : undefined,
    method: opt(d.method),
    ...baitFields(d, base, preset),
    conditions: compact({
      ...base?.conditions,
      sky: opt(d.sky),
      airTempC,
      waterTempC,
      windBft,
    }),
    notes: d.notes.trim() || undefined,
  };

  // Wertebereiche prüft das Schema (eine Quelle der Wahrheit); Platzhalter-Metadaten nur für die Prüfung
  const check = CatchSchema.safeParse({
    ...base,
    ...fields,
    id: base?.id ?? 'neu',
    createdAt: base?.createdAt ?? fields.at,
    updatedAt: base?.updatedAt ?? fields.at,
    rev: base?.rev ?? 0,
  });
  if (!check.success)
    for (const issue of check.error.issues) {
      const field = ISSUE_FIELD[issue.path.join('.')];
      if (field && !errors[field]) errors[field] = 'range';
    }

  return Object.keys(errors).length ? { errors } : { fields, errors };
}

const PRESET_DETAIL_KEYS = ['color', 'sizeCm', 'weightG', 'hookSize'] as const;

/**
 * Köder und Favoriten-Bezug. Ein Favorit gilt, solange der Ködername zu ihm passt; dann kommen seine Details
 * (Farbe, Größe, Gewicht, Haken) mit. Wird er abgewählt, fallen seine Details aus dem bestehenden Eintrag weg.
 */
function baitFields(
  d: CatchDraft,
  base?: Catch,
  preset?: BaitPreset,
): Pick<CatchFormFields, 'bait' | 'baitPresetId'> {
  const name = d.baitName.trim() || undefined;
  const matches = (n?: string) => !!name && !!n && normName(n) === normName(name);
  const fromPreset = !!preset && d.baitPresetId === preset.id && matches(preset.bait.name ?? preset.label);
  // Favorit inzwischen gelöscht, Eintrag unverändert: Bezug und Details bleiben
  const kept =
    !fromPreset && !!d.baitPresetId && d.baitPresetId === base?.baitPresetId && matches(base.bait?.name);
  let rest = base?.bait;
  if (base?.baitPresetId && !kept && rest) {
    rest = Object.fromEntries(
      Object.entries(rest).filter(([k]) => !(PRESET_DETAIL_KEYS as readonly string[]).includes(k)),
    ) as NonNullable<Catch['bait']>;
  }
  return {
    bait: compact({
      ...rest,
      ...(fromPreset ? presetDetails(preset.bait) : {}),
      name,
      type: opt(d.baitType),
    }),
    baitPresetId: fromPreset ? preset.id : kept ? d.baitPresetId : undefined,
  };
}

/** Favorit übernehmen: Ködername, -art und (falls hinterlegt) Methode. */
export function applyPreset(d: CatchDraft, p: BaitPreset): CatchDraft {
  return {
    ...d,
    baitPresetId: p.id,
    baitName: p.bait.name ?? p.label,
    baitType: p.bait.type ?? '',
    method: p.method ?? d.method,
  };
}

// ---------- Fangbuch-Liste ----------

export interface CatchFilter {
  text: string;
  outcome: '' | CatchOutcome;
  speciesId: string;
  water: string;
  period: 'all' | '7d' | '30d' | 'year';
}
export const NO_FILTER: CatchFilter = { text: '', outcome: '', speciesId: '', water: '', period: 'all' };

const norm = (s: string) => s.toLocaleLowerCase('de-DE').trim();

/** Gefilterte Einträge, neueste zuerst. `speciesName` liefert den angezeigten Artnamen für die Textsuche. */
export function filterCatches(
  catches: readonly Catch[],
  f: CatchFilter,
  { nowMs, speciesName }: { nowMs: number; speciesName: (id?: string) => string | undefined },
): Catch[] {
  const from =
    f.period === '7d'
      ? nowMs - 7 * 864e5
      : f.period === '30d'
        ? nowMs - 30 * 864e5
        : f.period === 'year'
          ? Date.parse(localToZonedIso(`${toZonedIso(nowMs).slice(0, 4)}-01-01`, '00:00'))
          : -Infinity;
  const q = norm(f.text);
  return catches
    .filter((c) => !c.deletedAt)
    .filter((c) => !f.outcome || c.outcome === f.outcome)
    .filter((c) => !f.speciesId || c.speciesId === f.speciesId)
    .filter((c) => !f.water || c.waterSnapshot?.name === f.water)
    .filter((c) => Date.parse(c.at) >= from)
    .filter(
      (c) =>
        !q ||
        [
          speciesName(c.speciesId),
          c.waterSnapshot?.name,
          c.waterSnapshot?.customName,
          c.waterSnapshot?.place,
          c.bait?.name,
          c.notes,
        ].some((s) => s !== undefined && norm(s).includes(q)),
    )
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/** Nach lokalem Kalendertag gruppiert (Reihenfolge bleibt erhalten). */
export function groupByDay(catches: readonly Catch[]): { day: string; items: Catch[] }[] {
  const groups: { day: string; items: Catch[] }[] = [];
  for (const c of catches) {
    const day = c.at.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last?.day === day) last.items.push(c);
    else groups.push({ day, items: [c] });
  }
  return groups;
}

/** Zuletzt genutzte Arten (für Schnellauswahl), neueste zuerst, ohne Doppelte. */
export function recentSpecies(catches: readonly Catch[], limit = 6): string[] {
  const ids: string[] = [];
  for (const c of [...catches].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)))
    if (!c.deletedAt && c.speciesId && c.speciesId !== 'other' && !ids.includes(c.speciesId)) {
      ids.push(c.speciesId);
      if (ids.length === limit) break;
    }
  return ids;
}

/** Zuletzt genutzte Köder (Name und Art), neueste zuerst, gleiche Namen nur einmal. */
export function recentBaits(catches: readonly Catch[], limit = 5): { name: string; type?: BaitType }[] {
  const out: { name: string; type?: BaitType }[] = [];
  for (const c of [...catches].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))) {
    const name = c.bait?.name?.trim();
    if (c.deletedAt || !name || out.some((b) => norm(b.name) === norm(name))) continue;
    out.push(c.bait?.type ? { name, type: c.bait.type } : { name });
    if (out.length === limit) break;
  }
  return out;
}

/** Namen der Gewässer, an denen es Einträge gibt (für den Filter), alphabetisch. */
export function waterNames(catches: readonly Catch[]): string[] {
  const names = new Set<string>();
  for (const c of catches) if (!c.deletedAt && c.waterSnapshot?.name) names.add(c.waterSnapshot.name);
  return [...names].sort((a, b) => a.localeCompare(b, 'de'));
}
