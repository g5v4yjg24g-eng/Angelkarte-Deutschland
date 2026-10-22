// Rechts-Warnung zu einem Fang (Fangformular und Eintrag): Bundesland, Befunde mit Fundstelle, Hinweis
// „keine Rechtsauskunft". Warnt nur – Speichern bleibt immer möglich.
import { Link } from 'react-router';
import { de } from '../../i18n/de';
import { Notice } from '../../design/components/Notice';
import { taxonLabel, type RegulationSet } from '../../domain/regulations';
import { violations, type Finding, type LawCheck } from '../../domain/regulationCheck';
import type { StateCode } from '../../domain/water';
import { md, sizeText } from './lawText';
import styles from './Law.module.css';

const t = de.lawCheck;
const stateName = (c: StateCode) => de.water.states[c];

function findingText(f: Finding): string {
  const sp = taxonLabel(f.rule);
  switch (f.kind) {
    case 'closed':
      return t.closed(sp, de.law.period(md(f.rule.from), md(f.rule.to)));
    case 'protected':
      return t.protected(sp);
    case 'undersize':
      return t.undersize(sp, t.lengthValue(f.lengthCm), sizeText(f.rule));
    case 'oversize':
      return t.oversize(sp, t.lengthValue(f.lengthCm), sizeText(f.rule));
    case 'needsLength':
      return t.needsLength(sp, sizeText(f.rule));
  }
}

function FindingItem({ f, set }: { f: Finding; set: RegulationSet }) {
  const basis = set.legalBasis.find((b) => b.id === f.rule.basisId);
  return (
    <li>
      {findingText(f)}
      {f.rule.scope && <span className={styles.sub}>{t.scoped(f.rule.scope)}</span>}
      <span className={styles.sub}>
        {f.rule.basisRef}{' '}
        {basis && (
          <a href={basis.url} target="_blank" rel="noreferrer noopener">
            {basis.title}
          </a>
        )}
      </span>
    </li>
  );
}

export function LawCheckPanel({
  check,
  hasPosition,
  onChooseState,
}: {
  check: LawCheck | undefined;
  hasPosition: boolean;
  /** nur im Formular: Land in Grenznähe wählen */
  onChooseState?: (code: StateCode) => void;
}) {
  if (!check || check.status === 'notApplicable') return null;
  const title =
    check.status === 'checked' || check.status === 'noData' ? t.titleState(stateName(check.state)) : t.title;
  let body: React.ReactNode;
  if (check.status === 'noState') body = <p className="muted">{hasPosition ? t.noState : t.noPosition}</p>;
  else if (check.status === 'chooseState')
    body = (
      <>
        <p>{t.chooseState}</p>
        {onChooseState && (
          <div className={styles.choices} role="group" aria-label={t.chooseState}>
            {check.candidates.map((c) => (
              <button key={c} type="button" className={styles.choice} onClick={() => onChooseState(c)}>
                {stateName(c)}
              </button>
            ))}
          </div>
        )}
      </>
    );
  else if (check.status === 'noData') body = <p className="muted">{t.noData(stateName(check.state))}</p>;
  else {
    const bad = violations(check.findings);
    const info = check.findings.filter((f) => f.kind === 'needsLength');
    body = (
      <>
        {bad.length > 0 ? (
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
        ) : (
          <p>{t.noFindings(stateName(check.state))}</p>
        )}
        {info.length > 0 && (
          <ul className={styles.findings}>
            {info.map((f, i) => (
              <FindingItem key={i} f={f} set={check.set} />
            ))}
          </ul>
        )}
        {check.set.missing?.length ? (
          <p className="muted">{t.partial(check.set.missing.join('; '))}</p>
        ) : null}
        <p className="muted">
          {de.law.disclaimer}{' '}
          <Link to={`/mehr/recht/${check.state}`}>{t.allRules(stateName(check.state))}</Link>
        </p>
      </>
    );
  }
  return (
    <section className={styles.check} aria-label={title}>
      <h3 className={styles.checkTitle}>{title}</h3>
      {body}
    </section>
  );
}
