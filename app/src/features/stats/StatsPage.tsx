// Statistik (M6): Kennzahlen, Verlauf, Arten, Gewässer, Köder, Methoden, Rekorde, Sessions – mit Filtern.
// Regeln gegen Irreführung stehen in domain/stats.ts (Mindestmengen, n immer sichtbar).
import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { SelectField } from '../../design/components/Field';
import { ChartIcon } from '../../design/icons';
import { getDb } from '../../data/db';
import { SPECIES, speciesById } from '../../domain/species';
import { waterNames, type CatchFilter } from '../../domain/catchDraft';
import { computeStats, NO_STATS_FILTER, type StatsFilter } from '../../domain/stats';
import { formatDuration } from '../../domain/session';
import { formatDateTime } from '../../lib/storage';
import { BarTable, StatTile, Timeline } from './Charts';
import styles from './Stats.module.css';

const t = de.stats;
const pct = (v: number) => `${Math.round(v * 100).toLocaleString('de-DE')} %`;
const rate = (v: number) => v.toLocaleString('de-DE', { maximumFractionDigits: 2, minimumFractionDigits: 1 });
const speciesName = (id: string) => speciesById(id)?.de ?? t.unknownSpecies;
const monthLabel = (key: string) =>
  new Date(`${key}-15T12:00:00Z`).toLocaleDateString('de-DE', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
const dayLabel = (key: string) =>
  new Date(`${key}T12:00:00Z`).toLocaleDateString('de-DE', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });

