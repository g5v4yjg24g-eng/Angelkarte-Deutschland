// Detailsuche (Wunsch Nutzer 2026-11-11): Gewässer im Umkreis, nach Art gefiltert. Rechnet auf dem Gerät mit dem
// vorhandenen Suchindex – keine Position verlässt das Gerät. Rein, ohne Netz.
import { normalize, type SearchEntry, type SearchResult } from './search';

export type NearbySort = 'distance' | 'name' | 'size';

export interface NearbyQuery {
  /** Mittelpunkt (eigener Standort oder Kartenmitte); ohne ihn gibt es keinen Umkreis */
  origin?: { lat: number; lng: number } | undefined;
  /** Umkreis in km; nur zusammen mit `origin` */
  radiusKm?: number | undefined;
  /** Gewählte Arten. Leer = alle Gewässerarten; sonst nur diese. */
  kinds: readonly string[];
  /** Namensteil (optional), wie bei der Suche: jedes Wort muss ein Namenswort beginnen */
  name?: string | undefined;
  sort: NearbySort;
}

export interface NearbyResult extends SearchResult {
  /** Luftlinie zum Mittelpunkt des Gewässers (bei Flüssen: zum Punkt dieses Abschnitts) */
  distanceKm?: number | undefined;
  /** Rang aus dem Index (Größe/Bedeutung), nur zum Sortieren */
  rank: number;
}

/** Arten, die ausgewählt werden können (Reihenfolge im Dropdown) */
export const NEARBY_KINDS = [
  'lake',
  'pond',
  'reservoir',
  'river',
  'canal',
  'stream',
  'oxbow',
  'harbour',
  'other',
] as const;

/** Luftlinie in km (Haversine) */
export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const p = Math.PI / 180;
  const x =
    Math.sin(((b.lat - a.lat) * p) / 2) ** 2 +
    Math.cos(a.lat * p) * Math.cos(b.lat * p) * Math.sin(((b.lng - a.lng) * p) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/** „1,3 km“, unter 100 m „unter 100 m“ */
export function formatDistance(km: number): string {
  if (km < 0.1) return 'unter 100 m';
  return `${km.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}

/** Namensteil prüfen wie bei der Suche */
function matchesName(entryName: string, tokens: readonly string[]): boolean {
  if (!tokens.length) return true;
  const words = normalize(entryName).split(' ');
  return tokens.every((t) => words.some((w) => w.startsWith(t)));
}

/**
 * Gewässer nach Umkreis, Art und Name. Orte (place:…) zählen nicht. Gleiche Einträge (Name, Art, Kontext) aus mehreren
 * Abschnitten werden zu dem nächsten zusammengefasst.
 */
export function nearbyWaters(entries: readonly SearchEntry[], q: NearbyQuery): NearbyResult[] {
  const kinds = new Set(q.kinds);
  const tokens = normalize(q.name ?? '')
    .split(' ')
    .filter(Boolean);
  const useRadius = !!q.origin && typeof q.radiusKm === 'number';
  const best = new Map<string, NearbyResult>();
  for (const e of entries) {
    if (e[1].startsWith('place:')) continue;
    if (kinds.size > 0 && !kinds.has(e[1])) continue;
    if (!matchesName(e[0], tokens)) continue;
    const dist = q.origin ? distanceKm(q.origin, { lat: e[2], lng: e[3] }) : undefined;
    if (useRadius && (dist === undefined || dist > (q.radiusKm as number))) continue;
    const key = `${normalize(e[0])}|${e[1]}|${e[4]}`;
    const cur = best.get(key);
    if (cur && (dist === undefined || (cur.distanceKm !== undefined && cur.distanceKm <= dist))) continue;
    best.set(key, {
      name: e[0],
      kind: e[1],
      isPlace: false,
      lat: e[2],
      lng: e[3],
      context: e[4],
      rank: e[5],
      ...(e[6] ? { wid: e[6] } : {}),
      ...(dist !== undefined ? { distanceKm: dist } : {}),
    });
  }
  const list = [...best.values()];
  const byName = (a: NearbyResult, b: NearbyResult) => a.name.localeCompare(b.name, 'de');
  list.sort((a, b) => {
    if (q.sort === 'name') return byName(a, b);
    if (q.sort === 'size') return b.rank - a.rank || byName(a, b);
    return (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || byName(a, b);
  });
  return list;
}

/** Auswahl umschalten (Mehrfachauswahl); Reihenfolge der Arten bleibt die des Dropdowns */
export function toggleKind(selected: readonly string[], kind: string): string[] {
  const next = new Set(selected);
  if (next.has(kind)) next.delete(kind);
  else next.add(kind);
  return NEARBY_KINDS.filter((k) => next.has(k));
}

/** Kurzfassung der Auswahl fürs Dropdown: leer = „Alle Gewässerarten“, sonst die Namen, bei vielen „+n“ */
export function kindSummary(
  selected: readonly string[],
  label: (kind: string) => string,
  allLabel: string,
  max = 3,
): string {
  if (selected.length === 0) return allLabel;
  const names = selected.map(label);
  return names.length <= max ? names.join(', ') : `${names.slice(0, max).join(', ')} +${names.length - max}`;
}
