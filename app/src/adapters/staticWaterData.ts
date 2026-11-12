import { WaterManifestSchema, type WaterManifest } from '../domain/water';
import type { SearchEntry } from '../domain/search';
import type { WaterDataProvider } from '../ports/waterData';
import { StatesFileSchema, type StatesFile } from '../domain/states';
import { PhotosFileSchema, type PhotosFile } from '../domain/waterPhotos';

/** Gewässerdaten als statische Dateien unter baseUrl (water-manifest.json, water.pmtiles, search/*.json). */
export function staticWaterData(baseUrl: string): WaterDataProvider {
  const base = new URL(baseUrl, location.href);
  let shardIndex: Promise<Set<string>> | undefined;
  const shards = new Map<string, Promise<SearchEntry[]>>();
  let states: Promise<StatesFile | null> | undefined;
  let photos: Promise<PhotosFile | null> | undefined;
  let all: Promise<SearchEntry[]> | undefined;

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
    loadStates(m) {
      if (!m.states) return Promise.resolve(null);
      const url = new URL(m.states, base);
      states ??= fetch(url)
        .then(async (r) => {
          if (!r.ok) return null;
          const p = StatesFileSchema.safeParse(await r.json());
          return p.success ? p.data : null;
        })
        .catch(() => null);
      const p = states;
      // Fehlschlag (z. B. offline beim ersten Start) beim nächsten Mal erneut versuchen
      void p.then((v) => {
        if (v === null && states === p) states = undefined;
      });
      return p;
    },
    loadPhotos(m) {
      if (!m.photos) return Promise.resolve(null);
      const url = new URL(m.photos, base);
      photos ??= fetch(url)
        .then(async (r) => {
          if (!r.ok) return null;
          const p = PhotosFileSchema.safeParse(await r.json());
          return p.success ? p.data : null;
        })
        .catch(() => null);
      const p = photos;
      // Fehlschlag (z. B. offline) beim nächsten Mal erneut versuchen
      void p.then((v) => {
        if (v === null && photos === p) photos = undefined;
      });
      return p;
    },
    loadAllSearchEntries(m, onProgress) {
      all ??= loadAllEntries(this, m, base, onProgress).catch((e) => {
        all = undefined; // beim nächsten Versuch erneut
        throw e;
      });
      return all;
    },
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

const NEAR_CACHE = 'fangpunkt-near';

/** Alle Teile des Suchindex zu einer Liste: je Datenstand einmal geladen und auf dem Gerät gemerkt (Cache-Speicher) */
async function loadAllEntries(
  water: WaterDataProvider,
  m: WaterManifest,
  base: URL,
  onProgress?: (done: number) => void,
): Promise<SearchEntry[]> {
  const cacheKey = new Request(
    new URL(`near/${encodeURIComponent(m.dataDate)}`, 'https://fangpunkt.invalid/'),
  );
  const store =
    typeof caches === 'undefined' ? undefined : await caches.open(NEAR_CACHE).catch(() => undefined);
  const hit = await store?.match(cacheKey).catch(() => undefined);
  if (hit) {
    try {
      const list = (await hit.json()) as SearchEntry[];
      if (Array.isArray(list) && list.length > 0) {
        onProgress?.(1);
        return list;
      }
    } catch {
      // kaputter Eintrag: neu laden
    }
  }
  const dir = new URL(m.search, base);
  const keys = await fetch(new URL('index.json', dir)).then((r) => {
    if (!r.ok) throw new Error(`Suchindex: HTTP ${r.status}`);
    return r.json() as Promise<string[]>;
  });
  const seen = new Set<string>();
  const out: SearchEntry[] = [];
  let done = 0;
  const BATCH = 12;
  for (let i = 0; i < keys.length; i += BATCH) {
    const parts = await Promise.all(keys.slice(i, i + BATCH).map((k) => water.loadSearchShard(m, k)));
    for (const entries of parts)
      for (const e of entries) {
        // derselbe Eintrag steht in den Teilen jedes seiner Namenswörter
        const id = `${e[0]}|${e[1]}|${e[2]}|${e[3]}|${e[6] ?? ''}`;
        if (seen.has(id)) continue;
        seen.add(id);
        out.push(e);
      }
    done += Math.min(BATCH, keys.length - i);
    onProgress?.(done / keys.length);
  }
  if (store) {
    // alte Stände entfernen, den neuen merken – Fehler (z. B. voller Speicher) sind egal
    await store
      .keys()
      .then((ks) => Promise.all(ks.map((k) => store.delete(k))))
      .catch(() => undefined);
    await store.put(cacheKey, new Response(JSON.stringify(out))).catch(() => undefined);
  }
  return out;
}
