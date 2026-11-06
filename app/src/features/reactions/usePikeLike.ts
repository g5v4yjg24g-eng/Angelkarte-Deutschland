// Doppeltipp auf ein Foto: kleiner Hecht schwimmt im Bild zum „Gefällt mir“ (Wunsch Nutzer 2026-11-06, Vorschau
// freigegeben). Animation und „Gefällt mir“ sind getrennt: Gesetzt wird über einen Zeitgeber zum Ankunftszeitpunkt –
// auch wenn nichts gezeichnet wird (Hintergrund-Tab) oder die Seite vorher verlassen wird (dann sofort). Doppeltipp
// nimmt nie zurück; mehrfaches Tippen setzt nur einmal. Bei reduzierter Bewegung: sofort, ohne Hecht.
import { useCallback, useEffect, useRef, type PointerEvent, type RefObject } from 'react';
import { ARRIVE_MS, isDoubleTap, isTap, pikeSize, swimPath, type Tap } from '../../domain/pikeSwim';
import { PikeAnimator } from './pikeAnimator';

const reducedMotion = () =>
  typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function usePikeLike({
  frame,
  canvas,
  target,
  liked,
  onLike,
  onArrive,
}: {
  /** Bildrahmen, in dem der Hecht schwimmt */
  frame: RefObject<HTMLElement | null>;
  /** Zeichenfläche über dem Bild (pointer-events: none) */
  canvas: RefObject<HTMLCanvasElement | null>;
  /** Symbol des „Gefällt mir“-Knopfs (Ziel) */
  target: RefObject<HTMLElement | null>;
  liked: boolean;
  /** „Gefällt mir“ setzen (nur aufgerufen, wenn noch nicht gesetzt) */
  onLike: () => void;
  /** Hecht ist am Knopf angekommen (Knopf hüpfen lassen) */
  onArrive?: () => void;
}) {
  const likedRef = useRef(liked);
  const onLikeRef = useRef(onLike);
  const onArriveRef = useRef(onArrive);
  useEffect(() => {
    likedRef.current = liked;
    onLikeRef.current = onLike;
    onArriveRef.current = onArrive;
  });
  const pending = useRef<number | undefined>(undefined);
  const animator = useRef<PikeAnimator | null>(null);
  const down = useRef<Tap | undefined>(undefined);
  const lastTap = useRef<Tap | undefined>(undefined);

  const likeOnce = useCallback(() => {
    if (pending.current !== undefined) window.clearTimeout(pending.current);
    pending.current = undefined;
    if (!likedRef.current) {
      likedRef.current = true;
      onLikeRef.current();
    }
  }, []);

  // Seite verlassen: Animation beenden, ein ausstehendes „Gefällt mir“ trotzdem setzen
  useEffect(
    () => () => {
      animator.current?.stop();
      if (pending.current !== undefined) likeOnce();
    },
    [likeOnce],
  );

  const play = useCallback(
    (clientX: number, clientY: number) => {
      const box = frame.current?.getBoundingClientRect();
      const icon = target.current?.getBoundingClientRect();
      const cv = canvas.current;
      if (reducedMotion() || !box || !box.width || !icon || !cv) {
        likeOnce();
        onArriveRef.current?.();
        return;
      }
      const path = swimPath(
        { x: clientX - box.left, y: clientY - box.top },
        icon.left + icon.width / 2 - box.left,
        box.width,
        box.height,
        pikeSize(box.width),
      );
      animator.current ??= new PikeAnimator(() => onArriveRef.current?.());
      animator.current.play(cv, box.width, box.height, path);
      // „Gefällt mir“ unabhängig vom Zeichnen setzen – einmal, zur Ankunft
      if (!likedRef.current && pending.current === undefined)
        pending.current = window.setTimeout(likeOnce, ARRIVE_MS);
    },
    [frame, target, canvas, likeOnce],
  );

  /** Zeiger-Ereignisse fürs Foto: erkennen den Doppeltipp (Wischen im Karussell zählt nicht) */
  const handlers = {
    onPointerDown: (e: PointerEvent) => {
      if (!e.isPrimary) return;
      down.current = { x: e.clientX, y: e.clientY, t: e.timeStamp };
    },
    onPointerCancel: () => {
      down.current = undefined;
      lastTap.current = undefined;
    },
    onPointerUp: (e: PointerEvent) => {
      const d = down.current;
      down.current = undefined;
      if (!e.isPrimary || !d) return;
      const tap = { x: e.clientX, y: e.clientY, t: e.timeStamp };
      if (!isTap(d, tap)) {
        lastTap.current = undefined;
        return;
      }
      if (isDoubleTap(lastTap.current, tap)) {
        lastTap.current = undefined;
        play(tap.x, tap.y);
      } else lastTap.current = tap;
    },
  };

  return { handlers, play };
}
