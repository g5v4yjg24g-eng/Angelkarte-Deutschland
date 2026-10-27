// Schritt-für-Schritt-Animation einer Montage: Schnüre und Haken zeichnen sich, Blei, Perle, Pose und Köder blenden
// ein, Beschriftungen erscheinen mit ihrem Teil. Bei reduzierter Bewegung ist alles sofort zu sehen.
import { useMemo } from 'react';
import { de } from '../../i18n/de';
import {
  isDrawn,
  lastTrail,
  pathEnd,
  rigFrame,
  rigStepCount,
  rigStepDurationMs,
  stepTrail,
  type RigDiagramSpec,
} from '../../domain/rigs';
import { StepControls } from './StepControls';
import { AnglerScene } from './AnglerScene';
import styles from './Knots.module.css';
import rig from './Rigs.module.css';

const t = de.knots;
const rigParts = de.rigs.parts as Record<string, string>;
/** Köder für die Köderführung: kleiner Gummifisch mit Kopf, Spitze nach rechts (+x) */
const LURE = 'M11 0 C9 -5 0 -6 -6 -3.5 L-12 -7 L-10.5 0 L-12 7 L-6 3.5 C0 6 9 5 11 0 Z';
const reducedMotion = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Der Köder läuft die Bahn des Schritts ab (SMIL animateMotion, folgt der Richtung); sonst ruht er am Ende. */
function Lure({ spec, step }: { spec: RigDiagramSpec; step: number }) {
  const trail = stepTrail(spec, step);
  const rest = lastTrail(spec, step);
  if (!rest) return null;
  if (reducedMotion() || !trail.length) {
    const end = pathEnd(rest.d);
    return (
      <path d={LURE} className={rig.lure} transform={`translate(${end.x} ${end.y}) rotate(${end.angle})`} />
    );
  }
  const first = trail[0]?.timing?.delayMs ?? 0;
  return (
    <path d={LURE} className={rig.lure} opacity={0}>
      <set attributeName="opacity" to="1" begin={`${first}ms`} fill="freeze" />
      {trail.map((p) => (
        <animateMotion
          key={p.id}
          path={p.d}
          begin={`${p.timing?.delayMs ?? 0}ms`}
          dur={`${p.timing?.durationMs ?? 1}ms`}
          rotate="auto"
          fill="freeze"
          calcMode="paced"
        />
      ))}
    </path>
  );
}

export function RigPlayer({
  name,
  spec,
  steps,
  step,
  onStep,
  labels,
}: {
  name: string;
  spec: RigDiagramSpec;
  steps: readonly string[];
  step: number;
  onStep: (step: number) => void;
  /** Beschriftungen (Standard: Teile der Montagen) */
  labels?: Record<string, string>;
}) {
  const parts = labels ?? rigParts;
  const frame = useMemo(() => rigFrame(spec, step), [spec, step]);
  const total = Math.min(rigStepCount(spec), steps.length);
  const timing = (p: (typeof frame)[number]) =>
    p.timing
      ? { animationDelay: `${p.timing.delayMs}ms`, animationDuration: `${p.timing.durationMs}ms` }
      : undefined;

  return (
    <div className={styles.player}>
      <svg
        key={step}
        className={rig.drawing}
        viewBox={`0 0 ${spec.width} ${spec.height}`}
        role="img"
        aria-label={t.drawingLabel(name, steps[step] ?? '')}
      >
        {/* reine Beschriftungen (Pfad ohne Linie) zeichnen nichts */}
        {frame
          .filter((p) => /[LCQZ]/i.test(p.d))
          .map((p) => (
            <path
              key={p.id}
              d={p.d}
              pathLength={p.timing && isDrawn(p.style) ? 1 : undefined}
              className={[rig[p.style], p.timing ? (isDrawn(p.style) ? styles.drawIn : rig.fade) : ''].join(
                ' ',
              )}
              style={timing(p)}
            />
          ))}
        {frame.map(
          (p) =>
            p.label && (
              <text
                key={`${p.id}-label`}
                x={p.label.x}
                y={p.label.y}
                textAnchor={p.label.anchor ?? 'middle'}
                className={[rig.label, p.timing ? rig.fade : ''].join(' ')}
                style={
                  p.timing
                    ? { animationDelay: `${p.timing.delayMs + p.timing.durationMs * 0.5}ms` }
                    : undefined
                }
              >
                {parts[p.label.key] ?? p.label.key}
              </text>
            ),
        )}
        {spec.angler ? (
          <AnglerScene spec={spec} step={step} />
        ) : (
          spec.lure && <Lure spec={spec} step={step} />
        )}
      </svg>
      <StepControls
        step={step}
        total={total}
        text={steps[step] ?? ''}
        drawMs={rigStepDurationMs(spec, step)}
        onStep={onStep}
      />
    </div>
  );
}
