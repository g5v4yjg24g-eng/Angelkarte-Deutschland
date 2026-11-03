// Freunde vom Server laden (nur mit gespeicherter Anmeldung – sonst kein Netz).
import { useCallback, useEffect, useState } from 'react';
import type { FriendEntry } from '../../domain/friends';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';

export type FriendsState =
  | { kind: 'signedOut' }
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | { kind: 'ready'; list: FriendEntry[] };

export function useFriends(): { state: FriendsState; reload: () => void } {
  const { account } = useProviders();
  const signedIn = account.enabled && !!storedUserId();
  const [loaded, setLoaded] = useState<FriendsState>();
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    account
      .friends()
      .then((list) => live && setLoaded({ kind: 'ready', list }))
      .catch((error: unknown) => live && setLoaded({ kind: 'error', error }));
    return () => {
      live = false;
    };
  }, [account, signedIn, tick]);
  // beim Neuladen bleibt die letzte Liste stehen
  return { state: !signedIn ? { kind: 'signedOut' } : (loaded ?? { kind: 'loading' }), reload };
}
