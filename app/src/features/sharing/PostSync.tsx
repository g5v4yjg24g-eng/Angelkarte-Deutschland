// Sichert Beiträge im Hintergrund auf dem Server (zentrale Bildspeicherung, Freigabe Nutzer 2026-11-10) – nur
// angemeldet und online: lokale Beiträge automatisch übernehmen, hochladen/nachziehen/entfernen, Fehlschläge später
// erneut versuchen, und einmal je Start die eigenen Beiträge holen, die auf diesem Gerät fehlen (weiteres Gerät).
// Über mehrere Tabs läuft immer nur ein Abgleich (Web Locks, wo vorhanden).
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useProviders } from '../../ports/providersContext';
import { useOnline } from '../../lib/useOnline';
import { adoptLocalPosts, pendingPostKey, pullOwnPosts, syncPosts } from '../../data/postSyncService';
import { nextWake } from '../../domain/postSync';
import { getDb } from '../../data/db';
import { useStoredUserId } from '../badges/badgeStore';

/** Nur ein Abgleich gleichzeitig – auch über Tabs hinweg */
function exclusive<T>(fn: () => Promise<T>): Promise<T | undefined> {
  const locks = typeof navigator !== 'undefined' ? navigator.locks : undefined;
  if (!locks) return fn();
  return locks.request('fangpunkt-post-sync', { ifAvailable: true }, (lock) =>
    lock ? fn() : undefined,
  ) as Promise<T | undefined>;
}

/** Konten, deren Beiträge in diesem Start schon geholt wurden */
const pulled = new Set<string>();

export function PostSync() {
  const { account } = useProviders();
  const online = useOnline();
  const stored = useStoredUserId();
  const userId = account.enabled ? stored : undefined;
  const key = useLiveQuery(() => (userId ? pendingPostKey(userId) : ''), [userId]);
  const running = useRef(false);
  /** vom Wecker angestoßen: auch ohne neuen Auslöser laufen (fällig gewordene Versuche) */
  const woken = useRef(false);
  const [round, setRound] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const mounted = useRef(true);

  useEffect(() => {
    if (!userId || !online || running.current) return;
    if (!key && pulled.has(userId) && !woken.current) return;
    woken.current = false;
    running.current = true;
    void exclusive(async () => {
      await adoptLocalPosts(userId);
      const r = await syncPosts(account, userId);
      if (!pulled.has(userId)) {
        pulled.add(userId);
        await pullOwnPosts(account, userId).catch(() => pulled.delete(userId));
      }
      return r;
    })
      .then((r) => {
        running.current = false;
        // Änderungen während des Laufs: noch einmal
        if (r && r.done && !r.failed) setRound((n) => n + 1);
      })
      .catch(() => {
        running.current = false;
      })
      .finally(() => {
        // Wecker für den nächsten fälligen Versuch (Wartezeit nach Fehlschlag)
        void getDb()
          .posts.toArray()
          .then((all) => {
            const at = nextWake(all, Date.now());
            clearTimeout(timer.current);
            if (at !== undefined && mounted.current)
              timer.current = setTimeout(
                () => {
                  woken.current = true;
                  setRound((n) => n + 1);
                },
                Math.min(at - Date.now() + 500, 2 ** 31 - 1),
              );
          });
      });
  }, [key, online, account, userId, round]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearTimeout(timer.current);
    };
  }, []);

  return null;
}
