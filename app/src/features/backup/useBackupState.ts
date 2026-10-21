import { useLiveQuery } from 'dexie-react-hooks';
import { getDb } from '../../data/db';
import { changesSince } from '../../data/backupService';
import { getSetting } from '../../data/settings';
import { backupReminderDue } from '../../domain/backup/reminder';

/** Live-Zustand für Sicherung und Erinnerung (aktualisiert sich bei jeder DB-Änderung). */
export function useBackupState() {
  return useLiveQuery(async () => {
    const db = getDb();
    const [lastBackupAt, snoozedUntil] = await Promise.all([
      getSetting('lastBackupAt'),
      getSetting('backupReminderSnoozedUntil'),
    ]);
    const changes = await changesSince(lastBackupAt);
    const counts = {
      catches: await db.catches.filter((c) => !c.deletedAt).count(),
      places: await db.places.filter((p) => !p.deletedAt).count(),
      sessions: await db.sessions.filter((s) => !s.deletedAt).count(),
      photos: await db.photos.count(),
    };
    const snapshot = await db.snapshots.orderBy('createdAt').last();
    return {
      lastBackupAt,
      changes: changes.count,
      counts,
      lastSnapshot: snapshot ? { id: snapshot.id, createdAt: snapshot.createdAt } : undefined,
      reminderDue: backupReminderDue({
        changes: changes.count,
        oldestChange: changes.oldest,
        lastBackupAt,
        snoozedUntil,
        now: Date.now(),
      }),
    };
  });
}
