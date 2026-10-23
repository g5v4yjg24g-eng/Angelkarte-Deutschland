import { useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router';
import { de } from '../../i18n/de';
import { setSetting } from '../../data/settings';
import { SNOOZE_DAYS } from '../../domain/backup/reminder';
import { toZonedIso } from '../../domain/time';
import { useBackupState } from './useBackupState';
import styles from './BackupReminder.module.css';

/** Unaufdringliche Leiste, wenn ungesicherte Änderungen vorliegen (TEST_PLAN BAK-6). */
export function BackupReminder() {
  const state = useBackupState();
  const { pathname } = useLocation();
  const ref = useRef<HTMLDivElement>(null);
  const visible = !!state?.reminderDue && !pathname.startsWith('/mehr/daten');
  // Eigene Höhe als --reminder-h melden: Kartenknöpfe, Seiteninhalt und Hinweise bleiben darüber
  useEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!visible || !el) return;
    const set = () => root.style.setProperty('--reminder-h', `${el.offsetHeight + 8}px`);
    set();
    const ro = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(set);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--reminder-h');
    };
  }, [visible]);
  if (!visible || !state) return null;
  return (
    // Schwebt als Glas-Kapsel über der unteren Leiste (wie die Leiste selbst), auf allen Seiten gleich
    <div ref={ref} className={styles.bar} role="status">
      <span className={styles.text}>
        <span className={styles.dot} aria-hidden="true" />
        {de.backup.reminder(state.changes)}
      </span>
      <span className={styles.actions}>
        <button
          type="button"
          className={styles.later}
          onClick={() =>
            void setSetting('backupReminderSnoozedUntil', toZonedIso(Date.now() + SNOOZE_DAYS * 864e5))
          }
        >
          {de.backup.reminderLater}
        </button>
        <Link to="/mehr/daten" className={styles.now}>
          {de.backup.reminderAction}
        </Link>
      </span>
    </div>
  );
}
