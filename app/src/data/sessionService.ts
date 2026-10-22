// Sessions starten und beenden. „Nur eine läuft" wird in einer Transaktion geprüft (SES-2).
import type { Session } from '../domain/schemas';
import { openPause, pausesUntil, runningSession, withPause, type Pause } from '../domain/session';
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
  const endAt = toZonedIso(endMs, s.tz);
  // Offene Pause endet mit der Session; Pausen nach einem korrigierten Ende entfallen
  return repo('sessions', db).update(id, { endAt, pauses: pausesUntil(s.pauses, endAt) });
}

export class SessionStateError extends Error {
  override name = 'SessionStateError';
}

async function changePauses(
  id: string,
  db: FangpunktDB,
  next: (s: Session) => Pause[] | undefined,
): Promise<Session> {
  return db.transaction('rw', db.sessions, async () => {
    const s = await db.sessions.get(id);
    if (!s || s.deletedAt) throw new Error(`Session ${id} nicht gefunden`);
    return repo('sessions', db).update(id, { pauses: next(s) });
  });
}

/** Pause in der laufenden Session beginnen. */
export function pauseSession(id: string, nowMs = Date.now(), db: FangpunktDB = getDb()): Promise<Session> {
  return changePauses(id, db, (s) => {
    if (s.endAt || openPause(s)) throw new SessionStateError('Session ist beendet oder schon pausiert.');
    return withPause(s.pauses, { from: toZonedIso(nowMs, s.tz) });
  });
}

/** Laufende Pause beenden. */
export function resumeSession(id: string, nowMs = Date.now(), db: FangpunktDB = getDb()): Promise<Session> {
  return changePauses(id, db, (s) => {
    if (!openPause(s)) throw new SessionStateError('Es läuft keine Pause.');
    const to = toZonedIso(Math.max(nowMs, Date.parse(s.pauses?.at(-1)?.from ?? '')), s.tz);
    return (s.pauses ?? []).map((p, i, all) => (i === all.length - 1 ? { from: p.from, to } : p));
  });
}

/** Pause nachtragen; Schema prüft Lage und Überschneidung (ValidationError). */
export function addPause(
  id: string,
  fromMs: number,
  toMs: number,
  db: FangpunktDB = getDb(),
): Promise<Session> {
  return changePauses(id, db, (s) =>
    withPause(s.pauses, { from: toZonedIso(fromMs, s.tz), to: toZonedIso(toMs, s.tz) }),
  );
}

export function removePause(id: string, index: number, db: FangpunktDB = getDb()): Promise<Session> {
  return changePauses(id, db, (s) => {
    const rest = (s.pauses ?? []).filter((_, i) => i !== index);
    return rest.length ? rest : undefined;
  });
}
