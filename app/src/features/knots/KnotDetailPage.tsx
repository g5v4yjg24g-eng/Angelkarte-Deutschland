// Anleitung eines Knotens: Animation, Schrittliste (antippbar), Tipps.
import { useState } from 'react';
import { useParams } from 'react-router';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { Notice } from '../../design/components/Notice';
import { knotBySlug } from './catalog';
import { KnotPlayer } from './KnotPlayer';
import styles from './Knots.module.css';

const t = de.knots;

export function KnotDetailPage() {
  const { knot = '' } = useParams();
  const entry = knotBySlug(knot);
  const [step, setStep] = useState(0);
  const text = entry ? t.items[entry.id] : undefined;
  const steps = text && 'steps' in text ? text.steps : undefined;

  if (!entry || !text || !entry.diagram || !steps)
    return (
      <Page title={t.title} back="/mehr/knoten">
        <Notice>{t.notFound}</Notice>
      </Page>
    );

  return (
    <Page title={text.name} back="/mehr/knoten">
      <p className="muted">
        {t.useLabel}: {entry.uses.map((u) => t.uses[u]).join(' · ')}. {text.short}
      </p>
      <KnotPlayer name={text.name} spec={entry.diagram} steps={steps} step={step} onStep={setStep} />
      <p className={`muted ${styles.small}`}>{t.schematic}</p>
      <Section title={t.stepsTitle}>
        <ol className={styles.steps}>
          {steps.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                className={styles.stepButton}
                aria-current={i === step ? 'step' : undefined}
                aria-label={`${t.goToStep(i + 1)}: ${s}`}
                onClick={() => setStep(i)}
              >
                <span className={styles.stepNo}>{i + 1}</span>
                <span>{s}</span>
              </button>
            </li>
          ))}
        </ol>
      </Section>
      <Section title={t.tipsTitle}>
        <ul className={styles.tips}>
          {[...('tips' in text ? text.tips : []), ...t.commonTips].map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}
