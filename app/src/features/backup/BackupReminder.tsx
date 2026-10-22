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
  const floating = visible && pathname === '/';
  // Auf der Karte: eigene Höhe als --reminder-h melden, damit die Kartenknöpfe darüber bleiben
  useEffect(() => {
    const el = ref.current;
    const root = document.documentElement;
    if (!floating || !el) return;
    const set = () => root.style.setProperty('--reminder-h', `${el.offsetHeight + 8}px`);
    set();
    const ro = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(set);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      root.style.removeProperty('--reminder-h');
    };
  }, [floating]);
  if (!visible || !state) return null;
  return (
    // Auf der Karte schwebend, damit sie die Karte nicht verschiebt, während man tippt
    <div ref={ref} className={[styles.bar, floating ? styles.floating : ''].join(' ')} role="status">
      <span>{de.backup.reminder(state.changes)}</span>
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
