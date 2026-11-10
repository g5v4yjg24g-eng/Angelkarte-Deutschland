// Waagerechtes Wischen im Foto-Karussell selbst steuern (siehe domain/swipe.ts). Das Karussell hat touch-action: pan-y:
// Senkrechte Bewegungen scrollt der Browser (dann kommt pointercancel), waagerechte erreichen uns als pointermove.
// Maus und Tastatur nutzen weiter das normale Scrollen (overflow-x).
import { useRef, type PointerEvent, type RefObject } from 'react';
import { swipeAxis, swipeTarget } from '../domain/swipe';

interface Drag {
  x: number;
  y: number;
  t: number;
  left: number;
  axis?: 'x' | 'y' | undefined;
}

export function useSwipeCarousel(ref: RefObject<HTMLElement | null>, count: number) {
  const drag = useRef<Drag | undefined>(undefined);

  const settle = (el: HTMLElement, index: number) => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    el.scrollTo({ left: index * el.clientWidth, behavior: reduce ? 'auto' : 'smooth' });
    // Einrasten erst wieder einschalten, wenn das Gleiten fertig ist
    const restore = () => {
      el.style.scrollSnapType = '';
      el.removeEventListener('scrollend', restore);
    };
    el.addEventListener('scrollend', restore);
    window.setTimeout(restore, 500);
  };

  return {
    onPointerDown: (e: PointerEvent) => {
      const el = ref.current;
      if (!el || !e.isPrimary || e.pointerType === 'mouse') return;
      drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, left: el.scrollLeft };
    },
    onPointerMove: (e: PointerEvent) => {
      const el = ref.current;
      const d = drag.current;
      if (!el || !d || !e.isPrimary) return;
      const dx = e.clientX - d.x;
      d.axis ??= swipeAxis(dx, e.clientY - d.y);
      if (d.axis !== 'x') return;
      el.style.scrollSnapType = 'none';
      el.scrollLeft = d.left - dx;
    },
    onPointerUp: (e: PointerEvent) => {
      const el = ref.current;
      const d = drag.current;
      drag.current = undefined;
      if (!el || !d || d.axis !== 'x') return;
      const w = el.clientWidth;
      const start = Math.round(d.left / Math.max(1, w));
      settle(el, swipeTarget(start, count, e.clientX - d.x, w, e.timeStamp - d.t));
    },
    onPointerCancel: () => {
      const el = ref.current;
      const d = drag.current;
      drag.current = undefined;
      if (el && d?.axis === 'x') settle(el, Math.round(d.left / Math.max(1, el.clientWidth)));
    },
  };
}

type Handlers = Partial<
  Record<'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel', (e: PointerEvent) => void>
>;

/** Zwei Sätze Zeiger-Handler zusammenführen (z. B. Wischen + Doppeltipp-Hecht) */
export function mergeHandlers(a: Handlers, b: Handlers): Required<Handlers> {
  const keys = ['onPointerDown', 'onPointerMove', 'onPointerUp', 'onPointerCancel'] as const;
  return Object.fromEntries(
    keys.map((k) => [
      k,
      (e: PointerEvent) => {
        a[k]?.(e);
        b[k]?.(e);
      },
    ]),
  ) as Required<Handlers>;
}
