// Anleitung einer Köderführung: wofür, Animation mit laufendem Köder, passende Köder, Schritte, Montagen, Tipps.
import { useState } from 'react';
import { useParams } from 'react-router';
import { de } from '../../i18n/de';
import { Page, Section } from '../../design/components/Page';
import { Notice } from '../../design/components/Notice';
import { ListLink } from '../../design/components/ListLink';
import { HookIcon } from '../../design/icons';
import pageStyles from '../../design/components/Page.module.css';
import { retrieveBySlug } from './retrieveCatalog';
import { RIGS } from './rigCatalog';
import { RigPlayer } from './RigPlayer';
import styles from './Knots.module.css';
import rigStyles from './Rigs.module.css';

const t = de.retrieves;

export function RetrieveDetailPage() {
  const { retrieve = '' } = useParams();
  const entry = retrieveBySlug(retrieve);
  const [step, setStep] = useState(0);

  if (!entry)
    return (
      <Page title={t.title} back="/mehr/koederfuehrung">
        <Notice>{t.notFound}</Notice>
      </Page>
    );

  const text = t.items[entry.id];
  const rigs = entry.rigs.flatMap((id) => RIGS.filter((r) => r.id === id));
  return (
    <Page title={text.name} back="/mehr/koederfuehrung">
      <p className="muted">
        {t.zones[entry.zone]} · {t.fishLabel}: {text.fish}
      </p>
      <Section title={t.purposeTitle}>
        <div className={rigStyles.purpose}>
          {text.purpose.map((p) => (
            <p key={p}>{p}</p>
          ))}
        </div>
      </Section>
      <RigPlayer
        name={text.name}
        spec={entry.diagram}
        steps={text.steps}
        step={step}
        onStep={setStep}
        labels={t.labels}
      />
      <p className={`muted ${styles.small}`}>{t.schematic}</p>
      <Section title={t.baitsTitle}>
        <ul className={styles.tips}>
          {text.baits.map((b) => (
            <li key={b}>{b}</li>
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
      {rigs.length > 0 && (
        <Section title={t.rigsTitle}>
          <div className={pageStyles.card}>
            {rigs.map((r) => (
              <ListLink
                key={r.id}
                to={`/mehr/montagen/${r.slug}`}
                icon={<HookIcon />}
                title={de.rigs.items[r.id].name}
                hint={de.rigs.items[r.id].short}
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
