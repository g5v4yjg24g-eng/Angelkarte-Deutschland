// Gemeinsame Sessions (Paket 8a), Seite des Geräts: die eigene Session mit der gemeinsamen verknüpfen. Fänge,
// Route und Pausen bleiben lokal – verknüpft wird nur die ID.
import { runningSession } from '../domain/session';
import { DEFAULT_TZ, nowIso } from '../domain/time';
import type { Session } from '../domain/schemas';
import { getDb, type FangpunktDB } from './db';
import { repo } from './repository';

export class GroupSessionBusyError extends Error {
  override name = 'GroupSessionBusyError';
}

/** Eigene Session mit einer gemeinsamen verknüpfen (oder die Verknüpfung lösen) */
export function linkGroup(sessionId: string, groupId: string | undefined, db: FangpunktDB = getDb()) {
  return repo('sessions', db).update(sessionId, { groupId });
}

/**
 * Nach dem Zusagen: läuft schon eine eigene Session ohne Verknüpfung, wird sie verknüpft; sonst startet eine neue.
 * Läuft eine Session einer anderen gemeinsamen Session → GroupSessionBusyError.
 */
export async function joinGroupLocally(
  group: { id: string; title?: string | undefined },
  db: FangpunktDB = getDb(),
  tz: string = DEFAULT_TZ,
): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const all = await db.sessions.toArray();
    const linked = all.find((s) => !s.deletedAt && s.groupId === group.id);
    if (linked) return linked;
    const running = runningSession(all);
    if (running) {
      if (running.groupId) throw new GroupSessionBusyError('Es läuft bereits eine gemeinsame Session.');
      return repo('sessions', db).update(running.id, { groupId: group.id });
    }
    return repo('sessions', db).create({ startAt: nowIso(tz), tz, title: group.title, groupId: group.id });
  });
}
