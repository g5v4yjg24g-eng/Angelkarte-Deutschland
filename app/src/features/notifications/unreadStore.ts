// Zahl der ungelesenen Mitteilungen – ein gemeinsamer Stand für den Fisch im Feed und die Liste.
import { useEffect, useSyncExternalStore } from 'react';
import type { AccountProvider } from '../../ports/account';

let count = 0;
const listeners = new Set<() => void>();

function set(n: number) {
  if (n === count) return;
  count = n;
  for (const l of listeners) l();
}

/** Nach dem Öffnen der Liste: alles gelesen */
export const clearUnread = () => set(0);
/** Nur für Tests */
export const resetUnread = () => set(0);

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export const POLL_MS = 60_000;

/**
 * Zahl der Ungelesenen, solange der Fisch sichtbar ist: beim Anzeigen, jede Minute und beim Zurückkehren in die App.
 * Fehler (offline) lassen den letzten Stand stehen.
 */
export function useUnreadNotifications(account: AccountProvider, enabled: boolean): number {
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      account
        .unreadNotificationCount()
        .then((n) => {
          if (alive) set(n);
        })
        .catch(() => undefined);
    };
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      alive = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, [account, enabled]);
  return useSyncExternalStore(
    subscribe,
    () => count,
    () => 0,
  );
}
