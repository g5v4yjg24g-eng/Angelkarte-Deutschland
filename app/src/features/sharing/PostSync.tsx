// Gleicht im Hintergrund geteilte Beiträge mit dem Server ab (Etappe 2) – nur angemeldet und online.
import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useProviders } from '../../ports/providersContext';
import { useOnline } from '../../lib/useOnline';
import { pendingPostKey, syncPosts } from '../../data/postSyncService';
import { storedUserId } from '../badges/badgeStore';

export function PostSync() {
  const { account } = useProviders();
  const online = useOnline();
  const key = useLiveQuery(() => pendingPostKey(), []);
  const running = useRef(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    if (!key || !online || !account.enabled || !storedUserId() || running.current) return;
    running.current = true;
    void syncPosts(account)
      .then((r) => {
        running.current = false;
        // Änderungen während des Laufs: noch einmal
        if (r.done && !r.failed) setRound((n) => n + 1);
      })
      .catch(() => {
        running.current = false;
      });
  }, [key, online, account, round]);

  return null;
}
