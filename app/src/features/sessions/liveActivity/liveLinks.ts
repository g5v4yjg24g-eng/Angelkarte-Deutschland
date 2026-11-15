// Knöpfe der Live Activity: die App öffnet sich über `fangpunkt://session/<aktion>` und führt aus, was auf dem Knopf
// steht (Wunsch Nutzer 2026-11-15): Pause und Weiter ändern die laufende Session, „Beenden“ beendet sie wie der Knopf
// „Session beenden“ (Gastgeber beendet auch die gemeinsame Session) und öffnet den Rückblick, „Fang erfassen“ öffnet die
// Karte im Modus „Fangstelle wählen“.
import { getDb } from '../../../data/db';
import { endSession, pauseSession, resumeSession } from '../../../data/sessionService';
import type { LiveLinkAction } from '../../../domain/liveLink';
import { openPause, runningSession } from '../../../domain/session';

type Navigate = (to: string, options?: { state?: unknown }) => void | Promise<void>;

export async function runLiveAction(
  action: LiveLinkAction,
  navigate: Navigate,
  /** Gemeinsame Session auf dem Server beenden (nur mit Konto); Fehler sind egal */
  endGroup?: (groupId: string) => Promise<unknown>,
): Promise<void> {
  const sessions = await getDb().sessions.toArray();
  const running = runningSession(sessions);
  switch (action) {
    case 'pause':
      if (running && !openPause(running)) await pauseSession(running.id).catch(() => undefined);
      void navigate(running ? `/fangbuch/sessions/${running.id}` : '/fangbuch/sessions');
      return;
    case 'resume':
      if (running && openPause(running)) await resumeSession(running.id).catch(() => undefined);
      void navigate(running ? `/fangbuch/sessions/${running.id}` : '/fangbuch/sessions');
      return;
    case 'end': {
      if (!running) {
        void navigate('/fangbuch/sessions');
        return;
      }
      // Erst speichern, dann den Rückblick öffnen (er liest nur gespeicherte Daten)
      const ended = await endSession(running.id).catch(() => undefined);
      if (ended?.groupId && endGroup) await endGroup(ended.groupId).catch(() => undefined);
      void navigate(ended ? `/fangbuch/sessions/${ended.id}/rueckblick` : `/fangbuch/sessions/${running.id}`);
      return;
    }
    case 'open':
      void navigate(running ? `/fangbuch/sessions/${running.id}` : '/fangbuch/sessions');
      return;
    case 'catch':
      void navigate('/', { state: { startCatch: true } });
      return;
    case 'review': {
      const last = sessions
        .filter((s) => s.endAt && !s.deletedAt)
        .sort((a, b) => Date.parse(b.endAt ?? '') - Date.parse(a.endAt ?? ''))[0];
      void navigate(last ? `/fangbuch/sessions/${last.id}/rueckblick` : '/fangbuch/sessions');
      return;
    }
  }
}
