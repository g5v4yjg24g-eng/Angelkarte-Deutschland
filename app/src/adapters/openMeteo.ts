import { nowIso } from '../domain/time';
import { parseOpenMeteoHourly, type WeatherQuery } from '../domain/weather';
import type { WeatherProvider } from '../ports/weather';

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

export function openMeteo(base = OPEN_METEO_URL): WeatherProvider {
  return {
    id: 'open-meteo',
    async fetchHour(q) {
      const r = await fetch(openMeteoUrl(q, base), { credentials: 'omit', referrerPolicy: 'no-referrer' });
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
