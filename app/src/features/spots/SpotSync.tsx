// Hintergrund: eigene Orte mit angenommenen Partnern teilen (siehe data/spotSyncService.ts). Läuft beim Start, wenn sich
// Orte ändern, beim Zurückkehren in die App, alle 5 Minuten und nach Annehmen/Beenden einer Verbindung. Nur mit
// gespeicherter Anmeldung und online; Fehler sind still, der nächste Lauf macht weiter.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useState } from 'react';
import { getDb } from '../../data/db';
import { runSpotSync } from '../../data/spotSyncService';
import { parseSpotSyncState, type SpotSyncState } from '../../domain/spotSync';
import { useOnline } from '../../lib/useOnline';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';
import { SPOTS_CHANGED } from './spotsChanged';


const KEY = (userId: string) => `fangpunkt.spotSync.${userId}`;
const INTERVAL_MS = 5 * 60_000;
const DELAY_MS = 1500;

const load = (userId: string): SpotSyncState => {
  try {
    return parseSpotSyncState(localStorage.getItem(KEY(userId)));
  } catch {
    return {};
  }
};
const save = (userId: string, state: SpotSyncState) => {
  try {
    localStorage.setItem(KEY(userId), JSON.stringify(state));
  } catch {
    // Speicher gesperrt: beim nächsten Lauf wird erneut hochgeladen (der Server aktualisiert, doppelt wird nichts)
  }
};

export function SpotSync() {
  const { account } = useProviders();
  const online = useOnline();
  const me = account.enabled ? storedUserId() : undefined;
  const [tick, setTick] = useState(0);
  // ändert sich, sobald ein Ort angelegt, geändert oder gelöscht wird
  const placesKey = useLiveQuery(
    async () =>
      (await getDb().places.toArray()).map((p) => `${p.id}:${p.rev}:${p.deletedAt ?? ''}`).join('|'),
    [],
  );

  useEffect(() => {
    if (!me) return;
    const bump = () => setTick((n) => n + 1);
    const onVisible = () => {
      if (document.visibilityState === 'visible') bump();
    };
    const timer = window.setInterval(bump, INTERVAL_MS);
    window.addEventListener(SPOTS_CHANGED, bump);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(SPOTS_CHANGED, bump);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [me]);

  useEffect(() => {
    if (!me || !online || placesKey === undefined) return;
    const timer = window.setTimeout(() => {
      void runSpotSync({
        account,
        places: () => getDb().places.toArray(),
        load: () => load(me),
        save: (s) => save(me, s),
      }).catch(() => undefined);
    }, DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [account, me, online, placesKey, tick]);

  return null;
}
