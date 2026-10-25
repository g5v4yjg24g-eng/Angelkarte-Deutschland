// Landesrecht (DATA_MODEL §7, DATA_SOURCES §5). Jede Regel nennt ihren Paragrafen (basisRef) und die
// Rechtsgrundlage (basisId → legalBasis). Die App rechnet keine „strengere" Regel aus und blockiert nichts.
import { z } from 'zod';
import { STATE_CODES, type StateCode } from './water';
import { speciesById } from './species';
import { toZonedIso } from './time';
import { normalize } from './search';

export const STALE_DAYS = 180;
export const OUTDATED_DAYS = 365;

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const MonthDaySchema = z
  .object({ month: z.number().int().min(1).max(12), day: z.number().int().min(1).max(31) })
  .refine((d) => d.day <= (DAYS_IN_MONTH[d.month - 1] ?? 0), {
    message: 'Tag gibt es in diesem Monat nicht',
  });
export type MonthDay = z.infer<typeof MonthDaySchema>;

const Basis = { basisId: z.string().min(1), basisRef: z.string().trim().min(1) };
const speciesKnown = (id: string) => speciesById(id) !== undefined;
const SpeciesId = z.string().refine(speciesKnown, { message: 'Art fehlt in domain/species.ts' });
/**
 * Art so, wie sie im Rechtstext steht (deutsch, wissenschaftlich). `speciesId` verknüpft mit der Fangbuch-Art,
 * nur wenn die Zuordnung eindeutig ist (deutscher Name oder dokumentiertes Synonym) – sonst weglassen.
 */
const SpeciesRef = {
  taxon: z.object({ de: z.string().trim().min(1), sci: z.string().trim().min(1).optional() }),
  speciesId: SpeciesId.optional(),
};

const ClosedSeasonSchema = z.object({
  ...SpeciesRef,
  from: MonthDaySchema,
  /** einschließlich; jahresübergreifend erlaubt (from > to) */
  to: MonthDaySchema,
  scope: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
  ...Basis,
});
export type ClosedSeasonRule = z.infer<typeof ClosedSeasonSchema>;

const MinSizeSchema = z.object({
  ...SpeciesRef,
  minCm: z.number().positive().max(300).optional(),
  /** oberes Maß eines Entnahmefensters */
  maxCm: z.number().positive().max(400).optional(),
  /** Tageshöchstfangmenge (Stück) */
  dailyLimit: z.number().int().positive().optional(),
  scope: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
  ...Basis,
});
export type MinSizeRule = z.infer<typeof MinSizeSchema>;
const MinSizeChecked = MinSizeSchema.refine(
  (r) => r.minCm !== undefined || r.maxCm !== undefined || r.dailyLimit !== undefined,
  { message: 'Maß oder Fangmenge fehlt' },
).refine((r) => r.minCm === undefined || r.maxCm === undefined || r.minCm < r.maxCm, {
  message: 'unteres Maß muss kleiner als oberes sein',
});

const ProtectedSchema = z.object({
  ...SpeciesRef,
  scope: z.string().min(1).optional(),
  note: z.string().min(1).optional(),
  ...Basis,
});
const LicenceSchema = z.object({
  kind: z.enum(['fishing_licence', 'permit', 'levy', 'youth', 'tourist']),
  text: z.string().min(1),
  ...Basis,
});
const OtherRuleSchema = z.object({ topic: z.string().min(1), text: z.string().min(1), ...Basis });

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Datum als JJJJ-MM-TT');

export const LegalBasisSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  /** Fassung, z. B. „gültig ab 03.07.2026" */
  version: z.string().min(1),
  url: z.url({ protocol: /^https$/ }),
  retrievedAt: IsoDate,
});

export const RegulationSetSchema = z
  .object({
    stateCode: z.enum(STATE_CODES),
    status: z.enum(['verified', 'partial', 'draft']),
    missing: z.array(z.string().min(1)).optional(),
    checkedAt: IsoDate,
    checkedBy: z.string().min(1),
    legalBasis: z.array(LegalBasisSchema).min(1),
    closedSeasons: z.array(ClosedSeasonSchema),
    minSizes: z.array(MinSizeChecked),
    protectedSpecies: z.array(ProtectedSchema),
    licences: z.array(LicenceSchema),
    otherRules: z.array(OtherRuleSchema),
  })
  .superRefine((set, ctx) => {
    const ids = new Set(set.legalBasis.map((b) => b.id));
    if (ids.size !== set.legalBasis.length)
      ctx.addIssue({ code: 'custom', path: ['legalBasis'], message: 'doppelte id' });
    const lists = ['closedSeasons', 'minSizes', 'protectedSpecies', 'licences', 'otherRules'] as const;
    for (const key of lists)
      set[key].forEach((rule, i) => {
        if (!ids.has(rule.basisId))
          ctx.addIssue({
            code: 'custom',
            path: [key, i, 'basisId'],
            message: `unbekannte Rechtsgrundlage „${rule.basisId}"`,
          });
      });
    if (set.status === 'partial' && !set.missing?.length)
      ctx.addIssue({
        code: 'custom',
        path: ['missing'],
        message: 'Status partial braucht die Liste fehlender Teile',
      });
    if (set.status === 'verified' && set.missing?.length)
      ctx.addIssue({
        code: 'custom',
        path: ['missing'],
        message: 'Status verified darf nichts als fehlend führen',
      });
  });
export type RegulationSet = z.infer<typeof RegulationSetSchema>;

