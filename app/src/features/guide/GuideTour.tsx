// Kurztour: 7 Schritte im Vollbild-Dialog (natives dialog: Fokusfalle, Escape). Jeder Schritt hat Symbol, Text, zwei Tipps
// und „Probier’s aus“, das zur Funktion führt. Überspringen und Schließen merken, dass die Tour gesehen wurde.
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { Button } from '../../design/components/Button';
import { clampStep, isLastStep, TOUR } from '../../domain/guide';
import { GUIDE_ROUTE, guideIcon } from './catalog';
import { markGuideSeen } from './guideState';
import styles from './Guide.module.css';

const t = de.guide;

export function GuideTour({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
    }
    if (!open && d.open) d.close();
  }, [open]);

  if (!open) return <dialog ref={ref} className={styles.tour} aria-label={t.tour.label} />;
  const count = TOUR.length;
  const id = TOUR[clampStep(index, count)] ?? TOUR[0];
  if (!id) return null;
  const topic = t.topics[id];
  const last = isLastStep(index, count);
  const finish = () => {
    void markGuideSeen();
    setIndex(0);
    onClose();
  };
  return (
    <dialog
      ref={ref}
      className={styles.tour}
      aria-label={t.tour.label}
      onCancel={(e) => {
        e.preventDefault();
        finish();
      }}
    >
      <div className={styles.bar}>
        <span aria-live="polite">{t.tour.count(index + 1, count)}</span>
        <button type="button" className={styles.skip} onClick={finish}>
          {t.tour.skip}
        </button>
      </div>
      <div className={styles.body}>
        <span className={styles.tile} aria-hidden="true">
          {guideIcon(id, 52)}
        </span>
        <h2>{topic.title}</h2>
        <p>{topic.intro}</p>
        <ul className={styles.tips}>
          {topic.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <Link to={GUIDE_ROUTE[id]} className={styles.go} onClick={finish}>
          {topic.go} →
        </Link>
      </div>
      <div className={styles.foot}>
        <ol className={styles.dots} aria-label={t.tour.steps}>
          {TOUR.map((s, i) => (
            <li
              key={s}
              className={i === index ? `${styles.dot} ${styles.dotOn}` : styles.dot}
              aria-hidden="true"
            />
          ))}
        </ol>
        <div className={styles.nav}>
          <Button
            variant="secondary"
            disabled={index === 0}
            onClick={() => setIndex((i) => clampStep(i - 1, count))}
          >
            {t.tour.prev}
          </Button>
          <Button onClick={last ? finish : () => setIndex((i) => clampStep(i + 1, count))} autoFocus>
            {last ? t.tour.done : t.tour.next}
          </Button>
        </div>
      </div>
    </dialog>
  );
}
