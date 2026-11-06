// Erfolge (Paket 6, Wunsch Nutzer 2026-11-06; Stufen Bronze/Silber/Gold und Variante A freigegeben): aus dem
// Fangbuch auf dem Gerät berechnet. Rein, ohne DB. Variante A: Eine erreichte Stufe bleibt, auch wenn später
// Einträge gelöscht werden. Gegen Mogeln zählen nur Fänge, die mindestens einen Tag im Fangbuch stehen.
import type { Catch, Session } from './schemas';

export const TIERS = ['bronze', 'silver', 'gold'] as const;
export type Tier = (typeof TIERS)[number];

export const FAMILIES = [
  { id: 'catches', steps: [10, 50, 100] },
  { id: 'species', steps: [5, 10, 15] },
  { id: 'waters', steps: [3, 10, 25] },
  { id: 'sessions', steps: [5, 25, 50] },
  { id: 'pike', steps: [1, 10, 25] },
  { id: 'zander', steps: [1, 10, 25] },
  { id: 'big', steps: [60, 80, 100] },
] as const satisfies readonly { id: string; steps: readonly [number, number, number] }[];
export type FamilyId = (typeof FAMILIES)[number]['id'];

/** „Erster Fang“ als Start-Abzeichen (eine Stufe) */
export const FIRST_KEY = 'first';
export const TOTAL_STEPS = FAMILIES.length * TIERS.length + 1;
/** Fänge zählen erst nach einem Tag im Fangbuch */
export const MIN_AGE_MS = 24 * 60 * 60 * 1000;

export type Values = Readonly<Record<FamilyId, number>>;
export interface Progress {
  first: boolean;
  values: Values;
}

/** Stufen-Schlüssel, z. B. „catches:silver“ */
export const tierKey = (f: FamilyId, t: Tier) => `${f}:${t}`;
/** gespeicherte Stufen → Datum der Freischaltung (ISO) */
export type Unlocked = Readonly<Record<string, string>>;

const sure = (c: Pick<Catch, 'speciesId' | 'speciesCertainty'>) =>
  !!c.speciesId && c.speciesCertainty !== 'guess';

/** Stand aus Fangbuch und Sessions */
export function progressFrom(
  catches: readonly Pick<
    Catch,
    | 'outcome'
    | 'deletedAt'
    | 'createdAt'
    | 'speciesId'
    | 'speciesCertainty'
    | 'waterId'
    | 'lengthCm'
    | 'lengthMethod'
  >[],
  sessions: readonly Pick<Session, 'endAt' | 'deletedAt'>[],
  nowMs: number,
): Progress {
  const landed = catches.filter(
    (c) => c.outcome === 'caught' && !c.deletedAt && nowMs - Date.parse(c.createdAt) >= MIN_AGE_MS,
  );
  const species = new Set(landed.filter(sure).map((c) => c.speciesId));
  const waters = new Set(landed.map((c) => c.waterId).filter((w): w is string => !!w));
  const measured = landed.filter((c) => c.lengthMethod === 'measured' && typeof c.lengthCm === 'number');
  const values: Record<FamilyId, number> = {
    catches: landed.length,
    species: species.size,
    waters: waters.size,
    sessions: sessions.filter((s) => !s.deletedAt && !!s.endAt).length,
    pike: landed.filter((c) => sure(c) && c.speciesId === 'pike').length,
    zander: landed.filter((c) => sure(c) && c.speciesId === 'zander').length,
    big: measured.reduce((m, c) => Math.max(m, c.lengthCm ?? 0), 0),
  };
  return { first: landed.length > 0, values };
}

/** Erreichte Stufe für einen Wert (ohne gespeicherten Stand) */
export function tierFor(f: FamilyId, value: number): Tier | undefined {
  const fam = FAMILIES.find((x) => x.id === f);
  if (!fam) return undefined;
  let tier: Tier | undefined;
  TIERS.forEach((t, i) => {
    if (value >= (fam.steps[i] ?? Infinity)) tier = t;
  });
  return tier;
}

/** Alle Schlüssel, die der Stand gerade erreicht */
export function reachedKeys(p: Progress): string[] {
  const keys = p.first ? [FIRST_KEY] : [];
  for (const f of FAMILIES) {
    TIERS.forEach((t, i) => {
      if (p.values[f.id] >= (f.steps[i] ?? Infinity)) keys.push(tierKey(f.id, t));
    });
  }
  return keys;
}

/**
 * Neue Stufen dazunehmen, nie welche entfernen (Variante A). Beim allerersten Abgleich (`stored` fehlt) werden
 * schon erreichte Stufen still übernommen – kein Hinweis-Schwall für bestehende Fangbücher.
 */
export function mergeUnlocked(
  stored: Unlocked | undefined,
  p: Progress,
  nowIso: string,
): { next: Unlocked; fresh: string[] } {
  const next: Record<string, string> = { ...(stored ?? {}) };
  const fresh: string[] = [];
  for (const k of reachedKeys(p)) {
    if (next[k]) continue;
    next[k] = nowIso;
    if (stored) fresh.push(k);
  }
  return { next, fresh };
}

/** Höchste gespeicherte Stufe einer Familie */
export function bestTier(u: Unlocked, f: FamilyId): Tier | undefined {
  return [...TIERS].reverse().find((t) => !!u[tierKey(f, t)]);
}

export const unlockedCount = (u: Unlocked) =>
  (u[FIRST_KEY] ? 1 : 0) +
  FAMILIES.reduce((n, f) => n + TIERS.filter((t) => !!u[tierKey(f.id, t)]).length, 0);

/** Gespeicherten Stand prüfen (beliebiger Inhalt) – unbekannte Schlüssel und kaputte Daten fallen weg */
export function parseUnlocked(v: unknown): Unlocked | undefined {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return undefined;
  const valid = new Set([FIRST_KEY, ...FAMILIES.flatMap((f) => TIERS.map((t) => tierKey(f.id, t)))]);
  const out: Record<string, string> = {};
  for (const [k, d] of Object.entries(v as Record<string, unknown>))
    if (valid.has(k) && typeof d === 'string' && !Number.isNaN(Date.parse(d))) out[k] = d;
  return out;
}

/** Erster Schlüssel aus `fresh` für den Hinweis (höchste Stufe zuerst) */
export function headline(fresh: readonly string[]): { family: FamilyId | 'first'; tier?: Tier } | undefined {
  const rank = (k: string) => (k === FIRST_KEY ? -1 : TIERS.indexOf(k.split(':')[1] as Tier));
  const k = [...fresh].sort((a, b) => rank(b) - rank(a))[0];
  if (!k) return undefined;
  if (k === FIRST_KEY) return { family: 'first' };
  const [family, tier] = k.split(':') as [FamilyId, Tier];
  return { family, tier };
}
