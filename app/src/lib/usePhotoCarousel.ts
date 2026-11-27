// Foto-Karussell mit Verschieben per Transformation statt Scrollen (Fehler Nutzer 2026-11-27: Wischen ruckelte auf dem
// iPhone, zwischendurch blieb die Fläche leer). Die Seiten (`li`) liegen nebeneinander im abgeschnittenen Rahmen und
// werden beim Ziehen mit `translate3d` bewegt – das erledigt die Grafikkarte, ohne Scrollen, Einrasten oder neues Layout.
// Beim Loslassen gleitet die Seite per Übergang ins Ziel (bei reduzierter Bewegung sofort). Senkrecht scrollt weiter die
// Seite (touch-action: pan-y). Maus (Ziehen, seitliches Trackpad) und Pfeiltasten gehen ebenfalls.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { swipeAxis, swipeTarget } from '../domain/swipe';

const SETTLE_MS = 260;
const EDGE_RESIST = 0.35;

interface Drag {
  x: number;
  y: number;
  t: number;
  w: number;
  axis?: 'x' | 'y' | undefined;
}

export function usePhotoCarousel(count: number, onChange?: (index: number) => void) {
  const ref = useRef<HTMLUListElement>(null);
  const [index, setIndex] = useState(0);
  const current = useRef(0);
  const drag = useRef<Drag | undefined>(undefined);
  const lastWheel = useRef(0);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  });

  const place = (offsetPx: number, animate: boolean) => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const transition = animate && !reduce ? `transform ${SETTLE_MS}ms cubic-bezier(0.22, 0.8, 0.3, 1)` : 'none';
    for (const li of Array.from(el.children) as HTMLElement[]) {
      li.style.transition = transition;
      li.style.transform = `translate3d(calc(${-current.current * 100}% + ${offsetPx}px), 0, 0)`;
    }
  };

  /** Zu einer Seite wechseln; `animate` = gleiten, sonst springen (z. B. beim Halten der Punkte) */
  const goTo = (target: number, animate: boolean) => {
    const next = Math.max(0, Math.min(count - 1, target));
    const changed = next !== current.current;
    current.current = next;
    setIndex(next);
    place(0, animate);
    if (changed) onChangeRef.current?.(next);
  };

  // Seiten nachträglich weniger geworden (Fotos werden geladen oder entfernt)
  useEffect(() => {
    if (count > 0 && current.current > count - 1) goTo(count - 1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count]);

  // Nachbarfotos schon dekodieren, damit beim Wischen nichts leer bleibt
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    for (const i of [index - 1, index + 1, index + 2]) {
      const img = el.children[i]?.querySelector('img');
      void img?.decode?.().catch(() => undefined);
    }
  }, [index, count]);

  return {
    ref,
    index,
    goTo,
    handlers: {
      onPointerDown: (e: PointerEvent) => {
        const el = ref.current;
        if (!el || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0) || count < 2) return;
        drag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, w: Math.max(1, el.clientWidth) };
      },
      onPointerMove: (e: PointerEvent) => {
        const d = drag.current;
        if (!d || !e.isPrimary) return;
        const dx = e.clientX - d.x;
        d.axis ??= swipeAxis(dx, e.clientY - d.y);
        if (d.axis !== 'x') return;
        if (e.pointerType === 'mouse') (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        const beyond = (current.current === 0 && dx > 0) || (current.current === count - 1 && dx < 0);
        place(beyond ? dx * EDGE_RESIST : dx, false);
        // die Punkte folgen schon, sobald mehr als die halbe Seite gezogen ist
        const live = Math.max(0, Math.min(count - 1, current.current - Math.round(dx / d.w)));
        setIndex((cur) => (cur === live ? cur : live));
      },
      onPointerUp: (e: PointerEvent) => {
        const d = drag.current;
        drag.current = undefined;
        if (!d || d.axis !== 'x') return;
        goTo(swipeTarget(current.current, count, e.clientX - d.x, d.w, e.timeStamp - d.t), true);
      },
      onPointerCancel: () => {
        const d = drag.current;
        drag.current = undefined;
        if (d?.axis === 'x') goTo(current.current, true);
      },
      onWheel: (e: WheelEvent) => {
        if (Math.abs(e.deltaX) < 20 || Math.abs(e.deltaX) < Math.abs(e.deltaY)) return;
        if (e.timeStamp - lastWheel.current < 350) return;
        lastWheel.current = e.timeStamp;
        goTo(current.current + (e.deltaX > 0 ? 1 : -1), true);
      },
      onKeyDown: (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') goTo(current.current + 1, true);
        else if (e.key === 'ArrowLeft') goTo(current.current - 1, true);
        else return;
        e.preventDefault();
      },
    },
  };
}
