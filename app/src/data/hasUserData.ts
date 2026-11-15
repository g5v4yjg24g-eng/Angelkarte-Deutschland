import { getDb } from './db';

/** Hat die Person schon eigene Daten (Fänge, Orte, Sessions, Termine)? Dann ist es keine neue Installation. */
export async function hasUserData(): Promise<boolean> {
  const db = getDb();
  const counts = await Promise.all([
    db.catches.count(),
    db.places.count(),
    db.sessions.count(),
    db.trips.count(),
  ]);
  return counts.some((n) => n > 0);
}
