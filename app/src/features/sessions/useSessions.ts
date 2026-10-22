import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '../../data/db';
import { runningSession } from '../../domain/session';

/** Laufende Session; null = keine, undefined = noch nicht geladen. */
export function useRunningSession() {
  return useLiveQuery(async () => runningSession(await getDb().sessions.toArray()) ?? null, []);
}
