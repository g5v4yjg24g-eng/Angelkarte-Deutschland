// Leuchtende Umrandung der unteren Leiste mit Hügel über dem aktiven Punkt (Wunsch Nutzer 2026-11-25, Vorlage: Video).
// Geometrie rein in domain/navWave.ts. Flüssig auch beim Seitenwechsel (Wunsch Nutzer 2026-11-26): Der Hügel wird nicht
// mehr bei jedem Bild neu berechnet, sondern ist ein fertiges Bild, das nur verschoben wird – ebenso zwei Fenster, die
// die Linie links und rechts davon zeigen. Verschoben wird mit Transformationen (Web Animations), die der Grafik-
// prozessor ausführt und die nicht stocken, wenn die Seite gerade eine neue Ansicht aufbaut. Beim Wischen folgt der
// Hügel dem Finger direkt; bei „Bewegung reduzieren“ springt er.
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import {
  NO_WAVE,
  baselinePath,
  halfBaseFor,
  humpFill,
  humpPath,
  waveRange,
  waveShifts,
} from '../domain/navWave';
import styles from './AppShell.module.css';

// Sanfter Anlauf und langes Ausgleiten, je weiter, desto länger (vorher war der Anfang so steil, dass der Hügel
// fast sprang, und lag genau in dem Bild, in dem die neue Seite erscheint)
const EASE = 'cubic-bezier(0.45, 0, 0.15, 1)';
const moveMs = (distance: number) => Math.min(560, Math.max(340, 300 + Math.abs(distance) * 0.8));

const reduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const tx = (x: number) => `translateX(${Math.round(x * 100) / 100}px)`;

/** Linie in drei Lagen (weiches Leuchten, Saum, Kern) – ohne Weichzeichner, der bei jedem Bild neu rechnen müsste */
function Stroke({ d, fade }: { d: string; fade?: string | undefined }) {
  const stroke = fade ? `url(#${fade})` : 'currentColor';
  return (
    <>
      <path d={d} className={styles.waveGlow} stroke={stroke} strokeWidth="7" opacity="0.12" />
      <path d={d} className={styles.waveGlow} stroke={stroke} strokeWidth="4.5" opacity="0.22" />
      <path d={d} className={styles.waveLine} stroke={stroke} />
    </>
  );
}

export function NavWave({
  width,
  height,
  tabWidth,
  target,
  follow,
}: {
  width: number;
  height: number;
  tabWidth: number;
  /** Mitte des Hügels in px von links; null = kein aktiver Punkt, die Linie bleibt flach */
  target: number | null;
  /** true: dem Finger folgen (ohne Gleiten) */
  follow: boolean;
}) {
  const id = useId();
  const humpEl = useRef<SVGSVGElement>(null);
  const leftWin = useRef<HTMLDivElement>(null);
  const leftIn = useRef<HTMLDivElement>(null);
  const rightWin = useRef<HTMLDivElement>(null);
  const rightIn = useRef<HTMLDivElement>(null);
  const shown = useRef<number | null>(null);
  const halfBase = halfBaseFor(tabWidth);
  const [from, to] = waveRange(width, height);
  const base = baselinePath(width, height);

  const parts = () => [humpEl.current, leftWin.current, leftIn.current, rightWin.current, rightIn.current];

  /** Aktuelle Mitte des Hügels, auch mitten in einer Bewegung */
  const currentCenter = (): number | null => {
    const el = humpEl.current;
    if (!el || typeof DOMMatrix === 'undefined') return shown.current;
    const m = new DOMMatrix(getComputedStyle(el).transform);
    return m.m41 + halfBase;
  };

  const place = (center: number, animate: boolean, fromCenter: number | null) => {
    const next = waveShifts(center, halfBase, width);
    const prev = waveShifts(fromCenter ?? NO_WAVE, halfBase, width);
    const [hump, lw, li, rw, ri] = parts();
    const target4: [Element | null, string, string][] = [
      [hump ?? null, tx(prev.hump), tx(next.hump)],
      [lw ?? null, tx(prev.left), tx(next.left)],
      [li ?? null, tx(-prev.left), tx(-next.left)],
      [rw ?? null, tx(prev.right), tx(next.right)],
      [ri ?? null, tx(-prev.right), tx(-next.right)],
    ];
    for (const [el, a, b] of target4) {
      if (!(el instanceof HTMLElement || el instanceof SVGElement)) continue;
      const style = (el as HTMLElement).style;
      el.getAnimations?.().forEach((x) => x.cancel());
      style.transform = b;
      if (animate && typeof el.animate === 'function' && fromCenter !== null)
        el.animate([{ transform: a }, { transform: b }], {
          duration: moveMs(center - (fromCenter ?? center)),
          easing: EASE,
        });
    }
    if (humpEl.current) humpEl.current.style.visibility = next.visible ? 'visible' : 'hidden';
    shown.current = center;
  };

  // Maße geändert: sofort passend setzen
  useLayoutEffect(() => {
    place(target ?? NO_WAVE, false, null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, halfBase]);

  useEffect(() => {
    const goal = target ?? NO_WAVE;
    const now = currentCenter() ?? shown.current;
    const jump = follow || reduced() || target === null || now === null || now <= NO_WAVE / 2;
    place(goal, !jump, now);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, follow]);

  const fade = `${id}-fade`;
  const baseSvg = (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={styles.waveSvg}>
      <defs>
        <linearGradient id={fade} gradientUnits="userSpaceOnUse" x1={from} x2={to} y1="0" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.07" stopColor="currentColor" stopOpacity="1" />
          <stop offset="0.93" stopColor="currentColor" stopOpacity="1" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <Stroke d={base} fade={fade} />
    </svg>
  );
  // Zweite Kopie der Grundlinie braucht eine eigene Verlaufs-Kennung
  const baseSvgRight = (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={styles.waveSvg}>
      <defs>
        <linearGradient id={`${fade}-r`} gradientUnits="userSpaceOnUse" x1={from} x2={to} y1="0" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.07" stopColor="currentColor" stopOpacity="1" />
          <stop offset="0.93" stopColor="currentColor" stopOpacity="1" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      <Stroke d={base} fade={`${fade}-r`} />
    </svg>
  );

  return (
    <div className={styles.waveClip} style={{ width, height }} aria-hidden="true">
      <div ref={leftWin} className={styles.waveWin} style={{ width, height }}>
        <div ref={leftIn} className={styles.waveIn} style={{ width, height }}>
          {baseSvg}
        </div>
      </div>
      <div ref={rightWin} className={styles.waveWin} style={{ width, height }}>
        <div ref={rightIn} className={styles.waveIn} style={{ width, height }}>
          {baseSvgRight}
        </div>
      </div>
      <svg
        ref={humpEl}
        data-wave="hump"
        className={styles.waveHump}
        width={2 * halfBase}
        height={height}
        viewBox={`0 0 ${2 * halfBase} ${height}`}
        focusable="false"
      >
        <path d={humpFill(halfBase, height)} className={styles.waveFill} />
        <Stroke d={humpPath(halfBase, height)} />
      </svg>
    </div>
  );
}
