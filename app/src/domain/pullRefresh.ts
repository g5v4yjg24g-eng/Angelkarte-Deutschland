// Nach unten ziehen zum Aktualisieren (Wunsch Nutzer 2026-11-12). Rein, ohne DOM: wie weit sich die Liste mit dem
// Finger mitzieht und ab wann losgelassen aktualisiert wird.

/** Ab dieser Zugweite (px, schon gedämpft) löst Loslassen die Aktualisierung aus */
export const PULL_THRESHOLD = 64;
/** Weiter als das lässt sich die Liste nicht ziehen */
export const PULL_MAX = 110;

/** Gedämpfte Zugweite: anfangs fast 1:1, dann zunehmend zäh, nie über PULL_MAX */
export function pullOffset(dy: number): number {
  if (!(dy > 0)) return 0;
  return PULL_MAX * (1 - Math.exp(-dy / (PULL_MAX * 1.2)));
}

/** Darf ein Zug beginnen? Nur ganz oben in der Liste, mit einem Finger */
export function canStartPull(scrollTop: number, touches: number): boolean {
  return scrollTop <= 0 && touches === 1;
}

export const isPullReady = (offset: number): boolean => offset >= PULL_THRESHOLD;