/** Nur geprüfte oder ausdrücklich teilweise geprüfte Daten werden gezeigt; Entwürfe nie. */
export const isShown = (set: RegulationSet) => set.status !== 'draft';

const key = (d: MonthDay) => d.month * 100 + d.day;

/** Liegt der Tag in der Schonzeit (Grenzen eingeschlossen, auch über den Jahreswechsel)? */
export function inClosedSeason(rule: Pick<ClosedSeasonRule, 'from' | 'to'>, day: MonthDay): boolean {
  const k = key(day);
  const f = key(rule.from);
  const t = key(rule.to);
  return f <= t ? k >= f && k <= t : k >= f || k <= t;
}

/** Kalendertag in deutscher Zeit. */
export function berlinDay(ms: number): MonthDay {
  const iso = toZonedIso(ms);
  return { month: Number(iso.slice(5, 7)), day: Number(iso.slice(8, 10)) };
}

export type Freshness = 'current' | 'stale' | 'outdated';

/** Ab 180 Tagen nach der letzten Prüfung „möglicherweise veraltet", ab 365 „veraltet" (DATA_SOURCES §5.3). */
export function freshness(checkedAt: string, nowMs: number): Freshness {
  const days = (nowMs - Date.parse(`${checkedAt}T00:00:00Z`)) / 864e5;
  if (days > OUTDATED_DAYS) return 'outdated';
  if (days > STALE_DAYS) return 'stale';
  return 'current';
}

/** Schonzeiten einer Art, die an diesem Tag gelten (mit Geltungsbereich, falls angegeben). */
export function closedSeasonsOn(set: RegulationSet, speciesId: string, day: MonthDay): ClosedSeasonRule[] {
  return set.closedSeasons.filter((r) => r.speciesId === speciesId && inClosedSeason(r, day));
}

/** Anzeigename einer Regel-Art: immer der Name aus dem Rechtstext. */
export function taxonLabel(r: { taxon: { de: string; sci?: string | undefined } }): string {
  return r.taxon.de;
}

type SpeciesRule = { taxon: { de: string; sci?: string | undefined }; speciesId?: string | undefined };

/** Gleiche Art über Listen hinweg: Fangbuch-Art, sonst der Name aus dem Rechtstext. */
const speciesKey = (r: SpeciesRule) => r.speciesId ?? normalize(r.taxon.de);

/** Passt die Suche zur Art? Name im Rechtstext, wissenschaftlicher Name, Fangbuch-Name und Synonyme. */
export function matchesSpecies(r: SpeciesRule, query: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const sp = r.speciesId ? speciesById(r.speciesId) : undefined;
  const names = [r.taxon.de, r.taxon.sci, sp?.de, sp?.sci, ...(sp?.aliases ?? [])];
  return names.some((n) => n !== undefined && normalize(n).includes(q));
}

export interface SpeciesFilter {
  query: string;
  /** nur Arten, die an diesem Tag Schonzeit haben (dazu ganzjährig geschonte) */
  closedOn?: MonthDay | undefined;
}

export type FilteredSpeciesRules = Pick<RegulationSet, 'closedSeasons' | 'minSizes' | 'protectedSpecies'>;

/**
 * Artbezogene Regeln nach Suche und „nur Schonzeit“ filtern. Bei „nur Schonzeit“ bleiben die Schonzeiten des Tages,
 * die Maße derselben Arten und die ganzjährig geschonten Arten.
 */
export function filterSpeciesRules(set: RegulationSet, f: SpeciesFilter): FilteredSpeciesRules {
  const hit = (r: SpeciesRule) => matchesSpecies(r, f.query);
  if (!f.closedOn)
    return {
      closedSeasons: set.closedSeasons.filter(hit),
      minSizes: set.minSizes.filter(hit),
      protectedSpecies: set.protectedSpecies.filter(hit),
    };
  const day = f.closedOn;
  const closedSeasons = set.closedSeasons.filter((r) => inClosedSeason(r, day) && hit(r));
  const closed = new Set(closedSeasons.map(speciesKey));
  return {
    closedSeasons,
    minSizes: set.minSizes.filter((r) => closed.has(speciesKey(r))),
    protectedSpecies: set.protectedSpecies.filter(hit),
  };
}

export function isStateCode(s: string): s is StateCode {
  return (STATE_CODES as readonly string[]).includes(s);
}

/** Einstiegspunkte der Landesrechtsportale (DATA_SOURCES §5.2) – nur als Link, nicht als Quelle einer Regel. */
export const STATE_PORTALS: Record<StateCode, string> = {
  BW: 'https://landesrecht-bw.de/',
  BY: 'https://www.gesetze-bayern.de/',
  BE: 'https://gesetze.berlin.de/',
  BB: 'https://bravors.brandenburg.de/',
  HB: 'https://www.transparenz.bremen.de/',
  HH: 'https://landesrecht-hamburg.de/',
  HE: 'https://rv.hessenrecht.hessen.de/',
  MV: 'https://landesrecht-mv.de/',
  NI: 'https://voris.wolterskluwer-online.de/',
  NW: 'https://recht.nrw.de/',
  RP: 'https://landesrecht.rlp.de/',
  SL: 'https://recht.saarland.de/',
  SN: 'https://revosax.sachsen.de/',
  ST: 'https://landesrecht.sachsen-anhalt.de/',
  SH: 'https://gesetze-rechtsprechung.sh.juris.de/',
  TH: 'https://landesrecht.thueringen.de/',
};
