// Meine Spot-Verbindungen vom Server (nur mit gespeicherter Anmeldung, sonst kein Netz). Nach Annehmen, Beenden usw.
// neu laden; die Liste bleibt beim Neuladen stehen.
import { useCallback, useEffect, useState } from 'react';
import type { SpotLink } from '../../domain/spotLinks';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';

export type SpotLinksState =
  | { kind: 'signedOut' }
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | { kind: 'ready'; list: SpotLink[] };

export function useSpotLinks(): { state: SpotLinksState; reload: () => Promise<void> } {
  const { account } = useProviders();
  const userId = account.enabled ? storedUserId() : undefined;
  const [state, setState] = useState<SpotLinksState>({ kind: 'loading' });

  const reload = useCallback(async () => {
    if (!userId) return;
    try {
      const list = await account.spotLinks();
      setState({ kind: 'ready', list });
    } catch (error) {
      setState((cur) => (cur.kind === 'ready' ? cur : { kind: 'error', error }));
    }
  }, [account, userId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state: userId ? state : { kind: 'signedOut' }, reload };
}
