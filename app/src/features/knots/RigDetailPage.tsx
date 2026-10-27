// Anleitung einer Montage: wofür sie gut ist, Animation, Material, Schritte (antippbar), passende Knoten, Tipps.
import { useState } from 'react';
import { useParams } from 'react-router';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { Notice } from '../../design/components/Notice';
import { ListLink } from '../../design/components/ListLink';
import { KnotIcon } from '../../design/icons';
import pageStyles from '../../design/components/Page.module.css';
import { rigBySlug } from './rigCatalog';
import { KNOTS } from './catalog';
import { RigPlayer } from './RigPlayer';
import styles from './Knots.module.css';
import rigStyles from './Rigs.module.css';

const t = de.rigs;

export function RigDetailPage() {
  const { rig = '' } = useParams();
  const entry = rigBySlug(rig);
  const [step, setStep] = useState(0);

  if (!entry)
    return (
      <Page title={t.title} back="/mehr/montagen">
        <Notice>{t.notFound}</Notice>
      </Page>
    );

  const text = t.items[entry.id];
  const knots = entry.knots.flatMap((id) => KNOTS.filter((k) => k.id === id));
  return (
    <Page title={text.name} back="/mehr/montagen">
      <p className="muted">
        {t.methods[entry.method]} · {t.fishLabel}: {text.fish}
      </p>
      <Section title={t.purposeTitle}>
        <div className={rigStyles.purpose}>
          {text.purpose.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </Section>
      <RigPlayer name={text.name} spec={entry.diagram} steps={text.steps} step={step} onStep={setStep} />
      <p className={`muted ${styles.small}`}>{t.schematic}</p>
      <Section title={t.materialTitle}>
        <ul className={styles.tips}>
          {text.material.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      </Section>
      <Section title={de.knots.stepsTitle}>
        <ol className={styles.steps}>
          {text.steps.map((s, i) => (
            <li key={i}>
              <button
                type="button"
                className={styles.stepButton}
                aria-current={i === step ? 'step' : undefined}
                aria-label={`${de.knots.goToStep(i + 1)}: ${s}`}
                onClick={() => setStep(i)}
              >
                <span className={styles.stepNo}>{i + 1}</span>
                <span>{s}</span>
              </button>
            </li>
          ))}
        </ol>
      </Section>
      {knots.length > 0 && (
        <Section title={t.knotsTitle}>
          <div className={pageStyles.card}>
            {knots.map((k) => (
              <ListLink
                key={k.id}
                to={`/mehr/knoten/${k.slug}`}
                icon={<KnotIcon />}
                title={de.knots.items[k.id].name}
                hint={de.knots.items[k.id].short}
              />
            ))}
          </div>
        </Section>
      )}
      <Section title={de.knots.tipsTitle}>
        <ul className={styles.tips}>
          {[...text.tips, ...t.commonTips].map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
      </Section>
    </Page>
  );
}
