// Lädt die eigenen Gewässer (nur Kennung und Name, höchstens 30) im Hintergrund hoch, solange „Gewässer für Vorschläge
// nutzen“ an ist – nur angemeldet und online, nur bei Änderung (Merker je Konto). Ist der Schalter aus, geschieht nichts.
import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef } from 'react';
import { getDb } from '../../data/db';
import { sharedWaters, watersKey } from '../../domain/suggestions';
import { useOnline } from '../../lib/useOnline';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';
import { pushWaters, readWatersKey, setWatersOn, useWatersOn } from './waterShare';

export function WaterShareSync() {
  const { account } = useProviders();
  const online = useOnline();
  const me = account.enabled ? storedUserId() : undefined;
  const on = useWatersOn();
  const running = useRef(false);
  const list = useLiveQuery(async () => {
    const db = getDb();
    const [catches, sessions] = await Promise.all([db.catches.toArray(), db.sessions.toArray()]);
    return sharedWaters(catches, sessions);
  });

  // Schalter einmal vom Server lesen
  useEffect(() => {
    if (!me || !online || on !== undefined) return;
    let live = true;
    account
      .suggestionPrefs()
      .then((p) => live && setWatersOn(p.watersOn))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [me, online, on, account]);

  const key = me && list ? watersKey(me, list) : undefined;
  useEffect(() => {
    if (!me || !list || !key || !online || on !== true || running.current || readWatersKey() === key) return;
    running.current = true;
    pushWaters(account, me, list)
      .catch(() => undefined)
      .finally(() => {
        running.current = false;
      });
    // list hängt vollständig an key
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, online, on, me, account]);

  return null;
}
