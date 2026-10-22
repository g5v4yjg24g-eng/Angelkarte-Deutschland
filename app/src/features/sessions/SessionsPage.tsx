// Alle Sessions, neueste zuerst; Start einer neuen Session (M5.4).
import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useLiveQuery } from 'dexie-react-hooks';
import { de } from '../../i18n/de';
import { Page } from '../../design/components/Page';
import { Button } from '../../design/components/Button';
import { EmptyState } from '../../design/components/EmptyState';
import { Notice } from '../../design/components/Notice';
import { BookIcon, ChevronRightIcon } from '../../design/icons';
import { getDb } from '../../data/db';
import { durationMs, formatDuration, isRunning } from '../../domain/session';
import { formatDateTime } from '../../lib/storage';
import { useNow } from '../../lib/useNow';
import { tryStartSession } from './sessionActions';
import styles from './Sessions.module.css';

const t = de.sessions;

export function SessionsPage() {
  const now = useNow();
  const navigate = useNavigate();
  const [error, setError] = useState<string>();
  const data = useLiveQuery(async () => {
    const db = getDb();
    const [sessions, catches] = await Promise.all([db.sessions.toArray(), db.catches.toArray()]);
    const counts = new Map<string, number>();
    for (const c of catches)
      if (!c.deletedAt && c.sessionId) counts.set(c.sessionId, (counts.get(c.sessionId) ?? 0) + 1);
    return {
      sessions: sessions
        .filter((s) => !s.deletedAt)
        .sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt)),
      counts,
    };
  }, []);

  if (!data)
    return (
      <Page title={t.title} back="/fangbuch">
        <Notice>{de.catches.loading}</Notice>
      </Page>
    );
  const running = data.sessions.some(isRunning);
  const start = !running && (
    <Button
      onClick={() =>
        void tryStartSession().then((r) =>
          r.id ? navigate(`/fangbuch/sessions/${r.id}`) : setError(r.error),
        )
      }
    >
      {t.start}
    </Button>
  );

  return (
    <Page title={t.title} back="/fangbuch">
      {error && <Notice tone="error">{error}</Notice>}
      {data.sessions.length === 0 ? (
        <EmptyState icon={<BookIcon size={32} />} title={t.emptyTitle} action={start}>
          {t.emptyText}
        </EmptyState>
      ) : (
        <>
          {start && <div className={styles.top}>{start}</div>}
          <ul className={styles.list}>
            {data.sessions.map((s) => (
              <li key={s.id}>
                <Link to={`/fangbuch/sessions/${s.id}`} className={styles.row}>
                  {isRunning(s) && <span className={styles.dot} aria-hidden="true" />}
                  <span className={styles.rowText}>
                    <span className={styles.rowTitle}>{s.title ?? formatDateTime(s.startAt)}</span>
                    <span className="muted tabular">
                      {[
                        isRunning(s) ? t.running : undefined,
                        formatDuration(durationMs(s, now)),
                        t.entriesCount(data.counts.get(s.id) ?? 0),
                      ]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  <ChevronRightIcon />
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </Page>
  );
}
