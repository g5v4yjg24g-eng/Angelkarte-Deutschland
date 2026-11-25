// Leuchtende Umrandung der unteren Leiste mit Hügel über dem aktiven Punkt (Wunsch Nutzer 2026-11-25, Vorlage: Video).
// Geometrie rein in domain/navWave.ts; hier nur die Anzeige und die weiche Bewegung zum Ziel (folgt beim Wischen
// auch der Linse). Bei „Bewegung reduzieren“ springt der Hügel ohne Gleiten.
import { useEffect, useId, useLayoutEffect, useRef } from 'react';
import { approach, halfBaseFor, waveFill, wavePath, waveRange } from '../domain/navWave';
import styles from './AppShell.module.css';

const OFF = -9999;

const reduced = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

export function NavWave({
  width,
  height,
  tabWidth,
  target,
}: {
  width: number;
  height: number;
  tabWidth: number;
  /** Mitte des Hügels in px von links; null = kein aktiver Punkt, die Linie bleibt flach */
  target: number | null;
}) {
  const id = useId();
  const line = useRef<SVGPathElement>(null);
  const glow = useRef<SVGPathElement>(null);
  const fill = useRef<SVGPathElement>(null);
  const x = useRef<number>(target ?? OFF);
  const frame = useRef<number | undefined>(undefined);
  const halfBase = halfBaseFor(tabWidth);

  const draw = (center: number) => {
    const g = { width, height, center, halfBase };
    const d = wavePath(g);
    line.current?.setAttribute('d', d);
    glow.current?.setAttribute('d', d);
    fill.current?.setAttribute('d', waveFill(g));
  };

  // Größe oder Breite der Punkte geändert: sofort passend zeichnen
  useLayoutEffect(() => {
    draw(x.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height, halfBase]);

  useEffect(() => {
    window.cancelAnimationFrame?.(frame.current ?? 0);
    const goal = target ?? OFF;
    // Aus dem „kein Punkt“-Zustand oder bei reduzierter Bewegung ohne Gleiten
    if (
      reduced() ||
      x.current === OFF ||
      goal === OFF ||
      typeof window.requestAnimationFrame !== 'function'
    ) {
      x.current = goal;
      draw(goal);
      return;
    }
    let last = performance.now();
    const step = (now: number) => {
      x.current = approach(x.current, goal, now - last);
      last = now;
      draw(x.current);
      if (x.current !== goal) frame.current = window.requestAnimationFrame(step);
    };
    frame.current = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame.current ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, width, height, halfBase]);

  const [from, to] = waveRange(width, height);
  return (
    <svg
      className={styles.wave}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={`${id}-fade`} gradientUnits="userSpaceOnUse" x1={from} x2={to} y1="0" y2="0">
          <stop offset="0" stopColor="currentColor" stopOpacity="0" />
          <stop offset="0.07" stopColor="currentColor" stopOpacity="1" />
          <stop offset="0.93" stopColor="currentColor" stopOpacity="1" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
        <filter id={`${id}-glow`} x="-10%" y="-40%" width="120%" height="180%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>
      <path ref={fill} className={styles.waveFill} />
      <path ref={glow} className={styles.waveGlow} stroke={`url(#${id}-fade)`} filter={`url(#${id}-glow)`} />
      <path ref={line} className={styles.waveLine} stroke={`url(#${id}-fade)`} />
    </svg>
  );
}
