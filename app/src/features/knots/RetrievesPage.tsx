// Mehr → Köderführung: Liste mit Einsatzzweck, Filter nach Wassertiefe. Jede Technik öffnet die Anleitung.
import { useState } from 'react';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { ListLink } from '../../design/components/ListLink';
import { HookIcon } from '../../design/icons';
import pageStyles from '../../design/components/Page.module.css';
import { RETRIEVE_ZONES, RETRIEVES, type RetrieveZone } from './retrieveCatalog';
import { KnotTabs } from './KnotTabs';
import styles from './Knots.module.css';

const t = de.retrieves;

export function RetrievesPage() {
  const [zone, setZone] = useState<RetrieveZone>();
  const shown = RETRIEVES.filter((r) => !zone || r.zone === zone);
  return (
    <Page title={t.title} back="/mehr">
      <KnotTabs />
      <p className="muted">{t.intro}</p>
      <div className={styles.filters} role="group" aria-label={t.filterLabel}>
        <button type="button" className={styles.chip} aria-pressed={!zone} onClick={() => setZone(undefined)}>
          {t.all}
        </button>
        {RETRIEVE_ZONES.map((z) => (
          <button
            key={z}
            type="button"
            className={styles.chip}
            aria-pressed={zone === z}
            onClick={() => setZone(z)}
          >
            {t.zones[z]}
          </button>
        ))}
      </div>
      <div className={pageStyles.card}>
        {shown.map((r) => {
          const text = t.items[r.id];
          return (
            <ListLink
              key={r.id}
              to={`/mehr/koederfuehrung/${r.slug}`}
              icon={<HookIcon />}
              title={text.name}
              hint={`${t.zones[r.zone]} – ${text.short}`}
            />
          );
        })}
      </div>
    </Page>
  );
}
