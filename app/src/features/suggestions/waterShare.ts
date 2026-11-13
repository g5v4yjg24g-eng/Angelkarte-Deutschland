// Gewässer für Vorschläge („Angler entdecken“, Entscheidung Nutzer 2026-11-13: eigener Schalter, nur Gewässerkennung und
// -name, Standard an): Liste aus den eigenen Fängen und Sessions, Stand je Konto gemerkt, Schalter gemeinsam für die
// Einstellung und den Hintergrundabgleich.
import { useSyncExternalStore } from 'react';
import { getDb } from '../../data/db';
import { sharedWaters, watersKey, type ShareWater } from '../../domain/suggestions';
import type { AccountProvider } from '../../ports/account';

export const WATERS_KEY = 'fangpunkt.watersShared';

export const readWatersKey = () => {
  try {
    return localStorage.getItem(WATERS_KEY);
  } catch {
    return null;
  }
};
export const writeWatersKey = (v: string | null) => {
  try {
    if (v === null) localStorage.removeItem(WATERS_KEY);
    else localStorage.setItem(WATERS_KEY, v);
  } catch {
    // Speicher gesperrt: beim nächsten Start erneut
  }
};

/** Eigene Gewässer aus dem Fangbuch (nur Fänge und Sessions, nie Orte) */
export async function localWaters(): Promise<ShareWater[]> {
  const db = getDb();
  const [catches, sessions] = await Promise.all([db.catches.toArray(), db.sessions.toArray()]);
  return sharedWaters(catches, sessions);
}

/** Liste jetzt hochladen und den Stand merken */
export async function pushWaters(account: AccountProvider, userId: string, list: readonly ShareWater[]) {
  await account.setMyWaters(list);
  writeWatersKey(watersKey(userId, list));
}

// Schalter „Gewässer für Vorschläge nutzen“: undefined = noch nicht vom Server gelesen
let watersOn: boolean | undefined;
const listeners = new Set<() => void>();
export const setWatersOn = (v: boolean | undefined) => {
  watersOn = v;
  for (const l of listeners) l();
};
export const useWatersOn = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => watersOn,
  );
