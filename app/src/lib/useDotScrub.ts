// Punkte unter dem Foto-Karussell gedrückt halten und bewegen: das Karussell springt mit dem Finger von Foto zu Foto
// (wie bei Instagram). Auch ein Tipp auf einen Punkt springt zu diesem Foto. Der Finger muss nicht auf dem Punkt
// bleiben – er wird beim Drücken festgehalten (Pointer Capture) und über den ersten/letzten Punkt hinaus an den Rand gesetzt.
import { useRef, useState, type PointerEvent, type RefObject } from 'react';
import { dotIndexAt } from '../domain/swipe';

export function useDotScrub(
  listRef: RefObject<HTMLElement | null>,
  count: number,
  /** wird bei jedem Wechsel des Fotos aufgerufen (z. B. leichte Vibration) */
  onStep?: () => void,
) {
  const [scrubbing, setScrubbing] = useState(false);
  const last = useRef(-1);

  const indexAt = (e: PointerEvent<HTMLElement>) => {
    const dots = e.currentTarget.querySelectorAll<HTMLElement>('[data-dot]');
    const a = dots[0]?.getBoundingClientRect();
    const b = dots[dots.length - 1]?.getBoundingClientRect();
    if (!a || !b) return 0;
    return dotIndexAt(e.clientX, a.left + a.width / 2, b.left + b.width / 2, count);
  };

  const go = (e: PointerEvent<HTMLElement>) => {
    const el = listRef.current;
    if (!el) return;
    const i = indexAt(e);
    if (i === last.current) return;
    const first = last.current < 0;
    last.current = i;
    if (el.style.scrollSnapType !== 'none') el.style.scrollSnapType = 'none';
    el.scrollLeft = i * Math.max(1, el.clientWidth);
    if (!first) onStep?.();
  };

  const end = () => {
    if (last.current < 0) return;
    last.current = -1;
    setScrubbing(false);
    const el = listRef.current;
    if (el) el.style.scrollSnapType = '';
  };

  return {
    scrubbing,
    handlers: {
      onPointerDown: (e: PointerEvent<HTMLElement>) => {
        if (!e.isPrimary || count < 2) return;
        e.currentTarget.setPointerCapture?.(e.pointerId);
        setScrubbing(true);
        go(e);
      },
      onPointerMove: (e: PointerEvent<HTMLElement>) => {
        if (last.current >= 0) go(e);
      },
      onPointerUp: end,
      onPointerCancel: end,
    },
  };
}
