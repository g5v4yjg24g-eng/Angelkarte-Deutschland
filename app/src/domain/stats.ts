// Statistik (DATA_MODEL §9). Regeln gegen Irreführung: Mindestmengen, Stichprobengröße immer dabei,
// keine Raten bei < 1 h Angelzeit, Beobachtungen zählen nie als Fang, ungültige Sessions werden ausgeschlossen.
import type { Catch, CatchOutcome, Method, Session } from './schemas';
import type { CatchFilter } from './catchDraft';
import { localToZonedIso, toZonedIso } from './time';
import { activeMs } from './session';

export const MIN_LANDING_DENOMINATOR = 5;
export const MIN_FISHING_HOURS = 1;
export const MIN_SESSIONS_FOR_RATE = 2;
export const MIN_BAITS = 3;
export const SMALL_SAMPLE = 10;
const MAX_SESSION_MS = 24 * 3600e3;

export type StatsFilter = Pick<CatchFilter, 'period' | 'speciesId' | 'water'>;
export const NO_STATS_FILTER: StatsFilter = { period: 'all', speciesId: '', water: '' };

/** Wert nur, wenn genug Daten da sind; sonst die Stichprobe und was fehlt. */
export type Gated<T> = { ok: true; value: T; n: number } | { ok: false; n: number; need: number };

export interface SessionRow {
  id: string;
  startAt: string;
  title?: string;
  durationMs: number;
  caught: number;
  contacts: number;
  /** nur ab 1 h Dauer */
  perHour?: number;
}

export interface Stats {
  counts: Record<CatchOutcome, number> & { contactsTotal: number };
  landingRate: Gated<number>;
  perHour: Gated<number> & { hours: number; sessions: number };
  sessionsExcluded: number;
  species: { id: string; n: number }[];
  speciesSmallSample: boolean;
  baits: Gated<{ name: string; caught: number; contacts: number }[]>;
  methods: { method: Method; caught: number }[];
  waters: { name: string; caught: number }[];
  timeline: { unit: 'day' | 'month'; points: { key: string; caught: number }[] };
  sessions: SessionRow[];
  records: { speciesId: string; measuredCm?: number; estimatedCm?: number }[];
}

function periodStart(period: StatsFilter['period'], nowMs: number): number {
  if (period === '7d') return nowMs - 7 * 864e5;
  if (period === '30d') return nowMs - 30 * 864e5;
  if (period === 'year')
    return Date.parse(localToZonedIso(`${toZonedIso(nowMs).slice(0, 4)}-01-01`, '00:00'));
  return -Infinity;
}

/** Gültig = beendet, Ende nicht vor Beginn, höchstens 24 h (sonst vermutlich vergessen). */
export function sessionValid(s: Session): boolean {
  if (!s.endAt) return false;
  const d = Date.parse(s.endAt) - Date.parse(s.startAt);
  return d >= 0 && d <= MAX_SESSION_MS;
}

const isFish = (c: Catch) => c.outcome === 'caught' || c.outcome === 'contact' || c.outcome === 'missed_bite';
const desc =
  <T>(key: (x: T) => number) =>
  (a: T, b: T) =>
    key(b) - key(a);
const normBait = (s: string) => s.trim().toLocaleLowerCase('de-DE');

