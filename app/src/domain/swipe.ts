// Foto-Karussell (Fehler Nutzer 2026-11-10: beim Scrollen im Feed verschoben sich die Fotos mit). Senkrechtes Wischen
// übernimmt der Browser (touch-action: pan-y); waagerechtes Wischen entscheidet die App selbst – erst, wenn die
// Bewegung eindeutig waagerecht ist. Rein (ohne DOM).

/** Ab so vielen Pixeln steht die Richtung fest */
export const AXIS_LOCK_PX = 10;

/**
 * Richtung einer Wischbewegung: 'x' nur, wenn deutlich waagerecht (mehr als doppelt so weit zur Seite wie nach oben
 * oder unten), sonst 'y'; undefined, solange sie noch zu kurz ist.
 */
export function swipeAxis(dx: number, dy: number): 'x' | 'y' | undefined {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  if (Math.max(ax, ay) < AXIS_LOCK_PX) return undefined;
  return ax > 2 * ay ? 'x' : 'y';
}

/**
 * Ziel-Foto nach dem Loslassen: weiter, wenn um mindestens 20 % der Breite gewischt oder schnell (≥ 0,3 px/ms über
 * mindestens 20 px) – sonst zurück zum Ausgangsfoto. Nie über den Rand hinaus.
 */
export function swipeTarget(start: number, count: number, dx: number, width: number, ms: number): number {
  if (count <= 1 || width <= 0) return Math.max(0, Math.min(start, count - 1));
  const fast = Math.abs(dx) >= 20 && Math.abs(dx) / Math.max(1, ms) >= 0.3;
  const far = Math.abs(dx) >= width * 0.2;
  const step = far || fast ? (dx < 0 ? 1 : -1) : 0;
  return Math.max(0, Math.min(count - 1, start + step));
}
