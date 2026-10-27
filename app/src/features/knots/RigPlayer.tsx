// Schritt-für-Schritt-Animation einer Montage: Schnüre und Haken zeichnen sich, Blei, Perle, Pose und Köder blenden
// ein, Beschriftungen erscheinen mit ihrem Teil. Bei reduzierter Bewegung ist alles sofort zu sehen.
import { useMemo } from 'react';
import { de } from '../../i18n/de';
import { isDrawn, rigFrame, rigStepCount, rigStepDurationMs, type RigDiagramSpec } from '../../domain/rigs';
import { StepControls } from './StepControls';
import styles from './Knots.module.css';
import rig from './Rigs.module.css';

const t = de.knots;
const parts = de.rigs.parts as Record<string, string>;

export function RigPlayer({
  name,
  spec,
  steps,
  step,
  onStep,
}: {
  name: string;
  spec: RigDiagramSpec;
  steps: readonly string[];
  step: number;
  onStep: (step: number) => void;
}) {
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
        {frame.map((p) => (
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
