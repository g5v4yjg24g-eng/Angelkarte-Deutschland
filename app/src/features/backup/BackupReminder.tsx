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
  if (!state?.reminderDue || pathname.startsWith('/mehr/daten')) return null;
  return (
    // Auf der Karte schwebend, damit sie die Karte nicht verschiebt, während man tippt
    <div className={[styles.bar, pathname === '/' ? styles.floating : ''].join(' ')} role="status">
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
