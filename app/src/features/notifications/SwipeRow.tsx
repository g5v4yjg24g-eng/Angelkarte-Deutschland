// Zeile, die sich von rechts nach links wegwischen lässt (Touch/Stift): erst erscheint „Löschen“ dahinter, ein weiter
// Wisch löscht gleich. Für Tastatur und Screenreader ist „Löschen“ immer als Knopf da (zeigt sich beim Fokus).
import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { de } from '../../i18n/de';
import { swipeAxis } from '../../domain/swipe';
import styles from './Notifications.module.css';

const REVEAL_PX = 96;
/** Ab diesem Anteil der Breite oder bei schnellem Wisch wird gleich gelöscht */
const DELETE_SHARE = 0.6;
const FLICK_SPEED = 0.6;

export function SwipeRow({
  label,
  onDelete,
  card = false,
  children,
}: {
  /** Beschriftung des Löschen-Knopfs für Screenreader */
  label: string;
  onDelete: () => void;
  /** Zeile ist eine Karte: oben und unten Luft, damit „Löschen“ dahinter nicht hervorschaut */
  card?: boolean;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [x, setX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [gone, setGone] = useState(false);
  const drag = useRef<{
    sx: number;
    sy: number;
    t: number;
    base: number;
    id: number;
    axis?: 'x' | 'y' | undefined;
  } | null>(null);

  const remove = () => {
    setGone(true);
    setX(-(ref.current?.offsetWidth ?? 400));
    window.setTimeout(onDelete, 180);
  };

  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse') return;
    drag.current = { sx: e.clientX, sy: e.clientY, t: e.timeStamp, base: x, id: e.pointerId };
  };
  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    d.axis ??= swipeAxis(dx, e.clientY - d.sy);
    if (d.axis === 'y') {
      drag.current = null;
      return;
    }
    if (d.axis !== 'x') return;
    const next = Math.min(0, d.base + dx);
    // Nach links und das Schließen einer geöffneten Zeile gehören der Zeile, nicht dem Fenster dahinter
    if (dx < 0 || d.base < 0) e.stopPropagation();
    setDragging(true);
    setX(Math.max(next, -(ref.current?.offsetWidth ?? 400)));
  };
  const up = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d || d.axis !== 'x') return;
    setDragging(false);
    const width = ref.current?.offsetWidth ?? 400;
    const dx = e.clientX - d.sx;
    const final = Math.min(0, d.base + dx);
    const speed = -dx / Math.max(1, e.timeStamp - d.t);
    if (dx < 0 || d.base < 0) e.stopPropagation();
    if (-final >= width * DELETE_SHARE || (speed >= FLICK_SPEED && -dx >= 40 && d.base === 0)) remove();
    else setX(-final > REVEAL_PX / 2 ? -REVEAL_PX : 0);
  };

  return (
    <div className={`${styles.swipe} ${gone ? styles.swipeGone : ''}`} ref={ref}>
      <button type="button" className={styles.swipeDelete} aria-label={label} onClick={remove}>
        {de.notifications.delete}
      </button>
      <div
        className={`${styles.swipeFront} ${card ? styles.swipeCard : ''}`}
        style={{ transform: `translateX(${x}px)`, transition: dragging ? 'none' : undefined }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => {
          drag.current = null;
          setDragging(false);
          setX(0);
        }}
      >
        {children}
      </div>
    </div>
  );
}
