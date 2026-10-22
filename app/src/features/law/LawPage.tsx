// Übersicht Landesrecht: alle 16 Länder mit Prüfstatus.
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { ListLink } from '../../design/components/ListLink';
import { Badge } from '../../design/components/Badge';
import { Notice } from '../../design/components/Notice';
import { ParagraphIcon } from '../../design/icons';
import { STATE_CODES } from '../../domain/water';
import pageStyles from '../../design/components/Page.module.css';
import { Disclaimer } from './RegulationView';
import { useAllRegulations } from './useRegulation';
import styles from './Law.module.css';

const t = de.law;

export function LawPage() {
  const all = useAllRegulations();
  const states = [...STATE_CODES].sort((a, b) => de.water.states[a].localeCompare(de.water.states[b], 'de'));
  return (
    <Page title={t.title} back="/mehr">
      <div className={styles.stack}>
        <Disclaimer />
        <p className={styles.note}>{t.intro}</p>
        {!all ? (
          <Notice>{t.loading}</Notice>
        ) : (
          <nav aria-label={t.statesLabel} className={pageStyles.card}>
            {states.map((c) => {
              const r = all[c];
              const status = r.kind === 'ok' ? r.set.status : 'none';
              return (
                <ListLink
                  key={c}
                  to={`/mehr/recht/${c}`}
                  icon={<ParagraphIcon />}
                  title={de.water.states[c]}
                  badge={
                    <Badge
                      tone={status === 'verified' ? 'info' : status === 'partial' ? 'warning' : 'neutral'}
                    >
                      {status === 'verified'
                        ? t.status.verified
                        : status === 'partial'
                          ? t.status.partial
                          : t.status.none}
                    </Badge>
                  }
                />
              );
            })}
          </nav>
        )}
      </div>
    </Page>
  );
}
