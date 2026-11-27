// Punkte unter dem Foto-Karussell gedrückt halten und bewegen: das Karussell springt mit dem Finger von Foto zu Foto
// (wie bei Instagram). Auch ein Tipp auf einen Punkt springt zu diesem Foto. Der Finger muss nicht auf dem Punkt
// bleiben – er wird beim Drücken festgehalten (Pointer Capture) und über den ersten/letzten Punkt hinaus an den Rand gesetzt.
// Nach kurzem Halten (`HOLD_MS`) meldet `onHold` einmal – dafür gibt es eine Vibration (Wunsch Nutzer 2026-11-27).
import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { dotIndexAt } from '../domain/swipe';

export const HOLD_MS = 350;

export function useDotScrub(
  count: number,
  /** springt ohne Übergang zum Foto (Wechsel meldet das Karussell selbst) */
  jumpTo: (index: number) => void,
  /** das Halten dauert lang genug: einmal je Drücken */
  onHold?: () => void,
) {
  const [scrubbing, setScrubbing] = useState(false);
  const active = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const holdRef = useRef(onHold);
  useEffect(() => {
    holdRef.current = onHold;
  });
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const go = (e: PointerEvent<HTMLElement>) => {
    const dots = e.currentTarget.querySelectorAll<HTMLElement>('[data-dot]');
    const a = dots[0]?.getBoundingClientRect();
    const b = dots[dots.length - 1]?.getBoundingClientRect();
    if (!a || !b) return;
    jumpTo(dotIndexAt(e.clientX, a.left + a.width / 2, b.left + b.width / 2, count));
  };

  const end = () => {
    window.clearTimeout(timer.current);
    if (!active.current) return;
    active.current = false;
    setScrubbing(false);
  };

  return {
    scrubbing,
    handlers: {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (!e.isPrimary || count < 2) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        active.current = true;
        setScrubbing(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => holdRef.current?.(), HOLD_MS);
        go(e);
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        if (active.current) go(e);
      },
      onPointerUp: end,
      onPointerCancel: end,
    },
  };
}
