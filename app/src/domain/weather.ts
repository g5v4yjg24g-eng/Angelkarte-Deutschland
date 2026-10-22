// Wetter am Fang (DATA_MODEL §5.2, DATA_SOURCES §6). Modellwerte eines Wetterdienstes, nicht am Gewässer gemessen.
// Rein: Abfrage bauen, Antwort auswerten, entscheiden, welcher Fang noch Wetter braucht.
import { z } from 'zod';
import type { Catch, LatLng } from './schemas';

/** Ältere Zeitpunkte deckt die Historical-Forecast-API nicht ab [V: open-meteo.com/en/docs/historical-forecast-api]. */
export const WEATHER_FROM = '2022-01-01T00:00:00Z';
/** Druckänderung über diese Spanne (h) vor dem Fangzeitpunkt. */
export const TREND_HOURS = 3;
/** 3 Nachkommastellen ≈ 100 m (ARCHITECTURE §8). */
export const COORD_DECIMALS = 3;

export const WeatherSnapshotSchema = z.object({
  provider: z.enum(['open-meteo', 'bright-sky']),
  fetchedAt: z.iso.datetime({ offset: true }),
  kind: z.enum(['model', 'station']),
  /** volle Stunde (UTC), deren Werte gespeichert sind */
  forHour: z.iso.datetime({ offset: true }),
  tempC: z.number().min(-80).max(60).optional(),
  pressureHpa: z.number().min(850).max(1100).optional(),
  /** Luftdruck jetzt minus vor TREND_HOURS Stunden (hPa) */
  pressureTrend3h: z.number().min(-60).max(60).optional(),
  windMs: z.number().min(0).max(100).optional(),
  windDirDeg: z.number().min(0).max(360).optional(),
  /** Höchste Böe der vorangehenden Stunde */
  gustMs: z.number().min(0).max(150).optional(),
  cloudPct: z.number().min(0).max(100).optional(),
  /** Summe der vorangehenden Stunde */
  precipMm: z.number().min(0).max(500).optional(),
  /** WMO-Wettercode */
  code: z.number().int().min(0).max(99).optional(),
  attribution: z.string().min(1),
});
export type WeatherSnapshot = z.infer<typeof WeatherSnapshotSchema>;

export type WeatherValues = Omit<WeatherSnapshot, 'provider' | 'fetchedAt' | 'kind' | 'attribution'>;

export interface WeatherQuery {
  lat: number;
  lng: number;
  /** UTC, volle Stunden, `YYYY-MM-DDTHH:00` */
  startHour: string;
  endHour: string;
  /** volle Stunde des Fangs (ISO mit Z) */
  forHour: string;
}

const HOUR = 3_600_000;

export function roundCoord(v: number): number {
  const f = 10 ** COORD_DECIMALS;
  return Math.round(v * f) / f;
}

/** Nächste volle Stunde (UTC) zum Zeitpunkt. */
export function nearestHour(atIso: string): number {
  return Math.round(Date.parse(atIso) / HOUR) * HOUR;
}

const hourKey = (ms: number) => new Date(ms).toISOString().slice(0, 13) + ':00';

/** Abfrage für einen Fang; Koordinaten werden gerundet, bevor sie das Gerät verlassen. */
export function weatherQuery(at: string, pos: LatLng): WeatherQuery {
  const h = nearestHour(at);
  return {
    lat: roundCoord(pos.lat),
    lng: roundCoord(pos.lng),
    startHour: hourKey(h - TREND_HOURS * HOUR),
    endHour: hourKey(h),
    forHour: new Date(h).toISOString(),
  };
}

/** Braucht dieser Fang noch Wetter? Nur mit Standort, ohne Wetter, nicht gelöscht, im abgedeckten Zeitraum. */
export function needsWeather(c: Catch, nowMs: number): boolean {
  if (c.deletedAt || c.weather || !c.position) return false;
  const h = nearestHour(c.at);
  return h >= Date.parse(WEATHER_FROM) && h <= nowMs;
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

/**
 * Wertet die stündlichen Reihen einer Open-Meteo-Antwort aus (Zeiten in GMT). null, wenn die Fangstunde fehlt
 * oder kein einziger Wert vorliegt.
 */
export function parseOpenMeteoHourly(json: unknown, q: WeatherQuery): WeatherValues | null {
  const hourly = (json as { hourly?: Record<string, unknown[]> } | null)?.hourly;
  const times = hourly?.time;
  if (!hourly || !Array.isArray(times)) return null;
  const i = times.indexOf(q.endHour);
  if (i < 0) return null;
  const at = (k: string, idx = i) => num(hourly[k]?.[idx]);
  const before = times.indexOf(q.startHour);
  const p = at('pressure_msl');
  const p0 = before >= 0 ? at('pressure_msl', before) : undefined;
  const code = at('weather_code');
  const values: WeatherValues = {
    forHour: q.forHour,
    tempC: at('temperature_2m'),
    pressureHpa: p,
    pressureTrend3h: p !== undefined && p0 !== undefined ? Math.round((p - p0) * 10) / 10 : undefined,
    windMs: at('wind_speed_10m'),
    windDirDeg: at('wind_direction_10m'),
    gustMs: at('wind_gusts_10m'),
    cloudPct: at('cloud_cover'),
    precipMm: at('precipitation'),
    code: code !== undefined && Number.isInteger(code) ? code : undefined,
  };
  const clean = Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== undefined),
  ) as WeatherValues;
  return Object.keys(clean).length > 1 ? clean : null;
}

/** Himmelsrichtung als Achtelkreis-Index (0 = Nord, im Uhrzeigersinn). */
export function compassIndex(deg: number): number {
  return Math.round((((deg % 360) + 360) % 360) / 45) % 8;
}

/** Gilt gespeichertes Wetter nach einer Änderung noch? Nein, sobald Zeitpunkt oder Ort anders sind. */
export function weatherStillValid(
  before: Pick<Catch, 'at' | 'position'>,
  after: Pick<Catch, 'at' | 'position'>,
): boolean {
  const same = (a?: LatLng, b?: LatLng) =>
    !!a && !!b && roundCoord(a.lat) === roundCoord(b.lat) && roundCoord(a.lng) === roundCoord(b.lng);
  return nearestHour(before.at) === nearestHour(after.at) && same(before.position, after.position);
}
