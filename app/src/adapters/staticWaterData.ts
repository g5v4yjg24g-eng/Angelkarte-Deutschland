import { WaterManifestSchema, type WaterManifest } from '../domain/water';
import type { SearchEntry } from '../domain/search';
import type { WaterDataProvider } from '../ports/waterData';

/** Gewässerdaten als statische Dateien unter baseUrl (water-manifest.json, water.pmtiles, search/*.json). */
export function staticWaterData(baseUrl: string): WaterDataProvider {
  const base = new URL(baseUrl, location.href);
  let shardIndex: Promise<Set<string>> | undefined;
  const shards = new Map<string, Promise<SearchEntry[]>>();

  return {
    id: 'static',
    async loadManifest() {
      try {
        const r = await fetch(new URL('water-manifest.json', base));
        if (!r.ok) return null;
        const m = WaterManifestSchema.safeParse(await r.json());
        return m.success ? m.data : null;
      } catch {
        return null;
      }
    },
    tilesUrl: (m: WaterManifest) => new URL(m.tiles, base).href,
    async loadSearchShard(m, key) {
      const dir = new URL(m.search, base);
      shardIndex ??= fetch(new URL('index.json', dir))
        .then((r) => (r.ok ? (r.json() as Promise<string[]>) : []))
        .then((keys) => new Set(keys))
        .catch((e) => {
          shardIndex = undefined; // beim nächsten Versuch erneut laden
          throw e;
        });
      if (!(await shardIndex).has(key)) return [];
      let p = shards.get(key);
      if (!p) {
        p = fetch(new URL(`${key}.json`, dir)).then((r) => {
          if (!r.ok) throw new Error(`Suchindex ${key}: HTTP ${r.status}`);
          return r.json() as Promise<SearchEntry[]>;
        });
        p.catch(() => shards.delete(key));
        shards.set(key, p);
      }
      return p;
    },
  };
}
