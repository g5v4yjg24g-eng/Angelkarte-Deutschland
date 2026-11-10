// Beiträge, die wegen der Server-Grenze (20 neue in 24 h, Paket 7c) noch warten – nur im Speicher; der nächste
// Abgleich (z. B. beim nächsten Start) versucht es erneut und setzt den Stand neu.
import { useSyncExternalStore } from 'react';

let limited: ReadonlySet<string> = new Set();
const listeners = new Set<() => void>();

export function setLimitedPosts(ids: readonly string[]) {
  // nichts geändert → kein neues Objekt, keine Neuzeichnung
  if (ids.length === limited.size && ids.every((id) => limited.has(id))) return;
  limited = new Set(ids);
  for (const l of listeners) l();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const snapshot = () => limited;

export function useLimitedPosts(): ReadonlySet<string> {
  return useSyncExternalStore(subscribe, snapshot);
}

// Beiträge, deren Hochladen fehlgeschlagen ist (z. B. keine Verbindung) – nur im Speicher; „Erneut versuchen“
// stößt einen neuen Abgleich an
let failed: ReadonlySet<string> = new Set();
let retryTick = 0;
const failedListeners = new Set<() => void>();
const notifyFailed = () => failedListeners.forEach((l) => l());

export function setFailedPosts(ids: readonly string[]) {
  if (ids.length === failed.size && ids.every((id) => failed.has(id))) return;
  failed = new Set(ids);
  notifyFailed();
}
export function retryPostSync() {
  retryTick++;
  failed = new Set();
  notifyFailed();
}
const subscribeFailed = (l: () => void) => {
  failedListeners.add(l);
  return () => {
    failedListeners.delete(l);
  };
};
export const useFailedPosts = (): ReadonlySet<string> => useSyncExternalStore(subscribeFailed, () => failed);
export const useRetryTick = (): number => useSyncExternalStore(subscribeFailed, () => retryTick);
