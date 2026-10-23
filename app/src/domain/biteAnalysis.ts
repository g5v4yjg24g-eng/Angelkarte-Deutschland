// Persönliche Beißzeiten (Wunsch Nutzer 2026-10-22): wann und bei welchem Luftdruck du bisher Bisse hattest.
// Ehrlich halten: Tageszeit als Bisse pro Angelstunde (aus Sessions), sonst zeigt sie nur, wann du angelst;
// Luftdruck nur als Häufigkeit, weil das Wetter der Stunden ohne Biss unbekannt ist. Mindestmengen wie in der
// Statistik. Gruppengrenzen sind Einteilungen zur Übersicht [A], keine Aussage über Fischverhalten.
import type { Catch, Session } from './schemas';
import { sessionValid } from './stats';
import { gaugeTrend } from './gauges';

export const MIN_EVENTS = 20;
/** Tageszeit-Rate erst ab so viel Angelzeit im Zeitfenster */
export const MIN_SLOT_HOURS = 1;
export const SLOT_HOURS = 2;
export const PRESSURE_BUCKETS = [1005, 1015, 1025] as const;
export const TREND_LIMIT = 1;

const isBite = (c: Catch) => c.outcome === 'caught' || c.outcome === 'contact' || c.outcome === 'missed_bite';
/** Stunde (0–23) in der Zeitzone des Eintrags – der Zeitstempel trägt den Offset bereits */
const localHour = (iso: string) => Number(iso.slice(11, 13));
const slotOf = (hour: number) => Math.floor(hour / SLOT_HOURS);

export interface SlotRow {
  slot: number;
  /** Beginn (Stunde) */
  from: number;
  bites: number;
  /** Angelzeit in diesem Zeitfenster (h), nur aus gültigen Sessions */
  hours: number;
  /** Bisse in Sessions pro Angelstunde; nur ab MIN_SLOT_HOURS */
  perHour?: number | undefined;
}

export type PressureBucket = 0 | 1 | 2 | 3;
export type TrendBucket = 'falling' | 'steady' | 'rising';

export const pressureBucket = (hpa: number): PressureBucket =>
  hpa < PRESSURE_BUCKETS[0] ? 0 : hpa < PRESSURE_BUCKETS[1] ? 1 : hpa < PRESSURE_BUCKETS[2] ? 2 : 3;
export const trendBucket = (delta: number): TrendBucket =>
  delta < -TREND_LIMIT ? 'falling' : delta > TREND_LIMIT ? 'rising' : 'steady';

export type Gated<T> = { ok: true; value: T; n: number } | { ok: false; n: number; need: number };

export interface BiteAnalysis {
  bites: number;
  slots: Gated<SlotRow[]>;
  pressure: Gated<Record<PressureBucket, number>>;
  trend: Gated<Record<TrendBucket, number>>;
  /** Lage des Pegels zu MNW/MHW (nur Landespegel NRW liefern sie für vergangene Zeitpunkte) */
  gaugeState: Gated<Record<GaugeLevel, number>>;
  /** Pegel-Tendenz in den 24 h vor dem Fang */
  gaugeTrend: Gated<Record<TrendBucket, number>>;
}

export type GaugeLevel = 'low' | 'normal' | 'high';

/** Angelzeit je Zeitfenster aus den aktiven Abschnitten gültiger Sessions (15-Minuten-Raster, Ortszeit). */
function slotHours(sessions: readonly Session[]): number[] {
  const hours = Array<number>(24 / SLOT_HOURS).fill(0);
  const STEP = 15 * 60_000;
  for (const s of sessions) {
    if (s.deletedAt || !sessionValid(s)) continue;
    const start = Date.parse(s.startAt);
    const end = Date.parse(s.endAt ?? s.startAt);
    // Offset der Session (z. B. +02:00) für die Ortszeit
    const off = /([+-])(\d\d):(\d\d)$/.exec(s.startAt);
    const offMs = off ? (off[1] === '-' ? -1 : 1) * (Number(off[2]) * 60 + Number(off[3])) * 60_000 : 0;
    const paused = (t: number) =>
      (s.pauses ?? []).some((p) => t >= Date.parse(p.from) && t < (p.to ? Date.parse(p.to) : end));
    for (let t = start; t < end; t += STEP) {
      if (paused(t)) continue;
      const hour = new Date(t + offMs).getUTCHours();
      const slot = slotOf(hour);
      hours[slot] = (hours[slot] ?? 0) + Math.min(STEP, end - t) / 3_600_000;
    }
  }
  return hours;
}

