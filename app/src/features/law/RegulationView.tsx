// Landesrecht eines Landes (DATA_MODEL §7): jede Angabe mit Fundstelle, Prüfstand und Quellen.
// Zeigt nur, was in der geprüften Datei steht; nichts wird berechnet oder ergänzt.
import { useState } from 'react';
import { de } from '../../i18n/de';
import { Badge } from '../../design/components/Badge';
import { Notice } from '../../design/components/Notice';
import { Button } from '../../design/components/Button';
import { TextField } from '../../design/components/Field';
import {
  berlinDay,
  filterSpeciesRules,
  freshness,
  inClosedSeason,
  type RegulationSet,
  taxonLabel,
} from '../../domain/regulations';
import { md, sizeText } from './lawText';
import styles from './Law.module.css';

const t = de.law;
const formatCheckedDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
type Taxon = { taxon: { de: string; sci?: string | undefined } };

function Species({ r }: { r: Taxon }) {
  return (
    <>
      {taxonLabel(r)}
      {r.taxon.sci && <span className={styles.sci}> ({r.taxon.sci})</span>}
    </>
  );
}

export function Disclaimer() {
  return <Notice tone="warning">{t.disclaimer}</Notice>;
}

function Section({
  title,
  empty,
  emptyText = t.noEntries,
  children,
}: {
  title: string;
  empty: boolean;
  emptyText?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={styles.section}>
      <h2>{title}</h2>
      {empty ? <p className={styles.note}>{emptyText}</p> : children}
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
  const bySpecies = <T extends Taxon>(list: T[]) =>
    [...list].sort((a, b) => taxonLabel(a).localeCompare(taxonLabel(b), 'de'));
  // Suche nach Fischarten und „nur Schonzeit“ (Wunsch Nutzer 2026-10-25)
  const [query, setQuery] = useState('');
  const [closedOnly, setClosedOnly] = useState(false);
  const filtering = query.trim() !== '' || closedOnly;
  const shown = filterSpeciesRules(set, { query, closedOn: closedOnly ? today : undefined });
  const noHits =
    filtering && !shown.closedSeasons.length && !shown.minSizes.length && !shown.protectedSpecies.length;
  const emptyText = filtering ? t.filter.noneInSection : t.noEntries;
  const reset = () => {
    setQuery('');
    setClosedOnly(false);
  };

  return (
    <div className={styles.stack}>
      <Disclaimer />
      <div className={styles.section}>
        <div className={styles.statusRow}>
          <Badge tone={set.status === 'verified' ? 'info' : 'warning'}>{t.status[set.status]}</Badge>
          {set.status === 'draft' ? (
            <span className={styles.note}>{t.recordedAt(checked)}</span>
          ) : (
            fresh === 'current' && <span className={styles.note}>{t.checkedAt(checked)}</span>
          )}
        </div>
        {set.status === 'draft' && <Notice tone="error">{t.draftBanner(set.checkedBy)}</Notice>}
        {set.status !== 'draft' && fresh === 'stale' && <Notice tone="warning">{t.stale(checked)}</Notice>}
        {set.status !== 'draft' && fresh === 'outdated' && (
          <Notice tone="error">{t.outdated(checked)}</Notice>
        )}
        {set.status !== 'verified' && set.missing && (
          <Notice tone="warning">{t.missing(set.missing.join(', '))}</Notice>
        )}
      </div>

      <div role="search" className={styles.filterBar} aria-label={t.filter.label}>
        <TextField
          label={t.filter.search}
          type="search"
          placeholder={t.filter.placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className={styles.toggle}
          aria-pressed={closedOnly}
          onClick={() => setClosedOnly((v) => !v)}
        >
          {t.filter.closedOnly}
        </button>
        {closedOnly && <p className={styles.note}>{t.filter.closedOnlyHint(md(today))}</p>}
        <p className="visually-hidden" role="status">
          {filtering
            ? t.filter.result(
                shown.closedSeasons.length + shown.minSizes.length + shown.protectedSpecies.length,
              )
            : ''}
        </p>
      </div>

      {noHits && (
        <div className={styles.section}>
          <Notice>{closedOnly && !query.trim() ? t.filter.noneClosed : t.filter.none}</Notice>
          <div>
            <Button variant="secondary" onClick={reset}>
              {t.filter.reset}
            </Button>
          </div>
        </div>
      )}

      <Section title={t.closedSeasons} empty={shown.closedSeasons.length === 0} emptyText={emptyText}>
        <ul className={styles.list}>
          {bySpecies(shown.closedSeasons).map((r, i) => (
            <li key={i} className={styles.rule}>
              <div className={styles.ruleHead}>
                <span>
                  <Species r={r} />
                </span>
                <strong className={`tabular ${styles.nowrap}`}>{t.period(md(r.from), md(r.to))}</strong>
              </div>
              {inClosedSeason(r, today) && <Badge tone="warning">{t.closedToday}</Badge>}
              <Scope scope={r.scope} note={r.note} />
              <span className={styles.refLine}>{ref(r)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t.minSizes} empty={shown.minSizes.length === 0} emptyText={emptyText}>
        <ul className={styles.list}>
          {bySpecies(shown.minSizes).map((r, i) => (
            <li key={i} className={styles.rule}>
              <div className={styles.ruleHead}>
                <span>
                  <Species r={r} />
                </span>
                <strong className={`tabular ${styles.nowrap}`}>{sizeText(r)}</strong>
              </div>
              {r.minCm !== undefined && r.maxCm !== undefined && (
                <span className={styles.sub}>{t.windowLabel}</span>
              )}
              {r.dailyLimit !== undefined && <span className={styles.sub}>{t.dailyLimit(r.dailyLimit)}</span>}
              <Scope scope={r.scope} note={r.note} />
              <span className={styles.refLine}>{ref(r)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t.protectedSpecies} empty={shown.protectedSpecies.length === 0} emptyText={emptyText}>
        <ul className={styles.list}>
          {bySpecies(shown.protectedSpecies).map((r, i) => (
            <li key={i}>
              <Species r={r} /> <span className={styles.ref}>{ref(r)}</span>
              <Scope scope={r.scope} note={r.note} />
            </li>
          ))}
        </ul>
      </Section>

      {filtering && <p className={styles.note}>{t.filter.otherHidden}</p>}

      {!filtering && (
        <Section title={t.licences} empty={set.licences.length === 0}>
          <ul className={styles.list}>
            {set.licences.map((r, i) => (
              <li key={i}>
                <strong>{t.licenceKinds[r.kind]}:</strong> {r.text}{' '}
                <span className={styles.ref}>{ref(r)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {!filtering && set.otherRules.length > 0 && (
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
        {set.status !== 'draft' && fresh !== 'current' && (
          <p className={styles.note}>{t.checkedAt(checked)}</p>
        )}
      </section>
    </div>
  );
}
