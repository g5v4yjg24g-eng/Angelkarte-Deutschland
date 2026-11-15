// Knöpfe der Live Activity: die App öffnet sich über `fangpunkt://session/<aktion>` und führt die Aktion aus.
// Pause und Weiter ändern die laufende Session; „Beenden“ führt zur Session (dort steht „Session beenden“ mit Rückfrage,
// ein versehentliches Tippen auf dem Sperrbildschirm soll nichts beenden); „Fang erfassen“ öffnet die Karte im Modus
// „Fangstelle wählen“.
import { getDb } from '../../../data/db';
import { pauseSession, resumeSession } from '../../../data/sessionService';
import type { LiveLinkAction } from '../../../domain/liveLink';
import { openPause, runningSession } from '../../../domain/session';

type Navigate = (to: string, options?: { state?: unknown }) => void | Promise<void>;

export async function runLiveAction(action: LiveLinkAction, navigate: Navigate): Promise<void> {
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
    case 'end':
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
