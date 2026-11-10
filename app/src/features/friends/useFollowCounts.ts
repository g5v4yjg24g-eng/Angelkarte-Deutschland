// Eigene Zahlen Follower · Gefolgt · offene Anfragen (Paket C). Nur mit gespeicherter Anmeldung; ohne Konto
// oder bei Fehler undefined (die Profilseite zeigt dann „–“).
import { useEffect, useState } from 'react';
import type { FollowCounts } from '../../domain/follows';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';

export function useFollowCounts(): FollowCounts | undefined {
  const { account } = useProviders();
  const signedIn = account.enabled && !!storedUserId();
  const [counts, setCounts] = useState<FollowCounts>();
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    account
      .followCounts()
      .then((c) => live && setCounts(c))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [account, signedIn]);
  return signedIn ? counts : undefined;
}