export function StatsPage() {
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [catches, sessions] = await Promise.all([db.catches.toArray(), db.sessions.toArray()]);
    return { catches, sessions };
  }, []);
  const [filter, setFilter] = useState<StatsFilter>(NO_STATS_FILTER);
  const [nowMs] = useState(() => Date.now());
  const active = useMemo(() => (data?.catches ?? []).filter((c) => !c.deletedAt), [data]);
  const stats = useMemo(
    () => (data ? computeStats(data.catches, data.sessions, filter, nowMs) : undefined),
    [data, filter, nowMs],
  );
  const waters = useMemo(() => waterNames(active), [active]);
  const usedSpecies = useMemo(() => {
    const ids = new Set(active.filter((c) => c.outcome === 'caught').map((c) => c.speciesId));
    return SPECIES.filter((s) => ids.has(s.id)).sort((a, b) => a.de.localeCompare(b.de, 'de'));
  }, [active]);

  if (!data || !stats)
    return (
      <Page title={t.title}>
        <Notice>{t.loading}</Notice>
      </Page>
    );

  if (!active.some((c) => c.outcome !== 'observation'))
    return (
      <Page title={t.title}>
        <EmptyState
          icon={<ChartIcon size={32} />}
          title={t.emptyTitle}
          action={
            <Link to="/" className={styles.linkButton}>
              {t.emptyAction}
            </Link>
          }
        >
          {t.emptyText}
        </EmptyState>
      </Page>
    );

  const set = <K extends keyof StatsFilter>(k: K, v: StatsFilter[K]) => setFilter((f) => ({ ...f, [k]: v }));
  const s = stats;
  const nothing = s.counts.contactsTotal === 0;

  return (
    <Page title={t.title}>
      <div className={styles.stack}>
        <div className={styles.filters} role="group" aria-label={t.filters}>
          <SelectField
            label={de.catches.filterPeriod}
            options={(Object.keys(de.catches.periods) as CatchFilter['period'][]).map((p) => ({
              value: p,
              label: de.catches.periods[p],
            }))}
            value={filter.period}
            onChange={(e) => set('period', e.target.value as StatsFilter['period'])}
          />
          <SelectField
            label={de.catches.filterSpecies}
            options={[
              { value: '', label: t.allSpecies },
              ...usedSpecies.map((x) => ({ value: x.id, label: x.de })),
            ]}
            value={filter.speciesId}
            onChange={(e) => set('speciesId', e.target.value)}
          />
          <SelectField
            label={de.catches.filterWater}
            options={[{ value: '', label: t.allWaters }, ...waters.map((w) => ({ value: w, label: w }))]}
            value={filter.water}
            onChange={(e) => set('water', e.target.value)}
          />
        </div>

        <div className={styles.tiles}>
          <StatTile label={t.caught} value={s.counts.caught.toLocaleString('de-DE')} />
          <StatTile
            label={t.contactsTotal}
            value={s.counts.contactsTotal.toLocaleString('de-DE')}
            hint={t.contactsHint}
          />
          <StatTile
            label={t.landingRate}
            value={s.landingRate.ok ? pct(s.landingRate.value) : t.tooFew(s.landingRate.n)}
            hint={
              s.landingRate.ok
                ? t.landingHint(s.counts.caught, s.landingRate.n)
                : t.tooFewLanding(s.landingRate.need)
            }
          />
          <StatTile
            label={t.perHour}
            value={s.perHour.ok ? rate(s.perHour.value) : t.tooFew(s.perHour.sessions)}
            hint={
              s.perHour.ok
                ? t.perHourHint(s.perHour.n, formatDuration(s.perHour.hours * 3600e3), s.perHour.sessions)
                : t.tooFewRate(s.perHour.need)
            }
          />
        </div>
        {(s.sessionsExcluded > 0 || s.counts.observation > 0) && (
          <div>
            {s.sessionsExcluded > 0 && (
              <p className={styles.note}>{t.excludedSessions(s.sessionsExcluded)}</p>
            )}
            {s.counts.observation > 0 && (
              <p className={styles.note}>{t.observationsNote(s.counts.observation)}</p>
            )}
          </div>
        )}

        {nothing ? (
          <Notice>{t.filterEmpty}</Notice>
        ) : (
          <>
            {s.timeline.points.length > 0 && (
              <section className={styles.section}>
                <h2>{t.timeline}</h2>
                <Timeline
                  title={s.timeline.unit === 'day' ? t.timelineDay : t.timelineMonth}
                  points={s.timeline.points.map((p) => ({ key: p.key, value: p.caught }))}
                  label={s.timeline.unit === 'day' ? dayLabel : monthLabel}
                />
              </section>
            )}

            {s.species.length > 0 && (
              <section className={styles.section}>
                <h2>{t.species}</h2>
                <BarTable
                  caption={t.species}
                  rows={s.species.map((x) => ({ label: speciesName(x.id), value: x.n }))}
                />
                {s.speciesSmallSample && <p className={styles.note}>{t.speciesSmall(s.counts.caught)}</p>}
              </section>
            )}

            {s.waters.length > 0 && (
              <section className={styles.section}>
                <h2>{t.waters}</h2>
                <BarTable
                  caption={t.waters}
                  rows={s.waters.map((w) => ({ label: w.name, value: w.caught }))}
                />
              </section>
            )}

            <section className={styles.section}>
              <h2>{t.baits}</h2>
              {s.baits.ok ? (
                <>
                  <BarTable
                    caption={t.baits}
                    rows={s.baits.value.map((b) => ({
                      label: b.name,
                      value: b.caught,
                      extra: t.bites(b.contacts),
                    }))}
                  />
                  <p className={styles.note}>{t.baitsHint}</p>
                </>
              ) : (
                <p className={styles.note}>{t.baitsTooFew(s.baits.n, s.baits.need)}</p>
              )}
            </section>

            {s.methods.length > 0 && (
              <section className={styles.section}>
                <h2>{t.methods}</h2>
                <BarTable
                  caption={t.methods}
                  rows={s.methods.map((m) => ({ label: de.catchForm.methods[m.method], value: m.caught }))}
                />
              </section>
            )}

            {s.records.length > 0 && (
              <section className={styles.section}>
                <h2>{t.records}</h2>
                <div className={styles.scroll}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th scope="col">{de.catches.filterSpecies}</th>
                        <th scope="col" className={styles.num}>
                          {t.measured}
                        </th>
                        <th scope="col" className={styles.num}>
                          {t.estimated}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.records.map((r) => (
                        <tr key={r.speciesId}>
                          <td>{speciesName(r.speciesId)}</td>
                          <td className={`tabular ${styles.num}`}>
                            {r.measuredCm === undefined ? t.rateNone : de.map.lengthValue(r.measuredCm, true)}
                          </td>
                          <td className={`tabular ${styles.num}`}>
                            {r.estimatedCm === undefined
                              ? t.rateNone
                              : de.map.lengthValue(r.estimatedCm, false)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className={styles.note}>{t.recordsHint}</p>
              </section>
            )}

            {s.sessions.length > 0 && (
              <section className={styles.section}>
                <h2>{t.sessions}</h2>
                <div className={styles.scroll}>
                  <table className={styles.dataTable}>
                    <thead>
                      <tr>
                        <th scope="col">{t.sessionDate}</th>
                        <th scope="col" className={styles.num}>
                          {t.sessionDuration}
                        </th>
                        <th scope="col" className={styles.num}>
                          {t.sessionCaught}
                        </th>
                        <th scope="col" className={styles.num}>
                          {t.sessionBites}
                        </th>
                        <th scope="col" className={styles.num}>
                          {t.sessionRate}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.sessions.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <Link to={`/fangbuch/sessions/${r.id}`}>
                              {r.title ?? formatDateTime(r.startAt)}
                            </Link>
                          </td>
                          <td className={`tabular ${styles.num}`}>{formatDuration(r.durationMs)}</td>
                          <td className={`tabular ${styles.num}`}>{r.caught}</td>
                          <td className={`tabular ${styles.num}`}>{r.contacts}</td>
                          <td
                            className={`tabular ${styles.num}`}
                            title={r.perHour === undefined ? t.rateNoneHint : undefined}
                          >
                            {r.perHour === undefined ? t.rateNone : rate(r.perHour)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </Page>
  );
}
