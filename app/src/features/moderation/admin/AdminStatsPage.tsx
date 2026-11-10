// Admin → Verwaltung → Statistiken (Wunsch Nutzer 2026-11-10): echte Zahlen aus mod_stats, nur Zahlen, keine Personen.
// Darstellung bewusst schlicht: Kennzahlen als Kacheln, Verteilungen als beschriftete Balken (Zahl steht immer daneben,
// die Balkenlänge ist nur Hilfe), Wochen als Tabelle.
import { useEffect, useState } from 'react';
import { de } from '../../../i18n/de';
import { Page, Section } from '../../../design/components/Page';
import { Notice } from '../../../design/components/Notice';
import { SegmentedControl } from '../../../design/components/SegmentedControl';
import {
  STATS_PERIODS,
  interventions,
  toBars,
  type ModStats,
  type StatsPeriod,
} from '../../../domain/modTools';
import { useProviders } from '../../../ports/providersContext';
import { ADMIN_BASE } from './adminPaths';
import { modErrorText } from './modErrors';
import styles from './ModAdmin.module.css';

const t = de.modAdmin.stats;
const PERIODS = STATS_PERIODS.map((d) => ({ value: String(d) as `${StatsPeriod}`, label: t.periods[d] }));
const reasonLabel = (k: string) => de.moderation.reasons[k as keyof typeof de.moderation.reasons] ?? k;
const kindLabel = (k: string) => de.modAdmin.kinds[k as keyof typeof de.modAdmin.kinds] ?? k;
const actionLabel = (k: string) => de.modAdmin.logActions[k] ?? k;
const weekLabel = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  });

export function AdminStatsPage() {
  const { account } = useProviders();
  const [period, setPeriod] = useState<StatsPeriod>(30);
  const [loaded, setLoaded] = useState<{ period: StatsPeriod; stats?: ModStats; error?: string }>();
  const stats = loaded?.period === period ? loaded.stats : undefined;
  const error = loaded?.period === period ? loaded.error : undefined;

  useEffect(() => {
    let live = true;
    account
      .modStats(period)
      .then((s) => live && setLoaded(s ? { period, stats: s } : { period, error: t.error }))
      .catch((e: unknown) => live && setLoaded({ period, error: modErrorText(e) }));
    return () => {
      live = false;
    };
  }, [account, period]);

  return (
    <Page title={t.title} back={`${ADMIN_BASE}/verwaltung`}>
      <SegmentedControl
        label={t.period}
        options={PERIODS}
        value={String(period) as `${StatsPeriod}`}
        onChange={(v) => setPeriod(Number(v) as StatsPeriod)}
      />
      <p className={`muted ${styles.small}`}>{t.privacy}</p>
      {error && <Notice tone="error">{error}</Notice>}
      {!stats && !error && <p className="muted">{de.modAdmin.loading}</p>}
      {stats && (
        <>
          <div className={styles.kpis} role="group" aria-label={t.kpis}>
            <Kpi label={t.reports} value={stats.reports} />
            <Kpi label={t.done} value={stats.reportsDone} />
            <Kpi
              label={t.median}
              value={stats.medianHours === undefined ? t.missing : t.medianValue(stats.medianHours)}
            />
            <Kpi label={t.interventions} value={interventions(stats.actions)} />
            <Kpi label={t.newUsers} value={stats.newUsers} />
          </div>
          <Section title={t.now}>
            <div className={styles.kpis}>
              <Kpi label={t.bannedNow} value={stats.bannedNow} />
              <Kpi label={t.warnedNow} value={stats.warnedNow} />
            </div>
          </Section>
          <Bars title={t.byReason} values={stats.byReason} label={reasonLabel} />
          <Bars title={t.byKind} values={stats.byKind} label={kindLabel} />
          <Bars title={t.actions} values={stats.actions} label={actionLabel} />
          <Section title={t.weeks}>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">{t.week}</th>
                    <th scope="col">{t.reports}</th>
                    <th scope="col">{t.newUsers}</th>
                  </tr>
                </thead>
                <tbody>
                  {[...stats.weeks].reverse().map((w) => (
                    <tr key={w.week}>
                      <th scope="row">{weekLabel(w.week)}</th>
                      <td>{w.reports}</td>
                      <td>{w.newUsers}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </Page>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className={styles.kpi}>
      <b>{typeof value === 'number' ? value.toLocaleString('de-DE') : value}</b>
      <span>{label}</span>
    </div>
  );
}

function Bars({
  title,
  values,
  label,
}: {
  title: string;
  values: Record<string, number>;
  label: (key: string) => string;
}) {
  const bars = toBars(values);
  return (
    <Section title={title}>
      {bars.length === 0 ? (
        <p className="muted">{t.none}</p>
      ) : (
        <ul className={styles.bars}>
          {bars.map((b) => (
            <li key={b.key}>
              <span className={styles.barLabel}>{label(b.key)}</span>
              <span className={styles.barTrack} aria-hidden="true">
                <span className={styles.barFill} style={{ width: `${Math.max(4, b.share * 100)}%` }} />
              </span>
              <span className={styles.barValue}>{b.value.toLocaleString('de-DE')}</span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
