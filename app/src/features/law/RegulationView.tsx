// Landesrecht eines Landes (DATA_MODEL §7): jede Angabe mit Fundstelle, Prüfstand und Quellen.
// Zeigt nur, was in der geprüften Datei steht; nichts wird berechnet oder ergänzt.
import { de } from '../../i18n/de';
import { Badge } from '../../design/components/Badge';
import { Notice } from '../../design/components/Notice';
import { speciesById } from '../../domain/species';
import {
  berlinDay,
  freshness,
  inClosedSeason,
  type MonthDay,
  type RegulationSet,
} from '../../domain/regulations';
import styles from './Law.module.css';

const t = de.law;
const pad = (n: number) => String(n).padStart(2, '0');
const md = (d: MonthDay) => `${pad(d.day)}.${pad(d.month)}.`;
const formatCheckedDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
const speciesName = (id: string) => speciesById(id)?.de ?? t.unknownSpecies;

export function Disclaimer() {
  return <Notice tone="warning">{t.disclaimer}</Notice>;
}

function Section({ title, empty, children }: { title: string; empty: boolean; children: React.ReactNode }) {
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      {empty ? <p className={styles.note}>{t.noEntries}</p> : children}
    </section>
  );
}

function Scope({ scope, note }: { scope?: string | undefined; note?: string | undefined }) {
  return (
    <>
      {scope && <span className={styles.sub}>{scope}</span>}
      {note && <span className={styles.sub}>{note}</span>}
    </>
  );
}

export function RegulationView({ set, nowMs }: { set: RegulationSet; nowMs: number }) {
  const basis = new Map(set.legalBasis.map((b) => [b.id, b]));
  const ref = (r: { basisId: string; basisRef: string }) =>
    t.ref(r.basisRef, basis.has(r.basisId) ? r.basisId : '');
  const checked = formatCheckedDate(set.checkedAt);
  const fresh = freshness(set.checkedAt, nowMs);
  const today = berlinDay(nowMs);
  const bySpecies = <T extends { speciesId: string }>(list: T[]) =>
    [...list].sort((a, b) => speciesName(a.speciesId).localeCompare(speciesName(b.speciesId), 'de'));

  return (
    <div className={styles.stack}>
      <Disclaimer />
      <div className={styles.section}>
        <div className={styles.statusRow}>
          <Badge tone={set.status === 'verified' ? 'info' : 'warning'}>
            {set.status === 'verified' ? t.status.verified : t.status.partial}
          </Badge>
          {fresh === 'current' && <span className={styles.note}>{t.checkedAt(checked)}</span>}
        </div>
        {fresh === 'stale' && <Notice tone="warning">{t.stale(checked)}</Notice>}
        {fresh === 'outdated' && <Notice tone="error">{t.outdated(checked)}</Notice>}
        {set.status === 'partial' && set.missing && (
          <Notice tone="warning">{t.missing(set.missing.join(', '))}</Notice>
        )}
      </div>

      <Section title={t.closedSeasons} empty={set.closedSeasons.length === 0}>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t.colSpecies}</th>
                <th scope="col">{t.colPeriod}</th>
                <th scope="col">{t.colRef}</th>
              </tr>
            </thead>
            <tbody>
              {bySpecies(set.closedSeasons).map((r, i) => (
                <tr key={`${r.speciesId}-${i}`}>
                  <td>
                    {speciesName(r.speciesId)}
                    <Scope scope={r.scope} note={r.note} />
                  </td>
                  <td>
                    <span className={`tabular ${styles.nowrap}`}>{t.period(md(r.from), md(r.to))}</span>
                    {inClosedSeason(r, today) && (
                      <span className={styles.sub}>
                        <Badge tone="warning">{t.closedToday}</Badge>
                      </span>
                    )}
                  </td>
                  <td className={styles.ref}>{ref(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={t.minSizes} empty={set.minSizes.length === 0}>
        <div className={styles.scroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">{t.colSpecies}</th>
                <th scope="col">{t.colMin}</th>
                <th scope="col">{t.colRef}</th>
              </tr>
            </thead>
            <tbody>
              {bySpecies(set.minSizes).map((r, i) => (
                <tr key={`${r.speciesId}-${i}`}>
                  <td>
                    {speciesName(r.speciesId)}
                    <Scope scope={r.scope} note={r.note} />
                  </td>
                  <td className={`tabular ${styles.nowrap}`}>{t.cm(r.minCm)}</td>
                  <td className={styles.ref}>{ref(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title={t.protectedSpecies} empty={set.protectedSpecies.length === 0}>
        <ul className={styles.list}>
          {bySpecies(set.protectedSpecies).map((r) => (
            <li key={r.speciesId}>
              {speciesName(r.speciesId)} <span className={styles.ref}>{ref(r)}</span>
              <Scope note={r.note} />
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t.licences} empty={set.licences.length === 0}>
        <ul className={styles.list}>
          {set.licences.map((r, i) => (
            <li key={i}>
              <strong>{t.licenceKinds[r.kind]}:</strong> {r.text} <span className={styles.ref}>{ref(r)}</span>
            </li>
          ))}
        </ul>
      </Section>

      {set.otherRules.length > 0 && (
        <Section title={t.otherRules} empty={false}>
          <ul className={styles.list}>
            {set.otherRules.map((r, i) => (
              <li key={i}>
                <strong>{r.topic}:</strong> {r.text} <span className={styles.ref}>{ref(r)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <section className={styles.section}>
        <h2>{t.sources}</h2>
        <ul className={styles.list}>
          {set.legalBasis.map((b) => (
            <li key={b.id}>
              <a href={b.url} target="_blank" rel="noreferrer">
                {b.title} ({b.id})
              </a>
              <span className={styles.sub}>{t.version(b.version, formatCheckedDate(b.retrievedAt))}</span>
            </li>
          ))}
        </ul>
        {fresh === 'current' || <p className={styles.note}>{t.checkedAt(checked)}</p>}
      </section>
    </div>
  );
}
