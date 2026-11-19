// Eine Meldung der anderen Teilnehmer auf die eigene Session anwenden (Wunsch Nutzer 2026-11-21): Pause, Weiter oder
// Ende – zum Zeitpunkt der Meldung. Nur die eigene Session ändert sich; Fänge und Route bleiben unberührt.
import { planSignal, type SessionSignal, type LocalState } from '../domain/sessionSignals';
import { getDb, type FangpunktDB } from './db';
import { markEcho, unmarkEcho } from './signalEcho';
import { endSession, pauseSession, resumeSession } from './sessionService';

export type ApplyResult = 'applied' | 'none';

export async function applySignal(
  signal: SessionSignal,
  nowMs: number = Date.now(),
  db: FangpunktDB = getDb(),
): Promise<ApplyResult> {
  const session = (await db.sessions.toArray()).find((s) => !s.deletedAt && s.groupId === signal.groupId);
  const plan = planSignal(signal, session, nowMs);
  if (!session || plan.action === 'none') return 'none';
  const after: LocalState =
    plan.action === 'pause' ? 'paused' : plan.action === 'resume' ? 'running' : 'ended';
  markEcho(session.id, after);
  try {
    if (plan.action === 'pause') await pauseSession(session.id, plan.atMs, db);
    else if (plan.action === 'resume') await resumeSession(session.id, plan.atMs, db);
    else await endSession(session.id, plan.atMs, db);
    return 'applied';
  } catch {
    unmarkEcho(session.id, after);
    return 'none';
  }
}
