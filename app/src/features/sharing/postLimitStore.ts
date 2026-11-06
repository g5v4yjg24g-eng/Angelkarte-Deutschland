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
