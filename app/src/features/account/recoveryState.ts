// „Passwort vergessen?“: Nach dem Code bzw. dem Link aus der Mail ist man angemeldet und soll direkt ein neues
// Passwort festlegen. Der Merker liegt in sessionStorage (übersteht das Neuladen nach dem Link, nicht den Neustart).
import { useSyncExternalStore } from 'react';

const KEY = 'fangpunkt.passwordRecovery';
const listeners = new Set<() => void>();

const read = () => {
  try {
    return sessionStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};
const write = (on: boolean) => {
  try {
    if (on) sessionStorage.setItem(KEY, '1');
    else sessionStorage.removeItem(KEY);
  } catch {
    // ohne Speicher gilt der Merker nur bis zum nächsten Neuladen nicht – dann hilft erneut „Passwort vergessen?“
  }
  listeners.forEach((l) => l());
};

export const markRecovery = () => write(true);
export const clearRecovery = () => write(false);

export function useRecovery(): boolean {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    read,
    () => false,
  );
}
