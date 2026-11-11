// Alle Fangbuch-Einträge als gemeinsamer Hook (Technik-Quick-Win): Karte, Fangbuch, Fangformular und Wetter-Orte
// fragten die Datenbank je Ansicht einzeln komplett ab. Hier gibt es eine gemeinsame, laufend aktuelle Abfrage; der
// letzte Stand bleibt beim Seitenwechsel erhalten und erscheint sofort, während im Hintergrund aktualisiert wird.
// Gilt je Datenbank-Instanz (Tests tauschen sie aus).
import { liveQuery, type Subscription } from 'dexie';
import { useSyncExternalStore } from 'react';
import type { Catch } from '../domain/schemas';
import { getDb, type FangpunktDB } from './db';

let boundTo: FangpunktDB | undefined;
let current: Catch[] | undefined;
let subscription: Subscription | undefined;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function start() {
  const db = getDb();
  if (boundTo !== db) {
    boundTo = db;
    current = undefined;
  }
  subscription = liveQuery(() => db.catches.toArray()).subscribe({
    next: (rows) => {
      current = rows;
      emit();
    },
    error: () => undefined,
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      subscription?.unsubscribe();
      subscription = undefined;
    }
  };
}

/** Alle Einträge (auch gelöschte, wie `catches.toArray()`); `undefined`, bis der erste Stand da ist */
export function useCatches(): Catch[] | undefined {
  return useSyncExternalStore(subscribe, () => (boundTo === getDb() ? current : undefined));
}
