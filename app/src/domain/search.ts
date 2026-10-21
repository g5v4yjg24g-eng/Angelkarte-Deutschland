// Suche nach Gewässern und Orten im vorab erzeugten Index (ARCHITECTURE §6.3) – ohne Laufzeit-Geocoder.

/** Identisch mit der Normalisierung in tools/water-pipeline (Shard-Schlüssel müssen übereinstimmen). */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Indexeintrag: [Name, Art, lat, lng, Kontext, Rang, wid] (Art: Gewässertyp oder "place:<typ>"). */
export type SearchEntry = [string, string, number, number, string, number, string];

export interface SearchResult {
  name: string;
  kind: string;
  isPlace: boolean;
  lat: number;
  lng: number;
  context: string;
  wid?: string;
}

/** Shard, der für eine Anfrage geladen werden muss (erstes Wort mit ≥ 2 Zeichen). */
export function shardKey(query: string): string | undefined {
  return normalize(query)
    .split(' ')
    .find((t) => t.length >= 2)
    ?.slice(0, 2);
}

const PLACE_WEIGHT: Record<string, number> = {
  'place:city': 300,
  'place:municipality': 230,
  'place:town': 220,
  'place:village': 120,
  'place:suburb': 80,
};

export function search(
  entries: SearchEntry[],
  query: string,
  near?: { lat: number; lng: number },
  limit = 20,
): SearchResult[] {
  const q = normalize(query);
  const tokens = q.split(' ').filter(Boolean);
  if (!tokens.length || !tokens.some((t) => t.length >= 2)) return [];
  const scored: { e: SearchEntry; score: number }[] = [];
  const seen = new Set<string>();
  for (const e of entries) {
    const n = normalize(e[0]);
    const words = n.split(' ');
    if (!tokens.every((t) => words.some((w) => w.startsWith(t)))) continue;
    const key = `${n}|${e[1]}|${e[4]}`;
    if (seen.has(key)) continue; // derselbe Eintrag kann aus mehreren Wörtern stammen
    seen.add(key);
    // Treffergüte zuerst, dann Bedeutung (Größe/Ortsart), dann Nähe zur Kartenmitte
    const quality = n === q ? 3 : n.startsWith(q) ? 2 : 1;
    const weight = e[1].startsWith('place:') ? (PLACE_WEIGHT[e[1]] ?? 50) : e[5];
    const dist = near
      ? Math.hypot(e[2] - near.lat, (e[3] - near.lng) * Math.cos((near.lat * Math.PI) / 180))
      : 0;
    scored.push({ e, score: quality * 1000 + weight - Math.min(dist * 20, 300) });
  }
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(({ e }) => ({
      name: e[0],
      kind: e[1],
      isPlace: e[1].startsWith('place:'),
      lat: e[2],
      lng: e[3],
      context: e[4],
      ...(e[6] ? { wid: e[6] } : {}),
    }));
}
