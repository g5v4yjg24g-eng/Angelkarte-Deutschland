// Knöpfe der Live Activity ohne App-Öffnen (iOS 17): Das Swift-Modul hat Pause, Weiter oder Beenden schon in der Anzeige
// umgesetzt und merkt die Aktion samt Zeitpunkt vor. Hier wird sie wirklich ausgeführt – zum Zeitpunkt des Knopfdrucks,
// auch wenn die App erst später dazukommt. Fehler (Session schon beendet, Pause nicht möglich) werden still übergangen.
import { getDb } from '../../../data/db';
import { confirmStillFishing, endSession, pauseSession, resumeSession } from '../../../data/sessionService';
import { freshPendingActions, type PendingLiveAction } from '../../../domain/liveActivity';
import { openPause } from '../../../domain/session';

export async function applyPendingActions(
  actions: readonly PendingLiveAction[],
  /** Gemeinsame Session auf dem Server beenden (nur mit Konto); Fehler sind egal */
  endGroup?: (groupId: string) => Promise<unknown>,
  nowMs: number = Date.now(),
): Promise<void> {
  for (const a of freshPendingActions(actions, nowMs)) {
    const s = await getDb().sessions.get(a.sessionId);
    if (!s || s.deletedAt || s.endAt) continue;
    if (a.action === 'pause') {
      if (!openPause(s)) await pauseSession(s.id, a.atMs).catch(() => undefined);
    } else if (a.action === 'resume') {
      if (openPause(s)) await resumeSession(s.id, a.atMs).catch(() => undefined);
    } else if (a.action === 'keep') {
      await confirmStillFishing(s.id, a.atMs).catch(() => undefined);
    } else {
      const ended = await endSession(s.id, a.atMs).catch(() => undefined);
      if (ended?.groupId && endGroup) await endGroup(ended.groupId).catch(() => undefined);
    }
  }
}
