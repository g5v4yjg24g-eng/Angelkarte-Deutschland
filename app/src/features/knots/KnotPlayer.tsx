// Schritt-für-Schritt-Animation eines Knotens: Die neuen Schnurstücke eines Schritts zeichnen sich nacheinander,
// Ersatzbilder (z. B. zugezogener Knoten) werden eingeblendet. Bei reduzierter Bewegung erscheinen die Bilder sofort.
import { useEffect, useMemo, useState } from 'react';
import { de } from '../../i18n/de';
import { buildDiagram, drawOps, stepDurationMs, type KnotDiagramSpec } from '../../domain/knots';
import { PauseIcon, PlayIcon, RefreshIcon, StepBackIcon, StepForwardIcon } from '../../design/icons';
import styles from './Knots.module.css';

const t = de.knots;
const LAYER_CLASS = { halo: 'layerHalo', line: 'layerLine', inner: 'layerInner' } as const;
const STYLE_CLASS = { line: 'styleLine', double: 'styleDouble', hardware: 'styleHardware' } as const;
/** Pause nach einem fertig gezeichneten Schritt, bevor die Wiedergabe weiterschaltet */
export const STEP_HOLD_MS = 1800;

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
  const [playing, setPlaying] = useState(false);
  const ops = useMemo(() => drawOps(diagram, step), [diagram, step]);
  const last = step >= total - 1;

  // Wiedergabe: nach dem Zeichnen kurz halten, dann weiter; am Ende anhalten
  useEffect(() => {
    if (!playing) return;
    if (last) {
      const id = window.setTimeout(() => setPlaying(false), stepDurationMs(diagram, step));
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => onStep(step + 1), stepDurationMs(diagram, step) + STEP_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [playing, last, step, diagram, onStep]);

  const toggle = () => {
    if (playing) return setPlaying(false);
    if (last) onStep(0);
    setPlaying(true);
  };

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
      <div className={styles.controls}>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t.prev}
          disabled={step === 0}
          onClick={() => {
            setPlaying(false);
            onStep(step - 1);
          }}
        >
          <StepBackIcon />
        </button>
        <button type="button" className={styles.playButton} onClick={toggle}>
          {playing ? <PauseIcon /> : last ? <RefreshIcon /> : <PlayIcon />}
          <span>{playing ? t.pause : last ? t.replay : t.play}</span>
        </button>
        <button
          type="button"
          className={styles.iconButton}
          aria-label={t.next}
          disabled={last}
          onClick={() => {
            setPlaying(false);
            onStep(step + 1);
          }}
        >
          <StepForwardIcon />
        </button>
      </div>
      <p className={styles.stepNow} aria-live="polite">
        <strong>{t.stepOf(step + 1, total)}</strong> {steps[step]}
      </p>
    </div>
  );
}
