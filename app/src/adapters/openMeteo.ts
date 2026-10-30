import { nowIso } from '../domain/time';
import { isRecentQuery, parseOpenMeteoHourly, type WeatherQuery } from '../domain/weather';
import type { WeatherProvider } from '../ports/weather';
import type { ForecastProvider } from '../ports/forecast';
import { FORECAST_DAYS, parseOpenMeteoForecast, type ForecastQuery } from '../domain/forecast';

// Open-Meteo Historical Forecast API (DATA_SOURCES §6): stündliche Modellwerte ab 2022 bis zur aktuellen Stunde,
// ohne Schlüssel, CC BY 4.0, nur nicht kommerziell (E3).
export const OPEN_METEO_URL = 'https://historical-forecast-api.open-meteo.com/v1/forecast';
const HOURLY = [
  'temperature_2m',
  'pressure_msl',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'cloud_cover',
  'precipitation',
  'weather_code',
].join(',');

export function openMeteoUrl(q: WeatherQuery, base = OPEN_METEO_URL): string {
  const u = new URL(base);
  u.search = new URLSearchParams({
    latitude: q.lat.toFixed(3),
    longitude: q.lng.toFixed(3),
    start_hour: q.startHour,
    end_hour: q.endHour,
    hourly: HOURLY,
    wind_speed_unit: 'ms',
    timezone: 'GMT',
  }).toString();
  return u.href;
}

/** Ältere Stunden aus dem Archiv, die letzten 48 h aus der Forecast-API (gleiche Parameter und Antwort). */
export function openMeteo(
  base = OPEN_METEO_URL,
  recentBase = OPEN_METEO_FORECAST_URL,
  now: () => number = Date.now,
): WeatherProvider {
  return {
    id: 'open-meteo',
    async fetchHour(q) {
      const url = openMeteoUrl(q, isRecentQuery(q, now()) ? recentBase : base);
      const r = await fetch(url, { credentials: 'omit', referrerPolicy: 'no-referrer' });
      if (!r.ok) throw new Error(`Wetter: HTTP ${r.status}`);
      const values = parseOpenMeteoHourly(await r.json(), q);
      if (!values) return null;
      return {
        provider: 'open-meteo',
        fetchedAt: nowIso(),
        kind: 'model',
        attribution: 'Open-Meteo.com, CC BY 4.0',
        ...values,
      };
    },
  };
}

// Forecast-API (Bereich „Wetter"): stündlich und täglich, Zeiten als Unix-Sekunden (eindeutig bei Zeitumstellung)
// [V: api.open-meteo.com/v1/forecast, Abruf 2026-10-22].
export const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

export function openMeteoForecastUrl(q: ForecastQuery, base = OPEN_METEO_FORECAST_URL): string {
  const u = new URL(base);
  u.search = new URLSearchParams({
    latitude: q.lat.toFixed(3),
    longitude: q.lng.toFixed(3),
    hourly: [
      'pressure_msl',
      'temperature_2m',
      'apparent_temperature',
      'wind_speed_10m',
      'wind_direction_10m',
      'wind_gusts_10m',
      'precipitation',
      'precipitation_probability',
      'cloud_cover',
      'weather_code',
    ].join(','),
    daily: [
      'sunrise',
      'sunset',
      'temperature_2m_max',
      'temperature_2m_min',
      'precipitation_sum',
      'precipitation_probability_max',
      'weather_code',
    ].join(','),
    timezone: 'Europe/Berlin',
    timeformat: 'unixtime',
    forecast_days: String(FORECAST_DAYS),
    // 1 Tag zurück, damit die Luftdruck-Änderung schon für die erste Stunde vorliegt
    past_days: '1',
    wind_speed_unit: 'ms',
  }).toString();
  return u.href;
}

export function openMeteoForecast(base = OPEN_METEO_FORECAST_URL): ForecastProvider {
  return {
    id: 'open-meteo',
    async forecast(q) {
      const r = await fetch(openMeteoForecastUrl(q, base), {
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (!r.ok) throw new Error(`Vorhersage: HTTP ${r.status}`);
      return parseOpenMeteoForecast(await r.json(), q, Date.now());
    },
  };
}
