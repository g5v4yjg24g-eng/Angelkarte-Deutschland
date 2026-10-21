import { de } from '../../i18n/de';
import { startSession } from '../../data/sessionService';
import { userMessage } from '../../data/errors';

/** Startet eine Session; liefert eine Fehlermeldung (z. B. „läuft bereits") statt zu werfen. */
export async function tryStartSession(): Promise<{ id?: string; error?: string }> {
  try {
    return { id: (await startSession()).id };
  } catch (err) {
    return {
      error: (err as Error).name === 'SessionRunningError' ? de.sessions.alreadyRunning : userMessage(err),
    };
  }
}
