// Zustand der Routenaufzeichnung für die Anzeige (Session-Seite, Kopfzeile). Nur im Speicher, nicht in der DB.
import { useSyncExternalStore } from 'react';

export type TrackState =
  /** keine laufende Session */
  | 'idle'
  /** in den Einstellungen ausgeschaltet */
  | 'off'
  /** Session pausiert */
  | 'paused'
  /** App im Hintergrund: Browser liefern dann keinen Standort (PWA-Grenze) */
  | 'hidden'
  /** Standort wird abgefragt, noch kein brauchbarer Punkt */
  | 'waiting'
  /** Punkte werden gespeichert */
  | 'recording'
  /** Standort verweigert */
  | 'denied'
  /** Gerät/Browser liefert keinen Standort */
  | 'unavailable';

export interface TrackStatus {
  state: TrackState;
  /** letzter verworfener Fix war zu ungenau (Anzeige „schwaches GPS-Signal“) */
  weak: boolean;
  lastFixAt?: number | undefined;
}

let status: TrackStatus = { state: 'idle', weak: false };
const listeners = new Set<() => void>();

export function setTrackStatus(next: Partial<TrackStatus>) {
  const merged = { ...status, ...next };
  if (merged.state === status.state && merged.weak === status.weak && merged.lastFixAt === status.lastFixAt)
    return;
  status = merged;
  listeners.forEach((l) => l());
}

export function useTrackStatus(): TrackStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

/** Erneut versuchen (z. B. nach verweigerter Freigabe): die Aufzeichnung startet den Standort-Zuhörer neu. */
const retries = new Set<() => void>();
export function onRetry(fn: () => void) {
  retries.add(fn);
  return () => retries.delete(fn);
}
export const retryTracking = () => retries.forEach((f) => f());
