import { describe, expect, it } from 'vitest';
import { backupReminderDue } from './reminder';

const now = Date.parse('2026-10-21T12:00:00Z');
const daysAgo = (d: number) => new Date(now - d * 864e5).toISOString();

describe('BAK-6: Sicherungs-Erinnerung', () => {
  it('ohne Änderungen nie', () => expect(backupReminderDue({ changes: 0, now })).toBe(false));
  it('ab 5 Änderungen', () => {
    expect(backupReminderDue({ changes: 4, lastBackupAt: daysAgo(1), now })).toBe(false);
    expect(backupReminderDue({ changes: 5, lastBackupAt: daysAgo(1), now })).toBe(true);
  });
  it('bei 1 Änderung nach 14 Tagen seit der letzten Sicherung', () => {
    expect(backupReminderDue({ changes: 1, lastBackupAt: daysAgo(13), now })).toBe(false);
    expect(backupReminderDue({ changes: 1, lastBackupAt: daysAgo(15), now })).toBe(true);
  });
  it('nie gesichert: zählt ab der ältesten ungesicherten Änderung', () => {
    expect(backupReminderDue({ changes: 2, oldestChange: daysAgo(3), now })).toBe(false);
    expect(backupReminderDue({ changes: 2, oldestChange: daysAgo(20), now })).toBe(true);
  });
  it('„Später" pausiert die Erinnerung', () => {
    expect(backupReminderDue({ changes: 9, snoozedUntil: new Date(now + 864e5).toISOString(), now })).toBe(
      false,
    );
    expect(backupReminderDue({ changes: 9, snoozedUntil: daysAgo(1), now })).toBe(true);
  });
});
