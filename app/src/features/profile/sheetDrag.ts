// Kommentar-Fenster per Herunterziehen schließen (Wunsch Nutzer 2026-10-27, wie bei Instagram).

/** Ab dieser Geschwindigkeit (px/ms) nach unten genügt ein kurzer Wisch */
export const FLICK_SPEED = 0.5;
/** Mindestweg für einen Wisch */
export const FLICK_MIN_PX = 30;
/** Ohne Schwung: Anteil der Fensterhöhe, ab dem es schließt */
export const CLOSE_SHARE = 0.25;

/** Nach dem Loslassen schließen? `dy` > 0 = nach unten gezogen */
export function shouldClose(dy: number, speed: number, height: number): boolean {
  if (dy <= 0) return false;
  if (speed >= FLICK_SPEED && dy >= FLICK_MIN_PX) return true;
  return dy >= height * CLOSE_SHARE;
}

/** Nach oben nicht über den Rand ziehen, nach unten frei */
export const dragOffset = (dy: number) => Math.max(0, dy);
