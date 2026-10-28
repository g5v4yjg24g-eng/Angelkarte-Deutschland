// Wettervorhersage für den Bereich „Wetter" (Wunsch Nutzer 2026-10-22): Modellwerte von Open-Meteo, stündlich und
// täglich. Rein: Antwort auswerten, Luftdruck-Änderung, Tageswerte. Zeiten als Unix-Millisekunden (eindeutig, auch
// bei der Zeitumstellung).
import { z } from 'zod';
import { roundCoord } from './weather';

/** Tage im Voraus (wie die 10-Tage-Vorhersage, Wunsch Nutzer 2026-10-28; Open-Meteo erlaubt bis 16) */
export const FORECAST_DAYS = 10;
/** Spanne für die Luftdruck-Änderung (h) */
export const PRESSURE_SPAN_H = 3;

const n = z.number().finite();
export const ForecastSchema = z.object({
  fetchedAt: z.number(),
  lat: n,
  lng: n,
  hours: z.array(
    z.object({
      t: z.number(),
      pressureHpa: n.optional(),
      tempC: n.optional(),
      /** gefühlte Temperatur */
      feelsC: n.optional(),
      windMs: n.optional(),
      windDirDeg: n.optional(),
      gustMs: n.optional(),
      precipMm: n.optional(),
      precipProb: n.optional(),
      cloudPct: n.optional(),
      code: z.number().int().optional(),
    }),
  ),
  days: z.array(
    z.object({
      /** Mitternacht des Tages (Europe/Berlin) als Unix-ms */
      t: z.number(),
      sunrise: z.number().optional(),
      sunset: z.number().optional(),
      tMax: n.optional(),
      tMin: n.optional(),
      precipSum: n.optional(),
      /** höchste stündliche Regenwahrscheinlichkeit des Tages (%) */
      precipProbMax: n.optional(),
      code: z.number().int().optional(),
    }),
  ),
});
export type Forecast = z.infer<typeof ForecastSchema>;
export type ForecastHour = Forecast['hours'][number];

export interface ForecastQuery {
  lat: number;
  lng: number;
}

/** Koordinaten verlassen das Gerät nur gerundet (≈ 100 m, wie beim Wetter am Fang). */
export const forecastQuery = (pos: { lat: number; lng: number }): ForecastQuery => ({
  lat: roundCoord(pos.lat),
  lng: roundCoord(pos.lng),
});

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const clean = <T extends object>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;

/** Open-Meteo-Antwort (timeformat=unixtime) → Forecast; null bei Fehlern oder fehlenden Zeitreihen. */
export function parseOpenMeteoForecast(json: unknown, q: ForecastQuery, fetchedAt: number): Forecast | null {
  const j = json as { hourly?: Record<string, unknown[]>; daily?: Record<string, unknown[]> } | null;
  const h = j?.hourly;
  const d = j?.daily;
  if (!h || !Array.isArray(h.time) || !d || !Array.isArray(d.time)) return null;
  const at = (s: Record<string, unknown[]>, k: string, i: number) => num(s[k]?.[i]);
  const sec = (v: number | undefined) => (v === undefined ? undefined : v * 1000);
  const hours = h.time
    .map((t, i) =>
      clean({
        t: (num(t) ?? NaN) * 1000,
        pressureHpa: at(h, 'pressure_msl', i),
        tempC: at(h, 'temperature_2m', i),
        feelsC: at(h, 'apparent_temperature', i),
        windMs: at(h, 'wind_speed_10m', i),
        windDirDeg: at(h, 'wind_direction_10m', i),
        gustMs: at(h, 'wind_gusts_10m', i),
        precipMm: at(h, 'precipitation', i),
        precipProb: at(h, 'precipitation_probability', i),
        cloudPct: at(h, 'cloud_cover', i),
        code: at(h, 'weather_code', i),
      }),
    )
    .filter((x) => Number.isFinite(x.t));
  const days = d.time
    .map((t, i) =>
      clean({
        t: (num(t) ?? NaN) * 1000,
        sunrise: sec(at(d, 'sunrise', i)),
        sunset: sec(at(d, 'sunset', i)),
        tMax: at(d, 'temperature_2m_max', i),
        tMin: at(d, 'temperature_2m_min', i),
        precipSum: at(d, 'precipitation_sum', i),
        precipProbMax: at(d, 'precipitation_probability_max', i),
        code: at(d, 'weather_code', i),
      }),
    )
    .filter((x) => Number.isFinite(x.t));
  if (!hours.length || !days.length) return null;
  const r = ForecastSchema.safeParse({ fetchedAt, lat: q.lat, lng: q.lng, hours, days });
  return r.success ? r.data : null;
}

/** Stunde, die `nowMs` am nächsten liegt. */
export function hourAt(f: Forecast, nowMs: number): ForecastHour | undefined {
  let best: ForecastHour | undefined;
  for (const h of f.hours) if (!best || Math.abs(h.t - nowMs) < Math.abs(best.t - nowMs)) best = h;
  return best;
}

/** Luftdruck-Änderung über `span` Stunden bis zu `t` (hPa, eine Nachkommastelle); undefined ohne Werte. */
export function pressureChange(f: Forecast, t: number, span = PRESSURE_SPAN_H): number | undefined {
  const now = f.hours.find((h) => h.t === t)?.pressureHpa;
  const before = f.hours.find((h) => h.t === t - span * 3_600_000)?.pressureHpa;
  return now === undefined || before === undefined ? undefined : Math.round((now - before) * 10) / 10;
}

export interface DaySummary {
  t: number;
  day: Forecast['days'][number];
  hours: ForecastHour[];
  windMaxMs?: number | undefined;
  gustMaxMs?: number | undefined;
  pressureMin?: number | undefined;
  pressureMax?: number | undefined;
  /** Luftdruck letzte minus erste Stunde des Tages */
  pressureDelta?: number | undefined;
}

/** Tage mit ihren Stunden und Spannweiten (nur aus vorhandenen Werten). */
export function daySummaries(f: Forecast): DaySummary[] {
  return f.days.map((day, i) => {
    const end = f.days[i + 1]?.t ?? day.t + 86_400_000;
    const hours = f.hours.filter((h) => h.t >= day.t && h.t < end);
    const vals = (k: keyof ForecastHour) =>
      hours.map((h) => h[k]).filter((v): v is number => typeof v === 'number');
    const p = vals('pressureHpa');
    const max = (xs: number[]) => (xs.length ? Math.max(...xs) : undefined);
    const min = (xs: number[]) => (xs.length ? Math.min(...xs) : undefined);
    const first = p[0];
    const last = p.at(-1);
    return {
      t: day.t,
      day,
      hours,
      windMaxMs: max(vals('windMs')),
      gustMaxMs: max(vals('gustMs')),
      pressureMin: min(p),
      pressureMax: max(p),
      pressureDelta:
        first === undefined || last === undefined ? undefined : Math.round((last - first) * 10) / 10,
    };
  });
}
