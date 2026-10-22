// Sessions starten und beenden. „Nur eine läuft" wird in einer Transaktion geprüft (SES-2).
import type { Session } from '../domain/schemas';
import { runningSession } from '../domain/session';
import { DEFAULT_TZ, nowIso, toZonedIso } from '../domain/time';
import { getDb, type FangpunktDB } from './db';
import { repo } from './repository';

export class SessionRunningError extends Error {
  override name = 'SessionRunningError';
}

export async function startSession(db: FangpunktDB = getDb(), tz: string = DEFAULT_TZ): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    if (runningSession(await db.sessions.toArray()))
      throw new SessionRunningError('Es läuft bereits eine Session.');
    return repo('sessions', db).create({ startAt: nowIso(tz), tz });
  });
}

/** Beenden (jetzt oder zu einem korrigierten Zeitpunkt, SES-3). */
export async function endSession(
  id: string,
  endMs: number = Date.now(),
  db: FangpunktDB = getDb(),
): Promise<Session> {
  const s = await db.sessions.get(id);
  if (!s) throw new Error(`Session ${id} nicht gefunden`);
  return repo('sessions', db).update(id, { endAt: toZonedIso(endMs, s.tz) });
}
