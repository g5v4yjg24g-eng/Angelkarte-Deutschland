// Mehr → Montagen: Liste mit Einsatzzweck, Filter nach Angelart. Jede Montage öffnet die Anleitung.
import { useState } from 'react';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { ListLink } from '../../design/components/ListLink';
import { HookIcon } from '../../design/icons';
import pageStyles from '../../design/components/Page.module.css';
import { RIG_METHODS, RIGS, type RigMethod } from './rigCatalog';
import { KnotTabs } from './KnotTabs';
import styles from './Knots.module.css';

const t = de.rigs;

export function RigsPage() {
  const [method, setMethod] = useState<RigMethod>();
  const shown = RIGS.filter((r) => !method || r.method === method);
  return (
    <Page title={t.title} back="/mehr">
      <KnotTabs />
      <p className="muted">{t.intro}</p>
      <div className={styles.filters} role="group" aria-label={t.filterLabel}>
        <button
          type="button"
          className={styles.chip}
          aria-pressed={!method}
          onClick={() => setMethod(undefined)}
        >
          {t.all}
        </button>
        {RIG_METHODS.map((m) => (
          <button
            key={m}
            type="button"
            className={styles.chip}
            aria-pressed={method === m}
            onClick={() => setMethod(m)}
          >
            {t.methods[m]}
          </button>
        ))}
      </div>
      <div className={pageStyles.card}>
        {shown.map((r) => {
          const text = t.items[r.id];
          return (
            <ListLink
              key={r.id}
              to={`/mehr/montagen/${r.slug}`}
              icon={<HookIcon />}
              title={text.name}
              hint={`${t.methods[r.method]} – ${text.short}`}
            />
          );
        })}
      </div>
    </Page>
  );
}
