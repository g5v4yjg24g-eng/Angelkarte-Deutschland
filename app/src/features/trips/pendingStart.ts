// Wartezustand des Erstellers (siehe domain/tripStart.ts): in localStorage, damit er Seitenwechsel und App-Neustart
// überlebt. Ohne Speicher (privates Fenster) gilt nur der Stand im Arbeitsspeicher.
import { useSyncExternalStore } from 'react';
import { REQUEST_MAX_AGE_MS, parsePendingStart, type PendingStart } from '../../domain/tripStart';

const KEY = 'fangpunkt.tripStart';
let memory: string | null = null;
const listeners = new Set<() => void>();

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY) ?? memory;
  } catch {
    return memory;
  }
}

function snapshot(): string | null {
  const p = parsePendingStart(readRaw());
  // zu alte Anfrage (App lange zu): vergessen, der Server zeigt sie auch nicht mehr
  if (p && Date.now() - p.since > REQUEST_MAX_AGE_MS) {
    writePending(undefined);
    return null;
  }
  return p ? JSON.stringify(p) : null;
}

export function writePending(p: PendingStart | undefined) {
  memory = p ? JSON.stringify(p) : null;
  try {
    if (p) localStorage.setItem(KEY, JSON.stringify(p));
    else localStorage.removeItem(KEY);
  } catch {
    // nur Komfort
  }
  listeners.forEach((l) => l());
}

export const readPending = (): PendingStart | undefined => parsePendingStart(snapshot());

export function usePendingStart(): PendingStart | undefined {
  const raw = useSyncExternalStore((cb) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, snapshot);
  return parsePendingStart(raw);
}
