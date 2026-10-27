// Schritt-für-Schritt-Animation eines Knotens: Die neuen Schnurstücke eines Schritts zeichnen sich nacheinander,
// Ersatzbilder (z. B. zugezogener Knoten) werden eingeblendet. Bei reduzierter Bewegung erscheinen die Bilder sofort.
import { useMemo } from 'react';
import { de } from '../../i18n/de';
import { buildDiagram, drawOps, stepDurationMs, type KnotDiagramSpec } from '../../domain/knots';
import { StepControls } from './StepControls';
import styles from './Knots.module.css';

const t = de.knots;
const LAYER_CLASS = { halo: 'layerHalo', line: 'layerLine', inner: 'layerInner' } as const;
const STYLE_CLASS = {
  line: 'styleLine',
  line2: 'styleLine2',
  double: 'styleDouble',
  hardware: 'styleHardware',
} as const;

export function KnotPlayer({
  name,
  spec,
  steps,
  step,
  onStep,
}: {
  name: string;
  spec: KnotDiagramSpec;
  steps: readonly string[];
  step: number;
  onStep: (step: number) => void;
}) {
  const diagram = useMemo(() => buildDiagram(spec), [spec]);
  const total = Math.min(diagram.steps, steps.length);
  const ops = useMemo(() => drawOps(diagram, step), [diagram, step]);

  return (
    <div className={styles.player}>
      <svg
        key={step}
        className={styles.drawing}
        viewBox={`0 0 ${diagram.width} ${diagram.height}`}
        role="img"
        aria-label={t.drawingLabel(name, steps[step] ?? '')}
      >
        {ops.map((o) => (
          <path
            key={o.key}
            d={o.d}
            pathLength={o.timing ? 1 : undefined}
            className={[
              styles[LAYER_CLASS[o.layer]],
              styles[STYLE_CLASS[o.style]],
              o.butt ? styles.butt : '',
              o.timing ? styles.drawIn : '',
              o.fade ? styles.fadeIn : '',
            ].join(' ')}
            style={
              o.timing
                ? { animationDelay: `${o.timing.delayMs}ms`, animationDuration: `${o.timing.durationMs}ms` }
                : undefined
            }
          />
        ))}
      </svg>
      <StepControls
        step={step}
        total={total}
        text={steps[step] ?? ''}
        drawMs={stepDurationMs(diagram, step)}
        onStep={onStep}
      />
    </div>
  );
}