export function analyzeBites(catches: readonly Catch[], sessions: readonly Session[]): BiteAnalysis {
  const bites = catches.filter((c) => !c.deletedAt && isBite(c));
  const n = bites.length;
  const gate = <T>(count: number, value: T): Gated<T> =>
    count >= MIN_EVENTS ? { ok: true, value, n: count } : { ok: false, n: count, need: MIN_EVENTS };

  const valid = new Set(sessions.filter((s) => !s.deletedAt && sessionValid(s)).map((s) => s.id));
  const hours = slotHours(sessions);
  const slots: SlotRow[] = hours.map((h, slot) => {
    const inSlot = bites.filter((c) => slotOf(localHour(c.at)) === slot);
    const inSessions = inSlot.filter((c) => c.sessionId && valid.has(c.sessionId)).length;
    return {
      slot,
      from: slot * SLOT_HOURS,
      bites: inSlot.length,
      hours: Math.round(h * 10) / 10,
      perHour: h >= MIN_SLOT_HOURS ? inSessions / h : undefined,
    };
  });

  const withWeather = bites.filter((c) => c.weather?.pressureHpa !== undefined);
  const pressure: Record<PressureBucket, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
  for (const c of withWeather) pressure[pressureBucket(c.weather?.pressureHpa ?? 0)]++;
  const withTrend = bites.filter((c) => c.weather?.pressureTrend3h !== undefined);
  const trend: Record<TrendBucket, number> = { falling: 0, steady: 0, rising: 0 };
  for (const c of withTrend) trend[trendBucket(c.weather?.pressureTrend3h ?? 0)]++;

  const gauged = bites.flatMap((c) => (c.gauge?.status === 'ok' ? [c.gauge] : []));
  const withLevel = gauged.filter((g) => g.state === 'low' || g.state === 'normal' || g.state === 'high');
  const level: Record<GaugeLevel, number> = { low: 0, normal: 0, high: 0 };
  for (const g of withLevel) level[g.state as GaugeLevel]++;
  const withGaugeTrend = gauged.filter((g) => g.change24h !== undefined);
  const gTrend: Record<TrendBucket, number> = { falling: 0, steady: 0, rising: 0 };
  for (const g of withGaugeTrend) gTrend[gaugeTrend(g.change24h ?? 0)]++;

  return {
    bites: n,
    gaugeState: gate(withLevel.length, level),
    gaugeTrend: gate(withGaugeTrend.length, gTrend),
    slots: gate(n, slots),
    pressure: gate(withWeather.length, pressure),
    trend: gate(withTrend.length, trend),
  };
}

/** Für „jetzt": in welches Zeitfenster/welche Gruppe fällt der Moment, und wie viele deiner Bisse lagen dort. */
export function matchNow(
  a: BiteAnalysis,
  now: { hour: number; pressureHpa?: number | undefined; trend3h?: number | undefined },
): {
  slot?: SlotRow;
  pressure?: { bucket: PressureBucket; count: number; of: number };
  trend?: { bucket: TrendBucket; count: number; of: number };
} {
  const out: ReturnType<typeof matchNow> = {};
  if (a.slots.ok) {
    const s = a.slots.value[slotOf(now.hour)];
    if (s) out.slot = s;
  }
  if (a.pressure.ok && now.pressureHpa !== undefined) {
    const b = pressureBucket(now.pressureHpa);
    out.pressure = { bucket: b, count: a.pressure.value[b], of: a.pressure.n };
  }
  if (a.trend.ok && now.trend3h !== undefined) {
    const b = trendBucket(now.trend3h);
    out.trend = { bucket: b, count: a.trend.value[b], of: a.trend.n };
  }
  return out;
}
