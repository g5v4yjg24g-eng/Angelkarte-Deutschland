// Ortssuche im Wetter-Bereich (Wunsch Nutzer 2026-11-20): Treffer prüfen, beschriften, zuletzt gesuchte Orte merken. Rein –
// ohne Netz. Der Anbieter (Open-Meteo Geocoding, Daten von GeoNames) liefert Koordinaten zu einem getippten Ortsnamen.
// Die Suche ist auf Deutschland beschränkt: Warnungen (DWD), Pegel und Zeitzone der Vorhersage gelten nur dort.

export interface PlaceHit {
  /** stabile Kennung des Anbieters (als Text) */
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** Bundesland, ggf. mit Landkreis */
  region?: string | undefined;
}

export const MIN_QUERY = 2;
export const MAX_QUERY = 80;
export const MAX_HITS = 8;
export const MAX_RECENT = 5;

/** Suchbegriff bereinigen; `undefined`, wenn zu kurz (kein Abruf) */
export function normalizeQuery(raw: string): string | undefined {
  const q = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY);
  return q.length >= MIN_QUERY ? q : undefined;
}

const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
const GERMANY = /^DE$/i;

/** Antwort von `geocoding-api.open-meteo.com/v1/search` → Treffer in Deutschland; Unbrauchbares wird übersprungen */
export function parseGeocoding(json: unknown): PlaceHit[] {
  const results = (json as { results?: unknown } | null)?.results;
  if (!Array.isArray(results)) return [];
  const out: PlaceHit[] = [];
  for (const r of results as Record<string, unknown>[]) {
    if (!r || typeof r !== 'object') continue;
    const lat = r.latitude;
    const lng = r.longitude;
    const name = str(r.name);
    if (
      !name ||
      typeof lat !== 'number' ||
      typeof lng !== 'number' ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    )
      continue;
    if (typeof r.country_code === 'string' && !GERMANY.test(r.country_code)) continue;
    const id = r.id;
    if (typeof id !== 'number' && typeof id !== 'string') continue;
    const admin2 = str(r.admin2);
    const county = admin2 && admin2 !== name && !/Regierungsbezirk/i.test(admin2) ? admin2 : undefined;
    const region = [county, str(r.admin1)].filter(Boolean).join(', ');
    out.push({ id: String(id), name, lat, lng, ...(region ? { region } : {}) });
    if (out.length >= MAX_HITS) break;
  }
  return out;
}

export const hitLabel = (h: Pick<PlaceHit, 'name' | 'region'>) =>
  h.region ? `${h.name} (${h.region})` : h.name;

/** Auswahlwert für einen gesuchten Ort (neben „me“ und den Gewässern) */
export const searchedKey = (id: string) => `s:${id}`;
export const isSearchedKey = (key: string) => key.startsWith('s:');

/** Gewählten Ort vorn einreihen (ohne Doppelte), höchstens `MAX_RECENT` */
export function addRecent(list: readonly PlaceHit[], hit: PlaceHit): PlaceHit[] {
  return [hit, ...list.filter((h) => h.id !== hit.id)].slice(0, MAX_RECENT);
}

/** Gespeicherte Liste lesen; Kaputtes wird verworfen */
export function parseRecents(raw: unknown): PlaceHit[] {
  if (!Array.isArray(raw)) return [];
  const out: PlaceHit[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    if (
      r &&
      typeof r === 'object' &&
      typeof r.id === 'string' &&
      typeof r.name === 'string' &&
      typeof r.lat === 'number' &&
      typeof r.lng === 'number' &&
      Number.isFinite(r.lat) &&
      Number.isFinite(r.lng)
    )
      out.push({
        id: r.id,
        name: r.name,
        lat: r.lat,
        lng: r.lng,
        ...(str(r.region) ? { region: str(r.region) } : {}),
      });
  }
  return out.slice(0, MAX_RECENT);
}
