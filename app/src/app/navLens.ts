// Glas-Linse der unteren Leiste (Wunsch Nutzer 2026-10-22, Vorlage: Video): gedrückt halten und wischen –
// eine Linse folgt dem Finger, vergrößert den Punkt darunter und rastet beim Loslassen auf ihm ein.
// Hier nur die Geometrie; Zeiger und Darstellung in AppShell.

export interface Span {
  left: number;
  width: number;
}

/** Ab dieser Strecke (px) ist es ein Wischen statt eines Tipps */
export const DRAG_START_PX = 8;

/** Index des Punkts unter x (am Rand: erster bzw. letzter). */
export function itemAt(x: number, items: readonly Span[]): number {
  let best = 0;
  let bestD = Infinity;
  items.forEach((s, i) => {
    const d = x < s.left ? s.left - x : x > s.left + s.width ? x - s.left - s.width : 0;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

/** Mitte der Linse: folgt x, bleibt aber innerhalb der äußeren Punkte. */
export function lensCenter(x: number, items: readonly Span[]): number {
  const first = items[0];
  const last = items[items.length - 1];
  if (!first || !last) return x;
  return Math.min(Math.max(x, first.left + first.width / 2), last.left + last.width / 2);
}
