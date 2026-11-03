// Geteilte Spots vom Server: einmal geladen und zwischen Karte und Seiten geteilt (5 min), nur mit gespeicherter
// Anmeldung – sonst kein Netz. Nach Teilen/Beenden neu laden.
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import type { SharedSpot } from '../../domain/sharedSpots';
import type { AccountProvider } from '../../ports/account';
import { useProviders } from '../../ports/providersContext';
import { storedUserId } from '../badges/badgeStore';

export type SharedSpotsState =
  | { kind: 'signedOut' }
  | { kind: 'loading' }
  | { kind: 'error'; error: unknown }
  | { kind: 'ready'; list: SharedSpot[] };

const MAX_AGE_MS = 5 * 60_000;

let cache: { userId: string; state: SharedSpotsState; at: number; loading?: Promise<void> } | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

function load(account: AccountProvider, userId: string, force: boolean) {
  const fresh = cache?.userId === userId && Date.now() - cache.at < MAX_AGE_MS;
  if (cache?.loading && cache.userId === userId) return cache.loading;
  if (fresh && !force && cache?.state.kind === 'ready') return Promise.resolve();
  const previous: SharedSpotsState =
    cache?.userId === userId && cache.state.kind === 'ready' ? cache.state : { kind: 'loading' };
  // beim Neuladen bleibt die letzte Liste stehen
  const loading = account
    .sharedSpots()
    .then((list) => {
      if (cache?.userId === userId) cache = { userId, state: { kind: 'ready', list }, at: Date.now() };
    })
    .catch((error: unknown) => {
      if (cache?.userId === userId)
        cache = {
          userId,
          state: previous.kind === 'ready' ? previous : { kind: 'error', error },
          at: previous.kind === 'ready' ? (cache.at ?? 0) : 0,
        };
    })
    .finally(emit);
  cache = { userId, state: previous, at: cache?.userId === userId ? cache.at : 0, loading };
  emit();
  return loading;
}

/** Für Tests und beim Abmelden */
export function clearSharedSpots() {
  cache = undefined;
  emit();
}

export function useSharedSpots(): { state: SharedSpotsState; reload: () => Promise<void> } {
  const { account } = useProviders();
  const userId = account.enabled ? storedUserId() : undefined;
  const snapshot = useSyncExternalStore(subscribe, () => cache);
  useEffect(() => {
    if (userId) void load(account, userId, false);
  }, [account, userId]);
  const reload = useCallback(
    () => (userId ? load(account, userId, true) : Promise.resolve()),
    [account, userId],
  );
  const state: SharedSpotsState = !userId
    ? { kind: 'signedOut' }
    : snapshot?.userId === userId
      ? snapshot.state
      : { kind: 'loading' };
  return { state, reload };
}
