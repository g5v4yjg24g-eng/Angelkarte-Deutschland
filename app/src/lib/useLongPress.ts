// Langes Drücken (Touch, Stift, Maus): löst nach `ms` aus, wenn der Finger ruhig bleibt. Bewegt er sich weiter als
// `slop` Pixel (Scrollen, Wischen) oder wird losgelassen, passiert nichts. Nach dem Auslösen werden das folgende
// Antippen (click) und das Kontextmenü unterdrückt, damit das Drücken nichts anderes anstößt.
import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent } from 'react';

export const LONG_PRESS_MS = 450;
export const LONG_PRESS_SLOP = 10;

export function useLongPress(onLong: () => void, enabled = true, ms = LONG_PRESS_MS) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const start = useRef<{ x: number; y: number } | undefined>(undefined);
  const fired = useRef(false);
  const latest = useRef(onLong);
  useEffect(() => {
    latest.current = onLong;
  });
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = undefined;
    start.current = undefined;
  }, []);
  useEffect(() => cancel, [cancel]);

  return {
    onPointerDown: (e: PointerEvent) => {
      if (!enabled || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
      fired.current = false;
      start.current = { x: e.clientX, y: e.clientY };
      timer.current = setTimeout(() => {
        timer.current = undefined;
        fired.current = true;
        latest.current();
      }, ms);
    },
    onPointerMove: (e: PointerEvent) => {
      const s = start.current;
      if (s && Math.hypot(e.clientX - s.x, e.clientY - s.y) > LONG_PRESS_SLOP) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onPointerLeave: cancel,
    /** nach dem langen Drücken keinen Link öffnen */
    onClickCapture: (e: MouseEvent) => {
      if (fired.current) {
        fired.current = false;
        e.preventDefault();
        e.stopPropagation();
      }
    },
    /** Kontextmenü/Bildvorschau des Systems würde sonst das große Bild überdecken */
    onContextMenu: (e: MouseEvent) => {
      if (enabled) e.preventDefault();
    },
  };
}
