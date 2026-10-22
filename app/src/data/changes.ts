import { getDb, type FangpunktDB } from './db';

/** Anzahl geänderter Datensätze seit einem Zeitpunkt (für die Sicherungs-Erinnerung). */
export async function changesSince(
  iso: string | undefined,
  db: FangpunktDB = getDb(),
): Promise<{ count: number; oldest?: string }> {
  const since = iso ? Date.parse(iso) : -Infinity;
  let count = 0;
  let oldest: string | undefined;
  for (const t of [db.catches, db.places, db.sessions, db.baitPresets, db.trips] as const) {
    await (t as typeof db.catches).each((r) => {
      if (Date.parse(r.updatedAt) > since) {
        count++;
        if (!oldest || r.updatedAt < oldest) oldest = r.updatedAt;
      }
    });
  }
  return oldest ? { count, oldest } : { count };
}
