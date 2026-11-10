// Admin → Meldungen (nur Moderatoren, MODERATION_PLAN.md): Meldungen nach Stand, neueste zuerst, mit Priorität
// (nur als Hinweis – nie automatisch gehandelt).
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { de } from '../../../i18n/de';
import { Page } from '../../../design/components/Page';
import { Notice } from '../../../design/components/Notice';
import { SegmentedControl } from '../../../design/components/SegmentedControl';
import { reportPriority, type ModPriority, type ModReport } from '../../../domain/modAdmin';
import { ADMIN_BASE } from './adminPaths';
import { useProviders } from '../../../ports/providersContext';
import { modDate, modErrorText } from './modErrors';
import styles from './ModAdmin.module.css';

const t = de.modAdmin;
type Filter = 'open' | 'done' | 'all';
const FILTERS = [
  { value: 'open', label: t.open },
  { value: 'done', label: t.done },
  { value: 'all', label: t.all },
] as const satisfies readonly { value: Filter; label: string }[];

export function ModerationPage() {
  const { account } = useProviders();
  const [filter, setFilter] = useState<Filter>('open');
  // Ergebnis je Filter: beim Umschalten gilt die alte Liste nicht mehr (= lädt)
  const [loaded, setLoaded] = useState<{ filter: Filter; list?: ModReport[]; error?: string }>();
  const list = loaded?.filter === filter ? loaded.list : undefined;
  const error = loaded?.filter === filter ? loaded.error : undefined;

  useEffect(() => {
    let live = true;
    account
      .modReports(filter)
      .then((l) => live && setLoaded({ filter, list: l }))
      .catch((e: unknown) => live && setLoaded({ filter, error: modErrorText(e) }));
    return () => {
      live = false;
    };
  }, [account, filter]);

  return (
    <Page title={t.nav.reports}>
      <SegmentedControl label={t.filter} options={FILTERS} value={filter} onChange={setFilter} />
      {error && <Notice tone="error">{error}</Notice>}
      {!list && !error && <p className="muted">{t.loading}</p>}
      {list && list.length === 0 && <p className="muted">{filter === 'open' ? t.emptyOpen : t.empty}</p>}
      {list && list.length > 0 && (
        <ul className={styles.list}>
          {list.map((r) => (
            <li key={r.id}>
              <ReportItem report={r} priority={reportPriority(r)} />
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

/** Eine Meldung in der Liste (auch in der Übersicht): Art und Grund, gegen wen, wann, Stand, Priorität */
export function ReportItem({ report: r, priority }: { report: ModReport; priority: ModPriority }) {
  return (
    <Link
      to={`${ADMIN_BASE}/meldungen/${r.id}`}
      className={[styles.item, priority === 'low' ? '' : styles[`prio_${priority}`]].join(' ')}
    >
      <span className={styles.row}>
        <strong>
          {t.kinds[r.kind]}:{' '}
          {de.moderation.reasons[r.reason as keyof typeof de.moderation.reasons] ?? r.reason}
        </strong>
        <span className={r.status === 'open' ? styles.tagDanger : styles.tag}>
          {r.status === 'open' ? t.statusOpen : t.statusDone}
        </span>
      </span>
      <span>
        {t.against}: {r.targetName ?? '–'}
        {r.targetUsername && ` (${t.handle(r.targetUsername)})`}
        {r.targetBanned && <span className={styles.tagDanger}> {t.banned}</span>}
      </span>
      <span className="muted">
        {modDate(r.createdAt)} · {t.reportedBy} {r.reporterName ?? '–'}
        {r.status === 'open' && priority !== 'low' && ` · ${t.overview.priority[priority]}`}
      </span>
    </Link>
  );
}
