// Ortssuche über die Geocoding-API von Open-Meteo (Daten von GeoNames), Freigabe Nutzer 2026-11-20.
// [V: open-meteo.com/en/docs/geocoding-api, Abruf 2026-11-20: Parameter name, count, language, format, countryCode].
import { MAX_HITS, parseGeocoding } from '../domain/placeSearch';
import type { GeocodingProvider } from '../ports/geocoding';

export const OPEN_METEO_GEOCODING_URL = 'https://geocoding-api.open-meteo.com/v1/search';

export function openMeteoGeocodingUrl(query: string, base = OPEN_METEO_GEOCODING_URL): string {
  const u = new URL(base);
  u.search = new URLSearchParams({
    name: query,
    count: String(MAX_HITS),
    language: 'de',
    format: 'json',
    countryCode: 'DE',
  }).toString();
  return u.href;
}

export function openMeteoGeocoding(base = OPEN_METEO_GEOCODING_URL): GeocodingProvider {
  return {
    id: 'open-meteo-geocoding',
    async search(query, signal) {
      const r = await fetch(openMeteoGeocodingUrl(query, base), {
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        ...(signal ? { signal } : {}),
      });
      if (!r.ok) throw new Error(`Ortssuche: HTTP ${r.status}`);
      return parseGeocoding(await r.json());
    },
  };
}
