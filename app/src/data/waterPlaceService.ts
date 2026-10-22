// Ort (Gemeinde/Kreis) für ältere Fänge nachtragen, die schon ein bekanntes Gewässer haben – aus dem eigenen
// Suchindex (gleiche Gewässer-ID), nie geraten. Für „Fangbuch nach Gewässern".
import { normalize, shardKey, type SearchEntry } from '../domain/search';
import type { WaterDataProvider } from '../ports/waterData';
import { getDb, type FangpunktDB } from './db';
import { repo } from './repository';

export async function fillMissingPlaces(
  water: WaterDataProvider,
  db: FangpunktDB = getDb(),
): Promise<number> {
  const todo = await db.catches
    .filter((c) => !c.deletedAt && !!c.waterId && !!c.waterSnapshot?.name && !c.waterSnapshot.place)
    .toArray();
  if (!todo.length) return 0;
  const m = await water.loadManifest();
  if (!m) return 0;
  const shards = new Map<string, SearchEntry[]>();
  let filled = 0;
  for (const c of todo) {
    const name = c.waterSnapshot?.name ?? '';
    const key = shardKey(name);
    if (!key) continue;
    let entries = shards.get(key);
    if (!entries) {
      try {
        entries = await water.loadSearchShard(m, key);
      } catch {
        return filled; // offline o. Ä.: beim nächsten Öffnen erneut
      }
      shards.set(key, entries);
    }
    // Nur derselbe Eintrag (Gewässer-ID und Name) – Fließgewässer stehen je Kreis mit einer ihrer IDs im Index
    const hit = entries.find((e) => e[6] === c.waterId && normalize(e[0]) === normalize(name));
    const place = hit?.[4]?.trim();
    if (!place) continue;
    await db.transaction('rw', db.catches, async () => {
      const cur = await db.catches.get(c.id);
      if (!cur || cur.waterSnapshot?.place || cur.waterId !== c.waterId) return;
      await repo('catches', db).update(c.id, { waterSnapshot: { ...cur.waterSnapshot, place } });
      filled++;
    });
  }
  return filled;
}

/** Eigenen Namen für ein unbekanntes Gewässer an allen Einträgen der Gruppe setzen (leer = entfernen). */
export async function renameUnknownWater(ids: readonly string[], name: string, db: FangpunktDB = getDb()) {
  const n = name.trim().replace(/\s+/g, ' ');
  await db.transaction('rw', db.catches, async () => {
    for (const id of ids) {
      const cur = await db.catches.get(id);
      if (!cur || cur.waterSnapshot?.name) continue; // bekannte Namen bleiben unverändert
      const rest = Object.fromEntries(
        Object.entries(cur.waterSnapshot ?? {}).filter(([k]) => k !== 'customName'),
      ) as NonNullable<typeof cur.waterSnapshot>;
      const snap = n ? { ...rest, customName: n } : rest;
      await repo('catches', db).update(id, { waterSnapshot: Object.keys(snap).length ? snap : undefined });
    }
  });
}
