// Mehr → Knoten: Liste mit Einsatzzweck, Filter nach Einsatz. Animierte Knoten öffnen die Schritt-Anleitung.
import { useState } from 'react';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { ListLink } from '../../design/components/ListLink';
import { Badge } from '../../design/components/Badge';
import { KnotIcon } from '../../design/icons';
import pageStyles from '../../design/components/Page.module.css';
import { KNOT_USES, KNOTS, type KnotUse } from './catalog';
import { KnotTabs } from './KnotTabs';
import styles from './Knots.module.css';

const t = de.knots;

export function KnotsPage() {
  const [use, setUse] = useState<KnotUse>();
  const shown = KNOTS.filter((k) => !use || k.uses.includes(use));
  return (
    <Page title={t.title} back="/mehr">
      <KnotTabs />
      <p className="muted">{t.intro}</p>
      <div className={styles.filters} role="group" aria-label={t.filterLabel}>
        <button type="button" className={styles.chip} aria-pressed={!use} onClick={() => setUse(undefined)}>
          {t.all}
        </button>
        {KNOT_USES.map((u) => (
          <button
            key={u}
            type="button"
            className={styles.chip}
            aria-pressed={use === u}
            onClick={() => setUse(u)}
          >
            {t.usesShort[u]}
          </button>
        ))}
      </div>
      <div className={pageStyles.card}>
        {shown.map((k) => {
          const text = t.items[k.id];
          return (
            <ListLink
              key={k.id}
              to={k.diagram ? `/mehr/knoten/${k.slug}` : undefined}
              icon={<KnotIcon />}
              title={text.name}
              hint={`${k.uses.map((u) => t.uses[u]).join(' · ')} – ${text.short}`}
              badge={k.diagram ? <Badge tone="info">{t.animated}</Badge> : <Badge>{t.comingSoon}</Badge>}
            />
          );
        })}
      </div>
    </Page>
  );
}
