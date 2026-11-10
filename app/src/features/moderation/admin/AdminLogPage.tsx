// Admin → Verwaltung → Moderationsprotokoll (Wunsch Nutzer 2026-11-10): alle Eingriffe, neueste zuerst, filterbar
// nach Aktion. Nur lesen – der Server lässt Einträge weder ändern noch löschen.
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { de } from '../../../i18n/de';
import { Page } from '../../../design/components/Page';
import { Button } from '../../../design/components/Button';
import { SelectField } from '../../../design/components/Field';
import { Notice } from '../../../design/components/Notice';
import { LOG_ACTIONS, LOG_PAGE, type ModLogItem } from '../../../domain/modTools';
import { useProviders } from '../../../ports/providersContext';
import { ADMIN_BASE, adminReport, adminUser } from './adminPaths';
import { modDate, modErrorText } from './modErrors';
import styles from './ModAdmin.module.css';

const t = de.modAdmin.protocol;
const actionLabel = (a: string) => de.modAdmin.logActions[a] ?? a;
const OPTIONS = [
  { value: '', label: t.allActions },
  ...LOG_ACTIONS.map((a) => ({ value: a as string, label: actionLabel(a) })),
];

interface Loaded {
  action: string;
  list?: ModLogItem[];
  error?: string;
  more?: boolean;
}

export function AdminLogPage() {
  const { account } = useProviders();
  const [params, setParams] = useSearchParams();
  const raw = params.get('aktion') ?? '';
  const action = (LOG_ACTIONS as readonly string[]).includes(raw) ? raw : '';
  const [loaded, setLoaded] = useState<Loaded>();
  const [loadingMore, setLoadingMore] = useState(false);
  const list = loaded?.action === action ? loaded.list : undefined;
  const error = loaded?.action === action ? loaded.error : undefined;

  useEffect(() => {
    let live = true;
    account
      .modLogList(action || undefined)
      .then((l) => live && setLoaded({ action, list: l, more: l.length >= LOG_PAGE }))
      .catch((e: unknown) => live && setLoaded({ action, error: modErrorText(e) }));
    return () => {
      live = false;
    };
  }, [account, action]);

  const loadMore = useCallback(async () => {
    const last = list?.at(-1);
    if (!last) return;
    setLoadingMore(true);
    try {
      const next = await account.modLogList(action || undefined, last.createdAt);
      setLoaded({ action, list: [...(list ?? []), ...next], more: next.length >= LOG_PAGE });
    } catch (e) {
      setLoaded({ action, ...(list ? { list } : {}), error: modErrorText(e) });
    } finally {
      setLoadingMore(false);
    }
  }, [account, action, list]);

  return (
    <Page title={t.title} back={`${ADMIN_BASE}/verwaltung`}>
      <p className="muted">{t.intro}</p>
      <SelectField
        label={t.filter}
        value={action}
        options={OPTIONS}
        onChange={(e) => {
          const p = new URLSearchParams(params);
          if (e.target.value) p.set('aktion', e.target.value);
          else p.delete('aktion');
          setParams(p, { replace: true });
        }}
      />
      {error && <Notice tone="error">{error}</Notice>}
      {!list && !error && <p className="muted">{de.modAdmin.loading}</p>}
      {list?.length === 0 && <p className="muted">{t.empty}</p>}
      {list && list.length > 0 && (
        <ol className={styles.list} aria-label={t.title}>
          {list.map((l) => (
            <li key={l.id} className={styles.item}>
              <span className={styles.row}>
                <strong>{actionLabel(l.action)}</strong>
                <span className="muted">{modDate(l.createdAt)}</span>
              </span>
              {l.detail && <span>{l.detail}</span>}
              <span className="muted">
                {l.moderatorName && de.modAdmin.byModerator(l.moderatorName)}
                {l.targetName &&
                  ` · ${t.target(l.targetUsername ? `${l.targetName} (@${l.targetUsername})` : l.targetName)}`}
              </span>
              {(l.targetUserId || l.reportId) && (
                <span className={styles.links}>
                  {l.targetUserId && <Link to={adminUser(l.targetUserId)}>{t.openUser}</Link>}
                  {l.reportId && <Link to={adminReport(l.reportId)}>{t.openReport}</Link>}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
      {list && list.length > 0 && loaded?.more && (
        <Button variant="secondary" disabled={loadingMore} onClick={() => void loadMore()}>
          {t.more}
        </Button>
      )}
      {list && list.length > 0 && !loaded?.more && <p className={`muted ${styles.small}`}>{t.end}</p>}
    </Page>
  );
}
