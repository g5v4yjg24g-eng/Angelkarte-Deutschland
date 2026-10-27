// Gemeinsame Wiedergabe für Knoten und Montagen: Schritt zurück, Abspielen/Anhalten/Von vorn, Schritt weiter.
// Beim Abspielen wird nach dem Zeichnen eines Schritts kurz gehalten, dann weitergeschaltet; am Ende angehalten.
import { useEffect, useState } from 'react';
import { de } from '../../i18n/de';
import { PauseIcon, PlayIcon, RefreshIcon, StepBackIcon, StepForwardIcon } from '../../design/icons';
import styles from './Knots.module.css';

const t = de.knots;
/** Pause nach einem fertig gezeichneten Schritt, bevor die Wiedergabe weiterschaltet */
export const STEP_HOLD_MS = 1800;

export function StepControls({
  step,
  total,
  text,
  drawMs,
  onStep,
}: {
  step: number;
  total: number;
  text: string;
  /** Zeichendauer des aktuellen Schritts */
  drawMs: number;
  onStep: (step: number) => void;
}) {
  const [playing, setPlaying] = useState(false);
  const last = step >= total - 1;

  useEffect(() => {
    if (!playing) return;
    if (last) {
      const id = window.setTimeout(() => setPlaying(false), drawMs);
      return () => window.clearTimeout(id);
    }
    const id = window.setTimeout(() => onStep(step + 1), drawMs + STEP_HOLD_MS);
    return () => window.clearTimeout(id);
  }, [playing, last, step, drawMs, onStep]);

  const toggle = () => {
    if (playing) return setPlaying(false);
    if (last) onStep(0);
    setPlaying(true);
  };

  return (
    <>
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
        <strong>{t.stepOf(step + 1, total)}</strong> {text}
      </p>
    </>
  );
}
