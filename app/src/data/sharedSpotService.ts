// Geteilten Spot eines Freundes in die eigenen Orte übernehmen (Etappe 4). Danach ist er ein ganz normaler
// eigener Ort (Teil der Sicherung) – auch wenn der Freund das Teilen später beendet.
import { adoptedPlace, adoptFields, type SharedSpot } from '../domain/sharedSpots';
import type { Place } from '../domain/schemas';
import { getDb, type FangpunktDB } from './db';
import { repo } from './repository';

export async function adoptSharedSpot(
  spot: SharedSpot,
  originLabel: (name: string, username: string) => string,
  db: FangpunktDB = getDb(),
): Promise<Place> {
  const existing = adoptedPlace(spot, await db.places.toArray());
  if (existing) return existing;
  const r = repo('places', db);
  return r.create(adoptFields(spot, originLabel) as Parameters<typeof r.create>[0]);
}
