// Admin → Nutzer (Phase 1): Konten, gegen die es Meldungen gibt (aus mod_reports, echte Daten). Die Suche nach allen
// Konten folgt in Phase 4.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { de } from '../../../i18n/de';
import { Page } from '../../../design/components/Page';
import { Notice } from '../../../design/components/Notice';
import { reportedUsers, type ReportedUser } from '../../../domain/modAdmin';
import { useProviders } from '../../../ports/providersContext';
import { ADMIN_BASE } from './adminPaths';
import { modDate, modErrorText } from './modErrors';
import styles from './ModAdmin.module.css';

const t = de.modAdmin;

export function ModUsersPage() {
  const { account } = useProviders();
  const [list, setList] = useState<ReportedUser[]>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    let live = true;
    account
      .modReports('all')
      .then((r) => live && setList(reportedUsers(r)))
      .catch((e: unknown) => live && setError(modErrorText(e)));
    return () => {
      live = false;
    };
  }, [account]);
  return (
    <Page title={t.users.title}>
      <p className="muted">{t.users.intro}</p>
      {error && <Notice tone="error">{error}</Notice>}
      {!list && !error && <p className="muted">{t.loading}</p>}
      {list && list.length === 0 && <p className="muted">{t.users.empty}</p>}
      {list && list.length > 0 && (
        <ul className={styles.list}>
          {list.map((u) => (
            <li key={u.userId}>
              <Link to={`${ADMIN_BASE}/nutzer/${u.userId}`} className={styles.item}>
                <span className={styles.row}>
                  <strong>{u.name ?? '–'}</strong>
                  {u.banned ? (
                    <span className={styles.tagDanger}>{t.banned}</span>
                  ) : (
                    u.open > 0 && <span className={styles.tag}>{t.statusOpen}</span>
                  )}
                </span>
                {u.username && <span className="muted">{t.handle(u.username)}</span>}
                <span className="muted">
                  {t.users.reports(u.reports, u.open)} · {modDate(u.last)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}