/** Zeitreihe mit leeren Perioden als 0: Tage bei 7/30 Tagen, sonst Monate (höchstens die letzten 36). */
function timeline(catches: Catch[], period: StatsFilter['period'], nowMs: number): Stats['timeline'] {
  const caught = catches.filter((c) => c.outcome === 'caught');
  if (period === '7d' || period === '30d') {
    const days = period === '7d' ? 7 : 30;
    const points = Array.from({ length: days }, (_, i) => ({
      key: toZonedIso(nowMs - (days - 1 - i) * 864e5).slice(0, 10),
      caught: 0,
    }));
    for (const c of caught) {
      const p = points.find((x) => x.key === c.at.slice(0, 10));
      if (p) p.caught++;
    }
    return { unit: 'day', points };
  }
  const months = caught.map((c) => c.at.slice(0, 7)).sort();
  const nowMonth = toZonedIso(nowMs).slice(0, 7);
  const first = period === 'year' ? `${nowMonth.slice(0, 4)}-01` : months[0];
  if (!first) return { unit: 'month', points: [] };
  const latest = months.at(-1);
  const last = latest && latest > nowMonth ? latest : nowMonth;
  const keys: string[] = [];
  for (let [y, m] = first.split('-').map(Number) as [number, number]; ;) {
    const k = `${y}-${String(m).padStart(2, '0')}`;
    keys.push(k);
    if (k >= last || keys.length > 600) break;
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  const counts = new Map<string, number>();
  for (const k of months) counts.set(k, (counts.get(k) ?? 0) + 1);
  return { unit: 'month', points: keys.slice(-36).map((key) => ({ key, caught: counts.get(key) ?? 0 })) };
}

export function computeStats(
  allCatches: readonly Catch[],
  allSessions: readonly Session[],
  filter: StatsFilter,
  nowMs: number,
): Stats {
  const from = periodStart(filter.period, nowMs);
  const catchesInPeriod = allCatches.filter((c) => !c.deletedAt && Date.parse(c.at) >= from);
  const catches = catchesInPeriod
    .filter((c) => !filter.speciesId || c.speciesId === filter.speciesId)
    .filter((c) => !filter.water || c.waterSnapshot?.name === filter.water);

  const counts = { caught: 0, contact: 0, missed_bite: 0, observation: 0 };
  for (const c of catches) counts[c.outcome]++;
  const contactsTotal = counts.caught + counts.contact + counts.missed_bite;

  const landingN = counts.caught + counts.contact;
  const landingRate: Gated<number> =
    landingN >= MIN_LANDING_DENOMINATOR
      ? { ok: true, value: counts.caught / landingN, n: landingN }
      : { ok: false, n: landingN, need: MIN_LANDING_DENOMINATOR };

  // Sessions im Zeitraum; mit Gewässerfilter nur solche mit einem Eintrag an diesem Gewässer
  const sessionsInPeriod = allSessions.filter(
    (s) => !s.deletedAt && s.endAt && Date.parse(s.startAt) >= from,
  );
  const atWater = new Set(
    catchesInPeriod.filter((c) => c.waterSnapshot?.name === filter.water).map((c) => c.sessionId),
  );
  const candidates = sessionsInPeriod.filter((s) => !filter.water || atWater.has(s.id));
  const valid = candidates.filter(sessionValid);
  const validIds = new Set(valid.map((s) => s.id));
  // Angelzeit ohne Pausen (gültige Sessions sind beendet, nowMs spielt keine Rolle)
  const hours = valid.reduce((sum, s) => sum + activeMs(s, nowMs), 0) / 3600e3;
  const caughtInSessions = catches.filter(
    (c) => c.outcome === 'caught' && c.sessionId && validIds.has(c.sessionId),
  ).length;
  const rateOk = hours >= MIN_FISHING_HOURS && valid.length >= MIN_SESSIONS_FOR_RATE;
  const perHour = rateOk
    ? {
        ok: true as const,
        value: caughtInSessions / hours,
        n: caughtInSessions,
        hours,
        sessions: valid.length,
      }
    : { ok: false as const, n: valid.length, need: MIN_SESSIONS_FOR_RATE, hours, sessions: valid.length };

  const caughtList = catches.filter((c) => c.outcome === 'caught');
  const speciesCount = new Map<string, number>();
  for (const c of caughtList)
    if (c.speciesId) speciesCount.set(c.speciesId, (speciesCount.get(c.speciesId) ?? 0) + 1);
  const species = [...speciesCount].map(([id, n]) => ({ id, n })).sort(desc((x) => x.n));

  const baitMap = new Map<string, { name: string; caught: number; contacts: number }>();
  for (const c of catches.filter(isFish)) {
    const name = c.bait?.name?.trim();
    if (!name) continue;
    const b = baitMap.get(normBait(name)) ?? { name, caught: 0, contacts: 0 };
    if (c.outcome === 'caught') b.caught++;
    b.contacts++;
    baitMap.set(normBait(name), b);
  }
  const baitList = [...baitMap.values()].sort(desc((b) => b.caught * 1000 + b.contacts));
  const baits: Stats['baits'] =
    baitList.length >= MIN_BAITS
      ? { ok: true, value: baitList, n: baitList.length }
      : { ok: false, n: baitList.length, need: MIN_BAITS };

  const methodMap = new Map<Method, number>();
  for (const c of caughtList) if (c.method) methodMap.set(c.method, (methodMap.get(c.method) ?? 0) + 1);
  const methods = [...methodMap].map(([method, caught]) => ({ method, caught })).sort(desc((x) => x.caught));

  const waterMap = new Map<string, number>();
  for (const c of caughtList) {
    const n = c.waterSnapshot?.name;
    if (n) waterMap.set(n, (waterMap.get(n) ?? 0) + 1);
  }
  const waters = [...waterMap].map(([name, caught]) => ({ name, caught })).sort(desc((x) => x.caught));

  const sessions: SessionRow[] = valid
    .map((s) => {
      const own = catches.filter((c) => c.sessionId === s.id);
      const durationMs = activeMs(s, nowMs);
      const caught = own.filter((c) => c.outcome === 'caught').length;
      return {
        id: s.id,
        startAt: s.startAt,
        ...(s.title ? { title: s.title } : {}),
        durationMs,
        caught,
        contacts: own.filter(isFish).length,
        ...(durationMs >= MIN_FISHING_HOURS * 3600e3 ? { perHour: caught / (durationMs / 3600e3) } : {}),
      };
    })
    .sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt));

  const recordMap = new Map<string, { speciesId: string; measuredCm?: number; estimatedCm?: number }>();
  for (const c of caughtList) {
    if (!c.speciesId || c.lengthCm === undefined) continue;
    const r = recordMap.get(c.speciesId) ?? { speciesId: c.speciesId };
    if (c.lengthMethod === 'measured') r.measuredCm = Math.max(r.measuredCm ?? 0, c.lengthCm);
    else r.estimatedCm = Math.max(r.estimatedCm ?? 0, c.lengthCm);
    recordMap.set(c.speciesId, r);
  }
  const records = [...recordMap.values()].sort(desc((r) => r.measuredCm ?? r.estimatedCm ?? 0));

  return {
    counts: { ...counts, contactsTotal },
    landingRate,
    perHour,
    sessionsExcluded: candidates.length - valid.length,
    species,
    speciesSmallSample: caughtList.length < SMALL_SAMPLE,
    baits,
    methods,
    waters,
    timeline: timeline(catches, filter.period, nowMs),
    sessions,
    records,
  };
}
