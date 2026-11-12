// Nach unten ziehen zum Aktualisieren (nur Touch). Hört auf dem scrollenden Bereich `#main`; greift nur, wenn die
// Liste ganz oben steht und die Bewegung eindeutig senkrecht nach unten geht – waagerechtes Wischen (Foto-Karussell)
// und normales Scrollen bleiben unberührt. Rechnung rein in domain/pullRefresh.ts.
import { useEffect, useRef, useState } from 'react';
import { PULL_THRESHOLD, canStartPull, isPullReady, pullOffset } from '../domain/pullRefresh';
import { swipeAxis } from '../domain/swipe';

export type PullState = 'idle' | 'pulling' | 'ready' | 'refreshing';

export function usePullToRefresh(
  onRefresh: () => Promise<void>,
  enabled = true,
): { offset: number; state: PullState } {
  const [offset, setOffset] = useState(0);
  const [state, setState] = useState<PullState>('idle');
  const refresh = useRef(onRefresh);
  useEffect(() => {
    refresh.current = onRefresh;
  });

  useEffect(() => {
    const el = document.getElementById('main');
    if (!el || !enabled) return;
    let start: { x: number; y: number } | null = null;
    let pulling = false;
    let busy = false;
    let current = 0;

    const set = (o: number, s: PullState) => {
      current = o;
      setOffset(o);
      setState(s);
    };
    const onStart = (e: TouchEvent) => {
      const t = e.touches[0];
      if (busy || !t || !canStartPull(el.scrollTop, e.touches.length)) {
        start = null;
        return;
      }
      start = { x: t.clientX, y: t.clientY };
      pulling = false;
    };
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!start || !t) return;
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (!pulling) {
        const axis = swipeAxis(dx, dy);
        if (axis === undefined) return;
        if (axis === 'x' || dy <= 0 || el.scrollTop > 0) {
          start = null;
          return;
        }
        pulling = true;
      }
      if (e.cancelable) e.preventDefault();
      const o = pullOffset(dy);
      set(o, isPullReady(o) ? 'ready' : 'pulling');
    };
    const onEnd = () => {
      if (!pulling) {
        start = null;
        return;
      }
      pulling = false;
      start = null;
      if (!isPullReady(current)) return set(0, 'idle');
      busy = true;
      set(PULL_THRESHOLD, 'refreshing');
      void refresh
        .current()
        .catch(() => undefined)
        .finally(() => {
          busy = false;
          set(0, 'idle');
        });
    };
    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
    el.addEventListener('touchcancel', onEnd);
    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      el.removeEventListener('touchcancel', onEnd);
    };
  }, [enabled]);

  return { offset, state };
}
