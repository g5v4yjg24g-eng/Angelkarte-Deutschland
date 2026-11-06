// Eigene Regeln je Gewässer (Paket 9A): freier Text des Nutzers, z. B. vom Erlaubnisschein. Nicht geprüft, bleibt auf
// dem Gerät, ist Teil der Sicherung. Leerer Text entfernt die Regeln.
import type { WaterRules } from '../domain/schemas';
import { getDb, type FangpunktDB } from './db';
import { repo } from './repository';

export const waterRulesIdOf = (waterId: string) => `waterrules-${waterId}`;

export async function getWaterRules(
  waterId: string,
  db: FangpunktDB = getDb(),
): Promise<WaterRules | undefined> {
  const r = await db.waterRules.get(waterRulesIdOf(waterId));
  return r && !r.deletedAt ? r : undefined;
}

/** Speichern; ein gelöschter Eintrag wird wiederverwendet. Leerer Text → entfernen. */
export async function saveWaterRules(
  waterId: string,
  text: string,
  db: FangpunktDB = getDb(),
): Promise<WaterRules | undefined> {
  const id = waterRulesIdOf(waterId);
  const clean = text.trim();
  const r = repo('waterRules', db);
  return db.transaction('rw', db.waterRules, async () => {
    const cur = await db.waterRules.get(id);
    if (!clean) {
      if (cur && !cur.deletedAt) await r.remove(id);
      return undefined;
    }
    if (!cur) return r.create({ id, waterId, text: clean });
    if (cur.deletedAt) await r.restore(id);
    return r.update(id, { text: clean });
  });
}
