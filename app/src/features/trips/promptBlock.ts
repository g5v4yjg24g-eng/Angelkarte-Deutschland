// Fenster „Session startet“ dürfen nicht überall aufpoppen (Wunsch Nutzer 2026-11-11): nicht beim Profilbild- und
// Beitrags-Hochladen, sonst ginge dort etwas verloren. Solche Seiten melden sich mit `usePromptBlock` an; solange
// mindestens eine da ist, bleiben die Fenster zurück und erscheinen danach.
import { useEffect, useSyncExternalStore } from 'react';

let blockers = 0;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

/** Meldet die aufrufende Ansicht als „bitte nicht stören“, solange `active` gilt */
export function usePromptBlock(active = true) {
  useEffect(() => {
    if (!active) return;
    blockers++;
    notify();
    return () => {
      blockers--;
      notify();
    };
  }, [active]);
}

export function usePromptsBlocked(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => blockers > 0,
  );
}
