// Wann an eine Sicherung erinnert wird (TEST_PLAN BAK-6).
export const REMIND_AFTER_CHANGES = 5;
export const REMIND_AFTER_DAYS = 14;
export const SNOOZE_DAYS = 3;

export function backupReminderDue(p: {
  changes: number;
  oldestChange?: string | undefined;
  lastBackupAt?: string | undefined;
  snoozedUntil?: string | undefined;
  now: number;
}): boolean {
  if (p.changes === 0) return false;
  if (p.snoozedUntil && Date.parse(p.snoozedUntil) > p.now) return false;
  if (p.changes >= REMIND_AFTER_CHANGES) return true;
  const ref = p.lastBackupAt ?? p.oldestChange;
  return !!ref && p.now - Date.parse(ref) > REMIND_AFTER_DAYS * 864e5;
}
