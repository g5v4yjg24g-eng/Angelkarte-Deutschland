// Landesrecht eines Landes; ohne geprüfte Datei ein erklärender Leerzustand mit Link zum Portal (LAW-4).
import { useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { ParagraphIcon } from '../../design/icons';
import { isStateCode, STATE_PORTALS } from '../../domain/regulations';
import { NotFound } from '../../app/NotFound';
import { Disclaimer, RegulationView } from './RegulationView';
import { useRegulation } from './useRegulation';
import styles from './Law.module.css';

const t = de.law;

export function StateLawPage() {
  const { state = '' } = useParams();
  const code = isStateCode(state) ? state : undefined;
  const [search] = useSearchParams();
  const r = useRegulation(code, search.has('pruefung'));
  const [nowMs] = useState(() => Date.now());
  if (!code) return <NotFound />;
  const name = de.water.states[code];

  return (
    <Page title={name} back="/mehr/recht">
      {!r ? (
        <Notice>{t.loading}</Notice>
      ) : r.kind === 'ok' ? (
        <RegulationView set={r.set} nowMs={nowMs} />
      ) : r.kind === 'none' ? (
        <div className={styles.stack}>
          <EmptyState
            icon={<ParagraphIcon size={32} />}
            title={t.noneTitle(name)}
            action={
              <a href={STATE_PORTALS[code]} target="_blank" rel="noreferrer" className={styles.linkButton}>
                {t.portal}
              </a>
            }
          >
            {t.noneText}
          </EmptyState>
          <Disclaimer />
        </div>
      ) : (
        <div className={styles.stack}>
          <Notice tone="error">{r.kind === 'invalid' ? t.invalid : t.loadError}</Notice>
          <Disclaimer />
        </div>
      )}
    </Page>
  );
}
