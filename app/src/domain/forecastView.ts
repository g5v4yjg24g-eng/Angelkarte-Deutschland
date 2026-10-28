// Wetter-Ansicht (Wunsch Nutzer 2026-10-28, Vorbild iPhone-Wetter): Stundenleiste mit Sonnenauf- und -untergang,
// 10-Tage-Liste mit Temperaturbalken, Tagesdetail mit Hoch/Tief. Rein, ohne DOM; Zeiten als Unix-ms.
import type { Forecast, ForecastHour } from './forecast';

const HOUR = 3_600_000;

export type WeatherIconKey =
  | 'clear'
  | 'clearNight'
  | 'partly'
  | 'partlyNight'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'sleet'
  | 'snow'
  | 'showers'
  | 'thunder';

/** WMO-Wettercode (Open-Meteo) → Symbol; nachts Mond statt Sonne */
export function weatherIcon(code: number | undefined, night = false): WeatherIconKey {
  if (code === undefined) return 'cloudy';
  if (code === 0) return night ? 'clearNight' : 'clear';
  if (code === 1 || code === 2) return night ? 'partlyNight' : 'partly';
  if (code === 3) return 'cloudy';
  if (code === 45 || code === 48) return 'fog';
  if (code >= 51 && code <= 55) return 'drizzle';
  if (code === 56 || code === 57 || code === 66 || code === 67) return 'sleet';
  if (code >= 61 && code <= 65) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 80 && code <= 82) return 'showers';
  if (code >= 95) return 'thunder';
  return 'cloudy';
}

/** Tag (Mitternacht, Unix-ms), zu dem `t` gehört */
export function dayOf(f: Forecast, t: number): Forecast['days'][number] | undefined {
  let found: Forecast['days'][number] | undefined;
  for (const d of f.days) if (d.t <= t) found = d;
  return found;
}

/** Nacht = vor Sonnenaufgang oder ab Sonnenuntergang des Tages */
export function isNight(f: Forecast, t: number): boolean {
  const d = dayOf(f, t);
  if (d?.sunrise === undefined || d.sunset === undefined) return false;
  return t < d.sunrise || t >= d.sunset;
}

export type StripItem =
  | {
      kind: 'hour';
      t: number;
      now: boolean;
      tempC?: number | undefined;
      icon: WeatherIconKey;
      precipProb?: number | undefined;
    }
  | { kind: 'sunrise' | 'sunset'; t: number };

/** Stundenleiste ab der laufenden Stunde (`count` Stunden), dazwischen Sonnenauf- und -untergang */
export function hourStrip(f: Forecast, nowMs: number, count = 24): StripItem[] {
  const start = Math.floor(nowMs / HOUR) * HOUR;
  const end = start + count * HOUR;
  const hours: StripItem[] = f.hours
    .filter((h) => h.t >= start && h.t < end)
    .map((h) => ({
      kind: 'hour',
      t: h.t,
      now: h.t === start,
      tempC: h.tempC,
      icon: weatherIcon(h.code, isNight(f, h.t)),
      precipProb: h.precipProb,
    }));
  const sun: StripItem[] = f.days.flatMap((d) =>
    [
      d.sunrise !== undefined && d.sunrise > nowMs && d.sunrise < end
        ? ({ kind: 'sunrise', t: d.sunrise } as const)
        : null,
      d.sunset !== undefined && d.sunset > nowMs && d.sunset < end
        ? ({ kind: 'sunset', t: d.sunset } as const)
        : null,
    ].filter((x): x is { kind: 'sunrise' | 'sunset'; t: number } => x !== null),
  );
  return [...hours, ...sun].sort((a, b) => a.t - b.t);
}

export interface TempBounds {
  min: number;
  max: number;
}

/** Spanne aller Tage (für gleich lange Balken) */
export function tempBounds(
  days: readonly { tMin?: number | undefined; tMax?: number | undefined }[],
): TempBounds | undefined {
  const lo = days.map((d) => d.tMin).filter((v): v is number => v !== undefined);
  const hi = days.map((d) => d.tMax).filter((v): v is number => v !== undefined);
  if (!lo.length || !hi.length) return undefined;
  const min = Math.min(...lo);
  const max = Math.max(...hi);
  return { min, max: max > min ? max : min + 1 };
}

/** Lage eines Werts in der Spanne (0…100 %) */
export const pct = (v: number, b: TempBounds) =>
  Math.min(100, Math.max(0, ((v - b.min) / (b.max - b.min)) * 100));

/** Balken eines Tages: Beginn und Breite in % der Gesamtspanne */
export function barSpan(tMin: number, tMax: number, b: TempBounds): { left: number; width: number } {
  const left = pct(tMin, b);
  return { left, width: Math.max(2, pct(tMax, b) - left) };
}

/** Farbe zu einer Temperatur: kalt blau → türkis → grün → gelb → orange → rot */
export function tempColor(c: number): string {
  const stops: [number, string][] = [
    [-10, '#5b8def'],
    [0, '#4fb3e8'],
    [8, '#5fd0c5'],
    [15, '#a8d672'],
    [20, '#f2c94c'],
    [27, '#f2994a'],
    [35, '#eb5757'],
  ];
  for (const [limit, color] of stops) if (c <= limit) return color;
  return '#eb5757';
}

export interface DayDetail {
  t: number;
  hours: ForecastHour[];
  hi?: { t: number; v: number } | undefined;
  lo?: { t: number; v: number } | undefined;
  /** höchste stündliche Regenwahrscheinlichkeit */
  precipProbMax?: number | undefined;
}

/** Stunden eines Tages mit Hoch und Tief (aus den Stundenwerten) */
export function dayDetail(f: Forecast, dayT: number): DayDetail {
  const i = f.days.findIndex((d) => d.t === dayT);
  const end = f.days[i + 1]?.t ?? dayT + 24 * HOUR;
  const hours = f.hours.filter((h) => h.t >= dayT && h.t < end);
  let hi: DayDetail['hi'];
  let lo: DayDetail['lo'];
  for (const h of hours) {
    if (h.tempC === undefined) continue;
    if (!hi || h.tempC > hi.v) hi = { t: h.t, v: h.tempC };
    if (!lo || h.tempC < lo.v) lo = { t: h.t, v: h.tempC };
  }
  const probs = hours.map((h) => h.precipProb).filter((v): v is number => v !== undefined);
  return {
    t: dayT,
    hours,
    hi,
    lo,
    precipProbMax: f.days[i]?.precipProbMax ?? (probs.length ? Math.max(...probs) : undefined),
  };
}

/** Achsenteilung für ein Diagramm: runde Schritte, die den Wertebereich einschließen */
export function niceTicks(min: number, max: number, count = 5): number[] {
  const span = Math.max(1e-6, max - min);
  const raw = span / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}
