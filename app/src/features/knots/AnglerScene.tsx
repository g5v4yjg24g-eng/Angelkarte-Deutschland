// Köderführung mit Angler: Rute, Schnur, Kurbel und Köder werden Bild für Bild gemeinsam bewegt (requestAnimationFrame),
// damit die Schnur immer von der Rutenspitze zum Köder läuft. Bei reduzierter Bewegung steht alles im Endzustand.
import { useEffect, useRef } from 'react';
import { endAngle, lineCurve, rodAngleAt, rodTip, type AnglerSpec } from '../../domain/angler';
import {
  lastTrail,
  pathEnd,
  pathStart,
  rodAngleBefore,
  stepTrail,
  type RigDiagramSpec,
} from '../../domain/rigs';
import rig from './Rigs.module.css';

/** Köder: kleiner Gummifisch mit Kopf, Spitze nach rechts (+x) */
const LURE = 'M11 0 C9 -5 0 -6 -6 -3.5 L-12 -7 L-10.5 0 L-12 7 L-6 3.5 C0 6 9 5 11 0 Z';
const SVG_NS = 'http://www.w3.org/2000/svg';

const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

interface Pose {
  angle: number;
  lure: { x: number; y: number; dir: number };
  slack: boolean;
  reel: number;
}

/** Stand vor bzw. nach dem Schritt (ohne Animation) */
function restPose(spec: RigDiagramSpec, step: number, atEnd: boolean): Pose {
  const a = spec.angler as AnglerSpec;
  const own = stepTrail(spec, step);
  const prev = lastTrail(spec, atEnd ? step : step - 1);
  const lastOwn = own.at(-1);
  const angle = atEnd && lastOwn ? endAngle(lastOwn.rod, a.base) : rodAngleBefore(spec, step);
  const end = prev
    ? pathEnd(prev.d)
    : own[0]
      ? { ...pathStart(own[0].d), angle: 90 }
      : { x: 0, y: 0, angle: 0 };
  return {
    angle,
    lure: { x: end.x, y: end.y, dir: end.angle },
    slack: !!(atEnd ? lastOwn?.rod?.slack : false),
    reel: 0,
  };
}

export function AnglerScene({ spec, step }: { spec: RigDiagramSpec; step: number }) {
  const a = spec.angler as AnglerSpec;
  const rodRef = useRef<SVGPathElement>(null);
  const lineRef = useRef<SVGPathElement>(null);
  const lureRef = useRef<SVGPathElement>(null);
  const reelRef = useRef<SVGPathElement>(null);
  const measure = useRef<SVGGElement>(null);
  const still = reducedMotion();
  const first = restPose(spec, step, still);

  useEffect(() => {
    const draw = (p: Pose) => {
      const tip = rodTip(a, p.angle);
      rodRef.current?.setAttribute('d', `M${a.hand[0]} ${a.hand[1]} L${tip[0]} ${tip[1]}`);
      lineRef.current?.setAttribute('d', lineCurve(tip, [p.lure.x, p.lure.y], p.slack));
      lureRef.current?.setAttribute('transform', `translate(${p.lure.x} ${p.lure.y}) rotate(${p.lure.dir})`);
      reelRef.current?.setAttribute('transform', `rotate(${p.reel} ${a.hand[0] + 6} ${a.hand[1] + 2})`);
    };
    const trail = stepTrail(spec, step);
    if (still || !trail.length || !measure.current) {
      draw(restPose(spec, step, true));
      return;
    }
    // Pfade zum Vermessen (Position und Richtung entlang der Bahn)
    const g = measure.current;
    const paths = trail.map((p) => {
      const el = document.createElementNS(SVG_NS, 'path');
      el.setAttribute('d', p.d);
      g.appendChild(el);
      return { p, el, len: el.getTotalLength?.() ?? 0 };
    });
    const startPose = restPose(spec, step, false);
    let raf = 0;
    const t0 = performance.now();
    const frame = (now: number) => {
      const ms = now - t0;
      let pose = startPose;
      let reel = 0;
      for (const { p, el, len } of paths) {
        const { delayMs = 0, durationMs = 1 } = p.timing ?? {};
        if (ms < delayMs) break;
        const t = Math.min(1, (ms - delayMs) / durationMs);
        const at = el.getPointAtLength(t * len);
        const ahead = el.getPointAtLength(Math.min(len, t * len + 2));
        const back = el.getPointAtLength(Math.max(0, t * len - 2));
        const dir = (Math.atan2(ahead.y - back.y, ahead.x - back.x) * 180) / Math.PI;
        if (p.rod?.reel) reel = (ms - delayMs) * 0.9;
        pose = {
          angle: rodAngleAt(p.rod, t, a.base),
          lure: { x: at.x, y: at.y, dir },
          slack: !!p.rod?.slack,
          reel,
        };
      }
      draw(pose);
      const last = paths.at(-1)?.p.timing;
      if (!last || ms < last.delayMs + last.durationMs) raf = requestAnimationFrame(frame);
    };
    draw(startPose);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      for (const { el } of paths) el.remove();
    };
  }, [spec, step, still, a]);

  const tip = rodTip(a, first.angle);
  return (
    <g>
      <g ref={measure} visibility="hidden" aria-hidden="true" />
      {a.line && (
        <path
          ref={lineRef}
          className={rig.fishingLine}
          d={lineCurve(tip, [first.lure.x, first.lure.y], first.slack)}
        />
      )}
      <path ref={rodRef} className={rig.rod} d={`M${a.hand[0]} ${a.hand[1]} L${tip[0]} ${tip[1]}`} />
      <circle className={rig.reel} cx={a.hand[0] + 6} cy={a.hand[1] + 2} r={4.5} />
      <path
        ref={reelRef}
        className={rig.reelHandle}
        d={`M${a.hand[0] + 6} ${a.hand[1] + 2} L${a.hand[0] + 6} ${a.hand[1] - 5}`}
      />
      <path
        ref={lureRef}
        d={LURE}
        className={rig.lure}
        transform={`translate(${first.lure.x} ${first.lure.y}) rotate(${first.lure.dir})`}
      />
    </g>
  );
}
