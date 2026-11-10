// Admin → Meldungen (nur Moderatoren, MODERATION_PLAN.md): Meldungen nach Stand, neueste zuerst, mit Priorität
// (nur als Hinweis – nie automatisch gehandelt).
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { de } from '../../../i18n/de';
import { Page } from '../../../design/components/Page';
import { Notice } from '../../../design/components/Notice';
import { SegmentedControl } from '../../../design/components/SegmentedControl';
import {
  filterReports,
  reportPriority,
  type ModKind,
  type ModPriority,
  type ModReport,
  type ModReportStatus,
} from '../../../domain/modAdmin';
import { SelectField } from '../../../design/components/Field';
import { ADMIN_BASE } from './adminPaths';
import { useProviders } from '../../../ports/providersContext';
import { modDate, modErrorText } from './modErrors';
import styles from './ModAdmin.module.css';

const t = de.modAdmin;
type Filter = 'open' | 'in_progress' | 'done' | 'all';
const FILTERS = [
  { value: 'open', label: t.open },
  { value: 'in_progress', label: t.reports.inProgressShort },
  { value: 'done', label: t.done },
  { value: 'all', label: t.all },
] as const satisfies readonly { value: Filter; label: string }[];
const KINDS: readonly ModKind[] = ['post', 'comment', 'spot', 'user'];
const REASONS = Object.keys(de.moderation.reasons);

export function ModerationPage() {
  const { account } = useProviders();
  const [filter, setFilter] = useState<Filter>('open');
  // Ergebnis je Filter: beim Umschalten gilt die alte Liste nicht mehr (= lädt)
  const [loaded, setLoaded] = useState<{ filter: Filter; list?: ModReport[]; error?: string }>();
  const [kind, setKind] = useState<ModKind | ''>('');
  const [reason, setReason] = useState('');
  const all = loaded?.filter === filter ? loaded.list : undefined;
  const list = all && filterReports(all, { kind: kind || undefined, reason: reason || undefined });
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
      <SegmentedControl
        label={t.reports.statusFilter}
        options={FILTERS}
        value={filter}
        onChange={setFilter}
      />
      <div className={styles.filters}>
        <SelectField
          label={t.reports.kindFilter}
          value={kind}
          onChange={(e) => setKind(e.target.value as ModKind | '')}
          options={[
            { value: '', label: t.reports.allKinds },
            ...KINDS.map((k) => ({ value: k, label: t.kinds[k] })),
          ]}
        />
        <SelectField
          label={t.reports.reasonFilter}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          options={[
            { value: '', label: t.reports.allReasons },
            ...REASONS.map((x) => ({
              value: x,
              label: de.moderation.reasons[x as keyof typeof de.moderation.reasons],
            })),
          ]}
        />
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      {!list && !error && <p className="muted">{t.loading}</p>}
      {list && list.length === 0 && (
        <p className="muted">
          {kind || reason
            ? t.reports.emptyFiltered
            : filter === 'open'
              ? t.emptyOpen
              : filter === 'in_progress'
                ? t.reports.emptyInProgress
                : t.empty}
        </p>
      )}
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
        <span>
          <StatusTag status={r.status} />
          {r.targetHidden && <span className={styles.tag}> {t.reports.hidden}</span>}
        </span>
      </span>
      <span>
        {t.against}: {r.targetName ?? '–'}
        {r.targetUsername && ` (${t.handle(r.targetUsername)})`}
        {r.targetBanned && <span className={styles.tagDanger}> {t.banned}</span>}
      </span>
      <span className="muted">
        {modDate(r.createdAt)}
        {(r.sameTarget ?? 1) > 1 && ` · ${t.reports.sameTarget(r.sameTarget ?? 1)}`}
        {r.status !== 'done' && priority !== 'low' && ` · ${t.overview.priority[priority]}`}
      </span>
    </Link>
  );
}

/** Stand einer Meldung als Marke: offen (rot), in Bearbeitung (hervorgehoben), erledigt */
export function StatusTag({ status }: { status: ModReportStatus }) {
  if (status === 'open') return <span className={styles.tagDanger}>{t.statusOpen}</span>;
  if (status === 'in_progress') return <span className={styles.tagWork}>{t.reports.statusInProgress}</span>;
  return <span className={styles.tag}>{t.statusDone}</span>;
}
