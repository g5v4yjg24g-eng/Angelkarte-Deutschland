// Foto-Karussell mit Verschieben per Transformation statt Scrollen (Fehler Nutzer 2026-11-27: Wischen ruckelte auf dem
// iPhone, zwischendurch blieb die Fläche leer). Die Seiten (`li`) liegen nebeneinander im abgeschnittenen Rahmen und
// werden beim Ziehen mit `translate3d` bewegt – das erledigt die Grafikkarte, ohne Scrollen, Einrasten oder neues Layout.
// Beim Loslassen gleitet die Seite per Übergang ins Ziel (bei reduzierter Bewegung sofort). Senkrecht scrollt weiter die
// Seite (touch-action: pan-y). Maus (Ziehen, seitliches Trackpad) und Pfeiltasten gehen ebenfalls.
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from 'react';
import { swipeTarget } from '../domain/swipe';

const SETTLE_MS = 260;
const EDGE_RESIST = 0.35;

interface Drag {
  x: number;
  y: number;
  t: number;
  w: number;
  axis?: 'x' | 'y' | undefined;
}

/**
 * Ab wie vielen Pixeln die Richtung feststeht, und wie die Seitwärtsbewegung gewertet wird: waagerecht, sobald sie
 * mindestens so weit geht wie die senkrechte (Wunsch Nutzer 2026-11-27: schräge Wischer ließen die Seite mitscrollen,
 * das Karussell sprang zurück).
 */
const LOCK_PX = 4;
export const lockAxis = (dx: number, dy: number): 'x' | 'y' | undefined =>
  Math.max(Math.abs(dx), Math.abs(dy)) < LOCK_PX ? undefined : Math.abs(dx) >= Math.abs(dy) ? 'x' : 'y';

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

  // Ziehen: Finger (Touch-Ereignisse, damit die Seite bei waagerechtem Wischen nicht mitscrollt), Maus und Stift
  // (Zeiger-Ereignisse) laufen durch dieselben drei Schritte.
  const begin = (x: number, y: number, t: number) => {
    const el = ref.current;
    if (!el || count < 2) return;
    drag.current = { x, y, t, w: Math.max(1, el.clientWidth) };
  };
  /** `true`, solange die Bewegung waagerecht ist (dann soll die Seite nicht scrollen) */
  const move = (x: number, y: number): boolean => {
    const d = drag.current;
    if (!d) return false;
    const dx = x - d.x;
    d.axis ??= lockAxis(dx, y - d.y);
    if (d.axis !== 'x') return false;
    const beyond = (current.current === 0 && dx > 0) || (current.current === count - 1 && dx < 0);
    place(beyond ? dx * EDGE_RESIST : dx, false);
    // die Punkte folgen schon, sobald mehr als die halbe Seite gezogen ist
    const live = Math.max(0, Math.min(count - 1, current.current - Math.round(dx / d.w)));
    setIndex((cur) => (cur === live ? cur : live));
    return true;
  };
  const finish = (x: number, t: number) => {
    const d = drag.current;
    drag.current = undefined;
    if (!d || d.axis !== 'x') return;
    goTo(swipeTarget(current.current, count, x - d.x, d.w, t - d.t), true);
  };
  const abort = () => {
    const d = drag.current;
    drag.current = undefined;
    if (d?.axis === 'x') goTo(current.current, true);
  };
  const actions = useRef({ begin, move, finish, abort });
  useEffect(() => {
    actions.current = { begin, move, finish, abort };
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (e.touches.length === 1 && t) actions.current.begin(t.clientX, t.clientY, e.timeStamp);
      else actions.current.abort();
    };
    // nicht „passive“: nur so kann die Seite am Scrollen gehindert werden, wenn die Bewegung waagerecht ist
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (t && actions.current.move(t.clientX, t.clientY) && e.cancelable) e.preventDefault();
    };
    const onEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (t) actions.current.finish(t.clientX, e.timeStamp);
    };
    const onCancel = () => actions.current.abort();
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd, { passive: true });
    el.addEventListener('touchcancel', onCancel, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onCancel);
    };
  }, []);

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
      // Zeiger-Ereignisse nur für Maus und Stift; Finger laufen über die Touch-Ereignisse oben
      onPointerDown: (e: PointerEvent) => {
        if (e.pointerType === 'touch' || !e.isPrimary || (e.pointerType === 'mouse' && e.button !== 0)) return;
        begin(e.clientX, e.clientY, e.timeStamp);
      },
      onPointerMove: (e: PointerEvent) => {
        if (e.pointerType === 'touch' || !e.isPrimary) return;
        if (move(e.clientX, e.clientY) && e.pointerType === 'mouse')
          (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      },
      onPointerUp: (e: PointerEvent) => {
        if (e.pointerType === 'touch') return;
        finish(e.clientX, e.timeStamp);
      },
      onPointerCancel: (e: PointerEvent) => {
        if (e.pointerType === 'touch') return;
        abort();
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
