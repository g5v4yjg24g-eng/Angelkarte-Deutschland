// Admin-Übersicht (Phase 1): Kennzahlen nur aus echten Zählungen (mod_overview), neueste offene Meldungen mit
// Priorität (nur als Hinweis), Schnellzugriffe. Was es noch nicht gibt, steht als „–“.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { de } from '../../../i18n/de';
import { Page, Section } from '../../../design/components/Page';
import { Notice } from '../../../design/components/Notice';
import { ListLink } from '../../../design/components/ListLink';
import { FeedIcon, FlagIcon, MailIcon, ParagraphIcon, ShieldIcon } from '../../../design/icons';
import { reportPriority, type ModOverview, type ModReport } from '../../../domain/modAdmin';
import { useProviders } from '../../../ports/providersContext';
import { ADMIN_BASE } from './adminPaths';
import { ReportItem } from './ModerationPage';
import { modErrorText } from './modErrors';
import pageStyles from '../../../design/components/Page.module.css';
import styles from './ModAdmin.module.css';

const t = de.modAdmin.overview;

function Kpi({ value, label, alert }: { value: number | undefined; label: string; alert?: boolean }) {
  return (
    <div className={[styles.kpi, alert && value ? styles.kpiAlert : ''].join(' ')}>
      <b>{value === undefined ? t.missing : value.toLocaleString('de-DE')}</b>
      <span>
        {label}
        {value === undefined && ` (${t.notYet})`}
      </span>
    </div>
  );
}

export function AdminOverviewPage() {
  const { account } = useProviders();
  const [overview, setOverview] = useState<ModOverview>();
  const [recent, setRecent] = useState<ModReport[]>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let live = true;
    Promise.all([account.modOverview(), account.modReports('open')])
      .then(([o, r]) => {
        if (!live) return;
        setOverview(o);
        setRecent(r.slice(0, 5));
      })
      .catch((e: unknown) => live && setError(modErrorText(e)));
    return () => {
      live = false;
    };
  }, [account]);

  return (
    <Page title={t.title}>
      {error && <Notice tone="error">{error}</Notice>}
      {!overview && !error && <p className="muted">{de.modAdmin.loading}</p>}
      {overview && (
        <>
          <div className={styles.kpis} role="group" aria-label={t.kpiLabel}>
            <Kpi value={overview.openReports} label={t.open} alert />
            <Kpi value={overview.inProgress} label={t.inProgress} />
            <Kpi value={overview.doneToday} label={t.doneToday} />
            <Kpi value={overview.bannedNow} label={t.banned} />
            <Kpi value={overview.newUsers7d} label={t.newUsers} />
            <Kpi value={overview.openAppeals} label={t.appeals} />
          </div>
          {/* Hinweis nur, solange der Server eine Zahl noch nicht liefert (ältere Fassung von mod_overview) */}
          {[
            overview.inProgress,
            overview.doneToday,
            overview.bannedNow,
            overview.newUsers7d,
            overview.openAppeals,
          ].some((v) => v === undefined) && <p className={`muted ${styles.small}`}>{t.missingHint}</p>}
        </>
      )}
      <Section title={t.recent}>
        {recent && recent.length === 0 && <p className="muted">{t.noneOpen}</p>}
        {recent && recent.length > 0 && (
          <ul className={styles.list}>
            {recent.map((r) => (
              <li key={r.id}>
                <ReportItem report={r} priority={reportPriority(r)} />
              </li>
            ))}
          </ul>
        )}
        <p>
          <Link to={`${ADMIN_BASE}/meldungen`}>{t.allReports}</Link>
        </p>
      </Section>
      <Section title={t.quick}>
        <div className={pageStyles.card}>
          <ListLink to={`${ADMIN_BASE}/meldungen`} icon={<FlagIcon />} title={t.quickReports} />
          <ListLink to={`${ADMIN_BASE}/nutzer?auswahl=reported`} icon={<FeedIcon />} title={t.quickUsers} />
          <ListLink to={`${ADMIN_BASE}/verwaltung/nachrichten`} icon={<MailIcon />} title={t.quickMessages} />
          <ListLink
            to={`${ADMIN_BASE}/verwaltung/einsprueche`}
            icon={<ShieldIcon />}
            title={t.quickAppeals}
          />
          <ListLink to={`${ADMIN_BASE}/verwaltung/regeln`} icon={<ParagraphIcon />} title={t.quickRules} />
        </div>
      </Section>
    </Page>
  );
}
