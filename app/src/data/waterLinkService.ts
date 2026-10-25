// Eigener Link zur Angelkarte je Gewässer (Gewässerkarte, Variante C). Bleibt auf dem Gerät, ist Teil der Sicherung.
import type { WaterLink } from '../domain/schemas';
import { getDb, type FangpunktDB } from './db';
import { repo } from './repository';

export const waterLinkIdOf = (waterId: string) => `waterlink-${waterId}`;

export async function getWaterLink(
  waterId: string,
  db: FangpunktDB = getDb(),
): Promise<WaterLink | undefined> {
  const l = await db.waterLinks.get(waterLinkIdOf(waterId));
  return l && !l.deletedAt ? l : undefined;
}

/** Speichert den Link (url bereits geprüft, siehe normalizeUserUrl); ein gelöschter Link wird wiederverwendet. */
export async function saveWaterLink(
  waterId: string,
  url: string,
  label: string | undefined,
  db: FangpunktDB = getDb(),
): Promise<WaterLink> {
  const id = waterLinkIdOf(waterId);
  const r = repo('waterLinks', db);
  return db.transaction('rw', db.waterLinks, async () => {
    const cur = await db.waterLinks.get(id);
    if (!cur) return r.create({ id, waterId, url, ...(label ? { label } : {}) });
    if (cur.deletedAt) await r.restore(id);
    return r.update(id, { url, label: label || undefined });
  });
}

export const removeWaterLink = (waterId: string, db: FangpunktDB = getDb()) =>
  repo('waterLinks', db).remove(waterLinkIdOf(waterId));
