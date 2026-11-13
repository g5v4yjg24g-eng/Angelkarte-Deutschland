// Landesrecht am Fang als Karte (Vorlage Nutzer 2026-11-12): Wappen, Land, drei Prüfpunkte mit Haken, Hinweis zu
// fehlenden Regeln, Link zu allen Regeln. Verstöße stehen mit Fundstelle darüber. Immer „keine Rechtsauskunft“.
// Alle anderen Fälle (Land unklar, keine Daten) zeigt das bekannte Feld `LawCheckPanel`.
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { Notice } from '../../design/components/Notice';
import { CheckIcon, ChevronRightIcon, CloseIcon, ExternalIcon } from '../../design/icons';
import type { WaterPhoto } from '../../domain/waterPhotos';
import { violations, type LawCheck } from '../../domain/regulationCheck';
import type { StateCode } from '../../domain/water';
import { WaterRulesNote } from '../permits/WaterRulesSection';
import { StateCrest } from '../map/StateCrest';
import { FindingItem, LawCheckPanel } from './LawCheckPanel';
import styles from './LawCard.module.css';

const t = de.lawCheck;
const v = de.catchView;

export function LawCheckCard({
  check,
  hasPosition,
  waterId,
  crests,
  onChooseState,
}: {
  check: LawCheck | undefined;
  hasPosition: boolean;
  waterId?: string | undefined;
  /** Landeswappen je Bundesland, falls geladen */
  crests?: Readonly<Record<string, WaterPhoto>> | undefined;
  onChooseState?: (code: StateCode) => void;
}) {
  if (!check || check.status === 'notApplicable') return null;
  if (check.status !== 'checked')
    return (
      <LawCheckPanel
        check={check}
        hasPosition={hasPosition}
        waterId={waterId}
        {...(onChooseState ? { onChooseState } : {})}
      />
    );
  const name = de.water.states[check.state];
  const bad = violations(check.findings);
  const has = (kind: string) => bad.some((f) => f.kind === kind);
  const needsLength = check.findings.some((f) => f.kind === 'needsLength');
  const items: { key: string; text: string; state: 'ok' | 'bad' | 'open' }[] = [
    { key: 'closed', text: v.checkClosed, state: has('closed') ? 'bad' : 'ok' },
    { key: 'protected', text: v.checkProtected, state: has('protected') ? 'bad' : 'ok' },
    {
      key: 'size',
      text: needsLength ? v.sizeUnchecked : v.checkSize,
      state: has('undersize') || has('oversize') ? 'bad' : needsLength ? 'open' : 'ok',
    },
  ];
  return (
    <section className={styles.card} aria-label={t.titleState(name)}>
      <Link to={`/mehr/recht/${check.state}`} className={styles.head} aria-label={t.allRules(name)}>
        <StateCrest crest={crests?.[check.state]} className={styles.crest} />
        <span className={styles.headText}>
          <strong>{t.titleState(name)}</strong>
          <span className="muted">{v.rulesSub}</span>
        </span>
        <ChevronRightIcon size={22} aria-hidden="true" />
      </Link>
      {bad.length > 0 && (
        <Notice tone={check.released ? 'info' : 'warning'}>
          <strong>{t.warnTitle}</strong>
          <ul className={styles.findings}>
            {bad.map((f, i) => (
              <FindingItem key={i} f={f} set={check.set} />
            ))}
          </ul>
          {check.released && <p>{t.released}</p>}
          {check.estimated && <p>{t.estimated}</p>}
        </Notice>
      )}
      <ul className={styles.checks}>
        {items.map((i) => (
          <li key={i.key} className={i.state === 'bad' ? styles.bad : i.state === 'open' ? styles.open : ''}>
            {i.state === 'bad' ? (
              <CloseIcon size={18} aria-hidden="true" />
            ) : (
              <CheckIcon size={18} aria-hidden="true" />
            )}
            <span>{i.text}</span>
            {i.state === 'bad' && <span className="visually-hidden"> ({v.violated})</span>}
          </li>
        ))}
      </ul>
      {check.set.missing?.length ? (
        <p className={styles.note}>{t.partial(check.set.missing.join('; '))}</p>
      ) : null}
      <Link to={`/mehr/recht/${check.state}`} className={styles.link}>
        <ExternalIcon size={16} aria-hidden="true" /> {t.allRules(name)}
      </Link>
      <p className={styles.note}>{de.law.disclaimer}</p>
      <WaterRulesNote waterId={waterId} />
    </section>
  );
}
